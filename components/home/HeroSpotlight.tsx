'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import BrandLogo from '@/components/BrandLogo'
import DeliveryScene, { type SceneWeather } from '@/components/home/DeliveryScene'
import WeatherOverlay, { heroPalette } from '@/components/home/WeatherOverlay'
import { useLocationStore } from '@/lib/store/location'

/**
 * Home hero, kept compact: "Same-day <cakes/flowers/gifts>" (the word
 * changes every couple of seconds) over an animated delivery story: shop,
 * ride across Kathmandu, doorstep, delivered.
 * Phone: location, search, cart and account sit on top of it.
 */

const WORDS = ['cakes', 'flowers', 'gifts', 'hampers']

/** One word that slides up and swaps every 2.4 s (fixed width, so nothing jumps). */
function RotatingWord() {
  const [{ i, prev }, setWord] = useState<{ i: number; prev: number | null }>({ i: 0, prev: null })
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setWord((w) => ({ prev: w.i, i: (w.i + 1) % WORDS.length })), 2400)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      {/* every word stacked invisibly, so the box is as wide as the widest */}
      {WORDS.map((w) => (
        <span key={w} aria-hidden className="invisible col-start-1 row-start-1">
          {w}
        </span>
      ))}
      {prev !== null ? (
        <span key={`out-${prev}-${i}`} aria-hidden className="hs-word-out absolute left-0 top-0 text-brand">
          {WORDS[prev]}
        </span>
      ) : null}
      <span key={`in-${i}`} className={`${prev !== null ? 'hs-word-in ' : ''}absolute left-0 top-0 text-brand`}>
        {WORDS[i]}
      </span>
    </span>
  )
}

function Glows() {
  return (
    <>
      <span
        aria-hidden
        className="hs-blob pointer-events-none absolute -left-10 -top-16 -z-10 h-56 w-56 rounded-full bg-[#FFD3D6] opacity-60 blur-3xl"
        style={{ '--t': '13s', '--bx': '30px', '--by': '20px' } as CSSProperties}
      />
      <span
        aria-hidden
        className="hs-blob pointer-events-none absolute -bottom-20 right-0 -z-10 h-56 w-56 rounded-full bg-[#FFE7B0] opacity-50 blur-3xl"
        style={{ '--t': '11s', '--bx': '-26px', '--by': '-14px' } as CSSProperties}
      />
    </>
  )
}

const SCENES = ['clear', 'clouds', 'rain', 'storm', 'snow', 'fog'] as const

/** Live weather for the hero scene. `?weather=rain` (or `&night=1`) previews one. */
function useHeroWeather(): SceneWeather | undefined {
  const delivery = useLocationStore((s) => s.deliveryAddress)
  const current = useLocationStore((s) => s.currentLocation)
  const [weather, setWeather] = useState<SceneWeather>()
  const lat = delivery?.latitude ?? current?.latitude
  const lng = delivery?.longitude ?? current?.longitude
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const preview = params.get('weather')
    if (preview && (SCENES as readonly string[]).includes(preview)) {
      setWeather({ scene: preview as SceneWeather['scene'], night: params.get('night') === '1' })
      return
    }
    let cancelled = false
    const query = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ''
    fetch(`/api/weather${query}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.scene) setWeather({ scene: data.scene, night: Boolean(data.night) })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [lat, lng])
  return weather
}

export type SpotlightHeader = {
  locationLabel: string
  locationNote: string
  onLocation: () => void
  cartCount: number
  accountHref: string
  initial: string | null
}

const PILL = 'bg-white shadow-[0_6px_16px_-10px_rgba(90,30,40,0.35)] ring-1 ring-ink/[0.04]'

/** Phone address bar: hero pink at the top of the page, white once scrolled past it. */
function useThemeColourOnScroll(top: string) {
  useEffect(() => {
    const set = (colour: string) => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (meta && meta.content !== colour) meta.content = colour
    }
    const onScroll = () => set(window.scrollY > 260 ? '#ffffff' : top)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [top])
}

export function HeroSpotlightPhone({ promise, header }: { promise: string; header: SpotlightHeader }) {
  const weather = useHeroWeather()
  const palette = heroPalette(weather)
  useThemeColourOnScroll(palette.from)
  return (
    <section
      className="relative isolate overflow-hidden rounded-b-[28px] transition-colors duration-700"
      style={{ backgroundImage: `linear-gradient(to bottom, ${palette.from}, ${palette.to})` }}
    >
      {weather?.scene === 'clear' || !weather ? <Glows /> : null}
      <WeatherOverlay w={weather} fall={360} />
      <div className="relative z-10 flex items-center gap-2 px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        <button type="button" onClick={header.onLocation} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${PILL}`}>
            <BrandLogo size={30} />
          </span>
          <span className="min-w-0">
            <span className={`flex items-center gap-1 text-[15px] font-extrabold ${palette.dark ? 'text-white' : 'text-ink'}`}>
              <span className="truncate">{header.locationLabel}</span>
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </span>
            <span className={`block truncate text-[12px] ${palette.dark ? 'text-white/65' : 'text-ink/55'}`}>{header.locationNote}</span>
          </span>
        </button>
        <div className={`flex h-11 flex-shrink-0 items-center rounded-2xl px-1 ${PILL}`}>
          <Link href="/search" aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-xl text-ink">
            <svg className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M18.5 11a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
            </svg>
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink">
            <svg className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            {header.cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {header.cartCount > 9 ? '9+' : header.cartCount}
              </span>
            ) : null}
          </Link>
        </div>
        <Link
          href={header.accountHref}
          aria-label="Account"
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-[15px] font-extrabold text-ink ${PILL}`}
        >
          {header.initial || (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
        </Link>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-3 px-5 pt-5">
        <h1 className={`whitespace-nowrap text-[24px] font-extrabold leading-[1.1] tracking-tight ${palette.dark ? 'text-white' : 'text-ink'}`}>
          Same-day <RotatingWord />
        </h1>
        <p className={`max-w-[96px] pb-0.5 text-right text-[11px] font-medium leading-tight ${palette.dark ? 'text-white/65' : 'text-ink/55'}`}>{promise}</p>
      </div>
      <Link href="/search" aria-label="Explore gifts" className="relative z-0 mt-1 block">
        <DeliveryScene className="block h-auto w-full" weather={weather} />
      </Link>
    </section>
  )
}

export function HeroSpotlightDesktop({ promise }: { promise: string }) {
  const weather = useHeroWeather()
  const palette = heroPalette(weather)
  return (
    <section
      className="relative isolate overflow-hidden rounded-[32px]"
      style={{ backgroundImage: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
    >
      {weather?.scene === 'clear' || !weather ? <Glows /> : null}
      <WeatherOverlay w={weather} fall={440} />
      <div className="grid grid-cols-[0.9fr_1.1fr] items-center gap-8 py-8 pl-14 pr-8">
        <div>
          <h1 className={`text-[52px] font-extrabold leading-[1.04] tracking-tight ${palette.dark ? 'text-white' : 'text-ink'}`}>
            Same-day
            <br />
            <RotatingWord />
          </h1>
          <p className={`mt-3 max-w-md text-[16px] leading-relaxed ${palette.dark ? 'text-white/70' : 'text-ink/60'}`}>
            Cakes, flowers and keepsakes, wrapped with care. {promise}.
          </p>
        </div>
        <Link href="/search" aria-label="Explore gifts" className="block">
          <DeliveryScene className="h-auto w-full" weather={weather} />
        </Link>
      </div>
    </section>
  )
}
