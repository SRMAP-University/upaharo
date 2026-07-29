import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { resolveStoreContext } from '@/lib/store-context'
import { storeAwareJsonHeaders } from '@/lib/store-cache-headers'

async function withProductsForStore(
  storeId: string,
  banners: Array<{
    id: string
    title: string
    subtitle: string | null
    image: string
    link: string | null
    bgColor: string | null
    order: number
    productIds: string[]
    category: string | null
    sectionId?: string | null
  }>
) {
  return Promise.all(
    banners.map(async (banner) => {
      const products = await prisma.product.findMany({
        where: {
          storeId,
          isAvailable: true,
          NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
          ...(banner.productIds.length > 0
            ? { id: { in: banner.productIds } }
            : banner.category
              ? { category: { equals: banner.category, mode: 'insensitive' } }
              : { id: { in: [] } }),
        },
        select: {
          id: true,
          name: true,
          price: true,
          image: true,
          category: true,
          discount: true,
          isAvailable: true,
          miniDescription: true,
          variants: true,
        },
        orderBy: banner.productIds.length > 0 ? undefined : { createdAt: 'desc' },
        take: 3,
      })
      const byId = new Map(products.map((product) => [product.id, product]))
      const { productIds: _ids, ...rest } = banner
      return {
        ...rest,
        products:
          banner.productIds.length > 0
            ? banner.productIds.map((id) => byId.get(id)).filter(Boolean)
            : products,
      }
    })
  )
}

/** Public list of active homepage banners + feed banner sections. */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext

    const [headerBanners, sections] = await Promise.all([
      prisma.banner.findMany({
        where: { storeId: store.id, isActive: true, sectionId: null },
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
          sectionId: true,
        },
      }),
      prisma.bannerSection.findMany({
        where: { storeId: store.id, isActive: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        take: 12,
        select: {
          id: true,
          title: true,
          subtitle: true,
          height: true,
          order: true,
          banners: {
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
              sectionId: true,
            },
          },
        },
      }),
    ])

    const headerWithProducts = await withProductsForStore(store.id, headerBanners)
    const sectionsWithProducts = await Promise.all(
      sections.map(async (section) => ({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        height: section.height,
        order: section.order,
        banners: await withProductsForStore(store.id, section.banners),
      }))
    )

    return NextResponse.json(
      {
        /** Sticky header carousel (sectionId null). */
        banners: headerWithProducts,
        /** Feed banner carousels managed as BannerSection rows. */
        sections: sectionsWithProducts,
      },
      {
        headers: storeAwareJsonHeaders({
          'Cache-Control': 'private, no-store',
        }),
      }
    )
  } catch (error) {
    console.error('Error listing banners:', error)
    return NextResponse.json({ banners: [], sections: [] }, { status: 200 })
  }
}
