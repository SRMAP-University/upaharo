import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params
    const body = await request.json()
    if (!(await prisma.giftWrap.findFirst({ where: { id, storeId: storeContext.store.id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Gift wrap not found' }, { status: 404 })
    }
    const giftWrap = await prisma.giftWrap.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        price: body.price,
        image: body.image,
        type: body.type,
        isActive: body.isActive
      }
    })
    return NextResponse.json(giftWrap)
  } catch (error) {
    console.error('Error updating gift wrap:', error)
    return NextResponse.json({ error: 'Failed to update gift wrap' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params
    const result = await prisma.giftWrap.deleteMany({ where: { id, storeId: storeContext.store.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Gift wrap not found' }, { status: 404 })
    return NextResponse.json({ message: 'Gift wrap deleted' })
  } catch (error) {
    console.error('Error deleting gift wrap:', error)
    return NextResponse.json({ error: 'Failed to delete gift wrap' }, { status: 500 })
  }
}
