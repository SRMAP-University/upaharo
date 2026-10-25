'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header'
import SkeletonLoader from '@/components/SkeletonLoader'
import ProductCard from '@/components/ProductCard'
import { useCartStore } from '@/lib/store/cart'
import { resolveImageUrl } from '@/lib/image-url'
import FoodTypeBadge from '@/components/FoodTypeBadge'
import NavMascot, { useProductMascot } from '@/components/NavMascot'
import RecommendationShelf from '@/components/recommendations/RecommendationShelf'
import { getOrCreateRecommendationSessionId, rememberViewedProduct } from '@/lib/recommendation-session'
import { rememberViewedCategory } from '@/lib/personalization-consent'
import { renderProductDescriptionMarkdown } from '@/lib/markdown-description'
import { extractSubProductIdsFromTags, stripSubProductTags } from '@/lib/product-subproducts'
import { formatPriceCompact, formatTime } from '@/lib/utils'

interface ProductVariant {
  color: string
  size: string
  image: string
  price?: number
}

interface Product {
  id: string
  name: string
  miniDescription?: string | null
  description: string
  category: string
  price: number
  image: string
  images: string[]
  variants?: ProductVariant[]
  imageAlt?: string
  isVeg: boolean
  showFoodTypeLabel?: boolean
  prepTime: number
  tags: string[]
  discount: number
  isAvailable: boolean
}

interface RecommendationProduct {
  id: string
  name: string
  category: string
  price: number
  image: string
  discount: number
  isVeg: boolean
  isAvailable: boolean
}

function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return []

  return input
    .map((raw) => {
      const variant = raw as ProductVariant
      const color = String(variant?.color || '').trim()
      const size = String(variant?.size || '').trim()
      const image = String(variant?.image || '').trim()
      const price = Number(variant?.price)

      if (!image || (!color && !size)) return null
      return {
        color,
        size,
        image,
        ...(Number.isFinite(price) && price >= 0 ? { price } : {}),
      }
    })
    .filter((variant): variant is ProductVariant => Boolean(variant))
}

function salePrice(item: { price: number; discount?: number | null }) {
  return item.price - item.price * ((item.discount || 0) / 100)
}

const iconButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-ink shadow-[0_6px_18px_-8px_rgba(43,29,34,0.45)] backdrop-blur-sm transition hover:bg-white'

function ShareIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.59 13.51 15.42 17.5M15.41 6.5 8.59 10.49M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  )
}

function QuantityStepper({
  value,
  onChange,
  size = 'md',
}: {
  value: number
  onChange: (next: number) => void
  size?: 'md' | 'lg'
}) {
  const buttonSize = size === 'lg' ? 'h-11 w-11' : 'h-10 w-10'
  return (
    <div className="flex flex-shrink-0 items-center rounded-2xl bg-cream-deep p-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Decrease quantity"
        className={`${buttonSize} flex items-center justify-center rounded-xl bg-white text-lg font-semibold text-ink shadow-sm transition active:scale-95 disabled:opacity-40`}
      >
        −
      </button>
      <span className="w-9 text-center text-base font-semibold text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className={`${buttonSize} flex items-center justify-center rounded-xl bg-wine text-lg font-semibold text-white shadow-sm transition hover:bg-wine-deep active:scale-95`}
      >
        +
      </button>
    </div>
  )
}

