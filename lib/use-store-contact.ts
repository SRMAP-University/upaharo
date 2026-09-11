'use client'

import { useEffect, useState } from 'react'

export type StoreContact = {
  phone: string
  instagram: string
}

let cached: StoreContact | null = null
let inflight: Promise<StoreContact> | null = null

async function loadStoreContact(): Promise<StoreContact> {
  if (cached) return cached
  if (!inflight) {
    inflight = fetch('/api/settings')
      .then(async (res) => {
        const data = res.ok ? await res.json() : {}
        cached = {
          phone: String(data?.supportPhone || '').trim(),
          instagram: String(data?.supportInstagram || 'upaharo').trim(),
        }
        return cached
      })
      .catch(() => {
        cached = { phone: '', instagram: '' }
        return cached
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useStoreContact(): StoreContact {
  const [contact, setContact] = useState<StoreContact>(
    cached ?? { phone: '', instagram: '' }
  )

  useEffect(() => {
    let cancelled = false
    void loadStoreContact().then((next) => {
      if (!cancelled) setContact(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return contact
}
