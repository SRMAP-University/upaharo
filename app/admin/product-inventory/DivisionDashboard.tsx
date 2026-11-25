'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, Kpi, presets, rs } from '@/app/admin/inventory/shared'
import { divisionLabel, type Division } from '@/lib/divisions'

/**
 * Product Inventory → Dashboard for Upaharo Gifts or Upaharo Cakes: sales,
 * orders and profit split online / offline, sales by day, best sellers and
 * stock alerts. Uses the same numbers as Sales & profit and Items.
 */

// Validated pair (lightness, colour-blind separation, contrast): online / offline.
const ONLINE = '#B03F66'
const OFFLINE = '#B8860B'

type Bucket = { key: string; orders: number; netSales: number; profit: number; uncostedSales: number; itemSales: number; discounts: number; cost: number; deliveryFees: number }
type Report = {
  groupBy: 'day' | 'month'
  totals: Bucket
  buckets: Bucket[]
  topBySales: Array<{ id: string; name: string; quantity: number; sales: number; profit: number | null }>
}
type Summary = { products: number; tracked: number; inStock: number; lowStock: number; outOfStock: number; withoutPurchasePrice: number; stockValueAtCost: number; stockValueAtSale: number }

const PERIODS = ['today', '7d', 'month', 'lastMonth', '3m', 'year']

function share(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function bucketLabel(key: string, groupBy: 'day' | 'month', long = false) {
  if (groupBy === 'month') {
    return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(long ? { weekday: 'short' } : {}), timeZone: 'UTC' })
}

