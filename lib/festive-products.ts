import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { findManyProductsCompat } from '@/lib/product-db'

export type FestiveSection = {
  id: string
  eyebrow: string
  title: string
  subtitle: string
  products: any[]
  total: number
  seeAllHref: string | null
}

const PER_SECTION = 12
const BUDGET_LIMIT = 999

const FESTIVE_WORDS = ['tihar', 'bhaitika', 'bhaitikka', 'deusi', 'bhailo', 'laxmipuja', 'lakshmipuja', 'deepawali', 'diwali']
const FESTIVE_NEPALI = /तिहार|भाइटीका|भाईटीका|भाई टीका|देउसी|भैलो|लक्ष्मी पूजा/
const BHAI_TIKA_NEPALI = /भाइटीका|भाईटीका|भाई टीका/

const squash = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '')

/** True for names such as "Tihar Special", "Dasahin & Tihar", "Bhai Tika" or "भाइटीका". */
export function isFestiveName(value: string) {
  const s = squash(value)
  return FESTIVE_WORDS.some((word) => s.includes(word)) || FESTIVE_NEPALI.test(value)
}

function isBhaiTikaName(value: string) {
  const s = squash(value)
  return s.includes('bhaitika') || s.includes('bhaitikka') || BHAI_TIKA_NEPALI.test(value)
}

type Category = { id: string; name: string; type: string }

/** Product categories live on product.category; occasions are saved as tags (trimmed name). */
function inCategory(category: Category, product: any) {
  return category.type === 'PRODUCT'
    ? product.category === category.name
    : Array.isArray(product.tags) && product.tags.includes(category.name.trim())
}

const categoryHref = (category?: Category) => (category ? `/categories/${category.id}` : null)
const salePrice = (product: any) => Number(product.price || 0) * (1 - Number(product.discount || 0) / 100)

/**
 * Every available Tihar / Bhai Tika product, grouped for the festival page.
 * Matching uses category, occasion, tag and product names, so new products
 * and new festive categories show up without any code change.
 */
