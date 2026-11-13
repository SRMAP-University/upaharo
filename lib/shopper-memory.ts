import { getRecentViewedCategories, hasPersonalizationConsent } from '@/lib/personalization-consent'
import { getRecentSearches, getRecentViewedProductIds } from '@/lib/recommendation-session'

/**
 * The shopper's recent activity on this device, for the shop assistant:
 * product clicks and views, categories, searches (kept by the existing
 * helpers) and cart adds (kept here). Nothing leaves the device until the
 * assistant asks for picks.
 */

const CART_ADDS_KEY = 'ck-cart-adds'
const MEMORY_KEYS = ['ck-viewed-products', 'upaharo-viewed-categories', 'ck-recent-searches', CART_ADDS_KEY]
export const MEMORY_EVENT = 'upaharo-memory'

const isBrowser = () => typeof window === 'object'

function announce() {
  if (isBrowser()) window.dispatchEvent(new Event(MEMORY_EVENT))
}

function readList(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.map((v) => String(v || '')).filter(Boolean) : []
  } catch {
    return []
  }
}

export function rememberCartAdd(productId: string) {
  if (!isBrowser() || !hasPersonalizationConsent() || !productId) return
  try {
    const next = [productId, ...readList(CART_ADDS_KEY).filter((id) => id !== productId)].slice(0, 20)
    window.localStorage.setItem(CART_ADDS_KEY, JSON.stringify(next))
    announce()
  } catch {
    // storage blocked: the assistant just knows less
  }
}

/** Call after the other helpers save something, so an open assistant can refresh. */
export function memoryChanged() {
  announce()
}

export function getShopperSignals() {
  if (!isBrowser()) return { viewed: [], categories: [], searches: [], cartAdds: [] }
  try {
    return {
      viewed: getRecentViewedProductIds().slice(0, 30),
      categories: getRecentViewedCategories().slice(0, 12),
      searches: getRecentSearches().slice(0, 10),
      cartAdds: readList(CART_ADDS_KEY),
    }
  } catch {
    return { viewed: [], categories: [], searches: [], cartAdds: [] }
  }
}

export function hasShopperHistory() {
  const s = getShopperSignals()
  return s.viewed.length + s.categories.length + s.searches.length + s.cartAdds.length > 0
}

export function clearShopperMemory() {
  if (!isBrowser()) return
  try {
    for (const key of MEMORY_KEYS) window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
  announce()
}
