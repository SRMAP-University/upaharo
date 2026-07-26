'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useB2BCartStore } from '@/lib/store/b2b-cart'
import { useB2BBusinessStore } from '@/lib/store/b2b-business'

type Props = {
  enquireHref?: string
}

export default function B2BHeader({ enquireHref }: Props) {
  const totalItems = useB2BCartStore((s) => s.getTotalItems())
  const session = useB2BBusinessStore((s) => s.session)
  const clearSession = useB2BBusinessStore((s) => s.clearSession)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const loggedIn = mounted && Boolean(session?.token && session.shopName)

  return (
    <header className="sticky top-0 z-50 border-b border-wine/10 bg-[#F7F2EE]/95 backdrop-blur safe-area-top">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/b2b" className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wine shadow-[0_12px_26px_-16px_rgba(124,42,71,0.95)]">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64M12 21h7.5M5.625 4.5h12.75m-12.75 0c-.621 0-1.125.504-1.125 1.125v2.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-2.25c0-.621-.504-1.125-1.125-1.125"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight tracking-tight text-wine truncate">
              Upaharo <span className="text-gold">Business</span>
            </p>
            <p className="text-[11px] font-medium text-ink/45 truncate">
              {loggedIn ? session!.shopName : 'Wholesale ordering'}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/b2b"
            className="hidden sm:inline-flex rounded-full border border-wine/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-wine hover:border-wine/35 transition-colors"
          >
            Catalog
          </Link>
          <Link
            href="/b2b/orders"
            className="hidden sm:inline-flex rounded-full border border-wine/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-wine hover:border-wine/35 transition-colors"
          >
            My orders
          </Link>
          {enquireHref ? (
            <a
              href={enquireHref}
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex rounded-full border border-wine/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-wine hover:border-wine/35 transition-colors"
            >
              Sales
            </a>
          ) : null}

          {loggedIn ? (
            <button
              type="button"
              onClick={() => clearSession()}
              className="hidden sm:inline-flex rounded-full border border-wine/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-wine hover:border-wine/35 transition-colors"
              title={session!.user.email}
            >
              Log out
            </button>
          ) : (
            <>
              <Link
                href="/b2b/login"
                className="hidden sm:inline-flex rounded-full border border-wine/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-wine hover:border-wine/35 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/b2b/register"
                className="hidden md:inline-flex rounded-full border border-wine/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-wine hover:border-wine/35 transition-colors"
              >
                Register
              </Link>
            </>
          )}

          <Link
            href="/b2b/cart"
            className="relative inline-flex items-center gap-1.5 rounded-full bg-wine px-3.5 py-2 text-xs font-semibold text-white hover:bg-wine-deep transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
              />
            </svg>
            Cart
            {mounted && totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
