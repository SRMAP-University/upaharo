'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useCartStore } from '@/lib/store/cart'
import { useUserStore } from '@/lib/store/user'
import { useLocationStore } from '@/lib/store/location'
import LocationModal from './LocationModal'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function Header() {
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallButton, setShowInstallButton] = useState(false)
  
  const totalItems = useCartStore((state) => state.getTotalItems())
  const user = useUserStore((state) => state.user)
  const deliveryAddress = useLocationStore((state) => state.deliveryAddress)

  useEffect(() => {
    setMounted(true)

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    
    if (!isStandalone) {
      const handler = (e: Event) => {
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        setShowInstallButton(true)
      }

      window.addEventListener('beforeinstallprompt', handler)

      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowInstallButton(false)
    }

    setDeferredPrompt(null)
  }

  return (
    <div>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 border-b border-wine/10 bg-cream/90 backdrop-blur safe-area-top"
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 bg-wine rounded-xl flex items-center justify-center shadow-[0_12px_26px_-16px_rgba(124,42,71,0.95)]">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </div>
                <span className="font-display text-xl font-semibold tracking-tight text-wine">Upaharo</span>
              </motion.div>
            </Link>

            {/* Location */}
            {mounted ? (
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="flex items-center gap-2 flex-1 py-2 px-3 rounded-full hover:bg-white/70 transition-colors min-w-0"
              >
                <svg className="w-4 h-4 text-wine flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-ink/75 truncate">
                    {deliveryAddress?.label || 'Select location'}
                  </p>
                </div>
                <svg className="w-4 h-4 text-ink/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-1 py-2 px-3 min-w-0">
                <div className="w-4 h-4 bg-cream-deep rounded animate-pulse" />
                <div className="h-4 bg-cream-deep rounded flex-1 animate-pulse" />
              </div>
            )}

            <a
              href="/b2b"
              className="hidden md:inline-flex items-center rounded-full border border-wine/15 bg-white/70 px-3 py-1.5 text-xs font-semibold text-wine hover:border-wine/35 hover:bg-white transition-colors shrink-0"
            >
              Business
            </a>

            {/* Cart */}
            <Link href="/cart" className="hidden lg:block">
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="relative p-2 hover:bg-white/70 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-ink/70" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                {mounted && totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-wine text-white text-[10px] font-semibold rounded-full h-4 w-4 flex items-center justify-center shadow-md">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </motion.div>
            </Link>

            {/* Install PWA Button */}
            {mounted && showInstallButton && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleInstallClick}
                className="hidden lg:flex items-center gap-2 bg-wine text-white px-3.5 py-2 rounded-full shadow-[0_14px_30px_-18px_rgba(124,42,71,0.95)] hover:bg-wine-deep transition-all"
                title="Install App"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="text-sm font-medium">Install</span>
              </motion.button>
            )}

            {/* User - Only on desktop */}
              <Link href={user ? '/account' : '/auth'} className="hidden lg:block">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 hover:bg-white/70 rounded-full"
                >
                  <svg className="w-6 h-6 text-ink/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </motion.div>
              </Link>
            </div>
          </div>

        {/* Location Modal */}
        <LocationModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
        />
      </motion.header>
    </div>
  )
}
