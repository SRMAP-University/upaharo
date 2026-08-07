import { NextRequest, NextResponse } from 'next/server'
import { mapNominatimResult, nominatimHeaders } from '@/lib/nominatim'

/**
 * Forward place search via OpenStreetMap Nominatim.
 * Used by the website location picker (same address details as reverse geocode).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('countrycodes', 'np')
    url.searchParams.set('limit', '8')
    url.searchParams.set('accept-language', 'en')

    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: nominatimHeaders(),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Place search failed', results: [] },
        { status: 502 }
      )
    }

    const data = await response.json()
    const items = Array.isArray(data) ? data : []
    const results = items
      .map((item) => mapNominatimResult(item))
      .filter(Boolean)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error searching places:', error)
    return NextResponse.json(
      { error: 'Failed to search places', results: [] },
      { status: 500 }
    )
  }
}
