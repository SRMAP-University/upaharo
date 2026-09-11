'use client'

import { useState, useEffect } from 'react'

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
    image: string
  }
}

interface Order {
  id: string
  orderNumber: string
  status: string
  source?: 'UPAHARO' | 'OFFLINE'
  offlineChannel?: string | null
  total: number
  placedAt: string
  deliveredAt: string | null
  user: {
    name: string
    email: string
  }
  address: {
    street: string
    city: string
    state: string
    pincode: string
  } | null
  items: OrderItem[]
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/seller/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-amber-50 text-amber-800',
      ACCEPTED: 'bg-blue-50 text-blue-800',
      PREPARING: 'bg-blue-50 text-blue-800',
      READY: 'bg-blue-50 text-blue-800',
      OUT_FOR_DELIVERY: 'bg-blue-50 text-blue-800',
      DELIVERED: 'bg-green-50 text-green-800',
      CANCELLED: 'bg-red-50 text-red-800',
    }
    return colors[status] || 'bg-rose-soft text-wine'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NP', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(order => order.status === filter)

  return (
    <div className="px-4 py-4 md:py-6">
      <div className="mb-6">
        <h1 className="font-display text-xl md:text-2xl font-semibold text-ink">Orders</h1>
        <p className="text-ink/55 text-sm">View orders containing your products</p>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-wine text-white'
              : 'bg-white text-ink/70 hover:bg-cream border border-wine/15'
          }`}
        >
          All ({orders.length})
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-colors ${
            filter === 'PENDING'
              ? 'bg-wine text-white'
              : 'bg-white text-ink/70 hover:bg-cream border border-wine/15'
          }`}
        >
          Pending ({orders.filter(o => o.status === 'PENDING').length})
        </button>
        <button
          onClick={() => setFilter('PREPARING')}
          className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-colors ${
            filter === 'PREPARING'
              ? 'bg-wine text-white'
              : 'bg-white text-ink/70 hover:bg-cream border border-wine/15'
          }`}
        >
          Preparing ({orders.filter(o => o.status === 'PREPARING').length})
        </button>
        <button
          onClick={() => setFilter('DELIVERED')}
          className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-colors ${
            filter === 'DELIVERED'
              ? 'bg-wine text-white'
              : 'bg-white text-ink/70 hover:bg-cream border border-wine/15'
          }`}
        >
          Delivered ({orders.filter(o => o.status === 'DELIVERED').length})
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-wine/10 rounded-[22px] shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="font-display text-lg font-medium text-ink mb-2">No orders found</h3>
          <p className="text-ink/55">
            {filter === 'all' 
              ? "You don't have any orders yet." 
              : `No ${filter.toLowerCase()} orders.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border border-wine/10 rounded-[22px] shadow-sm overflow-hidden">
              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-4">
                  <div>
                    <h3 className="font-display text-base md:text-lg font-semibold text-ink">
                      #{order.orderNumber}
                      {order.source === 'OFFLINE' ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-blush">
                          Offline
                        </span>
                      ) : null}
                    </h3>
                    <p className="text-xs md:text-sm text-ink/55">
                      {formatDate(order.placedAt)}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold self-start ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="border-t border-wine/10 pt-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-ink/55 text-xs mb-1">Customer</p>
                      <p className="font-medium text-ink">{order.user.name}</p>
                      <p className="text-ink/55 text-xs">{order.user.email}</p>
                    </div>
                    {order.address && (
                      <div>
                        <p className="text-ink/55 text-xs mb-1">Delivery Address</p>
                        <p className="font-medium text-ink text-sm">
                          {order.address.street}
                        </p>
                        <p className="text-ink/55 text-xs">
                          {order.address.city}, {order.address.state} - {order.address.pincode}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-wine/10 pt-4">
                  <p className="text-sm font-medium text-ink mb-3">Your Products</p>
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="h-12 w-12 md:h-14 md:w-14 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-ink/55">
                            Qty: {item.quantity} × Rs. {item.price}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-ink">
                            Rs. {(item.quantity * item.price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