export async function getFestiveSections(storeId?: string): Promise<FestiveSection[]> {
  const categories: Category[] = await prisma.category.findMany({
    where: { type: { in: ['PRODUCT', 'OCCASION'] }, isActive: true, ...(storeId ? { storeId } : {}) },
    select: { id: true, name: true, type: true },
  })

  // Tags are free text, so check every tag in use rather than a fixed list.
  const tagRows = await prisma.$queryRaw<Array<{ tag: string | null }>>(
    storeId
      ? Prisma.sql`SELECT DISTINCT unnest("tags") AS tag FROM "Product" WHERE "isAvailable" = true AND "storeId" = ${storeId}`
      : Prisma.sql`SELECT DISTINCT unnest("tags") AS tag FROM "Product" WHERE "isAvailable" = true`
  )
  const festiveTags = tagRows
    .map((row) => row.tag || '')
    .filter((tag) => tag && tag !== ARCHIVED_PRODUCT_TAG && isFestiveName(tag))

  const festiveCategories = categories.filter((c) => isFestiveName(c.name))
  const occasion = (name: string) => categories.find((c) => c.name.trim().toLowerCase() === name)
  const brother = occasion('gifts for brother')
  const sister = occasion('gifts for sister')
  const relationCategories = [brother, sister].filter((c): c is Category => Boolean(c))

  const productCategoryNames = festiveCategories.filter((c) => c.type === 'PRODUCT').map((c) => c.name)
  const tagNames = Array.from(
    new Set([
      ...festiveTags,
      ...[...festiveCategories, ...relationCategories].filter((c) => c.type !== 'PRODUCT').map((c) => c.name.trim()),
    ])
  )

  const products = await findManyProductsCompat({
    where: {
      isAvailable: true,
      ...(storeId ? { storeId } : {}),
      NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      OR: [
        ...(productCategoryNames.length ? [{ category: { in: productCategoryNames } }] : []),
        ...(tagNames.length ? [{ tags: { hasSome: tagNames } }] : []),
        { name: { contains: 'tihar', mode: 'insensitive' as const } },
        { name: { contains: 'bhai tika', mode: 'insensitive' as const } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
  })

  const bhaiTikaCategories = festiveCategories.filter((c) => isBhaiTikaName(c.name))
  const pujaCategories = festiveCategories.filter((c) => !bhaiTikaCategories.includes(c) && /puja/i.test(c.name))
  const otherCategories = festiveCategories.filter(
    (c) => !bhaiTikaCategories.includes(c) && !pujaCategories.includes(c)
  )

  type Slot = { section: Omit<FestiveSection, 'products' | 'total'>; match: (product: any) => boolean; auto?: boolean }
  const slots: Slot[] = [
    {
      section: {
        id: 'bhai-tika',
        eyebrow: 'The main event',
        title: 'Bhai Tika specials',
        subtitle: 'Hampers and gift sets made for the day.',
        seeAllHref: categoryHref(bhaiTikaCategories[0]),
      },
      match: (p) =>
        bhaiTikaCategories.some((c) => inCategory(c, p)) ||
        [p.name, ...(Array.isArray(p.tags) ? p.tags : [])].some((text: string) => isBhaiTikaName(String(text))),
    },
    ...(brother
      ? [
          {
            section: {
              id: 'brother',
              eyebrow: 'For him',
              title: 'Gifts for your brother',
              subtitle: 'Something he’ll love long after the tika.',
              seeAllHref: categoryHref(brother),
            },
            match: (p: any) => inCategory(brother, p),
          },
        ]
      : []),
    ...(sister
      ? [
          {
            section: {
              id: 'sister',
              eyebrow: 'For her',
              title: 'Gifts for your sister',
              subtitle: 'Thank her for every blessing.',
              seeAllHref: categoryHref(sister),
            },
            match: (p: any) => inCategory(sister, p),
          },
        ]
      : []),
    ...(pujaCategories.length
      ? [
          {
            section: {
              id: 'puja',
              eyebrow: 'For the ceremony',
              title: 'Tika & puja essentials',
              subtitle: 'Everything for the thali and the ritual.',
              seeAllHref: categoryHref(pujaCategories[0]),
            },
            match: (p: any) => pujaCategories.some((c) => inCategory(c, p)),
          },
        ]
      : []),
    // Any other festive category gets its own section, named after it.
    ...otherCategories.map((c) => ({
      section: {
        id: `c-${c.id}`,
        eyebrow: 'Tihar',
        title: c.name.trim(),
        subtitle: 'Picked for the festival of lights.',
        seeAllHref: categoryHref(c),
      },
      match: (p: any) => inCategory(c, p),
      auto: true,
    })),
    {
      section: {
        id: 'tihar',
        eyebrow: 'All of Tihar',
        title: 'More Tihar favourites',
        subtitle: 'Festive picks for the five days of lights.',
        seeAllHref: null,
      },
      match: () => true,
    },
  ]

  // Each product shows once, in the first section it belongs to.
  const buckets = slots.map(() => [] as any[])
  for (const product of products as any[]) {
    const index = slots.findIndex((slot) => slot.match(product))
    if (index >= 0) buckets[index].push(product)
  }

  const sections: FestiveSection[] = slots.map((slot, i) => ({
    ...slot.section,
    products: buckets[i].slice(0, PER_SECTION),
    total: buckets[i].length,
  }))

  // Auto category sections: biggest first, between the curated ones and the catch-all.
  const curated = sections.filter((_, i) => !slots[i].auto && slots[i].section.id !== 'tihar')
  const auto = sections.filter((_, i) => slots[i].auto).sort((a, b) => b.total - a.total)
  const catchAll = sections.filter((s) => s.id === 'tihar')

  const budget = (products as any[])
    .filter((p) => salePrice(p) <= BUDGET_LIMIT)
    .sort((a, b) => salePrice(a) - salePrice(b))

  return [
    ...curated,
    ...auto,
    ...catchAll,
    {
      id: 'under-999',
      eyebrow: 'Easy on the pocket',
      title: `Under Rs ${BUDGET_LIMIT}`,
      subtitle: 'Festive gestures for every budget.',
      products: budget.slice(0, PER_SECTION),
      total: budget.length,
      seeAllHref: null,
    },
  ]
}

/** Stable sort putting Tihar / Bhai Tika products ahead of the rest. */
export function festiveFirst<T extends { name?: string; category?: string; tags?: string[] }>(products: T[]): T[] {
  const isFestive = (p: T) =>
    [p.name || '', p.category || '', ...(Array.isArray(p.tags) ? p.tags : [])].some((text) => isFestiveName(text))
  return [...products.filter(isFestive), ...products.filter((p) => !isFestive(p))]
}

/**
 * Festival-mode feed: every festive product first (from the Bhai Tika page's
 * sections), then the usual list, trimmed to `limit`. Cached briefly.
 */
export async function festiveLeadingFeed<T extends { id: string }>(storeId: string, base: T[], limit: number): Promise<T[]> {
  const { getOrSetJson } = await import('@/lib/redis')
  const festive = await getOrSetJson(`festive-feed:${storeId}`, 120, async () => {
    const sections = await getFestiveSections(storeId)
    const seen = new Set<string>()
    return sections
      .filter((s) => s.id !== 'under-999')
      .flatMap((s) => s.products)
      .filter((p: any) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
  })
  const ids = new Set((festive as any[]).map((p) => p.id))
  return [...(festive as T[]), ...base.filter((p) => !ids.has(p.id))].slice(0, limit)
}
