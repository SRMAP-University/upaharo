'use client'

import { PRODUCT_UNITS } from '@/lib/product-fields'

type InventoryValues = {
  sku: string
  trackStock: boolean
  stockQty: number | ''
  unit: string
  unitValue: number | ''
  aisle: string
}

type Props = {
  values: InventoryValues
  emphasizeGrocery?: boolean
  onChange: (patch: Partial<InventoryValues>) => void
}

export default function ProductInventoryFields({ values, emphasizeGrocery, onChange }: Props) {
  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl border border-wine/10 bg-cream/40 p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">Inventory</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink/70 mb-1">SKU</label>
            <input
              type="text"
              value={values.sku}
              onChange={(e) => onChange({ sku: e.target.value })}
              placeholder="Optional unique code"
              className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-ink/70 pb-2">
              <input
                type="checkbox"
                checked={values.trackStock}
                onChange={(e) =>
                  onChange({
                    trackStock: e.target.checked,
                    stockQty: e.target.checked ? values.stockQty || 0 : '',
                  })
                }
                className="rounded border-wine/30"
              />
              Track stock quantity
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink/70 mb-1">Stock qty</label>
            <input
              type="number"
              min={0}
              step={1}
              disabled={!values.trackStock}
              value={values.trackStock ? values.stockQty : ''}
              onChange={(e) =>
                onChange({
                  stockQty: e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value) || 0)),
                })
              }
              className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border p-4 ${
          emphasizeGrocery ? 'border-wine/25 bg-rose-soft/30' : 'border-wine/10 bg-cream/40'
        }`}
      >
        <h3 className="text-sm font-semibold text-ink mb-1">
          {emphasizeGrocery ? 'Grocery / packing' : 'Unit & aisle'}
        </h3>
        <p className="text-xs text-ink/50 mb-3">
          {emphasizeGrocery
            ? 'Shown for grocery catalog packing and shelf labels.'
            : 'Optional packing fields (useful if this product is also sold by weight/volume).'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink/70 mb-1">Unit</label>
            <select
              value={values.unit}
              onChange={(e) => onChange({ unit: e.target.value })}
              className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
            >
              <option value="">None</option>
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink/70 mb-1">Unit value</label>
            <input
              type="number"
              min={0}
              step="any"
              value={values.unitValue}
              onChange={(e) =>
                onChange({
                  unitValue: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              placeholder="e.g. 500"
              className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink/70 mb-1">Aisle</label>
            <input
              type="text"
              value={values.aisle}
              onChange={(e) => onChange({ aisle: e.target.value })}
              placeholder="e.g. Aisle 3"
              className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
