import { NextRequest, NextResponse } from 'next/server'
import { normalizeCategoryIcon, normalizeCategoryShortName, normalizeCategoryWash } from '@/lib/category-style'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
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
    const parentId = body.parentId || null
    const [existing, parent] = await Promise.all([
      prisma.category.findFirst({ where: { id, storeId: storeContext.store.id }, select: { id: true } }),
      parentId ? prisma.category.findFirst({ where: { id: parentId, storeId: storeContext.store.id }, select: { id: true } }) : Promise.resolve(null),
    ])
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    if (parentId && (!parent || parentId === id)) return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 })
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: body.name,
        shortName: normalizeCategoryShortName(body.shortName),
        image: body.image ?? '',
        type: body.type,
        parentId,
        isActive: body.isActive,
        washColor: normalizeCategoryWash(body.washColor),
        iconName: normalizeCategoryIcon(body.iconName)
      }
    })
    await redis.del(
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'ALL'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'PRODUCT'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'OCCASION'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'RECIPIENT'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'HOME_PRODUCT'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'HOME_OCCASION'),
      REDIS_KEYS.HOME(storeContext.slug)
    )
    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
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
    const result = await prisma.category.deleteMany({ where: { id, storeId: storeContext.store.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    await redis.del(
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'ALL'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'PRODUCT'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'OCCASION'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'RECIPIENT'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'HOME_PRODUCT'),
      REDIS_KEYS.CATEGORIES(storeContext.slug, 'HOME_OCCASION'),
      REDIS_KEYS.HOME(storeContext.slug)
    )
    return NextResponse.json({ message: 'Category deleted' })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
