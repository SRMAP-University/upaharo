'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLocationStore } from '@/lib/store/location'
import { useUserStore } from '@/lib/store/user'

function shouldSkip(pathname: string) {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/b2b') ||
    pathname.startsWith('/bill/') ||
    pathname.startsWith('/b/') ||
    pathname.startsWith('/app-features/')
  )
}

type SavedAddress = {
  label?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  latitude?: number | null
  longitude?: number | null
}

/** Signed-in users may have a saved address on the server but none in this browser yet. */
async function loadSavedAddress(): Promise<SavedAddress | null> {
  try {
    const res = await fetch('/api/addresses', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const addresses: SavedAddress[] = Array.isArray(data?.addresses) ? data.addresses : []
    // The API lists the default address first.
    return addresses[0] ?? null
  } catch {
    return null
  }
}

/**
 * Fills in a signed-in shopper's saved delivery address on this browser.
 * It never pops up: shoppers pick a location from the header when they want
 * to (we deliver across Nepal, so browsing needs no location).
 */
export default function ChooseLocationPrompt() {
  const pathname = usePathname() || ''
  const [hydrated, setHydrated] = useState(false)
  const hasSavedLocation = useLocationStore((s) => Boolean(s.deliveryAddress || s.currentLocation))
  const userId = useUserStore((s) => s.user?.id)

  useEffect(() => {
    if (useLocationStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useLocationStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated || !userId || hasSavedLocation || shouldSkip(pathname)) return
    let cancelled = false
    void loadSavedAddress().then((saved) => {
      if (cancelled || !saved) return
      const location = {
        latitude: Number(saved.latitude) || 0,
        longitude: Number(saved.longitude) || 0,
        address: `${saved.street || ''}, ${saved.city || ''}, ${saved.state || ''} - ${saved.pincode || ''}`,
        label: saved.label || 'Home',
      }
      const { setCurrentLocation, setDeliveryAddress } = useLocationStore.getState()
      setCurrentLocation(location)
      setDeliveryAddress(location)
    })
    return () => {
      cancelled = true
    }
  }, [pathname, hasSavedLocation, hydrated, userId])

  return null
}
