import { NextRequest, NextResponse } from 'next/server'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { salesReport } from '@/lib/inventory'
import { resolveAdminStoreContext } from '@/lib/store-context'
import { isDivision, type Division } from '@/lib/divisions'

export const dynamic = 'force-dynamic'

/** Sales and profit: ?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|month&source=all|online|offline */
export async function GET(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) {
    return access.error === 'locked'
      ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const p = new URL(request.url).searchParams
  const source = p.get('source')
  const report = await salesReport(storeContext.store.id, {
    from: p.get('from') || '',
    to: p.get('to') || '',
    groupBy: p.get('groupBy') === 'month' ? 'month' : 'day',
    source: source === 'online' || source === 'offline' ? source : 'all',
    division: isDivision(p.get('division')) ? (p.get('division') as Division) : undefined,
  })
  return NextResponse.json(report, { headers: { 'Cache-Control': 'private, no-store' } })
}
