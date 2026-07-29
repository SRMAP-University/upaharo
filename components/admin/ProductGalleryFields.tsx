'use client'

import Image from 'next/image'
import ImageDropUpload from '@/components/admin/ImageDropUpload'
import { resolveImageUrl } from '@/lib/image-url'

type Props = {
  mainImage: string
  images: string[]
  mainImageFile: File | null
  additionalImageFile: File | null
  uploadingMainImage: boolean
  uploadingAdditionalImage: boolean
  onMainImageUrlChange: (url: string) => void
  onImagesChange: (images: string[]) => void
  onMainImageFileSelect: (file: File | null) => void
  onAdditionalImageFileSelect: (file: File | null) => void
  onUploadMain: () => void
  onUploadAdditional: () => void
}

export default function ProductGalleryFields({
  mainImage,
  images,
  mainImageFile,
  additionalImageFile,
  uploadingMainImage,
  uploadingAdditionalImage,
  onMainImageUrlChange,
  onImagesChange,
  onMainImageFileSelect,
  onAdditionalImageFileSelect,
  onUploadMain,
  onUploadAdditional,
}: Props) {
  const gallery = images.filter((img) => img.trim())

  const moveGallery = (index: number, direction: -1 | 1) => {
    const next = [...gallery]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onImagesChange(next.length ? next : [''])
  }

  const setAsMain = (index: number) => {
    const url = gallery[index]
    if (!url) return
    const rest = gallery.filter((_, i) => i !== index)
    const previousMain = mainImage.trim()
    onMainImageUrlChange(url)
    onImagesChange(previousMain ? [previousMain, ...rest] : rest.length ? rest : [''])
  }

  const removeGallery = (index: number) => {
    const next = gallery.filter((_, i) => i !== index)
    onImagesChange(next.length ? next : [''])
  }

  const updateGalleryUrl = (index: number, value: string) => {
    const next = [...gallery]
    if (index >= next.length) next.push(value)
    else next[index] = value
    onImagesChange(next.length ? next : [''])
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink/70 mb-1">Main Image URL*</label>
        <input
          type="text"
          required
          value={mainImage}
          onChange={(e) => onMainImageUrlChange(e.target.value)}
          className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
        />
        {mainImage.trim() ? (
          <div className="mt-2 h-28 w-28 overflow-hidden rounded-xl bg-cream-deep">
            <Image
              unoptimized
              src={resolveImageUrl(mainImage)}
              alt="Main"
              width={112}
              height={112}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="mt-2 space-y-2">
          <ImageDropUpload
            label="Main product image"
            onFileSelect={onMainImageFileSelect}
            disabled={uploadingMainImage}
          />
          <button
            type="button"
            onClick={onUploadMain}
            disabled={!mainImageFile || uploadingMainImage}
            className="px-4 py-2 bg-wine text-white rounded-xl text-sm font-medium hover:bg-wine-deep disabled:opacity-50"
          >
            {uploadingMainImage ? 'Uploading...' : 'Upload Main Image'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink/70 mb-1">Gallery</label>
        <p className="text-xs text-ink/50 mb-2">Reorder, set as main, or remove additional images.</p>
        <div className="space-y-2">
          {(gallery.length ? gallery : ['']).map((img, index) => (
            <div key={`${index}-${img.slice(0, 24)}`} className="flex flex-col gap-2 rounded-xl border border-wine/10 p-3 sm:flex-row sm:items-center">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
                {img.trim() ? (
                  <Image
                    unoptimized
                    src={resolveImageUrl(img)}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <input
                type="text"
                value={img}
                onChange={(e) => updateGalleryUrl(index, e.target.value)}
                placeholder={`Image ${index + 1} URL`}
                className="flex-1 px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => moveGallery(index, -1)}
                  disabled={index === 0 || !img.trim()}
                  className="px-2 py-1.5 text-xs rounded-lg border border-wine/15 disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveGallery(index, 1)}
                  disabled={index >= gallery.length - 1 || !img.trim()}
                  className="px-2 py-1.5 text-xs rounded-lg border border-wine/15 disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setAsMain(index)}
                  disabled={!img.trim()}
                  className="px-2 py-1.5 text-xs rounded-lg border border-wine/20 text-wine font-semibold disabled:opacity-40"
                >
                  Set main
                </button>
                <button
                  type="button"
                  onClick={() => removeGallery(index)}
                  className="px-2 py-1.5 text-xs rounded-lg bg-red-100 text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onImagesChange([...gallery, ''])}
          className="mt-2 px-4 py-2 border border-wine/20 bg-white text-wine rounded-xl hover:bg-cream text-sm font-medium"
        >
          + Add Another Image
        </button>
        <div className="mt-3 rounded-xl border border-dashed border-wine/20 p-3">
          <ImageDropUpload
            label="Additional gallery image"
            onFileSelect={onAdditionalImageFileSelect}
            disabled={uploadingAdditionalImage}
          />
          <button
            type="button"
            onClick={onUploadAdditional}
            disabled={!additionalImageFile || uploadingAdditionalImage}
            className="mt-2 px-4 py-2 bg-wine text-white rounded-xl text-sm font-medium hover:bg-wine-deep disabled:opacity-50"
          >
            {uploadingAdditionalImage ? 'Uploading...' : 'Upload and Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
