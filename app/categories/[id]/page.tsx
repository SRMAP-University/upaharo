'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import SkeletonLoader from '@/components/SkeletonLoader'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import ProductCard from '@/components/ProductCard'
import { rememberViewedCategory } from '@/lib/personalization-consent'
import { memoryChanged } from '@/lib/shopper-memory'

interface Category {
  id: string
  name: string
  emoji: string
  image?: string
  type: string
}

interface Product {
  id: string
  name: string
  miniDescription?: string | null
  description: string
  price: number
  image: string
  isVeg: boolean
  showFoodTypeLabel?: boolean
  discount: number
  prepTime: number
  categoryId: string
}

export default function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [category, setCategory] = useState<Category | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategoryAndProducts()
  }, [id])

  const fetchCategoryAndProducts = async () => {
    try {
      // Fetch category details
      const categoryRes = await fetch(`/api/categories/${id}`)
      if (categoryRes.ok) {
        const categoryData = await categoryRes.json()
        setCategory(categoryData)
        if (categoryData?.name) {
          rememberViewedCategory(String(categoryData.name))
          memoryChanged()
        }
      }

      // Fetch products in this category
      const productsRes = await fetch(`/api/products?view=card&categoryId=${id}`)
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        setProducts(productsData.products || [])
      }
    } catch (error) {
      console.error('Error fetching category data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="h-8 bg-cream-deep rounded w-48 mb-6 animate-pulse"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <SkeletonLoader variant="grid" count={8} />
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-cream">
        <Header />
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="font-display text-xl font-semibold text-ink mb-2">Category not found</h2>
          <button
            onClick={() => router.push('/')}
            className="mt-4 bg-wine text-white px-6 py-2 rounded-full font-medium shadow-[0_16px_34px_-22px_rgba(17,17,17,0.95)] hover:bg-wine-deep transition-colors"
          >
            Go Home
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-20 lg:pb-0">
      <Header />

      {/* Category header: plain and bold (Studio) */}
      <div className="px-4 pt-4 lg:px-6 lg:pt-8">
        <div className="mx-auto max-w-7xl">
          <button
            onClick={() => router.back()}
            className="mb-4 flex h-9 items-center gap-1 rounded-full bg-mist pl-2 pr-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-mist-deep"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-4">
            {category.image ? (
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-mist lg:h-20 lg:w-20">
                <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-mist lg:h-20 lg:w-20">
                <span className="text-3xl">{category.emoji || '🎁'}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink lg:text-[40px]">{category.name}</h1>
              <p className="mt-0.5 text-[13px] text-ink/50 lg:text-sm">
                {products.length} {products.length === 1 ? 'gift' : 'gifts'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        {products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="text-7xl mb-4">📦</div>
            <h2 className="mb-2 text-xl font-extrabold text-ink">No gifts here yet</h2>
            <p className="text-ink/55 mb-6">Check back soon for new items in this category</p>
            <button
              onClick={() => router.push('/')}
              className="u-btn-primary"
            >
              Browse all gifts
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8 xl:grid-cols-5">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
