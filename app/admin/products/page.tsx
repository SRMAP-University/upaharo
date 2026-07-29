'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { resolveImageUrl } from '@/lib/image-url'
import {
  adminProductEditHref,
  adminProductsListPath,
} from '@/lib/admin-products-list'

interface Product {
  id: string
  name: string
  price: number
  wholesalePrice?: number | null
  image: string
  isAvailable: boolean
  category: string
  createdAt: string
  sku?: string | null
  trackStock?: boolean
  stockQty?: number | null
}

function stockLabel(product: Product) {
  if (!product.trackStock) return null
  const qty = product.stockQty ?? 0
  if (qty <= 0) return { text: 'Out', className: 'bg-red-100 text-red-800' }
  return { text: `${qty} left`, className: 'bg-amber-100 text-amber-900' }
}

function AdminProductsContent() {
  const router = useRouter()
  const urlParams = useSearchParams()
  const urlPage = Math.max(1, Number.parseInt(urlParams.get('page') ?? '1', 10) || 1)
  const urlSearch = urlParams.get('search') ?? ''
  const urlCategory = urlParams.get('category') ?? 'all'
  const urlAvailability = urlParams.get('availability') ?? 'all'
  const urlSort = urlParams.get('sort') ?? 'newest'
  const urlArchived = urlParams.get('archived') === '1'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(urlSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch)
  const [category, setCategory] = useState(urlCategory || 'all')
  const [availability, setAvailability] = useState(urlAvailability || 'all')
  const [sort, setSort] = useState(urlSort || 'newest')
  const [showArchived, setShowArchived] = useState(urlArchived)
  const [currentPage, setCurrentPage] = useState(urlPage)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedStoreName, setSelectedStoreName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const itemsPerPage = 50
  const skipUrlSync = useRef(true)

  const listFilters = useMemo(
    () => ({
      page: currentPage,
      search: debouncedSearch,
      category,
      availability,
      sort,
      archived: showArchived,
    }),
    [availability, category, currentPage, debouncedSearch, showArchived, sort]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const prevFilterKey = useRef(`${debouncedSearch}|${category}|${availability}|${sort}|${showArchived}`)
  useEffect(() => {
    const key = `${debouncedSearch}|${category}|${availability}|${sort}|${showArchived}`
    if (prevFilterKey.current !== key) {
      prevFilterKey.current = key
      setCurrentPage(1)
      setSelectedIds([])
    }
  }, [availability, category, debouncedSearch, showArchived, sort])

  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false
      return
    }
    const next = adminProductsListPath(listFilters)
    const current = `${window.location.pathname}${window.location.search}`
    if (current !== next) {
      router.replace(next, { scroll: false })
    }
  }, [listFilters, router])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories?type=PRODUCT', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const names = (Array.isArray(data) ? data : [])
        .map((c: { name?: string }) => String(c?.name || '').trim())
        .filter(Boolean)
      setCategories(names)
    } catch {
      // ignore
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const storeRes = await fetch('/api/admin/store', { cache: 'no-store' })
      if (storeRes.ok) {
        const storeData = (await storeRes.json()) as {
          selectedSlug?: string
          stores?: Array<{ slug: string; name: string }>
        }
        const slug = storeData.selectedSlug || 'gifts'
        setSelectedStore(slug)
        setSelectedStoreName(
          storeData.stores?.find((store) => store.slug === slug)?.name || slug
        )
      }

      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
        sort,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (category && category !== 'all') params.set('category', category)
      if (availability && availability !== 'all') params.set('availability', availability)
      if (showArchived) params.set('archived', '1')

      const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setProducts([])
        setTotalProducts(0)
        setTotalPages(1)
        setLoadError(data?.error || `Failed to load products (${res.status})`)
        return
      }

      setProducts(Array.isArray(data?.products) ? data.products : [])
      setTotalProducts(Number(data?.total) || 0)
      setTotalPages(Math.max(1, Number(data?.totalPages) || 1))
      setSelectedIds([])
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
      setTotalProducts(0)
      setTotalPages(1)
      setLoadError('Failed to load products. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [availability, category, currentPage, debouncedSearch, itemsPerPage, showArchived, sort])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  const allSelected = products.length > 0 && selectedIds.length === products.length

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : products.map((p) => p.id))
  }

  const runBulk = async (action: string, extra?: Record<string, unknown>) => {
    if (!selectedIds.length) return
    if (action === 'delete' && !confirm(`Delete ${selectedIds.length} product(s)?`)) return

    setBulkBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: selectedIds, ...extra }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(data?.error || 'Bulk action failed')
        return
      }
      const parts = [
        data.updated ? `${data.updated} updated` : null,
        data.archived ? `${data.archived} archived` : null,
        data.deleted ? `${data.deleted} deleted` : null,
      ].filter(Boolean)
      setMessage(parts.length ? `Bulk ${action}: ${parts.join(', ')}` : `Bulk ${action} complete`)
      void fetchProducts()
    } catch (error) {
      console.error(error)
      setMessage('Bulk action failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const toggleAvailability = async (productId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      })
      if (res.ok) void fetchProducts()
    } catch (error) {
      console.error('Error updating product:', error)
    }
  }

  const duplicateProduct = async (productId: string) => {
    setMessage('')
    try {
      const res = await fetch(`/api/admin/products/${productId}/duplicate`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(data?.error || 'Failed to duplicate product')
        return
      }
      setMessage('Product duplicated (set to unavailable).')
      void fetchProducts()
    } catch (error) {
      console.error(error)
      setMessage('Failed to duplicate product')
    }
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        setMessage(
          data.archived
            ? 'Product had existing orders, so it was archived instead of permanently deleted.'
            : 'Product deleted successfully.'
        )
        void fetchProducts()
      } else {
        const data = await res.json().catch(() => null)
        setMessage(data?.error || 'Failed to delete product.')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      setMessage('Failed to delete product.')
    }
  }

  const restoreProduct = async (productId: string) => {
    setBulkBusy(true)
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', ids: [productId] }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(data?.error || 'Failed to restore product')
        return
      }
      setMessage('Product restored (unavailable until you enable it).')
      void fetchProducts()
    } catch {
      setMessage('Failed to restore product')
    } finally {
      setBulkBusy(false)
    }
  }

  const exportCsv = () => {
    const params = new URLSearchParams({ sort })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (category && category !== 'all') params.set('category', category)
    if (availability && availability !== 'all') params.set('availability', availability)
    if (showArchived) params.set('archived', '1')
    window.location.href = `/api/admin/products/export?${params.toString()}`
  }

  const handleImportFile = async (file: File) => {
    setImporting(true)
    setMessage('')
    try {
      const form = new FormData()
      form.append('file', file)
      const looksRasanmart = file.name.toLowerCase().includes('rasanmart')
      form.append('format', looksRasanmart ? 'rasanmart' : 'native')
      const res = await fetch('/api/admin/products/import', { method: 'POST', body: form })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(data?.error || 'Import failed')
        return
      }
      const errCount = Array.isArray(data?.errors) ? data.errors.length : 0
      setMessage(
        `Import done: ${data.created || 0} created, ${data.updated || 0} updated` +
          (errCount ? `, ${errCount} row error(s)` : '')
      )
      void fetchProducts()
      void fetchCategories()
    } catch {
      setMessage('Import failed')
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const pageStart = totalProducts === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const pageEnd = Math.min(currentPage * itemsPerPage, totalProducts)
  const selectClass =
    'px-3 py-2.5 bg-white border border-wine/15 rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="hidden font-display text-2xl font-semibold text-ink md:block md:text-3xl">Products</h1>
          <p className="text-ink/55 mt-1">
            Manage inventory
            {selectedStoreName ? (
              <>
                {' '}
                for <span className="font-semibold text-ink">{selectedStoreName}</span>
              </>
            ) : null}
            {totalProducts > 0 ? (
              <span className="text-ink/45"> · {totalProducts.toLocaleString()} total</span>
            ) : null}
          </p>
          {selectedStore === 'grocery' && (
            <p className="text-xs text-ink/45 mt-1">
              Use the store dropdown in the header if you expected a different catalog.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImportFile(file)
            }}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="rounded-full border border-wine/20 bg-white px-4 py-2.5 text-sm font-semibold text-wine hover:bg-cream disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-full border border-wine/20 bg-white px-4 py-2.5 text-sm font-semibold text-wine hover:bg-cream"
          >
            Export CSV
          </button>
          <Link
            href="/admin/products/new"
            className="bg-wine hover:bg-wine-deep text-white px-5 py-2.5 rounded-full font-semibold transition-colors text-sm md:text-base w-full sm:w-auto text-center"
          >
            + Add Product
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="text"
          placeholder="Search products or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${selectClass} lg:col-span-2`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="all">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className={selectClass}
          disabled={showArchived}
        >
          <option value="all">All availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="stock">Stock</option>
        </select>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="rounded border-wine/30"
        />
        Show archived products
      </label>

      {loadError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {message && (
        <div className="mb-6 rounded-xl border border-wine/10 bg-white px-4 py-3 text-sm text-ink/70">
          {message}
        </div>
      )}

      <div className="bg-white rounded-[22px] border border-wine/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink/55">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-ink/55">
            No products found for {selectedStoreName || 'this store'}.
            {selectedStore !== 'grocery' && !showArchived && (
              <div className="mt-2 text-sm">
                Switch to <span className="font-semibold">Upaharo Grocery</span> in the header dropdown.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead className="bg-cream-deep/50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wine/10">
                  {products.map((product) => {
                    const stock = stockLabel(product)
                    return (
                      <tr key={product.id} className="hover:bg-cream/60">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(product.id)}
                            onChange={() => toggleSelect(product.id)}
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-cream-deep rounded-xl overflow-hidden flex-shrink-0">
                              <Image
                                unoptimized
                                src={resolveImageUrl(product.image)}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <span className="font-medium text-ink">{product.name}</span>
                              {product.sku ? (
                                <div className="text-xs text-ink/45 mt-0.5">SKU {product.sku}</div>
                              ) : null}
                              {stock ? (
                                <span
                                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${stock.className}`}
                                >
                                  {stock.text}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-ink/55">{product.category}</td>
                        <td className="px-6 py-4 text-sm font-medium text-ink">
                          <div>Rs. {product.price}</div>
                          {product.wholesalePrice != null && (
                            <div className="text-xs font-normal text-wine mt-0.5">
                              B2B Rs. {product.wholesalePrice}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {showArchived ? (
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-ink/10 text-ink/70">
                              Archived
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleAvailability(product.id, product.isAvailable)}
                              className={`px-3 py-1 text-xs font-medium rounded-full ${
                                product.isAvailable
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {product.isAvailable ? 'Available' : 'Unavailable'}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {showArchived ? (
                              <button
                                onClick={() => restoreProduct(product.id)}
                                className="text-wine hover:text-wine-deep text-sm font-semibold"
                                disabled={bulkBusy}
                              >
                                Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => duplicateProduct(product.id)}
                                  className="text-ink/55 hover:text-ink text-sm font-medium"
                                >
                                  Duplicate
                                </button>
                                <Link
                                  href={adminProductEditHref(product.id, listFilters)}
                                  className="text-wine hover:text-wine-deep text-sm font-semibold"
                                >
                                  Edit
                                </Link>
                                <button
                                  onClick={() => deleteProduct(product.id)}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-wine/10">
              {products.map((product) => {
                const stock = stockLabel(product)
                return (
                  <div key={`${product.id}-mobile`} className="p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        aria-label={`Select ${product.name}`}
                      />
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-cream-deep">
                        <Image
                          unoptimized
                          src={resolveImageUrl(product.image)}
                          alt={product.name}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-ink">{product.name}</div>
                        <div className="text-xs text-ink/55">{product.category}</div>
                        {product.sku ? (
                          <div className="text-[11px] text-ink/45">SKU {product.sku}</div>
                        ) : null}
                        <div className="mt-1 text-xs font-semibold text-ink">
                          Rs. {product.price}
                          {product.wholesalePrice != null && (
                            <span className="ml-1.5 font-normal text-wine">
                              · B2B Rs. {product.wholesalePrice}
                            </span>
                          )}
                        </div>
                        {stock ? (
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${stock.className}`}
                          >
                            {stock.text}
                          </span>
                        ) : null}
                      </div>
                      {!showArchived && (
                        <button
                          onClick={() => toggleAvailability(product.id, product.isAvailable)}
                          className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                            product.isAvailable
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {product.isAvailable ? 'Available' : 'Unavailable'}
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {showArchived ? (
                        <button
                          onClick={() => restoreProduct(product.id)}
                          disabled={bulkBusy}
                          className="col-span-2 rounded-xl border border-wine/15 px-3 py-2 text-center text-xs font-semibold text-wine hover:bg-cream"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => duplicateProduct(product.id)}
                            className="rounded-xl border border-wine/15 px-3 py-2 text-center text-xs font-semibold text-ink/70 hover:bg-cream"
                          >
                            Duplicate
                          </button>
                          <Link
                            href={adminProductEditHref(product.id, listFilters)}
                            className="rounded-xl border border-wine/15 px-3 py-2 text-center text-xs font-semibold text-wine hover:bg-cream"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="col-span-2 rounded-xl border border-red-200 px-3 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="px-4 md:px-6 py-4 border-t border-wine/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs md:text-sm text-ink/55">
                  Showing {pageStart} to {pageEnd} of {totalProducts.toLocaleString()} products
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 bg-cream-deep text-ink/70 rounded-xl hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-ink/70 text-xs md:text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 bg-cream-deep text-ink/70 rounded-xl hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-wine/15 bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:max-w-3xl md:rounded-2xl md:border md:shadow-lg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-ink">{selectedIds.length} selected</div>
            <div className="flex flex-wrap gap-2">
              {showArchived ? (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => runBulk('restore')}
                  className="rounded-full bg-wine px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Restore
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => runBulk('enable')}
                    className="rounded-full bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Enable
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => runBulk('disable')}
                    className="rounded-full bg-ink/70 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Disable
                  </button>
                  <div className="flex items-center gap-1">
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="rounded-full border border-wine/20 px-2 py-1 text-xs"
                    >
                      <option value="">Move to…</option>
                      {categories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={bulkBusy || !bulkCategory}
                      onClick={() => runBulk('setCategory', { category: bulkCategory })}
                      className="rounded-full border border-wine/20 px-3 py-1.5 text-xs font-semibold text-wine disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => runBulk('delete')}
                    className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-full border border-wine/15 px-3 py-1.5 text-xs font-semibold text-ink/60"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminProducts() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-ink/55">Loading products...</div>}>
      <AdminProductsContent />
    </Suspense>
  )
}
