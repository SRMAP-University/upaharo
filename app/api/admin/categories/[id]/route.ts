import { NextRequest, NextResponse } from 'next/server'
import { normalizeCategoryIcon, normalizeCategoryWash } from '@/lib/category-style'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: body.name,
        image: body.image,
        type: body.type,
        parentId: body.parentId || null,
        isActive: body.isActive,
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
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.category.delete({
      where: { id }
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
    return NextResponse.json({ message: 'Category deleted' })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
