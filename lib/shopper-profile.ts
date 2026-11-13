import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { getUserSearches } from '@/lib/search-history'

/**
 * What the shop assistant knows about a shopper: recent product clicks and
 * views, searches, categories and cart adds (kept on the device), plus views
 * and searches saved for signed-in shoppers. Used to pick products and to
 * steer the AI chat.
 */

export type ShopperSignals = {
  viewed?: string[]
  categories?: string[]
  searches?: string[]
  cartAdds?: string[]
}

export type ProfileProduct = {
  id: string
  name: string
  price: number
  image: string
  category: string | null
  discount: number | null
  miniDescription: string | null
}

export type ShopperProfile = {
  /** Favourite categories, strongest first. */
  categories: string[]
  /** Typical spend, from what they look at and add to the cart. */
  priceBand: { min: number; max: number; typical: number } | null
  searches: string[]
  /** Products they looked at, newest first, still on sale. */
  viewed: ProfileProduct[]
  cartIds: string[]
  /** How much we know: 0 = nothing yet. */
  strength: number
}

export const PRODUCT_SELECT = {
  id: true,
  name: true,
  price: true,
  image: true,
  category: true,
  discount: true,
  miniDescription: true,
} as const

const clean = (list: unknown, max: number, len = 80) =>
  (Array.isArray(list) ? list : [])
    .map((v) => String(v ?? '').trim().slice(0, len))
    .filter(Boolean)
    .filter((v, i, all) => all.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
    .slice(0, max)

export function sanitizeSignals(input: unknown): ShopperSignals {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return {
    viewed: clean(raw.viewed, 30, 40),
    categories: clean(raw.categories, 12),
    searches: clean(raw.searches, 10),
    cartAdds: clean(raw.cartAdds, 20, 40),
  }
}

export function toProfileProduct(p: {
  id: string
  name: string
  price: unknown
  image: string
  category: string | null
  discount: unknown
  miniDescription?: string | null
}): ProfileProduct {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price) || 0,
    image: p.image,
    category: p.category,
    discount: p.discount ? Number(p.discount) : null,
    miniDescription: p.miniDescription ?? null,
  }
}

export async function buildShopperProfile(
  storeId: string,
  signals: ShopperSignals,
  userId: string | null
): Promise<ShopperProfile> {
  const viewedIds = [...(signals.viewed || [])]
  const searches = [...(signals.searches || [])]

  if (userId) {
    const [events, saved] = await Promise.all([
      prisma.productViewEvent
        .findMany({
          where: { storeId, userId, viewedAt: { gte: new Date(Date.now() - 60 * 86400000) } },
          orderBy: { viewedAt: 'desc' },
          take: 40,
          select: { productId: true },
        })
        .catch(() => []),
      getUserSearches(storeId, userId).catch(() => [] as string[]),
    ])
    for (const e of events) if (!viewedIds.includes(e.productId)) viewedIds.push(e.productId)
    for (const q of saved) if (!searches.some((s) => s.toLowerCase() === q.toLowerCase())) searches.push(q)
  }

  const cartIds = signals.cartAdds || []
  const ids = Array.from(new Set([...viewedIds.slice(0, 30), ...cartIds]))
  const found = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids }, storeId, isAvailable: true, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } },
        select: PRODUCT_SELECT,
      })
    : []
  const byId = new Map(found.map((p) => [p.id, toProfileProduct(p)]))
  const viewed = viewedIds.map((id) => byId.get(id)).filter(Boolean) as ProfileProduct[]
  const carted = cartIds.map((id) => byId.get(id)).filter(Boolean) as ProfileProduct[]

  // Category score: recent first, cart adds count double.
  const score = new Map<string, number>()
  const bump = (name: string | null | undefined, by: number) => {
    const key = String(name || '').trim()
    if (key) score.set(key, (score.get(key) || 0) + by)
  }
  ;(signals.categories || []).forEach((c, i) => bump(c, Math.max(1, 4 - i * 0.5)))
  viewed.slice(0, 20).forEach((p, i) => bump(p.category, Math.max(0.5, 2 - i * 0.1)))
  carted.forEach((p) => bump(p.category, 3))
  const categories = Array.from(score.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 5)

  const prices = [...carted, ...viewed.slice(0, 15)].map((p) => p.price).filter((n) => n > 0).sort((a, b) => a - b)
  const typical = prices.length ? prices[Math.floor(prices.length / 2)] : 0
  const priceBand = prices.length >= 2 ? { min: Math.round(typical * 0.55), max: Math.round(typical * 1.6), typical } : null

  return {
    categories,
    priceBand,
    searches: searches.slice(0, 8),
    viewed,
    cartIds,
    strength: Math.min(10, viewed.length + carted.length * 2 + searches.length + (signals.categories?.length || 0)),
  }
}

/** One short paragraph for the AI prompt (never shown to the shopper as-is). */
export function describeProfile(profile: ShopperProfile) {
  if (profile.strength === 0) return ''
  const parts: string[] = []
  if (profile.categories.length) parts.push(`Likes: ${profile.categories.slice(0, 3).join(', ')}.`)
  if (profile.priceBand) parts.push(`Usually looks at items around NPR ${Math.round(profile.priceBand.typical)}.`)
  if (profile.searches.length) parts.push(`Recent searches: ${profile.searches.slice(0, 4).map((s) => `"${s}"`).join(', ')}.`)
  if (profile.viewed.length) parts.push(`Recently viewed: ${profile.viewed.slice(0, 4).map((p) => p.name.slice(0, 50)).join('; ')}.`)
  return parts.join(' ')
}

/** Order products so the shopper's favourite categories and usual price come first. */
export function personalRank<T extends { id: string; category: string | null; price: number; discount?: number | null }>(
  products: T[],
  profile: ShopperProfile
): T[] {
  if (profile.strength === 0 || products.length < 2) return products
  const catRank = new Map(profile.categories.map((c, i) => [c.toLowerCase(), i]))
  const seen = new Set(profile.viewed.map((p) => p.id))
  const scoreOf = (p: T, index: number) => {
    let s = -index * 0.15 // keep the original order as a tie-breaker
    const rank = catRank.get(String(p.category || '').toLowerCase())
    if (rank != null) s += 3 - rank * 0.6
    if (profile.priceBand && p.price > 0) {
      const ratio = p.price / profile.priceBand.typical
      s += ratio >= 0.6 && ratio <= 1.6 ? 1.5 : ratio > 2.5 ? -1 : 0
    }
    if (p.discount && p.discount > 0) s += 0.4
    if (seen.has(p.id)) s -= 0.5 // fresh ideas before things they already saw
    return s
  }
  return products
    .map((p, i) => ({ p, s: scoreOf(p, i) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p)
}
