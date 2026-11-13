'use client'

import Link from 'next/link'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceNoDecimals } from '@/lib/utils'
import type { RecommendationProduct } from '@/types/recommendations'

type RecommendationShelfProps = {
  title: string
  description?: string
  products: RecommendationProduct[]
  actionLabel?: string
  onAdd?: (product: RecommendationProduct) => void
}

function getFinalPrice(product: RecommendationProduct) {
  return product.price - product.price * ((product.discount || 0) / 100)
}

export default function RecommendationShelf({
  title,
  description,
  products,
  actionLabel = 'Add',
  onAdd,
}: RecommendationShelfProps) {
  if (products.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="u-title text-xl sm:text-2xl">{title}</h2>
        {description ? <p className="text-sm text-ink/55">{description}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="group rounded-[22px] border border-wine/10 bg-white p-3 transition hover:-translate-y-1 hover:border-wine/20 hover:shadow-[0_26px_55px_-38px_rgba(17,17,17,0.85)]"
          >
            <Link href={`/products/${product.id}`} className="block space-y-2">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-cream-deep">
                <img
                  src={resolveImageUrl(product.image)}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div>
                <p className="line-clamp-2 font-display text-[15px] font-semibold text-ink">{product.name}</p>
                <p className="text-xs uppercase tracking-[0.15em] text-gold">{product.category}</p>
              </div>
            </Link>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-wine">{formatPriceNoDecimals(getFinalPrice(product))}</p>
                {product.discount > 0 ? (
                  <p className="text-xs text-ink/35 line-through">{formatPriceNoDecimals(product.price)}</p>
                ) : null}
              </div>
              {onAdd ? (
                <button
                  type="button"
                  onClick={() => onAdd(product)}
                  className="rounded-full bg-wine px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-wine-deep"
                >
                  {actionLabel}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
