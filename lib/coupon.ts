import { prisma } from '@/lib/prisma'
import { Coupon, CouponType, CouponApplicability } from '@prisma/client'

export interface CartSummary {
  subtotal: number
  productIds?: string[]
}

export interface ValidationResult {
  valid: boolean
  coupon?: Coupon
  discount: number
  message?: string
}

async function gatherCategories(productIds?: string[], storeId?: string) {
  if (!productIds || productIds.length === 0) return []
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, ...(storeId ? { storeId } : {}) },
    select: { id: true, category: true }
  })
  return products.map((p) => p.category.trim().toLowerCase())
}

export async function validateCoupon(
  code: string,
  cart: CartSummary,
  storeId = 'store_gifts'
): Promise<ValidationResult> {
  if (!code?.trim()) {
    return { valid: false, discount: 0, message: 'Coupon code is required' }
  }

  const coupon = await prisma.coupon.findUnique({
    where: {
      storeId_code: {
        storeId,
        code: code.trim().toUpperCase(),
      },
    },
  })

  if (!coupon) {
    return { valid: false, discount: 0, message: 'Invalid coupon code' }
  }

  if (!coupon.isActive) {
    return { valid: false, discount: 0, message: 'Coupon is inactive' }
  }

  const now = new Date()
  if (coupon.startAt && now < coupon.startAt) {
    return { valid: false, discount: 0, message: 'Coupon is not active yet' }
  }
  if (coupon.endAt && now > coupon.endAt) {
    return { valid: false, discount: 0, message: 'Coupon has expired' }
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discount: 0, message: 'Coupon usage limit reached' }
  }

  if (cart.subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      discount: 0,
      message: `Minimum order amount of ${coupon.minOrderAmount} required`
    }
  }

  const productIds = cart.productIds ?? []
  const categoryNames = await gatherCategories(productIds, storeId)

  if (coupon.applicability === CouponApplicability.PRODUCTS) {
    const applicable = productIds.some((id) =>
      coupon.applicableProductIds.includes(id)
    )
    if (!applicable) {
      return { valid: false, discount: 0, message: 'Coupon not applicable to these products' }
    }
  }

  if (coupon.applicability === CouponApplicability.CATEGORIES) {
    const normalizedApplicable = coupon.applicableCategoryIds.map((c) =>
      c.trim().toLowerCase()
    )
    const applicable = categoryNames.some((name) =>
      normalizedApplicable.includes(name)
    )
    if (!applicable) {
      return { valid: false, discount: 0, message: 'Coupon not applicable to this category' }
    }
  }

  let discount = 0
  if (coupon.type === CouponType.PERCENTAGE) {
    discount = (cart.subtotal * coupon.value) / 100
    if (coupon.maxDiscount != null && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount
    }
  } else {
    discount = Math.min(coupon.value, cart.subtotal)
  }

  return { valid: true, coupon, discount: Math.round(discount * 100) / 100 }
}

export function calculateDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.type === CouponType.PERCENTAGE) {
    const discount = (subtotal * coupon.value) / 100
    if (coupon.maxDiscount != null && discount > coupon.maxDiscount) {
      return coupon.maxDiscount
    }
    return discount
  }
  return Math.min(coupon.value, subtotal)
}
