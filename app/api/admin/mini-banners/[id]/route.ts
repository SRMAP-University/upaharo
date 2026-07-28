import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { normalizeMiniBannerLink, resolveMiniBannerLinks } from '@/lib/mini-banners'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const title = String(body.title ?? '').trim()
    const image = String(body.image ?? '').trim()

    if (!title || !image) {
      return NextResponse.json(
        { error: 'Title and image are required' },
        { status: 400 }
      )
    }

    const banner = await prisma.miniBanner.update({
      where: { id },
      data: {
        title,
        image,
        ...normalizeMiniBannerLink(body.linkType, body.linkId),
        order: Number(body.order) || 0,
        isActive: body.isActive ?? true,
      },
    })

    await redis.del(REDIS_KEYS.HOME_MINI_BANNERS)
    const [resolved] = await resolveMiniBannerLinks([banner])
    return NextResponse.json(resolved)
  } catch (error) {
    console.error('Error updating mini banner:', error)
    return NextResponse.json({ error: 'Failed to update mini banner' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.miniBanner.delete({ where: { id } })
    await redis.del(REDIS_KEYS.HOME_MINI_BANNERS)
    return NextResponse.json({ message: 'Mini banner deleted' })
  } catch (error) {
    console.error('Error deleting mini banner:', error)
    return NextResponse.json({ error: 'Failed to delete mini banner' }, { status: 500 })
  }
}
