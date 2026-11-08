'use client'

/**
 * Side panel behind a dashboard number: the orders (with their products),
 * the products sold, or the customers, for the chosen period.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceNoDecimals } from '@/lib/utils'

export type DetailKind = 'orders' | 'delivered' | 'cancelled' | 'products' | 'customers'
export type DetailRequest = { kind: DetailKind; title: string; from: string | null; to: string | null; periodLabel: string }

type OrderRow = {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  source: string
  total: number
  paymentStatus: string
  cancelReason: string | null
  customer: string
  phone: string | null
  items: Array<{ productId: string; name: string; image: string; quantity: number; price: number }>
}
type ProductRow = { id: string; name: string; image: string; isAvailable: boolean; quantity: number; orders: number; sales: number }
type CustomerRow = { id: string; name: string; email: string; phone: string | null; orders: number; spent: number; lastOrderAt: string }
type Page = {
  total: number
  amount: number
  units?: number
  totalPages: number
  orders?: OrderRow[]
  products?: ProductRow[]
  customers?: CustomerRow[]
}

const rs = (n: number) => formatPriceNoDecimals(Math.round(n))
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
const statusText = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')
const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800',
  ACCEPTED: 'bg-blue-50 text-blue-800',
  PREPARING: 'bg-violet-50 text-violet-800',
  READY: 'bg-indigo-50 text-indigo-800',
  OUT_FOR_DELIVERY: 'bg-sky-50 text-sky-800',
  DELIVERED: 'bg-emerald-50 text-emerald-800',
  CANCELLED: 'bg-red-50 text-red-700',
}

function Thumb({ src, size = 'h-9 w-9' }: { src: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolveImageUrl(src)} alt="" className={`${size} shrink-0 rounded-md bg-stone-100 object-cover`} />
  ) : (
    <span className={`${size} shrink-0 rounded-md bg-stone-100`} />
  )
}

export default function DashboardDetails({ request, onClose }: { request: DetailRequest; onClose: () => void }) {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (page: number) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ kind: request.kind, page: String(page) })
      if (request.from) params.set('from', request.from)
      if (request.to) params.set('to', request.to)
      const res = await fetch(`/api/admin/stats/details?${params}`, { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not load')
      setPages((prev) => (page === 1 ? [data] : [...prev, data]))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPages([])
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.kind, request.from, request.to])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const first = pages[0]
  const orders = pages.flatMap((p) => p.orders || [])
  const products = pages.flatMap((p) => p.products || [])
  const customers = pages.flatMap((p) => p.customers || [])
  const more = first && pages.length < first.totalPages

  const summary = !first
    ? ''
    : request.kind === 'products'
      ? `${first.total} ${first.total === 1 ? 'product' : 'products'} · ${first.units ?? 0} items · ${rs(first.amount)} at item prices`
      : request.kind === 'customers'
        ? `${first.total} ${first.total === 1 ? 'customer' : 'customers'} · ${rs(first.amount)} spent`
        : `${first.total} ${first.total === 1 ? 'order' : 'orders'} · ${rs(first.amount)}`

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex justify-end bg-ink/40" role="dialog" aria-modal="true" aria-labelledby="details-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div className="min-w-0">
            <h2 id="details-title" className="text-base font-semibold text-ink">
              {request.title}
            </h2>
            <p className="text-xs text-ink/55">
              {request.periodLabel}
              {summary ? ` · ${summary}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 text-2xl leading-none text-ink/40 hover:text-ink" aria-label="Close">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {!loading && first && first.total === 0 ? <p className="py-10 text-center text-sm text-ink/50">Nothing in this period.</p> : null}

          {orders.length ? (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.id} className="rounded-xl border border-stone-200">
                  <Link href={`/admin/orders?order=${o.id}`} className="flex items-start justify-between gap-3 rounded-t-xl px-3 py-2.5 hover:bg-stone-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {o.orderNumber}
                        {o.source === 'OFFLINE' ? <span className="ml-1.5 text-[10px] font-bold uppercase text-blush">Offline</span> : null}
                      </span>
                      <span className="block truncate text-xs text-ink/55">
                        {when(o.createdAt)}
                        {o.customer ? ` · ${o.customer}` : ''}
                        {o.phone ? ` · ${o.phone}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums text-ink">{rs(o.total)}</span>
                      <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[o.status] || 'bg-stone-100 text-ink/60'}`}>
                        {statusText(o.status)}
                      </span>
                    </span>
                  </Link>
                  {o.status === 'CANCELLED' && o.cancelReason ? <p className="px-3 text-xs text-red-700">Reason: {o.cancelReason}</p> : null}
                  <ul className="divide-y divide-stone-100 border-t border-stone-100">
                    {o.items.map((i, index) => (
                      <li key={`${i.productId}-${index}`}>
                        <Link href={`/admin/products/${i.productId}`} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-stone-50">
                          <Thumb src={i.image} />
                          <span className="min-w-0 flex-1 truncate text-ink/80">
                            {i.quantity} × {i.name}
                          </span>
                          <span className="tabular-nums text-ink/60">{rs(i.quantity * i.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}

          {products.length ? (
            <ul className="divide-y divide-stone-100">
              {products.map((p, index) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-stone-50">
                    <span className="w-5 text-right text-xs text-ink/40">{index + 1}</span>
                    <Thumb src={p.image} size="h-10 w-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                      <span className="block text-xs text-ink/50">
                        {p.quantity} sold · in {p.orders} {p.orders === 1 ? 'order' : 'orders'}
                        {p.isAvailable ? '' : ' · not on sale'}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-ink">{rs(p.sales)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {customers.length ? (
            <ul className="divide-y divide-stone-100">
              {customers.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/users?search=${encodeURIComponent(c.email || c.name)}`} className="flex items-center gap-3 py-2.5 hover:bg-stone-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine/10 text-sm font-semibold text-wine">
                      {(c.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                      <span className="block truncate text-xs text-ink/50">
                        {c.phone || c.email} · {c.orders} {c.orders === 1 ? 'order' : 'orders'} · last {when(c.lastOrderAt)}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-ink">{rs(c.spent)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {loading ? <p className="py-6 text-center text-sm text-ink/50">Loading…</p> : null}
          {more && !loading ? (
            <button
              type="button"
              onClick={() => void load(pages.length + 1)}
              className="mt-3 w-full rounded-lg border border-stone-200 py-2 text-sm font-medium text-ink/70 hover:bg-stone-50"
            >
              Show more
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
