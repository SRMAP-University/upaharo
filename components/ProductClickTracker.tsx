'use client'

import { useEffect } from 'react'
import { trackProductEvent } from '@/lib/product-events'

/**
 * Counts a "click" whenever a shopper opens a product from anywhere on the
 * site (cards, banners, the helper, recommendations, cart), for the product
 * stats. One listener for the whole page instead of one per link.
 */
export default function ProductClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 && event.button !== 1) return
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link) return
      let url: URL
      try {
        url = new URL(link.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      const match = url.pathname.match(/^\/products\/([^/]+)\/?$/)
      if (!match) return
      // Opening the same product's own page again is not a click from a list.
      if (window.location.pathname === url.pathname) return
      trackProductEvent(decodeURIComponent(match[1]), 'click')
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('auxclick', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('auxclick', onClick, true)
    }
  }, [])
  return null
}
