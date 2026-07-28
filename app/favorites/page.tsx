'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useUserStore } from '@/lib/store/user'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPrice } from '@/lib/utils'
import Header from '@/components/Header'
import SkeletonLoader from '@/components/SkeletonLoader'

interface WishlistProduct {
  id: string
  name: string
  price: number
  discount?: number | null
  image: string
  isAvailable: boolean
}

interface WishlistEntry {
  id: string
  productId: string
  product: WishlistProduct
}

export default function FavoritesPage() {
  const router = useRouter()
  const { user, _hasHydrated } = useUserStore()
  const [items, setItems] = useState<WishlistEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchWishlist = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/wishlist', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (err) {
      console.error('Error fetching wishlist:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!_hasHydrated) return

    if (!user) {
      router.push('/auth')
      return
    }
    fetchWishlist()
  }, [user, router, _hasHydrated, fetchWishlist])

  const handleRemove = async (productId: string) => {
    const previous = items
    setItems((current) => current.filter((item) => item.productId !== productId))

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) setItems(previous)
    } catch (err) {
      console.error('Error removing from wishlist:', err)
      setItems(previous)
    }
  }

  const priceOf = (product: WishlistProduct) =>
    product.discount && product.discount > 0
      ? product.price - (product.price * product.discount) / 100
      : product.price

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold text-ink">Favorites</h1>
          <p className="text-ink/55 mt-1">Gifts you saved for later</p>
        </div>

        {isLoading ? (
          <SkeletonLoader />
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[22px] border border-wine/10 p-12 text-center">
            <p className="text-ink/60">
              Nothing saved yet. Tap the heart on any gift to keep it here.
            </p>
            <Link
              href="/products"
              className="inline-block mt-6 bg-wine text-white px-6 py-3 rounded-full font-semibold hover:bg-wine-deep transition-colors"
            >
              Browse gifts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[18px] border border-wine/10 overflow-hidden"
              >
                <Link href={`/products/${item.productId}`} className="block relative aspect-square">
                  <Image
                    src={resolveImageUrl(item.product.image)}
                    alt={item.product.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                </Link>
                <div className="p-4">
                  <p className="font-medium text-ink text-sm line-clamp-2">{item.product.name}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-semibold text-wine">
                      {formatPrice(priceOf(item.product))}
                    </span>
                    <button
                      onClick={() => handleRemove(item.productId)}
                      className="text-xs text-ink/50 hover:text-wine transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  {!item.product.isAvailable && (
                    <p className="text-xs text-ink/45 mt-2">Currently unavailable</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
