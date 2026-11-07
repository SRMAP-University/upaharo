import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { listInventoryOrders } from '@/lib/inventory-orders'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

function denied(error: 'signed-out' | 'locked') {
  return error === 'locked'
    ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Orders as Inventory counts them:
 * ?from&to (Nepal days, optional) &source=all|online|offline &status &view=all|counted|off|deleted &search &page &perPage
 */
export async function GET(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const p = new URL(request.url).searchParams
  const result = await listInventoryOrders(storeContext.store.id, {
    from: p.get('from') || undefined,
    to: p.get('to') || undefined,
    source: p.get('source') || 'all',
    status: p.get('status') || undefined,
    view: p.get('view') || 'all',
    search: p.get('search') || '',
    page: Number(p.get('page')) || 1,
    perPage: Number(p.get('perPage')) || 20,
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** Count several orders in Inventory, or stop counting them: { ids, counted }. */
export async function PATCH(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids) ? Array.from(new Set(body.ids.map((id: unknown) => String(id || '')).filter(Boolean))) : []
  if (ids.length === 0 || ids.length > 500 || typeof body?.counted !== 'boolean') {
    return NextResponse.json({ error: 'Choose the orders, and whether they count' }, { status: 400 })
  }
  const result = await prisma.order.updateMany({
    where: { id: { in: ids as string[] }, storeId: storeContext.store.id, inventoryRemovedAt: null },
    data: { inventoryExcluded: !body.counted },
  })
  return NextResponse.json({ updated: result.count })
}
