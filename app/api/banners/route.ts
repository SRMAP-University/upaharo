import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { attachProductsToBanners } from '@/lib/banner-products'

/** Public list of active homepage banners for the storefront / app. */
export async function GET() {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        title: true,
        subtitle: true,
        image: true,
        link: true,
        bgColor: true,
        order: true,
        productIds: true,
        category: true,
      },
    })

    const withProducts = await attachProductsToBanners(banners)

    return NextResponse.json({
      banners: withProducts.map(({ productIds: _ids, ...rest }) => rest),
    })
  } catch (error) {
    console.error('Error listing banners:', error)
    return NextResponse.json({ banners: [] }, { status: 200 })
  }
}
