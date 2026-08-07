import Link from 'next/link'
import { headers } from 'next/headers'
import BottomNav from '@/components/BottomNav'
import ProductCard from '@/components/ProductCard'
import HomeRecommendationSection from '@/components/HomeRecommendationSection'
import HomepageTopLayout from '@/components/HomepageTopLayout'
import PremiumCategoryStrip from '@/components/home/PremiumCategoryStrip'
import SectionHeading from '@/components/home/SectionHeading'
import TrustStrip from '@/components/home/TrustStrip'
import HomeMiniBanners from '@/components/home/HomeMiniBanners'
import HomeValueDeals from '@/components/home/HomeValueDeals'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { getAppSettings, type HomeSectionConfig } from '@/lib/app-settings'
import { findManyProductsCompat } from '@/lib/product-db'
import { resolveStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getHomeData() {
  try {
    const h = await headers()
    const host = h.get('host') || 'www.upaharo.com'
    const storeContext = await resolveStoreContext({
      headers: h,
      url: `https://${host}/`,
    })
    const storeId = storeContext?.store.id
    const settings = await getAppSettings(storeContext?.store ?? 'store_gifts')

    const productWhere = {
      isAvailable: true,
      ...(storeId ? { storeId } : {}),
      NOT: {
        tags: {
          has: ARCHIVED_PRODUCT_TAG,
        },
      },
    }

    const categoryWhere = {
      type: 'PRODUCT' as const,
      isActive: true,
      ...(storeId ? { storeId } : {}),
    }

    const occasionWhere = {
      type: 'OCCASION' as const,
      isActive: true,
      ...(storeId ? { storeId } : {}),
    }

    const [
      categories,
      occasionCategories,
      products,
      banners,
      miniBanners,
    ] = await Promise.all([
      prisma.category.findMany({
        where: categoryWhere,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, image: true, washColor: true, shortName: true },
      }),
      prisma.category.findMany({
        where: occasionWhere,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, image: true, washColor: true, shortName: true },
      }),
      findManyProductsCompat({
        where: productWhere,
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      prisma.banner.findMany({
        where: {
          isActive: true,
          sectionId: null,
          ...(storeId ? { storeId } : {}),
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          title: true,
          subtitle: true,
          image: true,
          link: true,
          bgColor: true,
          productIds: true,
          category: true,
        },
      }),
      storeId
        ? prisma.miniBanner.findMany({
            where: { storeId, isActive: true },
            orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
            take: 12,
            select: {
              id: true,
              title: true,
              image: true,
              linkType: true,
              linkId: true,
            },
          })
        : Promise.resolve([]),
    ])

    const groupedCategories = categories
      .map((category) => ({
        category,
        products: products
          .filter((product) => product.category === category.name)
          .slice(0, 4),
      }))
      .filter((section) => section.products.length > 0)

    const dealIds = new Set(settings.valueDealsProductIds || [])
    const valueDealProducts =
      dealIds.size > 0
        ? products.filter((p) => dealIds.has(p.id)).slice(0, 12)
        : [...products]
            .sort(
              (a, b) => Number(b.discount || 0) - Number(a.discount || 0)
            )
            .filter((p) => Number(p.discount || 0) > 0)
            .slice(0, 8)

    const bestOfferProducts = [...products]
      .sort((left, right) => Number(right.discount || 0) - Number(left.discount || 0))
      .slice(0, 6)
    const latestProducts = products.slice(0, 6)
    const homepageRecommendationProducts =
      String(settings.homepageRecommendationMode || 'LATEST').toUpperCase() ===
      'BEST_OFFER'
        ? bestOfferProducts
        : latestProducts

    const unlock = Number(settings.valueDealsUnlockAmount) || 199
    const promoTemplate =
      settings.valueDealsPromoText || 'Shop for {amount} to unlock deals'
    const valueDealsPromoText = promoTemplate.replace(
      '{amount}',
      String(Math.round(unlock))
    )

    // Resolve up to 3 products per banner — same rules as /api/banners (and the app).
    const homepageBanners = await Promise.all(
      banners.map(async (banner) => {
        const hasIds = banner.productIds.length > 0
        const hasCategory = Boolean(banner.category?.trim())
        let bannerProducts: Array<{
          id: string
          name: string
          price: number
          image: string
          discount: number | null
        }> = []

        if (storeId && (hasIds || hasCategory)) {
          const found = await prisma.product.findMany({
            where: {
              storeId,
              isAvailable: true,
              NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
              ...(hasIds
                ? { id: { in: banner.productIds } }
                : {
                    category: {
                      equals: banner.category!,
                      mode: 'insensitive' as const,
                    },
                  }),
            },
            select: {
              id: true,
              name: true,
              price: true,
              image: true,
              discount: true,
            },
            orderBy: hasIds ? undefined : { createdAt: 'desc' as const },
            take: 3,
          })
          const byId = new Map(found.map((p) => [p.id, p]))
          bannerProducts = hasIds
            ? banner.productIds
                .map((id) => byId.get(id))
                .filter(Boolean)
                .slice(0, 3) as typeof bannerProducts
            : found
        }

        return {
          id: banner.id,
          title: banner.title,
          subtitle: banner.subtitle,
          image: banner.image,
          link: banner.link,
          bgColor: banner.bgColor,
          products: bannerProducts.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            image: p.image,
            discount: p.discount,
            finalPrice:
              p.discount && p.discount > 0
                ? p.price * (1 - p.discount / 100)
                : p.price,
          })),
        }
      })
    )

    return {
      settings,
      categories,
      occasionCategories,
      groupedCategories,
      products,
      latestProducts,
      homepageRecommendationProducts,
      homepageBanners,
      miniBanners,
      valueDealProducts,
      valueDealsPromoText,
      homeSections: (settings.homeSectionLayout || []) as HomeSectionConfig[],
      deliveryEstimate:
        settings.announcementText || settings.deliveryEstimate || '',
      bannerHeight: Number(settings.homepageBannerHeight) || 320,
      bannerProductHeight: Number(settings.homepageBannerProductHeight) || 112,
    }
  } catch (error) {
    console.error('Error fetching home data:', error)
    return {
      settings: await getAppSettings(),
      categories: [],
      occasionCategories: [],
      groupedCategories: [],
      products: [],
      latestProducts: [],
      homepageRecommendationProducts: [],
      homepageBanners: [],
      miniBanners: [],
      valueDealProducts: [],
      valueDealsPromoText: '',
      homeSections: [],
      deliveryEstimate: '',
      bannerHeight: 320,
      bannerProductHeight: 112,
    }
  }
}

