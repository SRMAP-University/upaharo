import Image from 'next/image'
import Link from 'next/link'
import { resolveImageUrl } from '@/lib/image-url'

type Category = {
  id: string
  name: string
  image?: string | null
}

type PremiumCategoryStripProps = {
  categories: Category[]
  variant?: 'round' | 'tile'
}

const accentRings = [
  'from-rose-brand/20 to-gold/20',
  'from-gold/25 to-rose-brand/15',
  'from-wine/15 to-rose-brand/20',
  'from-rose-brand/15 to-gold/25',
]

export default function PremiumCategoryStrip({ categories, variant = 'round' }: PremiumCategoryStripProps) {
  if (categories.length === 0) return null

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide sm:gap-6 lg:flex-wrap lg:overflow-visible lg:justify-start">
      {categories.map((category, index) => {
        const imageUrl = category.image ? resolveImageUrl(category.image) : null
        const ring = accentRings[index % accentRings.length]

        return (
          <Link
            key={category.id}
            href={`/categories/${category.id}`}
            className="group flex flex-shrink-0 flex-col items-center gap-2.5"
          >
            <span
              className={`relative flex items-center justify-center bg-gradient-to-br p-[2px] transition-transform duration-300 group-hover:-translate-y-1 ${ring} ${
                variant === 'round'
                  ? 'h-[78px] w-[78px] rounded-full sm:h-[92px] sm:w-[92px] lg:h-[104px] lg:w-[104px]'
                  : 'h-24 w-24 rounded-[26px] lg:h-28 lg:w-28'
              }`}
            >
              <span
                className={`relative h-full w-full overflow-hidden bg-cream ${
                  variant === 'round' ? 'rounded-full' : 'rounded-[24px]'
                }`}
              >
                {imageUrl ? (
                  <Image src={imageUrl} alt={category.name} fill className="object-cover" sizes="92px" quality={62} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-wine">
                    {category.name.charAt(0)}
                  </span>
                )}
              </span>
            </span>
            <span className="max-w-[84px] text-center text-[12px] font-medium leading-tight text-ink/75 line-clamp-2 sm:text-[13px]">
              {category.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
