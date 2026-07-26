import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface RecommendFilters {
  search?: string
  category?: string
  /** Inclusive lower bound in NPR (e.g. "over 2000"). */
  minPrice?: number
  /** Inclusive upper bound in NPR (e.g. "under 2000"). */
  maxPrice?: number
}

interface RecommendPayload {
  action: 'recommend'
  filters?: RecommendFilters
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

export async function POST(request: NextRequest) {
  try {
    const accountId = process.env.CF_ACCOUNT_ID
    const apiToken = process.env.CF_API_TOKEN

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'AI service is not configured. Set CF_ACCOUNT_ID and CF_API_TOKEN.' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const incomingMessages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []

    if (incomingMessages.length === 0 || !incomingMessages.some((m) => m.role === 'user')) {
      return NextResponse.json(
        { error: 'Send at least one user message.' },
        { status: 400 }
      )
    }

    const catalog = await getCatalogSnapshot()
    const lastUser = [...incomingMessages].reverse().find((m) => m.role === 'user')?.content ?? ''

    const systemPrompt = `You are Upaharo's friendly gifting assistant for delivery in Kathmandu Valley.
Speak like a helpful shop associate: warm, natural, and concise (usually 1-3 sentences).
Understand casual questions ("do you have anything?", "show me options", "for my mom") — do not echo the customer's sentence as a product search.

Catalog: about ${catalog.catalogCount} gifts, roughly NPR ${Math.round(catalog.catalogMin)}–${Math.round(catalog.catalogMax)}.
Categories we carry: ${catalog.categoryList}.

How to help:
- If the request is vague, ask ONE friendly clarifying question (occasion, who it's for, budget, or type like flowers/cake/plants).
- If you already have enough to search (budget, category, occasion, or gift type), recommend and include the JSON block below.
- Never invent product names, prices, or stock. Real products are attached by our system from your filters.
- Never write awkward lines like "picks for \\"you have anything\\"". Describe the intent in plain English instead.

When recommending, end with EXACTLY one JSON code block (and keep filters meaningful — never use conversational filler as "search"):
\`\`\`json
{"action":"recommend","filters":{"search":"birthday flowers","category":"Flowers","minPrice":2000,"maxPrice":5000}}
\`\`\`

Filter rules (NPR):
- "under / below / less than / budget of X" → maxPrice only
- "over / more than / at least X" → minPrice only
- "around X" → minPrice ≈ 0.7X, maxPrice ≈ 1.3X
- "between A and B" → minPrice and maxPrice
- "search": 1–3 useful gift keywords only (e.g. roses, cake, birthday). Omit if unsure.
- "category": only a category we carry. Omit if unsure.
- Omit unused filter fields entirely.`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...incomingMessages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 600),
      })),
    ]

    // Prefetch only from safe cues (budget / real category / gift vocabulary).
    const earlyFilters = enrichFiltersFromChat(
      inferSafeFilters(lastUser, catalog.categoryNames),
      incomingMessages
    )
    const canPrefetch =
      earlyFilters != null &&
      (earlyFilters.minPrice != null ||
        earlyFilters.maxPrice != null ||
        Boolean(earlyFilters.category))

    const [aiResponse, earlyProducts] = await Promise.all([
      fetchCloudflareAI(accountId, apiToken, messages),
      canPrefetch && earlyFilters
        ? fetchRecommendedProducts(earlyFilters)
        : Promise.resolve([] as any[]),
    ])

    const { text: cleanedText, payload } = parseRecommendPayload(aiResponse)
    let filters = enrichFiltersFromChat(payload?.filters, incomingMessages)
    filters = scrubJunkSearch(filters)

    let products: any[] = []
    if (filters && hasAnyFilter(filters)) {
      const sameAsEarly =
        canPrefetch &&
        earlyFilters &&
        filters.minPrice === earlyFilters.minPrice &&
        filters.maxPrice === earlyFilters.maxPrice &&
        (filters.category || '') === (earlyFilters.category || '') &&
        (filters.search || '') === (earlyFilters.search || '')

      products = sameAsEarly && earlyProducts.length > 0
        ? earlyProducts
        : await fetchRecommendedProducts(filters)
    }

    let content =
      cleanedText ||
      "Happy to help you find a gift! What's the occasion, who is it for, or what's your budget?"

    // Soften empty recommend results without sounding robotic.
    if (filters && hasAnyFilter(filters) && products.length === 0) {
      content +=
        ' I could not find a great match in that range just now — want to try a different budget or category?'
    }

    return NextResponse.json({
      role: 'assistant',
      content,
      products,
      filters: filters ?? null,
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: 'Assistant is unavailable right now. Please try again later.' },
      { status: 500 }
    )
  }
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

