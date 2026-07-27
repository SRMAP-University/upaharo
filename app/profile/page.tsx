'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { useUserStore } from '@/lib/store/user'
import { useLocationStore } from '@/lib/store/location'
import BottomNav from '@/components/BottomNav'
import SkeletonLoader from '@/components/SkeletonLoader'
import { formatPriceNoDecimals } from '@/lib/utils'

interface GiftRecipient {
  id: string
  name: string
  relationship: string
}

interface GiftOccasion {
  id: string
  name: string
  emoji: string
}

interface OrderGiftWrap {
  id: string
  name: string
  price: number
}

interface Order {
  id: string
  createdAt: string
  status: string
  total: number
  isGift: boolean
  greetingMessage?: string | null
  recipient?: GiftRecipient | null
  occasion?: GiftOccasion | null
  giftWrap?: OrderGiftWrap | null
  items: any[]
}

interface WalletTransaction {
  id: string
  type: string
  amount: number
  status: string
  note?: string | null
  createdAt: string
}

interface WalletState {
  enabled: boolean
  balance: number
  pendingCashback: number
  transactions: WalletTransaction[]
}

interface SavedAddress {
  id: string
  label: string
  street: string
  apartment: string
  city: string
  state: string
  pincode: string
  isDefault: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout, _hasHydrated } = useUserStore()
  const { deliveryAddress } = useLocationStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [wallet, setWallet] = useState<WalletState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'addresses'>('overview')

  useEffect(() => {
    // Wait for hydration before checking auth
    if (!_hasHydrated) return

    if (!user) {
      router.push('/auth')
      return
    }

    fetchUserData()
  }, [user, router, _hasHydrated])

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token')
      
      // Fetch orders
      const ordersRes = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        setOrders(ordersData.orders || [])
      }

      // Fetch saved addresses
      const addressesRes = await fetch('/api/addresses')
      if (addressesRes.ok) {
        const addressesData = await addressesRes.json()
        setAddresses(addressesData.addresses || [])
      }

      const walletRes = await fetch('/api/wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (walletRes.ok) {
        const walletData = await walletRes.json()
        setWallet({
          enabled: Boolean(walletData.enabled),
          balance: Number(walletData.balance) || 0,
          pendingCashback: Number(walletData.pendingCashback) || 0,
          transactions: walletData.transactions || [],
        })
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    logout()
    await signOut({ redirect: false })
    router.push('/')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'preparing': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'out_for_delivery': return 'bg-rose-soft text-wine border-wine/10'
      case 'delivered': return 'bg-green-50 text-green-700 border-green-200'
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-cream-deep text-ink/70 border-wine/10'
    }
  }

  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-wine border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink/55">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pb-20 lg:pb-0">
      {/* Page-Specific Header */}
      <div className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-wine/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 -ml-2 hover:bg-cream-deep rounded-lg transition-colors">
                <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-ink">Profile</h1>
              <p className="text-xs text-ink/55">{user?.name || 'User'}</p>
            </div>
          </div>
          <Link href="/account">
            <button className="p-2 hover:bg-cream-deep rounded-lg transition-colors">
              <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </Link>
        </div>
      </div>

      <div className="px-0 pt-0">
        {/* Profile Header - Clean Professional */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-6 pb-6 px-4 mb-2 border-b border-wine/10"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-soft to-cream-deep rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="font-display text-3xl font-semibold text-wine">
                {user?.name?.charAt(0).toUpperCase() || '👤'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold text-ink truncate">{user?.name || 'User'}</h1>
              <p className="text-ink/55 text-sm truncate mt-0.5">{user?.email || ''}</p>
              <p className="text-ink/55 text-sm">{user?.phone || ''}</p>
            </div>
          </div>

          {/* Quick Stats - Minimal */}
          <div className="grid grid-cols-3 gap-1 -mx-4 px-4 py-4 bg-cream-deep">
            <div className="text-center p-3">
              <p className="font-display text-2xl font-semibold text-ink">{orders.length}</p>
              <p className="text-[10px] text-ink/55 mt-0.5 uppercase tracking-wide">Orders</p>
            </div>
            <div className="text-center p-3 border-l border-r border-wine/10">
              <p className="font-display text-2xl font-semibold text-ink">
                {orders.filter(o => o.status === 'DELIVERED').length}
              </p>
              <p className="text-[10px] text-ink/55 mt-0.5 uppercase tracking-wide">Delivered</p>
            </div>
            <div className="text-center p-3">
              <p className="font-display text-2xl font-semibold text-ink">{addresses.length}</p>
              <p className="text-[10px] text-ink/55 mt-0.5 uppercase tracking-wide">Addresses</p>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation - Clean Minimal */}
        <div className="sticky top-16 z-10 bg-cream/95 backdrop-blur border-b border-wine/10 px-4 py-3">
          <div className="flex gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )},
              { id: 'orders', label: 'Orders', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              )},
              { id: 'addresses', label: 'Addresses', icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              )}
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-wine text-white'
                    : 'text-ink/60 hover:bg-cream-deep'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content - Flowing Design */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-wine border-t-transparent"></div>
            </motion.div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="px-4 py-4 space-y-6"
                >
                  {wallet?.enabled && (
                    <div>
                      <h3 className="text-xs font-semibold text-ink/55 uppercase tracking-wider mb-3">
                        Wallet
                      </h3>
                      <div className="overflow-hidden rounded-[22px] border border-wine/10 bg-white shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]">
                        <div className="flex items-end justify-between gap-4 px-4 py-4 border-b border-wine/10">
                          <div>
                            <p className="text-[11px] text-ink/45 uppercase tracking-wide font-medium">
                              Available balance
                            </p>
                            <p className="font-display text-3xl font-semibold text-wine mt-1">
                              {formatPriceNoDecimals(wallet.balance)}
                            </p>
                          </div>
                          {wallet.pendingCashback > 0 && (
                            <p className="text-sm text-ink/55 pb-1">
                              {formatPriceNoDecimals(wallet.pendingCashback)} pending
                            </p>
                          )}
                        </div>

                        {wallet.transactions.length === 0 ? (
                          <p className="px-4 py-4 text-sm text-ink/55">
                            Cashback from your orders will show up here after delivery.
                          </p>
                        ) : (
                          wallet.transactions.slice(0, 6).map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-wine/10 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink truncate">
                                  {tx.note || tx.type.replace(/_/g, ' ').toLowerCase()}
                                </p>
                                <p className="text-[11px] text-ink/45 mt-0.5">
                                  {formatDate(tx.createdAt)}
                                  {tx.status === 'PENDING' ? ' · pending' : ''}
                                </p>
                              </div>
                              <span
                                className={`text-sm font-semibold flex-shrink-0 ${
                                  tx.status === 'PENDING'
                                    ? 'text-ink/45'
                                    : tx.amount >= 0
                                      ? 'text-green-700'
                                      : 'text-ink/70'
                                }`}
                              >
                                {tx.amount >= 0 ? '+' : '-'}
                                {formatPriceNoDecimals(Math.abs(tx.amount))}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Profile Info - Minimal */}
                  <div>
                    <h3 className="text-xs font-semibold text-ink/55 uppercase tracking-wider mb-3">👤 Personal Information</h3>
                    <div className="overflow-hidden rounded-[22px] border border-wine/10 bg-white shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]">
                      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-wine/10">
                        <div className="w-9 h-9 bg-cream-deep rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-ink/45 uppercase tracking-wide font-medium">Full Name</p>
                          <p className="text-sm font-semibold text-ink truncate mt-0.5">{user?.name || 'User'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-wine/10">
                        <div className="w-9 h-9 bg-cream-deep rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-ink/45 uppercase tracking-wide font-medium">Email</p>
                          <p className="text-sm font-semibold text-ink truncate mt-0.5">{user?.email || ''}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className="w-9 h-9 bg-cream-deep rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-ink/45 uppercase tracking-wide font-medium">Phone</p>
                          <p className="text-sm font-semibold text-ink mt-0.5">{user?.phone || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Location */}
                  {deliveryAddress && (
                    <div>
                      <h3 className="text-xs font-semibold text-ink/55 uppercase tracking-wider mb-3">📍 Current Location</h3>
                      <div className="p-4 border border-wine/10 rounded-[22px] bg-white shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-cream-deep rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-wine" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink">{deliveryAddress.label}</p>
                            <p className="text-sm text-ink/55 mt-1 leading-relaxed">{deliveryAddress.address}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-xs font-semibold text-ink/55 uppercase tracking-wider mb-3">⚡ Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Link href="/orders">
                        <button className="w-full border border-wine/10 bg-white rounded-[22px] p-4 hover:bg-cream transition-colors active:scale-[0.98]">
                          <div className="w-12 h-12 bg-cream-deep rounded-xl flex items-center justify-center mx-auto mb-2">
                            <svg className="w-6 h-6 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-ink">My Orders</span>
                        </button>
                      </Link>

                      <button 
                        onClick={() => setActiveTab('addresses')}
                        className="w-full border border-wine/10 bg-white rounded-[22px] p-4 hover:bg-cream transition-colors active:scale-[0.98]"
                      >
                        <div className="w-12 h-12 bg-cream-deep rounded-xl flex items-center justify-center mx-auto mb-2">
                          <svg className="w-6 h-6 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                        </div>
                        <span className="text-sm font-semibold text-ink">Addresses</span>
                      </button>

                      <Link href="/recipients">
                        <button className="w-full border border-wine/10 bg-white rounded-[22px] p-4 hover:bg-cream transition-colors active:scale-[0.98]">
                          <div className="w-12 h-12 bg-cream-deep rounded-xl flex items-center justify-center mx-auto mb-2">
                            <svg className="w-6 h-6 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-ink">Recipients</span>
                        </button>
                      </Link>

                      <button 
                        onClick={handleLogout}
                        className="w-full border-2 border-red-200 bg-white rounded-[22px] p-4 hover:bg-red-50 transition-colors active:scale-[0.98]"
                      >
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <span className="text-sm font-semibold text-red-600">Logout</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="px-4 py-4 space-y-3"
                >
                  {orders.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-cream-deep rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-wine/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-ink mb-2">No orders yet</h3>
                      <p className="text-sm text-ink/55 mb-6">Start ordering your favorite gifts!</p>
                      <Link href="/">
                        <button className="bg-wine text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-wine-deep transition-colors">
                          Browse Products
                        </button>
                      </Link>
                    </div>
                  ) : (
                    orders.map((order, index) => {
                      const detailChips = [
                        order.isGift ? 'Gift Order' : 'Direct Order',
                        order.occasion ? `${order.occasion.emoji} ${order.occasion.name}` : null,
                        order.giftWrap ? `Wrap: ${order.giftWrap.name}` : null,
                        order.recipient ? `To: ${order.recipient.name}` : null,
                      ].filter(Boolean) as string[]

                      return (
                      <Link key={order.id} href={`/orders/${order.id}`}>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 pb-5 rounded-[22px] border border-wine/10 bg-white shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)] hover:bg-cream transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-ink/45 uppercase tracking-wide font-medium">Order ID</p>
                              <p className="font-display text-sm font-semibold text-ink mt-0.5">#{order.id.slice(0, 8).toUpperCase()}</p>
                              <p className="text-xs text-ink/55 mt-1">{formatDate(order.createdAt)}</p>
                            </div>
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                              {order.status.replace('_', ' ')}
                            </span>
                          </div>
                          {detailChips.length > 0 ? (
                            <div className="mb-3 flex gap-1.5 overflow-x-auto">
                              {detailChips.map((chip) => (
                                <span
                                  key={`${order.id}-${chip}`}
                                  className="shrink-0 rounded-full bg-rose-soft px-2.5 py-1 text-[11px] font-semibold text-wine border border-wine/10"
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {order.greetingMessage ? (
                            <p className="mb-3 text-xs text-ink/55 line-clamp-1">
                              Message: <span className="font-medium text-ink/70">{order.greetingMessage}</span>
                            </p>
                          ) : null}
                          
                          <div className="flex items-center justify-between pt-3 border-t border-wine/10">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-cream-deep rounded-xl flex items-center justify-center">
                                <svg className="w-4 h-4 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                              </div>
                              <span className="text-sm text-ink/55">{order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}</span>
                            </div>
                            <p className="font-display text-xl font-semibold text-wine">
                              {formatPriceNoDecimals(order.total)}
                            </p>
                          </div>
                        </motion.div>
                      </Link>
                    )})
                  )}
                </motion.div>
              )}

              {/* Addresses Tab */}
              {activeTab === 'addresses' && (
                <motion.div
                  key="addresses"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="px-4 py-4 space-y-3"
                >
                  {addresses.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-cream-deep rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-wine/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-ink mb-2">No saved addresses</h3>
                      <p className="text-sm text-ink/55 mb-6">Add a delivery address to get started</p>
                      <Link href="/checkout">
                        <button className="bg-wine text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-wine-deep transition-colors">
                          Add Address
                        </button>
                      </Link>
                    </div>
                  ) : (
                    addresses.map((address, index) => (
                      <motion.div
                        key={address.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white border border-wine/10 rounded-[22px] p-4 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-cream-deep rounded-xl flex items-center justify-center flex-shrink-0">
                            {address.label === 'Home' ? (
                              <svg className="w-5 h-5 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            ) : address.label === 'Work' ? (
                              <svg className="w-5 h-5 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className="font-display font-semibold text-ink text-sm">{address.label}</h4>
                              {address.isDefault && (
                                <span className="bg-rose-soft text-wine text-[10px] px-2 py-0.5 rounded-full font-bold">Default</span>
                              )}
                            </div>
                            <p className="text-sm text-ink/70 leading-relaxed">{address.street}</p>
                            {address.apartment && (
                              <p className="text-sm text-ink/70">{address.apartment}</p>
                            )}
                            <p className="text-xs text-ink/55 mt-1.5">
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  )
}
