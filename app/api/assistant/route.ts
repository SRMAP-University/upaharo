import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { resolveUserId } from '@/lib/request-auth'
import { clearUserSearches } from '@/lib/search-history'
import { resolveStoreContext } from '@/lib/store-context'
import {
  buildShopperProfile,
  personalRank,
  PRODUCT_SELECT,
  sanitizeSignals,
  toProfileProduct,
  type ProfileProduct,
} from '@/lib/shopper-profile'

export const dynamic = 'force-dynamic'

/**
 * Shop assistant picks: rows of products for this shopper, built from their
 * recent clicks, searches, categories and cart (sent from the device) and,
 * when signed in, their saved views and searches.
 * Body: { signals: { viewed, categories, searches, cartAdds } }
 */

type Section = { key: string; title: string; note?: string; products: ProfileProduct[] }

const LIVE = { isAvailable: true, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } }

/** At most `perCategory` from one category, so a row is not all one thing. */
function spread(products: ProfileProduct[], limit: number, perCategory = 3) {
  const counts = new Map<string, number>()
  const out: ProfileProduct[] = []
  for (const p of products) {
    const key = String(p.category || '').toLowerCase()
    const n = counts.get(key) || 0
    if (n >= perCategory) continue
    counts.set(key, n + 1)
    out.push(p)
    if (out.length === limit) break
  }
  return out
}

function words(query: string) {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['for', 'and', 'the', 'with', 'gift', 'gifts', 'under', 'below', 'above'].includes(w))
    .slice(0, 4)
}

export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ sections: [] }, { status: 404 })
    const storeId = storeContext.store.id
    const body = await request.json().catch(() => ({}))
    const signals = sanitizeSignals(body?.signals)
    const userId = await resolveUserId(request).catch(() => null)
    const profile = await buildShopperProfile(storeId, signals, userId)

    const sections: Section[] = []
    const used = new Set<string>([...profile.cartIds])
    const take = (list: ProfileProduct[]) => list.filter((p) => !used.has(p.id))
    const mark = (list: ProfileProduct[]) => list.forEach((p) => used.add(p.id))

    // 1. From their favourite categories, near their usual price.
    if (profile.categories.length) {
      const pool = await prisma.product.findMany({
        where: {
          storeId,
          ...LIVE,
          category: { in: profile.categories.slice(0, 3) },
          ...(profile.priceBand ? { price: { gte: profile.priceBand.min, lte: profile.priceBand.max } } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 40,
        select: PRODUCT_SELECT,
      })
      const seen = new Set(profile.viewed.map((p) => p.id))
      const fresh = take(pool.map(toProfileProduct)).filter((p) => !seen.has(p.id))
      const picks = spread(personalRank(fresh, profile), 8)
      if (picks.length) {
        mark(picks)
        sections.push({
          key: 'for-you',
          title: 'Picked for you',
          note: `Because you like ${profile.categories.slice(0, 2).join(' and ')}`,
          products: picks,
        })
      }
    }

    // 2. More like their latest search.
    const lastSearch = profile.searches.find((q) => words(q).length > 0)
    if (lastSearch) {
      const terms = words(lastSearch)
      const termMatch = (t: string) => ({
        OR: [
          { name: { contains: t, mode: 'insensitive' as const } },
          { category: { contains: t, mode: 'insensitive' as const } },
          { miniDescription: { contains: t, mode: 'insensitive' as const } },
          { tags: { has: t } },
        ],
      })
      // Products matching every word first ("chocolate cake" = cakes), then any word.
      const [every, some] = await Promise.all([
        prisma.product.findMany({
          where: { storeId, ...LIVE, AND: terms.map(termMatch) },
          orderBy: [{ createdAt: 'desc' }],
          take: 16,
          select: PRODUCT_SELECT,
        }),
        prisma.product.findMany({
          where: { storeId, ...LIVE, OR: terms.map(termMatch) },
          orderBy: [{ createdAt: 'desc' }],
          take: 30,
          select: PRODUCT_SELECT,
        }),
      ])
      const found = [...every, ...some.filter((p) => !every.some((e) => e.id === p.id))]
      const hits = (p: ProfileProduct) => {
        const text = `${p.name} ${p.category || ''}`.toLowerCase()
        return terms.filter((t) => text.includes(t)).length
      }
      const ranked = personalRank(take(found.map(toProfileProduct)), profile)
      ranked.sort((a, b) => hits(b) - hits(a)) // stable: keeps the personal order within ties
      const picks = spread(ranked, 8, 4)
      if (picks.length) {
        mark(picks)
        sections.push({ key: 'search', title: `Because you searched “${lastSearch}”`, products: picks })
      }
    }

    // 3. Things they looked at and may come back for.
    const again = take(profile.viewed).slice(0, 8)
    if (again.length) {
      mark(again)
      sections.push({ key: 'viewed', title: 'Still thinking about these?', products: again })
    }

    // 4. Little to go on yet: what other shoppers are looking at this fortnight.
    if (sections.length < 2) {
      const popular = await prisma.productViewEvent
        .groupBy({
          by: ['productId'],
          where: { storeId, viewedAt: { gte: new Date(Date.now() - 14 * 86400000) } },
          _count: { productId: true },
          orderBy: { _count: { productId: 'desc' } },
          take: 40,
        })
        .catch(() => [])
      const ids = popular.map((r) => r.productId)
      const rows = ids.length
        ? await prisma.product.findMany({ where: { id: { in: ids }, storeId, ...LIVE }, select: PRODUCT_SELECT })
        : []
      const byId = new Map(rows.map((p) => [p.id, toProfileProduct(p)]))
      const ordered = take(ids.map((id) => byId.get(id)).filter(Boolean) as ProfileProduct[])
      const picks = spread(ordered, 8)
      if (picks.length) {
        mark(picks)
        sections.push({ key: 'popular', title: 'Popular right now', products: picks })
      }
    }

    return NextResponse.json({
      profile: {
        categories: profile.categories.slice(0, 3),
        priceBand: profile.priceBand,
        searches: profile.searches.slice(0, 4),
        strength: profile.strength,
      },
      sections,
    })
  } catch (error) {
    console.error('Assistant picks error:', error)
    return NextResponse.json({ sections: [] }, { status: 500 })
  }
}

/** "Clear my history": forget a signed-in shopper's saved views and searches in this store. */
export async function DELETE(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    const userId = await resolveUserId(request).catch(() => null)
    if (!storeContext || !userId) return NextResponse.json({ ok: true })
    const storeId = storeContext.store.id
    await Promise.all([
      prisma.productViewEvent.deleteMany({ where: { storeId, userId } }),
      clearUserSearches(storeId, userId).catch(() => undefined),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Assistant clear error:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
