'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface MenuItem {
  icon: ReactNode
  label: string
  shortLabel?: string
  href: string
}

type StoreOption = {
  slug: string
  name: string
}

const PAGE_TITLES: Array<{ match: (path: string) => boolean; title: string }> = [
  { match: (p) => p === '/admin', title: 'Dashboard' },
  { match: (p) => p.startsWith('/admin/orders'), title: 'Orders' },
  { match: (p) => p.startsWith('/admin/products'), title: 'Products' },
  { match: (p) => p.startsWith('/admin/categories'), title: 'Categories' },
  { match: (p) => p.startsWith('/admin/banners') && !p.includes('mini'), title: 'Banners' },
  { match: (p) => p.startsWith('/admin/mini-banners'), title: 'Mini Banners' },
  { match: (p) => p.startsWith('/admin/users'), title: 'Users' },
  { match: (p) => p.startsWith('/admin/sellers'), title: 'Sellers' },
  { match: (p) => p.startsWith('/admin/gift-wraps'), title: 'Gift Wraps' },
  { match: (p) => p.startsWith('/admin/occasions'), title: 'Occasions' },
  { match: (p) => p.startsWith('/admin/coupons'), title: 'Coupons' },
  { match: (p) => p.startsWith('/admin/notifications'), title: 'Push' },
  { match: (p) => p.startsWith('/admin/settings'), title: 'Settings' },
]

