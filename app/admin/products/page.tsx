'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
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
}

function AdminProductsContent() {
  const router = useRouter()
  const urlParams = useSearchParams()
  const urlPage = Math.max(1, Number.parseInt(urlParams.get('page') ?? '1', 10) || 1)
  const urlSearch = urlParams.get('search') ?? ''

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(urlSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch)
  const [currentPage, setCurrentPage] = useState(urlPage)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedStoreName, setSelectedStoreName] = useState('')
  const itemsPerPage = 50
  const skipUrlSync = useRef(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const prevDebouncedSearch = useRef(debouncedSearch)
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch
      setCurrentPage(1)
    }
  }, [debouncedSearch])

  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false
      return
    }
    const next = adminProductsListPath(currentPage, debouncedSearch)
    const current = `${window.location.pathname}${window.location.search}`
    if (current !== next) {
      router.replace(next, { scroll: false })
    }
  }, [currentPage, debouncedSearch, router])

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
      })
      if (debouncedSearch) params.set('search', debouncedSearch)

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
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
      setTotalProducts(0)
      setTotalPages(1)
      setLoadError('Failed to load products. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearch, itemsPerPage])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  const toggleAvailability = async (productId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      })
      if (res.ok) {
        void fetchProducts()
      }
    } catch (error) {
      console.error('Error updating product:', error)
    }
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
      })
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

  const pageStart = totalProducts === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const pageEnd = Math.min(currentPage * itemsPerPage, totalProducts)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink">Products</h1>
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
        <Link
          href="/admin/products/new"
          className="bg-wine hover:bg-wine-deep text-white px-5 py-2.5 rounded-full font-semibold transition-colors text-sm md:text-base w-full md:w-auto text-center"
        >
          + Add Product
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:max-w-md px-3 py-2.5 md:px-4 bg-white border border-wine/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink text-sm"
        />
      </div>

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
            {selectedStore !== 'grocery' && (
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-ink/55 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wine/10">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-cream/60">
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
                          <span className="font-medium text-ink">{product.name}</span>
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
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={adminProductEditHref(product.id, currentPage, debouncedSearch)}
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-wine/10">
              {products.map((product) => (
                <div key={`${product.id}-mobile`} className="p-4">
                  <div className="flex items-center gap-3">
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
                      <div className="mt-1 text-xs font-semibold text-ink">
                        Rs. {product.price}
                        {product.wholesalePrice != null && (
                          <span className="ml-1.5 font-normal text-wine">
                            · B2B Rs. {product.wholesalePrice}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAvailability(product.id, product.isAvailable)}
                      className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                        product.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.isAvailable ? 'Available' : 'Unavailable'}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link
                      href={adminProductEditHref(product.id, currentPage, debouncedSearch)}
                      className="rounded-xl border border-wine/15 px-3 py-2 text-center text-xs font-semibold text-wine hover:bg-cream"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="rounded-xl border border-red-200 px-3 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
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
