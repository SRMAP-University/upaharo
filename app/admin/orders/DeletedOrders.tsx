'use client'

/** Admin Orders → Deleted: copies of deleted orders, each can be put back. */
import { useCallback, useEffect, useState } from 'react'
import { adminButtonClass } from '@/components/admin/AdminPageHeader'
import { formatPriceNoDecimals } from '@/lib/utils'

type DeletedRow = {
  id: string
  orderNumber: string
  deletedAt: string
  deletedBy: string | null
  placedAt: string | null
  status: string | null
  source: string | null
  total: number
  customer: string
  items: Array<{ name: string; quantity: number }>
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        timeZone: 'Asia/Kathmandu',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '—'

export default function DeletedOrders({ onRestored }: { onRestored: () => void }) {
  const [rows, setRows] = useState<DeletedRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [debounced])

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), perPage: '50' })
    if (debounced) params.set('search', debounced)
    const res = await fetch(`/api/admin/orders/deleted?${params}`, { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setRows([])
      setMessage(data?.error || 'Could not load deleted orders')
      return
    }
    setRows(data.rows)
    setTotal(data.total)
    setTotalPages(data.totalPages)
  }, [page, debounced])

  useEffect(() => {
    void load()
  }, [load])

  const restore = async (row: DeletedRow) => {
    setBusy(row.id)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/orders/deleted/${row.id}`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage(data?.error || 'Could not put the order back')
        return
      }
      setMessage(`Order ${row.orderNumber} is back in Orders.`)
      onRestored()
      void load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-ink/70">
        Orders that were deleted. A full copy of each is kept here; <span className="font-medium">Put back</span> returns it to Orders as it was.
      </p>
      <input
        type="text"
        placeholder="Search by order number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15 md:px-4 md:py-3"
      />
      {message ? <p className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-ink/70">{message}</p> : null}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {rows === null ? (
          <p className="p-8 text-center text-ink/55">Loading deleted orders...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-ink/55">No deleted orders.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm font-semibold text-ink">
                    {row.orderNumber}
                    {row.status ? (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink/60">{row.status.replace(/_/g, ' ')}</span>
                    ) : null}
                    {row.source === 'OFFLINE' ? <span className="ml-1 text-[10px] font-bold uppercase text-blush">Offline</span> : null}
                  </p>
                  <p className="text-xs text-ink/55">
                    Placed {when(row.placedAt)} · deleted {when(row.deletedAt)}
                    {row.customer ? ` · ${row.customer}` : ''}
                  </p>
                  <p className="truncate text-xs text-ink/50">{row.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</p>
                </div>
                <span className="font-semibold tabular-nums text-ink">{formatPriceNoDecimals(row.total)}</span>
                <button type="button" disabled={busy === row.id} onClick={() => void restore(row)} className={adminButtonClass.secondary}>
                  {busy === row.id ? 'Putting back…' : 'Put back'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink/55">
        <span>{total.toLocaleString()} deleted orders</span>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={adminButtonClass.secondary}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={adminButtonClass.secondary}>
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
