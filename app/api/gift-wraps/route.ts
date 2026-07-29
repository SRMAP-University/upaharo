import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext
    const wraps = await prisma.giftWrap.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(wraps)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch gift wraps' },
      { status: 500 }
    )
  }
}
