import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  baseProductId,
  pickupLocationOf,
  resolveLargestSharedPickupGroup,
} from '@/lib/pickup'
import { PICKUP_PRODUCT_SELECT } from '@/lib/product-db'
import { resolveStoreContext } from '@/lib/store-context'

/**
 * Checkout asks whether the current cart can be collected instead of delivered.
 * GET /api/pickup?ids=prod_1,prod_2
 */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext
    const ids = (request.nextUrl.searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ eligible: false, location: null, pickupProductIds: [] })
    }

    const productIds = [...new Set(ids.map(baseProductId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: store.id },
      select: PICKUP_PRODUCT_SELECT,
    })
    const capable = products.filter((product) => pickupLocationOf(product) != null)
    if (capable.length === 0) {
      return NextResponse.json({ eligible: false, location: null, pickupProductIds: [] })
    }
    const group = resolveLargestSharedPickupGroup(products)
    const location = group.location ?? pickupLocationOf(capable[0])!
    const pickupProductIds = capable
      .filter((product) => {
        const productLocation = pickupLocationOf(product)!
        return (
          Math.abs(location.latitude - productLocation.latitude) <= 1e-3 &&
          Math.abs(location.longitude - productLocation.longitude) <= 1e-3
        )
      })
      .map((product) => product.id)
    const result = {
      eligible: products.length === productIds.length && pickupProductIds.length === productIds.length,
      location,
      pickupProductIds,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error resolving pickup eligibility:', error)
    return NextResponse.json({ eligible: false, location: null, pickupProductIds: [] })
  }
}
