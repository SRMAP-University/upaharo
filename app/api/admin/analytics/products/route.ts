import { NextRequest, NextResponse } from 'next/server'
import { getProductStats } from '@/lib/product-stats'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

/** Admin → Product stats: every product of the store (?days=1|7|30|90). */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const days = Number(new URL(request.url).searchParams.get('days')) || 30
    const stats = await getProductStats({ productWhere: { storeId: storeContext.store.id }, days })
    return NextResponse.json(stats, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Admin product stats error:', error)
    return NextResponse.json({ error: 'Failed to load product stats' }, { status: 500 })
  }
}
