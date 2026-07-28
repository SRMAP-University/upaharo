import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

/** Prefer a warm general chat model; fall back if unavailable. */
const PRIMARY_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const FALLBACK_MODEL = '@cf/moonshotai/kimi-k2.7-code'

/** Only these leftover words may become product search terms (never chatter). */
const GIFT_SEARCH_TERMS = new Set([
  'flower', 'flowers', 'rose', 'roses', 'bouquet', 'cake', 'cakes', 'chocolate',
  'chocolates', 'plant', 'plants', 'hamper', 'hampers', 'teddy', 'bear', 'perfume',
  'birthday', 'anniversary', 'wedding', 'valentine', 'mothers', 'fathers', 'teacher',
  'graduation', 'newborn', 'baby', 'congrats', 'congratulations', 'sympathy', 'getwell',
  'rakhi', 'dashain', 'tihar', 'christmas', 'romantic', 'luxury', 'premium',
])

export type SearchFilters = {
  search?: string
  category?: string
  minPrice?: number
  maxPrice?: number
}

type CatalogSnapshot = {
  categoryList: string
  categoryNames: string[]
  catalogMin: number
  catalogMax: number
  catalogCount: number
  fetchedAt: number
}

let catalogCache: CatalogSnapshot | null = null
const CATALOG_TTL_MS = 10 * 60 * 1000

export type AiProductSearchResult = {
  products: Array<Record<string, unknown>>
  filters: SearchFilters | null
  interpretation: string | null
  source: 'ai' | 'keyword'
}

/**
 * Natural-language product search for the Search screen.
 * Uses Cloudflare Workers AI to map the query → filters, then Prisma.
 * Falls back to keyword contains-search when AI is unavailable.
 */
export async function searchProductsWithAi(rawQuery: string): Promise<AiProductSearchResult> {
  const query = String(rawQuery || '').trim().slice(0, 200)
  if (!query) {
    return { products: [], filters: null, interpretation: null, source: 'keyword' }
  }

  const accountId = process.env.CF_ACCOUNT_ID
  const apiToken = process.env.CF_API_TOKEN

  if (!accountId || !apiToken) {
    const products = await keywordSearch(query)
    return {
      products,
      filters: { search: query },
      interpretation: null,
      source: 'keyword',
    }
  }

  try {
    const catalog = await getCatalogSnapshot()
    const systemPrompt = `You are Upaharo's gift search parser for Kathmandu Valley.
Turn the shopper's search into product filters. Do not chat — only output one JSON block.

Catalog: ~${catalog.catalogCount} gifts, NPR ${Math.round(catalog.catalogMin)}–${Math.round(catalog.catalogMax)}.
Categories: ${catalog.categoryList}.

Return EXACTLY:
\`\`\`json
{"action":"recommend","filters":{"search":"roses","category":"Flowers","minPrice":1000,"maxPrice":3000}}
\`\`\`

Rules (NPR):
- "under / below / less than / budget of X" → maxPrice
- "over / more than / at least X" → minPrice
- "around X" → minPrice ≈ 0.7X, maxPrice ≈ 1.3X
- "between A and B" → minPrice and maxPrice
- "search": 1–3 gift keywords only (roses, cake, birthday). Omit if unsure.
- "category": only a listed category. Omit if unsure.
- Omit unused fields.
- Never put conversational filler in "search".`

    const aiText = await fetchCloudflareAI(accountId, apiToken, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ])

    let filters = scrubJunkSearch(
      enrichFiltersFromText(parseFiltersFromAi(aiText), query)
    )
    const safe = inferSafeFilters(query, catalog.categoryNames)
    if (!filters) {
      filters = safe
    } else if (safe) {
      filters = {
        search: filters.search || safe.search,
        category: filters.category || safe.category,
        minPrice: filters.minPrice ?? safe.minPrice,
        maxPrice: filters.maxPrice ?? safe.maxPrice,
      }
      filters = scrubJunkSearch(filters)
    }

    // Always fold budget cues from the raw query.
    filters = enrichFiltersFromText(filters, query)

    let products: Array<Record<string, unknown>> = []
    if (filters && hasAnyFilter(filters)) {
      products = await fetchProducts(filters)
    }

    if (products.length === 0) {
      products = await keywordSearch(query)
      return {
        products,
        filters: filters ?? { search: query },
        interpretation: formatInterpretation(filters),
        source: products.length > 0 ? 'keyword' : 'ai',
      }
    }

    return {
      products,
      filters,
      interpretation: formatInterpretation(filters),
      source: 'ai',
    }
  } catch (error) {
    console.error('AI product search failed, using keyword fallback:', error)
    const products = await keywordSearch(query)
    return {
      products,
      filters: { search: query },
      interpretation: null,
      source: 'keyword',
    }
  }
}

