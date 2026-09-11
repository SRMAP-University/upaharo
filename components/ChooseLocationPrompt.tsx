'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import LocationModal from '@/components/LocationModal'

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

export default function ChooseLocationPrompt() {
  const pathname = usePathname() || ''
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (shouldHide(pathname)) {
      setIsOpen(false)
      return
    }

    let cancelled = false
    let timer: number | undefined

    const tryOpen = () => {
      if (cancelled) return
      if (sessionStorage.getItem(SESSION_KEY) === '1') return
      timer = window.setTimeout(() => {
        if (!cancelled) setIsOpen(true)
      }, 250)
    }

    tryOpen()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [pathname])

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
