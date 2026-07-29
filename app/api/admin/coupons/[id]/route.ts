import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const body = await request.json()
    const [existing, categoryCount, productCount] = await Promise.all([
      prisma.coupon.findFirst({ where: { id, storeId: storeContext.store.id }, select: { id: true } }),
      Array.isArray(body.applicableCategoryIds)
        ? prisma.category.count({ where: { id: { in: body.applicableCategoryIds }, storeId: storeContext.store.id } })
        : 0,
      Array.isArray(body.applicableProductIds)
        ? prisma.product.count({ where: { id: { in: body.applicableProductIds }, storeId: storeContext.store.id } })
        : 0,
    ])
    if (!existing) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    if (
      (Array.isArray(body.applicableCategoryIds) && categoryCount !== new Set(body.applicableCategoryIds).size) ||
      (Array.isArray(body.applicableProductIds) && productCount !== new Set(body.applicableProductIds).size)
    ) {
      return NextResponse.json({ error: 'Invalid applicable product or category' }, { status: 400 })
    }
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: body.code?.trim().toUpperCase(),
        description: body.description?.trim() || null,
        type: body.type,
        value: body.value !== undefined ? Number(body.value) : undefined,
        minOrderAmount: body.minOrderAmount !== undefined ? Number(body.minOrderAmount) : undefined,
        maxDiscount: body.maxDiscount !== undefined ? (body.maxDiscount ? Number(body.maxDiscount) : null) : undefined,
        usageLimit: body.usageLimit !== undefined ? (body.usageLimit ? Number(body.usageLimit) : null) : undefined,
        startAt: body.startAt !== undefined ? (body.startAt ? new Date(body.startAt) : null) : undefined,
        endAt: body.endAt !== undefined ? (body.endAt ? new Date(body.endAt) : null) : undefined,
        isActive: body.isActive,
        applicability: body.applicability,
        applicableCategoryIds: body.applicableCategoryIds,
        applicableProductIds: body.applicableProductIds
      }
    })

    return NextResponse.json(coupon)
  } catch (error) {
    console.error('Error updating coupon:', error)
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    if (!(await requireAdmin(_request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const result = await prisma.coupon.deleteMany({ where: { id, storeId: storeContext.store.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting coupon:', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}
