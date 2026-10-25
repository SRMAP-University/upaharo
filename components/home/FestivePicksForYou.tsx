'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import ProductCard from '@/components/ProductCard'
import { getRecentViewedCategories } from '@/lib/personalization-consent'
import { getRecentSearches, getRecentViewedProductIds } from '@/lib/recommendation-session'

/** Tihar / Bhai Tika products ordered by this shopper's searches and views. */
export default function FestivePicksForYou() {
  const [products, setProducts] = useState<any[] | null>(null)
  const [personal, setPersonal] = useState(false)

  useEffect(() => {
    const searches = getRecentSearches()
    const viewed = getRecentViewedProductIds()
    const categories = getRecentViewedCategories()
    setPersonal(searches.length > 0 || viewed.length > 0 || categories.length > 0)
    const params = new URLSearchParams({
      searches: searches.join(','),
      viewed: viewed.join(','),
      categories: categories.join(','),
    })
    fetch(`/api/festive?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProducts(Array.isArray(data?.forYou) ? data.forYou.slice(0, 8) : []))
      .catch(() => setProducts([]))
  }, [])

  if (products !== null && products.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            {personal ? 'Picked for you' : 'Tihar picks'}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink lg:text-3xl">
            {personal ? 'Your Tihar & Bhai Tika picks' : 'Tihar & Bhai Tika gifts'}
          </h2>
        </div>
        <Link
          href="/bhai-tika"
          className="flex-shrink-0 rounded-full bg-wine/10 px-3.5 py-1.5 text-xs font-semibold text-wine lg:text-sm"
        >
          See all ›
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {products === null
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-[22px] border border-wine/10 bg-white">
                <div className="aspect-square animate-pulse bg-cream-deep" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-cream-deep" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-cream-deep" />
                </div>
              </div>
            ))
          : products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  )
}
