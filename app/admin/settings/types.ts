import { DEFAULT_HOME_SECTIONS, type HomeSectionConfig } from '@/lib/app-settings-schema'

/** Form mirror of PublicAppSettings; lat/lng stay strings while typing. */
export type SettingsForm = {
  siteName: string
  supportPhone: string
  supportEmail: string
  supportHours: string
  supportMessage: string
  deliveryEstimate: string
  deliveryNote: string
  announcementText: string
  storeAddress: string
  mapLatitude: string
  mapLongitude: string
  homepageShowBanner: boolean
  homepageBannerHeight: number
  homepageBannerProductHeight: number
  homepageShowTopCategories: boolean
  homepageShowCategorySections: boolean
  homepageShowOccasionTabs: boolean
  homepageShowRecommendations: boolean
  homepageShowValueDeals: boolean
  homepageShowSpinBanner: boolean
  homepageRecommendationMode: string
  homepageRecommendationTitle: string
  homeSectionLayout: HomeSectionConfig[]
  brandPrimary: string
  brandSecondary: string
  headerWash: string
  pageBackground: string
  textInk: string
  textMuted: string
  surfaceSoft: string
  cardBackground: string
  cornerRadius: number
  buttonRadius: number
  uiDensity: string
  productGridColumns: number
  productCardAspectRatio: number
  productShowDiscountBadge: boolean
  productShowCategoryLabel: boolean
  showPromoTab: boolean
  promoOrbLabel: string
  navHomeLabel: string
  navCategoriesLabel: string
  navTopPicksLabel: string
  walletEnabled: boolean
  cashbackPercent: number
  /** Blank means "no cap". */
  cashbackMaxAmount: string
  walletMaxPercentPerOrder: number
  /** Blank means "no cap". */
  walletMaxAmountPerOrder: string
  checkoutMinPayable: number
  checkoutMinOrderAmount: number
  freeDeliveryMinAmount: number
  deliveryFeeAmount: number
}

export const EMPTY_FORM: SettingsForm = {
  siteName: '',
  supportPhone: '',
  supportEmail: '',
  supportHours: '',
  supportMessage: '',
  deliveryEstimate: '',
  deliveryNote: '',
  announcementText: '',
  storeAddress: '',
  mapLatitude: '',
  mapLongitude: '',
  homepageShowBanner: true,
  homepageBannerHeight: 320,
  homepageBannerProductHeight: 112,
  homepageShowTopCategories: true,
  homepageShowCategorySections: true,
  homepageShowOccasionTabs: true,
  homepageShowRecommendations: true,
  homepageShowValueDeals: true,
  homepageShowSpinBanner: true,
  homepageRecommendationMode: 'LATEST',
  homepageRecommendationTitle: '',
  homeSectionLayout: DEFAULT_HOME_SECTIONS,
  brandPrimary: '#8B5A2B',
  brandSecondary: '#D4AF37',
  headerWash: '#F7F0E8',
  pageBackground: '#FFFFFF',
  textInk: '#1F1F1F',
  textMuted: '#3E3E3E',
  surfaceSoft: '#F4F4F5',
  cardBackground: '#FFFFFF',
  cornerRadius: 12,
  buttonRadius: 30,
  uiDensity: 'COMFORTABLE',
  productGridColumns: 2,
  productCardAspectRatio: 0.68,
  productShowDiscountBadge: true,
  productShowCategoryLabel: false,
  showPromoTab: true,
  promoOrbLabel: '20% OFF',
  navHomeLabel: 'Home',
  navCategoriesLabel: 'Categories',
  navTopPicksLabel: 'Top picks',
  walletEnabled: false,
  cashbackPercent: 0,
  cashbackMaxAmount: '',
  walletMaxPercentPerOrder: 100,
  walletMaxAmountPerOrder: '',
  checkoutMinPayable: 0,
  checkoutMinOrderAmount: 0,
  freeDeliveryMinAmount: 199,
  deliveryFeeAmount: 40,
}

export const INPUT_CLASS =
  'w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

export const CHECKBOX_CLASS = 'h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30'