/** Safe server-side cues only — never turns chatter into a search query. */
function inferSafeFilters(text: string, categoryNames: string[]): RecommendFilters | undefined {
  const lower = text.toLowerCase()
  const next: RecommendFilters = {}

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

/** Drop conversational garbage the model may put into filters.search. */
function scrubJunkSearch(filters?: RecommendFilters): RecommendFilters | undefined {
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
      'upaharo', 'picks', 'recommend', 'suggestion', 'suggestions',
    ])

    const kept = words.filter(
      (w) =>
        GIFT_SEARCH_TERMS.has(w) ||
        (!junk.has(w) && w.length > 3 && !/^(have|anything|something)$/.test(w))
    )

    // If most of the "search" was chatter, drop it.
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
  messages: ChatMessage[]
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
  messages: ChatMessage[]
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

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
          max_tokens: 280,
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
    if (typeof choiceContent === 'string' && choiceContent.trim()) {
      return choiceContent
    }

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

function parseRecommendPayload(text: string): { text: string; payload?: RecommendPayload } {
  const blockRegex = /```json\s*([\s\S]*?)\s*```/
  const match = blockRegex.exec(text)
  if (!match) {
    // Also accept a bare JSON object at the end.
    const bare = text.match(/\{[\s\S]*"action"\s*:\s*"recommend"[\s\S]*\}/)
    if (bare) {
      try {
        const json = JSON.parse(bare[0]) as RecommendPayload
        if (json?.action === 'recommend') {
          return {
            text: text.replace(bare[0], '').trim(),
            payload: sanitizePayload(json),
          }
        }
      } catch {
        // ignore
      }
    }
    return { text: text.trim() }
  }

  try {
    const json = JSON.parse(match[1].trim()) as RecommendPayload
    if (json?.action === 'recommend') {
      const cleaned = text.replace(match[0], '').trim()
      return { text: cleaned, payload: sanitizePayload(json) }
    }
  } catch {
    // Ignore malformed JSON and return the full text.
  }

  return { text: text.trim() }
}

function sanitizePayload(payload: RecommendPayload): RecommendPayload {
  const filters = sanitizeFilters(payload.filters)
  return { action: 'recommend', filters }
}

function sanitizeFilters(filters?: RecommendFilters): RecommendFilters | undefined {
  if (!filters || typeof filters !== 'object') return undefined

  const next: RecommendFilters = {}

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

  if (
    next.minPrice != null &&
    next.maxPrice != null &&
    next.minPrice > next.maxPrice
  ) {
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

function hasAnyFilter(filters: RecommendFilters): boolean {
  return Boolean(
    filters.search ||
      filters.category ||
      filters.minPrice != null ||
      filters.maxPrice != null
  )
}

function enrichFiltersFromChat(
  filters: RecommendFilters | undefined,
  messages: ChatMessage[]
): RecommendFilters | undefined {
  const userText = messages
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => m.content)
    .join(' ')
    .toLowerCase()

  const inferred = inferBudgetFromText(userText)
  const base = { ...(filters ?? {}) }

  if (inferred.minPrice != null) {
    base.minPrice = inferred.minPrice
    if (inferred.clearMinOnly) {
      delete base.maxPrice
    }
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
    return {
      minPrice: Math.round(mid * 0.7),
      maxPrice: Math.round(mid * 1.3),
    }
  }

  const over = text.match(
    /(?:more\s+than|over|above|at\s+least|starting\s+from|greater\s+than|minimum|min)\s*(?:rs\.?|npr|rupees?)?\s*(\d{3,6})/i
  )
  if (over) {
    return { minPrice: Number(over[1]), clearMinOnly: true }
  }

  const under = text.match(
    /(?:under|below|less\s+than|within|upto|up\s+to|budget(?:\s+of)?|maximum|max)\s*(?:rs\.?|npr|rupees?)?\s*(\d{3,6})/i
  )
  if (under) {
    return { maxPrice: Number(under[1]) }
  }

  return {}
}

async function fetchRecommendedProducts(filters: RecommendFilters) {
  const attempts: RecommendFilters[] = [filters]

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

async function queryProducts(filters: RecommendFilters) {
  const searchTerms = (filters.search ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
    .slice(0, 5)

  const where: any = {
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
    },
    orderBy,
    take: 24,
  })

  return diversifyByCategory(products, 8).map((p) => ({
    ...p,
    price: Number(p.price),
    discount: p.discount ? Number(p.discount) : null,
  }))
}

function diversifyByCategory<T extends { category: string | null }>(
  products: T[],
  limit: number
): T[] {
  if (products.length <= limit) return products

  const picked: T[] = []
  const remaining = [...products]
  const seenCategories = new Set<string>()

  for (let i = 0; i < remaining.length && picked.length < limit; i++) {
    const item = remaining[i]
    const key = (item.category || '').toLowerCase()
    if (key && seenCategories.has(key)) continue
    picked.push(item)
    if (key) seenCategories.add(key)
    remaining.splice(i, 1)
    i--
  }

  for (const item of remaining) {
    if (picked.length >= limit) break
    picked.push(item)
  }

  return picked
}
