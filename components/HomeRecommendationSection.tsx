'use client'

import { useEffect, useState } from 'react'
import ProductCard from '@/components/ProductCard'
import SectionHeading from '@/components/home/SectionHeading'
import { getRecentViewedProductIds } from '@/lib/recommendation-session'
import { getRecentViewedCategories, hasPersonalizationConsent } from '@/lib/personalization-consent'

const MIN_VIEW_HISTORY_FOR_PERSONALIZATION = 3

type Product = {
  id: string
  name: string
  miniDescription?: string | null
  description: string
  price: number
  image: string
  isVeg: boolean
  showFoodTypeLabel?: boolean
  discount?: number | null
  prepTime: number
}

type Props = {
  initialProducts: Product[]
  initialTitle: string
  initialDescription: string
}

export default function HomeRecommendationSection({
  initialProducts,
  initialTitle,
  initialDescription,
}: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)

  useEffect(() => {
    if (!hasPersonalizationConsent()) return

    const viewedProductIds = getRecentViewedProductIds()
    const viewedCategories = getRecentViewedCategories()
    if (
      viewedProductIds.length < MIN_VIEW_HISTORY_FOR_PERSONALIZATION &&
      viewedCategories.length < MIN_VIEW_HISTORY_FOR_PERSONALIZATION
    ) {
      return
    }

    const controller = new AbortController()

    const params = new URLSearchParams()
    if (viewedProductIds.length > 0) {
      params.set('viewedProductIds', viewedProductIds.join(','))
    }
    if (viewedCategories.length > 0) {
      params.set('viewedCategories', viewedCategories.join(','))
    }

    void fetch(`/api/recommendations/home?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.products) || data.products.length === 0) {
          return
        }

        setProducts(data.products)
        setTitle(String(data.title || 'For You'))
        setDescription(
          data.category
            ? `Mostly based on what you viewed in ${data.category}, with a few other picks.`
            : initialDescription
        )
      })
      .catch(() => null)

    return () => controller.abort()
  }, [initialDescription, initialTitle])

  if (products.length === 0) {
    return null
  }

  return (
    <section id="latest" className="space-y-5">
      <SectionHeading eyebrow="For you" title={title} description={description} />
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible xl:grid-cols-6">
        {products.map((product) => (
          <div key={product.id} className="w-[172px] flex-shrink-0 sm:w-[210px] lg:w-auto">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  )
}
