import { NextRequest, NextResponse } from 'next/server'
import { signCatchToken } from '@/lib/gift-catch'
import { resolveStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/** POST — start a game: a signed token with the start time (needed to claim). */
export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    return NextResponse.json({ token: signCatchToken(storeContext.store.id) })
  } catch (error) {
    console.error('POST /api/promo/catch/start', error)
    return NextResponse.json({ error: 'Could not start the game' }, { status: 500 })
  }
}
