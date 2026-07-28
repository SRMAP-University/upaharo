'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import ProductCard from '@/components/ProductCard'

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

  useEffect(() => {
    setMounted(true)
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
    <div className="min-h-screen bg-cream pb-20 lg:pb-0">
      <Header />

      <div className="sticky top-16 z-40 bg-cream/95 backdrop-blur border-b border-wine/10 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-wine/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Try “flowers under 2000”…'
              className="w-full pl-12 pr-12 py-3 bg-white border border-wine/15 rounded-full outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 transition-all text-ink"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-wine/40 hover:text-wine"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        {!searchQuery ? (
          <div className="max-w-xl mx-auto">
            <div className="rounded-2xl border border-wine/15 bg-white p-4 mb-5">
              <div className="flex gap-3">
                <span className="text-wine text-xl" aria-hidden>✨</span>
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">AI search</h2>
                  <p className="text-sm text-ink/70 mt-1">
                    Search in plain language — budget, occasion, or who it’s for.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm font-semibold text-ink mb-3">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSearchQuery(s)}
                  className="rounded-full border border-wine/20 bg-white px-3 py-1.5 text-sm text-ink hover:border-wine/40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : loading && products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-[22px] border border-wine/10 bg-white">
                <div className="aspect-square w-full animate-pulse bg-cream-deep" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-cream-deep" />
                  <div className="h-3 w-full animate-pulse rounded bg-cream-deep" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-cream-deep" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-3">😔</div>
            <h2 className="font-display text-base font-semibold text-ink">No results</h2>
            <p className="text-sm text-ink/60 mt-2">Try a different budget or gift type.</p>
          </div>
        ) : (
          <>
            {(interpretation || source === 'ai') && (
              <div className="mb-4 flex items-center gap-2 text-sm text-ink/70">
                <span aria-hidden>✨</span>
                <span>{interpretation || 'AI search results'}</span>
                {loading && <span className="text-xs text-ink/40">updating…</span>}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
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
