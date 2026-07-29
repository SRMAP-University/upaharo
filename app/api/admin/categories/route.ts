import { NextRequest, NextResponse } from 'next/server'
import { normalizeCategoryIcon, normalizeCategoryWash } from '@/lib/category-style'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const categories = await prisma.category.findMany({
      where: { storeId: storeContext.store.id },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(categories, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        Vary: 'Cookie',
      },
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
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
    const parentId = body.parentId || null
    if (parentId && !(await prisma.category.findFirst({ where: { id: parentId, storeId: storeContext.store.id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 })
    }
    const category = await prisma.category.create({
      data: {
        storeId: storeContext.store.id,
        name: body.name,
        image: body.image,
        type: body.type,
        parentId,
        isActive: body.isActive ?? true,
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
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
