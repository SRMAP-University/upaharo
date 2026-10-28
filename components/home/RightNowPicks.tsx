'use client'

import { useEffect, useState } from 'react'
import ProductCard from '@/components/ProductCard'
import { getRecentViewedCategories } from '@/lib/personalization-consent'
import { getRecentSearches, getRecentViewedProductIds } from '@/lib/recommendation-session'
import { useLocationStore } from '@/lib/store/location'

type Moment = {
  id: string
  kind: 'occasion' | 'weather' | 'daypart'
  emoji: string
  eyebrow: string
  title: string
  subtitle: string
  products: any[]
}

/**
 * "Right now" rows: the coming festival or love occasion, the weather at the
 * shopper's delivery location and the time of day, each with its own products.
 */
export default function RightNowPicks() {
  const location = useLocationStore((state) => state.deliveryAddress || state.currentLocation)
  const [moments, setMoments] = useState<Moment[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [credit, setCredit] = useState<string | null>(null)

  const lat = location?.latitude
  const lng = location?.longitude

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      searches: getRecentSearches().join(','),
      viewed: getRecentViewedProductIds().join(','),
      categories: getRecentViewedCategories().join(','),
    })
    // Rounded: the server only needs the area to check the weather.
    if (lat && lng) {
      params.set('lat', lat.toFixed(2))
      params.set('lng', lng.toFixed(2))
    }
    fetch(`/api/recommendations/moments?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const list: Moment[] = Array.isArray(data?.moments) ? data.moments : []
        setMoments(list)
        setCredit(typeof data?.weatherCredit === 'string' ? data.weatherCredit : null)
        setActiveId((current) => (current && list.some((m) => m.id === current) ? current : list[0]?.id ?? null))
      })
      .catch(() => {
        if (!cancelled) setMoments([])
      })
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (moments !== null && moments.length === 0) return null

  const active = moments?.find((m) => m.id === activeId) || moments?.[0]

  return (
    <section aria-labelledby="right-now-title">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          {active ? `${active.emoji} ${active.eyebrow}` : 'Right now'}
        </p>
        <h2 id="right-now-title" className="mt-1 text-xl font-semibold tracking-tight text-ink lg:text-3xl">
          {active?.title || 'Picked for right now'}
        </h2>
        {active?.subtitle ? <p className="mt-1 text-sm text-ink/60">{active.subtitle}</p> : null}
      </div>

      {moments && moments.length > 1 ? (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="tablist" aria-label="Right now">
          {moments.map((moment) => {
            const selected = moment.id === active?.id
            return (
              <button
                key={moment.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(moment.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  selected ? 'border-wine bg-wine text-white' : 'border-wine/15 bg-white text-ink/75 hover:border-wine/30'
                }`}
              >
                <span aria-hidden>{moment.emoji}</span>
                {moment.title}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5" role="tabpanel">
        {moments === null
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-[22px] border border-wine/10 bg-white">
                <div className="aspect-square animate-pulse bg-cream-deep" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-cream-deep" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-cream-deep" />
                </div>
              </div>
            ))
          : (active?.products || []).slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}
      </div>

      {active?.kind === 'weather' && credit ? <p className="mt-2 text-right text-[11px] text-ink/40">{credit}</p> : null}
    </section>
  )
}
