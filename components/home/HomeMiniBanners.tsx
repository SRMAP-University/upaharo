'use client'

import Image from 'next/image'
import Link from 'next/link'
import { resolveImageUrl } from '@/lib/image-url'

export type HomeMiniBanner = {
  id: string
  title: string
  image: string
  linkType?: string | null
  linkId?: string | null
}

function hrefFor(banner: HomeMiniBanner): string | null {
  if (!banner.linkId) return null
  if (banner.linkType === 'PRODUCT') return `/products/${banner.linkId}`
  if (banner.linkType === 'CATEGORY') return `/categories/${banner.linkId}`
  return null
}

export default function HomeMiniBanners({
  banners,
  title,
  columns = 3,
  height = 96,
}: {
  banners: HomeMiniBanner[]
  title?: string
  columns?: number
  height?: number
}) {
  if (banners.length === 0) return null

  const cols = Math.min(4, Math.max(2, columns))

  return (
    <section className="space-y-3">
      {title ? (
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-ink/55">
          {title}
        </h2>
      ) : null}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {banners.map((banner) => {
          const href = hrefFor(banner)
          const image = (
            <div
              className="relative w-full overflow-hidden rounded-2xl border border-blush/20 bg-blush-soft shadow-[0_12px_28px_-24px_rgba(232,90,140,0.55)]"
              style={{ height }}
            >
              <Image
                src={resolveImageUrl(banner.image)}
                alt={banner.title}
                fill
                quality={70}
                className="object-cover"
                sizes="(max-width: 768px) 33vw, 200px"
              />
            </div>
          )
          return href ? (
            <Link key={banner.id} href={href} className="block">
              {image}
            </Link>
          ) : (
            <div key={banner.id}>{image}</div>
          )
        })}
      </div>
    </section>
  )
}
