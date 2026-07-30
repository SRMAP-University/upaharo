import { STORE_HEADER } from '@/lib/store-constants'

/**
 * CDN / proxy cache keys must include the storefront header or grocery clients
 * receive gifts payloads (and vice versa). Use standard Vary only.
 */
export function storeAwareJsonHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    Vary: STORE_HEADER,
    ...extra,
  }
}

export function storeAwarePublicCacheHeaders(options: {
  sMaxAge: number
  staleWhileRevalidate: number
  queryVary?: string
}): Record<string, string> {
  const { sMaxAge, staleWhileRevalidate, queryVary } = options
  const cacheControl = `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  const vary = queryVary ? `${STORE_HEADER}, ${queryVary}` : STORE_HEADER

  return {
    Vary: vary,
    'Cache-Control': cacheControl,
  }
}
