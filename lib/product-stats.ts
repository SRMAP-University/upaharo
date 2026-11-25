/**
 * Product stats for admin (every product of the store) and sellers (their
 * own products): views, opens from a list ("clicks"), add to cart, wishlist,
 * orders, units and sales, per product and per day. Counts only, never who.
 *
 * Views come from ProductViewEvent (website and app), clicks and add to cart
 * from ProductEvent, wishlist from WishlistItem and sales from orders that
 * were not cancelled (inventory corrections to quantity/price win).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000
const DAY_MS = 86_400_000

export const STATS_RANGES = [1, 7, 30, 90] as const

export type ProductStatsRow = {
  id: string
  name: string
  image: string
  category: string
  price: number
  isAvailable: boolean
  views: number
  clicks: number
  addToCart: number
  /** Units added to cart (one add can be several). */
  cartUnits: number
  wishlistNow: number
  wishlistAdded: number
  orders: number
  units: number
  revenue: number
}

export type ProductStatsDay = { date: string; views: number; clicks: number; addToCart: number; orders: number; revenue: number }

export type ProductStats = {
  days: number
  from: string
  products: ProductStatsRow[]
  totals: Omit<ProductStatsRow, 'id' | 'name' | 'image' | 'category' | 'price' | 'isAvailable'> & { products: number }
  daily: ProductStatsDay[]
  /** Where products were opened from: home, category, search… */
  clickSources: Array<{ source: string; clicks: number }>
  /** When opens and cart adds started being counted (null before the first one). */
  eventsSince: string | null
}

/** Start of the day `days - 1` days ago, in Nepal time (so "today" means today in Kathmandu). */
function rangeStart(days: number, now = new Date()) {
  const nepalNow = new Date(now.getTime() + NEPAL_OFFSET_MS)
  const nepalMidnight = Date.UTC(nepalNow.getUTCFullYear(), nepalNow.getUTCMonth(), nepalNow.getUTCDate())
  return new Date(nepalMidnight - (days - 1) * DAY_MS - NEPAL_OFFSET_MS)
}

function nepalDay(date: Date) {
  return new Date(date.getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)
}

const n = (value: unknown) => Number(value) || 0

