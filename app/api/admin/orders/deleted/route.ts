import { NextRequest, NextResponse } from 'next/server'
import { listDeletedOrders } from '@/lib/deleted-orders'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/** Deleted orders (copies kept when an order was deleted): ?search&page&perPage */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const p = new URL(request.url).searchParams
  const result = await listDeletedOrders(storeContext.store.id, {
    search: p.get('search') || '',
    page: Number(p.get('page')) || 1,
    perPage: Number(p.get('perPage')) || 50,
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
}