function formatInterpretation(filters?: SearchFilters | null): string | null {
  if (!filters || !hasAnyFilter(filters)) return null
  const parts: string[] = []
  if (filters.search) parts.push(`“${filters.search}”`)
  if (filters.category) parts.push(filters.category)
  if (filters.minPrice != null && filters.maxPrice != null) {
    parts.push(`NPR ${filters.minPrice}–${filters.maxPrice}`)
  } else if (filters.maxPrice != null) {
    parts.push(`under NPR ${filters.maxPrice}`)
  } else if (filters.minPrice != null) {
    parts.push(`from NPR ${filters.minPrice}`)
  }
  return parts.length > 0 ? `Showing ${parts.join(' · ')}` : null
}

async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return catalogCache
  }

  const [categories, priceStats] = await Promise.all([
    prisma.category.findMany({
      where: { type: 'PRODUCT', isActive: true },
      select: { name: true },
      orderBy: { name: 'asc' },
      take: 40,
    }),
    prisma.product.aggregate({
      where: {
        isAvailable: true,
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
      _min: { price: true },
      _max: { price: true },
      _count: true,
    }),
  ])

  const categoryNames = categories.map((c) => c.name)
  catalogCache = {
    categoryList: categoryNames.join(', ') || 'flowers, cakes, gifts, plants',
    categoryNames,
    catalogMin: Number(priceStats._min.price ?? 0),
    catalogMax: Number(priceStats._max.price ?? 0),
    catalogCount: priceStats._count,
    fetchedAt: Date.now(),
  }
  return catalogCache
}

function inferSafeFilters(text: string, categoryNames: string[]): SearchFilters | undefined {
  const lower = text.toLowerCase()
  const next: SearchFilters = {}

  const matchedCategory = categoryNames.find((name) => {
    const n = name.toLowerCase()
    return n.length >= 3 && lower.includes(n)
  })
  if (matchedCategory) next.category = matchedCategory

  const giftWords = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => GIFT_SEARCH_TERMS.has(w))
    .slice(0, 3)

  if (!next.category && giftWords.length > 0) {
    next.search = giftWords.join(' ')
  }

  return hasAnyFilter(next) ? next : undefined
}

function scrubJunkSearch(filters?: SearchFilters | null): SearchFilters | undefined {
  if (!filters) return undefined
  const next = { ...filters }
  if (next.search) {
    const words = next.search
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)

    const junk = new Set([
      'you', 'have', 'anything', 'something', 'please', 'show', 'me', 'what', 'do',
      'got', 'available', 'options', 'option', 'there', 'here', 'this', 'that',
      'help', 'want', 'need', 'looking', 'find', 'get', 'can', 'could', 'would',
      'like', 'just', 'also', 'some', 'any', 'gift', 'gifts', 'product', 'products',
      'upaharo', 'picks', 'recommend', 'suggestion', 'suggestions', 'for', 'my',
      'mom', 'dad', 'under', 'below', 'over', 'above', 'around', 'between',
    ])

    const kept = words.filter(
      (w) =>
        GIFT_SEARCH_TERMS.has(w) ||
        (!junk.has(w) && w.length > 3 && !/^\d+$/.test(w))
    )

    if (kept.length === 0 || kept.join(' ').length < 3) {
      delete next.search
    } else {
      next.search = kept.slice(0, 3).join(' ')
    }
  }

  return hasAnyFilter(next) ? next : undefined
}

