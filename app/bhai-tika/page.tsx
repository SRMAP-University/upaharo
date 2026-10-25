import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import ProductCard from '@/components/ProductCard'
import {
  DiyaRow,
  FallingPetals,
  MarigoldGarland,
  Rangoli,
  Sparkles,
  TikaDots,
  festiveStyles,
} from '@/components/festive/FestiveDecor'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { findManyProductsCompat } from '@/lib/product-db'
import { resolveStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Bhai Tika Gifts | Upaharo',
  description:
    'Bhai Tika hampers, tika and puja essentials, and gifts for your brother or sister — delivered across Kathmandu Valley.',
  openGraph: {
    title: 'Bhai Tika Gifts | Upaharo',
    description: 'Celebrate the bond this Tihar with tika sets, hampers and gifts delivered across Kathmandu Valley.',
    siteName: 'Upaharo',
    type: 'website',
  },
}

type SectionDef = {
  id: string
  eyebrow: string
  title: string
  subtitle: string
  /** Category names, matched case-insensitively and ignoring spaces at the ends. */
  categories: string[]
  tags?: string[]
}

const SECTIONS: SectionDef[] = [
  {
    id: 'bhai-tika',
    eyebrow: 'The main event',
    title: 'Bhai Tika specials',
    subtitle: 'Hampers and gift sets made for the day.',
    categories: ['bhai tika'],
    tags: ['Bhai Tika', 'Bhai tika'],
  },
  {
    id: 'brother',
    eyebrow: 'For him',
    title: 'Gifts for your brother',
    subtitle: 'Something he’ll love long after the tika.',
    categories: ['gifts for brother'],
  },
  {
    id: 'sister',
    eyebrow: 'For her',
    title: 'Gifts for your sister',
    subtitle: 'Thank her for every blessing.',
    categories: ['gifts for sister'],
  },
  {
    id: 'puja',
    eyebrow: 'For the ceremony',
    title: 'Tika & puja essentials',
    subtitle: 'Everything for the thali and the ritual.',
    categories: ['tihar puja essentials'],
  },
  {
    id: 'tihar',
    eyebrow: 'All of Tihar',
    title: 'More Tihar favourites',
    subtitle: 'Festive picks for the five days of lights.',
    categories: ['tihar special', 'dasahin & tihar'],
    tags: ['Tihar Special', 'Tihar'],
  },
  {
    id: 'under-999',
    eyebrow: 'Easy on the pocket',
    title: 'Under Rs 999',
    subtitle: 'Sweet gestures for every budget.',
    categories: ['under rs 999'],
  },
]

const PER_SECTION = 12

const TRADITIONS = [
  {
    title: 'Saptarangi tika',
    body: 'Seven colours of tika, a sister’s blessing for her brother’s long life.',
  },
  {
    title: 'Makhamali mala',
    body: 'The velvet flower garland that never fades — just like your bond.',
  },
  {
    title: 'Masala & sweets',
    body: 'Dry fruits, sel roti and sweets shared at the end of the ceremony.',
  },
]

type SectionData = SectionDef & {
  products: any[]
  total: number
  seeAllHref: string | null
}

async function getFestiveSections(): Promise<SectionData[]> {
  try {
    const h = await headers()
    const host = h.get('host') || 'www.upaharo.com'
    const storeContext = await resolveStoreContext({ headers: h, url: `https://${host}/bhai-tika` })
    const storeId = storeContext?.store.id

    // Product categories live on product.category; occasions (Bhai Tika, Gifts for
    // Brother, …) are saved on products as tags with the trimmed occasion name.
    const categories = await prisma.category.findMany({
      where: { type: { in: ['PRODUCT', 'OCCASION'] }, isActive: true, ...(storeId ? { storeId } : {}) },
      select: { id: true, name: true, type: true },
    })
    type FestiveCategory = { id: string; name: string; type: string }
    const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c as FestiveCategory]))
    const sectionCategories = SECTIONS.map((s) =>
      s.categories.map((name) => byName.get(name)).filter((c): c is FestiveCategory => Boolean(c))
    )
    const matchesCategory = (c: FestiveCategory, product: { category?: string; tags?: string[] }) =>
      c.type === 'PRODUCT'
        ? product.category === c.name
        : Array.isArray(product.tags) && product.tags.includes(c.name.trim())
    const categoryNames = Array.from(
      new Set(sectionCategories.flat().filter((c) => c.type === 'PRODUCT').map((c) => c.name))
    )
    const tagNames = Array.from(
      new Set([
        ...SECTIONS.flatMap((s) => s.tags || []),
        ...sectionCategories.flat().filter((c) => c.type !== 'PRODUCT').map((c) => c.name.trim()),
      ])
    )

    const products = await findManyProductsCompat({
      where: {
        isAvailable: true,
        ...(storeId ? { storeId } : {}),
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
        OR: [
          ...(categoryNames.length ? [{ category: { in: categoryNames } }] : []),
          { tags: { hasSome: tagNames } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 240,
    })

    // Each product shows once, in the first section it belongs to.
    const buckets = SECTIONS.map(() => [] as any[])
    for (const product of products as any[]) {
      const tags: string[] = Array.isArray(product.tags) ? product.tags : []
      const index = SECTIONS.findIndex((section, i) => {
        const inCategory = sectionCategories[i].some((c) => matchesCategory(c, product))
        const tagged = (section.tags || []).some((tag) => tags.includes(tag))
        return inCategory || tagged
      })
      if (index >= 0) buckets[index].push(product)
    }

    return SECTIONS.map((section, i) => {
      const firstCategory = sectionCategories[i][0]
      return {
        ...section,
        products: buckets[i].slice(0, PER_SECTION),
        total: buckets[i].length,
        seeAllHref: firstCategory ? `/categories/${firstCategory.id}` : null,
      }
    })
  } catch (error) {
    console.error('Bhai Tika page data failed:', error)
    return SECTIONS.map((section) => ({ ...section, products: [], total: 0, seeAllHref: null }))
  }
}

function MarigoldDot() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#f59e0b" />
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="#b45309" strokeWidth="4" strokeDasharray="3 2.2" opacity="0.6" />
      <circle cx="10" cy="10" r="3" fill="#b45309" />
    </svg>
  )
}

