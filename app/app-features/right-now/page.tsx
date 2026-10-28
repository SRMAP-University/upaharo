'use client'

import { useEffect, useRef, useState } from 'react'
import { appBridge } from '@/lib/app-bridge'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceCompact } from '@/lib/utils'

/**
 * Web feature for the app's home screen (inline block at `home.top`, set up
 * on the admin "App features" page): products for the coming festival or
 * love occasion, the weather and the time of day in Nepal.
 */

type Product = { id: string; name: string; price: number; discount?: number; image: string }
type Moment = { id: string; emoji: string; eyebrow: string; title: string; subtitle: string; products: Product[] }

const salePrice = (p: Product) => p.price - (p.price * (p.discount || 0)) / 100

export default function RightNowFeature() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [moments, setMoments] = useState<Moment[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  useEffect(() => {
    // Inline blocks sit on the app's own background.
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    const params = new URLSearchParams(window.location.search)
    const query = new URLSearchParams()
    const store = params.get('store')
    if (store) query.set('store', store)
    fetch(`/api/recommendations/moments?${query.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list: Moment[] = Array.isArray(data?.moments) ? data.moments : []
        setMoments(list)
        setActiveId(list[0]?.id ?? null)
      })
      .catch(() => setMoments([]))
  }, [])

  // Inline blocks grow to fit the page (and collapse when there is nothing to show).
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => appBridge.resize(el.scrollHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const open = (path: string) => {
    if (!appBridge.open(path)) window.location.href = path
  }

  const add = (product: Product) => {
    appBridge.haptic('light')
    if (!appBridge.addToCart(product.id)) {
      open(`/products/${product.id}`)
      return
    }
    setAdded(product.id)
    window.setTimeout(() => setAdded((id) => (id === product.id ? null : id)), 1400)
  }

  const active = moments?.find((m) => m.id === activeId) || moments?.[0]

  return (
    <div ref={rootRef} className="text-ink">
      {moments === null ? (
        <div className="px-4 pb-2 pt-3">
          <div className="h-4 w-32 animate-pulse rounded bg-wine/10" />
          <div className="mt-2 h-6 w-52 animate-pulse rounded bg-wine/10" />
          <div className="mt-3 flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 w-36 shrink-0 animate-pulse rounded-2xl bg-wine/5" />
            ))}
          </div>
        </div>
      ) : !active ? null : (
        <div className="pb-2 pt-3">
          <div className="px-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
              {active.emoji} {active.eyebrow}
            </p>
            <h2 className="mt-0.5 text-lg font-bold leading-tight">{active.title}</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-ink/60">{active.subtitle}</p>
          </div>

          {moments.length > 1 ? (
            <div className="mt-2.5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
              {moments.map((moment) => (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => {
                    appBridge.haptic('light')
                    setActiveId(moment.id)
                  }}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-semibold ${
                    moment.id === active.id ? 'border-wine bg-wine text-white' : 'border-wine/15 bg-white text-ink/75'
                  }`}
                >
                  <span aria-hidden>{moment.emoji}</span>
                  {moment.title}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {active.products.slice(0, 10).map((product) => (
              <div key={product.id} className="w-36 shrink-0 overflow-hidden rounded-2xl border border-wine/10 bg-white">
                <button type="button" onClick={() => open(`/products/${product.id}`)} className="block w-full text-left">
                  <div className="aspect-square w-full bg-cream">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveImageUrl(product.image)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <p className="line-clamp-2 min-h-[2.5rem] px-2.5 pt-2 text-[13px] font-semibold leading-tight">{product.name}</p>
                </button>
                <div className="flex items-center justify-between gap-1 px-2.5 pb-2.5 pt-1">
                  <span className="text-[13px] font-bold text-wine">{formatPriceCompact(salePrice(product))}</span>
                  <button
                    type="button"
                    onClick={() => add(product)}
                    aria-label={`Add ${product.name} to cart`}
                    className="flex h-7 min-w-7 items-center justify-center rounded-full bg-wine px-2 text-xs font-bold text-white"
                  >
                    {added === product.id ? '✓' : '+'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
