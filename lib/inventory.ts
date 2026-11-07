/**
 * Inventory: stock left per product, stock value, and sales / profit
 * reports. Stock left = the last stock count minus units sold since then
 * (cancelled orders never count), so order flows don't have to adjust stock.
 * Profit uses each product's purchase price (costPrice).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000
const DAY_MS = 86_400_000
/** Stock at or below this (and above 0) counts as low. */
export const LOW_STOCK = 5

export type StockStatus = 'in' | 'low' | 'out' | 'untracked'

export type InventoryRow = {
  id: string
  name: string
  sku: string | null
  category: string
  image: string
  isAvailable: boolean
  trackStock: boolean
  /** Last counted stock. */
  countedQty: number | null
  countedAt: string | null
  soldSinceCount: number
  /** What's left now (null when stock isn't tracked). */
  available: number | null
  status: StockStatus
  costPrice: number | null
  price: number
  discount: number
  salePrice: number
  /** Profit per unit at the sale price (null without a purchase price). */
  unitProfit: number | null
  marginPercent: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const salePriceOf = (p: { price: number; discount: number | null }) =>
  round2(p.price * (1 - Math.min(100, Math.max(0, Number(p.discount) || 0)) / 100))

/** Units sold since each product's last stock count (non-cancelled orders). */
async function soldSinceCount(storeId: string, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, number>()
  const rows = await prisma.$queryRaw<Array<{ productId: string; sold: number }>>`
    SELECT oi."productId" AS "productId", COALESCE(SUM(oi."quantity"), 0)::int AS sold
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    JOIN "Product" p ON p."id" = oi."productId"
    WHERE o."storeId" = ${storeId}
      AND o."status" <> 'CANCELLED'
      AND p."stockCountedAt" IS NOT NULL
      AND o."createdAt" >= p."stockCountedAt"
      AND oi."productId" IN (${Prisma.join(productIds)})
    GROUP BY oi."productId"
  `
  return new Map(rows.map((r) => [r.productId, Number(r.sold) || 0]))
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  category: true,
  image: true,
  isAvailable: true,
  trackStock: true,
  stockQty: true,
  stockCountedAt: true,
  costPrice: true,
  price: true,
  discount: true,
} as const

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>

function toRow(p: ProductRow, sold: number): InventoryRow {
  const salePrice = salePriceOf(p)
  const available = p.trackStock ? Math.max(0, (p.stockQty ?? 0) - sold) : null
  const status: StockStatus = !p.trackStock ? 'untracked' : available! <= 0 ? 'out' : available! <= LOW_STOCK ? 'low' : 'in'
  const unitProfit = p.costPrice !== null && p.costPrice !== undefined ? round2(salePrice - p.costPrice) : null
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    image: p.image,
    isAvailable: p.isAvailable,
    trackStock: p.trackStock,
    countedQty: p.trackStock ? p.stockQty ?? 0 : null,
    countedAt: p.stockCountedAt ? p.stockCountedAt.toISOString() : null,
    soldSinceCount: sold,
    available,
    status,
    costPrice: p.costPrice ?? null,
    price: p.price,
    discount: Number(p.discount) || 0,
    salePrice,
    unitProfit,
    marginPercent: unitProfit !== null && salePrice > 0 ? round2((unitProfit / salePrice) * 100) : null,
  }
}

async function rowsFor(storeId: string, products: ProductRow[]) {
  const sold = await soldSinceCount(
    storeId,
    products.filter((p) => p.trackStock && p.stockCountedAt).map((p) => p.id)
  )
  return products.map((p) => toRow(p, sold.get(p.id) ?? 0))
}

export async function inventoryRow(storeId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, storeId }, select: PRODUCT_SELECT })
  if (!product) return null
  return (await rowsFor(storeId, [product]))[0]
}

/** Current stock left for one product (null when not tracked). */
export async function availableStock(storeId: string, productId: string) {
  return (await inventoryRow(storeId, productId))?.available ?? null
}

