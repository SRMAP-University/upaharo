'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductCategoryFields from '@/components/ProductCategoryFields'
import ProductFoodTypeFields from '@/components/ProductFoodTypeFields'
import ProductOfferPriceFields from '@/components/admin/ProductOfferPriceFields'
import { uploadProductImage } from '@/lib/upload-image'
import {
  EMPTY_PRODUCT_CATEGORY_GROUPS,
  buildProductTags,
  fetchProductCategoryGroups,
} from '@/lib/product-categories'
import { formatTime } from '@/lib/utils'

type ProductVariant = {
  color: string
  size: string
  image: string
}

type PrepTimeUnit = 'minutes' | 'days'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [additionalImageFile, setAdditionalImageFile] = useState<File | null>(null)
  const [variantFiles, setVariantFiles] = useState<Array<File | null>>([])
  const [uploadingMainImage, setUploadingMainImage] = useState(false)
  const [uploadingAdditionalImage, setUploadingAdditionalImage] = useState(false)
  const [uploadingVariantIndex, setUploadingVariantIndex] = useState<number | null>(null)
  const [categoryGroups, setCategoryGroups] = useState(EMPTY_PRODUCT_CATEGORY_GROUPS)
  const [categoryGroupsLoading, setCategoryGroupsLoading] = useState(true)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [recipientSelections, setRecipientSelections] = useState<string[]>([])
  const [occasionSelections, setOccasionSelections] = useState<string[]>([])
  const [prepTimeUnit, setPrepTimeUnit] = useState<PrepTimeUnit>('minutes')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    image: '',
    images: [''],
    variants: [] as ProductVariant[],
    imageAlt: '',
    isAvailable: true,
    showFoodTypeLabel: false,
    isVeg: true,
    prepTime: 15,
    tags: '',
    discount: 0,
  })

  const minutesPerDay = 24 * 60
  const prepTimeInputValue =
    prepTimeUnit === 'days'
      ? Number((Math.max(0, formData.prepTime) / minutesPerDay).toFixed(2))
      : Math.max(0, formData.prepTime)

  const handlePrepTimeValueChange = (rawValue: string) => {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFormData((prev) => ({ ...prev, prepTime: 0 }))
      return
    }

    const nextMinutes = prepTimeUnit === 'days' ? Math.round(parsed * minutesPerDay) : Math.round(parsed)
    setFormData((prev) => ({ ...prev, prepTime: Math.max(0, nextMinutes) }))
  }

  useEffect(() => {
    void loadCategoryGroups()
  }, [])

  const loadCategoryGroups = async () => {
    try {
      const categories = await fetchProductCategoryGroups()
      setCategoryGroups(categories)
      setCategoryError(null)
    } catch (error) {
      console.error('Failed to load product categories:', error)
      setCategoryError('Category options could not be loaded. You can still type the main category manually.')
    } finally {
      setCategoryGroupsLoading(false)
    }
  }

  const setAdditionalImageUrl = (url: string) => {
    setFormData((prev) => {
      const firstEmptyIndex = prev.images.findIndex((img) => !img.trim())
      if (firstEmptyIndex >= 0) {
        const nextImages = [...prev.images]
        nextImages[firstEmptyIndex] = url
        return { ...prev, images: nextImages }
      }

      return { ...prev, images: [...prev.images, url] }
    })
  }

  const handleMainImageUpload = async () => {
    if (!mainImageFile) {
      alert('Please choose an image file first')
      return
    }

    try {
      setUploadingMainImage(true)
      const url = await uploadProductImage(mainImageFile)
      setFormData((prev) => ({ ...prev, image: url }))
      setMainImageFile(null)
    } catch (error: any) {
      alert(error?.message || 'Failed to upload image')
    } finally {
      setUploadingMainImage(false)
    }
  }

  const handleAdditionalImageUpload = async () => {
    if (!additionalImageFile) {
      alert('Please choose an image file first')
      return
    }

    try {
      setUploadingAdditionalImage(true)
      const url = await uploadProductImage(additionalImageFile)
      setAdditionalImageUrl(url)
      setAdditionalImageFile(null)
    } catch (error: any) {
      alert(error?.message || 'Failed to upload image')
    } finally {
      setUploadingAdditionalImage(false)
    }
  }

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, { color: '', size: '', image: '' }],
    }))
    setVariantFiles((prev) => [...prev, null])
  }

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }))
    setVariantFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const updateVariant = (index: number, field: keyof ProductVariant, value: string) => {
    setFormData((prev) => {
      const nextVariants = [...prev.variants]
      nextVariants[index] = { ...nextVariants[index], [field]: value }
      return { ...prev, variants: nextVariants }
    })
  }

  const uploadVariantImage = async (index: number) => {
    const file = variantFiles[index]
    if (!file) {
      alert('Please choose a variant image file first')
      return
    }

    try {
      setUploadingVariantIndex(index)
      const url = await uploadProductImage(file)
      updateVariant(index, 'image', url)
      setVariantFiles((prev) => {
        const nextFiles = [...prev]
        nextFiles[index] = null
        return nextFiles
      })
    } catch (error: any) {
      alert(error?.message || 'Failed to upload variant image')
    } finally {
      setUploadingVariantIndex(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tags: buildProductTags(formData.tags, recipientSelections, occasionSelections),
          images: formData.images.filter((img) => img.trim()),
          showFoodTypeLabel: formData.showFoodTypeLabel,
          variants: formData.variants
            .map((variant) => ({
              color: variant.color.trim(),
              size: variant.size.trim(),
              image: variant.image.trim(),
            }))
            .filter((variant) => variant.image && (variant.color || variant.size)),
        }),
      })

      if (res.ok) {
        router.push('/seller/products')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create product')
      }
    } catch (error) {
      console.error('Failed to create product:', error)
      alert('Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  const addImageField = () => {
    setFormData({ ...formData, images: [...formData.images, ''] })
  }

  const updateImage = (index: number, value: string) => {
    const newImages = [...formData.images]
    newImages[index] = value
    setFormData({ ...formData, images: newImages })
  }

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index)
    setFormData({ ...formData, images: newImages })
  }

  return (
    <div className="px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Add New Product</h1>
          <p className="text-ink/55">Create a new product for your store</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-wine/10 rounded-[22px] shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              placeholder="e.g., Red Roses Bouquet"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              rows={4}
              placeholder="Describe your product..."
            />
          </div>

          <ProductCategoryFields
            categories={categoryGroups}
            loading={categoryGroupsLoading}
            error={categoryError}
            category={formData.category}
            customTags={formData.tags}
            recipientSelections={recipientSelections}
            occasionSelections={occasionSelections}
            onCategoryChange={(value) => setFormData({ ...formData, category: value })}
            onCustomTagsChange={(value) => setFormData({ ...formData, tags: value })}
            onRecipientSelectionsChange={setRecipientSelections}
            onOccasionSelectionsChange={setOccasionSelections}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Price (NPR)*
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Preparation Time
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step={prepTimeUnit === 'days' ? '0.25' : '1'}
                  value={prepTimeInputValue}
                  onChange={(e) => handlePrepTimeValueChange(e.target.value)}
                  className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  placeholder="15"
                />
                <select
                  value={prepTimeUnit}
                  onChange={(e) => setPrepTimeUnit(e.target.value as PrepTimeUnit)}
                  className="rounded-xl border border-wine/15 px-3 py-2 bg-white text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                >
                  <option value="minutes">Minutes</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-ink/55">Shown on product page as: {formatTime(formData.prepTime)}</p>
            </div>
          </div>

          <ProductOfferPriceFields
            price={formData.price}
            discount={formData.discount}
            onDiscountChange={(discount) => setFormData((prev) => ({ ...prev, discount }))}
          />

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Main Image URL *
            </label>
            <input
              type="text"
              required
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              placeholder="https://example.com/image.jpg"
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setMainImageFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-ink/70 sm:w-auto"
              />
              <button
                type="button"
                onClick={handleMainImageUpload}
                disabled={!mainImageFile || uploadingMainImage}
                className="px-4 py-2 bg-wine text-white rounded-full text-sm font-medium hover:bg-wine-deep disabled:opacity-50"
              >
                {uploadingMainImage ? 'Uploading...' : 'Upload Main Image'}
              </button>
            </div>
            <p className="mt-1 text-xs text-ink/55">JPG, PNG, WEBP or GIF. Max size 5MB.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Additional Images
            </label>
            {formData.images.map((img, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={img}
                  onChange={(e) => updateImage(index, e.target.value)}
                  className="flex-1 rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  placeholder="https://example.com/image.jpg"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addImageField}
              className="text-sm text-wine hover:text-wine-deep font-medium"
            >
              + Add Image
            </button>
            <div className="mt-3 rounded-xl border border-dashed border-wine/20 p-3">
              <p className="text-xs text-ink/55">Upload additional image</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setAdditionalImageFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-ink/70 sm:w-auto"
                />
                <button
                  type="button"
                  onClick={handleAdditionalImageUpload}
                  disabled={!additionalImageFile || uploadingAdditionalImage}
                  className="px-4 py-2 bg-wine text-white rounded-full text-sm font-medium hover:bg-wine-deep disabled:opacity-50"
                >
                  {uploadingAdditionalImage ? 'Uploading...' : 'Upload and Add'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ink">Product Variants</label>
              <button
                type="button"
                onClick={addVariant}
                className="px-3 py-1.5 bg-rose-soft text-wine rounded-full text-xs font-semibold hover:bg-rose-soft/70"
              >
                + Add Variant
              </button>
            </div>
            {formData.variants.length === 0 && (
              <p className="text-xs text-ink/55 border border-dashed border-wine/20 rounded-xl p-3">
                Add color or size variants and upload a specific image for each variant.
              </p>
            )}
            {formData.variants.map((variant, index) => (
              <div key={index} className="mb-3 rounded-xl border border-wine/10 p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={variant.color}
                    onChange={(e) => updateVariant(index, 'color', e.target.value)}
                    placeholder="Color (e.g., Red)"
                    className="px-3 py-2 border border-wine/15 rounded-xl text-sm text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                  <input
                    type="text"
                    value={variant.size}
                    onChange={(e) => updateVariant(index, 'size', e.target.value)}
                    placeholder="Size (e.g., Large)"
                    className="px-3 py-2 border border-wine/15 rounded-xl text-sm text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                  <input
                    type="text"
                    value={variant.image}
                    onChange={(e) => updateVariant(index, 'image', e.target.value)}
                    placeholder="Variant Image URL"
                    className="px-3 py-2 border border-wine/15 rounded-xl text-sm text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setVariantFiles((prev) => {
                          const nextFiles = [...prev]
                          nextFiles[index] = file
                          return nextFiles
                        })
                      }}
                      className="block w-full text-xs text-ink/70 sm:w-auto"
                    />
                    <button
                      type="button"
                      onClick={() => uploadVariantImage(index)}
                      disabled={!variantFiles[index] || uploadingVariantIndex === index}
                      className="px-3 py-2 bg-wine text-white rounded-full text-xs font-medium hover:bg-wine-deep disabled:opacity-50"
                    >
                      {uploadingVariantIndex === index ? 'Uploading...' : 'Upload Variant Image'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-full text-xs font-medium hover:bg-red-100 self-start"
                  >
                    Remove Variant
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Image Alt Text
            </label>
            <input
              type="text"
              value={formData.imageAlt}
              onChange={(e) => setFormData({ ...formData, imageAlt: e.target.value })}
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              placeholder="Description for accessibility"
            />
          </div>

          <div className="space-y-4">
            <ProductFoodTypeFields
              showFoodTypeLabel={formData.showFoodTypeLabel}
              category={formData.category}
              name={formData.name}
              isVeg={formData.isVeg}
              onShowFoodTypeLabelChange={(value) => setFormData((prev) => ({ ...prev, showFoodTypeLabel: value }))}
              onIsVegChange={(value) => setFormData({ ...formData, isVeg: value })}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isAvailable}
                onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                className="w-4 h-4 accent-wine"
              />
              <span className="text-sm text-ink/70">Available</span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-wine/20 text-wine rounded-full hover:border-wine/40 hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-wine text-white rounded-full hover:bg-wine-deep disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
