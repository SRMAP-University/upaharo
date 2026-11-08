/**
 * Admin dashboard numbers for any period (Nepal calendar days), and the
 * orders, products and customers behind each number. Cancelled orders are
 * never counted as sales; they're counted separately.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const DAY_MS = 86_400_000
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000
export const nepalDay = (date: Date) => new Date(date.getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)
const dayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - NEPAL_OFFSET_MS)
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

/** From / to Nepal days; null means open-ended (all time). */
export type Period = { from: string | null; to: string | null }

export function readPeriod(params: URLSearchParams): Period {
  const from = params.get('from')
  const to = params.get('to')
  const period: Period = { from: isDay(from) ? from : null, to: isDay(to) ? to : null }
  if (period.from && period.to && period.to < period.from) return { from: period.to, to: period.from }
  return period
}

function orderWhere(storeId: string, period: Period): Prisma.OrderWhereInput {
  const createdAt: Prisma.DateTimeFilter = {}
  if (period.from) createdAt.gte = dayStart(period.from)
  if (period.to) createdAt.lt = new Date(dayStart(period.to).getTime() + DAY_MS)
  return { storeId, ...(createdAt.gte || createdAt.lt ? { createdAt } : {}) }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export type SeriesPoint = { key: string; from: string; to: string; orders: number; revenue: number }

/** Totals for the period, plus a day-by-day (or month-by-month) series. */
export async function periodStats(storeId: string, period: Period) {
  const orders = await prisma.order.findMany({
    where: orderWhere(storeId, period),
    select: { status: true, total: true, createdAt: true, userId: true, items: { select: { productId: true, quantity: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const live = orders.filter((o) => o.status !== 'CANCELLED')
  const delivered = live.filter((o) => o.status === 'DELIVERED')
  const products = new Set<string>()
  let itemsSold = 0
  for (const o of live) for (const i of o.items) {
    products.add(i.productId)
    itemsSold += i.quantity
  }

  // Series: from the period start (or the first order) to its end (or today).
  // A single day shows the week ending on it.
  const today = nepalDay(new Date())
  const last = period.to || today
  const singleDay = Boolean(period.from && period.from === period.to)
  const first = singleDay
    ? new Date(Date.parse(last) - 6 * DAY_MS).toISOString().slice(0, 10)
    : period.from || (orders[0] ? nepalDay(orders[0].createdAt) : today)
  const seriesOrders = singleDay
    ? await prisma.order.findMany({
        where: { ...orderWhere(storeId, { from: first, to: last }), status: { not: 'CANCELLED' } },
        select: { status: true, total: true, createdAt: true },
      })
    : live
  const days = Math.round((Date.parse(last) - Date.parse(first)) / DAY_MS) + 1
  const byMonth = days > 62
  const buckets = new Map<string, SeriesPoint>()
  for (let t = Date.parse(first); t <= Date.parse(last); t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10)
    const key = byMonth ? day.slice(0, 7) : day
    const b = buckets.get(key)
    if (b) b.to = day
    else buckets.set(key, { key, from: day, to: day, orders: 0, revenue: 0 })
  }
  for (const o of seriesOrders) {
    const day = nepalDay(o.createdAt)
    const b = buckets.get(byMonth ? day.slice(0, 7) : day)
    if (!b) continue
    b.orders += 1
    b.revenue = round2(b.revenue + (o.total || 0))
  }

  return {
    from: period.from,
    to: period.to,
    orders: live.length,
    cancelled: orders.length - live.length,
    sales: round2(live.reduce((s, o) => s + (o.total || 0), 0)),
    deliveredOrders: delivered.length,
    deliveredSales: round2(delivered.reduce((s, o) => s + (o.total || 0), 0)),
    customers: new Set(live.map((o) => o.userId)).size,
    itemsSold,
    productsSold: products.size,
    groupBy: byMonth ? ('month' as const) : ('day' as const),
    seriesFrom: first,
    seriesTo: last,
    series: [...buckets.values()],
  }
}

export type DetailKind = 'orders' | 'delivered' | 'cancelled' | 'products' | 'customers'
export const DETAIL_KINDS: DetailKind[] = ['orders', 'delivered', 'cancelled', 'products', 'customers']

/** What's behind a dashboard number: the orders, products or customers. */
export async function periodDetails(storeId: string, period: Period, kind: DetailKind, page = 1, perPage = 50) {
  const where = orderWhere(storeId, period)
  const skip = (Math.max(1, page) - 1) * perPage

  if (kind === 'orders' || kind === 'delivered' || kind === 'cancelled') {
    const status: Prisma.OrderWhereInput =
      kind === 'delivered' ? { status: 'DELIVERED' } : kind === 'cancelled' ? { status: 'CANCELLED' } : { status: { not: 'CANCELLED' } }
    const [total, sum, rows] = await Promise.all([
      prisma.order.count({ where: { ...where, ...status } }),
      prisma.order.aggregate({ where: { ...where, ...status }, _sum: { total: true } }),
      prisma.order.findMany({
        where: { ...where, ...status },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          status: true,
          source: true,
          total: true,
          paymentStatus: true,
          cancelReason: true,
          user: { select: { name: true, phone: true } },
          items: { select: { quantity: true, price: true, product: { select: { id: true, name: true, image: true } } } },
        },
      }),
    ])
    return {
      kind,
      total,
      amount: round2(sum._sum.total || 0),
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      orders: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
        status: o.status,
        source: o.source,
        total: o.total,
        paymentStatus: o.paymentStatus,
        cancelReason: o.cancelReason,
        customer: o.user?.name || '',
        phone: o.user?.phone || null,
        items: o.items.map((i) => ({ productId: i.product.id, name: i.product.name, image: i.product.image, quantity: i.quantity, price: i.price })),
      })),
    }
  }

  // Products and customers come from the period's non-cancelled orders.
  const orders = await prisma.order.findMany({
    where: { ...where, status: { not: 'CANCELLED' } },
    select: { userId: true, total: true, createdAt: true, items: { select: { productId: true, quantity: true, price: true } } },
  })

  if (kind === 'products') {
    const byProduct = new Map<string, { quantity: number; sales: number; orders: number }>()
    for (const o of orders) {
      const seen = new Set<string>()
      for (const i of o.items) {
        const e = byProduct.get(i.productId) ?? { quantity: 0, sales: 0, orders: 0 }
        e.quantity += i.quantity
        e.sales += i.quantity * i.price
        if (!seen.has(i.productId)) e.orders += 1
        seen.add(i.productId)
        byProduct.set(i.productId, e)
      }
    }
    const sorted = [...byProduct.entries()].sort((a, b) => b[1].quantity - a[1].quantity || b[1].sales - a[1].sales)
    const pageRows = sorted.slice(skip, skip + perPage)
    const info = await prisma.product.findMany({
      where: { id: { in: pageRows.map(([id]) => id) } },
      select: { id: true, name: true, image: true, price: true, isAvailable: true },
    })
    const byId = new Map(info.map((p) => [p.id, p]))
    return {
      kind,
      total: sorted.length,
      amount: round2(sorted.reduce((s, [, e]) => s + e.sales, 0)),
      units: sorted.reduce((s, [, e]) => s + e.quantity, 0),
      totalPages: Math.max(1, Math.ceil(sorted.length / perPage)),
      products: pageRows.map(([id, e]) => ({
        id,
        name: byId.get(id)?.name || 'Removed product',
        image: byId.get(id)?.image || '',
        isAvailable: byId.get(id)?.isAvailable ?? false,
        quantity: e.quantity,
        orders: e.orders,
        sales: round2(e.sales),
      })),
    }
  }

  const byCustomer = new Map<string, { orders: number; spent: number; last: Date }>()
  for (const o of orders) {
    const e = byCustomer.get(o.userId) ?? { orders: 0, spent: 0, last: o.createdAt }
    e.orders += 1
    e.spent += o.total || 0
    if (o.createdAt > e.last) e.last = o.createdAt
    byCustomer.set(o.userId, e)
  }
  const sorted = [...byCustomer.entries()].sort((a, b) => b[1].spent - a[1].spent)
  const pageRows = sorted.slice(skip, skip + perPage)
  const users = await prisma.user.findMany({
    where: { id: { in: pageRows.map(([id]) => id) } },
    select: { id: true, name: true, email: true, phone: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))
  return {
    kind,
    total: sorted.length,
    amount: round2(sorted.reduce((s, [, e]) => s + e.spent, 0)),
    totalPages: Math.max(1, Math.ceil(sorted.length / perPage)),
    customers: pageRows.map(([id, e]) => ({
      id,
      name: byId.get(id)?.name || 'Customer',
      email: byId.get(id)?.email || '',
      phone: byId.get(id)?.phone || null,
      orders: e.orders,
      spent: round2(e.spent),
      lastOrderAt: e.last.toISOString(),
    })),
  }
}
