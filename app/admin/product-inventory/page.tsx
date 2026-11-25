'use client'

import { useEffect, useState } from 'react'
import InventoryWorkspace from '@/app/admin/inventory/InventoryWorkspace'
import { DIVISIONS, isDivision, type Division } from '@/lib/divisions'

type View = Division | 'all'

const VIEWS: Array<{ id: View; label: string; note: string }> = [
  { id: 'all', label: 'All', note: 'Gifts and Cakes together' },
  ...DIVISIONS.map((d) => ({
    id: d.id as View,
    label: d.label,
    note: d.id === 'cakes' ? 'Cakes, pastries & bakery' : 'Gifts, flowers, hampers & more',
  })),
]

/**
 * Product Inventory: Upaharo Gifts and Upaharo Cakes kept apart, or seen
 * together under All, each with its own dashboard (online / offline), items,
 * orders and sales & profit. Uses the same PIN as Record.
 * `?d=gifts` / `?d=cakes` opens one side.
 */
export default function ProductInventoryPage() {
  const [division, setDivision] = useState<View>('all')

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('d')
    if (isDivision(wanted) || wanted === 'all') setDivision(wanted as View)
  }, [])

  const choose = (next: View) => {
    setDivision(next)
    const url = new URL(window.location.href)
    url.searchParams.set('d', next)
    window.history.replaceState(window.history.state, '', url.toString())
  }

  const switcher = (
    <div className="mb-4 grid grid-cols-3 gap-2 sm:flex" role="tablist" aria-label="Inventory">
      {VIEWS.map((item) => {
        const on = division === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => choose(item.id)}
            className={`rounded-xl border px-3 py-3 text-left transition sm:min-w-[180px] sm:px-5 ${
              on ? 'border-wine bg-wine text-white shadow-sm' : 'border-stone-200 bg-white text-ink hover:border-stone-300'
            }`}
          >
            <span className="block text-sm font-semibold sm:text-base">{item.label}</span>
            <span className={`hidden text-xs sm:block ${on ? 'text-white/70' : 'text-ink/50'}`}>{item.note}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <InventoryWorkspace
      key={division}
      division={division === 'all' ? undefined : division}
      dashboard
      switcher={switcher}
      title="Product Inventory"
      description="Upaharo Gifts and Upaharo Cakes, together or each on its own: dashboard, items, orders and sales, online and offline. Locked with the inventory PIN."
    />
  )
}
