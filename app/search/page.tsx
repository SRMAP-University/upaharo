'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import ProductCard from '@/components/ProductCard'
import { getRecentSearches, rememberSearch } from '@/lib/recommendation-session'
import { memoryChanged } from '@/lib/shopper-memory'

const SUGGESTIONS = [
  'Flowers under 2000',
  'Birthday cake',
  'Gift for mom',
  'Plants around 1500',
  'Anniversary roses',
]

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [interpretation, setInterpretation] = useState<string | null>(null)
  const [source, setSource] = useState<'ai' | 'keyword'>('keyword')
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setMounted(true)
    setRecent(getRecentSearches().slice(0, 6))
  }, [])

  useEffect(() => {
    if (!mounted) return

    const normalizedQuery = searchQuery.trim()
    if (!normalizedQuery) {
      setProducts([])
      setInterpretation(null)
      setLoading(false)
      return
    }

    const timer = window.setTimeout(async () => {
      rememberSearch(normalizedQuery)
      memoryChanged()
      try {
        setLoading(true)
        const res = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: normalizedQuery }),
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          setProducts(data.products || [])
          setInterpretation(data.interpretation || null)
          setSource(data.source === 'ai' ? 'ai' : 'keyword')
        } else {
          // Fallback to classic product search
          const fallback = await fetch(
            `/api/products?view=card&limit=40&search=${encodeURIComponent(normalizedQuery)}`
          )
          if (fallback.ok) {
            const data = await fallback.json()
            setProducts(data.products || [])
            setInterpretation(null)
            setSource('keyword')
          }
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => window.clearTimeout(timer)
  }, [searchQuery, mounted])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white pb-20 lg:pb-0">
      <Header />

      <div className="sticky top-[61px] z-40 bg-white/95 px-4 py-3 backdrop-blur lg:top-[65px] lg:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-ink/45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Try “flowers under 2000”…'
              className="h-12 w-full rounded-2xl border border-transparent bg-mist pl-12 pr-12 text-[15px] text-ink outline-none transition-all placeholder:text-ink/40 focus:border-ink/20 focus:ring-2 focus:ring-ink/10"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transform rounded-full p-1 text-ink/45 hover:bg-mist-deep hover:text-ink"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
        {!searchQuery ? (
          <div className="max-w-2xl space-y-7">
            {recent.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[18px] font-extrabold tracking-tight text-ink">Recent searches</h2>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.localStorage.removeItem('ck-recent-searches')
                      } catch {
                        // ignore
                      }
                      setRecent([])
                    }}
                    className="text-[13px] font-bold text-brand"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((q) => (
                    <button key={q} type="button" onClick={() => setSearchQuery(q)} className="u-chip">
                      <svg className="h-3.5 w-3.5 text-ink/45" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      {q}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="text-[18px] font-extrabold tracking-tight text-ink">Try asking</h2>
              <p className="mb-3 mt-0.5 text-[13px] text-ink/50">Search in plain words: budget, occasion, or who it is for.</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setSearchQuery(s)} className="u-chip">
                    {s}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : loading && products.length === 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index}>
                <div className="aspect-square w-full animate-pulse rounded-[22px] bg-mist" />
                <div className="space-y-2 pt-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-mist" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-mist" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-3">😔</div>
            <h2 className="text-lg font-extrabold text-ink">No results</h2>
            <p className="text-sm text-ink/60 mt-2">Try a different budget or gift type.</p>
          </div>
        ) : (
          <>
            {(interpretation || source === 'ai') && (
              <div className="mb-4 flex items-center gap-2 text-[13px] font-medium text-ink/60">
                <span aria-hidden>✨</span>
                <span>{interpretation || 'AI search results'}</span>
                {loading && <span className="text-xs text-ink/40">updating…</span>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8 xl:grid-cols-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
