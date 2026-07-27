'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart'
import { useUserStore } from '@/lib/store/user'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

function formatRupee(amount: number) {
  return `₹${Math.ceil(amount).toLocaleString('en-IN')}`
}

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const getTotalItems = useCartStore((s) => s.getTotalItems)
  const getTotalPrice = useCartStore((s) => s.getTotalPrice)
  const { user } = useUserStore()
  const [cartCount, setCartCount] = useState(0)
  const [cartTotal, setCartTotal] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(true)
  const [showDeliveryHint, setShowDeliveryHint] = useState(false)
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(199)
  const [deliveryFee, setDeliveryFee] = useState(40)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    setMounted(true)
    setCartCount(getTotalItems())
    setCartTotal(getTotalPrice())
  }, [getTotalItems, getTotalPrice, items])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        setFreeDeliveryMin(Number(data.freeDeliveryMinAmount) || 199)
        setDeliveryFee(Number(data.deliveryFeeAmount) || 40)
      } catch {
        // keep defaults
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (cartCount <= 0 || deliveryFee <= 0) {
      setShowDeliveryHint(false)
      return
    }
    const id = window.setInterval(() => {
      setShowDeliveryHint((v) => !v)
    }, 2800)
    return () => window.clearInterval(id)
  }, [cartCount, deliveryFee])

  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true

      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        const threshold = 20

        if (currentScrollY < threshold) {
          setVisible(true)
        } else if (currentScrollY > lastScrollYRef.current) {
          setVisible(false)
        } else {
          setVisible(true)
        }

        lastScrollYRef.current = currentScrollY
        ticking = false
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const remaining = Math.max(0, freeDeliveryMin - cartTotal)
  const unlocked = remaining <= 0
  const showProgress = deliveryFee > 0 && cartCount > 0
  const progress =
    freeDeliveryMin <= 0 ? 1 : Math.min(1, Math.max(0, cartTotal / freeDeliveryMin))

  const primaryLine =
    unlocked && showProgress
      ? 'Free delivery unlocked'
      : showProgress && showDeliveryHint
        ? `Add ${formatRupee(remaining)} more`
        : `${cartCount} ${cartCount === 1 ? 'item' : 'items'}`

  const secondaryLine =
    unlocked && showProgress
      ? 'on this order'
      : showProgress && showDeliveryHint
        ? 'to unlock free delivery'
        : formatRupee(cartTotal)

  const navItems = [
    {
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
      label: 'Home',
      path: '/',
      active: pathname === '/'
    },
    {
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
      label: 'Search',
      path: '/search',
      active: pathname === '/search'
    },
    {
      icon: (active: boolean) => (
        <div className="relative">
          <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {mounted && cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-wine text-white text-[10px] font-semibold rounded-full h-4 w-4 flex items-center justify-center shadow-md">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </div>
      ),
      label: 'Cart',
      path: '/cart',
      active: pathname === '/cart'
    },
    {
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      ),
      label: 'Orders',
      path: '/orders',
      active: pathname === '/orders'
    },
    {
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      label: 'Account',
      path: user ? '/profile' : '/auth',
      active: pathname === '/profile' || pathname === '/auth'
    }
  ]

  const freeDeliveryChip = showProgress && (
    <button
      type="button"
      onClick={() => router.push('/cart')}
      className="relative w-full overflow-hidden rounded-full bg-wine text-left text-white shadow-[0_12px_28px_-16px_rgba(43,29,34,0.55)]"
    >
      <motion.div
        className={`absolute inset-y-0 left-0 ${unlocked ? 'bg-emerald-700/40' : 'bg-white/20'}`}
        initial={false}
        animate={{ width: `${progress * 100}%` }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />
      <div className="relative flex items-center gap-2 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={primaryLine}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <p className="truncate text-[11.5px] font-extrabold leading-tight">{primaryLine}</p>
              <p className="truncate text-[10px] font-semibold leading-tight text-white/85">
                {secondaryLine}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          {unlocked ? (
            <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 116 0h3a.75.75 0 00.75-.75V15z" />
          ) : (
            <path d="M2.25 3a.75.75 0 000 1.5h.797l.774 7.742A2.25 2.25 0 005.81 14.25h9.13a2.25 2.25 0 002.0-1.508l1.93-5.792A.75.75 0 0018.12 6H4.66l-.3-3H2.25zm4.5 15a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm10.5 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          )}
        </svg>
      </div>
    </button>
  )

  return (
    <>
      {/* Mobile */}
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: visible ? 0 : '100%' }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-bottom"
      >
        <AnimatePresence>
          {mounted && showProgress && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="px-3 pb-2"
            >
              {freeDeliveryChip}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="border-t border-wine/10 bg-white/95 backdrop-blur-sm">
          <div className="grid h-14 grid-cols-5">
            {navItems.map((item) => (
              <motion.button
                key={item.path}
                onClick={() => router.push(item.path)}
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center justify-center gap-0.5 ${
                  item.active ? 'text-wine' : 'text-ink/40'
                }`}
              >
                {item.icon(item.active)}
                <span className="text-[10px]">{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Desktop */}
      <motion.div
        initial={{ y: 0, x: '-50%' }}
        animate={{ y: visible ? 0 : 120, x: '-50%' }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="fixed bottom-6 left-1/2 z-50 hidden lg:block"
      >
        <div className="flex w-[min(420px,90vw)] flex-col gap-2">
          {mounted && showProgress && freeDeliveryChip}
          <div className="rounded-full border border-wine/10 bg-white/90 px-4 py-2 shadow-[0_22px_50px_-30px_rgba(43,29,34,0.5)] backdrop-blur">
            <div className="flex items-center gap-4">
              {navItems.map((item) => (
                <motion.button
                  key={`${item.path}-desktop`}
                  onClick={() => router.push(item.path)}
                  whileTap={{ scale: 0.9 }}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    item.active ? 'text-wine bg-rose-soft' : 'text-ink/55 hover:text-ink'
                  }`}
                >
                  {item.icon(item.active)}
                  <span className="hidden xl:block">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
