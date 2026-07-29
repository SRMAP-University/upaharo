import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { STORE_HEADER } from '@/lib/store-constants'

/**
 * Storefront APIs use X-Store for tenant selection. Make the header part of
 * every API cache key so a CDN can never serve gifts content to grocery (or
 * the reverse). This only changes variation; it does not enable caching for
 * endpoints that do not already opt into cache headers.
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next()
  response.headers.append('Vary', STORE_HEADER)
  response.headers.set('Netlify-Vary', `header=${STORE_HEADER}`)
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
