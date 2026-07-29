import { STORE_HEADER } from '@/lib/store-constants'

/**
 * CDN cache keys must include the storefront header or grocery clients receive
 * gifts payloads (and vice versa). Routes that set their own Netlify-Vary must
 * still include header=X-Store — do not replace the middleware value.
 */
export function storeAwareJsonHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    Vary: STORE_HEADER,
    'Netlify-Vary': `header=${STORE_HEADER}`,
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
  const netlifyVary = queryVary
    ? `header=${STORE_HEADER}|query=${queryVary}`
    : `header=${STORE_HEADER}`

  return {
    Vary: STORE_HEADER,
    'Cache-Control': cacheControl,
    'Netlify-CDN-Cache-Control': cacheControl,
    'Netlify-Vary': netlifyVary,
  }
}
