/**
 * Records shopper actions for the product stats in admin and the seller
 * dashboard: a product opened from a list ("click") and added to cart.
 * (Product page views are recorded separately by /api/products/[id]/view.)
 *
 * Events wait a moment and go together, and are flushed with sendBeacon when
 * the page is left, so a click that opens a new page is not lost.
 */

export const PRODUCT_EVENT_TYPES = ['click', 'add_to_cart'] as const
export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number]

export const PRODUCT_EVENT_SOURCES = ['home', 'category', 'search', 'product', 'cart', 'wishlist', 'other'] as const

type Pending = { productId: string; type: ProductEventType; source: string; quantity: number }

let queue: Pending[] = []
let timer: number | null = null
let listening = false

/** Where on the site the shopper is, from the page address. */
function currentSource() {
  const path = window.location.pathname
  if (path === '/') return 'home'
  if (path.startsWith('/categories')) return 'category'
  if (path.startsWith('/search')) return 'search'
  if (path.startsWith('/products/')) return 'product'
  if (path.startsWith('/cart') || path.startsWith('/checkout')) return 'cart'
  if (path.startsWith('/favorites') || path.startsWith('/wishlist')) return 'wishlist'
  return 'other'
}

function sessionId() {
  try {
    return window.localStorage.getItem('ck-recommendation-session') || ''
  } catch {
    return ''
  }
}

function flush() {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  if (!queue.length) return
  const body = JSON.stringify({ sessionId: sessionId(), events: queue.splice(0, queue.length) })
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/events/product', body)) return
  } catch {
    // fall back to fetch
  }
  void fetch('/api/events/product', { method: 'POST', body, keepalive: true }).catch(() => undefined)
}

/** Count one shopper action on a product (safe to call anywhere; never throws). */
export function trackProductEvent(productId: string, type: ProductEventType, quantity = 1) {
  if (typeof window === 'undefined' || !productId) return
  try {
    // The app's own web pages and the admin/seller screens are not shopping.
    const path = window.location.pathname
    if (path.startsWith('/admin') || path.startsWith('/seller') || path.startsWith('/app-features')) return
    queue.push({ productId: String(productId), type, source: currentSource(), quantity })
    if (!listening) {
      listening = true
      window.addEventListener('pagehide', flush)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush()
      })
    }
    if (queue.length >= 20) flush()
    else if (timer === null) timer = window.setTimeout(flush, 1500)
  } catch {
    // stats must never break shopping
  }
}
