import { NextResponse } from 'next/server'
import { DETAIL_KINDS, periodDetails, readPeriod, type DetailKind } from '@/lib/dashboard-stats'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/**
 * What's behind a dashboard number:
 * ?kind=orders|delivered|cancelled|products|customers &from&to (Nepal days) &page
 */
export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const params = new URL(request.url).searchParams
    const kind = (DETAIL_KINDS as string[]).includes(params.get('kind') || '') ? (params.get('kind') as DetailKind) : 'orders'
    const result = await periodDetails(storeContext.store.id, readPeriod(params), kind, Number(params.get('page')) || 1)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Error loading dashboard details:', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}
