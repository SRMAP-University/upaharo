import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Storefront APIs use X-Store for tenant selection. Make the header part of
 * every API cache key so a CDN can never serve gifts content to grocery (or
 * the reverse). This only changes variation; it does not enable caching for
 * endpoints that do not already opt into cache headers.
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next()
  response.headers.append('Vary', 'X-Store')
  response.headers.set('Netlify-Vary', 'header=X-Store')
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