export async function getProductStats(options: {
  /** Which products: the store's (admin) or a seller's. */
  productWhere: Prisma.ProductWhereInput
  days: number
}): Promise<ProductStats> {
  const days = (STATS_RANGES as readonly number[]).includes(options.days) ? options.days : 30
  const from = rangeStart(days)

  const products = await prisma.product.findMany({
    where: { ...options.productWhere, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } },
    select: { id: true, name: true, image: true, category: true, price: true, isAvailable: true },
    orderBy: { createdAt: 'desc' },
  })
  const ids = products.map((product) => product.id)
  const empty: ProductStats = {
    days,
    from: from.toISOString(),
    products: [],
    totals: { products: 0, views: 0, clicks: 0, addToCart: 0, cartUnits: 0, wishlistNow: 0, wishlistAdded: 0, orders: 0, units: 0, revenue: 0 },
    daily: [],
    clickSources: [],
    eventsSince: null,
  }
  if (!ids.length) return empty
  const idList = Prisma.join(ids)

  const [views, events, wishlistNow, wishlistAdded, sales, orderTotals, viewDays, eventDays, orderDays, sources, firstEvent] = await Promise.all([
    prisma.productViewEvent.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, viewedAt: { gte: from } },
      _count: { _all: true },
    }),
    prisma.productEvent
      .groupBy({
        by: ['productId', 'type'],
        where: { productId: { in: ids }, createdAt: { gte: from } },
        _count: { _all: true },
        _sum: { quantity: true },
      })
      // Before the first deploy creates the table, show zeros instead of failing.
      .catch(() => [] as Array<{ productId: string; type: string; _count: { _all: number }; _sum: { quantity: number | null } }>),
    prisma.wishlistItem.groupBy({ by: ['productId'], where: { productId: { in: ids } }, _count: { _all: true } }),
    prisma.wishlistItem.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, createdAt: { gte: from } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ productId: string; orders: number; units: number; revenue: number }>>`
      SELECT oi."productId" AS "productId",
             COUNT(DISTINCT oi."orderId")::int AS orders,
             COALESCE(SUM(COALESCE(oi."inventoryQty", oi."quantity")), 0)::int AS units,
             COALESCE(SUM(COALESCE(oi."inventoryQty", oi."quantity") * COALESCE(oi."inventoryPrice", oi."price")), 0)::float AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE oi."productId" IN (${idList}) AND o."placedAt" >= ${from} AND o."status"::text <> 'CANCELLED'
      GROUP BY oi."productId"`,
    prisma.$queryRaw<Array<{ orders: number }>>`
      SELECT COUNT(DISTINCT oi."orderId")::int AS orders
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE oi."productId" IN (${idList}) AND o."placedAt" >= ${from} AND o."status"::text <> 'CANCELLED'`,
    prisma.$queryRaw<Array<{ day: Date; views: number }>>`
      SELECT date_trunc('day', "viewedAt" + interval '5 hours 45 minutes') AS day, COUNT(*)::int AS views
      FROM "ProductViewEvent"
      WHERE "productId" IN (${idList}) AND "viewedAt" >= ${from}
      GROUP BY 1`,
    prisma
      .$queryRaw<Array<{ day: Date; type: string; count: number }>>`
        SELECT date_trunc('day', "createdAt" + interval '5 hours 45 minutes') AS day, "type", COUNT(*)::int AS count
        FROM "ProductEvent"
        WHERE "productId" IN (${idList}) AND "createdAt" >= ${from}
        GROUP BY 1, 2`
      .catch(() => [] as Array<{ day: Date; type: string; count: number }>),
    prisma.$queryRaw<Array<{ day: Date; orders: number; revenue: number }>>`
      SELECT date_trunc('day', o."placedAt" + interval '5 hours 45 minutes') AS day,
             COUNT(DISTINCT oi."orderId")::int AS orders,
             COALESCE(SUM(COALESCE(oi."inventoryQty", oi."quantity") * COALESCE(oi."inventoryPrice", oi."price")), 0)::float AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE oi."productId" IN (${idList}) AND o."placedAt" >= ${from} AND o."status"::text <> 'CANCELLED'
      GROUP BY 1`,
    prisma.productEvent
      .groupBy({
        by: ['source'],
        where: { productId: { in: ids }, createdAt: { gte: from }, type: 'click' },
        _count: { _all: true },
      })
      .catch(() => [] as Array<{ source: string | null; _count: { _all: number } }>),
    prisma.productEvent
      .findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
      .catch(() => null),
  ])

  const byId = <T extends { productId: string }>(rows: T[]) => new Map(rows.map((row) => [row.productId, row]))
  const viewMap = byId(views)
  const wishNow = byId(wishlistNow)
  const wishAdded = byId(wishlistAdded)
  const salesMap = byId(sales)
  const eventMap = new Map<string, { clicks: number; addToCart: number; cartUnits: number }>()
  for (const row of events) {
    const entry = eventMap.get(row.productId) || { clicks: 0, addToCart: 0, cartUnits: 0 }
    if (row.type === 'click') entry.clicks += row._count._all
    if (row.type === 'add_to_cart') {
      entry.addToCart += row._count._all
      entry.cartUnits += n(row._sum.quantity)
    }
    eventMap.set(row.productId, entry)
  }

  const rows: ProductStatsRow[] = products.map((product) => {
    const event = eventMap.get(product.id)
    const sale = salesMap.get(product.id)
    return {
      id: product.id,
      name: product.name,
      image: product.image,
      category: product.category,
      price: product.price,
      isAvailable: product.isAvailable,
      views: n(viewMap.get(product.id)?._count._all),
      clicks: event?.clicks || 0,
      addToCart: event?.addToCart || 0,
      cartUnits: event?.cartUnits || 0,
      wishlistNow: n(wishNow.get(product.id)?._count._all),
      wishlistAdded: n(wishAdded.get(product.id)?._count._all),
      orders: n(sale?.orders),
      units: n(sale?.units),
      revenue: Math.round(n(sale?.revenue) * 100) / 100,
    }
  })

  const sum = (key: keyof ProductStatsRow) => rows.reduce((total, row) => total + n(row[key]), 0)

  // One entry per day of the range, so the chart has no gaps.
  const daily = new Map<string, ProductStatsDay>()
  for (let i = 0; i < days; i++) {
    const date = nepalDay(new Date(from.getTime() + i * DAY_MS + NEPAL_OFFSET_MS))
    daily.set(date, { date, views: 0, clicks: 0, addToCart: 0, orders: 0, revenue: 0 })
  }
  // date_trunc on the Nepal-shifted time gives the Nepal date at midnight UTC.
  const dayKey = (day: Date) => new Date(day).toISOString().slice(0, 10)
  for (const row of viewDays) {
    const entry = daily.get(dayKey(row.day))
    if (entry) entry.views += n(row.views)
  }
  for (const row of eventDays) {
    const entry = daily.get(dayKey(row.day))
    if (!entry) continue
    if (row.type === 'click') entry.clicks += n(row.count)
    if (row.type === 'add_to_cart') entry.addToCart += n(row.count)
  }
  for (const row of orderDays) {
    const entry = daily.get(dayKey(row.day))
    if (!entry) continue
    entry.orders += n(row.orders)
    entry.revenue += Math.round(n(row.revenue) * 100) / 100
  }

  return {
    days,
    from: from.toISOString(),
    products: rows,
    totals: {
      products: rows.length,
      views: sum('views'),
      clicks: sum('clicks'),
      addToCart: sum('addToCart'),
      cartUnits: sum('cartUnits'),
      wishlistNow: sum('wishlistNow'),
      wishlistAdded: sum('wishlistAdded'),
      orders: n(orderTotals[0]?.orders),
      units: sum('units'),
      revenue: Math.round(sum('revenue') * 100) / 100,
    },
    daily: Array.from(daily.values()),
    clickSources: sources
      .map((row) => ({ source: row.source || 'other', clicks: row._count._all }))
      .sort((a, b) => b.clicks - a.clicks),
    eventsSince: firstEvent?.createdAt ? firstEvent.createdAt.toISOString() : null,
  }
}
