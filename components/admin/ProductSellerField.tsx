'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type SellerOption = {
  id: string
  businessName: string
  isActive: boolean
  isVerified: boolean
  user?: { name?: string | null; email?: string | null } | null
}

/**
 * Which seller account a product is listed under. The seller sees it in the
 * partner app and receives its orders; empty means the store sells it.
 */
export default function ProductSellerField({
  value,
  onChange,
}: {
  value: string
  onChange: (sellerId: string) => void
}) {
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/sellers', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!cancelled) setSellers(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = sellers.find((seller) => seller.id === value)
  // Keep an assigned seller visible even if the list failed or no longer has it.
  const missingSelected = Boolean(value) && !loading && !selected

  return (
    <div className="w-full">
      <h3 className="mb-1 text-sm font-semibold text-ink">Seller</h3>
      <p className="mb-3 text-xs text-ink/55">
        The seller sees this product in their partner app and receives its orders.
      </p>
      <label className="mb-1 block text-sm font-medium text-ink/70" htmlFor="product-seller">
        Listed under
      </label>
      <select
        id="product-seller"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15 disabled:opacity-60"
      >
        <option value="">{loading ? 'Loading sellers…' : 'No seller — sold by the store'}</option>
        {missingSelected ? <option value={value}>Current seller ({value.slice(0, 8)}…)</option> : null}
        {sellers.map((seller) => {
          const owner = seller.user?.name || seller.user?.email
          const flags = [!seller.isActive ? 'inactive' : null, !seller.isVerified ? 'not verified' : null]
            .filter(Boolean)
            .join(', ')
          return (
            <option key={seller.id} value={seller.id}>
              {seller.businessName}
              {owner ? ` — ${owner}` : ''}
              {flags ? ` (${flags})` : ''}
            </option>
          )
        })}
      </select>
      {selected && (!selected.isActive || !selected.isVerified) ? (
        <p className="mt-1.5 text-xs text-amber-700">
          This seller is {!selected.isActive ? 'inactive' : 'not verified'}, so they may not be able to manage it yet.
        </p>
      ) : null}
      {loadError ? (
        <p className="mt-1.5 text-xs text-red-600">Sellers couldn’t be loaded. Refresh to try again.</p>
      ) : null}
      {!loading && !loadError && sellers.length === 0 ? (
        <p className="mt-1.5 text-xs text-ink/55">
          No seller accounts yet.{' '}
          <Link href="/admin/sellers" className="font-medium text-wine underline">
            Add a seller
          </Link>
        </p>
      ) : null}
    </div>
  )
}
