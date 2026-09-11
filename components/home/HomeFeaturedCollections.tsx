import Image from 'next/image'
import Link from 'next/link'
import { resolveImageUrl } from '@/lib/image-url'

type FeaturedTile = {
  id: string
  name: string
  image?: string | null
}

export default function HomeFeaturedCollections({
  title = 'Featured',
  items,
}: {
  title?: string
  items: FeaturedTile[]
}) {
  const tiles = items.filter((item) => item.image).slice(0, 3)
  if (tiles.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-ink/55">{title}</h2>
      <div className={`grid gap-3 lg:gap-4 ${tiles.length === 1 ? 'grid-cols-1' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {tiles.map((item) => (
          <Link
            key={item.id}
            href={`/categories/${item.id}`}
            className="group relative block overflow-hidden rounded-[22px] lg:rounded-[26px]"
          >
            <div className="relative h-[240px] w-full lg:h-[380px]">
              <Image
                src={resolveImageUrl(item.image!)}
                alt={item.name}
                fill
                quality={80}
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
                sizes="(min-width: 1024px) 33vw, 100vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-4 pb-4 pt-16">
                <p className="truncate text-base font-semibold text-white drop-shadow lg:text-lg">
                  {item.name}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
