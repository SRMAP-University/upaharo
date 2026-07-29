'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { resolveImageUrl } from '@/lib/image-url'

type LinkType = 'NONE' | 'PRODUCT' | 'CATEGORY'

interface MiniBanner {
  id: string
  title: string
  image: string
  linkType: LinkType
  linkId: string | null
  linkLabel: string | null
  order: number
  isActive: boolean
}

interface CatalogProduct {
  id: string
  name: string
  category: string
  isAvailable?: boolean
}

interface CategoryRow {
  id: string
  name: string
  type?: string
  isActive?: boolean
}

const INPUT_CLASS =
  'w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

const emptyForm = {
  title: '',
  image: '',
  linkType: 'CATEGORY' as LinkType,
  linkId: '',
  order: 0,
  isActive: true,
}

export default function AdminMiniBanners() {
  const [banners, setBanners] = useState<MiniBanner[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MiniBanner | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchBanners()
    void fetchCatalog()
  }, [])

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/admin/mini-banners')
      if (res.ok) {
        const data = await res.json()
        setBanners(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching mini banners:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCatalog = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/categories'),
      ])
      if (productsRes.ok) {
        const data = await productsRes.json()
        const list = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
            ? data
            : []
        setProducts(
          list.map((p: CatalogProduct & { isAvailable?: boolean }) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            isAvailable: p.isAvailable !== false,
          }))
        )
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        const list = Array.isArray(data) ? data : []
        setCategories(
          list.filter(
            (c: CategoryRow) =>
              (!c.type || c.type === 'PRODUCT') && c.isActive !== false
          )
        )
      }
    } catch (err) {
      console.error('Error fetching catalog for mini banners:', err)
    }
  }

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    const available = products.filter((p) => p.isAvailable !== false)
    if (!q) return available.slice(0, 30)
    return available
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      )
      .slice(0, 30)
  }, [products, productQuery])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === formData.linkId) ?? null,
    [products, formData.linkId]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.linkType !== 'NONE' && !formData.linkId) {
      setError(
        formData.linkType === 'PRODUCT'
          ? 'Pick a product to link to, or switch the target to "Nothing".'
          : 'Pick a category to link to, or switch the target to "Nothing".'
      )
      return
    }

    try {
      const url = editing
        ? `/api/admin/mini-banners/${editing.id}`
        : '/api/admin/mini-banners'

      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          image: formData.image,
          linkType: formData.linkType,
          linkId: formData.linkType === 'NONE' ? '' : formData.linkId,
          order: formData.order,
          isActive: formData.isActive,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to save banner.')
        return
      }

      await fetchBanners()
      resetForm()
    } catch (err) {
      console.error('Error saving mini banner:', err)
      setError('Failed to save banner.')
    }
  }

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this mini banner?')) return
    try {
      const res = await fetch(`/api/admin/mini-banners/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchBanners()
    } catch (err) {
      console.error('Error deleting mini banner:', err)
    }
  }

  const editBanner = (banner: MiniBanner) => {
    setEditing(banner)
    setFormData({
      title: banner.title,
      image: banner.image,
      linkType: banner.linkType,
      linkId: banner.linkId ?? '',
      order: banner.order,
      isActive: banner.isActive,
    })
    setProductQuery('')
    setError('')
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setEditing(null)
    setShowForm(false)
    setProductQuery('')
    setError('')
  }

  const activeCount = banners.filter((b) => b.isActive).length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Mini banners</h1>
          <p className="mt-1 text-ink/55">
            Small tiles shown side by side in the app&apos;s home row. Each links to a
            product or a category.
          </p>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="rounded-full bg-wine px-6 py-2.5 font-semibold text-white hover:bg-wine-deep"
        >
          {showForm ? 'Cancel' : '+ Add Mini Banner'}
        </button>
      </div>

      <p className="mb-6 rounded-xl bg-cream px-4 py-3 text-sm text-ink/70">
        {activeCount} active tile{activeCount === 1 ? '' : 's'}. The row shows as many
        as the “tiles per row” setting allows and scrolls sideways beyond that — set
        the count and height in{' '}
        <a href="/admin/settings" className="font-medium text-wine underline">
          Settings → Mini banner row
        </a>
        .
      </p>

      {showForm && (
        <div className="mb-6 rounded-[22px] border border-wine/10 bg-white p-6">
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">
            {editing ? 'Edit mini banner' : 'New mini banner'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">
                  Title*
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Birthday gifts"
                  className={INPUT_CLASS}
                />
                <p className="mt-1 text-xs text-ink/45">
                  Not drawn on the tile — used to label it here and for screen
                  readers. Put visible copy in the artwork.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">
                  Image URL*
                </label>
                <input
                  type="text"
                  required
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://... or /api/uploads/..."
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">
                  Order
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                  }
                  className={INPUT_CLASS}
                />
                <p className="mt-1 text-xs text-ink/45">
                  Lowest first. Ties fall back to newest.
                </p>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
                  />
                  Active
                </label>
              </div>
            </div>

            {formData.image && (
              <div className="flex items-center gap-3 rounded-2xl border border-wine/10 bg-cream/40 p-3">
                <div className="relative h-16 w-24 overflow-hidden rounded-xl bg-white">
                  <Image
                    src={resolveImageUrl(formData.image)}
                    alt="Preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <span className="text-xs text-ink/45">Tile preview</span>
              </div>
            )}

            <div className="rounded-2xl border border-wine/10 bg-cream/40 p-4">
              <p className="mb-3 text-sm font-medium text-ink/70">Tapping opens</p>
              <div className="flex flex-wrap gap-2">
                {(['CATEGORY', 'PRODUCT', 'NONE'] as LinkType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, linkType: type, linkId: '' })
                    }
                    className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                      formData.linkType === type
                        ? 'bg-wine text-white'
                        : 'border border-wine/15 text-ink/70 hover:bg-wine/5'
                    }`}
                  >
                    {type === 'CATEGORY'
                      ? 'A category'
                      : type === 'PRODUCT'
                        ? 'A product'
                        : 'Nothing'}
                  </button>
                ))}
              </div>

              {formData.linkType === 'CATEGORY' && (
                <select
                  value={formData.linkId}
                  onChange={(e) =>
                    setFormData({ ...formData, linkId: e.target.value })
                  }
                  className={`${INPUT_CLASS} mt-3`}
                >
                  <option value="">Select a category…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}

              {formData.linkType === 'PRODUCT' && (
                <div className="mt-3">
                  {selectedProduct && (
                    <div className="mb-2 flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span className="text-sm text-ink">{selectedProduct.name}</span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, linkId: '' })}
                        className="text-xs text-wine hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                  {!selectedProduct && (
                    <>
                      <input
                        type="text"
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        placeholder="Search products…"
                        className={INPUT_CLASS}
                      />
                      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, linkId: product.id })
                            }
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white"
                          >
                            <span className="text-ink">{product.name}</span>
                            <span className="text-xs text-ink/45">
                              {product.category}
                            </span>
                          </button>
                        ))}
                        {filteredProducts.length === 0 && (
                          <p className="px-3 py-2 text-sm text-ink/45">
                            No products match that search.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {formData.linkType === 'NONE' && (
                <p className="mt-3 text-xs text-ink/45">
                  The tile is display-only and will not respond to taps.
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-full bg-wine px-6 py-2.5 font-semibold text-white hover:bg-wine-deep"
              >
                {editing ? 'Save changes' : 'Create banner'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-wine/20 px-6 py-2.5 font-semibold text-ink/70 hover:bg-wine/5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-ink/55">Loading mini banners…</p>
      ) : banners.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-wine/20 bg-white p-10 text-center">
          <p className="text-ink/55">
            No mini banners yet. Add one to show the row on the app home screen.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="overflow-hidden rounded-[22px] border border-wine/10 bg-white"
            >
              <div className="relative h-32 w-full bg-cream">
                <Image
                  src={resolveImageUrl(banner.image)}
                  alt={banner.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {!banner.isActive && (
                  <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white">
                    Inactive
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-ink">
                    {banner.title}
                  </h3>
                  <span className="shrink-0 text-xs text-ink/45">#{banner.order}</span>
                </div>
                <p className="mt-1 text-sm text-ink/55">
                  {banner.linkType === 'NONE'
                    ? 'No link'
                    : `${banner.linkType === 'PRODUCT' ? 'Product' : 'Category'} · ${
                        banner.linkLabel ?? 'missing'
                      }`}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => editBanner(banner)}
                    className="rounded-lg border border-wine/15 px-3 py-1.5 text-sm text-wine hover:bg-wine/5"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteBanner(banner.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
