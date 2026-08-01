'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getPersonalizationConsent, setPersonalizationConsent } from '@/lib/personalization-consent'

export default function PersonalizationConsentBanner() {
  const pathname = usePathname() || ''
  const [visible, setVisible] = useState(false)
  const hideOnBill =
    pathname.startsWith('/bill/') || pathname.startsWith('/b/')

  useEffect(() => {
    if (hideOnBill) {
      setVisible(false)
      return
    }
    setVisible(getPersonalizationConsent() === 'unset')
  }, [hideOnBill])

  if (!visible || hideOnBill) {
    return null
  }

  return (
    <div className="fixed inset-x-3 bottom-4 z-[90] mx-auto max-w-xl rounded-[22px] border border-wine/10 bg-white p-4 shadow-[0_24px_60px_-30px_rgba(43,29,34,0.5)]">
      <div className="space-y-3">
        <div>
          <p className="font-display text-base font-semibold text-ink">Personalized recommendations</p>
          <p className="mt-1 text-xs leading-5 text-ink/55">
            Allow us to use a small first-party cookie and recent product/category views to show more relevant items.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPersonalizationConsent('declined')
              setVisible(false)
            }}
            className="flex-1 rounded-full border border-wine/20 px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-cream"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              setPersonalizationConsent('accepted')
              setVisible(false)
            }}
            className="flex-1 rounded-full bg-wine px-3 py-2 text-sm font-semibold text-white transition hover:bg-wine-deep"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
