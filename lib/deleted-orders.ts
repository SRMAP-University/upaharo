/**
 * Deleted orders: a full copy is saved to DeletedOrder before an order is
 * deleted, so it can be listed (admin Orders → Deleted) and put back.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** What gets copied: the order, its items (with product names) and the customer. */
export const DELETED_ORDER_INCLUDE = {
  items: { include: { product: { select: { name: true, image: true } } } },
  user: { select: { name: true, email: true, phone: true } },
} satisfies Prisma.OrderInclude

/** A plain-JSON copy of an order loaded with DELETED_ORDER_INCLUDE. */
export const orderSnapshot = (order: unknown) => JSON.parse(JSON.stringify(order)) as Prisma.InputJsonValue

type Snapshot = Record<string, unknown> & {
  orderNumber?: string
  createdAt?: string
  status?: string
  source?: string
  total?: number
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null
  items?: Array<{
    id?: string
    productId?: string
    quantity?: number
    price?: number
    inventoryQty?: number | null
    inventoryPrice?: number | null
    createdAt?: string
    product?: { name?: string | null; image?: string | null } | null
  }>
}

/** Deleted orders for the admin list, newest deletes first. */
export async function listDeletedOrders(storeId: string, options: { search?: string; page?: number; perPage?: number } = {}) {
  const perPage = Math.min(100, Math.max(1, Number(options.perPage) || 50))
  const page = Math.max(1, Math.floor(Number(options.page) || 1))
  const search = String(options.search || '').trim()
  const where: Prisma.DeletedOrderWhereInput = {
    storeId,
    ...(search ? { orderNumber: { contains: search, mode: 'insensitive' } } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.deletedOrder.count({ where }),
    prisma.deletedOrder.findMany({ where, orderBy: { deletedAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
  ])
  return {
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    rows: rows.map((row) => {
      const s = (row.data || {}) as Snapshot
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        deletedAt: row.deletedAt.toISOString(),
        deletedBy: row.deletedBy,
        placedAt: s.createdAt ?? null,
        status: s.status ?? null,
        source: s.source ?? null,
        total: Number(s.total) || 0,
        customer: s.user?.name || s.user?.email || '',
        items: (s.items || []).map((i) => ({ name: i.product?.name || 'Item', quantity: Number(i.quantity) || 0 })),
      }
    }),
  }
}

/** Links an order may hold that could have been removed since it was deleted. */
const OPTIONAL_LINKS: Array<[string, (id: string) => Promise<unknown>]> = [
  ['addressId', (id) => prisma.address.findUnique({ where: { id }, select: { id: true } })],
  ['recipientId', (id) => prisma.giftRecipient.findUnique({ where: { id }, select: { id: true } })],
  ['occasionId', (id) => prisma.occasion.findUnique({ where: { id }, select: { id: true } })],
  ['giftWrapId', (id) => prisma.giftWrap.findUnique({ where: { id }, select: { id: true } })],
  ['couponId', (id) => prisma.coupon.findUnique({ where: { id }, select: { id: true } })],
  ['deliveryPartnerId', (id) => prisma.deliveryPartner.findUnique({ where: { id }, select: { id: true } })],
]

/** Put a deleted order back as it was. Returns an error message when it can't. */
export async function restoreDeletedOrder(storeId: string, id: string): Promise<{ orderNumber: string } | { error: string; status: number }> {
  const row = await prisma.deletedOrder.findFirst({ where: { id, storeId } })
  if (!row) return { error: 'Deleted order not found', status: 404 }
  const snap = (row.data || {}) as Snapshot

  if (await prisma.order.findFirst({ where: { OR: [{ id }, { orderNumber: row.orderNumber }] }, select: { id: true } })) {
    return { error: `An order ${row.orderNumber} already exists`, status: 409 }
  }

  // Only real order columns go back in (the copy also holds items and the customer).
  const columns = new Set<string>(Object.values(Prisma.OrderScalarFieldEnum))
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(snap)) {
    if (columns.has(key) && key !== 'updatedAt') fields[key] = value
  }
  if (!fields.userId || !(await prisma.user.findUnique({ where: { id: String(fields.userId) }, select: { id: true } }))) {
    return { error: 'The customer’s account no longer exists, so this order can’t be put back', status: 409 }
  }
  for (const [key, exists] of OPTIONAL_LINKS) {
    if (fields[key] && !(await exists(String(fields[key])))) fields[key] = null
  }

  const items = snap.items || []
  const productIds = Array.from(new Set(items.map((i) => String(i.productId || ''))))
  const found = await prisma.product.count({ where: { id: { in: productIds } } })
  if (found !== productIds.length) {
    return { error: 'A product in this order no longer exists, so it can’t be put back', status: 409 }
  }

  await prisma.$transaction([
    prisma.order.create({
      data: {
        ...(fields as Prisma.OrderUncheckedCreateInput),
        items: {
          create: items.map((i) => ({
            ...(i.id ? { id: i.id } : {}),
            productId: String(i.productId),
            quantity: Number(i.quantity) || 1,
            price: Number(i.price) || 0,
            inventoryQty: i.inventoryQty ?? null,
            inventoryPrice: i.inventoryPrice ?? null,
            ...(i.createdAt ? { createdAt: i.createdAt } : {}),
          })),
        },
      },
    }),
    prisma.deletedOrder.delete({ where: { id } }),
  ])
  return { orderNumber: row.orderNumber }
}
