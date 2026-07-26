import {
  clampFloat,
  clampInt,
  DEFAULT_APP_SETTINGS,
  normalizeDensity,
  normalizeHexColor,
  normalizeHomeSections,
  type PublicAppSettings,
} from '@/lib/app-settings-schema'
import { prisma } from '@/lib/prisma'
import { isMissingAppSettingsTableError } from '@/lib/product-db'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'

export * from '@/lib/app-settings-schema'

export async function getAppSettings(): Promise<PublicAppSettings> {
  try {
    return await getOrSetJson(REDIS_KEYS.APP_SETTINGS, 300, async () => {
      const settings = await prisma.appSettings.findUnique({
        where: { id: 'default' },
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
        homepageShowTopCategories: settings.homepageShowTopCategories ?? DEFAULT_APP_SETTINGS.homepageShowTopCategories,
        homepageShowCategorySections:
          settings.homepageShowCategorySections ?? DEFAULT_APP_SETTINGS.homepageShowCategorySections,
        homepageShowOccasionTabs: settings.homepageShowOccasionTabs ?? DEFAULT_APP_SETTINGS.homepageShowOccasionTabs,
        homepageShowRecommendations:
          settings.homepageShowRecommendations ?? DEFAULT_APP_SETTINGS.homepageShowRecommendations,
        homepageShowValueDeals:
          settings.homepageShowValueDeals ?? DEFAULT_APP_SETTINGS.homepageShowValueDeals,
        homepageShowSpinBanner:
          settings.homepageShowSpinBanner ?? DEFAULT_APP_SETTINGS.homepageShowSpinBanner,
        homepageRecommendationMode:
          settings.homepageRecommendationMode || DEFAULT_APP_SETTINGS.homepageRecommendationMode,
        homepageRecommendationTitle:
          settings.homepageRecommendationTitle || DEFAULT_APP_SETTINGS.homepageRecommendationTitle,
        homeSectionLayout: normalizeHomeSections(settings.homeSectionLayout),
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
