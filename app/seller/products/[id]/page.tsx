'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductCategoryFields from '@/components/ProductCategoryFields'
import ProductFoodTypeFields from '@/components/ProductFoodTypeFields'
import ProductOfferPriceFields from '@/components/admin/ProductOfferPriceFields'
import { uploadProductImage } from '@/lib/upload-image'
import {
  EMPTY_PRODUCT_CATEGORY_GROUPS,
  buildProductTags,
  fetchProductCategoryGroups,
  splitProductTags,
} from '@/lib/product-categories'
import { formatTime } from '@/lib/utils'

type ProductVariant = {
  color: string
  size: string
  image: string
}

type PrepTimeUnit = 'minutes' | 'days'

export default function EditSellerProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    void fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const [productResult, categoriesResult] = await Promise.allSettled([
        fetch(`/api/seller/products/${id}`),
        fetchProductCategoryGroups(),
      ])

      let nextCategoryGroups = EMPTY_PRODUCT_CATEGORY_GROUPS

      if (categoriesResult.status === 'fulfilled') {
        nextCategoryGroups = categoriesResult.value
        setCategoryGroups(categoriesResult.value)
        setCategoryError(null)
      } else {
        console.error('Failed to load product categories:', categoriesResult.reason)
        setCategoryError('Category options could not be loaded. You can still edit the main category manually.')
      }

      if (productResult.status === 'rejected') {
        throw productResult.reason
      }

      if (!productResult.value.ok) {
        throw new Error('Failed to load product')
      }

      const product = await productResult.value.json()
      const variants = Array.isArray(product.variants)
        ? product.variants
            .map((variant: any) => ({
              color: String(variant?.color || ''),
              size: String(variant?.size || ''),
              image: String(variant?.image || ''),
            }))
            .filter((variant: ProductVariant) => variant.image && (variant.color || variant.size))
        : []
      const tagState = splitProductTags(
        product.tags,
        nextCategoryGroups.recipientCategories,
        nextCategoryGroups.occasionCategories
      )

      setFormData({
        name: product.name,
        description: product.description,
        category: product.category,
        price: String(product.price ?? ''),
        image: product.image,
        images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [''],
        variants,
        imageAlt: product.imageAlt || '',
        isAvailable: product.isAvailable,
        showFoodTypeLabel: Boolean(product.showFoodTypeLabel),
        isVeg: product.isVeg,
        prepTime: product.prepTime,
        tags: tagState.customTags,
        discount: product.discount || 0,
      })
      setPrepTimeUnit(
        Number(product.prepTime) >= minutesPerDay && Number(product.prepTime) % minutesPerDay === 0
          ? 'days'
          : 'minutes'
      )
      setRecipientSelections(tagState.recipientSelections)
      setOccasionSelections(tagState.occasionSelections)
      setVariantFiles(new Array(variants.length).fill(null))
    } catch (error) {
      console.error('Failed to fetch seller product:', error)
      alert('Failed to load product')
      router.push('/seller/products')
    } finally {
      setCategoryGroupsLoading(false)
      setLoading(false)
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

  const addImageField = () => {
    setFormData({ ...formData, images: [...formData.images, ''] })
  }

  const updateImage = (index: number, value: string) => {
    const nextImages = [...formData.images]
    nextImages[index] = value
    setFormData({ ...formData, images: nextImages })
  }

  const removeImage = (index: number) => {
    const nextImages = formData.images.filter((_, i) => i !== index)
    setFormData({ ...formData, images: nextImages.length > 0 ? nextImages : [''] })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch(`/api/seller/products/${id}`, {
        method: 'PATCH',
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

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update product')
      }

      router.push('/seller/products')
    } catch (error: any) {
      console.error('Failed to update seller product:', error)
      alert(error?.message || 'Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-ink/55">Loading product...</div>
  }

  return (
    <div className="px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Edit Product</h1>
          <p className="text-ink/55">Update your listed product details</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-[22px] border border-wine/10 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Product Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Description *</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
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
              <label className="mb-2 block text-sm font-medium text-ink">Price (NPR)*</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Preparation Time</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step={prepTimeUnit === 'days' ? '0.25' : '1'}
                  value={prepTimeInputValue}
                  onChange={(e) => handlePrepTimeValueChange(e.target.value)}
                  className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
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
            <label className="mb-2 block text-sm font-medium text-ink">Main Image URL *</label>
            <input
              type="text"
              required
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
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
                className="rounded-full bg-wine px-4 py-2 text-sm font-medium text-white hover:bg-wine-deep disabled:opacity-50"
              >
                {uploadingMainImage ? 'Uploading...' : 'Upload Main Image'}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Additional Images</label>
            {formData.images.map((img, index) => (
              <div key={index} className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={img}
                  onChange={(e) => updateImage(index, e.target.value)}
                  className="flex-1 rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  placeholder={`Image ${index + 1} URL`}
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="rounded-full bg-red-100 px-4 py-2 text-red-600 hover:bg-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={addImageField} className="text-sm text-wine hover:text-wine-deep font-medium">
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
                  className="rounded-full bg-wine px-4 py-2 text-sm font-medium text-white hover:bg-wine-deep disabled:opacity-50"
                >
                  {uploadingAdditionalImage ? 'Uploading...' : 'Upload and Add'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-ink">Product Variants</label>
              <button
                type="button"
                onClick={addVariant}
                className="rounded-full bg-rose-soft px-3 py-1.5 text-xs font-semibold text-wine hover:bg-rose-soft/70"
              >
                + Add Variant
              </button>
            </div>
            {formData.variants.length === 0 && (
              <p className="rounded-xl border border-dashed border-wine/20 p-3 text-xs text-ink/55">
                Add color or size variants and upload a specific image for each variant.
              </p>
            )}
            {formData.variants.map((variant, index) => (
              <div key={index} className="mb-3 rounded-xl border border-wine/10 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <input
                    type="text"
                    value={variant.color}
                    onChange={(e) => updateVariant(index, 'color', e.target.value)}
                    placeholder="Color (e.g., Red)"
                    className="rounded-xl border border-wine/15 px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                  <input
                    type="text"
                    value={variant.size}
                    onChange={(e) => updateVariant(index, 'size', e.target.value)}
                    placeholder="Size (e.g., Large)"
                    className="rounded-xl border border-wine/15 px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                  <input
                    type="text"
                    value={variant.image}
                    onChange={(e) => updateVariant(index, 'image', e.target.value)}
                    placeholder="Variant Image URL"
                    className="rounded-xl border border-wine/15 px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
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
                      className="rounded-full bg-wine px-3 py-2 text-xs font-medium text-white hover:bg-wine-deep disabled:opacity-50"
                    >
                      {uploadingVariantIndex === index ? 'Uploading...' : 'Upload Variant Image'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="self-start rounded-full bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Remove Variant
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Image Alt Text</label>
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
                className="h-4 w-4 accent-wine"
              />
              <span className="text-sm text-ink/70">Available</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full border border-wine/20 px-6 py-2 text-wine hover:border-wine/40 hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-wine px-6 py-2 text-white hover:bg-wine-deep disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
