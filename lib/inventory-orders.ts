/**
 * Orders as Inventory sees them. Every order counts in stock and profit unless
 * it's switched off or deleted here; Inventory can also correct a line's
 * quantity and price. None of this changes the order itself (what the
 * customer sees, the invoice, the admin Orders page).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dayEnd, dayStart, isDay, orderFigures, saleLine, unitCosts } from '@/lib/inventory'

export type InventoryOrderView = 'all' | 'counted' | 'off' | 'deleted'
const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const

export type InventoryOrderLine = {
  id: string
  productId: string
  name: string
  image: string
  /** As ordered. */
  orderedQty: number
  orderedPrice: number
  /** What Inventory counts. */
  quantity: number
  price: number
  edited: boolean
  unitCost: number | null
  profit: number | null
}

export type InventoryOrder = {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  source: 'UPAHARO' | 'OFFLINE'
  channel: string | null
  customer: string
  counted: boolean
  deletedAt: string | null
  lines: InventoryOrderLine[]
  itemSales: number
  discounts: number
  netSales: number
  cost: number
  profit: number
  uncostedSales: number
  deliveryFee: number
}

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  source: true,
  offlineChannel: true,
  discount: true,
  couponDiscount: true,
  deliveryFee: true,
  inventoryExcluded: true,
  inventoryRemovedAt: true,
  user: { select: { name: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      productId: true,
      quantity: true,
      price: true,
      inventoryQty: true,
      inventoryPrice: true,
      product: { select: { name: true, image: true } },
    },
  },
} satisfies Prisma.OrderSelect

type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>

const round2 = (n: number) => Math.round(n * 100) / 100

function toInventoryOrder(order: OrderRow, costs: Map<string, number | null>): InventoryOrder {
  const figures = orderFigures(order.items.map(saleLine), order, costs)
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    source: order.source,
    channel: order.offlineChannel,
    customer: order.user?.name || '',
    counted: !order.inventoryExcluded && !order.inventoryRemovedAt,
    deletedAt: order.inventoryRemovedAt ? order.inventoryRemovedAt.toISOString() : null,
    lines: order.items.map((item, index) => {
      const line = figures.lines[index]
      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        image: item.product.image,
        orderedQty: item.quantity,
        orderedPrice: item.price,
        quantity: line.quantity,
        price: line.price,
        edited: item.inventoryQty !== null || item.inventoryPrice !== null,
        unitCost: line.unitCost,
        profit: line.profit === null ? null : round2(line.profit),
      }
    }),
    itemSales: round2(figures.itemSales),
    discounts: round2(figures.discounts),
    netSales: round2(figures.netSales),
    cost: round2(figures.cost),
    profit: round2(figures.profit),
    uncostedSales: round2(figures.uncostedSales),
    deliveryFee: order.deliveryFee || 0,
  }
}

async function toInventoryOrders(storeId: string, orders: OrderRow[]) {
  const costs = await unitCosts(storeId, Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))))
  return orders.map((order) => toInventoryOrder(order, costs))
}

/** One order (any but cancelled) as Inventory sees it, or null. */
export async function inventoryOrder(storeId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, storeId, status: { not: 'CANCELLED' } },
    select: ORDER_SELECT,
  })
  return order ? (await toInventoryOrders(storeId, [order]))[0] : null
}

/**
 * Orders for the Inventory list, newest first. Cancelled orders never count,
 * so they aren't listed. `from` / `to` are Nepal days; leave them out for all time.
 */
export async function listInventoryOrders(
  storeId: string,
  options: {
    from?: string
    to?: string
    source?: string
    status?: string
    view?: string
    search?: string
    page?: number
    perPage?: number
  }
) {
  const perPage = [20, 50, 100].includes(Number(options.perPage)) ? Number(options.perPage) : 20
  const page = Math.max(1, Math.floor(Number(options.page) || 1))
  const search = String(options.search || '').trim()
  const status = ORDER_STATUSES.find((s) => s === options.status)
  const createdAt: Prisma.DateTimeFilter = {}
  if (isDay(options.from)) createdAt.gte = dayStart(options.from)
  if (isDay(options.to)) createdAt.lt = dayEnd(options.to)

  const base: Prisma.OrderWhereInput = {
    storeId,
    status: status ? status : { not: 'CANCELLED' },
    ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
    ...(options.source === 'offline' ? { source: 'OFFLINE' } : options.source === 'online' ? { source: 'UPAHARO' } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { items: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  }
  const views: Record<InventoryOrderView, Prisma.OrderWhereInput> = {
    all: { inventoryRemovedAt: null },
    counted: { inventoryRemovedAt: null, inventoryExcluded: false },
    off: { inventoryRemovedAt: null, inventoryExcluded: true },
    deleted: { inventoryRemovedAt: { not: null } },
  }
  const view: InventoryOrderView = options.view && options.view in views ? (options.view as InventoryOrderView) : 'all'
  const where = { ...base, ...views[view] }

  const [all, counted, off, deleted, orders] = await Promise.all([
    prisma.order.count({ where: { ...base, ...views.all } }),
    prisma.order.count({ where: { ...base, ...views.counted } }),
    prisma.order.count({ where: { ...base, ...views.off } }),
    prisma.order.count({ where: { ...base, ...views.deleted } }),
    prisma.order.findMany({
      where,
      select: ORDER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])
  const total = { all, counted, off, deleted }[view]
  return {
    rows: await toInventoryOrders(storeId, orders),
    counts: { all, counted, off, deleted },
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

/**
 * Read a list of line corrections: [{ id, quantity?, price? }], where null
 * puts a value back to what was ordered. Returns the updates or an error.
 */
export function readLineEdits(
  value: unknown,
  lines: Array<{ id: string; quantity: number; price: number }>
): { updates: Array<{ id: string; data: { inventoryQty?: number | null; inventoryPrice?: number | null } }> } | { error: string } {
  if (!Array.isArray(value)) return { error: 'Send the lines to change' }
  const byId = new Map(lines.map((l) => [l.id, l]))
  const updates: Array<{ id: string; data: { inventoryQty?: number | null; inventoryPrice?: number | null } }> = []
  for (const entry of value as Array<Record<string, unknown>>) {
    const line = byId.get(String(entry?.id || ''))
    if (!line) return { error: 'That line isn’t in this order' }
    const data: { inventoryQty?: number | null; inventoryPrice?: number | null } = {}
    if (entry.quantity !== undefined) {
      if (entry.quantity === null || entry.quantity === '') data.inventoryQty = null
      else {
        const qty = Number(entry.quantity)
        if (!Number.isInteger(qty) || qty < 0 || qty > 100_000) return { error: 'Quantity must be a whole number, 0 or more' }
        // Same as ordered: keep no correction.
        data.inventoryQty = qty === line.quantity ? null : qty
      }
    }
    if (entry.price !== undefined) {
      if (entry.price === null || entry.price === '') data.inventoryPrice = null
      else {
        const price = Number(entry.price)
        if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { error: 'Price must be 0 or more' }
        const rounded = round2(price)
        data.inventoryPrice = rounded === line.price ? null : rounded
      }
    }
    if (Object.keys(data).length) updates.push({ id: line.id, data })
  }
  return { updates }
}
