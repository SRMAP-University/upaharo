/**
 * Custom sales sheets (Inventory → Custom sales): a working copy of some
 * orders for a festival or season, with quantities, prices and costs that
 * can be changed freely to see the profit or loss. Nothing here touches real
 * orders or stock. Plain functions shared by the page and the API.
 */

export type SheetLine = {
  key: string
  productId: string | null
  name: string
  image: string
  qty: number
  /** Selling price for one. */
  price: number
  /** Purchase cost for one; null when not known (counted as 0 and flagged). */
  purchase: number | null
  /** Packing cost for one. */
  packing: number
}

export type SheetOrder = {
  key: string
  /** The real order it was copied from (null for one typed in). */
  orderId: string | null
  orderNumber: string | null
  /** Customer name or a description. */
  label: string
  /** When the real order was placed (ISO). */
  date: string | null
  /** Count this order this many times, e.g. expected orders like it. */
  times: number
  /** Discount or coupon given on the order. */
  discount: number
  /** Delivery fee the customer pays. */
  deliveryCharged: number
  /** What the delivery costs the shop. */
  deliveryCost: number
  /** Packing for the whole order (box, card, bag) on top of each item's. */
  packing: number
  lines: SheetLine[]
}

/** A cost for the whole sheet: stall rent, ads, staff… */
export type SheetCost = { key: string; label: string; amount: number }

export type SheetData = { orders: SheetOrder[]; costs: SheetCost[] }

export const SHEET_LIMITS = { orders: 300, lines: 60, costs: 50, text: 200 }

const round2 = (n: number) => Math.round(n * 100) / 100
const money = (v: unknown, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? round2(Math.min(n, 100_000_000)) : fallback
}
const text = (v: unknown, max = SHEET_LIMITS.text) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export const newKey = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const keyOf = (v: unknown) => {
  const s = String(v ?? '')
  return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : newKey()
}

/** A clean sheet from whatever was sent (bad numbers become 0, lists are capped). */
export function cleanSheetData(input: unknown): SheetData {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const orders = (Array.isArray(raw.orders) ? raw.orders : []).slice(0, SHEET_LIMITS.orders).map((o) => {
    const order = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
    const lines = (Array.isArray(order.lines) ? order.lines : []).slice(0, SHEET_LIMITS.lines).map((l) => {
      const line = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
      return {
        key: keyOf(line.key),
        productId: line.productId ? text(line.productId, 40) : null,
        name: text(line.name) || 'Item',
        image: text(line.image, 500),
        qty: Math.max(0, Math.min(100_000, Math.round(Number(line.qty) || 0))),
        price: money(line.price),
        purchase: line.purchase === null || line.purchase === undefined || line.purchase === '' ? null : money(line.purchase),
        packing: money(line.packing),
      } satisfies SheetLine
    })
    return {
      key: keyOf(order.key),
      orderId: order.orderId ? text(order.orderId, 40) : null,
      orderNumber: order.orderNumber ? text(order.orderNumber, 60) : null,
      label: text(order.label),
      date: typeof order.date === 'string' && !Number.isNaN(Date.parse(order.date)) ? order.date : null,
      times: Math.max(1, Math.min(10_000, Math.round(Number(order.times) || 1))),
      discount: money(order.discount),
      deliveryCharged: money(order.deliveryCharged),
      deliveryCost: money(order.deliveryCost),
      packing: money(order.packing),
      lines,
    } satisfies SheetOrder
  })
  const costs = (Array.isArray(raw.costs) ? raw.costs : []).slice(0, SHEET_LIMITS.costs).map((c) => {
    const cost = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
    return { key: keyOf(cost.key), label: text(cost.label), amount: money(cost.amount) } satisfies SheetCost
  })
  return { orders, costs }
}

export const lineSales = (l: SheetLine) => l.qty * l.price
export const lineCost = (l: SheetLine) => l.qty * ((l.purchase ?? 0) + l.packing)
export const lineProfit = (l: SheetLine) => lineSales(l) - lineCost(l)

/** One order, counted once (multiply by order.times for the sheet). */
export function orderTotals(order: SheetOrder) {
  const sales = order.lines.reduce((s, l) => s + lineSales(l), 0)
  const discount = Math.min(order.discount, sales)
  const revenue = sales - discount + order.deliveryCharged
  const purchase = order.lines.reduce((s, l) => s + l.qty * (l.purchase ?? 0), 0)
  const packing = order.lines.reduce((s, l) => s + l.qty * l.packing, 0) + order.packing
  const cost = purchase + packing + order.deliveryCost
  return {
    items: order.lines.reduce((s, l) => s + l.qty, 0),
    sales: round2(sales),
    discount: round2(discount),
    deliveryCharged: round2(order.deliveryCharged),
    revenue: round2(revenue),
    purchase: round2(purchase),
    packing: round2(packing),
    deliveryCost: round2(order.deliveryCost),
    cost: round2(cost),
    profit: round2(revenue - cost),
    /** Lines with a quantity but no purchase cost. */
    missingPurchase: order.lines.filter((l) => l.qty > 0 && l.purchase === null).length,
  }
}

export type SheetTotals = ReturnType<typeof sheetTotals>

/** The whole sheet: every order times its count, less the sheet's own costs. */
export function sheetTotals(data: SheetData) {
  const t = { orders: 0, items: 0, sales: 0, discount: 0, deliveryCharged: 0, revenue: 0, purchase: 0, packing: 0, deliveryCost: 0, missingPurchase: 0 }
  for (const order of data.orders) {
    const o = orderTotals(order)
    const n = order.times
    t.orders += n
    t.items += o.items * n
    t.sales += o.sales * n
    t.discount += o.discount * n
    t.deliveryCharged += o.deliveryCharged * n
    t.revenue += o.revenue * n
    t.purchase += o.purchase * n
    t.packing += o.packing * n
    t.deliveryCost += o.deliveryCost * n
    t.missingPurchase += o.missingPurchase
  }
  const otherCosts = data.costs.reduce((s, c) => s + c.amount, 0)
  const cost = t.purchase + t.packing + t.deliveryCost + otherCosts
  const profit = t.revenue - cost
  return {
    orders: t.orders,
    items: t.items,
    sales: round2(t.sales),
    discount: round2(t.discount),
    deliveryCharged: round2(t.deliveryCharged),
    revenue: round2(t.revenue),
    purchase: round2(t.purchase),
    packing: round2(t.packing),
    deliveryCost: round2(t.deliveryCost),
    otherCosts: round2(otherCosts),
    cost: round2(cost),
    profit: round2(profit),
    /** Profit as a share of revenue (null with no revenue). */
    margin: t.revenue > 0 ? round2((profit / t.revenue) * 100) : null,
    missingPurchase: t.missingPurchase,
  }
}
