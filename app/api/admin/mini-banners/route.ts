import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { normalizeMiniBannerLink, resolveMiniBannerLinks } from '@/lib/mini-banners'

export async function GET() {
  try {
    const banners = await prisma.miniBanner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(await resolveMiniBannerLinks(banners))
  } catch (error) {
    console.error('Error fetching mini banners:', error)
    return NextResponse.json({ error: 'Failed to fetch mini banners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = String(body.title ?? '').trim()
    const image = String(body.image ?? '').trim()

    if (!title || !image) {
      return NextResponse.json(
        { error: 'Title and image are required' },
        { status: 400 }
      )
    }

    const banner = await prisma.miniBanner.create({
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
    console.error('Error creating mini banner:', error)
    return NextResponse.json({ error: 'Failed to create mini banner' }, { status: 500 })
  }
}
