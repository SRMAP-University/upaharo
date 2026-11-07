import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { confirmInventoryPin, requireInventoryAccess } from '@/lib/inventory-lock'
import { inventoryOrder, readLineEdits } from '@/lib/inventory-orders'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

function denied(error: 'signed-out' | 'locked') {
  return error === 'locked'
    ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Change how Inventory counts an order: { counted?, restore?, lines? }.
 * lines = [{ id, quantity?, price? }] (null puts it back to what was ordered).
 * The order itself is never changed.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const storeId = storeContext.store.id
  const { id } = await params

  const order = await prisma.order.findFirst({
    where: { id, storeId, status: { not: 'CANCELLED' } },
    select: { id: true, items: { select: { id: true, quantity: true, price: true } } },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: { inventoryExcluded?: boolean; inventoryRemovedAt?: null } = {}
  if (body?.counted !== undefined) {
    if (typeof body.counted !== 'boolean') return NextResponse.json({ error: 'counted must be true or false' }, { status: 400 })
    data.inventoryExcluded = !body.counted
  }
  if (body?.restore === true) data.inventoryRemovedAt = null

  let lineUpdates: Array<{ id: string; data: { inventoryQty?: number | null; inventoryPrice?: number | null } }> = []
  if (body?.lines !== undefined) {
    const edits = readLineEdits(body.lines, order.items)
    if ('error' in edits) return NextResponse.json({ error: edits.error }, { status: 400 })
    lineUpdates = edits.updates
  }

  await prisma.$transaction([
    ...(Object.keys(data).length ? [prisma.order.update({ where: { id }, data })] : []),
    ...lineUpdates.map((u) => prisma.orderItem.update({ where: { id: u.id }, data: u.data })),
  ])
  return NextResponse.json(await inventoryOrder(storeId, id))
}

/**
 * Delete an order from Inventory: { pin }. The PIN is asked again. The order
 * stays everywhere else, and can be put back from the Deleted list.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const pinError = await confirmInventoryPin(access.admin.id, body?.pin)
  if (pinError) return NextResponse.json({ error: pinError.error }, { status: pinError.status })

  const result = await prisma.order.updateMany({
    where: { id, storeId: storeContext.store.id, inventoryRemovedAt: null },
    data: { inventoryRemovedAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
