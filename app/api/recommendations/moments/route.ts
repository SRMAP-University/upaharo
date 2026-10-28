import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildMoments } from '@/lib/context-recommendations'
import { parseList } from '@/lib/festive-ranking'
import { resolveUserId } from '@/lib/request-auth'
import { getUserSearches } from '@/lib/search-history'
import { getShoppingContext } from '@/lib/shopping-context'
import { resolveStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

/**
 * "Right now" rows for the website home and the app: products for the
 * current festival or love occasion, the weather where the shopper is, and
 * the time of day in Nepal.
 * Query: lat, lng (delivery location; Kathmandu if missing), searches,
 * viewed, categories (recent history kept on the device).
 */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ moments: [] }, { status: 404 })
    const storeId = storeContext.store.id
    const { searchParams } = new URL(request.url)
    const searches = parseList(searchParams.get('searches'), 10)
    const viewedProductIds = parseList(searchParams.get('viewed'), 30)
    const viewedCategories = parseList(searchParams.get('categories'), 10)

    const userId = await resolveUserId(request).catch(() => null)
    if (userId) {
      searches.push(...(await getUserSearches(storeId, userId).catch(() => [])))
      const events = await prisma.productViewEvent
        .findMany({ where: { storeId, userId }, orderBy: { viewedAt: 'desc' }, take: 30, select: { productId: true } })
        .catch(() => [])
      viewedProductIds.push(...events.map((e) => e.productId))
    }

    const context = await getShoppingContext({
      lat: Number(searchParams.get('lat')),
      lng: Number(searchParams.get('lng')),
      storeSlug: storeContext.slug,
    })
    const moments = await buildMoments(storeId, context, { searches, viewedProductIds, viewedCategories })

    const slim = (p: any) => ({
      id: p.id,
      name: p.name,
      miniDescription: p.miniDescription ?? null,
      category: p.category,
      price: p.price,
      discount: p.discount ?? 0,
      image: p.image,
      isVeg: Boolean(p.isVeg),
      showFoodTypeLabel: Boolean(p.showFoodTypeLabel),
      prepTime: p.prepTime ?? 0,
      tags: p.tags ?? [],
    })

    return NextResponse.json(
      {
        context: {
          daypart: context.daypart,
          weather: context.weather
            ? { raining: context.weather.raining, temperature: context.weather.temperature }
            : null,
          occasions: context.occasions.map((o) => ({
            id: o.id,
            name: o.name,
            emoji: o.emoji,
            date: o.date,
            daysLeft: o.daysLeft,
          })),
        },
        moments: moments.map((m) => ({ ...m, products: m.products.map(slim) })),
        // MET Norway asks for credit when its data is shown.
        weatherCredit: context.weather ? 'Weather: MET Norway' : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('Moments API failed:', error)
    return NextResponse.json({ moments: [] }, { status: 500 })
  }
}
