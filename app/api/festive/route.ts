import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bhaiTikaCountdown } from '@/lib/festival-dates'
import { getFestiveSections } from '@/lib/festive-products'
import { parseList, rankForShopper } from '@/lib/festive-ranking'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'
import { getAppSettings } from '@/lib/app-settings'
import { getUserSearches } from '@/lib/search-history'

export const dynamic = 'force-dynamic'

/**
 * Tihar / Bhai Tika collection for the website home and the app.
 * Query: searches, viewed (product ids), categories — recent history kept on
 * the device. Signed-in shoppers also get their recent product views.
 */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    const storeId = storeContext?.store.id
    const { searchParams } = new URL(request.url)
    const searches = parseList(searchParams.get('searches'), 10)
    const viewedProductIds = parseList(searchParams.get('viewed'), 30)
    const viewedCategories = parseList(searchParams.get('categories'), 10)

    const userId = await resolveUserId(request).catch(() => null)
    if (userId && storeId) {
      searches.push(...(await getUserSearches(storeId, userId)))
      const events = await prisma.productViewEvent.findMany({
        where: { storeId, userId },
        orderBy: { viewedAt: 'desc' },
        take: 30,
        select: { productId: true },
      })
      viewedProductIds.push(...events.map((e) => e.productId))
    }

    const sections = await getFestiveSections(storeId)
    // Every festive product once, in page order, then personal order on top.
    const seen = new Set<string>()
    const all = sections
      .filter((s) => s.id !== 'under-999')
      .flatMap((s) => s.products)
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    const forYou = rankForShopper(all, { searches, viewedProductIds, viewedCategories }).slice(0, 12)

    const slim = (p: any) => ({
      id: p.id,
      name: p.name,
      miniDescription: p.miniDescription ?? null,
      description: p.description ?? '',
      category: p.category,
      price: p.price,
      discount: p.discount ?? 0,
      image: p.image,
      isVeg: Boolean(p.isVeg),
      showFoodTypeLabel: Boolean(p.showFoodTypeLabel),
      prepTime: p.prepTime ?? 0,
      tags: p.tags ?? [],
    })

    const settings = storeContext ? await getAppSettings(storeContext.store).catch(() => null) : null

    return NextResponse.json(
      {
        festivalMode: settings?.festivalMode !== false,
        personalised: searches.length > 0 || viewedProductIds.length > 0 || viewedCategories.length > 0,
        countdown: bhaiTikaCountdown(),
        forYou: forYou.map(slim),
        sections: sections
          .filter((s) => s.products.length > 0)
          .map((s) => ({ ...s, products: s.products.map(slim) })),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('Festive API failed:', error)
    return NextResponse.json({ countdown: null, forYou: [], sections: [] }, { status: 500 })
  }
}
