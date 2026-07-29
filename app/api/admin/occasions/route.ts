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
    const occasions = await prisma.occasion.findMany({
      where: { storeId: storeContext.store.id },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(occasions, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Error fetching occasions:', error)
    return NextResponse.json({ error: 'Failed to fetch occasions' }, { status: 500 })
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
    const occasion = await prisma.occasion.create({
      data: {
        storeId: storeContext.store.id,
        name: body.name,
        emoji: body.emoji,
        description: body.description || null,
        icon: body.icon,
        isActive: body.isActive ?? true
      }
    })
    return NextResponse.json(occasion)
  } catch (error) {
    console.error('Error creating occasion:', error)
    return NextResponse.json({ error: 'Failed to create occasion' }, { status: 500 })
  }
}
