import {
  clampFloat,
  clampInt,
  DEFAULT_APP_SETTINGS,
  normalizeDeliverySlots,
  normalizeDensity,
  normalizeHexColor,
  normalizeHeaderCategoryIds,
  normalizeHomeSections,
  normalizeOptionalAmount,
  normalizeScheduleDays,
  normalizeValueDealsProductIds,
  type PublicAppSettings,
} from '@/lib/app-settings-schema'
import { prisma } from '@/lib/prisma'
import { isMissingAppSettingsTableError } from '@/lib/product-db'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'
import { DEFAULT_STORE_SLUG, type StoreIdentity } from '@/lib/store-context'

export * from '@/lib/app-settings-schema'

export type StoreSettingsTarget = Pick<StoreIdentity, 'id' | 'slug'> | string

/**
 * Reads settings for one storefront. Calls with no argument intentionally
 * resolve to the legacy gifts store, preserving old server callers while
 * storefront handlers pass their resolved store context explicitly.
 */
export async function getAppSettings(
  target: StoreSettingsTarget = 'store_gifts'
): Promise<PublicAppSettings> {
  const storeId = typeof target === 'string' ? target : target.id
  const cacheSlug =
    typeof target === 'string'
      ? target === 'store_gifts'
        ? DEFAULT_STORE_SLUG
        : target
      : target.slug

  try {
    return await getOrSetJson(REDIS_KEYS.APP_SETTINGS(cacheSlug), 300, async () => {
      const settings = await prisma.appSettings.findUnique({
        where: { storeId },
      })

      if (!settings) {
        return DEFAULT_APP_SETTINGS
      }

      return {
        siteName:
          !settings.siteName || settings.siteName === 'Flowers N Petals'
            ? DEFAULT_APP_SETTINGS.siteName
            : settings.siteName,
        supportPhone: settings.supportPhone || DEFAULT_APP_SETTINGS.supportPhone,
        supportEmail: settings.supportEmail || DEFAULT_APP_SETTINGS.supportEmail,
        supportHours: settings.supportHours || DEFAULT_APP_SETTINGS.supportHours,
        supportMessage: settings.supportMessage || DEFAULT_APP_SETTINGS.supportMessage,
        deliveryEstimate: settings.deliveryEstimate || DEFAULT_APP_SETTINGS.deliveryEstimate,
        deliveryNote: settings.deliveryNote || DEFAULT_APP_SETTINGS.deliveryNote,
        announcementText: settings.announcementText || DEFAULT_APP_SETTINGS.announcementText,
        storeAddress: settings.storeAddress || DEFAULT_APP_SETTINGS.storeAddress,
        mapLatitude: settings.mapLatitude ?? DEFAULT_APP_SETTINGS.mapLatitude,
        mapLongitude: settings.mapLongitude ?? DEFAULT_APP_SETTINGS.mapLongitude,
        homepageShowBanner: settings.homepageShowBanner ?? DEFAULT_APP_SETTINGS.homepageShowBanner,
        homepageBannerHeight: clampInt(
          settings.homepageBannerHeight,
          DEFAULT_APP_SETTINGS.homepageBannerHeight,
          200,
          520
        ),
        homepageBannerProductHeight: clampInt(
          settings.homepageBannerProductHeight,
          DEFAULT_APP_SETTINGS.homepageBannerProductHeight,
          72,
          180
        ),
        miniBannerColumns: clampInt(
          settings.miniBannerColumns,
          DEFAULT_APP_SETTINGS.miniBannerColumns,
          1,
          4
        ),
        miniBannerHeight: clampInt(
          settings.miniBannerHeight,
          DEFAULT_APP_SETTINGS.miniBannerHeight,
          56,
          240
        ),
        homepageShowTopCategories: settings.homepageShowTopCategories ?? DEFAULT_APP_SETTINGS.homepageShowTopCategories,
        homepageShowCategorySections:
          settings.homepageShowCategorySections ?? DEFAULT_APP_SETTINGS.homepageShowCategorySections,
        homepageShowOccasionTabs: settings.homepageShowOccasionTabs ?? DEFAULT_APP_SETTINGS.homepageShowOccasionTabs,
        homepageShowRecommendations:
          settings.homepageShowRecommendations ?? DEFAULT_APP_SETTINGS.homepageShowRecommendations,
        homepageShowValueDeals:
          settings.homepageShowValueDeals ?? DEFAULT_APP_SETTINGS.homepageShowValueDeals,
        valueDealsProductIds: normalizeValueDealsProductIds(
          settings.valueDealsProductIds
        ),
        valueDealsPromoText:
          String(settings.valueDealsPromoText || DEFAULT_APP_SETTINGS.valueDealsPromoText)
            .trim() || DEFAULT_APP_SETTINGS.valueDealsPromoText,
        valueDealsUnlockAmount: clampFloat(
          settings.valueDealsUnlockAmount,
          DEFAULT_APP_SETTINGS.valueDealsUnlockAmount,
          0,
          1_000_000
        ),
        homepageShowSpinBanner:
          settings.homepageShowSpinBanner ?? DEFAULT_APP_SETTINGS.homepageShowSpinBanner,
        featureGiftOptions:
          settings.featureGiftOptions ?? DEFAULT_APP_SETTINGS.featureGiftOptions,
        featureAiAssistant:
          settings.featureAiAssistant ?? DEFAULT_APP_SETTINGS.featureAiAssistant,
        featureWishlist:
          settings.featureWishlist ?? DEFAULT_APP_SETTINGS.featureWishlist,
        homepageRecommendationMode:
          settings.homepageRecommendationMode || DEFAULT_APP_SETTINGS.homepageRecommendationMode,
        homepageRecommendationTitle:
          settings.homepageRecommendationTitle || DEFAULT_APP_SETTINGS.homepageRecommendationTitle,
        homeSectionLayout: normalizeHomeSections(settings.homeSectionLayout),
        headerCategoryIds: normalizeHeaderCategoryIds(settings.headerCategoryIds),
        brandPrimary: normalizeHexColor(settings.brandPrimary, DEFAULT_APP_SETTINGS.brandPrimary),
        brandSecondary: normalizeHexColor(settings.brandSecondary, DEFAULT_APP_SETTINGS.brandSecondary),
        headerWash: normalizeHexColor(settings.headerWash, DEFAULT_APP_SETTINGS.headerWash),
        pageBackground: normalizeHexColor(settings.pageBackground, DEFAULT_APP_SETTINGS.pageBackground),
        textInk: normalizeHexColor(settings.textInk, DEFAULT_APP_SETTINGS.textInk),
        textMuted: normalizeHexColor(settings.textMuted, DEFAULT_APP_SETTINGS.textMuted),
        surfaceSoft: normalizeHexColor(settings.surfaceSoft, DEFAULT_APP_SETTINGS.surfaceSoft),
        cardBackground: normalizeHexColor(settings.cardBackground, DEFAULT_APP_SETTINGS.cardBackground),
        cornerRadius: clampInt(settings.cornerRadius, DEFAULT_APP_SETTINGS.cornerRadius, 0, 32),
        buttonRadius: clampInt(settings.buttonRadius, DEFAULT_APP_SETTINGS.buttonRadius, 0, 40),
        uiDensity: normalizeDensity(settings.uiDensity, DEFAULT_APP_SETTINGS.uiDensity),
        productGridColumns: clampInt(settings.productGridColumns, DEFAULT_APP_SETTINGS.productGridColumns, 2, 4),
        productCardAspectRatio: clampFloat(
          settings.productCardAspectRatio,
          DEFAULT_APP_SETTINGS.productCardAspectRatio,
          0.5,
          1.2
        ),
        productShowDiscountBadge:
          settings.productShowDiscountBadge ?? DEFAULT_APP_SETTINGS.productShowDiscountBadge,
        productShowCategoryLabel:
          settings.productShowCategoryLabel ?? DEFAULT_APP_SETTINGS.productShowCategoryLabel,
        showPromoTab: settings.showPromoTab ?? DEFAULT_APP_SETTINGS.showPromoTab,
        promoOrbLabel: settings.promoOrbLabel || DEFAULT_APP_SETTINGS.promoOrbLabel,
        navHomeLabel: settings.navHomeLabel || DEFAULT_APP_SETTINGS.navHomeLabel,
        navCategoriesLabel: settings.navCategoriesLabel || DEFAULT_APP_SETTINGS.navCategoriesLabel,
        navTopPicksLabel: settings.navTopPicksLabel || DEFAULT_APP_SETTINGS.navTopPicksLabel,
        walletEnabled: settings.walletEnabled ?? DEFAULT_APP_SETTINGS.walletEnabled,
        cashbackPercent: clampFloat(settings.cashbackPercent, DEFAULT_APP_SETTINGS.cashbackPercent, 0, 100),
        cashbackMaxAmount: normalizeOptionalAmount(settings.cashbackMaxAmount),
        walletMaxPercentPerOrder: clampFloat(
          settings.walletMaxPercentPerOrder,
          DEFAULT_APP_SETTINGS.walletMaxPercentPerOrder,
          0,
          100
        ),
        walletMaxAmountPerOrder: normalizeOptionalAmount(settings.walletMaxAmountPerOrder),
        checkoutMinPayable: clampFloat(
          settings.checkoutMinPayable,
          DEFAULT_APP_SETTINGS.checkoutMinPayable,
          0,
          1_000_000
        ),
        checkoutMinOrderAmount: clampFloat(
          settings.checkoutMinOrderAmount,
          DEFAULT_APP_SETTINGS.checkoutMinOrderAmount,
          0,
          1_000_000
        ),
        freeDeliveryMinAmount: clampFloat(
          settings.freeDeliveryMinAmount,
          DEFAULT_APP_SETTINGS.freeDeliveryMinAmount,
          0,
          1_000_000
        ),
        deliveryFeeAmount: clampFloat(
          settings.deliveryFeeAmount,
          DEFAULT_APP_SETTINGS.deliveryFeeAmount,
          0,
          1_000_000
        ),
        deliverySlots: normalizeDeliverySlots(settings.deliverySlots),
        ...normalizeScheduleDays(
          settings.scheduleDayCount,
          settings.scheduleMaxDaysAhead
        ),
      }
    })
  } catch (error) {
    if (isMissingAppSettingsTableError(error)) {
      return DEFAULT_APP_SETTINGS
    }

    console.error('Error loading app settings, falling back to defaults:', error)
    return DEFAULT_APP_SETTINGS
  }
}
