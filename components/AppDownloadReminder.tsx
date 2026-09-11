'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PLAY_STORE_APP_URL } from '@/lib/app-download'

const STORAGE_KEY = 'upaharo-app-download-dismissed'
const DISMISS_DAYS = 5

function shouldHide(pathname: string) {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/b2b') ||
    pathname.startsWith('/bill/') ||
    pathname.startsWith('/b/')
  )
}

export default function AppDownloadReminder() {
  const pathname = usePathname() || ''
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (shouldHide(pathname)) {
      setVisible(false)
      return
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    const dismissedAt = raw ? Number(raw) : 0
    const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
    if (dismissedAt && days < DISMISS_DAYS) return
    const timer = window.setTimeout(() => setVisible(true), 1800)
    return () => window.clearTimeout(timer)
  }, [pathname])

  if (shouldHide(pathname) || !visible) return null

  return (
    <div className="fixed inset-x-3 bottom-[5.5rem] z-[45] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[380px]">
      <div className="relative rounded-2xl border border-wine/10 bg-white p-4 shadow-[0_22px_50px_-28px_rgba(43,29,34,0.55)]">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, String(Date.now()))
            setVisible(false)
          }}
          className="absolute right-2.5 top-2.5 text-ink/35 hover:text-ink"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="pr-6 text-sm font-extrabold text-ink">Download the Upaharo app</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/55">
          Shop faster, track orders, and play Spin & Win every day.
        </p>
        <a
          href={PLAY_STORE_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-full bg-wine px-4 py-2 text-xs font-bold text-white hover:bg-wine-deep"
        >
          Get it on Google Play
        </a>
      </div>
    </div>
  )
}
