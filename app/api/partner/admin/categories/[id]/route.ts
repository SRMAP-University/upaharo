import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeCategoryIcon,
  normalizeCategoryShortName,
  normalizeCategoryWash,
} from '@/lib/category-style'
import {
  requirePartnerAdmin,
  resolvePartnerStoreContext,
} from '@/lib/partner-auth'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'

async function bustCategoryCache(slug: string) {
  await redis.del(
    REDIS_KEYS.CATEGORIES(slug, 'ALL'),
    REDIS_KEYS.CATEGORIES(slug, 'PRODUCT'),
    REDIS_KEYS.CATEGORIES(slug, 'OCCASION'),
    REDIS_KEYS.CATEGORIES(slug, 'RECIPIENT'),
    REDIS_KEYS.CATEGORIES(slug, 'HOME_PRODUCT'),
    REDIS_KEYS.CATEGORIES(slug, 'HOME_OCCASION'),
    REDIS_KEYS.HOME(slug)
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const parentId = body.parentId || null
    const [existing, parent] = await Promise.all([
      prisma.category.findFirst({
        where: { id, storeId: ctx.store.id },
        select: { id: true },
      }),
      parentId
        ? prisma.category.findFirst({
            where: { id: parentId, storeId: ctx.store.id },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    if (parentId && (!parent || parentId === id)) {
      return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 })
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.shortName !== undefined
          ? { shortName: normalizeCategoryShortName(body.shortName) }
          : {}),
        ...(body.image !== undefined ? { image: String(body.image ?? '') } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.parentId !== undefined ? { parentId } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.washColor !== undefined
          ? { washColor: normalizeCategoryWash(body.washColor) }
          : {}),
        ...(body.iconName !== undefined
          ? { iconName: normalizeCategoryIcon(body.iconName) }
          : {}),
      },
    })
    await bustCategoryCache(ctx.slug)
    return NextResponse.json(category)
  } catch (error) {
    console.error('Partner admin categories PATCH:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id } = await params
    const result = await prisma.category.deleteMany({
      where: { id, storeId: ctx.store.id },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    await bustCategoryCache(ctx.slug)
    return NextResponse.json({ message: 'Category deleted' })
  } catch (error) {
    console.error('Partner admin categories DELETE:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
