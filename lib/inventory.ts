/**
 * Inventory: stock left per product, stock value, hampers, and sales / profit
 * reports. Stock left = the last stock count minus units sold since then
 * (cancelled orders never count), so order flows don't have to adjust stock.
 * A unit costs its purchase price plus packaging; a hamper costs its items
 * plus its own packaging, and selling one uses up its items' stock.
 * Orders switched off or deleted in Inventory don't count, and Inventory's
 * corrected quantity / price on an order line replaces what was ordered.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000
const DAY_MS = 86_400_000
/** Stock at or below this (and above 0) counts as low. */
export const LOW_STOCK = 5

export type StockStatus = 'in' | 'low' | 'out' | 'untracked'
export type InventoryFilter = StockStatus | 'hamper' | 'all'

export type BundleItem = { productId: string; quantity: number }

export type HamperPart = {
  productId: string
  name: string
  image: string
  quantity: number
  /** Cost of one of this item (purchase + packaging), null when unknown. */
  unitCost: number | null
  salePrice: number
  available: number | null
}

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
  /** What's left now; for a hamper, how many its items' stock can make (null when not tracked). */
  available: number | null
  status: StockStatus
  costPrice: number | null
  packagingCost: number | null
  /** Full cost of one unit: purchase + packaging, or a hamper's items + packaging. */
  unitCost: number | null
  price: number
  discount: number
  salePrice: number
  /** Profit per unit at the sale price (null without a full cost). */
  unitProfit: number | null
  marginPercent: number | null
  hamper: HamperPart[] | null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const salePriceOf = (p: { price: number; discount: number | null }) =>
  round2(p.price * (1 - Math.min(100, Math.max(0, Number(p.discount) || 0)) / 100))

/** A hamper's item list, or null for a normal product. */
export function parseBundle(value: unknown): BundleItem[] | null {
  if (!Array.isArray(value)) return null
  const items = value
    .map((entry) => ({
      productId: String((entry as BundleItem)?.productId || ''),
      quantity: Math.max(1, Math.round(Number((entry as BundleItem)?.quantity) || 1)),
    }))
    .filter((entry) => entry.productId)
  return items.length ? items : null
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
  packagingCost: true,
  bundleItems: true,
  price: true,
  discount: true,
} as const

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>

/** Purchase + packaging for a normal product (null without a purchase price). */
const plainUnitCost = (p: { costPrice: number | null; packagingCost: number | null }) =>
  p.costPrice === null || p.costPrice === undefined ? null : round2(p.costPrice + (p.packagingCost || 0))

/** Orders that count in Inventory (SQL, order aliased as o). */
const COUNTED_ORDER = Prisma.sql`o."status" <> 'CANCELLED' AND o."inventoryExcluded" = false AND o."inventoryRemovedAt" IS NULL`
/** The same, for Prisma queries. */
export const COUNTED_ORDER_WHERE = {
  status: { not: 'CANCELLED' },
  inventoryExcluded: false,
  inventoryRemovedAt: null,
} satisfies Prisma.OrderWhereInput

const statusOf = (available: number | null): StockStatus =>
  available === null ? 'untracked' : available <= 0 ? 'out' : available <= LOW_STOCK ? 'low' : 'in'

/** Every hamper in the store and what goes into it. */
export async function storeHampers(storeId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; bundleItems: unknown }>>`
    SELECT "id", "bundleItems" FROM "Product"
    WHERE "storeId" = ${storeId} AND "bundleItems" IS NOT NULL
  `
  return rows
    .map((row) => ({ id: row.id, items: parseBundle(row.bundleItems) }))
    .filter((row): row is { id: string; items: BundleItem[] } => Boolean(row.items))
}

/**
 * Units of each tracked product used since its last count: sold on its own,
 * plus inside hampers (orders that count in Inventory only).
 */
