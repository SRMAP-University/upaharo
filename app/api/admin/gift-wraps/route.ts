import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const giftWraps = await prisma.giftWrap.findMany({
      where: { storeId: storeContext.store.id },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(giftWraps, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Error fetching gift wraps:', error)
    return NextResponse.json({ error: 'Failed to fetch gift wraps' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const body = await request.json()
    const giftWrap = await prisma.giftWrap.create({
      data: {
        storeId: storeContext.store.id,
        name: body.name,
        description: body.description || null,
        price: body.price,
        image: body.image,
        type: body.type,
        isActive: body.isActive ?? true
      }
    })
    return NextResponse.json(giftWrap)
  } catch (error) {
    console.error('Error creating gift wrap:', error)
    return NextResponse.json({ error: 'Failed to create gift wrap' }, { status: 500 })
  }
}
