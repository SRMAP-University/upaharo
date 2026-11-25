'use client'

import { useEffect, useState } from 'react'
import InventoryWorkspace from '@/app/admin/inventory/InventoryWorkspace'
import { DIVISIONS, isDivision, type Division } from '@/lib/divisions'

/**
 * Product Inventory: Upaharo Gifts and Upaharo Cakes kept apart, each with its
 * own dashboard (online / offline), items, orders and sales & profit.
 * Uses the same PIN as Record. `?d=cakes` opens Cakes.
 */
export default function ProductInventoryPage() {
  const [division, setDivision] = useState<Division>('gifts')

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('d')
    if (isDivision(wanted)) setDivision(wanted)
  }, [])

  const choose = (next: Division) => {
    setDivision(next)
    const url = new URL(window.location.href)
    url.searchParams.set('d', next)
    window.history.replaceState(window.history.state, '', url.toString())
  }

  const switcher = (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:flex" role="tablist" aria-label="Inventory">
      {DIVISIONS.map((item) => {
        const on = division === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => choose(item.id)}
            className={`rounded-xl border px-5 py-3 text-left transition sm:min-w-[200px] ${
              on ? 'border-wine bg-wine text-white shadow-sm' : 'border-stone-200 bg-white text-ink hover:border-stone-300'
            }`}
          >
            <span className="block text-base font-semibold">{item.label}</span>
            <span className={`block text-xs ${on ? 'text-white/70' : 'text-ink/50'}`}>
              {item.id === 'cakes' ? 'Cakes, pastries & bakery' : 'Gifts, flowers, hampers & more'}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <InventoryWorkspace
      key={division}
      division={division}
      switcher={switcher}
      title="Product Inventory"
      description="Upaharo Gifts and Upaharo Cakes, each with its own dashboard, items, orders and sales, online and offline. Locked with the inventory PIN."
    />
  )
}
