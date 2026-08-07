'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import LocationModal from '@/components/LocationModal'
import { resolveImageUrl } from '@/lib/image-url'
import { useLocationStore } from '@/lib/store/location'
import { useUserStore } from '@/lib/store/user'
import { useCartStore } from '@/lib/store/cart'
import { formatPriceNoDecimals } from '@/lib/utils'

type Category = {
  id: string
  name: string
  image?: string | null
  washColor?: string | null
  shortName?: string | null
}

type BannerProduct = {
  id: string
  name: string
  price: number
  image: string
  discount?: number | null
  finalPrice: number
}

type Banner = {
  id: string
  title: string
  subtitle?: string | null
  image: string
  link?: string | null
  bgColor?: string | null
  products?: BannerProduct[]
}

type HomepageTopLayoutProps = {
  categories: Category[]
  occasionCategories?: Category[]
  showTopCategories?: boolean
  showOccasionTabs?: boolean
  deliveryEstimate?: string
  banners?: Banner[]
  showBanner?: boolean
  bannerHeight?: number
  bannerProductHeight?: number
}

const BANNER_DURATION = 4500
const DEFAULT_WASH = '#F7F0E8'

function clampBannerHeight(value: number) {
  return Math.min(520, Math.max(200, value || 320))
}

function clampProductStripHeight(value: number) {
  return Math.min(180, Math.max(72, value || 112))
}

