import { NextRequest, NextResponse } from 'next/server'
import { searchProductsWithAi } from '@/lib/ai-product-search'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * AI-powered product search.
 * POST /api/ai/search  { query: "flowers under 2000 for mom" }
 * GET  /api/ai/search?q=flowers+under+2000
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const query = String(body?.query || body?.q || '').trim()
    if (!query) {
      return NextResponse.json({
        products: [],
        filters: null,
        interpretation: null,
        source: 'keyword',
      })
    }

    const result = await searchProductsWithAi(query)
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
    const query = String(request.nextUrl.searchParams.get('q') || '').trim()
    if (!query) {
      return NextResponse.json({
        products: [],
        filters: null,
        interpretation: null,
        source: 'keyword',
      })
    }

    const result = await searchProductsWithAi(query)
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI search error:', error)
    return NextResponse.json(
      { error: 'Search is unavailable right now. Please try again.' },
      { status: 500 }
    )
  }
}
