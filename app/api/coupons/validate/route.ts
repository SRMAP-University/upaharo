import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStoreContext } from '@/lib/store-context'

export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext
    const body = await request.json()
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const subtotal = Number(body.subtotal ?? 0)
    const productIds = Array.isArray(body.productIds) ? body.productIds.map(String) : []
    const coupon = code
      ? await prisma.coupon.findFirst({ where: { code, storeId: store.id } })
      : null
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, storeId: store.id },
          select: { id: true, category: true },
        })
      : []
    const productIdsAreValid = products.length === new Set(productIds).size
    const now = new Date()
    let message: string | undefined
    let discount = 0
    if (!code) message = 'Coupon code is required'
    else if (!coupon) message = 'Invalid coupon code'
    else if (!productIdsAreValid) message = 'Cart contains products from another store'
    else if (!coupon.isActive) message = 'Coupon is inactive'
    else if (coupon.startAt && now < coupon.startAt) message = 'Coupon is not active yet'
    else if (coupon.endAt && now > coupon.endAt) message = 'Coupon has expired'
    else if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) message = 'Coupon usage limit reached'
    else if (subtotal < coupon.minOrderAmount) message = `Minimum order amount of ${coupon.minOrderAmount} required`
    else if (
      coupon.applicability === 'PRODUCTS' &&
      !productIds.some((id: string) => coupon.applicableProductIds.includes(id))
    ) message = 'Coupon not applicable to these products'
    else if (
      coupon.applicability === 'CATEGORIES' &&
      !products.some((product) =>
        coupon.applicableCategoryIds.some(
          (category) => category.trim().toLowerCase() === product.category.trim().toLowerCase()
        )
      )
    ) message = 'Coupon not applicable to this category'
    else if (coupon) {
      discount = coupon.type === 'PERCENTAGE'
        ? (subtotal * coupon.value) / 100
        : Math.min(coupon.value, subtotal)
      if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount)
      discount = Math.round(discount * 100) / 100
    }
    const result = { valid: Boolean(coupon) && !message, coupon, discount, message }

    // Lean payload for mobile clients (avoid serializing full Prisma models).
    return NextResponse.json({
      valid: result.valid,
      discount: result.discount,
      message: result.message ?? null,
      code: result.coupon?.code ?? (code || null),
    })
  } catch (error) {
    console.error('Error validating coupon:', error)
    return NextResponse.json(
      { valid: false, discount: 0, message: 'Failed to validate coupon', code: null },
      { status: 200 }
    )
  }
}
