/**
 * Season categories ("Wedding Gifts", "Winter Warmers"): shop categories that
 * gather matching gifts from across the shop, so nothing has to be moved out
 * of its own category. A product shows in one when it is filed under it or
 * tagged with its name, or when its name has one of the season's words.
 *
 * While the season is on (see lib/occasions.ts) its category moves to the
 * front of the home category grid and the hero dresses up for it.
 */

export type SeasonKey = 'wedding' | 'winter'

export type SeasonCategory = {
  key: SeasonKey
  /** Name used when the category is created (scripts/_ensure-season-categories.mjs). */
  name: string
  shortName: string
  /** Which category names count as this season's category. */
  pattern: RegExp
  /** Occasions (lib/occasions.ts) during which this season is on. */
  occasionIds: string[]
  /** Words that clearly mark a gift for the season (matched in the product name). */
  core: string[]
  /** Fill-ins when only a few gifts match the core words. */
  broad: string[]
}

export const SEASON_CATEGORIES: SeasonCategory[] = [
  {
    key: 'wedding',
    name: 'Wedding Gifts',
    shortName: 'Wedding',
    pattern: /wedding|marriage|bibaha|bride|groom/i,
    occasionIds: ['wedding-season', 'wedding-season-magh'],
    core: [
      'wedding', 'bibaha', 'bihe', 'marriage', 'married', 'bride', 'groom', 'couple', 'engagement', 'ring',
      'shagun', 'sagun', 'janti', 'mehendi', 'mehndi', 'haldi', 'jewellery', 'jewelry', 'necklace', 'pote',
      'chura', 'sindoor', 'tilhari', 'saree', 'sari', 'dinner set', 'silver',
    ],
    broad: ['hamper', 'gift set', 'dry fruit', 'photo frame', 'frame', 'bouquet', 'flower', 'mr and mrs', 'his and her'],
  },
  {
    key: 'winter',
    name: 'Winter Warmers',
    shortName: 'Winter',
    pattern: /winter/i,
    occasionIds: ['winter'],
    core: [
      'winter', 'warm', 'warmer', 'woolen', 'woollen', 'wool', 'knit', 'knitted', 'shawl', 'pashmina', 'scarf',
      'muffler', 'beanie', 'gloves', 'socks', 'sweater', 'hoodie', 'jacket', 'blanket', 'cozy', 'cosy',
      'hot chocolate', 'cocoa', 'thermos', 'flask', 'mug', 'lip balm', 'body butter', 'lotion', 'moisturiser',
      'moisturizer',
    ],
    broad: ['tea', 'coffee', 'honey', 'candle', 'chocolate', 'dry fruit', 'nuts', 'soup'],
  },
]

type ActiveLike = { id: string; categoryPattern?: RegExp }

/** Seasons that are on, given the active occasions (lib/occasions.ts activeOccasions). */
export function seasonsOn(active: ActiveLike[]): SeasonCategory[] {
  const on = new Set(active.map((occasion) => occasion.id))
  return SEASON_CATEGORIES.filter((season) => season.occasionIds.some((id) => on.has(id)))
}

/**
 * Category order for the home page: categories for what is on now first (most
 * important occasion first), then the rest as they were, and season categories
 * whose season is over at the end.
 */
export function orderCategoriesForSeason<C extends { name: string }>(categories: C[], active: ActiveLike[]): C[] {
  const on = new Set(active.map((occasion) => occasion.id))
  const rank = (name: string) => {
    const lead = active.findIndex((occasion) => occasion.categoryPattern?.test(name))
    if (lead >= 0) return lead
    const season = seasonCategoryFor(name)
    if (season && !season.occasionIds.some((id) => on.has(id))) return 1000
    return 500
  }
  return categories
    .map((category, index) => ({ category, index, rank: rank(category.name) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.category)
}

/** The season a category belongs to, by its name (PRODUCT categories only). */
export function seasonCategoryFor(name: string | null | undefined): SeasonCategory | null {
  const text = String(name || '')
  return SEASON_CATEGORIES.find((season) => season.pattern.test(text)) ?? null
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-word test for any of the words, allowing plurals ("rings", "boxes"). */
export function wordTest(words: string[]) {
  const pattern = new RegExp(`\\b(?:${words.map((w) => escapeRegExp(w).replace(/\s+/g, '\\s+')).join('|')})(?:e?s)?\\b`, 'i')
  return (text: string | null | undefined) => pattern.test(String(text || ''))
}

type Listed = { id: string; name: string; category?: string | null }
type Where = Record<string, unknown>

/**
 * A season category's products, best first: gifts filed or tagged under it,
 * then gifts whose name has a season word, then (only when that is a short
 * list) related fill-ins. `find` runs one product query with the given filter.
 */
export async function listSeasonCategoryProducts<P extends Listed>(
  season: SeasonCategory,
  categoryName: string,
  baseWhere: Where,
  find: (where: Where) => Promise<P[]>,
  limit = 60,
): Promise<P[]> {
  const containsAny = (words: string[]) => words.map((word) => ({ name: { contains: word, mode: 'insensitive' } }))
  const withBase = (extra: Where) => ({ ...baseWhere, AND: [...((baseWhere.AND as Where[]) || []), extra] })

  const [members, byCore] = await Promise.all([
    find(withBase({ OR: [{ category: categoryName }, { tags: { has: categoryName } }] })),
    find(withBase({ OR: containsAny(season.core) })),
  ])
  const isCore = wordTest(season.core)

  const out: P[] = []
  const seen = new Set<string>()
  const add = (list: P[], keep: (p: P) => boolean = () => true) => {
    for (const product of list) {
      if (out.length >= limit) return
      if (seen.has(product.id) || !keep(product)) continue
      seen.add(product.id)
      out.push(product)
    }
  }
  add(members)
  add(byCore, (p) => isCore(p.name))

  if (out.length < 8) {
    const isBroad = wordTest(season.broad)
    add(await find(withBase({ OR: containsAny(season.broad) })), (p) => isBroad(p.name))
  }
  return out
}
