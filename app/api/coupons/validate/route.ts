import { NextRequest, NextResponse } from 'next/server'
import { validateCoupon } from '@/lib/coupon'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await validateCoupon(body.code, {
      subtotal: Number(body.subtotal ?? 0),
      productIds: Array.isArray(body.productIds) ? body.productIds : [],
      categoryNames: Array.isArray(body.categoryNames) ? body.categoryNames : [],
    })

    // Lean payload for mobile clients (avoid serializing full Prisma models).
    return NextResponse.json({
      valid: result.valid,
      discount: result.discount,
      message: result.message ?? null,
      code: result.coupon?.code ?? (typeof body.code === 'string' ? body.code.trim().toUpperCase() : null),
    })
  } catch (error) {
    console.error('Error validating coupon:', error)
    return NextResponse.json(
      { valid: false, discount: 0, message: 'Failed to validate coupon', code: null },
      { status: 200 }
    )
  }
}
