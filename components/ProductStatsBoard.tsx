'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceNoDecimals } from '@/lib/utils'
import type { ProductStats, ProductStatsDay, ProductStatsRow } from '@/lib/product-stats'

/**
 * Product stats for admin (all products) and sellers (their own): totals,
 * the view → cart → order funnel, a daily chart, where products are opened
 * from, and every product's numbers in a sortable table.
 */

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

const count = (value: number) => Math.round(value).toLocaleString('en-IN')
const money = (value: number) => formatPriceNoDecimals(Math.round(value))
const percent = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%` : '—')

const SOURCE_LABEL: Record<string, string> = {
  home: 'Home page',
  category: 'Category pages',
  search: 'Search',
  product: 'Other product pages',
  cart: 'Cart & checkout',
  wishlist: 'Wishlist',
  other: 'Elsewhere',
}

type SortKey = 'views' | 'clicks' | 'addToCart' | 'wishlistNow' | 'orders' | 'units' | 'revenue' | 'cartRate' | 'orderRate' | 'name'

const COLUMNS: Array<{ key: SortKey; label: string; hint: string }> = [
  { key: 'views', label: 'Views', hint: 'Times the product page was seen (website and app)' },
  { key: 'clicks', label: 'Opens', hint: 'Opened from a list, banner or search on the website' },
  { key: 'addToCart', label: 'Cart adds', hint: 'Times added to cart on the website' },
  { key: 'wishlistNow', label: 'Wishlist', hint: 'Shoppers who have it in their wishlist now' },
  { key: 'orders', label: 'Orders', hint: 'Orders with this product (not cancelled)' },
  { key: 'units', label: 'Sold', hint: 'Units sold' },
  { key: 'revenue', label: 'Sales', hint: 'Sales amount for this product' },
  { key: 'cartRate', label: 'Cart rate', hint: 'Cart adds per 100 views' },
  { key: 'orderRate', label: 'Order rate', hint: 'Orders per 100 views' },
]

function sortValue(row: ProductStatsRow, key: SortKey) {
  if (key === 'cartRate') return row.views ? row.addToCart / row.views : -1
  if (key === 'orderRate') return row.views ? row.orders / row.views : -1
  if (key === 'name') return row.name.toLowerCase()
  return row[key]
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-[12px] font-medium text-ink/55">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight text-ink lg:text-[26px]">{value}</p>
      {note ? <p className="mt-0.5 text-[11.5px] text-ink/50">{note}</p> : null}
    </div>
  )
}

/** One horizontal bar per row, single hue, value at the tip. */
function Bars({ rows }: { rows: Array<{ label: string; value: number; note?: string }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-medium text-ink">{row.label}</span>
            <span className="text-ink/55">
              <span className="font-semibold text-ink">{count(row.value)}</span>
              {row.note ? <span className="ml-1.5">{row.note}</span> : null}
            </span>
          </div>
          <div className="h-3 rounded-full bg-stone-100">
            <div className="h-3 rounded-full bg-wine" style={{ width: `${Math.max(row.value > 0 ? 1.5 : 0, (row.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const TREND_METRICS: Array<{ key: keyof Omit<ProductStatsDay, 'date'>; label: string }> = [
  { key: 'views', label: 'Views' },
  { key: 'clicks', label: 'Opens' },
  { key: 'addToCart', label: 'Cart adds' },
  { key: 'orders', label: 'Orders' },
  { key: 'revenue', label: 'Sales' },
]

function niceMax(value: number) {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => (s * power) * 4 >= value) ?? 10
  return step * power * 4
}

function dayLabel(date: string, long = false) {
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(long ? { weekday: 'short' } : {}), timeZone: 'UTC' })
}

