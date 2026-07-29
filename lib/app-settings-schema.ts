/**
 * Pure app-settings shape, defaults and normalizers.
 *
 * Keep this file free of server-only imports (prisma, redis) so admin client
 * components can share the same types and defaults.
 */

/** Mobile home sections that can be reordered / renamed from admin. */
export const HOME_SECTION_IDS = [
  'spinBanner',
  'valueDeals',
  'miniBanners',
  'quickPicks',
  'productGrid',
] as const

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
  { id: 'miniBanners', title: 'Featured', subtitle: '', visible: true },
  { id: 'quickPicks', title: 'Quick picks', subtitle: '', visible: true },
  { id: 'productGrid', title: 'All gifts', subtitle: '', visible: true },
]

/** One bookable scheduled-delivery window, in store-local (Nepal) hours. */
export type DeliverySlotConfig = {
  /** Stable key derived from the hours, e.g. `12-15`. */
  id: string
  startHour: number
  endHour: number
  label: string
}

export const DEFAULT_DELIVERY_SLOTS: DeliverySlotConfig[] = [
  { id: '10-12', startHour: 10, endHour: 12, label: '10 AM – 12 PM' },
  { id: '12-15', startHour: 12, endHour: 15, label: '12 – 3 PM' },
  { id: '15-18', startHour: 15, endHour: 18, label: '3 – 6 PM' },
  { id: '18-21', startHour: 18, endHour: 21, label: '6 – 9 PM' },
]

/** Upper bound on the quick day chips shown in the checkout picker. */
export const MAX_SCHEDULE_DAY_COUNT = 14
/** Hard ceiling on how far ahead a custom date may be booked. */
export const MAX_SCHEDULE_DAYS_AHEAD = 90
export const MAX_DELIVERY_SLOTS = 8

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
  featureGiftOptions: boolean
  featureAiAssistant: boolean
  featureWishlist: boolean
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
  /** Bookable scheduled-delivery windows. Empty disables scheduling. */
  deliverySlots: DeliverySlotConfig[]
  /** Quick day chips offered in the picker, including today. */
  scheduleDayCount: number
  /** Furthest day bookable via the custom date picker. */
  scheduleMaxDaysAhead: number
  /** Mini banner tiles visible per row (1-4); sets each tile's width. */
  miniBannerColumns: number
  /** Mini banner tile height in logical pixels. */
  miniBannerHeight: number
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
  featureGiftOptions: true,
  featureAiAssistant: true,
  featureWishlist: true,
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
  deliverySlots: DEFAULT_DELIVERY_SLOTS,
  scheduleDayCount: 3,
  scheduleMaxDaysAhead: 30,
  miniBannerColumns: 3,
  miniBannerHeight: 96,
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
 * Accept a stored layout array, keeping only known section ids and slotting in
 * any sections added by a later release so new features are never hidden.
 *
 * A new section is inserted at its default position rather than appended, so a
 * layout saved before the release doesn't bury it below the product grid.
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
  DEFAULT_HOME_SECTIONS.forEach((fallback, defaultIndex) => {
    if (seen.has(fallback.id)) return
    ordered.splice(Math.min(defaultIndex, ordered.length), 0, { ...fallback })
  })
  return ordered
}

function hour12(hour: number): number {
  const value = hour % 24 % 12
  return value === 0 ? 12 : value
}

function meridiemOf(hour: number): 'AM' | 'PM' {
  return hour % 24 < 12 ? 'AM' : 'PM'
}

/** "10 AM – 12 PM" across meridiems, "12 – 3 PM" within one. */
export function formatSlotLabel(startHour: number, endHour: number): string {
  const start = meridiemOf(startHour)
  const end = meridiemOf(endHour)
  return start === end
    ? `${hour12(startHour)} – ${hour12(endHour)} ${end}`
    : `${hour12(startHour)} ${start} – ${hour12(endHour)} ${end}`
}

export function slotIdFor(startHour: number, endHour: number): string {
  return `${startHour}-${endHour}`
}

/**
 * Validate stored delivery windows. Slots are keyed by start hour because that
 * is what the server matches an incoming `scheduledFor` against, so duplicate
 * starts are dropped rather than merged.
 *
 * A missing value (never configured) falls back to the defaults; an explicit
 * empty array is respected and turns scheduled delivery off.
 */
export function normalizeDeliverySlots(raw: unknown): DeliverySlotConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_DELIVERY_SLOTS.map((slot) => ({ ...slot }))

  const slots: DeliverySlotConfig[] = []
  const seenStarts = new Set<number>()

  for (const item of raw) {
    const entry = (item ?? {}) as Record<string, unknown>
    const startHour = clampInt(entry.startHour, -1, 0, 23)
    const endHour = clampInt(entry.endHour, -1, 1, 24)

    if (startHour < 0 || endHour <= startHour) continue
    if (seenStarts.has(startHour)) continue
    seenStarts.add(startHour)

    const label = String(entry.label ?? '').trim()
    slots.push({
      id: slotIdFor(startHour, endHour),
      startHour,
      endHour,
      label: label || formatSlotLabel(startHour, endHour),
    })

    if (slots.length >= MAX_DELIVERY_SLOTS) break
  }

  return slots.sort((a, b) => a.startHour - b.startHour)
}

/**
 * Quick-chip count and the custom-date ceiling, kept consistent: the ceiling
 * can never sit below the chips, otherwise a visible chip would be rejected.
 */
export function normalizeScheduleDays(dayCountRaw: unknown, maxDaysRaw: unknown) {
  const scheduleDayCount = clampInt(
    dayCountRaw,
    DEFAULT_APP_SETTINGS.scheduleDayCount,
    1,
    MAX_SCHEDULE_DAY_COUNT
  )
  const maxDaysAhead = clampInt(
    maxDaysRaw,
    DEFAULT_APP_SETTINGS.scheduleMaxDaysAhead,
    1,
    MAX_SCHEDULE_DAYS_AHEAD
  )
  return {
    scheduleDayCount,
    scheduleMaxDaysAhead: Math.max(scheduleDayCount, maxDaysAhead),
  }
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
