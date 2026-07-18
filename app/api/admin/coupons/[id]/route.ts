import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
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
    await prisma.coupon.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting coupon:', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}
