import { hasPersonalizationConsent } from '@/lib/personalization-consent'

const SESSION_KEY = 'ck-recommendation-session'
const VIEWED_PRODUCTS_KEY = 'ck-viewed-products'
const MAX_VIEWED_PRODUCTS = 30

function isBrowser() {
  return typeof window === 'object'
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
}

export function getOrCreateRecommendationSessionId() {
  if (isBrowser() === false) {
    return ''
  }

  if (!hasPersonalizationConsent()) {
    return ''
  }

  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) {
    return existing
  }

  const hasRandomUuid = typeof globalThis.crypto === 'object' && typeof globalThis.crypto.randomUUID === 'function'
  const nextId = hasRandomUuid
    ? globalThis.crypto.randomUUID()
    : 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)

  window.localStorage.setItem(SESSION_KEY, nextId)
  return nextId
}

export function getRecentViewedProductIds() {
  if (isBrowser() === false || !hasPersonalizationConsent()) {
    return []
  }

  const raw = window.localStorage.getItem(VIEWED_PRODUCTS_KEY)
  if (raw === null) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return uniqueIds(Array.isArray(parsed) ? parsed.map((value) => String(value || '')) : [])
  } catch {
    return []
  }
}

export function rememberViewedProduct(productId: string) {
  if (!hasPersonalizationConsent()) {
    return []
  }

  const nextIds = uniqueIds([productId, ...getRecentViewedProductIds()]).slice(0, MAX_VIEWED_PRODUCTS)

  if (isBrowser()) {
    window.localStorage.setItem(VIEWED_PRODUCTS_KEY, JSON.stringify(nextIds))
  }

  return nextIds
}

const RECENT_SEARCHES_KEY = 'ck-recent-searches'
const MAX_RECENT_SEARCHES = 10

/** Recent search phrases on this device, newest first (personalises the home feed). */
export function getRecentSearches() {
  if (isBrowser() === false || !hasPersonalizationConsent()) {
    return []
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map((value) => String(value || '')).filter(Boolean) : []
  } catch {
    return []
  }
}

export function rememberSearch(query: string) {
  const phrase = query.trim().slice(0, 80)
  if (!phrase || isBrowser() === false || !hasPersonalizationConsent()) {
    return
  }
  const next = [phrase, ...getRecentSearches().filter((q) => q.toLowerCase() !== phrase.toLowerCase())].slice(
    0,
    MAX_RECENT_SEARCHES
  )
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
}
