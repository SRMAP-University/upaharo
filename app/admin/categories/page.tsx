'use client'

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_ICON_KEYS, CATEGORY_WASH_PRESETS } from '@/lib/category-style'
import { uploadCategoryImage } from '@/lib/upload-image'

interface Category {
  id: string
  name: string
  shortName: string | null
  image: string
  type: 'PRODUCT' | 'RECIPIENT' | 'OCCASION'
  parentId: string | null
  isActive: boolean
  washColor: string | null
  iconName: string | null
}

const CATEGORY_TYPES = ['PRODUCT', 'RECIPIENT', 'OCCASION']

const INPUT_CLASS =
  'w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

const EMPTY_FORM = {
  name: '',
  shortName: '',
  image: '',
  type: 'PRODUCT' as 'PRODUCT' | 'RECIPIENT' | 'OCCASION',
  parentId: '',
  isActive: true,
  washColor: '',
  iconName: '',
  headerVisual: 'icon' as 'icon' | 'image',
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedStoreName, setSelectedStoreName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetchCategories()
  }, [])

  const fetchCategories = async () => {
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

      const res = await fetch('/api/admin/categories', { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setCategories([])
        setLoadError(data?.error || `Failed to load categories (${res.status})`)
        return
      }

      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      setCategories([])
      setLoadError('Failed to load categories. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const useImage = formData.headerVisual === 'image'
    if (useImage && !formData.image.trim()) {
      alert('Upload a header image or switch to an icon.')
      return
    }
    if (!useImage && !formData.iconName.trim()) {
      alert('Pick an icon or switch to image upload.')
      return
    }

    try {
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : '/api/admin/categories'
      const method = editingCategory ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          shortName: formData.shortName || null,
          image: useImage ? formData.image : '',
          type: formData.type,
          parentId: formData.parentId || null,
          isActive: formData.isActive,
          washColor: formData.washColor || null,
          iconName: useImage ? null : formData.iconName || null,
        }),
      })

      if (res.ok) {
        fetchCategories()
        resetForm()
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Failed to save category')
      }
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

  const handleImageUpload = async (file: File | null) => {
    if (!file) return
    setUploadingImage(true)
    try {
      const url = await uploadCategoryImage(file)
      setFormData((prev) => ({
        ...prev,
        image: url,
        headerVisual: 'image',
        iconName: '',
      }))
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      if (res.ok) fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const editCategory = (category: Category) => {
    const hasImage = Boolean(category.image?.trim())
    setEditingCategory(category)
    setFormData({
      name: category.name,
      shortName: category.shortName || '',
      image: category.image || '',
      type: category.type,
      parentId: category.parentId || '',
      isActive: category.isActive,
      washColor: category.washColor || '',
      iconName: category.iconName || '',
      headerVisual: hasImage ? 'image' : 'icon',
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingCategory(null)
    setShowForm(false)
  }

  const isGrocery = selectedStore === 'grocery'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Categories</h1>
          <p className="text-ink/55 mt-1">
            Manage product, recipient & occasion categories
            {selectedStoreName ? (
              <>
                {' '}
                for <span className="font-semibold text-ink">{selectedStoreName}</span>
              </>
            ) : null}
          </p>
          {isGrocery && (
            <p className="text-xs text-ink/45 mt-1">
              Home header uses short names plus an icon or uploaded image (R2).
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-wine hover:bg-wine-deep text-white px-6 py-2.5 rounded-full font-semibold"
        >
          {showForm ? 'Cancel' : '+ Add Category'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-[22px] border border-wine/10 p-6 mb-6">
          <h2 className="font-display text-xl font-semibold text-ink mb-4">
            {editingCategory ? 'Edit Category' : 'New Category'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Full name*</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="e.g. Dairy & Eggs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">
                  Header short name
                </label>
                <input
                  type="text"
                  value={formData.shortName}
                  onChange={(e) =>
                    setFormData({ ...formData, shortName: e.target.value.slice(0, 16) })
                  }
                  className={INPUT_CLASS}
                  placeholder="e.g. Dairy"
                  maxLength={16}
                />
                <p className="mt-1 text-xs text-ink/45">
                  Shown in the app home header (max 16 chars). Leave blank to auto-shorten.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Type*</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as typeof formData.type })
                  }
                  className={INPUT_CLASS}
                >
                  {(isGrocery ? ['PRODUCT'] : CATEGORY_TYPES).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Parent Category</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">None</option>
                  {categories
                    .filter((c) => c.type === formData.type && c.id !== editingCategory?.id)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Home header visual */}
            <div className="rounded-2xl border border-wine/10 bg-cream/40 p-4 space-y-3">
              <p className="text-sm font-semibold text-ink">Home header chip</p>
              <div className="flex gap-2">
                {(['icon', 'image'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        headerVisual: mode,
                        ...(mode === 'icon' ? { image: '' } : { iconName: '' }),
                      }))
                    }
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                      formData.headerVisual === mode
                        ? 'bg-wine text-white'
                        : 'bg-white border border-wine/15 text-ink/70'
                    }`}
                  >
                    {mode === 'icon' ? 'Icon' : 'Upload image'}
                  </button>
                ))}
              </div>

              {formData.headerVisual === 'icon' ? (
                <div>
                  <p className="text-xs text-ink/50 mb-2">Pick an icon for the header strip</p>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {CATEGORY_ICON_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, iconName: key, image: '' })}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium capitalize ${
                          formData.iconName === key
                            ? 'border-wine bg-wine/10 text-wine'
                            : 'border-wine/15 bg-white text-ink/70 hover:border-wine/30'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => void handleImageUpload(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full border border-wine/20 bg-white px-4 py-2 text-sm font-semibold text-wine disabled:opacity-50"
                    >
                      {uploadingImage ? 'Uploading…' : 'Upload to R2'}
                    </button>
                    {formData.image && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image: '' })}
                        className="text-xs text-red-600 font-medium"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  {formData.image ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={formData.image}
                        alt="Header preview"
                        className="h-16 w-16 rounded-full object-cover border border-wine/10"
                      />
                      <p className="text-xs text-ink/45 break-all">{formData.image}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-ink/45">
                      Square PNG/WebP works best. Stored on your R2 bucket.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">
                  Header tint (optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(formData.washColor)
                        ? formData.washColor
                        : '#F3E9DF'
                    }
                    onChange={(e) =>
                      setFormData({ ...formData, washColor: e.target.value.toUpperCase() })
                    }
                    className="h-10 w-12 cursor-pointer rounded-lg border border-wine/15 bg-white p-1"
                    aria-label="Header tint"
                  />
                  <input
                    type="text"
                    value={formData.washColor}
                    onChange={(e) =>
                      setFormData({ ...formData, washColor: e.target.value.toUpperCase() })
                    }
                    placeholder="Auto from name"
                    maxLength={7}
                    spellCheck={false}
                    className="w-full px-3 py-2 border border-wine/15 rounded-xl bg-white font-mono text-sm uppercase text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                  {formData.washColor && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, washColor: '' })}
                      className="shrink-0 rounded-lg border border-wine/15 px-2 py-2 text-xs text-wine"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CATEGORY_WASH_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData({ ...formData, washColor: preset })}
                      style={{ backgroundColor: preset }}
                      title={preset}
                      aria-label={`Use ${preset}`}
                      className="h-6 w-6 rounded-md border border-black/10"
                    />
                  ))}
                </div>
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

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-wine hover:bg-wine-deep text-white px-6 py-2 rounded-full font-semibold"
              >
                {editingCategory ? 'Update' : 'Create'} Category
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

      {loadError && (
        <div className="mb-6 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="rounded-[22px] border border-wine/10 bg-white px-6 py-12 text-center text-ink/55">
          Loading categories…
        </div>
      ) : null}

      <div className="space-y-6">
        {(isGrocery ? ['PRODUCT'] : CATEGORY_TYPES).map((type) => (
          <div key={type}>
            <h2 className="font-display text-xl font-semibold mb-3 text-ink">{type} Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {categories.filter((cat) => cat.type === type).length === 0 && !loading && (
                <div className="col-span-full rounded-[18px] border border-dashed border-wine/15 bg-white px-4 py-8 text-center text-sm text-ink/50">
                  No {type.toLowerCase()} categories for {selectedStoreName || 'this store'} yet.
                </div>
              )}
              {categories
                .filter((cat) => cat.type === type)
                .map((category) => (
                  <div
                    key={category.id}
                    className="bg-white rounded-[22px] border border-wine/10 overflow-hidden"
                  >
                    <div
                      className="h-2"
                      style={{ backgroundColor: category.washColor || 'transparent' }}
                      aria-hidden
                    />
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-cream-deep rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {category.image?.trim() ? (
                            <img
                              src={category.image}
                              alt={category.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-wine uppercase">
                              {category.iconName?.slice(0, 2) || '•'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold text-ink truncate">
                            {category.name}
                          </h3>
                          {category.shortName && (
                            <p className="text-xs text-wine font-medium">
                              Header: {category.shortName}
                            </p>
                          )}
                          <p className="text-xs text-ink/45">
                            {category.image?.trim()
                              ? 'image chip'
                              : category.iconName || 'auto icon'}{' '}
                            · {category.washColor || 'auto tint'}
                          </p>
                        </div>
                        {category.isActive && (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-medium shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editCategory(category)}
                          className="text-wine hover:text-wine-deep text-sm font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCategory(category.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
