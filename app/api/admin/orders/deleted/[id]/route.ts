import { NextRequest, NextResponse } from 'next/server'
import { restoreDeletedOrder } from '@/lib/deleted-orders'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/** Put a deleted order back. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params
    const result = await restoreDeletedOrder(storeContext.store.id, id)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ restored: true, orderNumber: result.orderNumber })
  } catch (error) {
    console.error('Error restoring order:', error)
    return NextResponse.json({ error: 'Failed to put the order back' }, { status: 500 })
  }
}
