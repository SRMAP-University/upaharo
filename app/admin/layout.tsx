'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUserStore } from '@/lib/store/user'

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5A1.5 1.5 0 013 19.5v-8.25m18 0H3m18 0V6a3 3 0 00-3-3H6a3 3 0 00-3 3v5.25m18 0h-1.5M3 11.25h1.5M12 3v18m-3.75-7.5h7.5" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.496.462 7.286 7.286 0 002.7-.663C21.589 17.866 22.5 16.39 22.5 14.75s-.911-3.116-2.304-4.176a7.5 7.5 0 00-10.392 0C8.411 11.634 7.5 13.11 7.5 14.75s.911 3.116 2.304 4.176a7.286 7.286 0 002.7.663 9.38 9.38 0 002.496-.462M12.004 14.25a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5zM4.5 18.75s1.5-1.5 3-1.5 2.25 1.5 2.25 1.5M18 18.75s-1.5-1.5-3-1.5-2.25 1.5-2.25 1.5" />
    </svg>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64M12 21h7.5M5.625 4.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm12.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-12.75 0h12.75m-12.75 0c-.621 0-1.125.504-1.125 1.125v2.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-2.25c0-.621-.504-1.125-1.125-1.125m-12.75 0h12.75m-12.75 0v2.25m12.75-2.25v2.25M7.5 12.75v2.25m9-2.25v2.25" />
    </svg>
  )
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25m-5.25 3h5.25m-5.25 3h5.25M3.375 5.25c-.621 0-1.125.504-1.125 1.125V9a3 3 0 003 3h.75a3 3 0 013-3h.75a3 3 0 013 3h.75a3 3 0 003-3V6.375c0-.621-.504-1.125-1.125-1.125H3.375zm13.5 0v-.75a2.25 2.25 0 00-2.25-2.25h-6a2.25 2.25 0 00-2.25 2.25v.75" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  )
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.87l-.212 1.281c-.09.542-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.53 6.53 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.298-2.247a1.125 1.125 0 011.369-.491l1.217.456c.355.133.75.072 1.076-.124.074-.044.147-.087.22-.128.332-.183.582-.495.644-.87l.212-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

interface MenuItem {
  icon: React.ReactNode
  label: string
  href: string
}

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

  const menuItems: MenuItem[] = [
    { icon: <ChartIcon className="w-5 h-5" />, label: 'Dashboard', href: '/admin' },
    { icon: <ImageIcon className="w-5 h-5" />, label: 'Banners', href: '/admin/banners' },
    { icon: <GiftIcon className="w-5 h-5" />, label: 'Products', href: '/admin/products' },
    { icon: <FolderIcon className="w-5 h-5" />, label: 'Categories', href: '/admin/categories' },
    { icon: <BoxIcon className="w-5 h-5" />, label: 'Orders', href: '/admin/orders' },
    { icon: <UsersIcon className="w-5 h-5" />, label: 'Users', href: '/admin/users' },
    { icon: <StoreIcon className="w-5 h-5" />, label: 'Sellers', href: '/admin/sellers' },
    { icon: <GiftIcon className="w-5 h-5" />, label: 'Gift Wraps', href: '/admin/gift-wraps' },
    { icon: <SparklesIcon className="w-5 h-5" />, label: 'Occasions', href: '/admin/occasions' },
    { icon: <TicketIcon className="w-5 h-5" />, label: 'Coupons', href: '/admin/coupons' },
    { icon: <BellIcon className="w-5 h-5" />, label: 'Push / Marketing', href: '/admin/notifications' },
    { icon: <CogIcon className="w-5 h-5" />, label: 'Settings', href: '/admin/settings' },
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
            {menuItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={`${item.href}-mobile-pill`}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-transparent bg-wine text-white'
                      : 'border-wine/15 bg-white text-ink/70'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-64 bg-white border-r border-wine/10 min-h-[calc(100vh-73px)] sticky top-[73px] md:block">
          <nav className="p-4">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-wine text-white shadow-sm'
                          : 'text-ink/70 hover:bg-cream hover:text-ink'
                      }`}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
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
          {menuItems.slice(0, 5).map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={`${item.href}-mobile-tab`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  active ? 'text-wine' : 'text-ink/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

