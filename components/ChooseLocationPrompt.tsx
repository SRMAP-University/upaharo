'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import LocationModal from '@/components/LocationModal'
import { useLocationStore } from '@/lib/store/location'
import { useUserStore } from '@/lib/store/user'

const SESSION_KEY = 'upaharo-location-prompt-dismissed'

function shouldHide(pathname: string) {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/b2b') ||
    pathname.startsWith('/bill/') ||
    pathname.startsWith('/b/')
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

export default function ChooseLocationPrompt() {
  const pathname = usePathname() || ''
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const hasSavedLocation = useLocationStore((s) =>
    Boolean(s.deliveryAddress || s.currentLocation)
  )
  const userId = useUserStore((s) => s.user?.id)

  useEffect(() => {
    if (useLocationStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useLocationStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (shouldHide(pathname) || hasSavedLocation) {
      setIsOpen(false)
      return
    }
    if (!hydrated) return

    let cancelled = false
    let timer: number | undefined

    const tryOpen = async () => {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return

      if (userId) {
        const saved = await loadSavedAddress()
        if (cancelled) return
        if (saved) {
          const location = {
            latitude: Number(saved.latitude) || 0,
            longitude: Number(saved.longitude) || 0,
            address: `${saved.street || ''}, ${saved.city || ''}, ${saved.state || ''} - ${saved.pincode || ''}`,
            label: saved.label || 'Home',
          }
          const { setCurrentLocation, setDeliveryAddress } = useLocationStore.getState()
          setCurrentLocation(location)
          setDeliveryAddress(location)
          return
        }
      }

      timer = window.setTimeout(() => {
        if (!cancelled) setIsOpen(true)
      }, 250)
    }

    void tryOpen()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [pathname, hasSavedLocation, hydrated, userId])

  if (shouldHide(pathname)) return null

  return (
    <LocationModal
      isOpen={isOpen}
      onClose={() => {
        sessionStorage.setItem(SESSION_KEY, '1')
        setIsOpen(false)
      }}
    />
  )
}
