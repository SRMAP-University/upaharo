'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import ImageColorPicker from '@/components/admin/ImageColorPicker'

interface BannerProduct {
  id: string
  name: string
  price: number
  image: string
  category: string
}

interface Banner {
  id: string
  title: string
  subtitle: string | null
  image: string
  link: string | null
  bgColor: string | null
  productIds: string[]
  category: string | null
  products?: BannerProduct[]
  order: number
  isActive: boolean
}

interface CatalogProduct {
  id: string
  name: string
  price: number
  image: string
  category: string
  isAvailable?: boolean
}

interface CategoryRow {
  id: string
  name: string
  type?: string
  isActive?: boolean
}

type SpotlightMode = 'products' | 'category'

const emptyForm = {
  title: '',
  subtitle: '',
  image: '',
  link: '',
  bgColor: '#FFE0E8',
  order: 0,
  isActive: true,
  spotlightMode: 'products' as SpotlightMode,
  productIds: [] as string[],
  category: '',
}

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    fetchBanners()
    fetchCatalog()
  }, [])

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/admin/banners')
      if (res.ok) {
        const data = await res.json()
        setBanners(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching banners:', error)
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
        const list = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : []
        setCatalogProducts(
          list.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            image: p.image,
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
    } catch (error) {
      console.error('Error fetching catalog for banners:', error)
    }
  }

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    const available = catalogProducts.filter((p) => p.isAvailable !== false)
    if (!q) return available.slice(0, 40)
    return available
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 40)
  }, [catalogProducts, productQuery])

  const selectedProducts = useMemo(
    () =>
      formData.productIds
        .map((id) => catalogProducts.find((p) => p.id === id))
        .filter(Boolean) as CatalogProduct[],
    [formData.productIds, catalogProducts]
  )

  const toggleProduct = (id: string) => {
    setFormData((prev) => {
      if (prev.productIds.includes(id)) {
        return { ...prev, productIds: prev.productIds.filter((x) => x !== id) }
      }
      if (prev.productIds.length >= 3) return prev
      return { ...prev, productIds: [...prev.productIds, id] }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingBanner
        ? `/api/admin/banners/${editingBanner.id}`
        : '/api/admin/banners'
      const method = editingBanner ? 'PATCH' : 'POST'

      const payload = {
        title: formData.title,
        subtitle: formData.subtitle,
        image: formData.image,
        link: formData.link,
        bgColor: formData.bgColor,
        order: formData.order,
        isActive: formData.isActive,
        productIds:
          formData.spotlightMode === 'products' ? formData.productIds.slice(0, 3) : [],
        category:
          formData.spotlightMode === 'category' ? formData.category.trim() : '',
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        fetchBanners()
        resetForm()
      }
    } catch (error) {
      console.error('Error saving banner:', error)
    }
  }

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return
    try {
      const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
      if (res.ok) fetchBanners()
    } catch (error) {
      console.error('Error deleting banner:', error)
    }
  }

  const editBanner = (banner: Banner) => {
    const hasProducts = (banner.productIds?.length ?? 0) > 0
    setEditingBanner(banner)
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image: banner.image,
      link: banner.link || '',
      bgColor: banner.bgColor || '#FFE0E8',
      order: banner.order,
      isActive: banner.isActive,
      spotlightMode: hasProducts ? 'products' : 'category',
      productIds: banner.productIds?.slice(0, 3) ?? [],
      category: banner.category || '',
    })
    setProductQuery('')
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setEditingBanner(null)
    setShowForm(false)
    setProductQuery('')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Banners</h1>
          <p className="text-ink/55 mt-1">
            Homepage banners with up to 3 spotlight products each
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-wine hover:bg-wine-deep text-white px-6 py-2.5 rounded-full font-semibold"
        >
          {showForm ? 'Cancel' : '+ Add Banner'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-[22px] border border-wine/10 p-6 mb-6">
          <h2 className="font-display text-xl font-semibold text-ink mb-4">
            {editingBanner ? 'Edit Banner' : 'New Banner'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Title*</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Subtitle</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Image URL*</label>
                <input
                  type="text"
                  required
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Link</label>
                <input
                  type="text"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="/products or /products/ID"
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Order</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">
                  Scroll background color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.bgColor || '#FFE0E8'}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-wine/15 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={formData.bgColor}
                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                    placeholder="#FFE0E8"
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-wine border-wine/30 rounded focus:ring-wine/30"
                  />
                  <span className="text-sm font-medium text-ink/70">Active</span>
                </label>
              </div>
            </div>

            <ImageColorPicker
              imageUrl={formData.image}
              value={formData.bgColor || '#FFE0E8'}
              onChange={(hex) => setFormData((prev) => ({ ...prev, bgColor: hex }))}
            />

            <div className="rounded-2xl border border-wine/10 bg-cream/40 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-ink">Banner products (app)</p>
                <p className="text-xs text-ink/50 mt-0.5">
                  Show up to 3 products at the bottom of this banner slide. They scroll with the
                  banner.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      spotlightMode: 'products',
                      category: '',
                    }))
                  }
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${
                    formData.spotlightMode === 'products'
                      ? 'bg-wine text-white border-wine'
                      : 'bg-white text-wine border-wine/20'
                  }`}
                >
                  Specific products
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      spotlightMode: 'category',
                      productIds: [],
                    }))
                  }
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${
                    formData.spotlightMode === 'category'
                      ? 'bg-wine text-white border-wine'
                      : 'bg-white text-wine border-wine/20'
                  }`}
                >
                  Category
                </button>
              </div>

              {formData.spotlightMode === 'products' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 min-h-[28px]">
                    {selectedProducts.length === 0 ? (
                      <span className="text-xs text-ink/45">No products selected (0/3)</span>
                    ) : (
                      selectedProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProduct(p.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-wine/15 bg-white px-2.5 py-1 text-xs font-medium text-ink"
                        >
                          <span className="relative h-6 w-6 overflow-hidden rounded-full bg-cream">
                            {p.image ? (
                              <Image unoptimized src={p.image} alt="" fill className="object-cover" />
                            ) : null}
                          </span>
                          {p.name}
                          <span className="text-ink/40">×</span>
                        </button>
                      ))
                    )}
                  </div>
                  <input
                    type="search"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search products to add…"
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-wine/10 bg-white divide-y divide-wine/5">
                    {filteredProducts.map((p) => {
                      const selected = formData.productIds.includes(p.id)
                      const full = !selected && formData.productIds.length >= 3
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={full}
                          onClick={() => toggleProduct(p.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm ${
                            selected ? 'bg-wine/5' : 'hover:bg-cream/80'
                          } ${full ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-cream">
                            {p.image ? (
                              <Image unoptimized src={p.image} alt="" fill className="object-cover" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">{p.name}</span>
                            <span className="block truncate text-xs text-ink/45">
                              {p.category} · NPR {Math.round(p.price)}
                            </span>
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              selected ? 'text-wine' : 'text-ink/35'
                            }`}
                          >
                            {selected ? 'Selected' : 'Add'}
                          </span>
                        </button>
                      )
                    })}
                    {filteredProducts.length === 0 && (
                      <p className="px-3 py-4 text-sm text-ink/45">No matching products</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">
                    Category (shows 3 latest products)
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  >
                    <option value="">Select a category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-wine hover:bg-wine-deep text-white px-6 py-2 rounded-full font-semibold"
              >
                {editingBanner ? 'Update' : 'Create'} Banner
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="border border-wine/20 bg-white hover:bg-cream text-wine px-6 py-2 rounded-full font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-8 text-center text-ink/55">Loading...</div>
        ) : banners.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-ink/55">No banners yet</div>
        ) : (
          banners.map((banner) => (
            <div
              key={banner.id}
              className="bg-white rounded-[22px] border border-wine/10 overflow-hidden"
            >
              <div className="relative h-36">
                <Image
                  unoptimized
                  src={banner.image}
                  alt={banner.title}
                  fill
                  className="object-cover"
                />
                {banner.isActive && (
                  <span className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-medium">
                    Active
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-display font-semibold text-lg text-ink">{banner.title}</h3>
                {banner.subtitle && <p className="text-ink/55 text-sm">{banner.subtitle}</p>}
                <p className="mt-2 text-xs text-ink/50">
                  {(banner.productIds?.length ?? 0) > 0
                    ? `${banner.productIds.length} selected product(s)`
                    : banner.category
                      ? `Category: ${banner.category}`
                      : 'No spotlight products'}
                  {(banner.products?.length ?? 0) > 0
                    ? ` · showing ${banner.products!.length}`
                    : ''}
                </p>
                {(banner.products?.length ?? 0) > 0 && (
                  <div className="mt-2 flex gap-2">
                    {banner.products!.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className="relative h-10 w-10 overflow-hidden rounded-lg bg-cream border border-wine/10"
                        title={p.name}
                      >
                        {p.image ? (
                          <Image unoptimized src={p.image} alt="" fill className="object-cover" />
                        ) : null}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-ink/55 inline-flex items-center gap-2">
                    Order: {banner.order}
                    {banner.bgColor ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-wine/10 px-2 py-0.5 text-xs"
                        title={banner.bgColor}
                      >
                        <span
                          className="h-3 w-3 rounded-full border border-black/10"
                          style={{ backgroundColor: banner.bgColor }}
                        />
                        Tint
                      </span>
                    ) : null}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editBanner(banner)}
                      className="text-wine hover:text-wine-deep text-sm font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteBanner(banner.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
