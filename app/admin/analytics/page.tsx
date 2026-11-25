'use client'

import ProductStatsBoard from '@/components/ProductStatsBoard'

export default function AdminProductStatsPage() {
  return (
    <ProductStatsBoard
      apiPath="/api/admin/analytics/products"
      title="Product stats"
      intro="How shoppers find, open, add to cart, save and buy each product. Counts only; no shopper details."
    />
  )
}
