'use client'

import Link from 'next/link'
import ProductCard from '@/components/ProductCard'

type ProductLike = {
  id: string
  name: string
  image?: string | null
  price: number
  discount?: number | null
  [key: string]: unknown
}

export default function HomeValueDeals({
  products,
  title = 'Value',
  subtitle = 'DEALS',
  promoText,
}: {
  products: ProductLike[]
  title?: string
  subtitle?: string
  promoText?: string
  unlockAmount?: number
}) {
  if (products.length === 0) return null

  return (
    <section className="space-y-4 rounded-[28px] bg-brand-soft p-4 lg:p-7">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
            {title}
          </p>
          <h2 className="text-[22px] font-extrabold tracking-tight text-ink lg:text-[28px]">
            {subtitle || 'DEALS'}
          </h2>
          {promoText ? (
            <p className="mt-1 text-xs font-medium text-ink/55 lg:text-sm">{promoText}</p>
          ) : null}
        </div>
        <Link
          href="/search?sort=discount"
          className="text-[13px] font-bold text-brand lg:text-sm"
        >
          See all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible xl:grid-cols-6">
        {products.map((product) => (
          <div key={product.id} className="w-[168px] flex-shrink-0 lg:w-auto">
            <ProductCard product={product as any} />
          </div>
        ))}
      </div>
    </section>
  )
}
