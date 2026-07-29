const DEFAULT_LOCALE = 'en-NP'
export function formatPrice(
  price: number,
  options: Intl.NumberFormatOptions = {}
): string {
  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(price)

  return `Rs. ${formatted}`
}

export function formatPriceNoDecimals(price: number): string {
  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)

  return `Rs. ${formatted}`
}

export function formatDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(new Date(value))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

export function formatTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0))
  const minutesInDay = 24 * 60

  if (safeMinutes < 60) {
    return `${safeMinutes} min`
  }

  if (safeMinutes < minutesInDay) {
    const hours = Math.floor(safeMinutes / 60)
    const mins = safeMinutes % 60
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
  }

  const days = Math.floor(safeMinutes / minutesInDay)
  const remainingMinutes = safeMinutes % minutesInDay
  if (remainingMinutes === 0) {
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }

  const hours = Math.floor(remainingMinutes / 60)
  if (hours === 0) {
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }

  return `${days} ${days === 1 ? 'day' : 'days'} ${hours}h`
}

export function generateOrderNumber(storeSlug = 'gifts'): string {
  const storeCode =
    String(storeSlug)
      .trim()
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 6)
      .toUpperCase() || 'STORE'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${storeCode}-${timestamp}${random}`
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

export function isWithinDeliveryRadius(
  userLat: number,
  userLon: number,
  restaurantLat: number,
  restaurantLon: number,
  radiusKm: number = 5
): boolean {
  const distance = calculateDistance(userLat, userLon, restaurantLat, restaurantLon)
  return distance <= radiusKm * 1000
}
