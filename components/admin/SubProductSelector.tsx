'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatPriceNoDecimals } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/image-url'

type ProductOption = {
  id: string
  name: string
  image: string
  price: number
  discount: number
  category: string
}

type SubProductSelectorProps = {
  value: string[]
  onChange: (ids: string[]) => void
  excludeProductId?: string
  title?: string
  hint?: string
  searchPlaceholder?: string
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export default function SubProductSelector({
  value,
  onChange,
  excludeProductId,
  title = 'Sub-products',
  hint = 'Attach optional companion products like candles, toppers, or balloons.',
  searchPlaceholder = 'Search products to attach as sub-product...',
}: SubProductSelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductOption[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Record<string, ProductOption>>({})

  const selectedIds = useMemo(() => unique(value), [value])

  useEffect(() => {
    let ignore = false
    const fetchResults = async () => {
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (query.trim()) {
        params.set('search', query.trim())
      }
      const res = await fetch(`/api/admin/products?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json()
      const products = Array.isArray(data.products) ? (data.products as ProductOption[]) : []
      const list = products.filter((item) => item.id !== excludeProductId)
      if (!ignore) {
        setResults(list)
      }
    }

    void fetchResults().catch(() => null)
    return () => {
      ignore = true
    }
  }, [excludeProductId, query])

  useEffect(() => {
    let ignore = false

    if (selectedIds.length === 0) {
      setSelectedProducts({})
      return
    }

    const fetchSelected = async () => {
      const params = new URLSearchParams()
      params.set('ids', selectedIds.join(','))
      params.set('limit', String(selectedIds.length))
      const res = await fetch(`/api/admin/products?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data.products) ? (data.products as ProductOption[]) : []
      if (!ignore) {
        setSelectedProducts(
          list.reduce((acc: Record<string, ProductOption>, item) => {
            acc[item.id] = item
            return acc
          }, {})
        )
      }
    }

    void fetchSelected().catch(() => null)
    return () => {
      ignore = true
    }
  }, [selectedIds.join(',')])

  const addSubProduct = (productId: string) => {
    onChange(unique([...selectedIds, productId]))
  }

  const removeSubProduct = (productId: string) => {
    onChange(selectedIds.filter((id) => id !== productId))
  }

  return (
    <div className="col-span-2 rounded-xl border border-wine/10 bg-cream/70 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="text-xs text-ink/55 mt-1">{hint}</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
      />

      <div className="grid gap-2 md:grid-cols-2">
        {results.slice(0, 10).map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => addSubProduct(product.id)}
            className="flex items-center gap-3 rounded-xl border border-wine/10 bg-white p-2 text-left hover:border-wine/30"
          >
            <img src={resolveImageUrl(product.image)} alt={product.name} className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{product.name}</p>
              <p className="text-xs text-ink/55">{formatPriceNoDecimals(product.price)}</p>
            </div>
            <span className="text-xs font-semibold text-wine">Add</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink/70">Selected products ({selectedIds.length})</p>
        {selectedIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-wine/20 bg-white px-3 py-3 text-xs text-ink/55">
            No sub-products selected.
          </div>
        ) : (
          selectedIds.map((id) => (
            <div key={id} className="flex items-center justify-between rounded-xl border border-wine/10 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{selectedProducts[id]?.name || id}</p>
                {selectedProducts[id] ? (
                  <p className="text-xs text-ink/55">{formatPriceNoDecimals(selectedProducts[id].price)}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeSubProduct(id)}
                className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
