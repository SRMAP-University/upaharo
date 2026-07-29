'use client'

import { useEffect, useState } from 'react'
import { formatPriceNoDecimals, formatTime } from '@/lib/utils'

interface Address {
  label: string
  street: string
  apartment?: string
  landmark?: string
  city: string
  state: string
  pincode: string
  latitude: number
  longitude: number
}

interface Order {
  id: string
  orderNumber: string
  userId: string
  total: number
  estimatedTime?: number
  subtotal?: number
  deliveryFee?: number
  tax?: number
  isGift?: boolean
  isWholesale?: boolean
  businessName?: string | null
  greetingMessage?: string | null
  senderName?: string | null
  showSenderName?: boolean
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  deliveryOtp?: string | null
  deliveryDate: string
  createdAt: string
  store: {
    slug: string
    name: string
  }
  user: {
    name: string
    email: string
    phone: string | null
  }
  address: Address | null
  fulfillmentType?: 'DELIVERY' | 'PICKUP'
  pickupLatitude?: number | null
  pickupLongitude?: number | null
  pickupAddress?: string | null
  recipient?: {
    name: string
    phone: string
    relationship: string
  } | null
  occasion?: {
    name: string
    emoji: string
  } | null
  giftWrap?: {
    name: string
    type: string
    price: number
    image: string
  } | null
  items: {
    id: string
    quantity: number
    price: number
    product: {
      name: string
      image: string
    }
  }[]
}

const STATUS_OPTIONS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']
const PAYMENT_STATUS_OPTIONS = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']
const MINUTES_PER_DAY = 24 * 60

type EstimatedTimeUnit = 'minutes' | 'days'

const toEstimatedTimeDraft = (minutes: number, unit: EstimatedTimeUnit): string => {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0))
  if (unit === 'days') {
    return String(Number((safeMinutes / MINUTES_PER_DAY).toFixed(2)))
  }
  return String(safeMinutes)
}

