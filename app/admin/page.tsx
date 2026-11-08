'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import DashboardDetails, { type DetailKind, type DetailRequest } from './DashboardDetails'
import { formatPriceNoDecimals } from '@/lib/utils'
import { useUserStore } from '@/lib/store/user'
import { AdminIcons } from '@/components/admin/admin-nav'
import { adminButtonClass } from '@/components/admin/AdminPageHeader'

type SeriesPoint = { key: string; from: string; to: string; orders: number; revenue: number }

/** Numbers for the period picked on the dashboard (cancelled orders never count as sales). */
interface PeriodStats {
  from: string | null
  to: string | null
  orders: number
  cancelled: number
  sales: number
  deliveredOrders: number
  deliveredSales: number
  customers: number
  itemsSold: number
  productsSold: number
  groupBy: 'day' | 'month'
  seriesFrom: string
  seriesTo: string
  series: SeriesPoint[]
}

interface Stats {
  storeName?: string
  period?: PeriodStats
  cancelledOrders?: number
  totalOrders: number
  totalRevenue: number
  totalProducts: number
  activeProducts?: number
  inactiveProducts?: number
  outOfStockProducts?: number | null
  totalUsers: number
  pendingOrders?: number
  inProgressOrders?: number
  todayOrders?: number
  todayRevenue?: number
  last7Days?: Array<{ date: string; orders: number; revenue: number }>
  recentOrders: Array<{
    id: string
    orderNumber: string
    total: number
    status: string
    createdAt: string
    customerName?: string | null
  }>
}

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
  ACCEPTED: 'bg-blue-50 text-blue-800 ring-blue-200',
  PREPARING: 'bg-violet-50 text-violet-800 ring-violet-200',
  READY: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  OUT_FOR_DELIVERY: 'bg-sky-50 text-sky-800 ring-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
}

