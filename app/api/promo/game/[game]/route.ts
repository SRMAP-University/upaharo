import { NextRequest, NextResponse } from 'next/server'
import {
  awardPromoGame,
  isPromoGameType,
  promoGameStatusPayload,
} from '@/lib/promo-game-award'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'

type RouteContext = { params: Promise<{ game: string }> }

/** GET — can the user play this promo game today? */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { game: rawGame } = await context.params
    const game = String(rawGame || '').trim().toLowerCase()
    if (!isPromoGameType(game)) {
      return NextResponse.json({ error: 'Unknown game' }, { status: 404 })
    }

    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const payload = await promoGameStatusPayload(storeContext.store.id, userId, game)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('GET /api/promo/game/[game]', error)
    return NextResponse.json({ error: 'Failed to load game status' }, { status: 500 })
  }
}

/** POST — play once per UTC day; awards a single-use PERCENTAGE coupon. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { game: rawGame } = await context.params
    const game = String(rawGame || '').trim().toLowerCase()
    if (!isPromoGameType(game)) {
      return NextResponse.json({ error: 'Unknown game' }, { status: 404 })
    }

    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const result = await awardPromoGame(storeContext.store.id, userId, game)
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/promo/game/[game]', error)
    return NextResponse.json({ error: 'Play failed' }, { status: 500 })
  }
}