async function usedSinceCount(storeId: string, products: ProductRow[]) {
  const used = new Map<string, number>()
  const counted = products.filter((p) => p.trackStock && p.stockCountedAt)
  if (counted.length === 0) return used

  const direct = await prisma.$queryRaw<Array<{ productId: string; sold: number }>>`
    SELECT oi."productId" AS "productId", COALESCE(SUM(COALESCE(oi."inventoryQty", oi."quantity")), 0)::int AS sold
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    JOIN "Product" p ON p."id" = oi."productId"
    WHERE o."storeId" = ${storeId}
      AND ${COUNTED_ORDER}
      AND p."stockCountedAt" IS NOT NULL
      AND o."createdAt" >= p."stockCountedAt"
      AND oi."productId" IN (${Prisma.join(counted.map((p) => p.id))})
    GROUP BY oi."productId"
  `
  for (const row of direct) used.set(row.productId, Number(row.sold) || 0)

  // Hampers that contain any of these products.
  const countedIds = new Set(counted.map((p) => p.id))
  const hampers = (await storeHampers(storeId)).filter((h) => h.items.some((i) => countedIds.has(i.productId)))
  if (hampers.length === 0) return used
  const earliest = new Date(Math.min(...counted.map((p) => p.stockCountedAt!.getTime())))
  const sales = await prisma.$queryRaw<Array<{ productId: string; quantity: number; createdAt: Date }>>`
    SELECT oi."productId" AS "productId", COALESCE(oi."inventoryQty", oi."quantity") AS quantity, o."createdAt" AS "createdAt"
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    WHERE o."storeId" = ${storeId}
      AND ${COUNTED_ORDER}
      AND o."createdAt" >= ${earliest}
      AND oi."productId" IN (${Prisma.join(hampers.map((h) => h.id))})
  `
  const hamperById = new Map(hampers.map((h) => [h.id, h]))
  for (const product of counted) {
    const since = product.stockCountedAt!.getTime()
    let extra = 0
    for (const sale of sales) {
      if (new Date(sale.createdAt).getTime() < since) continue
      const part = hamperById.get(sale.productId)?.items.find((i) => i.productId === product.id)
      if (part) extra += part.quantity * sale.quantity
    }
    if (extra) used.set(product.id, (used.get(product.id) || 0) + extra)
  }
  return used
}

function plainRow(p: ProductRow, used: number): InventoryRow {
  const salePrice = salePriceOf(p)
  const available = p.trackStock ? Math.max(0, (p.stockQty ?? 0) - used) : null
  const unitCost = plainUnitCost(p)
  const unitProfit = unitCost === null ? null : round2(salePrice - unitCost)
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
    soldSinceCount: used,
    available,
    status: statusOf(available),
    costPrice: p.costPrice ?? null,
    packagingCost: p.packagingCost ?? null,
    unitCost,
    price: p.price,
    discount: Number(p.discount) || 0,
    salePrice,
    unitProfit,
    marginPercent: unitProfit !== null && salePrice > 0 ? round2((unitProfit / salePrice) * 100) : null,
    hamper: null,
  }
}

