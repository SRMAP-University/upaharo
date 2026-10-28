/**
 * Picks products for the current moment (festival, love occasion, rain,
 * time of day) and orders the home feeds with them. Used by the website
 * home, `/api/products` (the app's home grid) and `/api/recommendations/moments`.
 */
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { findManyProductsCompat } from '@/lib/product-db'
import { getOrSetJson } from '@/lib/redis'
import { festiveLeadingFeed } from '@/lib/festive-products'
import { shopperScorer, type ShopperSignals } from '@/lib/festive-ranking'
import { getShoppingContext, signalScorer, type ContextSignal, type ShoppingContext } from '@/lib/shopping-context'

const PER_MOMENT = 12
/** A product needs at least this score to count as fitting a signal. */
const MIN_FIT = 3

type Candidate = {
  id: string
  name: string
  category: string
  tags: string[]
  description?: string | null
  createdAt?: Date | string
  [key: string]: unknown
}

/** Available products that could fit a signal, cached 10 minutes per store and signal. */
async function candidatesFor(storeId: string, signal: ContextSignal): Promise<Candidate[]> {
  return getOrSetJson(`context-candidates:v1:${storeId}:${signal.id}`, 600, async () => {
    const categoryNames = signal.categoryPattern
      ? (
          await prisma.category.findMany({
            where: { storeId, isActive: true },
            select: { name: true },
          })
        )
          .map((c) => c.name)
          .filter((name) => signal.categoryPattern!.test(name))
      : []
    const words = signal.keywords.slice(0, 30)
    const products = await findManyProductsCompat({
      where: {
        storeId,
        isAvailable: true,
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
        OR: [
          ...words.map((word) => ({ name: { contains: word, mode: 'insensitive' as const } })),
          ...(categoryNames.length
            ? [{ category: { in: categoryNames } }, { tags: { hasSome: categoryNames.map((n) => n.trim()) } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    return products as unknown as Candidate[]
  })
}

export type Moment = {
  id: string
  kind: ContextSignal['kind']
  emoji: string
  eyebrow: string
  title: string
  subtitle: string
  products: Candidate[]
  occasion?: ContextSignal['occasion']
}

/**
 * One product row per signal (occasion, weather, time of day), each ordered
 * by fit and then by the shopper's own searches and views. Products show in
 * one row only so the rows stay different.
 */
export async function buildMoments(
  storeId: string,
  context: ShoppingContext,
  shopper: ShopperSignals = { searches: [], viewedProductIds: [], viewedCategories: [] }
): Promise<Moment[]> {
  const used = new Set<string>()
  const moments: Moment[] = []
  for (const signal of context.signals) {
    const pool = await candidatesFor(storeId, signal)
    const fit = signalScorer(signal)
    const personal = shopperScorer(pool, shopper)
    const ranked = pool
      .map((product, index) => ({ product, fit: fit(product), index }))
      .filter((entry) => entry.fit >= MIN_FIT && !used.has(entry.product.id) && !context.outOfSeason(entry.product))
      .map((entry) => ({ ...entry, score: entry.fit + (personal ? personal(entry.product) * 1.5 : 0) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, PER_MOMENT)
      .map((entry) => entry.product)
    // A row with only a couple of products looks broken; skip it.
    if (ranked.length < 4) continue
    ranked.forEach((p) => used.add(p.id))
    moments.push({
      id: signal.id,
      kind: signal.kind,
      emoji: signal.emoji,
      eyebrow: signal.eyebrow,
      title: signal.title,
      subtitle: signal.subtitle,
      products: ranked,
      occasion: signal.occasion,
    })
  }
  return moments
}

const isTiharTime = (context: ShoppingContext) =>
  context.signals[0]?.kind === 'occasion' && ['tihar', 'bhai-tika'].includes(context.signals[0].occasion?.id || '')

/**
 * The home feed for right now: the leading occasion's products first (Tihar
 * keeps its own festive collection), then the usual newest-first list with a
 * few products that fit the weather or time of day moved up, and last
 * season's occasion gifts moved to the end.
 */
export async function contextLeadingFeed<T extends { id: string }>(
  storeId: string,
  base: T[],
  limit: number,
  options: { lat?: number; lng?: number; storeSlug?: string } = {}
): Promise<T[]> {
  const context = await getShoppingContext(options)
  const offSeason = (product: T) => context.outOfSeason(product as unknown as Candidate)

  let lead: T[] = isTiharTime(context) ? await festiveLeadingFeed(storeId, [] as T[], 60) : []
  // Stores without a Tihar collection (grocery) lead with the occasion's matching products.
  if (lead.length === 0) {
    const occasion = context.signals.find((s) => s.kind === 'occasion')
    if (occasion) {
      const fit = signalScorer(occasion)
      lead = ((await candidatesFor(storeId, occasion)) as unknown as T[])
        .map((product, index) => ({ product, score: fit(product as unknown as Candidate), index }))
        .filter((entry) => entry.score >= MIN_FIT && !offSeason(entry.product))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, 24)
        .map((entry) => entry.product)
    }
  }

  const leadIds = new Set(lead.map((p) => p.id))
  const rest = base.filter((p) => !leadIds.has(p.id))
  // Weather and time of day nudge, they don't take over: up to 8 fitting products move to the top of the rest.
  const nudges = context.signals.filter((s) => s.kind !== 'occasion').map((s) => ({ signal: s, fit: signalScorer(s) }))
  const nudged = rest
    .map((product, index) => ({
      product,
      index,
      score: offSeason(product)
        ? 0
        : nudges.reduce((sum, n) => sum + (n.fit(product as unknown as Candidate) >= MIN_FIT ? n.signal.weight : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 8)
  const nudgedIds = new Set(nudged.map((entry) => entry.product.id))
  const remaining = rest.filter((p) => !nudgedIds.has(p.id))

  return [
    ...lead,
    ...nudged.map((entry) => entry.product),
    ...remaining.filter((p) => !offSeason(p)),
    ...remaining.filter(offSeason),
  ].slice(0, limit)
}
