'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'SELLER') {
      router.push('/login')
    }
  }, [status, session?.user?.role, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wine"></div>
      </div>
    )
  }

  if (!session || session.user?.role !== 'SELLER') {
    return null
  }

  const navItems = [
    { href: '/seller', label: 'Dashboard', icon: '📊' },
    { href: '/seller/products', label: 'Products', icon: '📦' },
    { href: '/seller/analytics', label: 'Stats', icon: '📈' },
    { href: '/seller/orders', label: 'Orders', icon: '🛒' },
    { href: '/seller/profile', label: 'Profile', icon: '👤' },
  ]

  return (
    <div className="min-h-screen bg-cream pb-20 md:pb-0">
      {/* Desktop Header */}
      <nav className="hidden md:block bg-white shadow-sm border-b border-wine/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="font-display text-xl font-semibold text-wine">🏪 Seller Hub</h1>
              <div className="flex space-x-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-rose-soft text-wine'
                        : 'text-ink/60 hover:bg-cream hover:text-ink'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-ink/70">
                {session.user?.name}
              </span>
              <a
                href="/api/auth/signout"
                className="text-sm text-wine hover:text-wine-deep font-medium"
              >
                Logout
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <div className="md:hidden bg-white shadow-sm border-b border-wine/10 sticky top-0 z-40">
        <div className="px-4 h-14 flex items-center justify-between">
          <h1 className="font-display text-lg font-semibold text-wine">🏪 Seller Hub</h1>
          <a
            href="/api/auth/signout"
            className="text-sm text-wine hover:text-wine-deep font-medium"
          >
            Logout
          </a>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto md:py-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-wine/10 shadow-lg z-50">
        <div className="grid grid-cols-5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
                pathname === item.href
                  ? 'text-wine bg-rose-soft'
                  : 'text-ink/60'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
