import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { inventoryRow, listInventory, type InventoryFilter } from '@/lib/inventory'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

function inventoryDenied(error: 'signed-out' | 'locked') {
  return error === 'locked'
    ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const money = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN
}

/** Stock list with purchase / selling prices and a store summary. */
export async function GET(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return inventoryDenied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const p = new URL(request.url).searchParams
  const result = await listInventory(storeContext.store.id, {
    search: p.get('search') || '',
    status: (p.get('status') || 'all') as InventoryFilter,
    category: p.get('category') || 'all',
    page: Number(p.get('page')) || 1,
    perPage: Number(p.get('perPage')) || 50,
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
}

/**
 * Add a custom inventory item: { name, category, price, costPrice?, packagingCost?, stock?,
 * sku?, sellOnline? }. Items not sold online stay hidden from the shop but can
 * still be used in offline orders.
 */
export async function POST(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return inventoryDenied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const storeId = storeContext.store.id
  const body = await request.json().catch(() => ({}))

  const name = String(body?.name || '').trim().slice(0, 200)
  const category = String(body?.category || '').trim() || 'Custom item'
  const price = money(body?.price)
  const costPrice = money(body?.costPrice)
  const packagingCost = money(body?.packagingCost)
  const stock =
    body?.stock === undefined || body?.stock === null || body?.stock === '' ? null : Math.round(Number(body.stock))
  const sku = String(body?.sku || '').trim().slice(0, 64) || null

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (price === null || Number.isNaN(price)) {
    return NextResponse.json({ error: 'Selling price is required' }, { status: 400 })
  }
  if (Number.isNaN(costPrice)) return NextResponse.json({ error: 'Purchase price must be 0 or more' }, { status: 400 })
  if (Number.isNaN(packagingCost)) return NextResponse.json({ error: 'Packaging cost must be 0 or more' }, { status: 400 })
  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
    return NextResponse.json({ error: 'Stock must be 0 or more' }, { status: 400 })
  }
  if (sku && (await prisma.product.findFirst({ where: { storeId, sku }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Another product already uses this SKU' }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: {
      storeId,
      name,
      description: String(body?.description || '').trim(),
      category,
      price,
      costPrice,
      packagingCost,
      sku,
      image: String(body?.image || '').trim(),
      imageAlt: name,
      isAvailable: body?.sellOnline === true,
      trackStock: stock !== null,
      stockQty: stock,
      stockCountedAt: stock !== null ? new Date() : null,
      tags: ['inventory-item'],
      prepTime: 0,
    },
    select: { id: true },
  })
  await redis.del(REDIS_KEYS.HOME(storeContext.slug))
  return NextResponse.json(await inventoryRow(storeId, product.id), { status: 201 })
}
