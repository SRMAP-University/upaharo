import { NextRequest, NextResponse } from 'next/server'
import { CATCH_MAX_SCORE, CATCH_SECONDS, claimCatchCoupon, verifyCatchToken } from '@/lib/gift-catch'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

/**
 * POST { token, score } — claim today's coupon for a finished game.
 * The token must be one we issued, at least a full game old and not stale;
 * the score must be a plausible whole number. The percent is decided here.
 */
export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const storeId = storeContext.store.id
    const userId = await resolveUserId(request)
    if (!userId) return NextResponse.json({ error: 'Sign in to claim your coupon' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const check = verifyCatchToken(body?.token, storeId)
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

    const age = Date.now() - check.startedAt
    if (age < (CATCH_SECONDS - 3) * 1000) {
      return NextResponse.json({ error: 'Finish the game first' }, { status: 400 })
    }
    if (age > TOKEN_TTL_MS) {
      return NextResponse.json({ error: 'This game is too old to claim. Play again!' }, { status: 400 })
    }

    const score = Number(body?.score)
    if (!Number.isInteger(score) || score < 0 || score > CATCH_MAX_SCORE) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
    }

    const result = await claimCatchCoupon(storeId, userId, score)
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/promo/catch/claim', error)
    return NextResponse.json({ error: 'Could not claim the coupon' }, { status: 500 })
  }
}
