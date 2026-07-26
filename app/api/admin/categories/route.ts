import { NextRequest, NextResponse } from 'next/server'
import { normalizeCategoryIcon, normalizeCategoryWash } from '@/lib/category-style'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(categories, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const category = await prisma.category.create({
      data: {
        name: body.name,
        image: body.image,
        type: body.type,
        parentId: body.parentId || null,
        isActive: body.isActive ?? true,
        washColor: normalizeCategoryWash(body.washColor),
        iconName: normalizeCategoryIcon(body.iconName)
      }
    })
    await redis.del(
      REDIS_KEYS.CATEGORIES('ALL'),
      REDIS_KEYS.CATEGORIES('PRODUCT'),
      REDIS_KEYS.CATEGORIES('OCCASION'),
      REDIS_KEYS.CATEGORIES('RECIPIENT'),
      REDIS_KEYS.CATEGORIES('HOME_PRODUCT'),
      REDIS_KEYS.CATEGORIES('HOME_OCCASION'),
      REDIS_KEYS.HOME
    )
    return NextResponse.json(category)
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
