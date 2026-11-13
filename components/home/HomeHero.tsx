'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import LocationModal from '@/components/LocationModal'
import { useLocationStore } from '@/lib/store/location'

type HomeHeroProps = {
  siteName: string
  tagline?: string | null
}

type HeroSlide = {
  titleTop: string
  titleAccent: string
  titleBottom: string
  subtitle: string
  image: string
}

const SLIDE_DURATION = 6500

const trustSignals = [
  {
    label: 'Same-day delivery',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
    ),
  },
  {
    label: 'Hand-crafted with care',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 21s-7-4.35-9.33-9.02C1.36 9.34 2.6 6 5.8 6c1.96 0 3.2 1.2 4.2 2.5C11 7.2 12.24 6 14.2 6c3.2 0 4.44 3.34 3.13 5.98C19 16.65 12 21 12 21Z"
      />
    ),
  },
]

export default function HomeHero({ siteName, tagline }: HomeHeroProps) {
  const router = useRouter()
  const deliveryAddress = useLocationStore((state) => state.deliveryAddress)
  const currentLocation = useLocationStore((state) => state.currentLocation)
  const [mounted, setMounted] = useState(false)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const slides: HeroSlide[] = [
    {
      titleTop: 'Gifts that say',
      titleAccent: 'everything',
      titleBottom: "words can't.",
      subtitle:
        tagline || 'Fresh flowers, artisan cakes and thoughtfully curated gifts — delivered the same day in Kathmandu and across Nepal.',
      image:
        'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1400&q=80',
    },
    {
      titleTop: 'Celebrate every',
      titleAccent: 'sweet',
      titleBottom: 'occasion.',
      subtitle: 'Hand-finished cakes and desserts, baked fresh and delivered to their door right on time.',
      image:
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1400&q=80',
    },
    {
      titleTop: 'Thoughtful gifts,',
      titleAccent: 'beautifully',
      titleBottom: 'delivered.',
      subtitle: 'Signature bouquets and gift hampers, wrapped with care for the moments that matter most.',
      image:
        'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1400&q=80',
    },
  ]

  const total = slides.length

  useEffect(() => {
    setMounted(true)
  }, [])

  const goTo = useCallback((next: number) => setActive(((next % total) + total) % total), [total])

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => goTo(active + 1), SLIDE_DURATION)
    return () => clearTimeout(timer)
  }, [active, paused, goTo])

  const locationLabel = mounted
    ? deliveryAddress?.address ||
      currentLocation?.address ||
      deliveryAddress?.label ||
      currentLocation?.label ||
      'Choose your location'
    : 'Choose your location'

  const slide = slides[active]

  return (
    <section
      className="hero-radial relative isolate overflow-hidden rounded-[34px] border border-wine/10 px-5 py-7 sm:px-9 sm:py-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Cinematic background image, blended into the cream palette */}
      <div className="absolute inset-0 -z-10">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: {
                opacity: { duration: 1.2, ease: 'easeOut' },
                scale: { duration: SLIDE_DURATION / 1000 + 1.4, ease: 'linear' },
              },
            }}
            exit={{ opacity: 0, transition: { duration: 1, ease: 'easeInOut' } }}
            className="absolute inset-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt={slide.titleTop + ' ' + slide.titleBottom}
              className="h-full w-full object-cover"
              loading={active === 0 ? 'eager' : 'lazy'}
            />
          </motion.div>
        </AnimatePresence>
        {/* Blend the imagery into the warm cream theme so it never feels like a separate photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-cream via-cream/90 to-cream/55 sm:to-cream/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/65 to-cream/20" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_10%,rgba(194,73,106,0.14),transparent_55%),radial-gradient(120%_100%_at_100%_0%,rgba(184,137,63,0.16),transparent_55%)]" />
      </div>

      <div className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-rose-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-10 -z-10 h-52 w-52 rounded-full bg-gold/10 blur-3xl" />

      {/* Top bar */}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-semibold tracking-tight text-wine sm:text-2xl">{siteName}</span>
          <span className="hidden h-1.5 w-1.5 rounded-full bg-gold sm:block" />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.28em] text-ink/40 sm:block">
            Gifts &amp; Flowers
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsLocationModalOpen(true)}
          className="flex max-w-[58%] items-center gap-1.5 rounded-full border border-wine/15 bg-white/70 px-3 py-1.5 text-left backdrop-blur transition hover:border-wine/30 sm:max-w-[280px]"
        >
          <svg className="h-4 w-4 flex-shrink-0 text-wine" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 1 1 9.9 9.9L10 18.9l-4.95-4.95a7 7 0 0 1 0-9.9ZM10 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink/70">{locationLabel}</span>
          <svg className="h-3 w-3 flex-shrink-0 text-ink/35" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Rotating cinematic headline */}
      <div className="relative mt-7 flex min-h-[132px] max-w-2xl flex-col justify-center sm:min-h-[150px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <h1 className="font-display text-[34px] font-semibold leading-[1.05] text-ink text-balance sm:text-5xl">
              {slide.titleTop}
              <span className="italic text-wine"> {slide.titleAccent} </span>
              <br className="hidden sm:block" />
              {slide.titleBottom}
            </h1>
            <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-relaxed text-ink/55 sm:text-base">{slide.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => router.push('/search')}
        className="relative mt-6 flex w-full max-w-xl items-center gap-3 rounded-full border border-wine/15 bg-white px-5 py-3.5 text-left shadow-[0_18px_44px_-30px_rgba(17,17,17,0.7)] transition hover:border-wine/30"
      >
        <svg className="h-5 w-5 flex-shrink-0 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>
        <span className="flex-1 truncate text-sm text-ink/45">Search flowers, cakes, gifts…</span>
        <span className="hidden rounded-full bg-wine px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-white sm:block">
          Search
        </span>
      </button>

      {/* Slide indicators + trust signals */}
      <div className="relative mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          {slides.map((item, index) => (
            <button
              key={item.titleAccent}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => goTo(index)}
              className="relative h-1.5 overflow-hidden rounded-full bg-wine/15 transition-all"
              style={{ width: index === active ? 34 : 14 }}
            >
              {index === active ? (
                <motion.span
                  key={active}
                  className="absolute inset-y-0 left-0 rounded-full bg-wine"
                  initial={{ width: '0%' }}
                  animate={{ width: paused ? '35%' : '100%' }}
                  transition={{ duration: paused ? 0.3 : SLIDE_DURATION / 1000, ease: 'linear' }}
                />
              ) : null}
            </button>
          ))}
        </div>

        {trustSignals.map((signal) => (
          <div key={signal.label} className="flex items-center gap-2 text-xs font-medium text-ink/60">
            <svg className="h-4 w-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {signal.icon}
            </svg>
            {signal.label}
          </div>
        ))}
      </div>

      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
    </section>
  )
}