function ProductGridSection({
  products,
  title,
}: {
  products: Array<{ id: string; [key: string]: unknown }>
  title: string
}) {
  if (products.length === 0) return null
  return (
    <section id="featured" className="space-y-4">
      <SectionHeading
        eyebrow="Shop"
        title={title || 'All gifts'}
        description="Pick something thoughtful."
        href="/search"
        ctaLabel="See all"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.slice(0, 24).map((product) => (
          <ProductCard key={product.id} product={product as any} />
        ))}
      </div>
    </section>
  )
}

export default async function Home() {
  const {
    settings,
    categories,
    occasionCategories,
    groupedCategories,
    products,
    latestProducts,
    homepageRecommendationProducts,
    homepageBanners,
    miniBanners,
    valueDealProducts,
    valueDealsPromoText,
    homeSections,
    deliveryEstimate,
    bannerHeight,
    bannerProductHeight,
  } = await getHomeData()

  const visibleSections =
    homeSections.filter((s) => s.visible).length > 0
      ? homeSections.filter((s) => s.visible)
      : [
          { id: 'valueDeals' as const, title: 'Value', subtitle: 'DEALS', visible: true },
          { id: 'miniBanners' as const, title: 'Featured', subtitle: '', visible: true },
          { id: 'quickPicks' as const, title: 'Quick picks', subtitle: '', visible: true },
          { id: 'productGrid' as const, title: 'All gifts', subtitle: '', visible: true },
        ]

  const renderSection = (section: HomeSectionConfig) => {
    switch (section.id) {
      case 'spinBanner':
        // Web spin lives on /promo — keep a light promo chip matching app placement.
        if (!settings.homepageShowSpinBanner) return null
        return (
          <Link
            key={`spin-${section.key || section.id}`}
            href="/promo"
            className="flex items-center justify-between rounded-[20px] border border-blush/25 bg-gradient-to-r from-blush-soft via-white to-blush-mid px-4 py-3 shadow-[0_12px_28px_-24px_rgba(232,90,140,0.5)]"
          >
            <div>
              <p className="text-sm font-extrabold text-ink">
                {section.title || 'Spin & Win'}
              </p>
              <p className="text-xs font-medium text-ink/55">
                {section.subtitle || 'Daily roulette · extra savings'}
              </p>
            </div>
            <span className="rounded-full bg-blush px-3 py-1.5 text-xs font-bold text-white">
              Play
            </span>
          </Link>
        )
      case 'valueDeals':
        if (!settings.homepageShowValueDeals) return null
        return (
          <HomeValueDeals
            key={`vd-${section.key || section.id}`}
            products={valueDealProducts as any}
            title={section.title || 'Value'}
            subtitle={section.subtitle || 'DEALS'}
            promoText={valueDealsPromoText}
          />
        )
      case 'miniBanners':
        return (
          <HomeMiniBanners
            key={`mb-${section.key || section.id}`}
            banners={miniBanners}
            title={section.title || undefined}
            columns={settings.miniBannerColumns || 3}
            height={settings.miniBannerHeight || 96}
          />
        )
      case 'quickPicks':
        if (settings.homepageShowOccasionTabs && occasionCategories.length > 0) {
          return (
            <section key={`qp-${section.key || section.id}`} className="space-y-4">
              <SectionHeading
                eyebrow="Occasions"
                title={section.title || 'Quick picks'}
                description="Curated edits for life's celebrations."
              />
              <PremiumCategoryStrip
                categories={occasionCategories.slice(0, 10)}
                variant="tile"
              />
            </section>
          )
        }
        if (settings.homepageShowTopCategories && categories.length > 0) {
          return (
            <section key={`qp-cat-${section.key || section.id}`} className="space-y-4">
              <SectionHeading
                eyebrow="Browse"
                title={section.title || 'Quick picks'}
                description="Find the perfect gift for every moment."
                href="/search"
                ctaLabel="See all"
              />
              <PremiumCategoryStrip categories={categories.slice(0, 10)} variant="round" />
            </section>
          )
        }
        return null
      case 'productGrid':
        return (
          <div key={`pg-${section.key || section.id}`} className="space-y-10">
            {settings.homepageShowRecommendations &&
            homepageRecommendationProducts.length > 0 ? (
              <HomeRecommendationSection
                initialProducts={homepageRecommendationProducts}
                initialTitle={
                  settings.homepageRecommendationTitle || 'Recommended for you'
                }
                initialDescription={
                  String(settings.homepageRecommendationMode || 'LATEST').toUpperCase() ===
                  'BEST_OFFER'
                    ? 'Best discounts, curated for quick checkout.'
                    : 'Freshly added to the collection.'
                }
              />
            ) : null}
            {settings.homepageShowCategorySections
              ? groupedCategories.map(({ category, products: sectionProducts }) => (
                  <section key={category.id} className="space-y-4">
                    <SectionHeading
                      eyebrow="Collection"
                      title={category.name}
                      href={`/categories/${category.id}`}
                    />
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {sectionProducts.map((product) => (
                        <ProductCard key={product.id} product={product as any} />
                      ))}
                    </div>
                  </section>
                ))
              : (
                  <ProductGridSection
                    products={products as any}
                    title={section.title || 'All gifts'}
                  />
                )}
            <div id="latest" className="space-y-4">
              {latestProducts.length > 0 ? (
                <>
                  <SectionHeading eyebrow="New" title="Latest arrivals" href="/search" />
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {latestProducts.map((product) => (
                      <ProductCard key={product.id} product={product as any} />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )
      case 'bannerCarousel':
        // Header already shows the sticky main banners — skip duplicate feed carousel.
        return null
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-cream">
      <HomepageTopLayout
        categories={categories}
        occasionCategories={occasionCategories}
        showTopCategories={settings.homepageShowTopCategories}
        showOccasionTabs={settings.homepageShowOccasionTabs}
        deliveryEstimate={deliveryEstimate}
        banners={homepageBanners}
        showBanner={settings.homepageShowBanner !== false}
        bannerHeight={bannerHeight}
        bannerProductHeight={bannerProductHeight}
      />

      <div className="mx-auto max-w-7xl space-y-8 px-4 pb-28 pt-5 sm:px-6 lg:pb-12">
        {visibleSections.map((section) => renderSection(section))}

        {products.length === 0 && homepageRecommendationProducts.length === 0 ? (
          <div className="rounded-[30px] border border-blush/15 bg-white py-16 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Our shelves are being restocked
            </h2>
            <p className="mt-1 text-sm text-ink/50">
              Beautiful gifts are on their way back. Please check in soon.
            </p>
          </div>
        ) : null}

        <div className="gold-divider" />
        <TrustStrip />
      </div>

      <BottomNav />
    </main>
  )
}
