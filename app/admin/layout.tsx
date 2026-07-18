'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUserStore } from '@/lib/store/user'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, _hasHydrated } = useUserStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!_hasHydrated) return
    
    if (mounted && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [mounted, user, router, _hasHydrated])

  if (!mounted || !_hasHydrated || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-ink/55">Checking access...</p>
        </div>
      </div>
    )
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const menuItems = [
    { icon: '📊', label: 'Dashboard', href: '/admin' },
    { icon: '🖼️', label: 'Banners', href: '/admin/banners' },
    { icon: '🎁', label: 'Products', href: '/admin/products' },
    { icon: '📂', label: 'Categories', href: '/admin/categories' },
    { icon: '📦', label: 'Orders', href: '/admin/orders' },
    { icon: '👥', label: 'Users', href: '/admin/users' },
    { icon: '🏪', label: 'Sellers', href: '/admin/sellers' },
    { icon: '🎀', label: 'Gift Wraps', href: '/admin/gift-wraps' },
    { icon: '🎉', label: 'Occasions', href: '/admin/occasions' },
    { icon: '🎟️', label: 'Coupons', href: '/admin/coupons' },
    { icon: '⚙️', label: 'Settings', href: '/admin/settings' },
  ]

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-white border-b border-wine/10 sticky top-0 z-40">
        <div className="px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-display text-lg md:text-2xl font-semibold text-wine">
                Upaharo <span className="text-gold">Admin</span>
              </Link>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              <span className="hidden md:inline text-sm text-ink/55">{user?.name || 'Admin'}</span>
              <Link href="/" className="text-xs md:text-sm text-wine hover:text-wine-deep font-semibold">
                View Site →
              </Link>
            </div>
          </div>
        </div>
        {/* Mobile quick pills */}
        <div className="md:hidden border-t border-wine/10 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {menuItems.map((item) => (
              <Link
                key={`${item.href}-mobile-pill`}
                href={item.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive(item.href)
                    ? 'border-transparent bg-wine text-white'
                    : 'border-wine/15 bg-white text-ink/70'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-64 bg-white border-r border-wine/10 min-h-[calc(100vh-73px)] sticky top-[73px] md:block">
          <nav className="p-4">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      isActive(item.href)
                        ? 'bg-rose-soft text-wine'
                        : 'text-ink/70 hover:bg-cream hover:text-ink'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile App Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-wine/10 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 py-2">
          {menuItems.slice(0, 5).map((item) => (
            <Link
              key={`${item.href}-mobile-tab`}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                isActive(item.href) ? 'text-wine' : 'text-ink/50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

