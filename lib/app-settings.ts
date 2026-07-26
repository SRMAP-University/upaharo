import { prisma } from '@/lib/prisma'
import { isMissingAppSettingsTableError } from '@/lib/product-db'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'

export type PublicAppSettings = {
  siteName: string
  supportPhone: string
  supportEmail: string
  supportHours: string
  supportMessage: string
  deliveryEstimate: string
  deliveryNote: string
  announcementText: string
  storeAddress: string
  mapLatitude: number
  mapLongitude: number
  homepageShowBanner: boolean
  homepageShowTopCategories: boolean
  homepageShowCategorySections: boolean
  homepageShowOccasionTabs: boolean
  homepageShowRecommendations: boolean
  homepageShowValueDeals: boolean
  homepageRecommendationMode: string
  homepageRecommendationTitle: string
  brandPrimary: string
  brandSecondary: string
  headerWash: string
  pageBackground: string
}

export const DEFAULT_APP_SETTINGS: PublicAppSettings = {
  siteName: 'Upaharo',
  supportPhone: '',
  supportEmail: '',
  supportHours: '9:00 AM - 9:00 PM',
  supportMessage: 'Need help with your order? Our team is available during support hours.',
  deliveryEstimate: 'Estimated delivery: 20-30 minutes',
  deliveryNote: 'Delivery timings may vary depending on location and order volume.',
  announcementText: 'Same day gifting with live support and doorstep delivery.',
  storeAddress: '',
  mapLatitude: 27.7172,
  mapLongitude: 85.324,
  homepageShowBanner: true,
  homepageShowTopCategories: true,
  homepageShowCategorySections: true,
  homepageShowOccasionTabs: true,
  homepageShowRecommendations: true,
  homepageShowValueDeals: true,
  homepageRecommendationMode: 'LATEST',
  homepageRecommendationTitle: 'Latest Arrivals',
  brandPrimary: '#8B5A2B',
  brandSecondary: '#D4AF37',
  headerWash: '#F7F0E8',
  pageBackground: '#FFFFFF',
}

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6})$/

/** Normalize and validate `#RRGGBB`; falls back when invalid/missing. */
export function normalizeHexColor(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim()
  if (HEX_COLOR_RE.test(raw)) {
    return raw.toUpperCase()
  }
  return fallback
}

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
        homepageRecommendationMode:
          settings.homepageRecommendationMode || DEFAULT_APP_SETTINGS.homepageRecommendationMode,
        homepageRecommendationTitle:
          settings.homepageRecommendationTitle || DEFAULT_APP_SETTINGS.homepageRecommendationTitle,
        brandPrimary: normalizeHexColor(settings.brandPrimary, DEFAULT_APP_SETTINGS.brandPrimary),
        brandSecondary: normalizeHexColor(settings.brandSecondary, DEFAULT_APP_SETTINGS.brandSecondary),
        headerWash: normalizeHexColor(settings.headerWash, DEFAULT_APP_SETTINGS.headerWash),
        pageBackground: normalizeHexColor(settings.pageBackground, DEFAULT_APP_SETTINGS.pageBackground),
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
