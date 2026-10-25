import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { fetchCloudflareAI } from '@/lib/ai-product-search'
import { productMascotScript } from '@/lib/mascot-lines'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { findFirstProductCompat } from '@/lib/product-db'
import { stripSubProductTags } from '@/lib/product-subproducts'
import { getOrSetJson, redis, REDIS_KEYS } from '@/lib/redis'
import { resolveStoreContext } from '@/lib/store-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

type MascotProductRow = {
  id: string
  name: string
  category: string | null
  price: number
  discount: number | null
  isVeg: boolean | null
  prepTime: number | null
  tags: string[] | null
  isAvailable: boolean | null
  miniDescription?: string | null
  description?: string | null
}

const AI_TTL_SECONDS = 7 * 24 * 60 * 60
// When Workers AI fails, wait a bit before asking again for the same product.
const AI_RETRY_SECONDS = 10 * 60

// Per-process cache so a missing Redis doesn't mean an AI call per page view.
const memoryCache = new Map<string, { lines: string[]; expires: number }>()
const inFlight = new Map<string, Promise<string[]>>()

const SYSTEM_PROMPT = [
  'You are a tiny, cheerful gift-box mascot who lives in the Upaharo gift shop app in Nepal.',
  'A shopper is looking at the product below. Write 3 different things you would squeal to them about it.',
  'Talk in first person like an excited, cute little friend ("Ooh…", "I bet…", "Aww…"), never like an ad.',
  'Each line under 55 characters, specific to this product, at most one emoji.',
  'Do not mention prices, discounts, delivery times or stock. Do not invent details that are not given.',
  'Reply with only a JSON array of 3 strings.',
].join(' ')

function plainText(value: string | null | undefined, max: number) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>|[\]()\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function parseLines(text: string): string[] {
  const candidates: unknown[] = []
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) candidates.push(...parsed)
    } catch {
      // fall back to line splitting
    }
  }
  if (candidates.length === 0) {
    candidates.push(...text.split('\n').map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')))
  }

  return candidates
    .filter((line): line is string => typeof line === 'string')
    .map((line) => line.trim().replace(/^["“'`]+|["”'`,]+$/g, '').trim())
    .filter((line) => line.length >= 6 && line.length <= 80 && !/[{}[\]]/.test(line))
    .slice(0, 3)
}

async function generateLines(product: MascotProductRow): Promise<string[]> {
  const accountId = process.env.CF_ACCOUNT_ID
  const apiToken = process.env.CF_API_TOKEN
  if (!accountId || !apiToken) return []

  const details = [
    `Product: ${plainText(product.name, 120)}`,
    product.category ? `Category: ${plainText(product.category, 60)}` : '',
    `About: ${plainText(product.miniDescription || product.description, 240) || 'n/a'}`,
    `Tags: ${stripSubProductTags(product.tags).slice(0, 8).join(', ') || 'n/a'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const text = await fetchCloudflareAI(accountId, apiToken, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: details },
  ])
  return parseLines(text)
}

async function aiLines(storeSlug: string, product: MascotProductRow): Promise<string[]> {
  // Re-generate when the name or description changes.
  const version = createHash('sha1')
    .update(`${product.name}|${product.category}|${product.miniDescription || ''}`)
    .digest('hex')
    .slice(0, 10)
  const key = REDIS_KEYS.MASCOT_PRODUCT(storeSlug, product.id, version)

  const memo = memoryCache.get(key)
  if (memo && memo.expires > Date.now()) return memo.lines

  const cached = await redis.get(key)
  if (cached) {
    try {
      const lines = JSON.parse(cached) as string[]
      memoryCache.set(key, { lines, expires: Date.now() + AI_RETRY_SECONDS * 1000 })
      return lines
    } catch {
      // regenerate below
    }
  }

  let pending = inFlight.get(key)
  if (!pending) {
    pending = generateLines(product)
      .catch((error) => {
        console.error('Mascot AI lines failed:', error instanceof Error ? error.message : error)
        return [] as string[]
      })
      .then(async (lines) => {
        const ttl = lines.length > 0 ? AI_TTL_SECONDS : AI_RETRY_SECONDS
        memoryCache.set(key, { lines, expires: Date.now() + ttl * 1000 })
        if (memoryCache.size > 1000) memoryCache.delete(memoryCache.keys().next().value as string)
        await redis.setex(key, ttl, JSON.stringify(lines))
        return lines
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }
  return pending
}

/**
 * Lines the gift-box mascot says about a product.
 * GET /api/mascot/product/:id → { intro, lines, added, source }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { slug, store } = storeContext

    const product = (await getOrSetJson(REDIS_KEYS.PRODUCT_DETAIL(slug, id), 180, async () =>
      findFirstProductCompat({
        where: {
          id,
          storeId: store.id,
          NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
        },
      })
    )) as MascotProductRow | null

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const script = productMascotScript(product)
    const ai = product.isAvailable === false ? [] : await aiLines(slug, product)
    const [aiIntro, ...aiRest] = ai

    return NextResponse.json(
      {
        intro: aiIntro || script.intro,
        lines: [...aiRest, ...script.lines],
        added: script.added,
        source: ai.length > 0 ? 'ai' : 'rules',
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    )
  } catch (error) {
    console.error('Error building mascot lines:', error)
    return NextResponse.json({ error: 'Mascot is napping' }, { status: 500 })
  }
}
