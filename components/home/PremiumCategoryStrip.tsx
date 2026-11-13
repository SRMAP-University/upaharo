import Image from 'next/image'
import Link from 'next/link'
import { resolveImageUrl } from '@/lib/image-url'
import { studioTint } from '@/lib/studio-tints'

type Category = {
  id: string
  name: string
  image?: string | null
}

type PremiumCategoryStripProps = {
  categories: Category[]
  variant?: 'round' | 'tile'
}


export default function PremiumCategoryStrip({ categories, variant = 'round' }: PremiumCategoryStripProps) {
  if (categories.length === 0) return null

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide sm:gap-6 lg:flex-wrap lg:overflow-visible lg:justify-start">
      {categories.map((category, index) => {
        const imageUrl = category.image ? resolveImageUrl(category.image) : null

        return (
          <Link
            key={category.id}
            href={`/categories/${category.id}`}
            className="group flex flex-shrink-0 flex-col items-center gap-2.5"
          >
            <span
              className={`relative flex items-center justify-center transition-transform duration-300 [@media(hover:hover)]:group-hover:-translate-y-1 ${
                variant === 'round'
                  ? 'h-[76px] w-[76px] rounded-full sm:h-[92px] sm:w-[92px] lg:h-[104px] lg:w-[104px]'
                  : 'h-[84px] w-[84px] rounded-[22px] lg:h-28 lg:w-28 lg:rounded-[26px]'
              }`}
            >
              <span
                className={`relative h-full w-full overflow-hidden ${
                  variant === 'round' ? 'rounded-full' : 'rounded-[22px] lg:rounded-[26px]'
                }`}
                style={{ backgroundColor: studioTint(index) }}
              >
                {imageUrl ? (
                  <Image src={imageUrl} alt={category.name} fill className="object-cover" sizes="92px" quality={62} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-ink/70">
                    {category.name.charAt(0)}
                  </span>
                )}
              </span>
            </span>
            <span className="max-w-[84px] text-center text-[12px] font-semibold leading-tight text-ink line-clamp-2 sm:text-[13px]">
              {category.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