const toEstimatedTimeMinutes = (rawValue: string, unit: EstimatedTimeUnit): number => {
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return NaN
  }
  if (unit === 'days') {
    return Math.round(parsed * MINUTES_PER_DAY)
  }
  return Math.round(parsed)
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedStoreName, setSelectedStoreName] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [estimatedTimeDraft, setEstimatedTimeDraft] = useState('')
  const [estimatedTimeUnit, setEstimatedTimeUnit] = useState<EstimatedTimeUnit>('minutes')
  const [savingEstimatedTime, setSavingEstimatedTime] = useState(false)
  const hasSelectedOrderCoords =
    !!selectedOrder?.address &&
    Number.isFinite(selectedOrder.address.latitude) &&
    Number.isFinite(selectedOrder.address.longitude) &&
    !(selectedOrder.address.latitude === 0 && selectedOrder.address.longitude === 0)

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleEstimatedTimeUnitChange = (nextUnit: EstimatedTimeUnit) => {
    if (nextUnit === estimatedTimeUnit) return
    const currentMinutes = toEstimatedTimeMinutes(estimatedTimeDraft, estimatedTimeUnit)
    setEstimatedTimeUnit(nextUnit)
    if (Number.isFinite(currentMinutes)) {
      setEstimatedTimeDraft(toEstimatedTimeDraft(currentMinutes, nextUnit))
    }
  }

  useEffect(() => {
    if (selectedOrder) {
      const safeMinutes = Math.max(0, Number(selectedOrder.estimatedTime) || 0)
      const defaultUnit: EstimatedTimeUnit =
        safeMinutes >= MINUTES_PER_DAY && safeMinutes % MINUTES_PER_DAY === 0 ? 'days' : 'minutes'
      setEstimatedTimeUnit(defaultUnit)
      setEstimatedTimeDraft(toEstimatedTimeDraft(safeMinutes, defaultUnit))
    }
  }, [selectedOrder])

  const fetchOrders = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const storeRes = await fetch('/api/admin/store', { cache: 'no-store' })
      if (storeRes.ok) {
        const storeData = (await storeRes.json()) as {
          selectedSlug?: string
          stores?: Array<{ slug: string; name: string }>
        }
        const slug = storeData.selectedSlug || 'gifts'
        setSelectedStoreName(
          storeData.stores?.find((store) => store.slug === slug)?.name || slug
        )
      }

      const res = await fetch('/api/admin/orders', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setOrders([])
        setLoadError(data?.error || `Failed to load orders (${res.status})`)
        return
      }

      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching orders:', error)
      setOrders([])
      setLoadError('Failed to load orders. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      let deliveryOtp: string | undefined
      if (status === 'DELIVERED') {
        const code = window.prompt(
          'Enter the 4-digit delivery code from the customer to confirm they received the order:'
        )
        if (code == null) return
        deliveryOtp = code.trim()
        if (!deliveryOtp) {
          alert('Delivery OTP is required to mark as delivered.')
          return
        }
      }

      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(deliveryOtp ? { deliveryOtp } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        fetchOrders()
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(data)
        }
      } else {
        alert(data.error || 'Failed to update status')
        fetchOrders()
      }
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order status')
    }
  }

  const updatePaymentStatus = async (orderId: string, paymentStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus })
      })
      if (res.ok) {
        fetchOrders()
        if (selectedOrder?.id === orderId) {
          const updated = await res.json()
          setSelectedOrder(updated)
        }
      }
    } catch (error) {
      console.error('Error updating payment status:', error)
    }
  }

  const updateEstimatedTime = async (orderId: string) => {
    const etaMinutes = toEstimatedTimeMinutes(estimatedTimeDraft, estimatedTimeUnit)
    if (!Number.isFinite(etaMinutes) || etaMinutes < 0) {
      alert('Estimated time must be a non-negative number')
      return
    }

    try {
      setSavingEstimatedTime(true)
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedTime: etaMinutes }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update estimated time')
      }

      const updated = await res.json()
      setSelectedOrder(updated)
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, estimatedTime: updated.estimatedTime } : order)))
    } catch (error: any) {
      console.error('Error updating estimated time:', error)
      alert(error?.message || 'Failed to update estimated time')
    } finally {
      setSavingEstimatedTime(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      ACCEPTED: 'bg-blue-100 text-blue-700',
      PREPARING: 'bg-purple-100 text-purple-700',
      READY: 'bg-cyan-100 text-cyan-700',
      OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
      DELIVERED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700',
      COMPLETED: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-700',
      REFUNDED: 'bg-gray-100 text-gray-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink">Orders</h1>
        <p className="text-ink/55 mt-1">
          Manage customer orders and deliveries
          {selectedStoreName ? (
            <>
              {' '}
              for <span className="font-semibold text-ink">{selectedStoreName}</span>
            </>
          ) : null}
        </p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by order number, customer name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 md:px-4 md:py-3 border border-wine/15 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink text-sm"
        />
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-[22px] border border-wine/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink/55">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-ink/55">
            No orders found for {selectedStoreName || 'this store'}.
            <div className="mt-2 text-sm text-ink/45">
              Unpaid online checkouts are hidden until payment completes. Switch stores in the header if needed.
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead className="bg-cream-deep/50 border-b border-wine/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Order</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Store</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Delivery</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wine/10">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-cream/60">
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">
                        {order.orderNumber}
                        {order.isWholesale && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-wine bg-wine/10 px-1.5 py-0.5 rounded">
                            B2B
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink/55">{new Date(order.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-wine/10 px-2 py-1 text-xs font-semibold text-wine">
                        {order.store.name}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">{order.user.name}</div>
                      <div className="text-xs text-ink/55">{order.user.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      {order.address ? (
                        <div className="max-w-[200px]">
                          <div className="font-medium text-ink text-sm truncate">📍 {order.address.city}</div>
                          <div className="text-xs text-ink/55 truncate">{order.address.street}</div>
                        </div>
                      ) : (
                        <span className="text-ink/40 text-sm">No address</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-ink">{formatPriceNoDecimals(order.total || 0)}</div>
                      <div className="text-xs text-ink/55">{order.items.length} items</div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg font-medium cursor-pointer ${getStatusColor(order.status)}`}
                      >
                        {STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={order.paymentStatus}
                        onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg font-medium cursor-pointer ${getStatusColor(order.paymentStatus)}`}
                      >
                        {PAYMENT_STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-ink">{new Date(order.deliveryDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-wine hover:text-wine-deep text-sm font-semibold"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="md:hidden divide-y divide-wine/10">
              {filteredOrders.map((order) => (
                <button
                  key={`${order.id}-mobile`}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left p-4 hover:bg-cream/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-ink">{order.orderNumber}</div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink/55">
                    <span>{order.user.name} · {order.store.name}</span>
                    <span>{formatPriceNoDecimals(order.total || 0)}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink/55 truncate">
                    {order.address ? `${order.address.city} • ${order.address.street}` : 'No address'}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[22px] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-wine/10 p-6 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">Order Details</h2>
                <p className="text-ink/55">{selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-ink/40 hover:text-ink text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="font-display font-semibold text-ink mb-2">Customer Information</h3>
                <div className="bg-cream rounded-xl p-4 space-y-1">
                  <p className="text-ink"><span className="font-medium">Name:</span> {selectedOrder.user.name}</p>
                  <p className="text-ink"><span className="font-medium">Email:</span> {selectedOrder.user.email}</p>
                  {selectedOrder.user.phone && (
                    <p className="text-ink"><span className="font-medium">Phone:</span> {selectedOrder.user.phone}</p>
                  )}
                </div>
              </div>

              {/* Pickup Location with Map */}
              {selectedOrder.fulfillmentType === 'PICKUP' && (
                <div>
                  <h3 className="font-display font-semibold text-ink mb-2">Pickup Location</h3>
                  <div className="bg-cream rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">🏪</div>
                      <div className="flex-1">
                        <p className="font-medium text-ink">
                          {selectedOrder.pickupAddress || 'Pickup point'}
                        </p>
                        <p className="text-ink/55 text-sm">
                          Customer collects this order — no delivery required.
                        </p>
                      </div>
                    </div>
                    {Number.isFinite(Number(selectedOrder.pickupLatitude)) &&
                    Number.isFinite(Number(selectedOrder.pickupLongitude)) ? (
                      <div className="mt-3 rounded-xl overflow-hidden border border-wine/10">
                        <iframe
                          width="100%"
                          height="200"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps?q=${selectedOrder.pickupLatitude},${selectedOrder.pickupLongitude}&z=16&output=embed`}
                        />
                        <div className="border-t border-wine/10 bg-white p-2">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedOrder.pickupLatitude},${selectedOrder.pickupLongitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl border border-wine/15 px-3 py-2 text-center text-xs font-semibold text-ink/70 hover:bg-cream"
                          >
                            📍 Open Map
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-wine/15 px-4 py-3 text-xs text-ink/55">
                        No map coordinates saved for this pickup point.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery Address with Map */}
              {selectedOrder.address && (
                <div>
                  <h3 className="font-display font-semibold text-ink mb-2">Delivery Address</h3>
                  <div className="bg-cream rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-2xl">📍</div>
                      <div className="flex-1">
                        <p className="font-medium text-ink">{selectedOrder.address.label}</p>
                        <p className="text-ink/70">{selectedOrder.address.street}</p>
                        {selectedOrder.address.apartment && (
                          <p className="text-ink/55 text-sm">Apt: {selectedOrder.address.apartment}</p>
                        )}
                        {selectedOrder.address.landmark && (
                          <p className="text-ink/55 text-sm">Landmark: {selectedOrder.address.landmark}</p>
                        )}
                        <p className="text-ink/70">
                          {selectedOrder.address.city}, {selectedOrder.address.state} - {selectedOrder.address.pincode}
                        </p>
                      </div>
                    </div>
                    {/* Google Maps Embed */}
                    {hasSelectedOrderCoords ? (
                      <div className="mt-3 rounded-xl overflow-hidden border border-wine/10">
                        <iframe
                          width="100%"
                          height="200"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps?q=${selectedOrder.address.latitude},${selectedOrder.address.longitude}&z=15&output=embed`}
                        />
                        <div className="grid grid-cols-2 gap-2 border-t border-wine/10 bg-white p-2">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedOrder.address.latitude},${selectedOrder.address.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-wine/15 px-3 py-2 text-center text-xs font-semibold text-ink/70 hover:bg-cream"
                          >
                            📍 Open Map
                          </a>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedOrder.address.latitude},${selectedOrder.address.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl bg-wine px-3 py-2 text-center text-xs font-semibold text-white hover:bg-wine-deep"
                          >
                            🧭 Directions
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-wine/15 px-4 py-3 text-xs text-ink/55">
                        No map coordinates saved for this address.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Gift Details */}
              <div>
                <h3 className="font-display font-semibold text-ink mb-2">Gift Details</h3>
                <div className="bg-cream rounded-xl p-4 space-y-2">
                  <p className="text-ink">
                    <span className="font-medium">Order Type:</span>{' '}
                    {selectedOrder.isWholesale
                      ? `Wholesale (B2B)${selectedOrder.businessName ? ` · ${selectedOrder.businessName}` : ''}`
                      : selectedOrder.isGift
                        ? 'Gift'
                        : 'Direct'}
                  </p>
                  <p className="text-ink">
                    <span className="font-medium">Fulfillment:</span>{' '}
                    {selectedOrder.fulfillmentType === 'PICKUP' ? 'Pickup (customer collects)' : 'Delivery'}
                  </p>

                  {selectedOrder.isGift ? (
                    <>
                      {selectedOrder.recipient ? (
                        <p className="text-ink">
                          <span className="font-medium">Recipient:</span> {selectedOrder.recipient.name}
                          {selectedOrder.recipient.relationship ? ` (${selectedOrder.recipient.relationship})` : ''}
                          {selectedOrder.recipient.phone ? ` - ${selectedOrder.recipient.phone}` : ''}
                        </p>
                      ) : (
                        <p className="text-ink/55 text-sm">Recipient not selected</p>
                      )}

                      {selectedOrder.occasion ? (
                        <p className="text-ink">
                          <span className="font-medium">Occasion:</span> {selectedOrder.occasion.emoji}{' '}
                          {selectedOrder.occasion.name}
                        </p>
                      ) : null}

                      {selectedOrder.giftWrap ? (
                        <p className="text-ink">
                          <span className="font-medium">Gift Wrap:</span> {selectedOrder.giftWrap.image}{' '}
                          {selectedOrder.giftWrap.name}
                          {selectedOrder.giftWrap.type ? ` (${selectedOrder.giftWrap.type})` : ''} -{' '}
                          {formatPriceNoDecimals(selectedOrder.giftWrap.price || 0)}
                        </p>
                      ) : (
                        <p className="text-ink/55 text-sm">Gift wrap not selected</p>
                      )}

                      {selectedOrder.greetingMessage ? (
                        <p className="text-ink">
                          <span className="font-medium">Message:</span> {selectedOrder.greetingMessage}
                        </p>
                      ) : null}

                      {selectedOrder.showSenderName !== false && selectedOrder.senderName ? (
                        <p className="text-ink">
                          <span className="font-medium">Sender Name:</span> {selectedOrder.senderName}
                        </p>
                      ) : (
                        <p className="text-ink/55 text-sm">Sender name hidden</p>
                      )}
                    </>
                  ) : (
                    <p className="text-ink/55 text-sm">Customer placed a normal (non-gift) order.</p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-display font-semibold text-ink mb-2">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 bg-cream rounded-xl p-3">
                      <div className="text-2xl">🎁</div>
                      <div className="flex-1">
                        <p className="font-medium text-ink">{item.product.name}</p>
                        <p className="text-sm text-ink/55">Qty: {item.quantity} × Rs. {item.price.toFixed(2)}</p>
                      </div>
                      <p className="font-semibold text-ink">Rs. {(item.quantity * item.price).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t border-wine/10 pt-4">
                <div className="mb-4 rounded-xl border border-gold/30 bg-gold-soft/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                    Estimated Delivery Time
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step={estimatedTimeUnit === 'days' ? '0.5' : '1'}
                      value={estimatedTimeDraft}
                      onChange={(event) => setEstimatedTimeDraft(event.target.value)}
                      className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    />
                    <select
                      value={estimatedTimeUnit}
                      onChange={(event) => handleEstimatedTimeUnitChange(event.target.value as EstimatedTimeUnit)}
                      className="rounded-xl border border-wine/15 bg-white px-3 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="days">Days</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => updateEstimatedTime(selectedOrder.id)}
                      disabled={savingEstimatedTime}
                      className="rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white hover:bg-wine-deep disabled:opacity-60"
                    >
                      {savingEstimatedTime ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-ink/55">
                    Customer view: {Number(selectedOrder.estimatedTime) > 0 ? formatTime(Number(selectedOrder.estimatedTime) || 0) : 'Not set yet'}
                  </p>
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-ink/55">Delivery Date:</span>
                  <span className="text-ink">{new Date(selectedOrder.deliveryDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-ink/55">Order Status:</span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                {(selectedOrder.status === 'OUT_FOR_DELIVERY' || selectedOrder.status === 'READY') &&
                selectedOrder.deliveryOtp ? (
                  <div className="mb-3 rounded-xl border border-gold/30 bg-gold-soft/30 px-3 py-2 text-sm">
                    <span className="text-ink/55">Customer delivery code: </span>
                    <span className="font-mono text-lg font-bold tracking-widest text-wine">
                      {selectedOrder.deliveryOtp}
                    </span>
                    <p className="mt-1 text-xs text-ink/45">
                      Ask the customer for this code before marking Delivered.
                    </p>
                  </div>
                ) : null}
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium text-ink/55">Payment Status:</span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(selectedOrder.paymentStatus)}`}>
                    {selectedOrder.paymentStatus}
                  </span>
                </div>
                {selectedOrder.giftWrap ? (
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-ink/55">Gift Wrap:</span>
                    <span className="text-ink">{formatPriceNoDecimals(selectedOrder.giftWrap.price || 0)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center text-lg font-bold border-t border-wine/10 pt-4">
                  <span className="text-ink">Total Amount:</span>
                  <span className="text-wine">{formatPriceNoDecimals(selectedOrder.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
