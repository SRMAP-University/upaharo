'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { PLAY_STORE_APP_URL } from '@/lib/app-download'
import { isInApp } from '@/lib/app-bridge'
import {
  BalloonsArt,
  BouquetArt,
  CakeArt,
  ChocolateArt,
  CupcakeArt,
  FrameArt,
  GiftBoxArt,
  TeddyArt,
} from '@/components/home/GiftArt'

const SNOOZE_KEY = 'upaharo-app-sheet-until'
const OLD_DISMISS_KEY = 'upaharo-app-download-dismissed'
/** Fired with detail true/false when the pop-up shows or hides (the shop helper steps aside). */
export const APP_PROMPT_EVENT = 'upaharo-app-prompt'
/** "Continue on web" or close: ask again after this many days. */
const DISMISS_DAYS = 5
/** Tapped "Download": they probably have the app now, so wait much longer. */
const DOWNLOADED_DAYS = 30
/** Add `?appsheet=1` to any shop page to preview the pop-up on any device. */
const PREVIEW_PARAM = 'appsheet'

const STORE_LINK = `${PLAY_STORE_APP_URL}&referrer=${encodeURIComponent('utm_source=upaharo_web&utm_medium=app_sheet')}`

function shouldHide(pathname: string) {
  return [
    '/admin',
    '/seller',
    '/b2b',
    '/bill/',
    '/b/',
    '/app-features/',
    '/play',
    '/checkout',
    '/cart',
    '/login',
    '/auth',
    '/account-deletion',
    '/privacy',
    '/terms',
  ].some((prefix) => pathname.startsWith(prefix))
}

const IN_APP_KEY = 'upaharo-in-app'

/**
 * True when this tab is the Upaharo app's own web view. The app adds `?inApp=1`
 * and a bridge when it opens a page; remember it for the whole tab so later
 * pages (where the URL no longer carries `inApp=1`) never offer the app either.
 */
function insideApp() {
  try {
    if (isInApp()) {
      sessionStorage.setItem(IN_APP_KEY, '1')
      return true
    }
    return sessionStorage.getItem(IN_APP_KEY) === '1'
  } catch {
    return isInApp()
  }
}

/** Android phones browsing the gifts website, never inside the Upaharo app. */
function isAndroidShopper() {
  if (insideApp()) return false
  const host = window.location.hostname.toLowerCase()
  if (host.startsWith('grocery.') || host.includes('grocery.upaharo')) return false
  return /android/i.test(navigator.userAgent)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Hide the pop-up for a number of days (stored as the time it may show again). */
function snooze(days: number) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * DAY_MS))
  } catch {
    // Private mode: it simply shows again next visit.
  }
}

function isSnoozed() {
  try {
    if (Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now()) return true
    // The older small reminder stored when it was closed.
    const closedAt = Number(localStorage.getItem(OLD_DISMISS_KEY) || 0)
    return closedAt > 0 && Date.now() - closedAt < DISMISS_DAYS * DAY_MS
  } catch {
    return false
  }
}

/**
 * "Get the Upaharo app" bottom sheet for Android shoppers on the website.
 * Shows a short while after landing, once every few days at most, and never
 * during checkout, inside the app, or on the grocery store.
 */