const statusLabel = (status: string) => {
  const text = status.toLowerCase().replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Bars use a brand pink validated for contrast on white.
const BAR_COLOR = '#a8385a'

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000
const nepalToday = () => new Date(Date.now() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const dayLabel = (day: string, withYear = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })

type PeriodId = 'today' | 'yesterday' | '7d' | 'month' | 'lastMonth' | 'year' | 'all' | 'custom'

function periodPresets(): Array<{ id: PeriodId; label: string; from: string | null; to: string | null }> {
  const t = nepalToday()
  const monthStart = `${t.slice(0, 7)}-01`
  const lastMonthEnd = shiftDay(monthStart, -1)
  return [
    { id: 'today', label: 'Today', from: t, to: t },
    { id: 'yesterday', label: 'Yesterday', from: shiftDay(t, -1), to: shiftDay(t, -1) },
    { id: '7d', label: 'Last 7 days', from: shiftDay(t, -6), to: t },
    { id: 'month', label: 'This month', from: monthStart, to: t },
    { id: 'lastMonth', label: 'Last month', from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
    { id: 'year', label: 'This year', from: `${t.slice(0, 4)}-01-01`, to: t },
    { id: 'all', label: 'All time', from: null, to: null },
  ]
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function AdminDashboard() {
  const { user } = useUserStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const presets = useMemo(periodPresets, [])
  const [periodId, setPeriodId] = useState<PeriodId>('today')
  const [customFrom, setCustomFrom] = useState(() => shiftDay(nepalToday(), -6))
  const [customTo, setCustomTo] = useState(() => nepalToday())
  const [details, setDetails] = useState<DetailRequest | null>(null)
  const closeDetails = useCallback(() => setDetails(null), [])

  const preset = presets.find((p) => p.id === periodId)
  const from = periodId === 'custom' ? (customFrom <= customTo ? customFrom : customTo) : preset?.from ?? null
  const to = periodId === 'custom' ? (customFrom <= customTo ? customTo : customFrom) : preset?.to ?? null
  const periodLabel =
    periodId === 'custom'
      ? from === to
        ? dayLabel(from!, true)
        : `${dayLabel(from!)} – ${dayLabel(to!, true)}`
      : preset?.label ?? ''

  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined
    setLoading(true)
    setFailed(false)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const load = (attempt: number) =>
      fetch(`/api/admin/stats?${params}`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data) => {
          if (cancelled) return
          setStats(data)
          setLoading(false)
        })
        .catch((error) => {
          if (cancelled) return
          // A busy database can refuse for a moment; try once more before showing the error.
          if (attempt === 0) {
            retryTimer = window.setTimeout(() => void load(1), 1500)
            return
          }
          console.error('Error fetching stats:', error)
          setFailed(true)
          setLoading(false)
        })
    void load(0)
    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
    }
  }, [reloadKey, from, to])

  const p = stats?.period
  const open = (kind: DetailKind, title: string, range?: { from: string; to: string; label: string }) =>
    setDetails({ kind, title, from: range ? range.from : from, to: range ? range.to : to, periodLabel: range ? range.label : periodLabel })
  // Only the first load shows placeholders; changing the period keeps the old numbers dimmed.
  const firstLoad = loading && !stats

  const firstName = (user?.name || '').trim().split(/\s+/)[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const pending = stats?.pendingOrders ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink/50">{today}</p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 text-sm text-ink/55">
            Here’s how {stats?.storeName ? <span className="font-medium text-ink">{stats.storeName}</span> : 'your store'} is doing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/orders/offline" className={adminButtonClass.secondary}>
            New offline order
          </Link>
          <Link href="/admin/products/new" className={adminButtonClass.primary}>
            + Add product
          </Link>
        </div>
      </div>

      {failed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>The dashboard numbers couldn’t load.</span>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:border-red-300"
          >
            Try again
          </button>
        </div>
      ) : null}

      {pending > 0 ? (
        <Link
          href="/admin/orders"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:border-amber-300"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 font-semibold">{pending}</span>
          <span className="flex-1">
            <span className="font-semibold">{pending === 1 ? '1 order is' : `${pending} orders are`} waiting to be accepted.</span>{' '}
            Open Orders to accept {pending === 1 ? 'it' : 'them'}.
          </span>
          <AdminIcons.ChevronRight className="h-4 w-4 shrink-0" />
        </Link>
      ) : null}

      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        {[...presets.map((x) => ({ id: x.id, label: x.label })), { id: 'custom' as const, label: 'Custom dates' }].map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setPeriodId(x.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              periodId === x.id ? 'bg-wine text-white' : 'bg-white text-ink/65 ring-1 ring-wine/15 hover:bg-stone-50'
            }`}
          >
            {x.label}
          </button>
        ))}
        {periodId === 'custom' ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
            <label className="flex items-center gap-1.5">
              From
              <input
                type="date"
                value={customFrom}
                max={nepalToday()}
                onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-ink"
              />
            </label>
            <label className="flex items-center gap-1.5">
              To
              <input
                type="date"
                value={customTo}
                max={nepalToday()}
                onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-ink"
              />
            </label>
          </span>
        ) : null}
      </div>

      {/* Key numbers for the period; each opens what's behind it */}
      <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 ${loading && stats ? 'opacity-60' : ''}`}>
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Orders className="h-5 w-5" />}
          label={`Orders · ${periodLabel}`}
          value={(p?.orders ?? 0).toLocaleString()}
          hint={p?.cancelled ? `${p.cancelled} cancelled, not counted` : 'None cancelled'}
          onClick={() => open('orders', 'Orders')}
        />
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Receipt className="h-5 w-5" />}
          label={`Sales · ${periodLabel}`}
          value={formatPriceNoDecimals(p?.sales ?? 0)}
          hint={`${formatPriceNoDecimals(stats?.totalRevenue ?? 0)} all time`}
          onClick={() => open('orders', 'Sales')}
        />
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Gift className="h-5 w-5" />}
          label="Delivered sales"
          value={formatPriceNoDecimals(p?.deliveredSales ?? 0)}
          hint={`${(p?.deliveredOrders ?? 0).toLocaleString()} ${p?.deliveredOrders === 1 ? 'order' : 'orders'} delivered`}
          onClick={() => open('delivered', 'Delivered orders')}
        />
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Close className="h-5 w-5" />}
          label="Cancelled"
          value={(p?.cancelled ?? 0).toLocaleString()}
          hint="Not counted in sales"
          onClick={() => open('cancelled', 'Cancelled orders')}
        />
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Stock className="h-5 w-5" />}
          label="Items sold"
          value={(p?.itemsSold ?? 0).toLocaleString()}
          hint={p?.productsSold === 1 ? '1 product' : `${(p?.productsSold ?? 0).toLocaleString()} different products`}
          onClick={() => open('products', 'Products sold')}
        />
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Users className="h-5 w-5" />}
          label="Customers"
          value={(p?.customers ?? 0).toLocaleString()}
          hint={`${(stats?.totalUsers ?? 0).toLocaleString()} all time`}
          onClick={() => open('customers', 'Customers')}
        />
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Ticket className="h-5 w-5" />}
          label="Average order"
          value={p?.orders ? formatPriceNoDecimals(p.sales / p.orders) : '—'}
          hint="Sales ÷ orders"
          onClick={() => open('orders', 'Orders')}
        />
        <KpiCard
          loading={firstLoad}
          failed={failed}
          icon={<AdminIcons.Gift className="h-5 w-5" />}
          label="Active products"
          value={(stats?.activeProducts ?? stats?.totalProducts ?? 0).toLocaleString()}
          hint={`${(stats?.inactiveProducts ?? 0).toLocaleString()} inactive`}
          href="/admin/products?availability=available"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={
            p && p.from && p.from === p.to
              ? `Sales, week to ${dayLabel(p.seriesTo)}`
              : `Sales, ${periodLabel === 'All time' ? 'all time' : periodLabel}`
          }
          subtitle="Cancelled orders are not counted. Tap a bar for its orders."
          aside={
            p ? (
              <span className="text-sm font-semibold text-ink">
                {formatPriceNoDecimals(p.series.reduce((sum, d) => sum + d.revenue, 0))}
              </span>
            ) : null
          }
        >
          {firstLoad ? (
            <div className="h-48 animate-pulse rounded-lg bg-stone-100" />
          ) : (
            <SalesChart
              points={p?.series || []}
              groupBy={p?.groupBy || 'day'}
              onPick={(point, label) => open('orders', `Orders, ${label}`, { from: point.from, to: point.to, label })}
            />
          )}
        </Panel>

        <Panel title="Needs attention">
          <ul className="divide-y divide-stone-100">
            <AttentionRow href="/admin/orders" label="Waiting to be accepted" count={stats?.pendingOrders} tone="amber" loading={firstLoad} />
            <AttentionRow href="/admin/orders" label="Being prepared or delivered" count={stats?.inProgressOrders} tone="blue" loading={firstLoad} />
            <AttentionRow
              href="/admin/products?sort=stock"
              label="Out of stock"
              count={stats?.outOfStockProducts ?? undefined}
              tone="red"
              loading={firstLoad}
            />
            <AttentionRow
              href="/admin/products?availability=unavailable"
              label="Inactive products"
              count={stats?.inactiveProducts}
              tone="stone"
              loading={firstLoad}
            />
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Recent orders"
          aside={
            <Link href="/admin/orders" className="text-sm font-medium text-wine hover:underline">
              View all
            </Link>
          }
          flush
        >
          {firstLoad ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-stone-100" />
              ))}
            </div>
          ) : stats?.recentOrders?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-ink/50">
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders?order=${order.id}`} className="font-medium text-ink hover:text-wine">
                        {order.orderNumber}
                      </Link>
                      <div className="text-xs text-ink/45">{timeAgo(order.createdAt)}</div>
                    </td>
                    <td className="hidden max-w-[12rem] truncate px-4 py-3 text-ink/70 sm:table-cell">{order.customerName || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          statusStyle[order.status] || 'bg-stone-100 text-ink/70 ring-stone-200'
                        }`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">{formatPriceNoDecimals(order.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-ink/50">No orders yet.</div>
          )}
        </Panel>

        <Panel title="Quick actions">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <QuickAction href="/admin/products/new" icon={<AdminIcons.Plus className="h-4 w-4" />} label="Add a product" />
            <QuickAction href="/admin/orders/offline" icon={<AdminIcons.Receipt className="h-4 w-4" />} label="Offline order" />
            <QuickAction href="/admin/coupons" icon={<AdminIcons.Ticket className="h-4 w-4" />} label="Create a coupon" />
            <QuickAction href="/admin/notifications" icon={<AdminIcons.Megaphone className="h-4 w-4" />} label="Send a push" />
            <QuickAction href="/admin/banners" icon={<AdminIcons.Image className="h-4 w-4" />} label="Edit banners" />
            <QuickAction href="/admin/settings" icon={<AdminIcons.Cog className="h-4 w-4" />} label="Store settings" />
          </div>
        </Panel>
      </div>

      {details ? <DashboardDetails request={details} onClose={closeDetails} /> : null}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  aside,
  children,
  className = '',
  flush = false,
}: {
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-stone-200 bg-white ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink/45">{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      <div className={flush ? '' : 'px-4 pb-4'}>{children}</div>
    </section>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  loading,
  failed = false,
  onClick,
  href,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  loading: boolean
  failed?: boolean
  /** Opens what's behind the number. */
  onClick?: () => void
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-ink/55">{label}</p>
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/[0.07] text-wine sm:flex">{icon}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-stone-100" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ink">{failed ? '—' : value}</p>
      )}
      <p className="mt-1 flex items-center justify-between gap-1 text-xs text-ink/45">
        <span className="truncate">{loading || failed ? ' ' : hint}</span>
        {onClick || href ? <AdminIcons.ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/30" /> : null}
      </p>
    </>
  )
  const cls = 'block w-full rounded-xl border border-stone-200 bg-white p-4 text-left transition hover:border-wine/30 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/30'
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={loading || failed} className={cls}>
        {body}
      </button>
    )
  }
  return <div className="rounded-xl border border-stone-200 bg-white p-4">{body}</div>
}