async function fetchCloudflareAI(
  accountId: string,
  apiToken: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL]
  let lastError: Error | null = null

  for (const model of models) {
    try {
      return await runModel(accountId, apiToken, model, messages)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Workers AI model failed (${model}):`, lastError.message)
    }
  }

  throw lastError ?? new Error('Workers AI unavailable')
}

async function runModel(
  accountId: string,
  apiToken: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18_000)

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          max_tokens: 180,
        }),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      throw new Error(`Workers AI error ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = await response.json()
    const choiceContent = data?.result?.choices?.[0]?.message?.content
    if (typeof choiceContent === 'string' && choiceContent.trim()) return choiceContent
    if (data?.result?.response && typeof data.result.response === 'string') {
      return data.result.response
    }
    if (typeof data?.result === 'string') return data.result
    if (typeof data?.response === 'string') return data.response
    throw new Error('Unexpected Workers AI response shape')
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Workers AI timeout (${model})`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function parseFiltersFromAi(text: string): SearchFilters | undefined {
  const blockRegex = /```json\s*([\s\S]*?)\s*```/
  const match = blockRegex.exec(text)
  const raw = match?.[1] ?? text.match(/\{[\s\S]*"filters"\s*:[\s\S]*\}/)?.[0]
  if (!raw) return undefined

  try {
    const json = JSON.parse(raw.trim()) as { filters?: SearchFilters }
    return sanitizeFilters(json?.filters)
  } catch {
    return undefined
  }
}

function sanitizeFilters(filters?: SearchFilters): SearchFilters | undefined {
  if (!filters || typeof filters !== 'object') return undefined
  const next: SearchFilters = {}

  if (typeof filters.search === 'string' && filters.search.trim()) {
    next.search = filters.search.trim().slice(0, 80)
  }
  if (typeof filters.category === 'string' && filters.category.trim()) {
    next.category = filters.category.trim().slice(0, 60)
  }

  const minPrice = normalizePrice(filters.minPrice)
  const maxPrice = normalizePrice(filters.maxPrice)
  if (minPrice != null) next.minPrice = minPrice
  if (maxPrice != null) next.maxPrice = maxPrice

  if (next.minPrice != null && next.maxPrice != null && next.minPrice > next.maxPrice) {
    const tmp = next.minPrice
    next.minPrice = next.maxPrice
    next.maxPrice = tmp
  }

  return hasAnyFilter(next) ? next : undefined
}

function normalizePrice(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.round(n)
}

function hasAnyFilter(filters: SearchFilters): boolean {
  return Boolean(
    filters.search ||
      filters.category ||
      filters.minPrice != null ||
      filters.maxPrice != null
  )
}

function enrichFiltersFromText(
  filters: SearchFilters | undefined | null,
  text: string
): SearchFilters | undefined {
  const inferred = inferBudgetFromText(text.toLowerCase())
  const base = { ...(filters ?? {}) }

  if (inferred.minPrice != null) {
    base.minPrice = inferred.minPrice
    if (inferred.clearMinOnly) delete base.maxPrice
  }
  if (inferred.maxPrice != null && !inferred.clearMinOnly) {
    base.maxPrice = inferred.maxPrice
  }
  if (inferred.minPrice != null && inferred.maxPrice != null) {
    base.minPrice = inferred.minPrice
    base.maxPrice = inferred.maxPrice
  }

  return sanitizeFilters(base)
}

function inferBudgetFromText(text: string): {
  minPrice?: number
  maxPrice?: number
  clearMinOnly?: boolean
} {
  const between = text.match(
    /(?:between|from)\s*(?:rs\.?|npr|rupees?)?\s*(\d{3,6})\s*(?:and|to|-)\s*(?:rs\.?|npr|rupees?)?\s*(\d{3,6})/i
  )
  if (between) {
    const a = Number(between[1])
    const b = Number(between[2])
    return { minPrice: Math.min(a, b), maxPrice: Math.max(a, b) }
  }

  const around = text.match(
    /(?:around|about|approx(?:imately)?)\s*(?:rs\.?|npr|rupees?)?\s*(\d{3,6})/i
  )
  if (around) {
    const mid = Number(around[1])
    return { minPrice: Math.round(mid * 0.7), maxPrice: Math.round(mid * 1.3) }
  }

  const over = text.match(
    /(?:more\s+than|over|above|at\s+least|starting\s+from|greater\s+than|minimum|min)\s*(?:rs\.?|npr|rupees?)?\s*(\d{3,6})/i
  )
  if (over) return { minPrice: Number(over[1]), clearMinOnly: true }

  const under = text.match(
    /(?:under|below|less\s+than|within|upto|up\s+to|budget(?:\s+of)?|maximum|max)\s*(?:rs\.?|npr|rupees?)?\s*(\d{3,6})/i
  )
  if (under) return { maxPrice: Number(under[1]) }

  return {}
}

async function fetchProducts(filters: SearchFilters) {
  const attempts: SearchFilters[] = [filters]

  if (filters.search && (filters.minPrice != null || filters.maxPrice != null)) {
    attempts.push({
      category: filters.category,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    })
  }
  if (filters.category && (filters.minPrice != null || filters.maxPrice != null)) {
    attempts.push({
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    })
  }

  for (const attempt of attempts) {
    const products = await queryProducts(attempt)
    if (products.length > 0) return products
  }

  return []
}

async function keywordSearch(query: string) {
  return queryProducts({ search: query })
}

async function queryProducts(filters: SearchFilters) {
  const searchTerms = (filters.search ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
    .slice(0, 5)

  const where: Record<string, unknown> = {
    isAvailable: true,
    NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
  }

  if (filters.category) {
    where.category = { equals: filters.category, mode: 'insensitive' }
  }

  const priceFilter: Record<string, number> = {}
  if (typeof filters.minPrice === 'number' && filters.minPrice > 0) {
    priceFilter.gte = filters.minPrice
  }
  if (typeof filters.maxPrice === 'number' && filters.maxPrice > 0) {
    priceFilter.lte = filters.maxPrice
  }
  if (Object.keys(priceFilter).length > 0) {
    where.price = priceFilter
  }

  if (searchTerms.length > 0) {
    where.OR = searchTerms.flatMap((term) => [
      { name: { contains: term, mode: 'insensitive' } },
      { category: { contains: term, mode: 'insensitive' } },
      { tags: { has: term } },
      { miniDescription: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ])
  }

  const orderBy =
    filters.minPrice != null && filters.maxPrice == null
      ? [{ price: 'asc' as const }, { createdAt: 'desc' as const }]
      : filters.maxPrice != null && filters.minPrice == null
        ? [{ price: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }]

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      price: true,
      image: true,
      category: true,
      miniDescription: true,
      discount: true,
      isAvailable: true,
      isVeg: true,
      showFoodTypeLabel: true,
    },
    orderBy,
    take: 40,
  })

  return products.map((p) => ({
    ...p,
    price: Number(p.price),
    discount: p.discount != null ? Number(p.discount) : null,
    description: '',
  }))
}
