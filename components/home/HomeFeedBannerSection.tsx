'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceNoDecimals } from '@/lib/utils'

export type HomeFeedBanner = {
  id: string
  title: string
  subtitle?: string | null
  image: string
  link?: string | null
  bgColor?: string | null
  products?: Array<{
    id: string
    name: string
    price: number
    image: string
    discount?: number | null
    finalPrice: number
  }>
}

const ROTATE_MS = 4500

export default function HomeFeedBannerSection({
  title,
  subtitle,
  banners,
  height = 420,
}: {
  title?: string
  subtitle?: string
  banners: HomeFeedBanner[]
  height?: number
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const trioCount = Math.min(3, banners.length)
  const canAdvance = banners.length > 3
  const cardHeight = Math.max(height, 420)

  useEffect(() => {
    if (!canAdvance || paused) return
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % banners.length)
    }, ROTATE_MS)
    return () => window.clearTimeout(timer)
  }, [activeIndex, banners.length, canAdvance, paused])

  if (banners.length === 0) return null

  const visible = Array.from(
    { length: trioCount },
    (_, offset) => banners[(activeIndex + offset) % banners.length]
  )

  return (
    <section
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {title || subtitle ? (
        <div>
          {title ? (
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-ink/55">
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className="mt-1 text-sm text-ink/50">{subtitle}</p> : null}
        </div>
      ) : null}

      <div
        className={`grid gap-3 lg:gap-4 ${
          trioCount === 1 ? 'grid-cols-1' : trioCount === 2 ? 'grid-cols-2' : 'grid-cols-3'
        }`}
      >
        {visible.map((banner, index) => {
          const imageUrl = resolveImageUrl(banner.image)
          const products = (banner.products || []).slice(0, 2)
          const card = (
            <div
              className="relative overflow-hidden rounded-[22px] lg:rounded-[26px]"
              style={{ height: cardHeight, backgroundColor: banner.bgColor || '#F0F0F0' }}
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={banner.title}
                  fill
                  quality={80}
                  className="object-cover"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  priority={index === 0}
                />
              ) : null}
              <div
                className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-10"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.42) 50%, rgba(0,0,0,0.7) 100%)',
                }}
              >
                <p className="truncate text-base font-semibold text-white drop-shadow">
                  {banner.title}
                </p>
                {banner.subtitle ? (
                  <p className="truncate text-[11px] font-medium text-white/90">{banner.subtitle}</p>
                ) : null}
                {products.length > 0 ? (
                  <div className="mt-2 flex gap-1.5" style={{ height: 108 }}>
                    {products.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.id}`}
                        className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-white/95"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Image
                          src={resolveImageUrl(product.image)}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="160px"
                          quality={65}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-5">
                          <p className="line-clamp-2 text-[10px] font-medium leading-tight text-white">
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-[#D4AF37]">
                            {formatPriceNoDecimals(product.finalPrice ?? product.price)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )

          return banner.link ? (
            <a key={`${banner.id}-${index}`} href={banner.link} className="block">
              {card}
            </a>
          ) : (
            <div key={`${banner.id}-${index}`}>{card}</div>
          )
        })}
      </div>
    </section>
  )
}
