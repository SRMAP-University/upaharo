import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { inventoryRow } from '@/lib/inventory'
import { HAMPER_TAG, readHamperInput } from '@/lib/inventory-hampers'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/**
 * Make a hamper from several products: { name, items: [{ productId, quantity }],
 * price, packagingCost?, category?, description?, image?, sellOnline? }.
 */
export async function POST(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) {
    return access.error === 'locked'
      ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const storeId = storeContext.store.id
  const body = await request.json().catch(() => ({}))

  const input = await readHamperInput(storeId, body && typeof body === 'object' ? body : {})
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })
  const { data } = input

  const product = await prisma.product.create({
    data: {
      storeId,
      name: data.name,
      description: data.description,
      category: data.category,
      price: data.price,
      packagingCost: data.packagingCost,
      costPrice: null,
      bundleItems: data.bundleItems,
      image: data.image,
      imageAlt: data.name,
      isAvailable: data.isAvailable,
      trackStock: false,
      tags: [HAMPER_TAG],
      prepTime: 0,
    },
    select: { id: true },
  })
  await redis.del(REDIS_KEYS.HOME(storeContext.slug))
  return NextResponse.json(await inventoryRow(storeId, product.id), { status: 201 })
}
