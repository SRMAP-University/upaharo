'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import SkeletonLoader from '@/components/SkeletonLoader'
import FoodTypeBadge from '@/components/FoodTypeBadge'
import PickupLocationCard from '@/components/PickupLocationCard'
import { useUserStore } from '@/lib/store/user'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPrice, formatPriceNoDecimals, formatTime } from '@/lib/utils'

const trackingSteps = [
  { key: 'PENDING', label: 'Order Placed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready for Pickup' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
]

const statusTheme: Record<
  string,
  {
    badge: string
    title: string
    hint: string
    panelClass: string
  }
> = {
  PENDING: {
    badge: 'bg-amber-100 text-amber-700',
    title: 'Order received',
    hint: 'We are confirming your order now.',
    panelClass: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  ACCEPTED: {
    badge: 'bg-blue-100 text-blue-700',
    title: 'Order accepted',
    hint: 'Your order is in queue for preparation.',
    panelClass: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  PREPARING: {
    badge: 'bg-violet-100 text-violet-700',
    title: 'Preparing your order',
    hint: 'Our team is preparing your items.',
    panelClass: 'bg-violet-50 border-violet-200 text-violet-800',
  },
  READY: {
    badge: 'bg-sky-100 text-sky-700',
    title: 'Ready for dispatch',
    hint: 'Packaging is complete and rider assignment is next.',
    panelClass: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  OUT_FOR_DELIVERY: {
    badge: 'bg-orange-100 text-orange-700',
    title: 'On the way',
    hint: 'Rider is heading to your delivery location.',
    panelClass: 'bg-orange-50 border-orange-200 text-orange-800',
  },
  DELIVERED: {
    badge: 'bg-emerald-100 text-emerald-700',
    title: 'Delivered',
    hint: 'Order has been delivered successfully.',
    panelClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  CANCELLED: {
    badge: 'bg-red-100 text-red-700',
    title: 'Cancelled',
    hint: 'This order was cancelled.',
    panelClass: 'bg-red-50 border-red-200 text-red-800',
  },
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function OrderTrackingPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { user, _hasHydrated } = useUserStore()
  const [order, setOrder] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const orderId = Array.isArray(params.id) ? params.id[0] : params.id
  const sessionUser = (session as any)?.user

  useEffect(() => {
    if (!orderId) return
    if (status === 'loading' || !_hasHydrated) return

    if (status === 'unauthenticated' && !user && !sessionUser) {
      router.push('/login')
      return
    }

    if (!user && !sessionUser) return

    void fetchOrder()
    const interval = setInterval(() => {
      void fetchOrder()
    }, 5000)

    return () => clearInterval(interval)
  }, [orderId, status, user, sessionUser, _hasHydrated, router])

  const fetchOrder = async () => {
    if (!orderId) return

    try {
      const token = localStorage.getItem('token') || sessionUser?.token
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json()
      if (response.ok) {
        setOrder(data.order)
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
          <SkeletonLoader variant="order" />
          <SkeletonLoader variant="text" count={4} />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-cream px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">Order not found</h1>
        <p className="text-ink/55 mb-6">The order you are looking for is not available.</p>
        <button
          type="button"
          onClick={() => router.push('/orders')}
          className="rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-white hover:bg-wine-deep transition-colors"
        >
          Back to Orders
        </button>
      </div>
    )
  }

  const currentStatus = String(order.status || 'PENDING')
  const currentStatusIndex = trackingSteps.findIndex((step) => step.key === currentStatus)
  const completedIndex = currentStatus === 'CANCELLED' ? 0 : Math.max(0, currentStatusIndex)
  const activeTheme = statusTheme[currentStatus] || statusTheme.PENDING
  const hasAddress = Boolean(order.address)
  const isPickup = String(order.fulfillmentType || 'DELIVERY') === 'PICKUP'
  const pickupLatitude = Number(order.pickupLatitude)
  const pickupLongitude = Number(order.pickupLongitude)
  const hasPickupCoordinates = Number.isFinite(pickupLatitude) && Number.isFinite(pickupLongitude)
  const hasEstimatedTime = Number.isFinite(Number(order.estimatedTime)) && Number(order.estimatedTime) > 0
  const hasCoordinates =
    Number.isFinite(Number(order.address?.latitude)) && Number.isFinite(Number(order.address?.longitude))

  return (
    <div className="min-h-screen bg-cream pb-8">
      <div className="sticky top-0 z-40 border-b border-wine/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/orders')}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-wine/20 text-wine hover:bg-cream"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-ink">Order #{order.orderNumber}</p>
              <p className="truncate text-xs text-ink/55">{new Date(order.placedAt).toLocaleString()}</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeTheme.badge}`}>
            {formatStatusLabel(currentStatus)}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[22px] bg-gradient-to-br from-wine to-wine-deep p-5 text-white shadow-[0_24px_60px_-40px_rgba(124,42,71,0.9)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-cream/70">Current Status</p>
              <h1 className="mt-1 font-display text-2xl font-semibold">{activeTheme.title}</h1>
              <p className="mt-1 text-sm text-cream/80">{activeTheme.hint}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-cream/70">Order Total</p>
              <p className="mt-1 font-display text-2xl font-semibold">{formatPriceNoDecimals(order.total)}</p>
            </div>
          </div>
          {currentStatus !== 'DELIVERED' && currentStatus !== 'CANCELLED' ? (
            <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm">
              {hasEstimatedTime ? (
                <>
                  Estimated arrival: <span className="font-semibold">{formatTime(order.estimatedTime)}</span>
                </>
              ) : (
                <>
                  Estimated arrival: <span className="font-semibold">Will be updated by admin soon</span>
                </>
              )}
            </div>
          ) : null}

          {order.deliveryOtp &&
          (currentStatus === 'OUT_FOR_DELIVERY' || currentStatus === 'READY') ? (
            <div className="mt-4 rounded-xl border border-gold/40 bg-white/15 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-cream/70">Delivery confirmation code</p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-[0.35em] text-gold">
                {order.deliveryOtp}
              </p>
              <p className="mt-2 text-xs text-cream/80">
                Share this code with the delivery person only when you receive your order.
              </p>
            </div>
          ) : null}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[22px] border border-wine/10 bg-white p-4 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]"
        >
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Tracking Timeline</h2>
          <div className="space-y-4">
            {trackingSteps.map((step, index) => {
              const isCompleted = index <= completedIndex
              const isCurrent = index === completedIndex && currentStatus !== 'DELIVERED' && currentStatus !== 'CANCELLED'

              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                        isCompleted ? 'border-wine bg-wine text-white' : 'border-wine/20 bg-white text-ink/50'
                      }`}
                    >
                      {index + 1}
                    </div>
                    {index < trackingSteps.length - 1 ? (
                      <div className={`mt-1 h-7 w-0.5 ${isCompleted ? 'bg-wine' : 'bg-wine/15'}`} />
                    ) : null}
                  </div>
                  <div className="pt-0.5">
                    <p className={`text-sm font-semibold ${isCompleted ? 'text-ink' : 'text-ink/50'}`}>
                      {step.label}
                    </p>
                    {isCurrent ? <p className="text-xs text-wine">In progress</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
          {currentStatus === 'CANCELLED' ? (
            <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${activeTheme.panelClass}`}>
              This order was cancelled. Contact support if this was unexpected.
            </div>
          ) : null}
        </motion.section>

        <div className="grid gap-4 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[22px] border border-wine/10 bg-white p-4 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]"
          >
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">
              {isPickup ? 'Pickup Location' : 'Delivery Address'}
            </h2>
            {isPickup ? (
              hasPickupCoordinates ? (
                <PickupLocationCard
                  latitude={pickupLatitude}
                  longitude={pickupLongitude}
                  address={order.pickupAddress}
                  note="Collect this order at the store. No delivery fee was charged."
                />
              ) : (
                <p className="text-sm text-ink/45">Pickup point unavailable for this order.</p>
              )
            ) : hasAddress ? (
              <div className="space-y-1 text-sm text-ink/70">
                <p className="font-semibold text-ink">{order.address.label || 'Address'}</p>
                <p>{order.address.street}</p>
                {order.address.apartment ? <p>{order.address.apartment}</p> : null}
                {order.address.landmark ? <p>{order.address.landmark}</p> : null}
                <p>
                  {order.address.city}, {order.address.state} - {order.address.pincode}
                </p>
                {hasCoordinates ? (
                  <p className="pt-1 text-xs text-ink/45">
                    Coordinates: {Number(order.address.latitude).toFixed(5)}, {Number(order.address.longitude).toFixed(5)}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-ink/45">No address found for this order.</p>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-[22px] border border-wine/10 bg-white p-4 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]"
          >
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Bill Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-ink/60">
                <span>Subtotal</span>
                <span>{formatPriceNoDecimals(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-ink/60">
                <span>{isPickup ? 'Pickup' : 'Delivery Fee'}</span>
                <span>{isPickup ? 'FREE' : formatPriceNoDecimals(order.deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between text-ink/60">
                <span>Tax</span>
                <span>{formatPriceNoDecimals(order.tax)}</span>
              </div>
              <div className="border-t border-wine/10 pt-2 flex items-center justify-between text-base font-semibold text-ink">
                <span>Total</span>
                <span className="text-wine">{formatPriceNoDecimals(order.total)}</span>
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="rounded-[22px] border border-wine/10 bg-white p-4 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]"
        >
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Items in This Order</h2>
          <div className="space-y-3">
            {order.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-wine/10 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={resolveImageUrl(item.product.image)}
                    alt={item.product.name}
                    className="h-14 w-14 flex-shrink-0 rounded-2xl object-cover border border-wine/10 bg-cream-deep"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.product.showFoodTypeLabel ? <FoodTypeBadge isVeg={item.product.isVeg} className="h-4 w-4" /> : null}
                      <p className="truncate font-display text-sm font-semibold text-ink">{item.product.name}</p>
                    </div>
                    <p className="text-xs text-ink/55">Qty: {item.quantity}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-wine">{formatPrice(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