/** Daily columns for one measure, with a tooltip on hover or tap. */
function Trend({ daily }: { daily: ProductStatsDay[] }) {
  const [metric, setMetric] = useState<(typeof TREND_METRICS)[number]['key']>('views')
  const [hover, setHover] = useState<number | null>(null)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    if (!box) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))))
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  const values = daily.map((day) => day[metric])
  const top = niceMax(Math.max(0, ...values))
  const format = metric === 'revenue' ? money : count
  const W = width
  const H = width < 480 ? 190 : 240
  const left = 40
  const bottom = 22
  const plotW = W - left - 8
  const plotH = H - bottom - 10
  const slot = plotW / Math.max(1, daily.length)
  const barW = Math.min(24, Math.max(2, slot - 2))
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top]
  const labelEvery = Math.ceil(daily.length / (width < 480 ? 4 : 6))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Measure">
        {TREND_METRICS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={metric === item.key}
            onClick={() => setMetric(item.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              metric === item.key ? 'bg-wine text-white' : 'bg-stone-100 text-ink/70 hover:bg-stone-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="relative" ref={setBox}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={`${TREND_METRICS.find((m) => m.key === metric)?.label} per day`}>
          {ticks.map((tick) => {
            const y = 10 + plotH - (tick / top) * plotH
            return (
              <g key={tick}>
                <line x1={left} x2={W - 8} y1={y} y2={y} stroke="#E7E5E4" strokeWidth={1} />
                <text x={left - 6} y={y + 3.5} textAnchor="end" fontSize="11" fill="#78716C">
                  {metric === 'revenue' && tick >= 1000 ? `${Math.round(tick / 1000)}K` : count(tick)}
                </text>
              </g>
            )
          })}
          {daily.map((day, i) => {
            const value = day[metric]
            const h = (value / top) * plotH
            const x = left + i * slot + (slot - barW) / 2
            const y = 10 + plotH - h
            const r = Math.min(4, barW / 2, h)
            return (
              <g key={day.date}>
                {h > 0 ? (
                  <path
                    d={`M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + barW - r}Q${x + barW} ${y} ${x + barW} ${y + r}V${y + h}Z`}
                    className="fill-wine"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                ) : null}
                {i % labelEvery === 0 || i === daily.length - 1 ? (
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#78716C">
                    {dayLabel(day.date)}
                  </text>
                ) : null}
                {/* hit area: the whole day's column */}
                <rect
                  x={left + i * slot}
                  y={10}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            )
          })}
          <line x1={left} x2={W - 8} y1={10 + plotH} y2={10 + plotH} stroke="#D6D3D1" strokeWidth={1} />
        </svg>
        {hover !== null && daily[hover] ? (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-lg"
            style={{ left: Math.min(Math.max(left + hover * slot + slot / 2, 60), W - 60) }}
          >
            <span className="text-white/65">{dayLabel(daily[hover].date, true)}</span>{' '}
            <span className="font-semibold">{format(daily[hover][metric])}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ProductStatsBoard({ apiPath, title, intro }: { apiPath: string; title: string; intro: string }) {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'views', desc: true })
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiPath}?days=${days}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      setStats(await res.json())
    } catch {
      setError('Could not load the stats. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [apiPath, days])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = (stats?.products || []).filter(
      (row) => !needle || row.name.toLowerCase().includes(needle) || row.category.toLowerCase().includes(needle)
    )
    return list.sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      const order = av < bv ? -1 : av > bv ? 1 : 0
      return sort.desc ? -order : order
    })
  }, [stats, search, sort])

  // Looked at a lot, not bought: the products worth a better photo, price or description.
  const notBuying = useMemo(
    () =>
      (stats?.products || [])
        .filter((row) => row.views >= 10 && row.orders === 0)
        .sort((a, b) => b.views - a.views)
        .slice(0, 5),
    [stats]
  )

  const t = stats?.totals
  const rangeLabel = RANGES.find((range) => range.days === days)?.label.toLowerCase() || ''
  const countingFrom =
    stats?.eventsSince && new Date(stats.eventsSince) > new Date(stats.from)
      ? new Date(stats.eventsSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/55">{intro}</p>
        </div>
        <div className="flex rounded-full bg-stone-100 p-1" role="tablist" aria-label="Time range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              role="tab"
              aria-selected={days === range.days}
              onClick={() => setDays(range.days)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                days === range.days ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}{' '}
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      {loading && !stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      ) : t ? (
        <>
          <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
            <Tile label="Product views" value={count(t.views)} note={`${count(t.products)} products`} />
            <Tile label="Opened from lists" value={count(t.clicks)} note="Taps on product cards" />
            <Tile label="Added to cart" value={count(t.addToCart)} note={`${count(t.cartUnits)} items`} />
            <Tile label="In wishlists" value={count(t.wishlistNow)} note={`${count(t.wishlistAdded)} added ${rangeLabel === 'today' ? 'today' : `in ${rangeLabel}`}`} />
            <Tile label="Orders" value={count(t.orders)} note="Not cancelled" />
            <Tile label="Items sold" value={count(t.units)} />
            <Tile label="Sales" value={money(t.revenue)} />
            <Tile label="Views that became orders" value={percent(t.orders, t.views)} note={`${percent(t.addToCart, t.views)} added to cart`} />
          </div>

          {countingFrom ? (
            <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
              “Opened from lists” and “Added to cart” are counted from {countingFrom}. Views, wishlists and orders include earlier days.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="text-[15px] font-semibold text-ink">Day by day</h2>
              <p className="mb-4 text-[12.5px] text-ink/55">Nepal time. Tap a day to see its number.</p>
              <Trend daily={stats!.daily} />
            </section>
            <div className="space-y-4">
              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <h2 className="mb-4 text-[15px] font-semibold text-ink">From view to order</h2>
                <Bars
                  rows={[
                    { label: 'Viewed', value: t.views },
                    { label: 'Added to cart', value: t.addToCart, note: percent(t.addToCart, t.views) },
                    { label: 'Ordered', value: t.orders, note: percent(t.orders, t.views) },
                  ]}
                />
              </section>
              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <h2 className="mb-4 text-[15px] font-semibold text-ink">Where products are opened</h2>
                {stats!.clickSources.length ? (
                  <Bars
                    rows={stats!.clickSources.map((row) => ({
                      label: SOURCE_LABEL[row.source] || row.source,
                      value: row.clicks,
                      note: percent(row.clicks, t.clicks),
                    }))}
                  />
                ) : (
                  <p className="text-[13px] text-ink/55">No opens counted yet in this period.</p>
                )}
              </section>
            </div>
          </div>

          {notBuying.length ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="text-[15px] font-semibold text-ink">Looked at a lot, not bought yet</h2>
              <p className="mb-3 text-[12.5px] text-ink/55">Worth a better photo, price or description.</p>
              <div className="flex flex-wrap gap-2">
                {notBuying.map((row) => (
                  <span key={row.id} className="rounded-full bg-stone-100 px-3 py-1.5 text-[12.5px] text-ink">
                    {row.name} <span className="text-ink/50">· {count(row.views)} views</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-stone-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Every product</h2>
                <p className="text-[12.5px] text-ink/55">Tap a column to sort.</p>
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setLimit(25)
                }}
                placeholder="Search products"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm sm:w-64"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-[12px] text-ink/55">
                    <th className="px-5 py-3 font-semibold">
                      <button type="button" onClick={() => setSort({ key: 'name', desc: sort.key === 'name' ? !sort.desc : false })}>
                        Product {sort.key === 'name' ? (sort.desc ? '↓' : '↑') : ''}
                      </button>
                    </th>
                    {COLUMNS.map((column) => (
                      <th key={column.key} className="whitespace-nowrap px-3 py-3 text-right font-semibold" title={column.hint}>
                        <button
                          type="button"
                          onClick={() => setSort({ key: column.key, desc: sort.key === column.key ? !sort.desc : true })}
                          className={sort.key === column.key ? 'text-ink' : ''}
                        >
                          {column.label} {sort.key === column.key ? (sort.desc ? '↓' : '↑') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((row) => (
                    <tr key={row.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resolveImageUrl(row.image)} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg bg-stone-100 object-cover" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{row.name}</p>
                            <p className="text-[12px] text-ink/50">
                              {row.category}
                              {row.isAvailable ? '' : ' · inactive'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{count(row.views)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{count(row.clicks)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{count(row.addToCart)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{count(row.wishlistNow)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{count(row.orders)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{count(row.units)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{money(row.revenue)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink/70">{percent(row.addToCart, row.views)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink/70">{percent(row.orders, row.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? <p className="p-5 text-sm text-ink/55">No products match.</p> : null}
            {rows.length > limit ? (
              <div className="border-t border-stone-200 p-4 text-center">
                <button type="button" onClick={() => setLimit((l) => l + 50)} className="text-sm font-semibold text-wine">
                  Show more ({rows.length - limit} left)
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
