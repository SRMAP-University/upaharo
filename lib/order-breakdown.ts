/**
 * An order's price, step by step: items at their regular price, offer
 * discount, coupon, other discount, gift wrap, delivery, tax, wallet, and the
 * final total, plus what the customer saved. Plain functions (no database),
 * shared by the admin order window, the customer's order page and the API.
 *
 * Order lines store only the price paid. A line counts as on offer when the
 * product's current offer % explains that price; otherwise its price is taken
 * as the regular one, so savings are never overstated.
 */

export type BreakdownItem = {
  price: number
  quantity: number
  product?: { name?: string | null; price?: number | null; discount?: number | null } | null
}

export type BreakdownOrder = {
  items: BreakdownItem[]
  total?: number | null
  deliveryFee?: number | null
  tax?: number | null
  /** Coupon for online orders (same as couponDiscount); a manual discount for offline ones. */
  discount?: number | null
  couponDiscount?: number | null
  walletDiscount?: number | null
  isGift?: boolean | null
  giftWrap?: { price?: number | null } | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Regular price and offer % for a line, when the product's offer explains what was paid. */
export function lineOffer(item: BreakdownItem) {
  const paid = item.price * item.quantity
  const offer = Number(item.product?.discount) || 0
  const regular = Number(item.product?.price) || 0
  const onOffer = offer > 0 && regular > item.price && Math.abs(regular * (1 - offer / 100) - item.price) < 0.51
  return {
    paid,
    regularUnit: onOffer ? regular : item.price,
    regularTotal: onOffer ? regular * item.quantity : paid,
    /** Offer % (0 when not on offer). */
    offer: onOffer ? round2(offer) : 0,
    saved: onOffer ? (regular - item.price) * item.quantity : 0,
  }
}

export function orderBreakdown(order: BreakdownOrder) {
  const lines = order.items.map(lineOffer)
  const itemsRegular = lines.reduce((s, l) => s + l.regularTotal, 0)
  const subtotal = lines.reduce((s, l) => s + l.paid, 0)
  const offers = Math.max(0, itemsRegular - subtotal)
  const coupon = Math.max(0, order.couponDiscount || 0)
  const otherDiscount = Math.max(0, (order.discount || 0) - coupon)
  const giftWrap = order.isGift && order.giftWrap ? Math.max(0, order.giftWrap.price || 0) : 0
  const delivery = Math.max(0, order.deliveryFee || 0)
  const tax = Math.max(0, order.tax || 0)
  const wallet = Math.max(0, order.walletDiscount || 0)
  const total = order.total || 0
  const worked = subtotal - coupon - otherDiscount + giftWrap + delivery + tax - wallet
  // Whatever the stored total doesn't explain (some early orders carried an extra fee).
  const leftover = round2(total - worked)
  const adjustment = Math.abs(leftover) >= 0.5 ? leftover : 0
  return {
    lines,
    itemsRegular: round2(itemsRegular),
    offers: round2(offers),
    subtotal: round2(subtotal),
    coupon: round2(coupon),
    otherDiscount: round2(otherDiscount),
    giftWrap: round2(giftWrap),
    delivery: round2(delivery),
    tax: round2(tax),
    wallet: round2(wallet),
    otherCharges: adjustment > 0 ? adjustment : 0,
    otherReduction: adjustment < 0 ? -adjustment : 0,
    total: round2(total),
    /** Offers, coupon and discounts. Wallet money is the customer's own, so it isn't a saving. */
    saved: round2(offers + coupon + otherDiscount + (adjustment < 0 ? -adjustment : 0)),
  }
}

export type OrderBreakdown = ReturnType<typeof orderBreakdown>

/** How a coupon works, in words: "10% off, up to Rs 200, on orders of Rs 500+". */
export function couponRule(
  coupon: { type?: string | null; value?: number | null; maxDiscount?: number | null; minOrderAmount?: number | null },
  formatMoney: (n: number) => string
) {
  const value = Number(coupon.value) || 0
  const parts = [coupon.type === 'PERCENTAGE' ? `${round2(value)}% off` : `${formatMoney(value)} off`]
  if (coupon.type === 'PERCENTAGE' && coupon.maxDiscount) parts.push(`up to ${formatMoney(coupon.maxDiscount)}`)
  if (coupon.minOrderAmount) parts.push(`on orders of ${formatMoney(coupon.minOrderAmount)}+`)
  return parts.join(', ')
}
