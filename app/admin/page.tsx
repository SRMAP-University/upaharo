'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatPriceNoDecimals } from '@/lib/utils'

interface Stats {
  totalOrders: number
  totalRevenue: number
  totalProducts: number
  totalUsers: number
  recentOrders: Array<{
    id: string
    orderNumber: string
    total: number
    status: string
    createdAt: string
  }>
}

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-purple-50 text-purple-700',
  READY: 'bg-indigo-50 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-sky-50 text-sky-700',
  DELIVERED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' })
      if (res.ok) setStats(await res.json())
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const quickLinks = [
    { href: '/admin/orders', label: 'Orders', icon: '📦' },
    { href: '/admin/products', label: 'Products', icon: '🎁' },
    { href: '/admin/coupons', label: 'Coupons', icon: '🎟️' },
    { href: '/admin/notifications', label: 'Marketing push', icon: '📣' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-ink/50">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="hidden md:block">
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-0.5 text-sm text-ink/50">Overview of your store</p>
      </header>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-wine/10 bg-white px-4 py-3.5 text-sm font-semibold text-ink shadow-[0_8px_24px_-20px_rgba(43,29,34,0.35)] transition-colors active:scale-[0.98] hover:border-wine/30 hover:bg-cream"
          >
            <span className="text-xl">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 md:gap-4">
        <StatCard label="Orders" value={stats?.totalOrders || 0} />
        <StatCard label="Revenue" value={formatPriceNoDecimals(stats?.totalRevenue || 0)} />
        <StatCard label="Products" value={stats?.totalProducts || 0} />
        <StatCard label="Users" value={stats?.totalUsers || 0} />
      </div>

      {/* Recent orders */}
      <section className="overflow-hidden rounded-2xl border border-wine/10 bg-white shadow-[0_8px_24px_-20px_rgba(43,29,34,0.35)]">
        <div className="flex items-center justify-between border-b border-wine/10 px-4 py-3.5">
          <h2 className="font-medium text-ink">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold text-wine hover:underline">
            View all
          </Link>
        </div>

        {stats?.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="divide-y divide-wine/10">
            {stats.recentOrders.map((order) => (
              <Link
                key={order.id}
                href="/admin/orders"
                className="flex items-center justify-between px-4 py-3.5 transition-colors active:bg-cream/70 hover:bg-cream/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{order.orderNumber}</p>
                  <p className="text-xs text-ink/50">
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">
                    {formatPriceNoDecimals(order.total || 0)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      statusStyle[order.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {order.status.toLowerCase().replace(/_/g, ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-ink/50">No orders yet</div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-wine/10 bg-white p-4 shadow-[0_8px_24px_-20px_rgba(43,29,34,0.35)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  )
}
