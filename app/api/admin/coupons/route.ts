import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const coupons = await prisma.coupon.findMany({
      where: { storeId: storeContext.store.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(coupons)
  } catch (error) {
    console.error('Error fetching coupons:', error)
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const body = await request.json()
    const categoryIds = Array.isArray(body.applicableCategoryIds) ? body.applicableCategoryIds : []
    const productIds = Array.isArray(body.applicableProductIds) ? body.applicableProductIds : []
    const [categories, products] = await Promise.all([
      categoryIds.length ? prisma.category.count({ where: { id: { in: categoryIds }, storeId: storeContext.store.id } }) : 0,
      productIds.length ? prisma.product.count({ where: { id: { in: productIds }, storeId: storeContext.store.id } }) : 0,
    ])
    if (categories !== new Set(categoryIds).size || products !== new Set(productIds).size) {
      return NextResponse.json({ error: 'Invalid applicable product or category' }, { status: 400 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        storeId: storeContext.store.id,
        code: body.code.trim().toUpperCase(),
        description: body.description?.trim() || null,
        type: body.type,
        value: Number(body.value),
        minOrderAmount: Number(body.minOrderAmount ?? 0),
        maxDiscount: body.maxDiscount ? Number(body.maxDiscount) : null,
        usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        isActive: body.isActive ?? true,
        applicability: body.applicability ?? 'ALL',
        applicableCategoryIds: categoryIds,
        applicableProductIds: productIds
      }
    })

    return NextResponse.json(coupon)
  } catch (error) {
    console.error('Error creating coupon:', error)
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
  }
}
