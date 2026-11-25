'use client'

import ProductStatsBoard from '@/components/ProductStatsBoard'

export default function SellerProductStatsPage() {
  return (
    <div className="px-4 pb-24 pt-4 md:py-6">
      <ProductStatsBoard
        apiPath="/api/seller/analytics/products"
        title="Your product stats"
        intro="How shoppers find, open, add to cart, save and buy your products on Upaharo."
      />
    </div>
  )
}
