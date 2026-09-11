const PERSONALIZATION_COOKIE = 'upaharo_personalization'
const VIEWED_CATEGORIES_KEY = 'upaharo-viewed-categories'
const MAX_VIEWED_CATEGORIES = 20

function isBrowser() {
  return typeof window === 'object'
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function readCookie(name: string) {
  if (!isBrowser()) return null

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

function writeCookie(name: string, value: string, days: number) {
  if (!isBrowser()) return

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function getPersonalizationConsent(): 'accepted' | 'declined' | 'unset' {
  const value = readCookie(PERSONALIZATION_COOKIE)
  if (value === 'accepted' || value === 'declined') {
    return value
  }
  return 'unset'
}

export function hasPersonalizationConsent() {
  return true
}

export function setPersonalizationConsent(value: 'accepted' | 'declined') {
  writeCookie(PERSONALIZATION_COOKIE, value, 180)

  if (value === 'declined' && isBrowser()) {
    window.localStorage.removeItem(VIEWED_CATEGORIES_KEY)
  }
}

export function getRecentViewedCategories() {
  if (!isBrowser() || !hasPersonalizationConsent()) {
    return []
  }

  const raw = window.localStorage.getItem(VIEWED_CATEGORIES_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return uniqueValues(Array.isArray(parsed) ? parsed.map((value) => String(value || '')) : [])
  } catch {
    return []
  }
}

export function rememberViewedCategory(category: string) {
  if (!isBrowser() || !hasPersonalizationConsent()) {
    return []
  }

  const nextCategories = uniqueValues([category, ...getRecentViewedCategories()]).slice(0, MAX_VIEWED_CATEGORIES)
  window.localStorage.setItem(VIEWED_CATEGORIES_KEY, JSON.stringify(nextCategories))
  return nextCategories
}
