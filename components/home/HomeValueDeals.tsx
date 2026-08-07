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
}) {
  if (products.length === 0) return null

  return (
    <section className="space-y-3 rounded-[24px] border border-[#D9D2E8] bg-[#F3F0F8] p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blush">
            {title}
          </p>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            {subtitle || 'DEALS'}
          </h2>
          {promoText ? (
            <p className="mt-1 text-xs font-medium text-ink/55">{promoText}</p>
          ) : null}
        </div>
        <Link
          href="/search?sort=discount"
          className="text-xs font-bold text-blush"
        >
          See all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {products.map((product) => (
          <div key={product.id} className="w-[148px] flex-shrink-0 sm:w-[168px]">
            <ProductCard product={product as any} />
          </div>
        ))}
      </div>
    </section>
  )
}
