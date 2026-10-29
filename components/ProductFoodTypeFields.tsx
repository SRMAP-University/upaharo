'use client'

import { useEffect } from 'react'
import { isFoodProduct } from '@/lib/food-products'

type ProductFoodTypeFieldsProps = {
  showFoodTypeLabel: boolean
  isVeg: boolean
  /** The product's category and name decide whether it is food. */
  category: string
  name: string
  accent?: 'pink' | 'orange'
  onShowFoodTypeLabelChange: (value: boolean) => void
  onIsVegChange: (value: boolean) => void
}

/**
 * Veg / non-veg badge settings. Only food (cakes, chocolates, sweets, bakery,
 * snacks…) can have the badge; for anything else the setting is hidden and
 * switched off.
 */
export default function ProductFoodTypeFields({
  showFoodTypeLabel,
  isVeg,
  category,
  name,
  accent = 'pink',
  onShowFoodTypeLabelChange,
  onIsVegChange,
}: ProductFoodTypeFieldsProps) {
  const activeClassName = 'border-transparent bg-wine text-white'
  void accent
  const isFood = isFoodProduct({ category, name })

  // Moving a product to a non-food category turns its badge off.
  useEffect(() => {
    if (!isFood && showFoodTypeLabel) onShowFoodTypeLabelChange(false)
  }, [isFood, showFoodTypeLabel, onShowFoodTypeLabelChange])

  if (!isFood) {
    return (
      <p className="text-xs text-ink/50">
        Veg / non-veg badge: only for food such as cakes, chocolates, sweets and snacks. Pick a food category to set it.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showFoodTypeLabel}
          onChange={(e) => onShowFoodTypeLabelChange(e.target.checked)}
          className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
        />
        <span className="text-sm font-medium text-ink/70">Show veg / non-veg badge for this product</span>
      </label>

      {showFoodTypeLabel && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onIsVegChange(true)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              isVeg ? activeClassName : 'border-wine/15 bg-white text-ink/70 hover:border-wine/30'
            }`}
          >
            Vegetarian
          </button>
          <button
            type="button"
            onClick={() => onIsVegChange(false)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              !isVeg ? activeClassName : 'border-wine/15 bg-white text-ink/70 hover:border-wine/30'
            }`}
          >
            Non-Vegetarian
          </button>
        </div>
      )}
    </div>
  )
}
