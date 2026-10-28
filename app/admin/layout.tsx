'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useUserStore } from '@/lib/store/user'
import AdminCommandPalette from '@/components/admin/AdminCommandPalette'
import { ADMIN_NAV, AdminIcons, adminBreadcrumbs, adminNavItemFor, type AdminNavItem } from '@/components/admin/admin-nav'

type StoreOption = {
  slug: string
  name: string
}

const SIDEBAR_KEY = 'upaharo-admin-sidebar'

// Phone tab bar: the pages used most, plus search and the full menu.
const PHONE_TABS = ['/admin', '/admin/orders', '/admin/products']

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout, _hasHydrated } = useUserStore()
  const [mounted, setMounted] = useState(false)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [selectedStore, setSelectedStore] = useState('gifts')
  const [switchingStore, setSwitchingStore] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed')
    } catch {
      // Storage blocked: keep the full menu.
    }
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
    setMenuOpen(false)
    setSearchOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  // Ctrl/⌘ K, or "/" outside a text box, opens search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]')
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearchOpen((open) => !open)
      } else if (event.key === '/' && !typing) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded')
      } catch {
        // Not saved; fine for this visit.
      }
      return next
    })
  }

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

  const handleSignOut = async () => {
    logout()
    await signOut({ redirect: false }).catch(() => undefined)
    router.push('/login')
  }

  const currentItem = adminNavItemFor(pathname)
  const crumbs = adminBreadcrumbs(pathname)
  const pageTitle = crumbs[crumbs.length - 1]
  const isActive = (item: AdminNavItem) => currentItem?.href === item.href
  const storeName =
    stores.find((store) => store.slug === selectedStore)?.name ||
    (selectedStore === 'grocery' ? 'Grocery' : 'Gifts')
  const displayName = user?.name || user?.email || 'Admin'
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A'

  if (!mounted || !_hasHydrated || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-stone-100">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-xl bg-wine/15" />
          <p className="text-sm text-ink/55">Checking access...</p>
        </div>
      </div>
    )
  }

  const storeSwitcher = (compact: boolean) =>
    stores.length > 0 ? (
      <label className="relative block">
        <span className="sr-only">Store to manage</span>
        <AdminIcons.Store className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
        <select
          value={selectedStore}
          onChange={(event) => void switchStore(event.target.value)}
          disabled={switchingStore}
          className={`w-full appearance-none rounded-lg border border-stone-200 bg-white pl-8 pr-7 font-medium text-ink outline-none hover:border-stone-300 focus:border-wine/40 focus:ring-2 focus:ring-wine/10 disabled:opacity-60 ${
            compact ? 'h-9 max-w-[9.5rem] text-xs' : 'h-9 text-sm'
          }`}
          aria-label="Store to manage"
          title={`Managing ${storeName}`}
        >
          {stores.map((store) => (
            <option key={store.slug} value={store.slug}>
              {store.name}
            </option>
          ))}
        </select>
        <AdminIcons.ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/45" />
      </label>
    ) : null

  const navList = (rail: boolean) => (
    <nav className={rail ? 'space-y-3 px-2 py-3' : 'space-y-4 px-3 py-3'} aria-label="Admin">
      {ADMIN_NAV.map((group, groupIndex) => (
        <div key={group.label}>
          {rail ? (
            groupIndex > 0 ? <div className="mx-auto mb-2 h-px w-6 bg-stone-200" /> : null
          ) : (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/40">{group.label}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={rail ? item.label : undefined}
                    aria-label={rail ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center rounded-lg text-sm transition-colors ${
                      rail ? 'h-9 justify-center' : 'gap-3 px-3 py-1.5'
                    } ${
                      active
                        ? 'bg-wine/[0.08] font-semibold text-wine'
                        : 'text-ink/70 hover:bg-stone-100 hover:text-ink'
                    }`}
                  >
                    {active && !rail ? <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-wine" /> : null}
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-wine' : 'text-ink/50'}`} />
                    {rail ? null : <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const brand = (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine text-sm font-bold text-white">U</span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-semibold text-ink">Upaharo</span>
        <span className="block text-[11px] font-medium text-ink/45">Admin</span>
      </span>
    </Link>
  )

  const account = (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-ink/70">
        {initial}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium text-ink">{displayName}</span>
        {user?.name && user?.email ? <span className="block truncate text-xs text-ink/45">{user.email}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/45 hover:bg-stone-100 hover:text-ink"
        title="Sign out"
        aria-label="Sign out"
      >
        <AdminIcons.Logout className="h-[18px] w-[18px]" />
      </button>
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-stone-100 text-ink antialiased">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-stone-200 bg-white transition-[width] duration-200 md:flex ${
          collapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-stone-200 ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {collapsed ? (
            <Link href="/admin" title="Dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg bg-wine text-sm font-bold text-white">
              U
            </Link>
          ) : (
            brand
          )}
          {collapsed ? null : (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/45 hover:bg-stone-100 hover:text-ink"
              aria-label="Collapse menu"
              title="Collapse menu"
            >
              <AdminIcons.ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">{navList(collapsed)}</div>

        <div className="shrink-0 border-t border-stone-200 p-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/45 hover:bg-stone-100 hover:text-ink"
                aria-label="Expand menu"
                title="Expand menu"
              >
                <AdminIcons.ChevronsRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/45 hover:bg-stone-100 hover:text-ink"
                aria-label="Sign out"
                title="Sign out"
              >
                <AdminIcons.Logout className="h-[18px] w-[18px]" />
              </button>
            </div>
          ) : (
            account
          )}
        </div>
      </aside>

      <div className={collapsed ? 'md:pl-[4.5rem]' : 'md:pl-64'}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-3 md:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/60 hover:bg-stone-100 md:hidden"
              aria-label="Open menu"
            >
              <AdminIcons.Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-ink md:hidden">{pageTitle}</h1>
              <ol className="hidden items-center gap-1.5 text-sm md:flex" aria-label="Breadcrumb">
                {crumbs.map((crumb, index) => (
                  <li key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 ? <AdminIcons.ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/30" /> : null}
                    <span className={`truncate ${index === crumbs.length - 1 ? 'font-semibold text-ink' : 'text-ink/50'}`}>{crumb}</span>
                  </li>
                ))}
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-ink/45 hover:border-stone-300 lg:flex"
            >
              <AdminIcons.Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search pages…</span>
              <kbd className="rounded border border-stone-200 bg-white px-1.5 text-[11px] font-medium">Ctrl K</kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/60 hover:bg-stone-100 lg:hidden"
              aria-label="Search pages"
            >
              <AdminIcons.Search className="h-5 w-5" />
            </button>

            <div className="shrink-0">{storeSwitcher(true)}</div>

            <Link
              href="/"
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-ink/70 hover:border-stone-300 hover:text-ink md:inline-flex"
            >
              View site
              <AdminIcons.External className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <main className="min-w-0 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-10 md:pt-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>

      {/* Phone tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Admin shortcuts"
      >
        <div className="grid grid-cols-5 px-1 pt-1">
          {PHONE_TABS.map((href) => {
            const item = ADMIN_NAV.flatMap((g) => g.items).find((i) => i.href === href)!
            const active = isActive(item)
            const Icon = item.icon
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 ${active ? 'text-wine' : 'text-ink/45'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold">{item.shortLabel || item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex min-h-[54px] flex-col items-center justify-center gap-1 text-ink/45"
          >
            <AdminIcons.Search className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Search</span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`flex min-h-[54px] flex-col items-center justify-center gap-1 ${
              menuOpen || (currentItem && !PHONE_TABS.includes(currentItem.href)) ? 'text-wine' : 'text-ink/45'
            }`}
          >
            <AdminIcons.Menu className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Menu</span>
          </button>
        </div>
      </nav>

      {/* Phone menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-4 pt-[env(safe-area-inset-top)]">
              {brand}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/55 hover:bg-stone-100"
                aria-label="Close menu"
              >
                <AdminIcons.Close className="h-5 w-5" />
              </button>
            </div>
            {stores.length > 0 ? <div className="border-b border-stone-200 p-3">{storeSwitcher(false)}</div> : null}
            <div className="min-h-0 flex-1 overflow-y-auto">{navList(false)}</div>
            <div className="shrink-0 space-y-1 border-t border-stone-200 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              <Link
                href="/"
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-ink/70 hover:bg-stone-100"
              >
                View site
                <AdminIcons.External className="h-4 w-4" />
              </Link>
              {account}
            </div>
          </div>
        </div>
      )}

      <AdminCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
