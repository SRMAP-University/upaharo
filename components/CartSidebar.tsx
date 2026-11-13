'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice } from '@/lib/utils'

export default function CartSidebar() {
  const [mounted, setMounted] = useState(false)
  const { items, updateQuantity, removeItem, getTotalPrice, getTotalItems } = useCartStore()
  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || totalItems === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-wine/10 bg-white/95 shadow-[0_-20px_50px_-30px_rgba(17,17,17,0.5)] backdrop-blur md:hidden"
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-ink/55">{totalItems} items</p>
            <p className="font-display text-xl font-semibold text-ink">{formatPrice(totalPrice)}</p>
          </div>
          <Link href="/cart">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-wine text-white px-6 py-3 rounded-full font-semibold hover:bg-wine-deep smooth-transition flex items-center space-x-2 shadow-[0_16px_34px_-22px_rgba(17,17,17,0.95)]"
            >
              <span>View Cart</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

