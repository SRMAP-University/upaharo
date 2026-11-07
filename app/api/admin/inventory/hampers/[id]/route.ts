import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { inventoryRow, parseBundle } from '@/lib/inventory'
import { readHamperInput } from '@/lib/inventory-hampers'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/** Change a hamper: any of the fields it was made with (items replace the old list). */
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
    select: {
      name: true,
      description: true,
      category: true,
      image: true,
      price: true,
      packagingCost: true,
      isAvailable: true,
      bundleItems: true,
    },
  })
  const items = parseBundle(existing?.bundleItems)
  if (!existing || !items) return NextResponse.json({ error: 'Hamper not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const patch = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const merged: Record<string, unknown> = {
    name: existing.name,
    // An item list we wrote ourselves gets rewritten when the items change.
    description: existing.description.startsWith('Includes: ') && patch.items !== undefined ? '' : existing.description,
    category: existing.category,
    image: existing.image,
    price: existing.price,
    packagingCost: existing.packagingCost,
    sellOnline: existing.isAvailable,
    items,
    ...patch,
  }
  const input = await readHamperInput(storeId, merged, id)
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })
  const { data } = input

  await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      category: data.category,
      image: data.image,
      imageAlt: data.name,
      price: data.price,
      packagingCost: data.packagingCost,
      isAvailable: data.isAvailable,
      bundleItems: data.bundleItems,
    },
  })
  await redis.del(REDIS_KEYS.PRODUCT_DETAIL(storeContext.slug, id), REDIS_KEYS.HOME(storeContext.slug))
  return NextResponse.json(await inventoryRow(storeId, id))
}
