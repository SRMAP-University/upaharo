/**
 * Orders festive products for one shopper using what they searched for and
 * looked at. Pure function so the website and the app API share it.
 */
export type ShopperSignals = {
  searches: string[]
  viewedProductIds: string[]
  viewedCategories: string[]
}

const STOP_WORDS = new Set(['for', 'the', 'and', 'with', 'gift', 'gifts', 'a', 'to', 'of', 'in', 'rs'])

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
}

export function rankForShopper<T extends { id: string; name?: string; category?: string; tags?: string[]; description?: string }>(
  products: T[],
  signals: ShopperSignals
): T[] {
  const searchWords = Array.from(new Set(signals.searches.flatMap(tokens))).slice(0, 40)
  const viewed = new Set(signals.viewedProductIds)
  const likedCategories = new Set(signals.viewedCategories.map((c) => c.trim().toLowerCase()))
  // Categories of products they opened count as interest too.
  for (const p of products) {
    if (viewed.has(p.id) && p.category) likedCategories.add(p.category.trim().toLowerCase())
  }
  if (searchWords.length === 0 && likedCategories.size === 0) return products

  const scored = products.map((product, index) => {
    const text = [product.name, product.category, ...(product.tags || [])].join(' ').toLowerCase()
    const extra = String(product.description || '').toLowerCase()
    let score = 0
    for (const word of searchWords) {
      if (text.includes(word)) score += 3
      else if (extra.includes(word)) score += 1
    }
    if (product.category && likedCategories.has(product.category.trim().toLowerCase())) score += 2
    // Already opened: still relevant, but let fresh matches lead.
    if (viewed.has(product.id)) score += 1
    return { product, score, index }
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map((s) => s.product)
}

export function parseList(value: string | null, max = 20) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, max)
}
