import { NextRequest, NextResponse } from 'next/server'
import { CATCH_SECONDS, CATCH_TIERS, todaysCatchClaim } from '@/lib/gift-catch'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/** GET — Gift Catch rules and, when signed in, today's claimed coupon (if any). */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const userId = await resolveUserId(request).catch(() => null)
    const claimed = userId ? await todaysCatchClaim(storeContext.store.id, userId) : null
    return NextResponse.json({ signedIn: Boolean(userId), claimed, tiers: CATCH_TIERS, seconds: CATCH_SECONDS })
  } catch (error) {
    console.error('GET /api/promo/catch', error)
    return NextResponse.json({ error: 'Failed to load the game' }, { status: 500 })
  }
}
