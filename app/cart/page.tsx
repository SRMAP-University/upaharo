'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCartStore } from '@/lib/store/cart'
import { formatPriceCompact } from '@/lib/utils'
import BottomNav from '@/components/BottomNav'
import Header from '@/components/Header'
import RecommendationShelf from '@/components/recommendations/RecommendationShelf'
import { getRecentViewedProductIds } from '@/lib/recommendation-session'
import { resolveImageUrl } from '@/lib/image-url'

interface RecommendationProduct {
  id: string
  name: string
  price: number
  image: string
  category: string
  discount: number
  isVeg: boolean
  isAvailable: boolean
}

interface GiftWrap {
  id: string
  name: string
  price: number
  type: string
  image: string
}

function CartHeader({ count, onClear }: { count: number; onClear?: () => void }) {
  const router = useRouter()
  return (
    <div className="sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur lg:static lg:border-0 lg:bg-transparent">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-8 lg:pt-8">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            className="-ml-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-cream-deep lg:hidden"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink lg:text-3xl">Your cart</h1>
            <p className="text-xs text-ink/55 lg:mt-1 lg:text-sm">
              {count} {count === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-ink/55 transition hover:bg-cream-deep hover:text-ink"
          >
            Clear cart
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, getTotalPrice, getTotalItems, clearCart, giftOptions } = useCartStore()
  const [giftWraps, setGiftWraps] = useState<GiftWrap[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendationProduct[]>([])
  const [recommendationTitle, setRecommendationTitle] = useState('Related Products')
  const [freeDeliveryMin, setFreeDeliveryMin] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const totalItems = getTotalItems()
  const subtotal = getTotalPrice()
  const selectedWrap = Array.isArray(giftWraps) ? giftWraps.find(w => w.id === giftOptions.giftWrapId) : null
  const giftWrapPrice = selectedWrap?.price || 0
  const goodsTotal = subtotal + giftWrapPrice
  // Same rule as checkout: free above the store minimum, otherwise priced by address.
  const hasFreeDelivery = freeDeliveryMin !== null && freeDeliveryMin > 0
  const freeDeliveryUnlocked = hasFreeDelivery && goodsTotal >= (freeDeliveryMin as number)
  const remainingForFree = hasFreeDelivery ? Math.max(0, (freeDeliveryMin as number) - goodsTotal) : 0
  const freeDeliveryProgress = hasFreeDelivery ? Math.min(1, goodsTotal / (freeDeliveryMin as number)) : 0
  const totalLabel = freeDeliveryUnlocked ? 'Total' : 'Total before delivery'

  useEffect(() => {
    setMounted(true)
    const fetchGiftWraps = async () => {
      try {
        const res = await fetch('/api/gift-wraps')
        if (res.ok) {
          const data = await res.json()
          setGiftWraps(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Error fetching gift wraps:', error)
      }
    }
    const fetchDeliverySettings = async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const min = Number(data.freeDeliveryMinAmount)
        setFreeDeliveryMin(Number.isFinite(min) ? min : 0)
      } catch {
        // Without settings the summary just says delivery is priced at checkout.
      }
    }
    fetchGiftWraps()
    fetchDeliverySettings()
  }, [])

  useEffect(() => {
    if (!mounted || items.length === 0) {
      setRecommendedProducts([])
      return
    }

    const fetchCartRecommendations = async () => {
      try {
        const productIds = Array.from(new Set(items.map((item) => item.id)))
        const viewedProductIds = getRecentViewedProductIds()
        const params = new URLSearchParams({
          productIds: productIds.join(','),
          viewedProductIds: viewedProductIds.join(','),
        })
        const response = await fetch(`/api/recommendations/cart?${params.toString()}`)
        if (!response.ok) return
        const data = await response.json()
        setRecommendedProducts(Array.isArray(data.products) ? data.products : [])
        setRecommendationTitle(String(data.title || 'Related Products'))
      } catch (error) {
        console.error('Error fetching cart recommendations:', error)
      }
    }

    void fetchCartRecommendations()
  }, [items, mounted])

  const handleClearCart = () => {
    if (window.confirm('Remove all items from your cart?')) clearCart()
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-wine border-t-transparent mx-auto" />
        </div>
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-cream pb-24 lg:pb-16">
        <div className="hidden lg:block">
          <Header />
        </div>
        <CartHeader count={0} />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-soft text-wine">
            <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
              />
            </svg>
          </div>
          <h2 className="mt-5 text-xl font-semibold text-ink">Your cart is empty</h2>
          <p className="mt-1.5 text-sm text-ink/55">Find something they&apos;ll love.</p>
          <Link
            href="/"
            className="mt-6 rounded-2xl bg-wine px-8 py-3 font-semibold text-white transition hover:bg-wine-deep"
          >
            Browse gifts
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pb-32 lg:pb-16">
      <div className="hidden lg:block">
        <Header />
      </div>
      <CartHeader count={totalItems} onClear={handleClearCart} />

      <div className="mx-auto max-w-6xl px-4 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:px-8 lg:py-6">
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-3xl border border-ink/10 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 p-3 lg:gap-4 lg:p-4">
              <Link
                href={`/products/${item.id}`}
                className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-cream-deep lg:h-24 lg:w-24"
              >
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
                ) : null}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/products/${item.id}`} className="min-w-0">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink lg:text-base">
                    {item.name}
                  </h3>
                </Link>
                {item.quantity > 1 ? (
                  <p className="mt-0.5 text-xs text-ink/50">{formatPriceCompact(item.price)} each</p>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-3 pt-2.5">
                  <div className="flex items-center rounded-xl bg-cream-deep p-0.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-ink shadow-sm transition active:scale-95"
                      aria-label={item.quantity === 1 ? `Remove ${item.name}` : 'Decrease quantity'}
                    >
                      {item.quantity === 1 ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M14.74 9l-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.11 1.02.17M5.77 5.79c.34-.06.68-.12 1.02-.17m12.45 0L18.16 19.67A2.25 2.25 0 0115.92 21.75H8.08a2.25 2.25 0 01-2.24-2.08L4.77 5.79m14.47 0a48.11 48.11 0 00-3.48-.4m-12 .57a48.11 48.11 0 013.48-.4m7.5 0v-.92c0-1.18-.91-2.16-2.09-2.2a51.96 51.96 0 00-3.32 0c-1.18.04-2.09 1.02-2.09 2.2v.92m7.5 0a48.67 48.67 0 00-7.5 0"
                          />
                        </svg>
                      ) : (
                        <span className="text-lg font-semibold leading-none">−</span>
                      )}
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-ink" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-wine text-lg font-semibold leading-none text-white shadow-sm transition hover:bg-wine-deep active:scale-95"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <p className="whitespace-nowrap text-[15px] font-semibold text-ink">
                    {formatPriceCompact(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <section className="mt-4 rounded-3xl border border-ink/10 bg-white p-4 lg:sticky lg:top-24 lg:mt-0 lg:p-5">
          <h2 className="text-base font-semibold text-ink">Order summary</h2>

          {hasFreeDelivery ? (
            <div className="mt-3 rounded-2xl bg-rose-soft/70 px-3.5 py-3">
              <p className="text-xs font-medium text-wine">
                {freeDeliveryUnlocked ? (
                  'You’ve unlocked free delivery'
                ) : (
                  <>
                    Add <span className="font-semibold">{formatPriceCompact(Math.ceil(remainingForFree))}</span> more for
                    free delivery
                  </>
                )}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-wine transition-[width] duration-300"
                  style={{ width: `${Math.round(freeDeliveryProgress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink/60">
                Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})
              </dt>
              <dd className="font-medium text-ink">{formatPriceCompact(subtotal)}</dd>
            </div>
            {giftWrapPrice > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink/60">Gift wrap</dt>
                <dd className="font-medium text-ink">{formatPriceCompact(giftWrapPrice)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink/60">Delivery</dt>
              <dd className={freeDeliveryUnlocked ? 'font-semibold text-emerald-700' : 'text-ink/55'}>
                {freeDeliveryUnlocked ? 'Free' : 'Calculated at checkout'}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-4">
            <span className="text-sm font-semibold text-ink">{totalLabel}</span>
            <span className="text-xl font-bold text-ink">{formatPriceCompact(goodsTotal)}</span>
          </div>

          <button
            type="button"
            onClick={() => router.push('/checkout')}
            className="mt-5 hidden h-12 w-full items-center justify-center rounded-2xl bg-wine font-semibold text-white transition hover:bg-wine-deep lg:flex"
          >
            Checkout
          </button>
        </section>
      </div>

      {recommendedProducts.length > 0 ? (
        <div className="mx-auto max-w-6xl px-4 pb-4 pt-6 lg:px-8">
          <RecommendationShelf
            title={recommendationTitle}
            description="Add more before you check out."
            products={recommendedProducts}
            actionLabel="Add"
            onAdd={(product) =>
              useCartStore.getState().addItem({
                id: product.id,
                name: product.name,
                price: product.price - product.price * ((product.discount || 0) / 100),
                image: resolveImageUrl(product.image),
                isVeg: product.isVeg,
              })
            }
          />
        </div>
      ) : null}

      {/* Phones: one checkout bar instead of the tab bar, so nothing stacks over it */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink/55">{totalLabel}</p>
            <p className="text-lg font-bold leading-tight text-ink">{formatPriceCompact(goodsTotal)}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/checkout')}
            className="h-12 flex-shrink-0 rounded-2xl bg-wine px-8 font-semibold text-white transition hover:bg-wine-deep active:scale-[0.99]"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  )
}
