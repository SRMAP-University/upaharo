'use client'

import { useEffect } from 'react'
import { appBridge, isInApp } from '@/lib/app-bridge'

/**
 * Inside the app's web view: product links open the native product screen
 * and Add buttons fill the app's cart instead of the website's.
 */
export default function InAppLinkBridge() {
  useEffect(() => {
    if (!isInApp()) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest('a[href^="/"]') as HTMLAnchorElement | null
      if (!link) return
      const href = link.getAttribute('href') || ''
      event.preventDefault()
      event.stopPropagation()
      const productId = href.startsWith('/products/') ? href.split('/')[2]?.split(/[?#]/)[0] : ''
      if (productId && target?.closest('button')) {
        appBridge.addToCart(productId)
        appBridge.haptic()
      } else {
        // The app maps site paths to native screens (products, categories, search…).
        appBridge.open(href)
      }
    }
    // Capture phase runs before React's own handlers on the card.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