/** Rows for these products; hampers take their cost and stock from their items. */
async function rowsFor(storeId: string, products: ProductRow[]) {
  const bundles = new Map(products.map((p) => [p.id, parseBundle(p.bundleItems)]))
  const partIds = Array.from(
    new Set([...bundles.values()].flatMap((items) => (items || []).map((i) => i.productId)))
  ).filter((id) => !products.some((p) => p.id === id))
  const parts = partIds.length
    ? await prisma.product.findMany({ where: { id: { in: partIds }, storeId }, select: PRODUCT_SELECT })
    : []
  const plain = [...products.filter((p) => !bundles.get(p.id)), ...parts.filter((p) => !parseBundle(p.bundleItems))]
  const used = await usedSinceCount(storeId, plain)
  const plainRows = new Map(plain.map((p) => [p.id, plainRow(p, used.get(p.id) ?? 0)]))

  return products.map((p) => {
    const items = bundles.get(p.id)
    if (!items) return plainRows.get(p.id)!
    const hamper: HamperPart[] = items.map((item) => {
      const part = plainRows.get(item.productId)
      return {
        productId: item.productId,
        name: part?.name || 'Removed product',
        image: part?.image || '',
        quantity: item.quantity,
        unitCost: part?.unitCost ?? null,
        salePrice: part?.salePrice ?? 0,
        available: part?.available ?? null,
      }
    })
    const itemsCost = hamper.every((h) => h.unitCost !== null)
      ? hamper.reduce((sum, h) => sum + h.unitCost! * h.quantity, 0)
      : null
    const unitCost = itemsCost === null ? null : round2(itemsCost + (p.packagingCost || 0))
    const trackedParts = hamper.filter((h) => h.available !== null)
    const available = trackedParts.length
      ? Math.min(...trackedParts.map((h) => Math.floor(h.available! / h.quantity)))
      : null
    const salePrice = salePriceOf(p)
    const unitProfit = unitCost === null ? null : round2(salePrice - unitCost)
    return {
      ...plainRow(p, 0),
      trackStock: false,
      countedQty: null,
      countedAt: null,
      available,
      status: statusOf(available),
      unitCost,
      unitProfit,
      marginPercent: unitProfit !== null && salePrice > 0 ? round2((unitProfit / salePrice) * 100) : null,
      hamper,
    }
  })
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
  options: { search?: string; status?: InventoryFilter; category?: string; page?: number; perPage?: number }
) {
  const perPage = [20, 50, 100].includes(Number(options.perPage)) ? Number(options.perPage) : 50
  const page = Math.max(1, Math.floor(Number(options.page) || 1))
  const search = String(options.search || '').trim()
  // Archived products (and hidden custom lines from offline orders) aren't stock.
  const live: Prisma.ProductWhereInput = { storeId, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } }
  const where: Prisma.ProductWhereInput = {
    ...live,
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

  const hamperIds = (await storeHampers(storeId)).map((h) => h.id)
  const notHamper: Prisma.ProductWhereInput = hamperIds.length ? { id: { notIn: hamperIds } } : {}
  // Summary across the whole store (tracked products are what stock counts cover).
  const tracked = await prisma.product.findMany({ where: { ...live, ...notHamper, trackStock: true }, select: PRODUCT_SELECT })
  const trackedRows = await rowsFor(storeId, tracked)
  const [allCount, noCost] = await Promise.all([
    prisma.product.count({ where: live }),
    prisma.product.count({ where: { ...live, ...notHamper, costPrice: null } }),
  ])
  const summary = {
    products: allCount,
    tracked: trackedRows.length,
    inStock: trackedRows.filter((r) => r.status === 'in').length,
    lowStock: trackedRows.filter((r) => r.status === 'low').length,
    outOfStock: trackedRows.filter((r) => r.status === 'out').length,
    untracked: Math.max(0, allCount - trackedRows.length - hamperIds.length),
    hampers: hamperIds.length,
    withoutPurchasePrice: noCost,
    stockValueAtCost: round2(trackedRows.reduce((s, r) => s + (r.available ?? 0) * (r.unitCost ?? 0), 0)),
    stockValueAtSale: round2(trackedRows.reduce((s, r) => s + (r.available ?? 0) * r.salePrice, 0)),
  }

  const status = options.status && options.status !== 'all' ? options.status : null
  let rows: InventoryRow[]
  let total: number
  if (status === 'in' || status === 'low' || status === 'out') {
    // Stock status depends on sales, so filter the tracked rows in memory (they're few).
    const candidates = await prisma.product.findMany({
      where: { ...where, ...notHamper, trackStock: true },
      select: PRODUCT_SELECT,
      orderBy: { name: 'asc' },
    })
    const matching = (await rowsFor(storeId, candidates)).filter((r) => r.status === status)
    total = matching.length
    rows = matching.slice((page - 1) * perPage, page * perPage)
  } else {
    const scoped: Prisma.ProductWhereInput =
      status === 'hamper'
        ? { ...where, id: { in: hamperIds } }
        : status === 'untracked'
          ? { ...where, ...notHamper, trackStock: false }
          : where
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

/** Full unit cost of each product (hampers from their items; null when unknown). */
export async function unitCosts(storeId: string, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, number | null>()
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, storeId }, select: PRODUCT_SELECT })
  const rows = await rowsFor(storeId, products)
  return new Map(rows.map((r) => [r.id, r.unitCost]))
}

// ---------------------------------------------------------------- reports

/** Nepal calendar day (YYYY-MM-DD) of a moment. */
export const nepalDay = (date: Date) => new Date(date.getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)
/** Start of a Nepal calendar day, as a real instant. */
export const dayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - NEPAL_OFFSET_MS)
/** End of a Nepal calendar day (exclusive). */
export const dayEnd = (day: string) => new Date(dayStart(day).getTime() + DAY_MS)
export const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** An order line as Inventory counts it. */
export type SaleLine = { productId: string; quantity: number; price: number }

/** Inventory's quantity and price for an order line (its corrections, else what was ordered). */
export const saleLine = (item: {
  productId: string
  quantity: number
  price: number
  inventoryQty: number | null
  inventoryPrice: number | null
}): SaleLine => ({
  productId: item.productId,
  quantity: item.inventoryQty ?? item.quantity,
  price: item.inventoryPrice ?? item.price,
})

