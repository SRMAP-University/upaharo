'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import SkeletonLoader from '@/components/SkeletonLoader'
import { useUserStore } from '@/lib/store/user'
import { useCartStore } from '@/lib/store/cart'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPrice, formatPriceNoDecimals } from '@/lib/utils'
import { cancelledByLabel } from '@/lib/order-cancel'

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
    image: string
    isVeg?: boolean
  }
}

interface GiftRecipient {
  id: string
  name: string
  phone: string
  relationship: string
}

interface GiftOccasion {
  id: string
  name: string
  emoji: string
}

interface OrderGiftWrap {
  id: string
  name: string
  price: number
}

interface Order {
  id: string
  orderNumber: string
  status: string
  cancelledBy?: string | null
  cancelReason?: string | null
  isGift: boolean
  total: number
  createdAt: string
  greetingMessage?: string | null
  senderName?: string | null
  showSenderName?: boolean
  recipient?: GiftRecipient | null
  occasion?: GiftOccasion | null
  giftWrap?: OrderGiftWrap | null
  items: OrderItem[]
  address: {
    label: string
    street: string
    apartment?: string
    landmark?: string
    city: string
    state: string
    pincode: string
  } | null
}

export default function OrdersPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { user, _hasHydrated } = useUserStore()
  const addItem = useCartStore((state) => state.addItem)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null)

  useEffect(() => {
    // Wait for session to load
    if (status === 'loading' || !_hasHydrated) {
      return
    }

    // Only redirect if definitely unauthenticated (not just waiting for session)
    if (status === 'unauthenticated' && !user) {
      router.push('/login')
      return
    }

    // Fetch orders if user exists (either from session or store)
    if (user || session?.user) {
      const token = localStorage.getItem('token') || (session?.user as any)?.token
      
      fetch('/api/orders', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => {
          setOrders(data.orders || [])
          setLoading(false)
        })
        .catch(err => {
          console.error('Error fetching orders:', err)
          setLoading(false)
        })
    }
  }, [status, session, user, _hasHydrated, router])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'preparing':
        return 'bg-purple-100 text-purple-800'
      case 'out_for_delivery':
        return 'bg-orange-100 text-orange-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-cream-deep text-ink/70'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const handleTrackOrder = (orderId: string) => {
    router.push(`/orders/${orderId}`)
  }

  const handleReorder = (order: Order) => {
    if (!Array.isArray(order.items) || order.items.length === 0) return

    setReorderingOrderId(order.id)

    order.items.forEach((item) => {
      if (!item?.product?.id) return

      addItem({
        id: item.product.id,
        name: item.product.name,
        price: Number(item.price) || 0,
        image: resolveImageUrl(item.product.image),
        isVeg: item.product.isVeg ?? true,
        quantity: Math.max(1, Number(item.quantity) || 1),
      })
    })

    router.push('/cart')
    setReorderingOrderId(null)
  }

  return (
    <div className="min-h-screen bg-cream pb-20 lg:pb-0">
      {/* Page-Specific Header */}
      <div className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-wine/10">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 -ml-2 hover:bg-cream-deep rounded-lg transition-colors">
                <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ink">Your Orders</h1>
              <p className="text-xs text-ink/55">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <h1 className="font-display text-base sm:text-xl lg:text-2xl font-semibold text-ink mb-4">Your Orders</h1>

        {loading ? (
          <div className="space-y-3">
            <SkeletonLoader variant="order" count={3} />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-wine/20 bg-white rounded-[22px]">
            <div className="text-7xl mb-4">🎁</div>
            <h2 className="font-display text-lg font-semibold text-ink mb-2">No orders yet</h2>
            <a
              href="/"
              className="inline-block bg-wine text-white px-6 py-2.5 rounded-full font-semibold text-sm mt-4 shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep transition-colors"
            >
              Browse Gifts
            </a>
          </div>
        ) : (
            <div className="space-y-3">
            {orders.map((order) => {
              const hasGiftDetails = Boolean(
                order.isGift ||
                  order.occasion ||
                  order.giftWrap ||
                  order.recipient ||
                  order.greetingMessage
              )

              return (
              <div key={order.id} className="p-4 pb-6 rounded-[22px] border border-wine/10 bg-white shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)] active:bg-cream-deep/40 transition-colors">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-xs font-semibold text-ink">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-ink/45">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 sm:items-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)} w-fit`}>
                      {formatStatus(order.status)}
                    </span>
                    {order.status === 'CANCELLED' ? (
                      <span className="max-w-[16rem] text-xs text-red-700 sm:text-right">
                        {cancelledByLabel(order.cancelledBy, 'customer')}
                        {order.cancelReason ? ` · ${order.cancelReason}` : ''}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-16 h-16 rounded-2xl object-cover bg-cream-deep"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-ink truncate">{item.product.name}</h3>
                        <p className="text-sm text-ink/55">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-wine">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {hasGiftDetails && (
                  <div className="mb-4 rounded-xl border border-wine/10 bg-rose-soft p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-wine">Gift Details</p>
                    <div className="mt-2 space-y-1.5 text-xs text-ink/80">
                      <p>
                        Order Type: <span className="font-semibold">{order.isGift ? 'Gift' : 'Direct'}</span>
                      </p>
                      {order.occasion ? (
                        <p>
                          Occasion: <span className="font-semibold">{order.occasion.emoji} {order.occasion.name}</span>
                        </p>
                      ) : null}
                      {order.giftWrap ? (
                        <p>
                          Gift Wrap:{' '}
                          <span className="font-semibold">
                            {order.giftWrap.name} ({formatPriceNoDecimals(order.giftWrap.price)})
                          </span>
                        </p>
                      ) : null}
                      {order.recipient ? (
                        <p>
                          Recipient:{' '}
                          <span className="font-semibold">
                            {order.recipient.name} ({order.recipient.relationship})
                          </span>
                        </p>
                      ) : null}
                      {order.greetingMessage ? (
                        <p>
                          Message: <span className="font-semibold">{order.greetingMessage}</span>
                        </p>
                      ) : null}
                      {order.senderName && order.showSenderName ? (
                        <p>
                          From: <span className="font-semibold">{order.senderName}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="border-t border-wine/10 pt-4 space-y-2">
                  {order.address && (
                    <div className="flex justify-between text-sm">
                      <span className="text-ink/55">Delivery Address:</span>
                      <span className="text-ink font-medium text-right max-w-xs truncate">
                        {order.address.street}, {order.address.city}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold">
                    <span className="text-ink">Total Amount:</span>
                    <span className="text-wine">{formatPriceNoDecimals(order.total)}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTrackOrder(order.id)}
                    className="flex-1 px-4 py-2.5 border border-wine/20 text-wine bg-white rounded-full hover:bg-cream transition-colors text-sm font-semibold active:scale-[0.98]"
                  >
                    Track Order
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(order)}
                    disabled={reorderingOrderId === order.id || order.items.length === 0}
                    className="flex-1 px-4 py-2.5 bg-wine text-white rounded-full shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep transition-all text-sm font-semibold active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {reorderingOrderId === order.id ? 'Adding...' : 'Reorder'}
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
