import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveMiniBannerLinks } from '@/lib/mini-banners'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'

/** Public list of active mini banners for the app's home row. */
export async function GET() {
  try {
    const miniBanners = await getOrSetJson(REDIS_KEYS.HOME_MINI_BANNERS, 300, async () => {
      const banners = await prisma.miniBanner.findMany({
        where: { isActive: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          title: true,
          image: true,
          linkType: true,
          linkId: true,
          order: true,
          isActive: true,
        },
      })

      const resolved = await resolveMiniBannerLinks(banners)
      return resolved.map(({ order: _order, isActive: _isActive, ...rest }) => rest)
    })

    return NextResponse.json({ miniBanners })
  } catch (error) {
    console.error('Error listing mini banners:', error)
    return NextResponse.json({ miniBanners: [] }, { status: 200 })
  }
}
