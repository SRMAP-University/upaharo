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
    if (!(await prisma.occasion.findFirst({ where: { id, storeId: storeContext.store.id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Occasion not found' }, { status: 404 })
    }
    const occasion = await prisma.occasion.update({
      where: { id },
      data: {
        name: body.name,
        emoji: body.emoji,
        description: body.description || null,
        icon: body.icon,
        isActive: body.isActive
      }
    })
    return NextResponse.json(occasion)
  } catch (error) {
    console.error('Error updating occasion:', error)
    return NextResponse.json({ error: 'Failed to update occasion' }, { status: 500 })
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
    const result = await prisma.occasion.deleteMany({ where: { id, storeId: storeContext.store.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Occasion not found' }, { status: 404 })
    return NextResponse.json({ message: 'Occasion deleted' })
  } catch (error) {
    console.error('Error deleting occasion:', error)
    return NextResponse.json({ error: 'Failed to delete occasion' }, { status: 500 })
  }
}
