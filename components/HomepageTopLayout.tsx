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
import { PLAY_STORE_APP_URL } from '@/lib/app-download'

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
  return Math.min(640, Math.max(200, value || 380))
}

function clampProductStripHeight(value: number) {
  return Math.min(180, Math.max(72, value || 112))
}

function CategoryChipVisual({
  label,
  image,
  wash,
  selected,
  size = 'compact',
}: {
  label: string
  image?: string | null
  wash: string
  selected?: boolean
  size?: 'compact' | 'desktop'
}) {
  const imageUrl = image ? resolveImageUrl(image) : null
  const desktop = size === 'desktop'
  return (
    <span className={`flex flex-col items-center ${desktop ? 'w-[84px] gap-2' : 'w-[58px] gap-1'}`}>
      <span
        className={`relative flex items-center justify-center overflow-hidden rounded-full ${
          desktop ? 'h-16 w-16' : 'h-11 w-11'
        }`}
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
            sizes={desktop ? '64px' : '44px'}
            quality={60}
          />
        ) : (
          <span className={`font-bold text-ink/70 ${desktop ? 'text-lg' : 'text-sm'}`}>
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span
        className={`line-clamp-2 w-full text-center leading-tight ${
          desktop ? 'text-[13px]' : 'text-[11px]'
        } ${selected ? 'font-bold text-ink' : 'font-medium text-ink/65'}`}
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
          sizes="(min-width: 1024px) 180px, 120px"
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

function BannerSlideCard({
  banner,
  height,
  productStripHeight,
  compact,
  priority,
}: {
  banner: Banner
  height: number
  productStripHeight: number
  compact?: boolean
  priority?: boolean
}) {
  const imageUrl = resolveImageUrl(banner.image)
  const products = (banner.products || []).slice(0, compact ? 2 : 3)
  const subtitle = banner.subtitle?.trim()

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${
        compact ? 'rounded-[22px]' : 'rounded-[18px] lg:rounded-[28px]'
      } ${banner.link ? 'cursor-pointer' : ''}`}
      style={{ height, backgroundColor: banner.bgColor || '#F0F0F0' }}
      role={banner.link ? 'link' : undefined}
      tabIndex={banner.link ? 0 : undefined}
      onClick={() => {
        if (banner.link) window.location.assign(banner.link)
      }}
      onKeyDown={(e) => {
        if (!banner.link) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          window.location.assign(banner.link)
        }
      }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={banner.title}
          fill
          priority={priority}
          quality={80}
          className="object-cover"
          sizes={compact ? '(min-width: 1024px) 33vw, 100vw' : '(max-width: 1024px) 100vw, 1200px'}
        />
      ) : null}

      <div
        className={`absolute inset-x-0 bottom-0 ${compact ? 'px-3 pb-3' : 'px-2.5 pb-2.5 lg:px-6 lg:pb-5'}`}
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.65) 100%)',
          paddingTop: products.length ? 40 : 28,
        }}
      >
        <p
          className={`truncate font-semibold text-white drop-shadow ${
            compact ? 'text-base' : 'text-[15px] lg:text-2xl'
          }`}
        >
          {banner.title}
        </p>
        {subtitle ? (
          <p className={`truncate font-medium text-white/90 ${compact ? 'text-[11px]' : 'text-[11px] lg:text-sm'}`}>
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
      </div>
    </div>
  )
}

function AppStyleBanner({
  banners,
  height,
  productStripHeight,
  onWashChange,
  layout = 'single',
}: {
  banners: Banner[]
  height: number
  productStripHeight: number
  onWashChange?: (color: string) => void
  layout?: 'single' | 'trio'
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const trioCount = Math.min(3, banners.length)
  const canAdvance = layout === 'trio' ? banners.length > 3 : banners.length > 1

  useEffect(() => {
    if (!canAdvance || paused) return
    const t = window.setTimeout(() => {
      setActiveIndex((i) => (i + 1) % banners.length)
    }, BANNER_DURATION)
    return () => window.clearTimeout(t)
  }, [banners.length, activeIndex, paused, canAdvance])

  const visibleBanners =
    layout === 'trio'
      ? Array.from({ length: trioCount }, (_, offset) => banners[(activeIndex + offset) % banners.length])
      : [banners[activeIndex]]

  useEffect(() => {
    const bg = visibleBanners[0]?.bgColor?.trim()
    onWashChange?.(bg && /^#([0-9a-f]{6})$/i.test(bg) ? bg : DEFAULT_WASH)
  }, [activeIndex, banners, layout, onWashChange])

  if (banners.length === 0) return null

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {layout === 'trio' ? (
        <div className={`grid gap-4 ${trioCount === 1 ? 'grid-cols-1' : trioCount === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {visibleBanners.map((banner, i) => (
            <BannerSlideCard
              key={`${banner.id}-${i}`}
              banner={banner}
              height={height}
              productStripHeight={productStripHeight}
              compact
              priority={i === 0}
            />
          ))}
        </div>
      ) : (
        <BannerSlideCard
          banner={visibleBanners[0]}
          height={height}
          productStripHeight={productStripHeight}
          priority={activeIndex === 0}
        />
      )}

      {canAdvance ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Banner ${i + 1}`}
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? 'w-4 bg-ink/70' : 'w-1.5 bg-ink/25'
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** App-matching sticky home chrome: location, search, category chips, banner. */
export default function HomepageTopLayout({
  categories,
  showTopCategories = true,
  deliveryEstimate = '',
  banners = [],
  showBanner = true,
  bannerHeight = 380,
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
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user) {
      setWalletBalance(null)
      return
    }

    let cancelled = false
    void fetch('/api/wallet?limit=1', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setWalletBalance(Number(data.balance) || 0)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [user])

  const headerCategories = useMemo(
    () => (showTopCategories ? categories.slice(0, 12) : []),
    [categories, showTopCategories]
  )

  const locationLabel = mounted
    ? deliveryAddress?.label ||
      currentLocation?.label ||
      deliveryAddress?.address?.split(',')[0]?.trim() ||
      currentLocation?.address?.split(',')[0]?.trim() ||
      'Set location'
    : 'Set location'

  const initial =
    user?.name?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    null

  const bannerH = clampBannerHeight(bannerHeight)
  const mobileBannerH = Math.max(bannerH, 380)
  const desktopBannerH = Math.min(560, Math.max(bannerH, 480))
  const productH = clampProductStripHeight(bannerProductHeight)
  const desktopProductH = Math.min(132, Math.max(productH, 108))

  const categoryRow = (size: 'compact' | 'desktop') => (
    <>
      <button
        type="button"
        className="flex-shrink-0"
        onClick={() => {
          setSelectedTab(0)
          document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        <CategoryChipVisual
          label="All"
          wash="#E85A8C"
          selected={selectedTab === 0}
          size={size}
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
            size={size}
          />
        </Link>
      ))}
    </>
  )

  return (
    <>
      <section
        className="overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${wash} 0%, ${wash}ee 42%, #faf5f0 78%, #faf5f0 100%)`,
        }}
      >
        {/* Phone / tablet — keep the compact app chrome */}
        <div className="mx-auto max-w-7xl px-3 pb-3 pt-2 sm:px-5 lg:hidden">
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
            {categoryRow('compact')}
          </div>

          {showBanner && banners.length > 0 ? (
            <div className="mt-3">
              <AppStyleBanner
                banners={banners}
                height={mobileBannerH}
                productStripHeight={productH}
                onWashChange={setWash}
              />
            </div>
          ) : null}
        </div>

        {/* Desktop — website header, search, and a wide hero */}
        <div className="hidden lg:block">
          <div className="sticky top-0 z-40 border-b border-wine/10 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-6 xl:px-8">
              <Link href="/" className="flex shrink-0 items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-wine text-white">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </span>
                <span className="font-display text-xl font-semibold tracking-tight text-wine">
                  Upaharo
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                title={
                  deliveryAddress?.address ||
                  currentLocation?.address ||
                  locationLabel
                }
                className="flex h-8 max-w-[132px] shrink-0 items-center gap-1 rounded-full bg-cream px-2"
              >
                <svg className="h-3.5 w-3.5 shrink-0 text-blush" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 1 1 9.9 9.9L10 18.9l-4.95-4.95a7 7 0 0 1 0-9.9ZM10 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="min-w-0 truncate text-xs font-medium text-ink">{locationLabel}</span>
                <svg className="h-3 w-3 shrink-0 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => router.push('/search')}
                className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-cream px-4 text-left"
              >
                <svg className="h-4 w-4 shrink-0 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              <a
                href={PLAY_STORE_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-blush hover:bg-blush-soft"
              >
                Get app
              </a>
              <Link
                href={user ? '/profile' : '/login'}
                title="Wallet"
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-wine hover:bg-cream"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5m0 0h-5a2 2 0 010-4h5m0 4a2 2 0 100-4" />
                </svg>
                <span className="whitespace-nowrap">
                  {mounted && user && walletBalance != null
                    ? formatPriceNoDecimals(walletBalance)
                    : 'Wallet'}
                </span>
              </Link>
              <Link
                href="/cart"
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-cream"
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
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blush px-1 text-[10px] font-bold text-white">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                ) : null}
              </Link>
              <Link
                href={user ? '/profile' : '/login'}
                className="flex h-10 shrink-0 items-center gap-2 rounded-full px-2 text-sm font-semibold text-ink hover:bg-cream"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-soft text-xs font-bold text-blush">
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
                </span>
                <span className="hidden xl:inline">{user?.name?.split(' ')[0] || 'Sign in'}</span>
              </Link>
            </div>

            {headerCategories.length > 0 ? (
              <div className="border-t border-wine/10">
                <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6 py-2 scrollbar-hide xl:px-8">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTab(0)
                      document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                      selectedTab === 0
                        ? 'bg-blush-soft font-semibold text-blush'
                        : 'font-medium text-ink/65 hover:bg-cream hover:text-ink'
                    }`}
                  >
                    All
                  </button>
                  {headerCategories.map((category, index) => (
                    <Link
                      key={category.id}
                      href={`/categories/${category.id}`}
                      onClick={() => setSelectedTab(index + 1)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                        selectedTab === index + 1
                          ? 'bg-blush-soft font-semibold text-blush'
                          : 'font-medium text-ink/65 hover:bg-cream hover:text-ink'
                      }`}
                    >
                      {category.shortName || category.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {showBanner && banners.length > 0 ? (
            <div className="mx-auto max-w-7xl px-6 pb-8 pt-6 xl:px-8">
              <AppStyleBanner
                banners={banners}
                height={desktopBannerH}
                productStripHeight={desktopProductH}
                onWashChange={setWash}
                layout="trio"
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
