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

export async function GET(request: NextRequest) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const categories = await prisma.category.findMany({
      where: { storeId: ctx.store.id },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Partner admin categories GET:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const body = await request.json()
    const name = String(body.name ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const parentId = body.parentId || null
    if (
      parentId &&
      !(await prisma.category.findFirst({
        where: { id: parentId, storeId: ctx.store.id },
        select: { id: true },
      }))
    ) {
      return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 })
    }

    const category = await prisma.category.create({
      data: {
        storeId: ctx.store.id,
        name,
        shortName: normalizeCategoryShortName(body.shortName),
        image: String(body.image ?? ''),
        type: body.type || 'PRODUCT',
        parentId,
        isActive: body.isActive ?? true,
        washColor: normalizeCategoryWash(body.washColor),
        iconName: normalizeCategoryIcon(body.iconName),
      },
    })

    await redis.del(
      REDIS_KEYS.CATEGORIES(ctx.slug, 'ALL'),
      REDIS_KEYS.CATEGORIES(ctx.slug, 'PRODUCT'),
      REDIS_KEYS.CATEGORIES(ctx.slug, 'OCCASION'),
      REDIS_KEYS.CATEGORIES(ctx.slug, 'RECIPIENT'),
      REDIS_KEYS.CATEGORIES(ctx.slug, 'HOME_PRODUCT'),
      REDIS_KEYS.CATEGORIES(ctx.slug, 'HOME_OCCASION'),
      REDIS_KEYS.HOME(ctx.slug)
    )

    return NextResponse.json(category)
  } catch (error) {
    console.error('Partner admin categories POST:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