export async function listInventory(
  storeId: string,
  options: { search?: string; status?: StockStatus | 'all'; category?: string; page?: number; perPage?: number }
) {
  const perPage = [20, 50, 100].includes(Number(options.perPage)) ? Number(options.perPage) : 50
  const page = Math.max(1, Math.floor(Number(options.page) || 1))
  const search = String(options.search || '').trim()
  const where: Prisma.ProductWhereInput = {
    storeId,
    // Archived products (and hidden custom lines from offline orders) aren't stock.
    NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
    ...(options.category && options.category !== 'all' ? { category: options.category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  // Summary across the whole store (tracked products are what stock counts cover).
  const tracked = await prisma.product.findMany({
    where: { storeId, trackStock: true, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } },
    select: PRODUCT_SELECT,
  })
  const trackedRows = await rowsFor(storeId, tracked)
  const [allCount, noCost] = await Promise.all([
    prisma.product.count({ where: { storeId, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } } }),
    prisma.product.count({ where: { storeId, costPrice: null, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } } }),
  ])
  const summary = {
    products: allCount,
    tracked: trackedRows.length,
    inStock: trackedRows.filter((r) => r.status === 'in').length,
    lowStock: trackedRows.filter((r) => r.status === 'low').length,
    outOfStock: trackedRows.filter((r) => r.status === 'out').length,
    untracked: allCount - trackedRows.length,
    withoutPurchasePrice: noCost,
    stockValueAtCost: round2(trackedRows.reduce((s, r) => s + (r.available ?? 0) * (r.costPrice ?? 0), 0)),
    stockValueAtSale: round2(trackedRows.reduce((s, r) => s + (r.available ?? 0) * r.salePrice, 0)),
  }

  const status = options.status && options.status !== 'all' ? options.status : null
  let rows: InventoryRow[]
  let total: number
  if (status && status !== 'untracked') {
    // Stock status depends on sales, so filter the tracked rows in memory (they're few).
    const matching = (await rowsFor(storeId, await prisma.product.findMany({ where: { ...where, trackStock: true }, select: PRODUCT_SELECT, orderBy: { name: 'asc' } }))).filter(
      (r) => r.status === status
    )
    total = matching.length
    rows = matching.slice((page - 1) * perPage, page * perPage)
  } else {
    const scoped = status === 'untracked' ? { ...where, trackStock: false } : where
    const [count, products] = await Promise.all([
      prisma.product.count({ where: scoped }),
      prisma.product.findMany({
        where: scoped,
        select: PRODUCT_SELECT,
        orderBy: [{ trackStock: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])
    total = count
    rows = await rowsFor(storeId, products)
  }

  return { rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)), summary }
}

// ---------------------------------------------------------------- reports

/** Nepal calendar day (YYYY-MM-DD) of a moment. */
export const nepalDay = (date: Date) => new Date(date.getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)
/** Start of a Nepal calendar day, as a real instant. */
const dayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - NEPAL_OFFSET_MS)

export type SalesBucket = {
  key: string
  orders: number
  /** Items at the prices they were sold for. */
  itemSales: number
  /** Order discount or coupon. */
  discounts: number
  netSales: number
  /** Purchase cost of the items that have a purchase price. */
  cost: number
  profit: number
  /** Sales of items without a purchase price (left out of profit). */
  uncostedSales: number
  deliveryFees: number
}

const emptyBucket = (key: string): SalesBucket => ({
  key,
  orders: 0,
  itemSales: 0,
  discounts: 0,
  netSales: 0,
  cost: 0,
  profit: 0,
  uncostedSales: 0,
  deliveryFees: 0,
})

/**
 * Sales and profit between two Nepal days (inclusive), by day or by month.
 * Cancelled orders are left out. Profit = (sales − purchase cost) of items
 * with a purchase price, less their share of the order's discounts.
 */
export async function salesReport(
  storeId: string,
  options: { from: string; to: string; groupBy?: 'day' | 'month'; source?: 'all' | 'online' | 'offline' }
) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(options.from) ? options.from : nepalDay(new Date())
  const to = /^\d{4}-\d{2}-\d{2}$/.test(options.to) && options.to >= from ? options.to : from
  const groupBy = options.groupBy === 'month' ? 'month' : 'day'
  const start = dayStart(from)
  const end = new Date(dayStart(to).getTime() + DAY_MS)

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: { not: 'CANCELLED' },
      createdAt: { gte: start, lt: end },
      ...(options.source === 'offline' ? { source: 'OFFLINE' } : options.source === 'online' ? { source: 'UPAHARO' } : {}),
    },
    select: {
      createdAt: true,
      discount: true,
      couponDiscount: true,
      deliveryFee: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          price: true,
          product: { select: { name: true, costPrice: true } },
        },
      },
    },
  })

  const buckets = new Map<string, SalesBucket>()
  // Every day / month in range shows, even with no sales.
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) {
    const day = nepalDay(new Date(t))
    const key = groupBy === 'month' ? day.slice(0, 7) : day
    if (!buckets.has(key)) buckets.set(key, emptyBucket(key))
  }
  const totals = emptyBucket('total')
  const byProduct = new Map<string, { id: string; name: string; quantity: number; sales: number; profit: number | null }>()

  for (const order of orders) {
    const day = nepalDay(order.createdAt)
    const key = groupBy === 'month' ? day.slice(0, 7) : day
    const bucket = buckets.get(key) ?? emptyBucket(key)
    buckets.set(key, bucket)

    const itemSales = order.items.reduce((s, i) => s + i.price * i.quantity, 0)
    // Online orders store the coupon in both fields; offline ones use `discount`.
    const discounts = Math.min(itemSales, Math.max(order.discount || 0, order.couponDiscount || 0))
    let costedSales = 0
    let cost = 0
    for (const item of order.items) {
      const lineSales = item.price * item.quantity
      const unitCost = item.product.costPrice
      const share = itemSales > 0 ? discounts * (lineSales / itemSales) : 0
      const entry = byProduct.get(item.productId) ?? { id: item.productId, name: item.product.name, quantity: 0, sales: 0, profit: 0 }
      entry.quantity += item.quantity
      entry.sales += lineSales - share
      if (unitCost !== null && unitCost !== undefined) {
        costedSales += lineSales
        cost += unitCost * item.quantity
        if (entry.profit !== null) entry.profit += lineSales - share - unitCost * item.quantity
      } else {
        entry.profit = null
      }
      byProduct.set(item.productId, entry)
    }
    const costedShare = itemSales > 0 ? discounts * (costedSales / itemSales) : 0
    for (const target of [bucket, totals]) {
      target.orders += 1
      target.itemSales += itemSales
      target.discounts += discounts
      target.netSales += itemSales - discounts
      target.cost += cost
      target.profit += costedSales - cost - costedShare
      target.uncostedSales += itemSales - costedSales
      target.deliveryFees += order.deliveryFee || 0
    }
  }

  const tidy = (b: SalesBucket): SalesBucket => ({
    ...b,
    itemSales: round2(b.itemSales),
    discounts: round2(b.discounts),
    netSales: round2(b.netSales),
    cost: round2(b.cost),
    profit: round2(b.profit),
    uncostedSales: round2(b.uncostedSales),
    deliveryFees: round2(b.deliveryFees),
  })

  const products = [...byProduct.values()].map((p) => ({
    ...p,
    sales: round2(p.sales),
    profit: p.profit === null ? null : round2(p.profit),
  }))

  return {
    from,
    to,
    groupBy,
    totals: tidy(totals),
    buckets: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).map(tidy),
    topBySales: [...products].sort((a, b) => b.sales - a.sales).slice(0, 10),
    topByProfit: products.filter((p) => p.profit !== null).sort((a, b) => b.profit! - a.profit!).slice(0, 10),
  }
}
