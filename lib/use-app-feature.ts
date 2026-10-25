'use client'

import { useEffect, useState } from 'react'

type LiveFeature = { key: string; type: string; config: Record<string, unknown> }

let request: Promise<LiveFeature[] | null> | null = null

/** One fetch per page load, shared by every caller. */
function loadWebFeatures() {
  if (!request) {
    request = fetch('/api/features?platform=web')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (Array.isArray(data?.features) ? (data.features as LiveFeature[]) : null))
      .catch(() => null)
  }
  return request
}

/**
 * Whether a server-driven feature is live on the website. Stays `true` until
 * the server says otherwise (and if it can't be reached), so switching a
 * feature off in admin is a kill switch, never a reason for it to flicker in.
 */
export function useAppFeatureEnabled(key: string) {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    let cancelled = false
    void loadWebFeatures().then((features) => {
      if (!cancelled && features) setEnabled(features.some((f) => f.key === key))
    })
    return () => {
      cancelled = true
    }
  }, [key])

  return enabled
}
