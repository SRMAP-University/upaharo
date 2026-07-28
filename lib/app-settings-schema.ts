/**
 * Pure app-settings shape, defaults and normalizers.
 *
 * Keep this file free of server-only imports (prisma, redis) so admin client
 * components can share the same types and defaults.
 */

/** Mobile home sections that can be reordered / renamed from admin. */
export const HOME_SECTION_IDS = ['spinBanner', 'valueDeals', 'quickPicks', 'productGrid'] as const

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number]

export type HomeSectionConfig = {
  id: HomeSectionId
  title: string
  subtitle: string
  visible: boolean
}

/** Shipping order + copy for the mobile home feed. */
export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { id: 'spinBanner', title: 'Spin & Win', subtitle: 'Daily roulette · 5% to 30% off', visible: true },
  { id: 'valueDeals', title: 'Value', subtitle: 'DEALS', visible: true },
  { id: 'quickPicks', title: 'Quick picks', subtitle: '', visible: true },
  { id: 'productGrid', title: 'All gifts', subtitle: '', visible: true },
]

export const UI_DENSITIES = ['COMPACT', 'COMFORTABLE', 'SPACIOUS'] as const

/** Spacing multiplier the app applies for each density option. */
export const DENSITY_SCALE: Record<string, number> = {
  COMPACT: 0.85,
  COMFORTABLE: 1,
  SPACIOUS: 1.18,
}

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
  homepageBannerHeight: number
  homepageBannerProductHeight: number
  homepageShowTopCategories: boolean
  homepageShowCategorySections: boolean
  homepageShowOccasionTabs: boolean
  homepageShowRecommendations: boolean
  homepageShowValueDeals: boolean
  valueDealsProductIds: string[]
  valueDealsPromoText: string
  valueDealsUnlockAmount: number
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
  cashbackMaxAmount: number | null
  walletMaxPercentPerOrder: number
  walletMaxAmountPerOrder: number | null
  /** Remaining total after wallet cannot go below this (Rs). */
  checkoutMinPayable: number
  /** Minimum goods total (items + wrap) to place an order. 0 = no floor. */
  checkoutMinOrderAmount: number
  /** Free delivery when goods total is at or above this (Rs). */
  freeDeliveryMinAmount: number
  /** Delivery fee when below the free-delivery threshold (Rs). */
  deliveryFeeAmount: number
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
  homepageBannerHeight: 320,
  homepageBannerProductHeight: 112,
  homepageShowTopCategories: true,
  homepageShowCategorySections: true,
  homepageShowOccasionTabs: true,
  homepageShowRecommendations: true,
  homepageShowValueDeals: true,
  valueDealsProductIds: [],
  valueDealsPromoText: 'Shop for {amount} to unlock deals',
  valueDealsUnlockAmount: 199,
  homepageShowSpinBanner: true,
  homepageRecommendationMode: 'LATEST',
  homepageRecommendationTitle: 'Latest Arrivals',
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
  cashbackMaxAmount: null,
  walletMaxPercentPerOrder: 100,
  walletMaxAmountPerOrder: null,
  checkoutMinPayable: 0,
  checkoutMinOrderAmount: 0,
  freeDeliveryMinAmount: 199,
  deliveryFeeAmount: 40,
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

/** Clamp to an integer inside `[min, max]`, falling back when unparseable. */
export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/** Clamp to a float inside `[min, max]`, rounded to 2 decimals. */
export function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(max, Math.max(min, parsed))
  return Math.round(clamped * 100) / 100
}

/**
 * Optional money cap: blank/absent means "no cap" (null). Negative or
 * unparseable input also collapses to null so a bad value never blocks orders.
 */
export function normalizeOptionalAmount(value: unknown, max = 1_000_000): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(Math.min(parsed, max) * 100) / 100
}

export function normalizeDensity(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim().toUpperCase()
  return (UI_DENSITIES as readonly string[]).includes(raw) ? raw : fallback
}

/**
 * Accept a stored layout array, keeping only known section ids and appending
 * any sections added by a later release so new features are never hidden.
 */
export function normalizeHomeSections(raw: unknown): HomeSectionConfig[] {
  const seen = new Map<HomeSectionId, HomeSectionConfig>()

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const entry = (item ?? {}) as Record<string, unknown>
      const id = String(entry.id ?? '') as HomeSectionId
      const fallback = DEFAULT_HOME_SECTIONS.find((section) => section.id === id)
      if (!fallback || seen.has(id)) continue

      const title = String(entry.title ?? fallback.title).trim()
      seen.set(id, {
        id,
        title: title || fallback.title,
        subtitle: String(entry.subtitle ?? fallback.subtitle).trim(),
        visible: typeof entry.visible === 'boolean' ? entry.visible : fallback.visible,
      })
    }
  }

  const ordered = [...seen.values()]
  for (const fallback of DEFAULT_HOME_SECTIONS) {
    if (!seen.has(fallback.id)) ordered.push({ ...fallback })
  }
  return ordered
}

/** Deduped product ids for Value Deals; empty means “auto pick”. Cap at 40. */
export function normalizeValueDealsProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || ids.includes(id)) continue
    ids.push(id)
    if (ids.length >= 40) break
  }
  return ids
}
