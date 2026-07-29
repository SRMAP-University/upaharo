import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStoreContext } from '@/lib/store-context'

/** Public list of currently available coupons for the storefront / app. */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext
    const now = new Date()
    const coupons = await prisma.coupon.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        minOrderAmount: true,
        maxDiscount: true,
        usageLimit: true,
        usedCount: true,
        applicability: true,
        applicableCategoryIds: true,
        applicableProductIds: true,
        endAt: true,
      },
    })

    const available = coupons.filter((c) => {
      if (c.usageLimit != null && c.usedCount >= c.usageLimit) return false
      // Personal spin prizes stay private (applied on win in the app).
      if (c.code.toUpperCase().startsWith('SPIN')) return false
      return true
    })

    return NextResponse.json({
      coupons: available.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount,
        maxDiscount: c.maxDiscount,
        applicability: c.applicability,
        applicableCategoryIds: c.applicableCategoryIds,
        applicableProductIds: c.applicableProductIds,
        endAt: c.endAt,
        label:
          c.type === 'PERCENTAGE'
            ? `${c.value}% OFF`
            : `Rs. ${c.value} OFF`,
      })),
    })
  } catch (error) {
    console.error('Error listing coupons:', error)
    return NextResponse.json({ coupons: [] }, { status: 200 })
  }
}
