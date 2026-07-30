import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  clampFloat,
  clampInt,
  DEFAULT_APP_SETTINGS,
  normalizeDeliverySlots,
  normalizeDensity,
  normalizeHeaderCategoryIds,
  normalizeHexColor,
  normalizeHomeSections,
  normalizeOptionalAmount,
  normalizeScheduleDays,
  normalizeValueDealsProductIds,
} from '@/lib/app-settings'
import { isMissingAppSettingsTableError } from '@/lib/product-db'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

function toNumber(value: unknown, fallback: number) {
  if (value === '' || value === null || value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function toText(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim()
  return raw || fallback
}

function appearanceFields(body: Record<string, unknown>) {
  return {
    brandPrimary: normalizeHexColor(body?.brandPrimary, DEFAULT_APP_SETTINGS.brandPrimary),
    brandSecondary: normalizeHexColor(body?.brandSecondary, DEFAULT_APP_SETTINGS.brandSecondary),
    headerWash: normalizeHexColor(body?.headerWash, DEFAULT_APP_SETTINGS.headerWash),
    pageBackground: normalizeHexColor(body?.pageBackground, DEFAULT_APP_SETTINGS.pageBackground),
    textInk: normalizeHexColor(body?.textInk, DEFAULT_APP_SETTINGS.textInk),
    textMuted: normalizeHexColor(body?.textMuted, DEFAULT_APP_SETTINGS.textMuted),
    surfaceSoft: normalizeHexColor(body?.surfaceSoft, DEFAULT_APP_SETTINGS.surfaceSoft),
    cardBackground: normalizeHexColor(body?.cardBackground, DEFAULT_APP_SETTINGS.cardBackground),
    cornerRadius: clampInt(body?.cornerRadius, DEFAULT_APP_SETTINGS.cornerRadius, 0, 32),
    buttonRadius: clampInt(body?.buttonRadius, DEFAULT_APP_SETTINGS.buttonRadius, 0, 40),
    uiDensity: normalizeDensity(body?.uiDensity, DEFAULT_APP_SETTINGS.uiDensity),
  }
}

function productCardFields(body: Record<string, unknown>) {
  return {
    productGridColumns: clampInt(body?.productGridColumns, DEFAULT_APP_SETTINGS.productGridColumns, 2, 4),
    productCardAspectRatio: clampFloat(
      body?.productCardAspectRatio,
      DEFAULT_APP_SETTINGS.productCardAspectRatio,
      0.5,
      1.2
    ),
    productShowDiscountBadge: toBool(
      body?.productShowDiscountBadge,
      DEFAULT_APP_SETTINGS.productShowDiscountBadge
    ),
    productShowCategoryLabel: toBool(
      body?.productShowCategoryLabel,
      DEFAULT_APP_SETTINGS.productShowCategoryLabel
    ),
  }
}

function navigationFields(body: Record<string, unknown>) {
  return {
    showPromoTab: toBool(body?.showPromoTab, DEFAULT_APP_SETTINGS.showPromoTab),
    promoOrbLabel: toText(body?.promoOrbLabel, DEFAULT_APP_SETTINGS.promoOrbLabel).slice(0, 12),
    navHomeLabel: toText(body?.navHomeLabel, DEFAULT_APP_SETTINGS.navHomeLabel).slice(0, 16),
    navCategoriesLabel: toText(body?.navCategoriesLabel, DEFAULT_APP_SETTINGS.navCategoriesLabel).slice(0, 16),
    navTopPicksLabel: toText(body?.navTopPicksLabel, DEFAULT_APP_SETTINGS.navTopPicksLabel).slice(0, 16),
  }
}

function walletFields(body: Record<string, unknown>) {
  return {
    walletEnabled: toBool(body?.walletEnabled, DEFAULT_APP_SETTINGS.walletEnabled),
    cashbackPercent: clampFloat(body?.cashbackPercent, DEFAULT_APP_SETTINGS.cashbackPercent, 0, 100),
    cashbackMaxAmount: normalizeOptionalAmount(body?.cashbackMaxAmount),
    walletMaxPercentPerOrder: clampFloat(
      body?.walletMaxPercentPerOrder,
      DEFAULT_APP_SETTINGS.walletMaxPercentPerOrder,
      0,
      100
    ),
    walletMaxAmountPerOrder: normalizeOptionalAmount(body?.walletMaxAmountPerOrder),
    checkoutMinPayable: clampFloat(
      body?.checkoutMinPayable,
      DEFAULT_APP_SETTINGS.checkoutMinPayable,
      0,
      1_000_000
    ),
    checkoutMinOrderAmount: clampFloat(
      body?.checkoutMinOrderAmount,
      DEFAULT_APP_SETTINGS.checkoutMinOrderAmount,
      0,
      1_000_000
    ),
    freeDeliveryMinAmount: clampFloat(
      body?.freeDeliveryMinAmount,
      DEFAULT_APP_SETTINGS.freeDeliveryMinAmount,
      0,
      1_000_000
    ),
    deliveryFeeAmount: clampFloat(
      body?.deliveryFeeAmount,
      DEFAULT_APP_SETTINGS.deliveryFeeAmount,
      0,
      1_000_000
    ),
  }
}

/**
 * Scheduled delivery windows. An explicit empty `deliverySlots` array turns
 * scheduling off for customers; the normalizer keeps starts unique and sorted
 * because the order API matches an incoming time against the start hour.
 */
function scheduleFields(body: Record<string, unknown>) {
  return {
    deliverySlots: normalizeDeliverySlots(body?.deliverySlots),
    ...normalizeScheduleDays(body?.scheduleDayCount, body?.scheduleMaxDaysAhead),
  }
}

function settingsPayload(body: Record<string, unknown>) {
  return {
    siteName: String(body?.siteName || DEFAULT_APP_SETTINGS.siteName).trim(),
    supportPhone: String(body?.supportPhone || '').trim() || null,
    supportEmail: String(body?.supportEmail || '').trim() || null,
    supportHours: String(body?.supportHours || '').trim() || null,
    supportMessage: String(body?.supportMessage || '').trim() || null,
    deliveryEstimate: String(body?.deliveryEstimate || DEFAULT_APP_SETTINGS.deliveryEstimate).trim(),
    deliveryNote: String(body?.deliveryNote || '').trim() || null,
    announcementText: String(body?.announcementText || '').trim() || null,
    storeAddress: String(body?.storeAddress || '').trim() || null,
    mapLatitude: toNumber(body?.mapLatitude, DEFAULT_APP_SETTINGS.mapLatitude),
    mapLongitude: toNumber(body?.mapLongitude, DEFAULT_APP_SETTINGS.mapLongitude),
    homepageShowBanner: toBool(body?.homepageShowBanner, DEFAULT_APP_SETTINGS.homepageShowBanner),
    homepageBannerHeight: clampInt(
      body?.homepageBannerHeight,
      DEFAULT_APP_SETTINGS.homepageBannerHeight,
      200,
      520
    ),
    homepageBannerProductHeight: clampInt(
      body?.homepageBannerProductHeight,
      DEFAULT_APP_SETTINGS.homepageBannerProductHeight,
      72,
      180
    ),
    miniBannerColumns: clampInt(
      body?.miniBannerColumns,
      DEFAULT_APP_SETTINGS.miniBannerColumns,
      1,
      4
    ),
    miniBannerHeight: clampInt(
      body?.miniBannerHeight,
      DEFAULT_APP_SETTINGS.miniBannerHeight,
      56,
      240
    ),
    homepageShowTopCategories: toBool(
      body?.homepageShowTopCategories,
      DEFAULT_APP_SETTINGS.homepageShowTopCategories
    ),
    homepageShowCategorySections: toBool(
      body?.homepageShowCategorySections,
      DEFAULT_APP_SETTINGS.homepageShowCategorySections
    ),
    homepageShowOccasionTabs: toBool(
      body?.homepageShowOccasionTabs,
      DEFAULT_APP_SETTINGS.homepageShowOccasionTabs
    ),
    homepageShowRecommendations: toBool(
      body?.homepageShowRecommendations,
      DEFAULT_APP_SETTINGS.homepageShowRecommendations
    ),
    homepageShowValueDeals: toBool(
      body?.homepageShowValueDeals,
      DEFAULT_APP_SETTINGS.homepageShowValueDeals
    ),
    valueDealsProductIds: normalizeValueDealsProductIds(body?.valueDealsProductIds),
    valueDealsPromoText: toText(
      body?.valueDealsPromoText,
      DEFAULT_APP_SETTINGS.valueDealsPromoText
    ).slice(0, 160),
    valueDealsUnlockAmount: clampFloat(
      body?.valueDealsUnlockAmount,
      DEFAULT_APP_SETTINGS.valueDealsUnlockAmount,
      0,
      1_000_000
    ),
    homepageShowSpinBanner: toBool(
      body?.homepageShowSpinBanner,
      DEFAULT_APP_SETTINGS.homepageShowSpinBanner
    ),
    featureGiftOptions: toBool(
      body?.featureGiftOptions,
      DEFAULT_APP_SETTINGS.featureGiftOptions
    ),
    featureAiAssistant: toBool(
      body?.featureAiAssistant,
      DEFAULT_APP_SETTINGS.featureAiAssistant
    ),
    featureWishlist: toBool(
      body?.featureWishlist,
      DEFAULT_APP_SETTINGS.featureWishlist
    ),
    homepageRecommendationMode:
      String(body?.homepageRecommendationMode || DEFAULT_APP_SETTINGS.homepageRecommendationMode).trim(),
    homepageRecommendationTitle:
      String(body?.homepageRecommendationTitle || DEFAULT_APP_SETTINGS.homepageRecommendationTitle).trim(),
    homeSectionLayout: normalizeHomeSections(body?.homeSectionLayout),
    headerCategoryIds: normalizeHeaderCategoryIds(body?.headerCategoryIds),
    ...appearanceFields(body),
    ...productCardFields(body),
    ...navigationFields(body),
    ...walletFields(body),
    ...scheduleFields(body),
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Selected store not found' }, { status: 404 })
    }
    const settings = await prisma.appSettings.findUnique({
      where: { storeId: storeContext.store.id },
    })

    return NextResponse.json({
      id: settings?.id,
      store: storeContext.store,
      ...DEFAULT_APP_SETTINGS,
      ...(settings || {}),
      homeSectionLayout: normalizeHomeSections(settings?.homeSectionLayout),
      headerCategoryIds: normalizeHeaderCategoryIds(settings?.headerCategoryIds),
      deliverySlots: normalizeDeliverySlots(settings?.deliverySlots),
      ...normalizeScheduleDays(
        settings?.scheduleDayCount,
        settings?.scheduleMaxDaysAhead
      ),
      brandPrimary: normalizeHexColor(settings?.brandPrimary, DEFAULT_APP_SETTINGS.brandPrimary),
      brandSecondary: normalizeHexColor(settings?.brandSecondary, DEFAULT_APP_SETTINGS.brandSecondary),
      headerWash: normalizeHexColor(settings?.headerWash, DEFAULT_APP_SETTINGS.headerWash),
      pageBackground: normalizeHexColor(settings?.pageBackground, DEFAULT_APP_SETTINGS.pageBackground),
      textInk: normalizeHexColor(settings?.textInk, DEFAULT_APP_SETTINGS.textInk),
      textMuted: normalizeHexColor(settings?.textMuted, DEFAULT_APP_SETTINGS.textMuted),
      surfaceSoft: normalizeHexColor(settings?.surfaceSoft, DEFAULT_APP_SETTINGS.surfaceSoft),
      cardBackground: normalizeHexColor(settings?.cardBackground, DEFAULT_APP_SETTINGS.cardBackground),
    })
  } catch (error) {
    if (isMissingAppSettingsTableError(error)) {
      return NextResponse.json({
        id: 'default',
        ...DEFAULT_APP_SETTINGS,
      })
    }

    console.error('Error fetching admin settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Selected store not found' }, { status: 404 })
    }
    const body = (await request.json()) as Record<string, unknown>
    const payload = settingsPayload(body)

    const settings = await prisma.appSettings.upsert({
      where: { storeId: storeContext.store.id },
      update: payload,
      create: {
        storeId: storeContext.store.id,
        ...payload,
      },
    })

    await redis.del(
      REDIS_KEYS.APP_SETTINGS(storeContext.slug),
      REDIS_KEYS.HOME(storeContext.slug)
    )

    return NextResponse.json(settings)
  } catch (error) {
    if (isMissingAppSettingsTableError(error)) {
      return NextResponse.json(
        { error: 'Settings storage is not available yet. Run the latest Prisma migration to enable admin settings.' },
        { status: 400 }
      )
    }

    console.error('Error updating admin settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings. Apply the latest Prisma migration first if this is a new setup.' },
      { status: 500 }
    )
  }
}
