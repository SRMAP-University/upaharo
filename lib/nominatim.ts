/** Shared Nominatim (OpenStreetMap) helpers for reverse + forward geocoding. */

export type NominatimParsedAddress = {
  street: string
  area: string
  landmark: string
  city: string
  state: string
  pincode: string
  country: string
}

export type NominatimPlace = {
  address: string
  lat: number
  lng: number
  parsed: NominatimParsedAddress
}

const NOMINATIM_UA = 'UpaharoDelivery/1.0 (support@upaharo.com)'

export function nominatimHeaders(): HeadersInit {
  return {
    'User-Agent': NOMINATIM_UA,
    Accept: 'application/json',
    'Accept-Language': 'en',
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export function parseNominatimAddress(
  address: Record<string, unknown> | null | undefined,
  displayName?: string | null
): NominatimParsedAddress {
  const a = address || {}
  const str = (key: string) =>
    typeof a[key] === 'string' ? (a[key] as string) : ''

  const road = firstNonEmpty(str('road'), str('pedestrian'), str('path'), str('residential'))
  const neighbourhood = firstNonEmpty(
    str('neighbourhood'),
    str('suburb'),
    str('quarter'),
    str('city_district')
  )
  const city = firstNonEmpty(
    str('city'),
    str('town'),
    str('municipality'),
    str('village'),
    str('county')
  )
  const state = firstNonEmpty(str('state'), str('region'))
  const pincode = firstNonEmpty(str('postcode'))
  const country = firstNonEmpty(str('country'))
  const house = firstNonEmpty([str('house_number'), str('building')].filter(Boolean).join(' '))
  const streetParts = [house, road, neighbourhood].filter(Boolean)
  const detailedStreet = streetParts.join(', ')
  const landmark = firstNonEmpty(
    str('amenity'),
    str('shop'),
    str('tourism'),
    str('name'),
    neighbourhood
  )

  return {
    street: detailedStreet || displayName?.split(',')[0]?.trim() || '',
    area: neighbourhood || road || '',
    landmark,
    city,
    state,
    pincode,
    country,
  }
}

export function mapNominatimResult(item: {
  display_name?: string
  lat?: string | number
  lon?: string | number
  address?: Record<string, unknown>
}): NominatimPlace | null {
  const lat = Number(item.lat)
  const lng = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const displayName = item.display_name?.trim() || ''
  const parsed = parseNominatimAddress(item.address, displayName)
  const address =
    displayName ||
    [parsed.street, parsed.city, parsed.state, parsed.pincode].filter(Boolean).join(', ')

  if (!address) return null

  return { address, lat, lng, parsed }
}
