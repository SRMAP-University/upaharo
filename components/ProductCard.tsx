'use client'

import { useState } from 'react'
import { isFoodProduct } from '@/lib/food-products'
import Image from 'next/image'
import Link from 'next/link'
import { useCartStore } from '@/lib/store/cart'
import { formatPriceCompact as formatCardPrice } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/image-url'
import FoodTypeBadge from '@/components/FoodTypeBadge'

interface ProductCardProps {
  product: {
    id: string
    name: string
    miniDescription?: string | null
    description: string
    price: number
    image: string
    isVeg: boolean
    showFoodTypeLabel?: boolean
    category?: string
    discount?: number | null
    prepTime: number
  }
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, items, updateQuantity } = useCartStore()
  const [imageLoaded, setImageLoaded] = useState(false)
  const cartItem = items.find((item) => item.id === product.id)
  const quantity = cartItem?.quantity || 0

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem({
      id: product.id,
      name: product.name,
      price: discountedPrice,
      image: imageUrl,
      isVeg: product.isVeg,
    })
  }

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(product.id, quantity + 1)
  }

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(product.id, quantity - 1)
  }

  const discountedPrice = product.discount
    ? product.price - (product.price * product.discount) / 100
    : product.price
  const cardDescription = String(product.miniDescription || product.description || '').trim()
  const imageUrl = resolveImageUrl(product.image)

  const hasDiscount = Boolean(product.discount && product.discount > 0)

  // Studio card: the photo sits in a soft grey well with a round "+" on it;
  // name and a bold price underneath, no box around the card.
  return (
    <Link href={`/products/${product.id}`} className="group block active:scale-[0.985] transition-transform">
      <div className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-mist">
        {!imageLoaded ? <div className="absolute inset-0 animate-pulse bg-mist-deep" /> : null}
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          loading="lazy"
          quality={70}
          onLoad={() => setImageLoaded(true)}
          className={`object-cover transition-all duration-500 [@media(hover:hover)]:group-hover:scale-[1.04] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />

        {hasDiscount ? (
          <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
            −{Math.round(product.discount!)}%
          </span>
        ) : null}

        {product.showFoodTypeLabel && isFoodProduct(product) && (
          <div className="absolute right-2.5 top-2.5">
            <FoodTypeBadge isVeg={product.isVeg} />
          </div>
        )}

        {quantity === 0 ? (
          <button
            onClick={handleAdd}
            aria-label={`Add ${product.name} to cart`}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-[0_4px_14px_-4px_rgba(0,0,0,0.25)] transition hover:bg-ink hover:text-white active:scale-90"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        ) : (
          <div className="absolute bottom-2 right-2 flex items-center rounded-full bg-ink text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]">
            <button
              onClick={handleDecrement}
              aria-label="One less"
              className="flex h-9 w-9 items-center justify-center text-base font-bold leading-none active:scale-90"
            >
              −
            </button>
            <span className="min-w-[14px] text-center text-[13px] font-bold">{quantity}</span>
            <button
              onClick={handleIncrement}
              aria-label="One more"
              className="flex h-9 w-9 items-center justify-center text-base font-bold leading-none active:scale-90"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="px-0.5 pt-2.5">
        <h3 className="line-clamp-1 text-[14px] font-semibold leading-snug text-ink">{product.name}</h3>
        {cardDescription ? (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-ink/45">{cardDescription}</p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 leading-tight">
          <span className="whitespace-nowrap text-[15px] font-extrabold text-ink">{formatCardPrice(discountedPrice)}</span>
          {hasDiscount ? (
            <s className="whitespace-nowrap text-[12px] font-medium text-ink/35">{formatCardPrice(product.price)}</s>
          ) : null}
        </p>
      </div>
    </Link>
  )
}