function ProductSection({ section }: { section: SectionData }) {
  return (
    <section id={section.id} className="scroll-mt-6">
      <div className="mb-4 flex items-end justify-between gap-4 lg:mb-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            <MarigoldDot />
            {section.eyebrow}
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink lg:text-3xl">{section.title}</h2>
          <p className="mt-1 text-sm text-ink/55 lg:text-base">{section.subtitle}</p>
        </div>
        {section.seeAllHref && section.total > section.products.length ? (
          <Link
            href={section.seeAllHref}
            className="flex-shrink-0 rounded-full bg-wine/10 px-3.5 py-1.5 text-xs font-semibold text-wine transition hover:bg-wine/15 lg:text-sm"
          >
            See all ›
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {section.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}

export default async function BhaiTikaPage() {
  const sections = await getFestiveSections()
  const filled = sections.filter((s) => s.products.length > 0)
  const firstId = filled[0]?.id
  // Hero buttons only point at sections that have products right now.
  const secondary =
    filled.find((s) => s.id === 'brother') ||
    filled.find((s) => s.id === 'sister') ||
    filled.find((s) => s.id !== firstId)
  const secondaryLabel =
    secondary?.id === 'brother'
      ? 'Gifts for brother'
      : secondary?.id === 'sister'
        ? 'Gifts for sister'
        : secondary?.title

  return (
    <main className="min-h-screen bg-cream pb-24 lg:pb-0">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#9b2c4f_0%,#5d1d34_55%,#3a0f20_100%)] text-white">
        <Rangoli className="pointer-events-none absolute left-1/2 top-[54%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] lg:h-[760px] lg:w-[760px]" />
        <Sparkles count={16} />
        <FallingPetals count={22} fall={760} />
        <MarigoldGarland className="pointer-events-none absolute inset-x-0 top-0 h-[96px] w-full lg:h-[190px]" />

        <div className="relative mx-auto max-w-4xl px-5 pb-6 pt-32 text-center lg:pb-10 lg:pt-56">
          <p
            className={`${festiveStyles.rise} inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 backdrop-blur`}
          >
            Tihar special
          </p>
          <h1
            className={`${festiveStyles.rise} mt-5 text-[52px] font-bold leading-[0.95] tracking-tight lg:text-[96px]`}
            style={{ ['--delay' as string]: '0.08s' }}
          >
            <span className={festiveStyles.shimmerText}>Bhai Tika</span>
          </h1>
          <p
            className={`${festiveStyles.rise} mt-3 text-2xl font-semibold text-amber-200 lg:text-4xl`}
            style={{ ['--delay' as string]: '0.16s' }}
            lang="ne"
          >
            भाइटीका
          </p>
          <p
            className={`${festiveStyles.rise} mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80 lg:text-lg`}
            style={{ ['--delay' as string]: '0.24s' }}
          >
            Celebrate the bond with tika, mala and gifts they’ll treasure — delivered to their door across
            Kathmandu Valley.
          </p>
          <div
            className={`${festiveStyles.rise} mt-7 flex flex-wrap items-center justify-center gap-3`}
            style={{ ['--delay' as string]: '0.32s' }}
          >
            <a
              href={`#${firstId || 'bhai-tika'}`}
              className="inline-flex h-12 items-center rounded-2xl bg-amber-400 px-6 text-[15px] font-semibold text-[#3a0f20] shadow-[0_12px_30px_-12px_rgba(251,191,36,0.8)] transition hover:bg-amber-300"
            >
              Shop Bhai Tika gifts
            </a>
            {secondary ? (
              <a
                href={`#${secondary.id}`}
                className="inline-flex h-12 items-center rounded-2xl border border-white/30 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                {secondaryLabel}
              </a>
            ) : null}
          </div>
          <TikaDots className="mt-8 justify-center" />
        </div>

        <DiyaRow count={5} className="relative mx-auto block h-[72px] w-[300px] lg:h-[96px] lg:w-[420px]" />
        <svg className="relative block h-10 w-full text-cream lg:h-16" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path d="M0 80 L0 40 Q360 0 720 32 Q1080 64 1440 24 L1440 80 Z" fill="currentColor" />
        </svg>
      </section>

      {/* Jump links */}
      {filled.length > 1 ? (
        <nav className="border-b border-ink/10 bg-cream" aria-label="Bhai Tika sections">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 scrollbar-hide lg:px-8">
            {filled.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex-shrink-0 rounded-full border border-wine/15 bg-white px-4 py-2 text-sm font-medium text-ink/75 transition hover:border-wine/40 hover:text-wine"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 lg:space-y-16 lg:px-8 lg:py-12">
        {filled.length === 0 ? (
          <div className="rounded-[28px] border border-wine/10 bg-white px-6 py-14 text-center">
            <p className="text-lg font-semibold text-ink">Bhai Tika gifts are on their way</p>
            <p className="mt-1 text-sm text-ink/55">We’re stocking the festive shelves. Check back soon.</p>
            <Link
              href="/"
              className="mt-5 inline-flex h-11 items-center rounded-2xl bg-wine px-6 text-sm font-semibold text-white"
            >
              Browse all gifts
            </Link>
          </div>
        ) : null}

        {filled.map((section, i) => (
          <div key={section.id} className="space-y-12 lg:space-y-16">
            <ProductSection section={section} />

            {i === 1 || (filled.length < 3 && i === filled.length - 1) ? (
              <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-5 py-7 lg:px-10 lg:py-10">
                <Rangoli className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 opacity-40" />
                <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">The tradition</p>
                <h2 className="relative mt-1.5 text-2xl font-semibold tracking-tight text-ink lg:text-3xl">
                  More than a tika
                </h2>
                <div className="relative mt-5 grid gap-3 md:grid-cols-3 lg:gap-5">
                  {TRADITIONS.map((t, k) => (
                    <div key={t.title} className="rounded-2xl border border-amber-200/60 bg-white/80 p-4 backdrop-blur lg:p-5">
                      {k === 0 ? <TikaDots className="mb-3" /> : null}
                      {k === 1 ? (
                        <div className="mb-3 flex gap-1" aria-hidden>
                          {['#be185d', '#db2777', '#be185d', '#db2777', '#be185d'].map((c, n) => (
                            <span key={n} className="block h-3 w-3 rounded-full" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      ) : null}
                      {k === 2 ? (
                        <div className="mb-3 flex gap-1" aria-hidden>
                          {['#b45309', '#d97706', '#78350f', '#f59e0b'].map((c, n) => (
                            <span key={n} className="block h-3 w-4 rounded-full" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      ) : null}
                      <p className="text-base font-semibold text-ink">{t.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink/60">{t.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ))}

        {/* Closing call to action */}
        <section className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_120%_at_50%_0%,#7c2a47_0%,#3a0f20_100%)] px-6 pb-4 pt-10 text-center text-white lg:pt-14">
          <Sparkles count={10} />
          <FallingPetals count={10} fall={420} />
          <h2 className="relative text-2xl font-semibold tracking-tight lg:text-4xl">Far from home this Tihar?</h2>
          <p className="relative mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/75 lg:text-base">
            Send a tika set and a gift to your brother or sister. We deliver across Kathmandu Valley.
          </p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={`#${firstId || 'bhai-tika'}`}
              className="inline-flex h-12 items-center rounded-2xl bg-amber-400 px-6 text-[15px] font-semibold text-[#3a0f20] transition hover:bg-amber-300"
            >
              Shop Bhai Tika gifts
            </a>
            <Link
              href="/search"
              className="inline-flex h-12 items-center rounded-2xl border border-white/30 bg-white/10 px-6 text-[15px] font-semibold text-white transition hover:bg-white/20"
            >
              Search all gifts
            </Link>
          </div>
          <DiyaRow count={3} className="relative mx-auto mt-6 block h-[64px] w-[200px]" />
        </section>
      </div>

      <BottomNav hideDesktop />
    </main>
  )
}
