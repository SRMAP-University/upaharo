import { NextRequest, NextResponse } from 'next/server'
import { searchProductsWithAi } from '@/lib/ai-product-search'
import { resolveStoreContext } from '@/lib/store-context'
import { resolveUserId } from '@/lib/request-auth'
import { recordUserSearch } from '@/lib/search-history'

/** Remember a signed-in shopper's search; never blocks or fails the search. */
function rememberSearch(request: NextRequest, storeId: string | undefined, query: string) {
  if (!storeId || !query) return
  void resolveUserId(request)
    .then((userId) => (userId ? recordUserSearch(storeId, userId, query) : undefined))
    .catch(() => undefined)
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * AI-powered product search.
 * POST /api/ai/search  { query: "flowers under 2000 for mom" }
 * GET  /api/ai/search?q=flowers+under+2000
 */
export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const query = String(body?.query || body?.q || '').trim()
    rememberSearch(request, storeContext?.store.id, query)
    if (!query) {
      return NextResponse.json({
        products: [],
        filters: null,
        interpretation: null,
        source: 'keyword',
      })
    }

    const result = await searchProductsWithAi(query, storeContext.store.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI search error:', error)
    return NextResponse.json(
      { error: 'Search is unavailable right now. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const query = String(request.nextUrl.searchParams.get('q') || '').trim()
    rememberSearch(request, storeContext?.store.id, query)
    if (!query) {
      return NextResponse.json({
        products: [],
        filters: null,
        interpretation: null,
        source: 'keyword',
      })
    }

    const result = await searchProductsWithAi(query, storeContext.store.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI search error:', error)
    return NextResponse.json(
      { error: 'Search is unavailable right now. Please try again.' },
      { status: 500 }
    )
  }
}
