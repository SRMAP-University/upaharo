'use client'

import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import { CategoryArt } from '@/components/home/GiftArt'

/**
 * Categories with Upaharo's own illustrations.
 * Phone: compact tiles, 4 per row, two rows (the rest behind "View all").
 * Desktop: larger cards with the name, same-day note and best discount.
 */

export type ShowcaseCategory = {
  id: string
  name: string
  shortName?: string | null
  maxDiscount: number
}

// Soft circles behind the drawings, used in turn.
const TINTS = ['#FDECEA', '#FFF3DC', '#EEF0FB', '#E8F5EF', '#F5EEFB', '#FFEDE4']

const SAME_DAY = /cake|flower|bouquet|rose/i
// Two rows before "View all": 5 per row on phones and on desktop.
const INITIAL = 10

export default function CategoryShowcase({ categories }: { categories: ShowcaseCategory[] }) {
  const [all, setAll] = useState(false)
  if (categories.length === 0) return null
  const shown = all ? categories : categories.slice(0, INITIAL)

  return (
    <div>
      {/* Phone: small tiles */}
      <div className="grid grid-cols-5 gap-x-2 gap-y-3 lg:hidden">
        {shown.map((c, i) => {
          const off = Math.round(c.maxDiscount)
          return (
            <Link
              key={c.id}
              href={`/categories/${c.id}`}
              className="hs-rise group flex flex-col items-center active:scale-[0.96]"
              style={{ '--d': `${Math.min(i, 8) * 40}ms` } as CSSProperties}
            >
              <span
                className="relative flex aspect-square w-full items-center justify-center rounded-[15px] ring-1 ring-ink/[0.05]"
                style={{ backgroundColor: TINTS[i % TINTS.length] }}
              >
                <CategoryArt name={c.name} className="h-[80%] w-[80%]" />
                {off >= 10 ? (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-brand px-1 py-[1px] text-[8.5px] font-bold leading-tight text-white ring-2 ring-white">
                    -{off}%
                  </span>
                ) : null}
              </span>
              <span className="mt-1 line-clamp-2 w-full text-center text-[10px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                {c.shortName || c.name}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Desktop: larger cards */}
      <div className="hidden grid-cols-5 gap-4 lg:grid">
        {shown.map((c, i) => {
          const off = Math.round(c.maxDiscount)
          const sameDay = SAME_DAY.test(c.name)
          return (
            <Link
              key={c.id}
              href={`/categories/${c.id}`}
              className={`block hs-rise group relative h-[148px] overflow-hidden rounded-[24px] bg-white ring-1 ring-ink/[0.07] transition hover:ring-ink/[0.14] active:scale-[0.98] lg:h-[168px] lg:rounded-[26px]`}
              style={{ '--d': `${Math.min(i, 8) * 60}ms` } as CSSProperties}
            >
              <div className="relative z-10 p-4 lg:p-5">
                <p className="line-clamp-2 max-w-[70%] text-[17px] font-semibold leading-[1.2] text-ink lg:text-[18px]">
                  {c.shortName || c.name}
                </p>
                {sameDay || off >= 10 ? (
                  <span className="mt-1.5 block space-y-0.5 text-[12px] font-semibold lg:text-[13px]">
                    {sameDay ? (
                      <span className="flex items-center gap-1.5 text-[#0E7F69]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#14A887]" />
                        Same day
                      </span>
                    ) : null}
                    {off >= 10 ? <span className="block text-brand">Up to {off}% off</span> : null}
                  </span>
                ) : null}
              </div>

              <span
                aria-hidden
                className="absolute -bottom-7 -right-7 h-[118px] w-[118px] rounded-full transition-transform duration-500 group-hover:scale-105 lg:h-[128px] lg:w-[128px]"
                style={{ backgroundColor: TINTS[i % TINTS.length] }}
              />
              <CategoryArt
                name={c.name}
                className="absolute bottom-1 right-1 h-[86px] w-[86px] transition-transform duration-500 group-hover:-translate-y-1 lg:bottom-2 lg:right-2 lg:h-[92px] lg:w-[92px]"
              />
            </Link>
          )
        })}
      </div>

      {categories.length > INITIAL ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className={`mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-mist text-[15px] font-bold text-ink transition hover:bg-mist-deep active:scale-[0.99] lg:mx-auto lg:mt-6 lg:max-w-xs`}
        >
          {all ? 'Show fewer' : 'View all categories'}
          <svg className={`h-4 w-4 transition-transform ${all ? '-rotate-90' : 'rotate-90'}`} fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
