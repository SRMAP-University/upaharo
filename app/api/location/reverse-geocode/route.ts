import { NextRequest, NextResponse } from 'next/server'
import {
  mapNominatimResult,
  nominatimHeaders,
  type NominatimParsedAddress,
} from '@/lib/nominatim'

type ParsedAddress = NominatimParsedAddress

type GeocodeResult = {
  address: string
  parsed: ParsedAddress
  source: 'google' | 'nominatim'
}

function emptyParsed(): ParsedAddress {
  return {
    street: '',
    area: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
  }
}

function parseGoogleResult(result: any): GeocodeResult {
  const addressComponents = result.address_components || []
  const parsed: Record<string, string> = {}

  addressComponents.forEach((component: any) => {
    const types = component.types
    if (types.includes('establishment')) {
      parsed.establishment = component.long_name
    }
    if (types.includes('point_of_interest')) {
      parsed.pointOfInterest = component.long_name
    }
    if (types.includes('subpremise')) {
      parsed.subpremise = component.long_name
    }
    if (types.includes('premise')) {
      parsed.premise = component.long_name
    }
    if (types.includes('street_number')) {
      parsed.streetNumber = component.long_name
    }
    if (types.includes('route')) {
      parsed.route = component.long_name
    }
    if (types.includes('sublocality_level_3')) {
      parsed.sublocality3 = component.long_name
    }
    if (types.includes('sublocality_level_2')) {
      parsed.sublocality2 = component.long_name
    }
    if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
      parsed.sublocality = component.long_name
    }
    if (types.includes('neighborhood')) {
      parsed.neighborhood = component.long_name
    }
    if (types.includes('locality')) {
      parsed.city = component.long_name
    }
    if (types.includes('administrative_area_level_2')) {
      parsed.district = component.long_name
    }
    if (types.includes('administrative_area_level_1')) {
      parsed.state = component.long_name
    }
    if (types.includes('country')) {
      parsed.country = component.long_name
    }
    if (types.includes('postal_code')) {
      parsed.pincode = component.long_name
    }
  })

  const streetParts = []
  if (parsed.subpremise) streetParts.push(parsed.subpremise)
  if (parsed.premise) streetParts.push(parsed.premise)
  if (parsed.streetNumber) streetParts.push(parsed.streetNumber)
  if (parsed.route) streetParts.push(parsed.route)
  if (parsed.sublocality3) streetParts.push(parsed.sublocality3)
  if (parsed.sublocality2) streetParts.push(parsed.sublocality2)
  if (parsed.sublocality) streetParts.push(parsed.sublocality)

  const detailedStreet =
    streetParts.join(', ') || result.formatted_address?.split(',')[0] || ''
  const area =
    parsed.sublocality3 ||
    parsed.sublocality2 ||
    parsed.sublocality ||
    parsed.neighborhood ||
    parsed.route ||
    ''
  const landmark =
    parsed.establishment ||
    parsed.pointOfInterest ||
    parsed.premise ||
    parsed.neighborhood ||
    area ||
    ''

  return {
    address: result.formatted_address || detailedStreet,
    source: 'google',
    parsed: {
      street: detailedStreet,
      area,
      landmark,
      city: parsed.city || parsed.district || '',
      state: parsed.state || '',
      pincode: parsed.pincode || '',
      country: parsed.country || '',
    },
  }
}

async function reverseGeocodeGoogle(
  lat: string,
  lng: string,
  apiKey: string
): Promise<{ result: GeocodeResult | null; status?: string; errorMessage?: string }> {
  const preciseUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  preciseUrl.searchParams.set('latlng', `${lat},${lng}`)
  preciseUrl.searchParams.set('key', apiKey)
  preciseUrl.searchParams.set('result_type', 'street_address|premise|subpremise|route')
  preciseUrl.searchParams.set('location_type', 'ROOFTOP|RANGE_INTERPOLATED')
  preciseUrl.searchParams.set('region', 'np')
  preciseUrl.searchParams.set('language', 'en')

  const response = await fetch(preciseUrl.toString(), { cache: 'no-store' })
  const data = await response.json()

  let result = data.results?.[0]
  let currentStatus = data?.status
  let currentErrorMessage = data?.error_message

  if (!result) {
    const fallbackUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    fallbackUrl.searchParams.set('latlng', `${lat},${lng}`)
    fallbackUrl.searchParams.set('key', apiKey)
    fallbackUrl.searchParams.set('region', 'np')
    fallbackUrl.searchParams.set('language', 'en')

    const fallbackResponse = await fetch(fallbackUrl.toString(), { cache: 'no-store' })
    const fallbackData = await fallbackResponse.json()
    result = fallbackData.results?.[0]
    currentStatus = fallbackData?.status ?? currentStatus
    currentErrorMessage = fallbackData?.error_message ?? currentErrorMessage
  }

  if (!result) {
    return {
      result: null,
      status: currentStatus || 'UNKNOWN_ERROR',
      errorMessage: currentErrorMessage,
    }
  }

  return { result: parseGoogleResult(result), status: currentStatus }
}

async function reverseGeocodeNominatim(
  lat: string,
  lng: string
): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', lat)
  url.searchParams.set('lon', lng)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('zoom', '18')
  url.searchParams.set('accept-language', 'en')

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: nominatimHeaders(),
  })

  if (!response.ok) return null

  const data = await response.json()
  const mapped = mapNominatimResult(data)
  if (!mapped) return null

  return {
    address: mapped.address,
    source: 'nominatim',
    parsed: mapped.parsed,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    const apiKey =
      process.env.GOOGLE_GEOCODING_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    let googleStatus: string | undefined
    let googleErrorMessage: string | undefined
    let resolved: GeocodeResult | null = null

    if (apiKey) {
      const google = await reverseGeocodeGoogle(lat, lng, apiKey)
      resolved = google.result
      googleStatus = google.status
      googleErrorMessage = google.errorMessage
    } else {
      googleStatus = 'NO_API_KEY'
    }

    if (!resolved) {
      resolved = await reverseGeocodeNominatim(lat, lng)
    }

    if (!resolved) {
      return NextResponse.json({
        address: '',
        parsed: emptyParsed(),
        details: {
          googleStatus: googleStatus || 'UNKNOWN_ERROR',
          googleErrorMessage,
          lat,
          lng,
        },
      })
    }

    return NextResponse.json({
      address: resolved.address,
      parsed: resolved.parsed,
      details: {
        source: resolved.source,
        googleStatus,
        googleErrorMessage,
        lat,
        lng,
      },
    })
  } catch (error) {
    console.error('Error reverse geocoding:', error)
    return NextResponse.json({ error: 'Failed to get address' }, { status: 500 })
  }
}
