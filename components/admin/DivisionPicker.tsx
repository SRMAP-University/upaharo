'use client'

import { DIVISIONS, type Division } from '@/lib/divisions'

/** Which inventory a product belongs to: Upaharo Gifts or Upaharo Cakes. */
export default function DivisionPicker({
  value,
  onChange,
  auto = false,
}: {
  value: Division
  onChange: (division: Division) => void
  /** True while it still follows the category (new products). */
  auto?: boolean
}) {
  return (
    <div className="rounded-xl border border-wine/10 bg-cream/80 p-4">
      <p className="text-sm font-medium text-ink/70">Upaharo Gifts or Upaharo Cakes</p>
      <p className="mb-3 text-xs text-ink/55">
        Which business this product belongs to. Its stock and sales show in that part of Product Inventory.
        {auto ? ' Picked from the category until you choose.' : ''}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Inventory">
        {DIVISIONS.map((division) => {
          const on = value === division.id
          return (
            <button
              key={division.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(division.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                on ? 'border-transparent bg-wine text-white' : 'border-wine/15 bg-white text-ink/70 hover:border-wine/30'
              }`}
            >
              {division.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
