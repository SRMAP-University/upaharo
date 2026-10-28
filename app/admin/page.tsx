'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { formatPriceNoDecimals } from '@/lib/utils'
import { useUserStore } from '@/lib/store/user'
import { AdminIcons } from '@/components/admin/admin-nav'
import { adminButtonClass } from '@/components/admin/AdminPageHeader'

interface Stats {
  storeName?: string
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

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/stats', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((error) => {
        console.error('Error fetching stats:', error)
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          The dashboard numbers couldn’t load. Refresh the page to try again.
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

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          loading={loading}
          failed={failed}
          icon={<AdminIcons.Orders className="h-5 w-5" />}
          label="Orders today"
          value={String(stats?.todayOrders ?? 0)}
          hint={`${(stats?.totalOrders ?? 0).toLocaleString()} all time`}
        />
        <KpiCard
          loading={loading}
          failed={failed}
          icon={<AdminIcons.Receipt className="h-5 w-5" />}
          label="Sales today"
          value={formatPriceNoDecimals(stats?.todayRevenue ?? 0)}
          hint={`${formatPriceNoDecimals(stats?.totalRevenue ?? 0)} all time`}
        />
        <KpiCard
          loading={loading}
          failed={failed}
          icon={<AdminIcons.Gift className="h-5 w-5" />}
          label="Active products"
          value={(stats?.activeProducts ?? stats?.totalProducts ?? 0).toLocaleString()}
          hint={`${(stats?.inactiveProducts ?? 0).toLocaleString()} inactive`}
        />
        <KpiCard
          loading={loading}
          failed={failed}
          icon={<AdminIcons.Users className="h-5 w-5" />}
          label="Customers"
          value={(stats?.totalUsers ?? 0).toLocaleString()}
          hint="who have ordered"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Sales, last 7 days"
          subtitle="Cancelled orders are not counted"
          aside={
            stats?.last7Days ? (
              <span className="text-sm font-semibold text-ink">
                {formatPriceNoDecimals(stats.last7Days.reduce((sum, d) => sum + d.revenue, 0))}
              </span>
            ) : null
          }
        >
          {loading ? <div className="h-48 animate-pulse rounded-lg bg-stone-100" /> : <SalesChart days={stats?.last7Days || []} />}
        </Panel>

        <Panel title="Needs attention">
          <ul className="divide-y divide-stone-100">
            <AttentionRow href="/admin/orders" label="Waiting to be accepted" count={stats?.pendingOrders} tone="amber" loading={loading} />
            <AttentionRow href="/admin/orders" label="Being prepared or delivered" count={stats?.inProgressOrders} tone="blue" loading={loading} />
            <AttentionRow
              href="/admin/products?sort=stock"
              label="Out of stock"
              count={stats?.outOfStockProducts ?? undefined}
              tone="red"
              loading={loading}
            />
            <AttentionRow
              href="/admin/products?availability=unavailable"
              label="Inactive products"
              count={stats?.inactiveProducts}
              tone="stone"
              loading={loading}
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
          {loading ? (
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
                      <Link href="/admin/orders" className="font-medium text-ink hover:text-wine">
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
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  loading: boolean
  failed?: boolean
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink/55">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-wine/[0.07] text-wine">{icon}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-stone-100" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ink">{failed ? '—' : value}</p>
      )}
      <p className="mt-1 truncate text-xs text-ink/45">{loading || failed ? ' ' : hint}</p>
    </div>
  )
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

/** One bar per day; hover or focus a bar for that day's sales and orders. */
function SalesChart({ days }: { days: Array<{ date: string; orders: number; revenue: number }> }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...days.map((d) => d.revenue), 0)
  const label = (date: string, style: 'short' | 'long') =>
    new Date(`${date}T00:00:00`).toLocaleDateString(
      undefined,
      style === 'short' ? { weekday: 'short' } : { weekday: 'long', month: 'short', day: 'numeric' }
    )

  if (!days.length) return <div className="py-10 text-center text-sm text-ink/50">No sales data yet.</div>

  return (
    <div>
      <div className="relative flex h-48 items-end gap-2 border-b border-stone-200 pt-4 sm:gap-3">
        {/* Recessive guide at the top value */}
        {max > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 border-t border-dashed border-stone-200">
            <span className="absolute -top-2.5 right-0 bg-white pl-1 text-[11px] text-ink/40">{formatPriceNoDecimals(max)}</span>
          </div>
        ) : null}
        {days.map((day, index) => {
          const height = max > 0 ? Math.max((day.revenue / max) * 100, day.revenue > 0 ? 3 : 0) : 0
          const active = hover === index
          return (
            <button
              key={day.date}
              type="button"
              className="relative flex h-full flex-1 items-end justify-center focus:outline-none"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              aria-label={`${label(day.date, 'long')}: ${formatPriceNoDecimals(day.revenue)} from ${day.orders} order${day.orders === 1 ? '' : 's'}`}
            >
              <span
                className="block w-full max-w-[44px] rounded-t transition-opacity"
                style={{ height: `${height}%`, backgroundColor: BAR_COLOR, opacity: hover === null || active ? 1 : 0.45 }}
              />
              {active ? (
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-xs shadow-lg">
                  <span className="block font-medium text-ink">{label(day.date, 'long')}</span>
                  <span className="block text-ink/70">
                    {formatPriceNoDecimals(day.revenue)} · {day.orders} order{day.orders === 1 ? '' : 's'}
                  </span>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {days.map((day, index) => (
          <span
            key={day.date}
            className={`flex-1 text-center text-xs ${index === days.length - 1 ? 'font-semibold text-ink' : 'text-ink/45'}`}
          >
            {index === days.length - 1 ? 'Today' : label(day.date, 'short')}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Sales for each of the last 7 days</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Sales</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{label(day.date, 'long')}</td>
              <td>{formatPriceNoDecimals(day.revenue)}</td>
              <td>{day.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
