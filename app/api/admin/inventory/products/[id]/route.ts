import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { availableStock, inventoryRow, parseBundle } from '@/lib/inventory'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { resolveAdminStoreContext } from '@/lib/store-context'

const money = (value: unknown) => {
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN
}

/**
 * Update stock and prices: { costPrice?, packagingCost?, price?, discount?,
 * trackStock?, setStock? (new count), addStock? (units received), isAvailable? }.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) {
    return access.error === 'locked'
      ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const storeId = storeContext.store.id
  const { id } = await params
  const existing = await prisma.product.findFirst({
    where: { id, storeId },
    select: { id: true, trackStock: true, bundleItems: true },
  })
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  const isHamper = Boolean(parseBundle(existing.bundleItems))

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (body.costPrice !== undefined) {
    if (isHamper) {
      return NextResponse.json({ error: 'A hamper costs what its items and packaging cost' }, { status: 400 })
    }
    const cost = money(body.costPrice)
    if (Number.isNaN(cost)) return NextResponse.json({ error: 'Purchase price must be 0 or more' }, { status: 400 })
    data.costPrice = cost
  }
  if (body.packagingCost !== undefined) {
    const packaging = money(body.packagingCost)
    if (Number.isNaN(packaging)) {
      return NextResponse.json({ error: 'Packaging cost must be 0 or more' }, { status: 400 })
    }
    data.packagingCost = packaging
  }
  if (isHamper && (body.trackStock === true || body.setStock !== undefined || body.addStock !== undefined)) {
    return NextResponse.json({ error: "A hamper's stock comes from its items" }, { status: 400 })
  }
  if (body.price !== undefined) {
    const price = money(body.price)
    if (price === null || Number.isNaN(price)) {
      return NextResponse.json({ error: 'Selling price must be 0 or more' }, { status: 400 })
    }
    data.price = price
  }
  if (body.discount !== undefined) {
    const discount = Number(body.discount)
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      return NextResponse.json({ error: 'Offer must be between 0 and 100%' }, { status: 400 })
    }
    data.discount = discount
  }
  if (body.isAvailable !== undefined) data.isAvailable = body.isAvailable === true

  const tracking = body.trackStock !== undefined ? body.trackStock === true : existing.trackStock
  if (body.trackStock !== undefined && !tracking) {
    data.trackStock = false
    data.stockQty = null
    data.stockCountedAt = null
  }
  if (tracking && (body.setStock !== undefined || body.addStock !== undefined)) {
    // Either way it becomes a fresh count: sales from now on come off it.
    const current = existing.trackStock ? (await availableStock(storeId, id)) ?? 0 : 0
    const next =
      body.setStock !== undefined ? Math.round(Number(body.setStock)) : current + Math.round(Number(body.addStock))
    if (!Number.isFinite(next) || next < 0) {
      return NextResponse.json({ error: 'Stock cannot go below 0' }, { status: 400 })
    }
    data.trackStock = true
    data.stockQty = next
    data.stockCountedAt = new Date()
  } else if (tracking && !existing.trackStock) {
    data.trackStock = true
    data.stockQty = 0
    data.stockCountedAt = new Date()
  }

  if (Object.keys(data).length > 0) {
    await prisma.product.update({ where: { id }, data })
    await redis.del(REDIS_KEYS.PRODUCT_DETAIL(storeContext.slug, id), REDIS_KEYS.HOME(storeContext.slug))
  }
  return NextResponse.json(await inventoryRow(storeId, id))
}
