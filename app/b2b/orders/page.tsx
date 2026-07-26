'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import B2BHeader from '@/components/b2b/B2BHeader'
import { useB2BBusinessStore } from '@/lib/store/b2b-business'
import { formatPrice } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/image-url'

type OrderRow = {
  id: string
  orderNumber: string
  status: string
  total: number
  businessName: string | null
  placedAt: string
  items: Array<{
    quantity: number
    price: number
    product: { name: string; image: string }
  }>
}

export default function B2BOrdersPage() {
  const session = useB2BBusinessStore((s) => s.session)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted || !session?.token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/b2b/orders', {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        if (!cancelled) setOrders(data.orders || [])
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message)
          setOrders([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mounted, session?.token])

  return (
    <>
      <B2BHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-20">
        <h1 className="font-display text-2xl font-semibold text-ink">Wholesale orders</h1>
        <p className="mt-1 text-sm text-ink/50">
          {session?.shopName
            ? `Orders for ${session.shopName}`
            : 'Log in to your business account to see wholesale orders.'}
        </p>

        {!mounted ? (
          <p className="mt-8 text-center text-sm text-ink/40">Loading…</p>
        ) : !session?.token ? (
          <div className="mt-8 rounded-2xl border border-wine/10 bg-white p-6 text-center">
            <p className="text-sm text-ink/60">Business login required</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/b2b/login?next=/b2b/orders"
                className="rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-white"
              >
                Log in
              </Link>
              <Link
                href="/b2b/register?next=/b2b/orders"
                className="rounded-full border border-wine/20 px-5 py-2.5 text-sm font-semibold text-wine"
              >
                Register shop
              </Link>
            </div>
          </div>
        ) : loading ? (
          <p className="mt-8 text-center text-sm text-ink/40">Loading orders…</p>
        ) : error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : orders.length === 0 ? (
          <p className="mt-8 text-center text-sm text-ink/45">No wholesale orders yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl border border-wine/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">#{order.orderNumber}</p>
                    <p className="text-xs text-ink/45">
                      {new Date(order.placedAt).toLocaleString()} · {order.status}
                    </p>
                  </div>
                  <p className="font-semibold text-wine">{formatPrice(order.total)}</p>
                </div>
                <ul className="mt-3 space-y-2">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm">
                      <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-cream">
                        <Image
                          src={resolveImageUrl(item.product.image)}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <span className="flex-1 text-ink/80">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span className="text-ink/55">{formatPrice(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
