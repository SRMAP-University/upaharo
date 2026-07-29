'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProductCategoryFields from '@/components/ProductCategoryFields'
import ProductFoodTypeFields from '@/components/ProductFoodTypeFields'
import ImageDropUpload from '@/components/admin/ImageDropUpload'
import ProductGalleryFields from '@/components/admin/ProductGalleryFields'
import ProductInventoryFields from '@/components/admin/ProductInventoryFields'
import SubProductSelector from '@/components/admin/SubProductSelector'
import ProductPickupFields from '@/components/admin/ProductPickupFields'
import { uploadProductImage } from '@/lib/upload-image'
import {
  EMPTY_PRODUCT_CATEGORY_GROUPS,
  buildProductTags,
  fetchProductCategoryGroups,
} from '@/lib/product-categories'
import { mergeSubProductTags } from '@/lib/product-subproducts'
import { renderProductDescriptionMarkdown } from '@/lib/markdown-description'
import { formatPriceNoDecimals, formatTime } from '@/lib/utils'

type ProductVariant = {
  color: string
  size: string
  image: string
  price?: number | ''
}

type PrepTimeUnit = 'minutes' | 'days'

export default function NewProduct() {
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
  const [subProductIds, setSubProductIds] = useState<string[]>([])
  const [prepTimeUnit, setPrepTimeUnit] = useState<PrepTimeUnit>('minutes')
  const [storeSlug, setStoreSlug] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    miniDescription: '',
    description: '',
    category: '',
    price: 0,
    wholesalePrice: '' as number | '',
    image: '',
    images: [''],
    variants: [] as ProductVariant[],
    imageAlt: '',
    showFoodTypeLabel: false,
    isVeg: true,
    prepTime: 15,
    tags: '',
    discount: 0,
    isAvailable: true,
    sku: '',
    trackStock: false,
    stockQty: '' as number | '',
    unit: '',
    unitValue: '' as number | '',
    aisle: '',
    pickupEnabled: false,
    pickupLatitude: null as number | null,
    pickupLongitude: null as number | null,
    pickupAddress: '',
  })

  useEffect(() => {
    void loadCategoryGroups()
    void fetch('/api/admin/store', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStoreSlug(String(data?.selectedSlug || '')))
      .catch(() => {})
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

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
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

  const applyCakeQuickSetup = () => {
    setPrepTimeUnit('minutes')
    setFormData((prev) => ({
      ...prev,
      category: prev.category || 'Cakes',
      prepTime: prev.prepTime <= 0 ? 60 : prev.prepTime,
      tags: prev.tags ? `${prev.tags}, cake, birthday` : 'cake, birthday',
      variants:
        prev.variants.length > 0
          ? prev.variants
          : [
              { color: 'Chocolate', size: '1 Kg', image: '', price: prev.price || 0 },
              { color: 'Vanilla', size: '0.5 Kg', image: '', price: Math.max((prev.price || 0) * 0.65, 0) },
            ],
    }))
    if (variantFiles.length === 0) {
      setVariantFiles([null, null])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.pickupEnabled && (formData.pickupLatitude === null || formData.pickupLongitude === null)) {
      alert('Drop a pin on the map to set the pickup location')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          wholesalePrice:
            formData.wholesalePrice === '' || formData.wholesalePrice == null
              ? null
              : Number(formData.wholesalePrice),
          sku: formData.sku.trim() || null,
          trackStock: formData.trackStock,
          stockQty: formData.trackStock
            ? formData.stockQty === ''
              ? 0
              : Number(formData.stockQty)
            : null,
          unit: formData.unit || null,
          unitValue:
            formData.unitValue === '' || formData.unitValue == null
              ? null
              : Number(formData.unitValue),
          aisle: formData.aisle.trim() || null,
          tags: mergeSubProductTags(
            buildProductTags(formData.tags, recipientSelections, occasionSelections),
            subProductIds
          ),
          images: formData.images.filter(img => img.trim()),
          showFoodTypeLabel: formData.showFoodTypeLabel,
          variants: formData.variants
            .map((variant) => ({
              color: variant.color.trim(),
              size: variant.size.trim(),
              image: variant.image.trim(),
              ...(Number.isFinite(Number(variant.price)) && Number(variant.price) >= 0
                ? { price: Number(variant.price) }
                : {}),
            }))
            .filter((variant) => variant.image && (variant.color || variant.size)),
        })
      })

      if (res.ok) {
        router.push('/admin/products')
      } else {
        alert('Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      alert('Error creating product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/products" className="text-wine hover:text-wine-deep text-sm font-semibold mb-2 inline-block">
            ← Back to Products
          </Link>
          <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">Add New Product</h1>
        </div>
        <button
          type="button"
          onClick={applyCakeQuickSetup}
          className="rounded-full border border-gold/40 bg-gold-soft/50 px-4 py-2 text-xs font-semibold text-ink hover:bg-gold-soft"
        >
          Apply Cake Starter
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
          {/* Left: details */}
          <div className="space-y-5 xl:col-span-7">
            <section className="rounded-[22px] border border-wine/10 bg-white p-5 md:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink/45">Basics</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">Name*</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">Mini Description</label>
                  <input
                    type="text"
                    value={formData.miniDescription}
                    onChange={(e) => setFormData({ ...formData, miniDescription: e.target.value })}
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    placeholder="Short one-line text shown above price"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-ink/70 mb-1">Description (Markdown)*</label>
                    <textarea
                      required
                      rows={10}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                      placeholder="# Product Highlights&#10;- Freshly baked&#10;- Same day delivery&#10;&#10;**Storage:** Keep refrigerated."
                    />
                  </div>
                  <div className="rounded-xl border border-wine/10 bg-cream p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Preview</p>
                    <div
                      className="space-y-3 text-sm leading-7 text-ink/70 [&_a]:text-wine [&_h1]:text-xl [&_h2]:text-lg"
                      dangerouslySetInnerHTML={{ __html: renderProductDescriptionMarkdown(formData.description) }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-wine/10 bg-white p-5 md:p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink/45">Category & pricing</h2>
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
                accent="orange"
              />

              <SubProductSelector value={subProductIds} onChange={setSubProductIds} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">Retail price (NPR)*</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">Wholesale price (NPR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.wholesalePrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wholesalePrice: e.target.value === '' ? '' : parseFloat(e.target.value),
                      })
                    }
                    placeholder="Leave empty if not for B2B"
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                  <p className="mt-1 text-xs text-ink/40">Shown on /b2b for local businesses</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink/70 mb-1">Discount (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-ink/70 mb-1">Preparation Time*</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min="0"
                      step={prepTimeUnit === 'days' ? '0.25' : '1'}
                      value={prepTimeInputValue}
                      onChange={(e) => handlePrepTimeValueChange(e.target.value)}
                      className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    />
                    <select
                      value={prepTimeUnit}
                      onChange={(e) => setPrepTimeUnit(e.target.value as PrepTimeUnit)}
                      className="px-3 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-ink/55">Shown on product page as: {formatTime(formData.prepTime)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-wine/10 bg-white p-5 md:p-6">
              <ProductInventoryFields
                emphasizeGrocery={storeSlug === 'grocery'}
                values={{
                  sku: formData.sku,
                  trackStock: formData.trackStock,
                  stockQty: formData.stockQty,
                  unit: formData.unit,
                  unitValue: formData.unitValue,
                  aisle: formData.aisle,
                }}
                onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
              />
            </section>

            <section className="rounded-[22px] border border-wine/10 bg-white p-5 md:p-6 space-y-4">
              <ProductFoodTypeFields
                showFoodTypeLabel={formData.showFoodTypeLabel}
                isVeg={formData.isVeg}
                accent="orange"
                onShowFoodTypeLabelChange={(value) => setFormData({ ...formData, showFoodTypeLabel: value })}
                onIsVegChange={(value) => setFormData({ ...formData, isVeg: value })}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  className="w-4 h-4 text-wine border-wine/30 rounded focus:ring-wine/30"
                />
                <span className="text-sm font-medium text-ink/70">Available</span>
              </label>
              <ProductPickupFields
                value={{
                  pickupEnabled: formData.pickupEnabled,
                  pickupLatitude: formData.pickupLatitude,
                  pickupLongitude: formData.pickupLongitude,
                  pickupAddress: formData.pickupAddress,
                }}
                onChange={(pickup) => setFormData((prev) => ({ ...prev, ...pickup }))}
              />
            </section>
          </div>

          {/* Right: media */}
          <div className="space-y-5 xl:col-span-5 xl:sticky xl:top-14 xl:self-start">
            <section className="rounded-[22px] border border-wine/10 bg-white p-5 md:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink/45">Images</h2>
              <ProductGalleryFields
                mainImage={formData.image}
                images={formData.images}
                mainImageFile={mainImageFile}
                additionalImageFile={additionalImageFile}
                uploadingMainImage={uploadingMainImage}
                uploadingAdditionalImage={uploadingAdditionalImage}
                onMainImageUrlChange={(url) => setFormData((prev) => ({ ...prev, image: url }))}
                onImagesChange={(images) => setFormData((prev) => ({ ...prev, images }))}
                onMainImageFileSelect={setMainImageFile}
                onAdditionalImageFileSelect={setAdditionalImageFile}
                onUploadMain={handleMainImageUpload}
                onUploadAdditional={handleAdditionalImageUpload}
              />
              <div className="mt-4">
                <label className="block text-sm font-medium text-ink/70 mb-1">Image Alt Text</label>
                <input
                  type="text"
                  value={formData.imageAlt}
                  onChange={(e) => setFormData({ ...formData, imageAlt: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
            </section>

            <section className="rounded-[22px] border border-wine/10 bg-white p-5 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink/45">Variants</h2>
                <button
                  type="button"
                  onClick={addVariant}
                  className="px-3 py-1.5 bg-rose-soft text-wine rounded-xl text-xs font-semibold hover:bg-rose-soft/70"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={variant.color}
                      onChange={(e) => updateVariant(index, 'color', e.target.value)}
                      placeholder="Color (e.g., Red)"
                      className="px-3 py-2 border border-wine/15 rounded-xl bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    />
                    <input
                      type="text"
                      value={variant.size}
                      onChange={(e) => updateVariant(index, 'size', e.target.value)}
                      placeholder="Size (e.g., Large)"
                      className="px-3 py-2 border border-wine/15 rounded-xl bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    />
                    <input
                      type="text"
                      value={variant.image}
                      onChange={(e) => updateVariant(index, 'image', e.target.value)}
                      placeholder="Variant Image URL"
                      className="px-3 py-2 border border-wine/15 rounded-xl bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 sm:col-span-2"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={variant.price ?? ''}
                      onChange={(e) =>
                        updateVariant(
                          index,
                          'price',
                          e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value)))
                        )
                      }
                      placeholder="Variant Price"
                      className="px-3 py-2 border border-wine/15 rounded-xl bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 sm:col-span-2"
                    />
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <ImageDropUpload
                        label={`Variant ${index + 1} image`}
                        onFileSelect={(file) =>
                          setVariantFiles((prev) => {
                            const nextFiles = [...prev]
                            nextFiles[index] = file
                            return nextFiles
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => uploadVariantImage(index)}
                        disabled={!variantFiles[index] || uploadingVariantIndex === index}
                        className="px-3 py-2 bg-wine text-white rounded-xl text-xs font-medium hover:bg-wine-deep disabled:opacity-50"
                      >
                        {uploadingVariantIndex === index ? 'Uploading...' : 'Upload Variant Image'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-medium hover:bg-red-100 self-start"
                    >
                      Remove Variant
                    </button>
                  </div>
                  {typeof variant.price === 'number' ? (
                    <p className="mt-2 text-xs font-semibold text-wine">Selling at {formatPriceNoDecimals(variant.price)}</p>
                  ) : null}
                </div>
              ))}
            </section>
          </div>
        </div>

        <>
          <div className="h-24 md:h-20" aria-hidden />
          <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 border-t border-wine/10 bg-white/95 px-4 py-3 shadow-[0_-10px_40px_-18px_rgba(43,29,34,0.35)] backdrop-blur supports-[backdrop-filter]:bg-white/90 md:bottom-0 md:px-5 md:py-3.5">
            <div className="mx-auto flex w-full max-w-[1600px] flex-wrap gap-3 md:pl-[4.5rem]">
              <button
                type="submit"
                disabled={loading}
                className="bg-wine hover:bg-wine-deep text-white px-6 py-2.5 rounded-full font-semibold disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Product'}
              </button>
              <Link
                href="/admin/products"
                className="border border-wine/20 bg-white hover:bg-cream text-wine px-6 py-2.5 rounded-full font-semibold"
              >
                Cancel
              </Link>
            </div>
          </div>
        </>
      </form>
    </div>
  )
}