function ChannelCard({ title, color, bucket, total }: { title: string; color: string; bucket?: Bucket; total: number }) {
  const sales = bucket?.netSales || 0
  const orders = bucket?.orders || 0
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
          {title}
        </p>
        <span className="text-xs text-ink/50">{share(sales, total)}% of sales</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{rs(sales)}</p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-ink/50">Orders</dt>
          <dd className="font-semibold tabular-nums text-ink">{orders}</dd>
        </div>
        <div>
          <dt className="text-ink/50">Average</dt>
          <dd className="font-semibold tabular-nums text-ink">{orders ? rs(sales / orders) : '—'}</dd>
        </div>
        <div>
          <dt className="text-ink/50">Profit</dt>
          <dd className="font-semibold tabular-nums text-ink">{rs(bucket?.profit || 0)}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Net sales per day (or month), online and offline stacked, with a tooltip. */
function SalesChart({ online, offline, groupBy }: { online: Bucket[]; offline: Bucket[]; groupBy: 'day' | 'month' }) {
  const [hover, setHover] = useState<number | null>(null)
  const rows = online.map((b, i) => ({ key: b.key, online: b.netSales, offline: offline[i]?.netSales || 0 }))
  const max = Math.max(1, ...rows.map((r) => r.online + r.offline))
  const H = 180
  const every = Math.ceil(rows.length / 7)
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-ink/70">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ONLINE }} aria-hidden /> Online
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: OFFLINE }} aria-hidden /> Offline
        </span>
      </div>
      <div className="relative">
        <div className="flex h-[180px] items-end gap-[2px] border-b border-stone-300" role="img" aria-label="Sales per period, online and offline">
          {rows.map((row, i) => {
            const onH = (row.online / max) * H
            const offH = (row.offline / max) * H
            return (
              <button
                key={row.key}
                type="button"
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
                aria-label={`${bucketLabel(row.key, groupBy, true)}: online ${rs(row.online)}, offline ${rs(row.offline)}`}
              >
                <span className="mx-auto flex w-full max-w-[24px] flex-col justify-end" style={{ opacity: hover === null || hover === i ? 1 : 0.5 }}>
                  {offH > 0 ? (
                    <span className="block rounded-t-[4px]" style={{ height: offH, backgroundColor: OFFLINE, marginBottom: onH > 0 ? 2 : 0 }} />
                  ) : null}
                  {onH > 0 ? (
                    <span className={`block ${offH > 0 ? '' : 'rounded-t-[4px]'}`} style={{ height: onH, backgroundColor: ONLINE }} />
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex gap-[2px] text-[10px] text-ink/50">
          {rows.map((row, i) => (
            <span key={row.key} className="min-w-0 flex-1 whitespace-nowrap text-center">
              {i % every === 0 ? bucketLabel(row.key, groupBy) : ''}
            </span>
          ))}
        </div>
        {hover !== null && rows[hover] ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${Math.min(Math.max(((hover + 0.5) / rows.length) * 100, 15), 85)}%` }}
          >
            <p className="text-white/60">{bucketLabel(rows[hover].key, groupBy, true)}</p>
            <p>
              Online <span className="font-semibold">{rs(rows[hover].online)}</span> · Offline{' '}
              <span className="font-semibold">{rs(rows[hover].offline)}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function DivisionDashboard({
  division,
  onLocked,
  onOpen,
}: {
  division: Division
  onLocked: () => void
  onOpen: (tab: 'stock' | 'orders' | 'report') => void
}) {
  const options = useMemo(() => presets().filter((p) => PERIODS.includes(p.id)), [])
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState<{ online: Report; offline: Report; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const chosen = options.find((p) => p.id === period) || options[0]
    const days = Math.round((Date.parse(chosen.to) - Date.parse(chosen.from)) / 86_400_000) + 1
    const groupBy = days > 62 ? 'month' : 'day'
    const report = (source: 'online' | 'offline') =>
      api<Report>(`/api/admin/inventory/report?from=${chosen.from}&to=${chosen.to}&groupBy=${groupBy}&source=${source}&division=${division}`)
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      report('online'),
      report('offline'),
      api<{ summary: Summary }>(`/api/admin/inventory/products?division=${division}&perPage=20`),
    ])
      .then(([online, offline, stock]) => !cancelled && setData({ online, offline, summary: stock.summary }))
      .catch((err) => {
        if (cancelled) return
        if ((err as { locked?: boolean }).locked) onLocked()
        else setError((err as Error).message)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [period, division, options, onLocked])

  const on = data?.online.totals
  const off = data?.offline.totals
  const sales = (on?.netSales || 0) + (off?.netSales || 0)
  const orders = (on?.orders || 0) + (off?.orders || 0)
  const profit = (on?.profit || 0) + (off?.profit || 0)
  const uncosted = (on?.uncostedSales || 0) + (off?.uncostedSales || 0)
  const s = data?.summary

  const best = useMemo(() => {
    const map = new Map<string, { id: string; name: string; quantity: number; sales: number }>()
    for (const row of [...(data?.online.topBySales || []), ...(data?.offline.topBySales || [])]) {
      const entry = map.get(row.id) || { id: row.id, name: row.name, quantity: 0, sales: 0 }
      entry.quantity += row.quantity
      entry.sales += row.sales
      map.set(row.id, entry)
    }
    return [...map.values()].sort((a, b) => b.sales - a.sales).slice(0, 8)
  }, [data])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPeriod(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              period === option.id ? 'bg-wine text-white' : 'bg-white text-ink/70 ring-1 ring-stone-200 hover:ring-stone-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sales" value={rs(sales)} hint={`${divisionLabel(division)}, after discounts`} loading={loading && !data} />
        <Kpi label="Orders" value={String(orders)} hint={orders ? `Average ${rs(sales / orders)}` : 'No orders yet'} loading={loading && !data} />
        <Kpi
          label="Profit"
          value={rs(profit)}
          hint={uncosted > 0 ? `${rs(uncosted)} of sales has no purchase price` : 'Sales less purchase & packing'}
          loading={loading && !data}
        />
        <Kpi
          label="Stock value"
          value={rs(s?.stockValueAtCost || 0)}
          hint={`${rs(s?.stockValueAtSale || 0)} at selling price`}
          loading={loading && !data}
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Online and offline</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChannelCard title="Online (website & app)" color={ONLINE} bucket={on} total={sales} />
          <ChannelCard title="Offline (shop & phone orders)" color={OFFLINE} bucket={off} total={sales} />
        </div>
        {sales > 0 ? (
          <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
            <span style={{ width: `${share(on?.netSales || 0, sales)}%`, backgroundColor: ONLINE }} />
            <span style={{ width: `${share(off?.netSales || 0, sales)}%`, backgroundColor: OFFLINE }} />
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Sales by {data?.online.groupBy === 'month' ? 'month' : 'day'}</h2>
            <button type="button" onClick={() => onOpen('report')} className="text-xs font-semibold text-wine">
              Full sales & profit →
            </button>
          </div>
          {data ? (
            <SalesChart online={data.online.buckets} offline={data.offline.buckets} groupBy={data.online.groupBy} />
          ) : (
            <div className="h-[200px] animate-pulse rounded-lg bg-stone-100" />
          )}
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Best sellers</h2>
          {best.length ? (
            <ol className="space-y-2">
              {best.map((row, i) => (
                <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-ink/40 tabular-nums">{i + 1}</span>
                    {row.name}
                  </span>
                  <span className="flex-shrink-0 tabular-nums text-ink/70">
                    {row.quantity} sold · <span className="font-semibold text-ink">{rs(row.sales)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink/50">No sales in this period.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Items in {divisionLabel(division)}</h2>
          <button type="button" onClick={() => onOpen('stock')} className="text-xs font-semibold text-wine">
            All items →
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Products', s?.products ?? 0, ''],
            ['In stock', s?.inStock ?? 0, ''],
            ['Low stock', s?.lowStock ?? 0, (s?.lowStock ?? 0) > 0 ? 'text-amber-700' : ''],
            ['Out of stock', s?.outOfStock ?? 0, (s?.outOfStock ?? 0) > 0 ? 'text-red-600' : ''],
            ['No purchase price', s?.withoutPurchasePrice ?? 0, ''],
          ].map(([label, value, tone]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => onOpen('stock')}
              className="rounded-lg bg-stone-50 p-3 text-left hover:bg-stone-100"
            >
              <p className="text-xs text-ink/55">{label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${tone || 'text-ink'}`}>{value}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
