'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import B2BHeader from '@/components/b2b/B2BHeader'
import { useB2BCartStore } from '@/lib/store/b2b-cart'
import { useB2BBusinessStore } from '@/lib/store/b2b-business'
import { formatPrice } from '@/lib/utils'

export default function B2BCheckoutPage() {
  const router = useRouter()
  const items = useB2BCartStore((s) => s.items)
  const clearCart = useB2BCartStore((s) => s.clearCart)
  const getTotalPrice = useB2BCartStore((s) => s.getTotalPrice)
  const session = useB2BBusinessStore((s) => s.session)

  const [mounted, setMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    if (items.length === 0) {
      router.replace('/b2b/cart')
      return
    }
    if (!session?.token || !session.shopName) {
      router.replace('/b2b/register?next=/b2b/checkout')
    }
  }, [mounted, items.length, session, router])

  const subtotal = mounted ? getTotalPrice() : 0
  const addr = session?.address

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!session?.token) {
      router.push('/b2b/register?next=/b2b/checkout')
      return
    }
    if (!addr) {
      setError('Shop address missing. Please register again or update location.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/b2b/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          notes,
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Order failed')

      clearCart()
      router.push(`/b2b/success?order=${encodeURIComponent(data.order.orderNumber)}&id=${data.order.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted || !session?.shopName) {
    return (
      <>
        <B2BHeader />
        <div className="p-10 text-center text-ink/40">Loading…</div>
      </>
    )
  }

  return (
    <>
      <B2BHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-20">
        <h1 className="font-display text-2xl font-semibold text-ink">Wholesale checkout</h1>
        <p className="mt-1 text-sm text-ink/50">
          Order as {session.shopName} — our team will confirm delivery & payment
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <section className="rounded-2xl border border-wine/10 bg-white p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Registered shop</h2>
              <Link href="/b2b/login?next=/b2b/checkout" className="text-xs font-semibold text-wine">
                Switch account
              </Link>
            </div>
            <p className="font-display text-lg font-semibold text-wine">{session.shopName}</p>
            <p className="text-sm text-ink/70">{session.user.name}</p>
            <p className="text-xs text-ink/45">
              {session.user.phone} · {session.user.email}
            </p>
          </section>

          <section className="rounded-2xl border border-wine/10 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-ink">Delivery location</h2>
            {addr ? (
              <>
                <p className="text-sm text-ink">
                  {[addr.street, addr.apartment, addr.landmark].filter(Boolean).join(', ')}
                </p>
                <p className="text-xs text-ink/50">
                  {addr.city}, {addr.state} {addr.pincode}
                </p>
              </>
            ) : (
              <p className="text-sm text-red-600">No shop address on file.</p>
            )}
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-semibold text-ink/55">Order notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Preferred delivery date, MOQ notes, etc."
                className="w-full rounded-xl border border-wine/15 bg-[#F7F2EE]/50 px-3 py-2.5 text-sm outline-none focus:border-wine"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-wine/10 bg-white p-4">
            <div className="flex justify-between text-sm">
              <span className="text-ink/55">{items.length} line item(s)</span>
              <span className="font-semibold text-ink">{formatPrice(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs text-ink/40">
              Payment: cash / invoice on confirmation. Separate from retail checkout.
            </p>
          </section>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Link
              href="/b2b/cart"
              className="flex-1 rounded-full border border-wine/20 py-3 text-center text-sm font-semibold text-wine"
            >
              Back to cart
            </Link>
            <button
              type="submit"
              disabled={submitting || items.length === 0 || !addr}
              className="flex-1 rounded-full bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-deep disabled:opacity-50"
            >
              {submitting ? 'Placing order…' : 'Place wholesale order'}
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
