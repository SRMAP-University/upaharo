import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/request-auth'

/**
 * Proxies an image URL so the admin color picker can read pixels
 * without browser CORS blocking (e.g. ibb.co, CDN images).
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('url')?.trim()
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only http(s) URLs allowed' }, { status: 400 })
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: { Accept: 'image/*' },
      next: { revalidate: 3600 },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream failed (${upstream.status})` },
        { status: 502 }
      )
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL is not an image' }, { status: 400 })
    }

    const buffer = await upstream.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        // Allow canvas read in the admin UI.
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('image-proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