function ShelfSkeleton() {
  return (
    <div>
      <div className="mb-4 h-6 w-44 animate-pulse rounded-full bg-cream-deep" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[22px] border border-ink/10 bg-white">
            <div className="aspect-square animate-pulse bg-cream-deep" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-4/5 animate-pulse rounded bg-cream-deep" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-cream-deep" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProductDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addons, setAddons] = useState<RecommendationProduct[]>([])
  const [buyTogether, setBuyTogether] = useState<RecommendationProduct[]>([])
  const [relatedProducts, setRelatedProducts] = useState<RecommendationProduct[]>([])
  const [subProducts, setSubProducts] = useState<RecommendationProduct[]>([])
  const [loadingDeferredSections, setLoadingDeferredSections] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionOverflows, setDescriptionOverflows] = useState(false)
  const [pastGallery, setPastGallery] = useState(false)
  const addItem = useCartStore((state) => state.addItem)
  const totalCartItems = useCartStore((state) => state.getTotalItems())
  const [cartToastMessage, setCartToastMessage] = useState('')
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)
  const galleryRef = useRef<HTMLDivElement | null>(null)
  const descriptionRef = useRef<HTMLDivElement | null>(null)
  const mascotScript = useProductMascot(product)

  useEffect(() => {
    void fetchProductData()
    setSelectedImage(0)
    setSelectedVariantIndex(null)
    setDescriptionExpanded(false)
    galleryRef.current?.scrollTo({ left: 0 })
  }, [id])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  // Phones: once the photo scrolls away, the floating buttons get a solid bar.
  useEffect(() => {
    const onScroll = () => setPastGallery(window.scrollY > window.innerWidth * 0.8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Only offer "Read more" when the collapsed description actually hides text.
  useEffect(() => {
    const el = descriptionRef.current
    if (!el || descriptionExpanded) return
    setDescriptionOverflows(el.scrollHeight > el.clientHeight + 4)
  }, [product, descriptionExpanded])

  const loadDeferredProductData = async (productData: Product, requestId: number) => {
    setLoadingDeferredSections(true)
    const viewedProductIds = rememberViewedProduct(String(id))
    const sessionId = getOrCreateRecommendationSessionId()

    void fetch(`/api/products/${id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => null)

    const subProductIds = extractSubProductIdsFromTags(productData.tags)

    const [recommendationsResult, subProductsResult] = await Promise.allSettled([
      fetch(`/api/products/${id}/recommendations?viewedProductIds=${encodeURIComponent(viewedProductIds.join(','))}`),
      subProductIds.length > 0
        ? fetch(`/api/products?view=card&ids=${encodeURIComponent(subProductIds.join(','))}&limit=12`)
        : Promise.resolve(null),
    ])

    if (requestIdRef.current !== requestId) return

    if (recommendationsResult.status === 'fulfilled' && recommendationsResult.value?.ok) {
      const recommendations = await recommendationsResult.value.json()
      setBuyTogether(Array.isArray(recommendations.buyTogether) ? recommendations.buyTogether : [])
      setAddons(Array.isArray(recommendations.addons) ? recommendations.addons : [])
      setRelatedProducts(Array.isArray(recommendations.related) ? recommendations.related : [])
    } else {
      setBuyTogether([])
      setAddons([])
      setRelatedProducts([])
    }

    if (subProductsResult.status === 'fulfilled' && subProductsResult.value?.ok) {
      const subProductsData = await subProductsResult.value.json()
      const list = Array.isArray(subProductsData.products) ? subProductsData.products : []
      setSubProducts(list.filter((item: RecommendationProduct) => item.id !== String(id)))
    } else {
      setSubProducts([])
    }

    if (requestIdRef.current === requestId) {
      setLoadingDeferredSections(false)
    }
  }

  const fetchProductData = async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setProduct(null)
    setAddons([])
    setBuyTogether([])
    setRelatedProducts([])
    setSubProducts([])
    setLoadingDeferredSections(false)

    try {
      const res = await fetch(`/api/products/${id}`)
      if (res.ok) {
        const data = await res.json()
        if (requestIdRef.current !== requestId) return
        setProduct(data)
        rememberViewedCategory(String(data.category || ''))
        setLoading(false)
        void loadDeferredProductData(data, requestId)
      } else {
        router.push('/')
        setLoading(false)
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      router.push('/')
      setLoading(false)
    }
  }

  const showAddedToCartToast = (message: string) => {
    setCartToastMessage(message)
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = setTimeout(() => setCartToastMessage(''), 1500)
  }

  const handleAddToCart = () => {
    if (!product) return
    const selectedVariantPrice =
      selectedVariant && typeof selectedVariant.price === 'number'
        ? selectedVariant.price
        : product.price - (product.price * (product.discount || 0) / 100)
    const variantLabel = selectedVariant ? [selectedVariant.color, selectedVariant.size].filter(Boolean).join(' / ') : ''
    addItem({
      id: product.id,
      name: variantLabel ? `${product.name} (${variantLabel})` : product.name,
      price: selectedVariantPrice,
      image: resolveImageUrl(selectedVariant?.image || product.image),
      isVeg: product.isVeg,
      quantity
    })
    showAddedToCartToast('Added to cart')
  }

  const handleQuickAddRecommendation = (item: RecommendationProduct) => {
    addItem({
      id: item.id,
      name: item.name,
      price: salePrice(item),
      image: resolveImageUrl(item.image),
      isVeg: item.isVeg,
    })
    showAddedToCartToast('Added to cart')
  }

  const handleShareProduct = async () => {
    if (!product || typeof window === 'undefined') return

    const shareUrl = window.location.href
    const shareData = {
      title: product.name,
      text: product.miniDescription || product.name,
      url: shareUrl,
    }

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData)
        return
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        showAddedToCartToast('Link copied')
        return
      }
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') {
        return
      }
    }

    showAddedToCartToast('Share not supported')
  }

  const scrollToImage = (index: number) => {
    const el = galleryRef.current
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    setSelectedImage(index)
  }

  const selectVariant = (index: number | null) => {
    setSelectedVariantIndex(index)
    setSelectedImage(0)
    galleryRef.current?.scrollTo({ left: 0 })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream pb-20 lg:pb-0">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-6">
          <SkeletonLoader variant="product" />
        </div>
      </div>
    )
  }

  if (!product) {
    return null
  }

  const allImages = [product.image, ...(product.images || [])].filter(Boolean)
  const variants = normalizeVariants(product.variants).map((variant) => ({
    ...variant,
    image: resolveImageUrl(variant.image),
  }))
  const selectedVariant = selectedVariantIndex !== null ? variants[selectedVariantIndex] : null
  const resolvedAllImages = allImages.map((img) => resolveImageUrl(String(img || ''))).filter(Boolean)
  const galleryImages = Array.from(
    new Set([...(selectedVariant?.image ? [selectedVariant.image] : []), ...resolvedAllImages])
  )
  const activeIndex = Math.min(selectedImage, Math.max(0, galleryImages.length - 1))
  const basePrice = salePrice(product)
  const variantHasOwnPrice = typeof selectedVariant?.price === 'number'
  const finalPrice = variantHasOwnPrice ? (selectedVariant!.price as number) : basePrice
  // A variant's own price has no "was" price to compare against.
  const showSavings = product.discount > 0 && !variantHasOwnPrice
  const discountPercent = Math.round(product.discount || 0)
  const descriptionHtml = String(product.description || '').trim()
    ? renderProductDescriptionMarkdown(product.description)
    : ''
  const miniDescription = String(product.miniDescription || '').trim()
  const visibleTags = stripSubProductTags(product.tags)
  const selectedVariantLabel = selectedVariant
    ? [selectedVariant.color, selectedVariant.size].filter(Boolean).join(' / ')
    : 'Standard'
  const hasDeferredContent =
    addons.length > 0 || relatedProducts.length > 0 || buyTogether.length > 0 || subProducts.length > 0
  const addToCartLabel = product.isAvailable ? 'Add to cart' : 'Currently unavailable'

  return (
    <div className="min-h-screen bg-cream pb-28 lg:pb-16">
      <div className="hidden lg:block">
        <Header />
      </div>

      {/* Mobile top controls float over the photo */}
      <div
        className={`fixed inset-x-0 top-0 z-50 flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] transition-colors duration-200 lg:hidden ${
          pastGallery ? 'border-b border-ink/10 bg-white/95 backdrop-blur' : 'pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className={`${iconButtonClass} pointer-events-auto flex-shrink-0`}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p
          className={`min-w-0 flex-1 truncate text-sm font-semibold text-ink transition-opacity duration-200 ${
            pastGallery ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!pastGallery}
        >
          {product.name}
        </p>
        <div className="pointer-events-auto flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleShareProduct}
            className={iconButtonClass}
            aria-label="Share product"
          >
            <ShareIcon />
          </button>
          <Link href="/cart" className={`${iconButtonClass} relative`} aria-label="Open cart">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2m0 0L7 13h10l2-8H5.4zm1.6 13a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z"
              />
            </svg>
            {totalCartItems > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-wine px-1 text-[10px] font-semibold text-white">
                {totalCartItems}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl lg:px-8 lg:pt-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
          {/* Gallery */}
          <div className="lg:sticky lg:top-24">
            <div className="relative overflow-hidden rounded-b-[28px] bg-cream-deep lg:rounded-[28px]">
              <div
                ref={galleryRef}
                onScroll={(event) => {
                  const el = event.currentTarget
                  const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
                  if (index !== selectedImage) setSelectedImage(index)
                }}
                className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide"
              >
                {galleryImages.map((img, idx) => (
                  <div key={img} className="relative aspect-square w-full flex-shrink-0 snap-center">
                    <Image
                      unoptimized
                      src={img}
                      alt={idx === 0 ? product.imageAlt || product.name : `${product.name} — photo ${idx + 1}`}
                      fill
                      priority={idx === 0}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>

              {discountPercent > 0 ? (
                <span className="absolute bottom-4 left-4 rounded-full bg-wine px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  {discountPercent}% off
                </span>
              ) : null}

              {galleryImages.length > 1 ? (
                <>
                  <span className="absolute bottom-4 right-4 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {activeIndex + 1} / {galleryImages.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => scrollToImage(Math.max(0, activeIndex - 1))}
                    disabled={activeIndex === 0}
                    className={`${iconButtonClass} absolute left-4 top-1/2 hidden -translate-y-1/2 disabled:opacity-0 lg:flex`}
                    aria-label="Previous photo"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToImage(Math.min(galleryImages.length - 1, activeIndex + 1))}
                    disabled={activeIndex === galleryImages.length - 1}
                    className={`${iconButtonClass} absolute right-4 top-1/2 hidden -translate-y-1/2 disabled:opacity-0 lg:flex`}
                    aria-label="Next photo"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              ) : null}
            </div>

            {galleryImages.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide lg:px-0">
                {galleryImages.map((img, idx) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => scrollToImage(idx)}
                    aria-label={`Show photo ${idx + 1}`}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 bg-cream-deep transition lg:h-20 lg:w-20 ${
                      activeIndex === idx ? 'border-wine' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <Image unoptimized src={img} alt="" fill sizes="80px" className="object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Details */}
          <div className="px-4 pt-5 lg:px-0 lg:pt-1">
            <div className="flex items-center gap-2">
              {product.showFoodTypeLabel ? <FoodTypeBadge isVeg={product.isVeg} /> : null}
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
                {product.category}
              </span>
            </div>

            <div className="mt-2 flex items-start justify-between gap-4">
              <h1 className="text-[22px] font-semibold leading-snug text-ink lg:text-[32px] lg:leading-tight">
                {product.name}
              </h1>
              <button
                type="button"
                onClick={handleShareProduct}
                className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white text-ink/70 transition hover:border-wine/30 hover:text-wine lg:inline-flex"
                aria-label="Share product"
              >
                <ShareIcon />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <span className="text-[26px] font-bold leading-none text-ink lg:text-[34px]">
                {formatPriceCompact(finalPrice)}
              </span>
              {showSavings ? (
                <>
                  <span className="text-base text-ink/40 line-through">{formatPriceCompact(product.price)}</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Save {formatPriceCompact(product.price - finalPrice)}
                  </span>
                </>
              ) : null}
            </div>

            {miniDescription ? (
              <p className="mt-3 text-sm leading-relaxed text-ink/60 lg:text-base">{miniDescription}</p>
            ) : null}

            {variants.length > 0 ? (
              <div className="mt-6">
                <p className="mb-2.5 text-sm font-semibold text-ink">
                  Option <span className="font-normal text-ink/50">· {selectedVariantLabel}</span>
                </p>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide lg:mx-0 lg:flex-wrap lg:px-0">
                  {[null, ...variants.map((_, index) => index)].map((index) => {
                    const variant = index === null ? null : variants[index]
                    const label = variant
                      ? [variant.color, variant.size].filter(Boolean).join(' / ') || `Option ${(index as number) + 1}`
                      : 'Standard'
                    const price = variant
                      ? typeof variant.price === 'number'
                        ? variant.price
                        : null
                      : basePrice
                    const selected = selectedVariantIndex === index
                    return (
                      <button
                        key={index === null ? 'standard' : `${label}-${index}`}
                        type="button"
                        onClick={() => selectVariant(selected && index !== null ? null : index)}
                        aria-pressed={selected}
                        className={`flex flex-shrink-0 items-center gap-2.5 rounded-2xl border bg-white py-1.5 pl-1.5 pr-3.5 text-left transition ${
                          selected ? 'border-wine ring-1 ring-wine' : 'border-ink/10 hover:border-wine/40'
                        }`}
                      >
                        <img
                          src={variant ? variant.image : resolveImageUrl(product.image)}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded-xl object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block max-w-[9rem] truncate text-xs font-semibold text-ink">{label}</span>
                          {price !== null ? (
                            <span className="block text-[11px] text-ink/55">{formatPriceCompact(price)}</span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Desktop purchase row; phones use the sticky bar */}
            <div className="relative isolate mt-7 hidden items-center gap-3 lg:flex">
              <NavMascot className="bottom-full left-2" script={mascotScript} scriptKey={product.id} />
              <QuantityStepper value={quantity} onChange={setQuantity} size="lg" />
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!product.isAvailable}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-wine px-6 text-base font-semibold text-white transition hover:bg-wine-deep disabled:cursor-not-allowed disabled:bg-ink/20"
              >
                {addToCartLabel}
                {product.isAvailable ? (
                  <span className="font-normal text-white/75">· {formatPriceCompact(finalPrice * quantity)}</span>
                ) : null}
              </button>
            </div>

            <ul className="mt-6 space-y-3 rounded-2xl border border-ink/10 bg-white p-4 text-sm text-ink/70">
              {product.prepTime > 0 ? (
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-soft text-wine">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>
                    Ready in <span className="font-semibold text-ink">{formatTime(product.prepTime)}</span>
                  </span>
                </li>
              ) : null}
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-soft text-wine">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z" />
                    <circle cx="12" cy="9.5" r="2.5" strokeWidth={2} />
                  </svg>
                </span>
                <span>Delivery across Kathmandu Valley</span>
              </li>
            </ul>

            {visibleTags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {visibleTags.map((tag, idx) => (
                  <span key={idx} className="rounded-full bg-rose-soft px-2.5 py-1 text-[11px] font-medium text-wine">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {descriptionHtml ? (
              <section className="mt-7 border-t border-ink/10 pt-6">
                <h2 className="text-base font-semibold text-ink">Product details</h2>
                <div className="relative mt-3">
                  <div
                    ref={descriptionRef}
                    className={`space-y-2 text-sm leading-6 text-ink/70 lg:text-[15px] lg:leading-7 [&_a]:text-wine [&_h1]:mt-3 [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mt-3 [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-2 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-4 [&_li]:list-disc [&_ul]:my-2 ${
                      descriptionExpanded ? '' : 'max-h-44 overflow-hidden'
                    }`}
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                  {!descriptionExpanded && descriptionOverflows ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-cream to-transparent" />
                  ) : null}
                </div>
                {descriptionOverflows ? (
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded((value) => !value)}
                    className="mt-2 text-sm font-semibold text-wine"
                  >
                    {descriptionExpanded ? 'Show less' : 'Read more'}
                  </button>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-10 space-y-10 px-4 lg:mt-14 lg:space-y-12 lg:px-0">
          {loadingDeferredSections && !hasDeferredContent ? <ShelfSkeleton /> : null}

          {addons.length > 0 ? (
            <section>
              <h2 className="mb-1 text-lg font-semibold text-ink lg:text-2xl">Add a little extra</h2>
              <p className="mb-4 text-sm text-ink/55">Small add-ons that go well with this gift.</p>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide lg:mx-0 lg:px-0">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className="w-36 flex-shrink-0 overflow-hidden rounded-[20px] border border-ink/10 bg-white lg:w-44"
                  >
                    <Link href={`/products/${addon.id}`} className="relative block aspect-square bg-cream-deep">
                      <Image unoptimized src={resolveImageUrl(addon.image)} alt={addon.name} fill sizes="176px" className="object-cover" />
                    </Link>
                    <div className="flex items-end justify-between gap-2 p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink">{addon.name}</p>
                        <p className="text-sm font-semibold text-wine">{formatPriceCompact(salePrice(addon))}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickAddRecommendation(addon)}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-wine text-white transition hover:bg-wine-deep active:scale-95"
                        aria-label={`Add ${addon.name} to cart`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14m7-7H5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {buyTogether.length > 0 ? (
            <RecommendationShelf
              title="Buy together"
              description="Complete your combo in one tap."
              products={buyTogether}
              actionLabel="Add"
              onAdd={(item) => handleQuickAddRecommendation(item)}
            />
          ) : null}

          {subProducts.length > 0 ? (
            <RecommendationShelf
              title="Goes with this"
              description="Optional add-ons for this item."
              products={subProducts}
              actionLabel="Add"
              onAdd={(item) => handleQuickAddRecommendation(item)}
            />
          ) : null}

          {relatedProducts.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-ink lg:text-2xl">You may also like</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
                {relatedProducts.map((item) => (
                  <ProductCard
                    key={item.id}
                    product={{
                      ...item,
                      miniDescription: item.category,
                      description: '',
                      prepTime: 0,
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* Sticky purchase bar on phones */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        {/* The gift buddy peeks over the bar and chats about this product. */}
        <NavMascot className="bottom-full left-4" script={mascotScript} scriptKey={product.id} />
        <div className="border-t border-ink/10 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!product.isAvailable}
              className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-wine px-4 text-[15px] font-semibold text-white transition hover:bg-wine-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:justify-center disabled:bg-ink/20"
            >
              <span className="truncate">{addToCartLabel}</span>
              {product.isAvailable ? (
                <span className="flex-shrink-0 whitespace-nowrap">{formatPriceCompact(finalPrice * quantity)}</span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {cartToastMessage ? (
        // Sits above the buddy's speech bubble on phones.
        <div className="pointer-events-none fixed inset-x-0 bottom-40 z-[70] flex justify-center lg:bottom-8">
          <div className="animate-slide-up rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-xl">
            {cartToastMessage}
          </div>
        </div>
      ) : null}
    </div>
  )
}
