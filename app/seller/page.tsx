'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  totalProducts: number
  activeProducts: number
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  thisMonthRevenue: number
}

export default function SellerDashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/seller/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  return (
    <div className="px-4 py-4 md:py-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-white border border-wine/10 rounded-[22px] p-6 shadow-sm">
        <h1 className="font-display text-xl md:text-2xl font-semibold text-ink mb-1">
          Welcome back, {session?.user?.name}!
        </h1>
        <p className="text-ink/55 text-sm md:text-base">Here's your store overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard
          title="Products"
          value={stats?.totalProducts || 0}
          subtitle={`${stats?.activeProducts || 0} active`}
          icon="📦"
          onClick={() => router.push('/seller/products')}
        />
        <StatCard
          title="Orders"
          value={stats?.totalOrders || 0}
          subtitle={`${stats?.pendingOrders || 0} pending`}
          icon="🛒"
          onClick={() => router.push('/seller/orders')}
        />
        <StatCard
          title="Revenue"
          value={`Rs. ${(stats?.totalRevenue || 0).toLocaleString('en-NP', { maximumFractionDigits: 0 })}`}
          subtitle={`Rs. ${(stats?.thisMonthRevenue || 0).toLocaleString('en-NP', { maximumFractionDigits: 0 })} this month`}
          icon="💰"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-[22px] shadow-sm border border-wine/10 p-4 md:p-6">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/seller/products/new')}
            className="flex items-center gap-3 bg-wine text-white p-4 rounded-2xl hover:bg-wine-deep transition-colors shadow-sm"
          >
            <span className="text-2xl">➕</span>
            <div className="text-left">
              <div className="font-semibold">Add Product</div>
              <div className="text-xs text-white/70">Create new listing</div>
            </div>
          </button>
          <button
            onClick={() => router.push('/seller/orders')}
            className="flex items-center gap-3 bg-white border border-wine/20 text-wine p-4 rounded-2xl hover:border-wine/40 hover:bg-cream transition-colors shadow-sm"
          >
            <span className="text-2xl">📋</span>
            <div className="text-left">
              <div className="font-semibold">View Orders</div>
              <div className="text-xs text-ink/55">Manage deliveries</div>
            </div>
          </button>
          <button
            onClick={() => router.push('/seller/analytics')}
            className="flex items-center gap-3 bg-white border border-wine/20 text-wine p-4 rounded-2xl hover:border-wine/40 hover:bg-cream transition-colors shadow-sm sm:col-span-2"
          >
            <span className="text-2xl">📈</span>
            <div className="text-left">
              <div className="font-semibold">Product Stats</div>
              <div className="text-xs text-ink/55">Views, cart adds, wishlists and sales for each product</div>
            </div>
          </button>
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-cream-deep border border-wine/10 rounded-[22px] p-4 md:p-6">
        <div className="flex items-start gap-3">
          <span className="text-3xl">💡</span>
          <div>
            <h3 className="font-display font-semibold text-ink mb-1">Seller Tips</h3>
            <ul className="text-sm text-ink/70 space-y-1">
              <li>• Keep your products updated with fresh images</li>
              <li>• Respond to orders within 2 hours for better ratings</li>
              <li>• Complete your profile for customer trust</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  onClick,
  className = '',
}: {
  title: string
  value: string | number
  subtitle: string
  icon: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white border border-wine/10 hover:border-wine/30 text-left rounded-[22px] p-4 md:p-6 shadow-sm hover:shadow-md transition-all ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-xs md:text-sm font-medium text-ink/55">{title}</p>
          <p className="font-display text-2xl md:text-3xl font-semibold text-ink mt-1 break-words">{value}</p>
        </div>
        <div className="text-3xl md:text-4xl ml-2">{icon}</div>
      </div>
      <p className="text-xs text-ink/55 text-left">{subtitle}</p>
    </button>
  )
}