/**
 * One order's sales, cost and profit. The order's discount is shared across
 * its lines by value; lines without a cost are left out of cost and profit.
 */
export function orderFigures(
  lines: SaleLine[],
  order: { discount: number | null; couponDiscount: number | null },
  costs: Map<string, number | null>
) {
  const itemSales = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  // Online orders store the coupon in both fields; offline ones use `discount`.
  const discounts = Math.min(itemSales, Math.max(order.discount || 0, order.couponDiscount || 0))
  let costedSales = 0
  let cost = 0
  const perLine = lines.map((line) => {
    const sales = line.price * line.quantity
    const unitCost = costs.get(line.productId) ?? null
    const share = itemSales > 0 ? discounts * (sales / itemSales) : 0
    if (unitCost !== null) {
      costedSales += sales
      cost += unitCost * line.quantity
    }
    return { ...line, sales, share, unitCost, profit: unitCost === null ? null : sales - share - unitCost * line.quantity }
  })
  const costedShare = itemSales > 0 ? discounts * (costedSales / itemSales) : 0
  return {
    itemSales,
    discounts,
    netSales: itemSales - discounts,
    cost,
    profit: costedSales - cost - costedShare,
    uncostedSales: itemSales - costedSales,
    lines: perLine,
  }
}

export type SalesBucket = {
  key: string
  orders: number
  /** Items at the prices they were sold for. */
  itemSales: number
  /** Order discount or coupon. */
  discounts: number
  netSales: number
  /** Purchase + packaging cost of the items that have a purchase price. */
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
 * Cancelled orders, and orders switched off or deleted in Inventory, are left
 * out. Profit = (sales − purchase and packaging cost) of items with a cost,
 * less their share of the order's discounts.
 */
export async function salesReport(
  storeId: string,
  options: { from: string; to: string; groupBy?: 'day' | 'month'; source?: 'all' | 'online' | 'offline' }
) {
  const from = isDay(options.from) ? options.from : nepalDay(new Date())
  const to = isDay(options.to) && options.to >= from ? options.to : from
  const groupBy = options.groupBy === 'month' ? 'month' : 'day'
  const start = dayStart(from)
  const end = dayEnd(to)
  const inRange: Prisma.OrderWhereInput = {
    storeId,
    createdAt: { gte: start, lt: end },
    ...(options.source === 'offline' ? { source: 'OFFLINE' } : options.source === 'online' ? { source: 'UPAHARO' } : {}),
  }

  const [orders, leftOut] = await Promise.all([
    prisma.order.findMany({
      where: { ...inRange, ...COUNTED_ORDER_WHERE },
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
            inventoryQty: true,
            inventoryPrice: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    // Shown as a note: orders in range that Inventory leaves out.
    prisma.order.count({
      where: {
        ...inRange,
        status: { not: 'CANCELLED' },
        OR: [{ inventoryExcluded: true }, { inventoryRemovedAt: { not: null } }],
      },
    }),
  ])

  // Purchase + packaging per unit; hampers from their items.
  const costs = await unitCosts(storeId, Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))))

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

    const figures = orderFigures(order.items.map(saleLine), order, costs)
    order.items.forEach((item, index) => {
      const line = figures.lines[index]
      const entry = byProduct.get(item.productId) ?? { id: item.productId, name: item.product.name, quantity: 0, sales: 0, profit: 0 }
      entry.quantity += line.quantity
      entry.sales += line.sales - line.share
      if (line.profit === null) entry.profit = null
      else if (entry.profit !== null) entry.profit += line.profit
      byProduct.set(item.productId, entry)
    })
    for (const target of [bucket, totals]) {
      target.orders += 1
      target.itemSales += figures.itemSales
      target.discounts += figures.discounts
      target.netSales += figures.netSales
      target.cost += figures.cost
      target.profit += figures.profit
      target.uncostedSales += figures.uncostedSales
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
    /** Orders in range switched off or deleted in Inventory. */
    leftOut,
    totals: tidy(totals),
    buckets: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).map(tidy),
    topBySales: [...products].sort((a, b) => b.sales - a.sales).slice(0, 10),
    topByProfit: products.filter((p) => p.profit !== null).sort((a, b) => b.profit! - a.profit!).slice(0, 10),
  }
}
