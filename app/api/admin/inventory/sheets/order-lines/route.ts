import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { costParts, saleLine } from '@/lib/inventory'
import { newKey, type SheetLine, type SheetOrder } from '@/lib/sales-sheet'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/**
 * Real orders ready to drop into a custom sales sheet: ?ids=a,b,c.
 * Quantities and prices are as Inventory counts them; purchase and packing
 * come from each product's costs today; delivery cost starts at the fee charged.
 */
export async function GET(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) {
    return access.error === 'locked'
      ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const storeId = storeContext.store.id

  const ids = Array.from(
    new Set((new URL(request.url).searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean))
  ).slice(0, 100)
  if (ids.length === 0) return NextResponse.json({ orders: [] })

  const found = await prisma.order.findMany({
    where: { id: { in: ids }, storeId, status: { not: 'CANCELLED' } },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      deliveryFee: true,
      discount: true,
      couponDiscount: true,
      isGift: true,
      giftWrap: { select: { name: true, price: true } },
      user: { select: { name: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          productId: true,
          quantity: true,
          price: true,
          inventoryQty: true,
          inventoryPrice: true,
          product: { select: { name: true, image: true } },
        },
      },
    },
  })
  const costs = await costParts(storeId, Array.from(new Set(found.flatMap((o) => o.items.map((i) => i.productId)))))

  const byId = new Map(found.map((o) => [o.id, o]))
  const orders: SheetOrder[] = ids
    .map((id) => byId.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .map((o) => {
      const lines: SheetLine[] = o.items.map((item) => {
        const sold = saleLine(item)
        const cost = costs.get(item.productId)
        return {
          key: newKey(),
          productId: item.productId,
          name: item.product.name,
          image: item.product.image,
          qty: sold.quantity,
          price: sold.price,
          purchase: cost?.purchase ?? null,
          packing: cost?.packing ?? 0,
        }
      })
      if (o.isGift && o.giftWrap && o.giftWrap.price > 0) {
        lines.push({
          key: newKey(),
          productId: null,
          name: `Gift wrap (${o.giftWrap.name})`,
          image: '',
          qty: 1,
          price: o.giftWrap.price,
          purchase: null,
          packing: 0,
        })
      }
      return {
        key: newKey(),
        orderId: o.id,
        orderNumber: o.orderNumber,
        label: o.user?.name || '',
        date: o.createdAt.toISOString(),
        times: 1,
        // Online orders keep the coupon in both fields; offline ones use `discount`.
        discount: Math.max(o.discount || 0, o.couponDiscount || 0),
        deliveryCharged: o.deliveryFee || 0,
        deliveryCost: o.deliveryFee || 0,
        packing: 0,
        lines,
      }
    })
  return NextResponse.json({ orders }, { headers: { 'Cache-Control': 'private, no-store' } })
}