const toneStyle = {
  amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-blue-50 text-blue-800',
  red: 'bg-red-50 text-red-700',
  stone: 'bg-stone-100 text-ink/70',
}

function AttentionRow({
  href,
  label,
  count,
  tone,
  loading,
}: {
  href: string
  label: string
  count?: number | null
  tone: keyof typeof toneStyle
  loading: boolean
}) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-stone-50">
        <span className="text-ink/75">{label}</span>
        <span className="flex items-center gap-2">
          {loading ? (
            <span className="h-5 w-8 animate-pulse rounded-md bg-stone-100" />
          ) : (
            <span
              className={`min-w-[2rem] rounded-md px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${
                count ? toneStyle[tone] : 'bg-stone-50 text-ink/40'
              }`}
            >
              {count ?? '—'}
            </span>
          )}
          <AdminIcons.ChevronRight className="h-4 w-4 text-ink/30" />
        </span>
      </Link>
    </li>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-medium text-ink/80 hover:border-stone-300 hover:bg-stone-50 hover:text-ink"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-ink/60">{icon}</span>
      {label}
    </Link>
  )
}

/** One bar per day (or month); hover for the numbers, click for that day's orders. */
function SalesChart({
  points,
  groupBy,
  onPick,
}: {
  points: SeriesPoint[]
  groupBy: 'day' | 'month'
  onPick: (point: SeriesPoint, label: string) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...points.map((d) => d.revenue), 0)
  const today = nepalToday()
  const longLabel = (pt: SeriesPoint) =>
    groupBy === 'month'
      ? new Date(`${pt.key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : new Date(`${pt.key}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
  const shortLabel = (pt: SeriesPoint) =>
    groupBy === 'month'
      ? new Date(`${pt.key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
      : pt.key === today
        ? 'Today'
        : points.length <= 7
          ? new Date(`${pt.key}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
          : dayLabel(pt.key)
  const every = Math.max(1, Math.ceil(points.length / 8))

  if (!points.length) return <div className="py-10 text-center text-sm text-ink/50">No sales data yet.</div>

  return (
    <div>
      <div className="relative flex h-48 items-end gap-1 border-b border-stone-200 pt-4 sm:gap-2">
        {/* Recessive guide at the top value */}
        {max > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 border-t border-dashed border-stone-200">
            <span className="absolute -top-2.5 right-0 bg-white pl-1 text-[11px] text-ink/40">{formatPriceNoDecimals(max)}</span>
          </div>
        ) : null}
        {points.map((pt, index) => {
          const height = max > 0 ? Math.max((pt.revenue / max) * 100, pt.revenue > 0 ? 3 : 0) : 0
          const active = hover === index
          return (
            <button
              key={pt.key}
              type="button"
              className="relative flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(pt, longLabel(pt))}
              aria-label={`${longLabel(pt)}: ${formatPriceNoDecimals(pt.revenue)} from ${pt.orders} order${pt.orders === 1 ? '' : 's'}. Show orders.`}
            >
              <span
                className="block w-full max-w-[44px] rounded-t transition-opacity"
                style={{ height: `${height}%`, backgroundColor: BAR_COLOR, opacity: hover === null || active ? 1 : 0.45 }}
              />
              {active ? (
                <span
                  className={`pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-xs shadow-lg ${
                    index > points.length / 2 ? 'right-0' : 'left-0'
                  }`}
                >
                  <span className="block font-medium text-ink">{longLabel(pt)}</span>
                  <span className="block text-ink/70">
                    {formatPriceNoDecimals(pt.revenue)} · {pt.orders} order{pt.orders === 1 ? '' : 's'}
                  </span>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-2">
        {points.map((pt, index) => (
          <span
            key={pt.key}
            className={`min-w-0 flex-1 truncate text-center text-[11px] ${pt.key === today ? 'font-semibold text-ink' : 'text-ink/45'}`}
          >
            {index % every === 0 || index === points.length - 1 ? shortLabel(pt) : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Sales for each {groupBy === 'month' ? 'month' : 'day'}</caption>
        <thead>
          <tr>
            <th>{groupBy === 'month' ? 'Month' : 'Day'}</th>
            <th>Sales</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt) => (
            <tr key={pt.key}>
              <td>{longLabel(pt)}</td>
              <td>{formatPriceNoDecimals(pt.revenue)}</td>
              <td>{pt.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