export default function AppDownloadReminder() {
  const pathname = usePathname() || ''
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (shouldHide(pathname)) {
      setVisible(false)
      return
    }
    const preview = new URLSearchParams(window.location.search).get(PREVIEW_PARAM) === '1'
    if (!preview && (!isAndroidShopper() || isSnoozed())) return
    const timer = window.setTimeout(() => setVisible(true), preview ? 300 : 1500)
    return () => window.clearTimeout(timer)
  }, [pathname])

  const shown = visible && !shouldHide(pathname)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(APP_PROMPT_EVENT, { detail: shown }))
    if (!shown) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [shown])
  useEffect(() => () => void window.dispatchEvent(new CustomEvent(APP_PROMPT_EVENT, { detail: false })), [])

  function close() {
    snooze(DISMISS_DAYS)
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {shown && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="app-sheet-title">
          <motion.div
            className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="absolute -top-[68px] left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-ink text-white shadow-lg"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="overflow-hidden rounded-t-[28px] bg-white pb-[max(18px,env(safe-area-inset-bottom))]">
              <PhonesScene />

              <div className="relative z-30 -mt-11 flex justify-center">
                <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[24px] bg-white shadow-[0_14px_30px_-12px_rgba(17,17,17,0.35)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/logo-160.png" alt="" width={62} height={62} className="h-[62px] w-[62px] object-contain" />
                </span>
              </div>

              <div className="px-6 pt-4 text-center">
                <p className="text-[15px] font-medium text-ink/65">Get the Upaharo app for</p>
                <h2 id="app-sheet-title" className="mt-1 font-display text-[29px] font-extrabold leading-tight tracking-[-0.02em] text-ink max-[379px]:text-[25px] max-[339px]:text-[22px]">
                  Faster, easier gifting
                </h2>
                <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/50 max-[379px]:tracking-[0.16em]">
                  Order tracking &middot; Daily rewards
                </p>

                <a
                  href={STORE_LINK}
                  onClick={() => {
                    snooze(DOWNLOADED_DAYS)
                    setVisible(false)
                  }}
                  className="mt-6 flex w-full items-center justify-center rounded-full bg-ink py-4 text-[16px] font-bold text-white transition active:scale-[0.99]"
                >
                  Download Upaharo
                </a>
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 w-full py-3 text-[15px] font-semibold text-brand"
                >
                  Continue on web
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Three phones showing the app, drawn with Upaharo's own illustrations. */
function PhonesScene() {
  return (
    <div className="relative h-[236px] overflow-hidden bg-brand-soft max-[379px]:h-[212px]" aria-hidden>
      <Sparkle className="left-[9%] top-[18%] h-5 w-5 text-[#F5B83D]" />
      <Sparkle className="right-[10%] top-[12%] h-4 w-4 text-brand" />
      <Sparkle className="right-[6%] top-[46%] h-3 w-3 text-[#F5B83D]" />

      {/* The phones are drawn on a 420px board, scaled down to fit narrow screens. */}
      <div className="absolute left-1/2 top-0 h-[236px] w-[420px] origin-top -translate-x-1/2 max-[379px]:scale-[0.86] max-[339px]:scale-[0.76]">

      {/* Left: today's picks */}
      <Phone className="absolute left-1/2 top-[52px] w-[128px] -translate-x-[152%] -rotate-[8deg]">
        <div className="bg-brand-soft/70 px-2.5 pb-2 pt-5">
          <p className="text-[8px] font-extrabold leading-none text-ink">Delivery today</p>
          <p className="mt-0.5 text-[5.5px] font-medium text-ink/55">Kathmandu</p>
          <div className="mt-1.5 h-3.5 rounded-full bg-white" />
        </div>
        <p className="px-2.5 pt-2 text-[6.5px] font-bold text-ink">Birthday picks</p>
        <div className="grid grid-cols-2 gap-1 p-2 pt-1">
          {[CakeArt, BalloonsArt, CupcakeArt, TeddyArt].map((Art, i) => (
            <span key={i} className="rounded-md bg-mist p-0.5">
              <Art className="h-auto w-full" />
            </span>
          ))}
        </div>
      </Phone>

      {/* Right: order on its way */}
      <Phone className="absolute left-1/2 top-[52px] w-[128px] translate-x-[52%] rotate-[8deg]">
        <div className="px-2.5 pb-1.5 pt-5 text-center">
          <p className="text-[8px] font-extrabold leading-none text-ink">Order confirmed</p>
          <p className="mt-1 text-[5.5px] font-semibold text-brand">Arriving today</p>
        </div>
        <div className="relative mx-2 h-[150px] rounded-lg bg-mist">
          <svg viewBox="0 0 100 150" className="absolute inset-0 h-full w-full" fill="none">
            <path d="M0 40h100M0 95h100M30 0v150M72 0v150" stroke="#fff" strokeWidth="5" />
            <path d="M22 128c10-20 30-24 40-40s12-34 22-52" stroke="#111" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" />
            <circle cx="22" cy="128" r="3.2" fill="#111" />
            <path d="M84 22c-5 0-8 3.6-8 8 0 6 8 13 8 13s8-7 8-13c0-4.4-3-8-8-8z" fill="#E8322B" />
            <circle cx="84" cy="30" r="2.6" fill="#fff" />
          </svg>
        </div>
      </Phone>

      {/* Centre: the shop */}
      <Phone className="absolute left-1/2 top-[30px] z-10 w-[146px] -translate-x-1/2">
        <div className="flex items-center gap-1 px-2.5 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-160.png" alt="" className="h-3.5 w-3.5" />
          <span className="text-[8px] font-extrabold text-ink">Upaharo</span>
        </div>
        <div className="mx-2.5 mt-1.5 flex h-4 items-center rounded-full bg-mist px-2 text-[5.5px] text-ink/45">
          Search &ldquo;cake&rdquo;
        </div>
        <div className="grid grid-cols-3 gap-1 p-2.5 pt-2">
          {[CakeArt, BouquetArt, GiftBoxArt, TeddyArt, FrameArt, ChocolateArt, BalloonsArt, CupcakeArt, BouquetArt].map(
            (Art, i) => (
              <span key={i} className="rounded-md bg-mist p-0.5">
                <Art className="h-auto w-full" />
              </span>
            ),
          )}
        </div>
      </Phone>

      </div>

      {/* Scalloped edge into the white sheet */}
      <svg className="absolute inset-x-0 bottom-0 z-20 h-[14px] w-full" viewBox="0 0 480 14" preserveAspectRatio="none">
        <path
          d="M0 14V7c10 0 10-6 20-6s10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 20 6V14z"
          fill="#fff"
        />
      </svg>
    </div>
  )
}

function Phone({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-[24px] bg-ink p-[4px] shadow-[0_18px_34px_-16px_rgba(17,17,17,0.55)] ${className}`}>
      <div className="relative h-[250px] overflow-hidden rounded-[20px] bg-white">
        <span className="absolute left-1/2 top-1.5 z-10 h-[9px] w-12 -translate-x-1/2 rounded-full bg-ink" />
        {children}
      </div>
    </div>
  )
}

function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg className={`absolute ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  )
}