function CategoryChipVisual({
  label,
  image,
  wash,
  selected,
}: {
  label: string
  image?: string | null
  wash: string
  selected?: boolean
}) {
  const imageUrl = image ? resolveImageUrl(image) : null
  return (
    <span className="flex w-[58px] flex-col items-center gap-1">
      <span
        className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full"
        style={{
          backgroundColor: `${wash}40`,
          boxShadow: selected ? `0 0 0 2px ${wash}` : undefined,
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={label}
            fill
            className="object-cover"
            sizes="44px"
            quality={60}
          />
        ) : (
          <span className="text-sm font-bold text-ink/70">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span
        className={`line-clamp-1 w-full text-center text-[11px] ${
          selected ? 'font-bold text-ink' : 'font-medium text-ink/65'
        }`}
      >
        {label}
      </span>
    </span>
  )
}

function BannerProductTile({ product }: { product: BannerProduct }) {
  const addItem = useCartStore((s) => s.addItem)
  const price = product.finalPrice ?? product.price

  return (
    <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-xl bg-white/95">
      <Link href={`/products/${product.id}`} className="absolute inset-0 block">
        <Image
          src={resolveImageUrl(product.image)}
          alt={product.name}
          fill
          className="object-cover"
          sizes="120px"
          quality={65}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-5 pr-7">
          <p className="line-clamp-2 text-[10px] font-medium leading-tight text-white">
            {product.name}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#D4AF37]">
            {formatPriceNoDecimals(price)}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-label={`Add ${product.name} to cart`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          addItem({
            id: product.id,
            name: product.name,
            price,
            image: resolveImageUrl(product.image),
            isVeg: true,
            quantity: 1,
          })
        }}
        className="absolute bottom-1 right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-blush text-white shadow"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}

function AppStyleBanner({
  banners,
  height,
  productStripHeight,
  onWashChange,
}: {
  banners: Banner[]
  height: number
  productStripHeight: number
  onWashChange?: (color: string) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (banners.length <= 1 || paused) return
    const t = window.setTimeout(() => {
      setActiveIndex((i) => (i + 1) % banners.length)
    }, BANNER_DURATION)
    return () => window.clearTimeout(t)
  }, [banners.length, activeIndex, paused])

  useEffect(() => {
    const bg = banners[activeIndex]?.bgColor?.trim()
    onWashChange?.(bg && /^#([0-9a-f]{6})$/i.test(bg) ? bg : DEFAULT_WASH)
  }, [activeIndex, banners, onWashChange])

  if (banners.length === 0) return null

  const active = banners[activeIndex]
  const imageUrl = resolveImageUrl(active.image)
  const products = (active.products || []).slice(0, 3)
  const subtitle = active.subtitle?.trim()

  const card = (
    <div
      className={`relative w-full overflow-hidden rounded-[18px] ${
        active.link ? 'cursor-pointer' : ''
      }`}
      style={{ height, backgroundColor: active.bgColor || '#F0F0F0' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      role={active.link ? 'link' : undefined}
      tabIndex={active.link ? 0 : undefined}
      onClick={() => {
        if (active.link) window.location.assign(active.link)
      }}
      onKeyDown={(e) => {
        if (!active.link) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          window.location.assign(active.link)
        }
      }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={active.title}
          fill
          priority={activeIndex === 0}
          quality={80}
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 900px"
        />
      ) : null}

      <div
        className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.6) 100%)',
          paddingTop: products.length ? 56 : 36,
        }}
      >
        <p className="truncate text-[15px] font-semibold text-white drop-shadow">
          {active.title}
        </p>
        {subtitle ? (
          <p className="truncate text-[11px] font-medium text-white/90">
            {subtitle}
          </p>
        ) : null}

        {products.length > 0 ? (
          <div
            className="mt-2 flex gap-1.5"
            style={{ height: productStripHeight }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {products.map((product) => (
              <BannerProductTile key={product.id} product={product} />
            ))}
          </div>
        ) : null}

        {banners.length > 1 ? (
          <div className="mt-2 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Banner ${i + 1}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setActiveIndex(i)
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )

  return card
}

/** App-matching sticky home chrome: location, search, category chips, banner. */
export default function HomepageTopLayout({
  categories,
  showTopCategories = true,
  deliveryEstimate = '',
  banners = [],
  showBanner = true,
  bannerHeight = 320,
  bannerProductHeight = 112,
}: HomepageTopLayoutProps) {
  const router = useRouter()
  const user = useUserStore((s) => s.user)
  const cartCount = useCartStore((s) => s.getTotalItems())
  const deliveryAddress = useLocationStore((state) => state.deliveryAddress)
  const currentLocation = useLocationStore((state) => state.currentLocation)
  const [mounted, setMounted] = useState(false)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [wash, setWash] = useState(DEFAULT_WASH)
  const [selectedTab, setSelectedTab] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const headerCategories = useMemo(
    () => (showTopCategories ? categories.slice(0, 12) : []),
    [categories, showTopCategories]
  )

  const locationLabel = mounted
    ? deliveryAddress?.address ||
      currentLocation?.address ||
      deliveryAddress?.label ||
      currentLocation?.label ||
      'Choose delivery location'
    : 'Choose delivery location'

  const initial =
    user?.name?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    null

  const bannerH = clampBannerHeight(bannerHeight)
  const productH = clampProductStripHeight(bannerProductHeight)

  return (
    <>
      <section
        className="overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${wash} 0%, ${wash}ee 42%, #faf5f0 78%, #faf5f0 100%)`,
        }}
      >
        <div className="mx-auto max-w-7xl px-3 pb-3 pt-2 sm:px-5">
          <div className="flex items-center gap-2 px-1 py-1">
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-0.5">
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0 text-blush"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 1 1 9.9 9.9L10 18.9l-4.95-4.95a7 7 0 0 1 0-9.9ZM10 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="truncate text-[13px] font-semibold text-ink">
                  {locationLabel}
                </span>
                <svg
                  className="h-4 w-4 flex-shrink-0 text-ink/50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="m19 9-7 7-7-7"
                  />
                </svg>
              </div>
              {deliveryEstimate ? (
                <p className="ml-[17px] truncate text-[11px] font-medium text-ink/55">
                  {deliveryEstimate}
                </p>
              ) : null}
            </button>

            <Link
              href={user ? '/profile' : '/login'}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-blush shadow-sm ring-1 ring-blush/15"
              aria-label="Account"
            >
              {initial || (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              )}
            </Link>
          </div>

          <div className="mt-1.5 flex items-center gap-2 px-0.5">
            <button
              type="button"
              onClick={() => router.push('/search')}
              className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] bg-white px-3.5 text-left shadow-sm ring-1 ring-black/[0.06]"
            >
              <svg
                className="h-4 w-4 flex-shrink-0 text-ink/45"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>
              <span className="truncate text-sm text-ink/45">
                Search gifts, cakes, flowers…
              </span>
            </button>
            <Link
              href="/cart"
              className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-ink shadow-sm ring-1 ring-black/[0.06]"
              aria-label="Cart"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
                />
              </svg>
              {mounted && cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blush px-1 text-[10px] font-bold text-white">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              type="button"
              className="flex-shrink-0"
              onClick={() => {
                setSelectedTab(0)
                document
                  .getElementById('featured')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <CategoryChipVisual
                label="All"
                wash="#E85A8C"
                selected={selectedTab === 0}
              />
            </button>
            {headerCategories.map((category, index) => (
              <Link
                key={category.id}
                href={`/categories/${category.id}`}
                className="flex-shrink-0"
                onClick={() => setSelectedTab(index + 1)}
              >
                <CategoryChipVisual
                  label={category.shortName || category.name}
                  image={category.image}
                  wash={category.washColor || '#F3C4D4'}
                  selected={selectedTab === index + 1}
                />
              </Link>
            ))}
          </div>

          {showBanner && banners.length > 0 ? (
            <div className="mt-3">
              <AppStyleBanner
                banners={banners}
                height={bannerH}
                productStripHeight={productH}
                onWashChange={setWash}
              />
            </div>
          ) : null}
        </div>
      </section>

      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </>
  )
}