function pageTitleFor(pathname: string) {
  return PAGE_TITLES.find((entry) => entry.match(pathname))?.title || 'Admin'
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
  const [stores, setStores] = useState<StoreOption[]>([])
  const [selectedStore, setSelectedStore] = useState('gifts')
  const [switchingStore, setSwitchingStore] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!_hasHydrated) return
    if (mounted && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [mounted, user, router, _hasHydrated])

  useEffect(() => {
    if (!mounted || !_hasHydrated || user?.role !== 'ADMIN') return

    void fetch('/api/admin/store')
      .then(async (response) => {
        if (!response.ok) return
        const data = (await response.json()) as {
          stores?: StoreOption[]
          selectedSlug?: string
        }
        setStores(data.stores || [])
        setSelectedStore(data.selectedSlug || 'gifts')
      })
      .catch(() => undefined)
  }, [mounted, _hasHydrated, user?.role])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [moreOpen])

  const switchStore = async (slug: string) => {
    if (!slug || slug === selectedStore || switchingStore) return
    setSwitchingStore(true)
    try {
      const response = await fetch('/api/admin/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      if (!response.ok) {
        throw new Error('Unable to switch store')
      }
      setSelectedStore(slug)
      window.location.reload()
    } catch {
      setSwitchingStore(false)
      window.alert('Unable to switch stores. Please try again.')
    }
  }

  const menuItems: MenuItem[] = useMemo(
    () => [
      { icon: <ChartIcon className="w-5 h-5" />, label: 'Dashboard', shortLabel: 'Home', href: '/admin' },
      { icon: <BoxIcon className="w-5 h-5" />, label: 'Orders', href: '/admin/orders' },
      { icon: <GiftIcon className="w-5 h-5" />, label: 'Products', href: '/admin/products' },
      { icon: <FolderIcon className="w-5 h-5" />, label: 'Categories', href: '/admin/categories' },
      { icon: <ImageIcon className="w-5 h-5" />, label: 'Banners', href: '/admin/banners' },
      { icon: <ImageIcon className="w-5 h-5" />, label: 'Mini Banners', href: '/admin/mini-banners' },
      { icon: <UsersIcon className="w-5 h-5" />, label: 'Users', href: '/admin/users' },
      { icon: <StoreIcon className="w-5 h-5" />, label: 'Sellers', href: '/admin/sellers' },
      { icon: <GiftIcon className="w-5 h-5" />, label: 'Gift Wraps', href: '/admin/gift-wraps' },
      { icon: <SparklesIcon className="w-5 h-5" />, label: 'Occasions', href: '/admin/occasions' },
      { icon: <TicketIcon className="w-5 h-5" />, label: 'Coupons', href: '/admin/coupons' },
      { icon: <BellIcon className="w-5 h-5" />, label: 'Push / Marketing', shortLabel: 'Push', href: '/admin/notifications' },
      { icon: <CogIcon className="w-5 h-5" />, label: 'Settings', href: '/admin/settings' },
    ],
    []
  )

  const primaryTabs = useMemo(
    () => [
      menuItems[0], // Dashboard
      menuItems[1], // Orders
      menuItems[2], // Products
      menuItems[3], // Categories
    ],
    [menuItems]
  )

  const moreItems = useMemo(() => menuItems.slice(4), [menuItems])

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const moreActive = moreItems.some((item) => isActive(item.href))
  const pageTitle = pageTitleFor(pathname)
  const storeName =
    stores.find((store) => store.slug === selectedStore)?.name ||
    (selectedStore === 'grocery' ? 'Grocery' : 'Gifts')

  if (!mounted || !_hasHydrated || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-cream">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-full bg-wine/15" />
          <p className="text-sm text-ink/55">Checking access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-cream text-ink antialiased">
      {/* App header — compact & fixed */}
      <header className="fixed inset-x-0 top-0 z-40 h-12 border-b border-wine/10 bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90">
        <div className="flex h-full items-center justify-between gap-3 px-3 pt-[env(safe-area-inset-top)] md:px-4">
          <div className="min-w-0">
            <p className="hidden font-display text-base font-semibold leading-none text-wine md:block">
              Upaharo <span className="text-gold">Admin</span>
            </p>
            <div className="md:hidden">
              <h1 className="truncate font-display text-base font-semibold leading-tight text-ink">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {stores.length > 0 && (
              <label className="relative">
                <span className="sr-only">Store to manage</span>
                <select
                  value={selectedStore}
                  onChange={(event) => void switchStore(event.target.value)}
                  disabled={switchingStore}
                  className="appearance-none rounded-full border border-wine/15 bg-cream px-2.5 py-1 pr-7 text-[11px] font-semibold text-ink outline-none focus:border-wine disabled:opacity-60"
                  aria-label="Store to manage"
                  title={`Managing ${storeName}`}
                >
                  {stores.map((store) => (
                    <option key={store.slug} value={store.slug}>
                      {store.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-ink/45">
                  ▾
                </span>
              </label>
            )}

            <Link
              href="/"
              className="hidden rounded-full border border-wine/15 px-2.5 py-1 text-[11px] font-semibold text-wine hover:bg-cream md:inline-flex"
            >
              View site
            </Link>
          </div>
        </div>
      </header>

      <div className={`pt-12 ${sidebarExpanded ? 'md:pl-56' : 'md:pl-[4.5rem]'}`}>
        {/* Desktop sidebar — minimized icon rail by default */}
        <aside
          className={`hidden md:fixed md:left-0 md:top-12 md:z-30 md:flex md:h-[calc(100dvh-3rem)] md:flex-col md:overflow-y-auto md:border-r md:border-wine/10 md:bg-white transition-[width] duration-200 ${
            sidebarExpanded ? 'md:w-56' : 'md:w-[4.5rem]'
          }`}
        >
          <div className={`flex items-center border-b border-wine/10 ${sidebarExpanded ? 'justify-between px-3 py-2' : 'justify-center py-2'}`}>
            {sidebarExpanded ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/40">Menu</span>
            ) : null}
            <button
              type="button"
              onClick={() => setSidebarExpanded((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink/55 hover:bg-cream hover:text-ink"
              aria-label={sidebarExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
              title={sidebarExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                {sidebarExpanded ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5M9.75 19.5l-7.5-7.5 7.5-7.5" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M14.25 4.5l7.5 7.5-7.5 7.5" />
                )}
              </svg>
            </button>
          </div>
          <nav className={`flex-1 ${sidebarExpanded ? 'p-3' : 'px-2 py-3'}`}>
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center rounded-xl text-sm transition-colors ${
                        sidebarExpanded
                          ? `gap-3 px-3 py-2.5 ${
                              active
                                ? 'bg-wine text-white shadow-sm'
                                : 'text-ink/70 hover:bg-cream hover:text-ink'
                            }`
                          : `justify-center px-0 py-2.5 ${
                              active
                                ? 'bg-wine text-white shadow-sm'
                                : 'text-ink/70 hover:bg-cream hover:text-ink'
                            }`
                      }`}
                    >
                      {item.icon}
                      {sidebarExpanded ? <span className="font-medium truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-4 md:p-5 md:pb-6 lg:px-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-wine/10 bg-white/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 px-1 pt-1.5">
          {primaryTabs.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-colors ${
                  active ? 'text-wine' : 'text-ink/45'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    active ? 'bg-wine/10' : ''
                  }`}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-semibold tracking-wide">
                  {item.shortLabel || item.label}
                </span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-colors ${
              moreActive || moreOpen ? 'text-wine' : 'text-ink/45'
            }`}
            aria-label="More admin pages"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                moreActive || moreOpen ? 'bg-wine/10' : ''
              }`}
            >
              <GridIcon className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-semibold tracking-wide">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[28px] bg-white shadow-[0_-20px_60px_-30px_rgba(43,29,34,0.45)]">
            <div className="flex items-center justify-between border-b border-wine/10 px-5 pb-3 pt-4">
              <div>
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
                <h2 className="font-display text-lg font-semibold text-ink">More</h2>
                <p className="text-xs text-ink/50">Marketing, people, and store setup</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-ink/60"
                aria-label="Close"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-2.5">
                {moreItems.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border p-3.5 transition-colors ${
                        active
                          ? 'border-wine bg-wine text-white'
                          : 'border-wine/10 bg-cream/60 text-ink hover:border-wine/25'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          active ? 'bg-white/15' : 'bg-white text-wine'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="text-sm font-semibold leading-snug">
                        {item.shortLabel || item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>

              <div className="mt-4 space-y-2 rounded-2xl border border-wine/10 bg-cream/50 p-3">
                <Link
                  href="/"
                  className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-sm font-semibold text-wine"
                >
                  View live site
                  <span aria-hidden>→</span>
                </Link>
                <p className="px-1 text-xs text-ink/45">
                  Signed in as {user?.name || user?.email || 'Admin'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
