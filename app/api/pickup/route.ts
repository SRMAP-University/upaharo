import { NextRequest, NextResponse } from 'next/server'
import { resolvePickupForProductIds } from '@/lib/pickup'

/**
 * Checkout asks whether the current cart can be collected instead of delivered.
 * GET /api/pickup?ids=prod_1,prod_2
 */
export async function GET(request: NextRequest) {
  try {
    const ids = (request.nextUrl.searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ eligible: false, location: null, pickupProductIds: [] })
    }

    const result = await resolvePickupForProductIds(ids)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error resolving pickup eligibility:', error)
    return NextResponse.json({ eligible: false, location: null, pickupProductIds: [] })
  }
}
