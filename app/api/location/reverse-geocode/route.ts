import { NextRequest, NextResponse } from 'next/server'

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

    // Use a dedicated server-side key for the Geocoding API. The public
    // NEXT_PUBLIC_* key may have app/referrer restrictions that cause
    // REQUEST_DENIED when the server calls Google on the client's behalf.
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      )
    }

    // Reverse geocoding requires the Geocoding API. Start with a precise query,
    // then fall back to a broader one if Google has no exact rooftop match.
    const preciseUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    preciseUrl.searchParams.set('latlng', `${lat},${lng}`)
    preciseUrl.searchParams.set('key', apiKey)
    preciseUrl.searchParams.set('result_type', 'street_address|premise|subpremise|route')
    preciseUrl.searchParams.set('location_type', 'ROOFTOP|RANGE_INTERPOLATED')
    preciseUrl.searchParams.set('region', 'np')
    preciseUrl.searchParams.set('language', 'en')

    const response = await fetch(preciseUrl.toString(), { cache: 'no-store' })
    const data = await response.json()

    // If precise address not found, try again without filters
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
      return NextResponse.json({
        address: '',
        parsed: {
          street: '',
          area: '',
          landmark: '',
          city: '',
          state: '',
          pincode: '',
          country: '',
        },
        details: {
          googleStatus: currentStatus || 'UNKNOWN_ERROR',
          googleErrorMessage: currentErrorMessage,
          lat,
          lng,
        },
      })
    }

    // Parse address components for detailed address
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

    // Build detailed street address
    const streetParts = []
    if (parsed.subpremise) streetParts.push(parsed.subpremise)
    if (parsed.premise) streetParts.push(parsed.premise)
    if (parsed.streetNumber) streetParts.push(parsed.streetNumber)
    if (parsed.route) streetParts.push(parsed.route)
    if (parsed.sublocality3) streetParts.push(parsed.sublocality3)
    if (parsed.sublocality2) streetParts.push(parsed.sublocality2)
    if (parsed.sublocality) streetParts.push(parsed.sublocality)
    
    const detailedStreet = streetParts.join(', ') || result.formatted_address?.split(',')[0] || ''
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

    return NextResponse.json({ 
      address: result.formatted_address,
      fullResult: result,
      parsed: {
        street: detailedStreet,
        area,
        landmark,
        city: parsed.city || parsed.district || '',
        state: parsed.state || '',
        pincode: parsed.pincode || '',
        country: parsed.country || ''
      }
    })
  } catch (error) {
    console.error('Error reverse geocoding:', error)
    return NextResponse.json(
      { error: 'Failed to get address' },
      { status: 500 }
    )
  }
}
