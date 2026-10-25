/**
 * Talk to the Upaharo app from a web feature page (`/app-features/...`)
 * running inside the app's WebView. The app only connects the bridge for
 * pages on upaharo.com.
 *
 *   import { appBridge, isInApp } from '@/lib/app-bridge'
 *   appBridge.addToCart(productId)
 */

export type BridgeAction =
  | { do: 'add_to_cart'; productId: string; quantity?: number }
  | { do: 'open'; url: string }
  | { do: 'close' }
  | { do: 'haptic'; style?: 'light' | 'medium' | 'heavy' }
  | { do: 'emit'; event: string; data?: Record<string, unknown> }
  | { do: 'say'; text: string; target?: string }
  | { do: 'resize'; height: number }

type Channel = { postMessage: (message: string) => void }

function channel(): Channel | null {
  if (typeof window === 'undefined') return null
  return ((window as unknown as { UpaharoApp?: Channel }).UpaharoApp ?? null) as Channel | null
}

/** True inside the app's WebView (the app also adds `?inApp=1` to the URL). */
export function isInApp() {
  if (typeof window === 'undefined') return false
  return Boolean(channel()) || new URLSearchParams(window.location.search).get('inApp') === '1'
}

export function sendToApp(action: BridgeAction) {
  const target = channel()
  if (!target) return false
  target.postMessage(JSON.stringify(action))
  return true
}

export const appBridge = {
  addToCart: (productId: string, quantity = 1) => sendToApp({ do: 'add_to_cart', productId, quantity }),
  /** App paths like `/products/<id>`, `/search?q=…`, `/cart`, or any https URL. */
  open: (url: string) => sendToApp({ do: 'open', url }),
  close: () => sendToApp({ do: 'close' }),
  haptic: (style: 'light' | 'medium' | 'heavy' = 'light') => sendToApp({ do: 'haptic', style }),
  /** Fires `custom:<event>` in the app; features' `on` rules can react to it. */
  emit: (event: string, data?: Record<string, unknown>) => sendToApp({ do: 'emit', event, data }),
  /** Makes a character say something (defaults to the gift buddy). */
  say: (text: string, target = 'gift-buddy') => sendToApp({ do: 'say', text, target }),
  /** Inline blocks: ask the app to size the block to the page's content. */
  resize: (height: number) => sendToApp({ do: 'resize', height: Math.ceil(height) }),
}
