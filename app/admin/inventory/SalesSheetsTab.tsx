'use client'

/**
 * Inventory → Custom sales: sheets for a festival or season. Copy in real
 * orders (or type your own), change quantities, prices, purchase, packing and
 * delivery costs, add costs for the whole season, and see the profit or loss.
 * Nothing here changes real orders or stock.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adminButtonClass } from '@/components/admin/AdminPageHeader'
import {
  cleanSheetData,
  lineProfit,
  lineSales,
  newKey,
  orderTotals,
  sheetTotals,
  type SheetData,
  type SheetLine,
  type SheetOrder,
  type SheetTotals,
} from '@/lib/sales-sheet'
import { api, inputClass, Kpi, PinConfirm, presets, PriceCell, rs, Thumb, TrashIcon } from './shared'

type SheetSummary = { id: string; name: string; note: string; createdAt: string; updatedAt: string; totals: SheetTotals }
type Sheet = { id: string; name: string; note: string; data: SheetData; updatedAt: string }

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', day: 'numeric', month: 'short', year: 'numeric' })
    : ''
const signed = (n: number) => (n < 0 ? `−${rs(-n)}` : rs(n))

export default function SalesSheetsTab({ onLocked }: { onLocked: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return openId ? (
    <SheetEditor id={openId} onBack={() => setOpenId(null)} onLocked={onLocked} />
  ) : (
    <SheetList onOpen={setOpenId} onLocked={onLocked} />
  )
}

// ------------------------------------------------------------------ list

function SheetList({ onOpen, onLocked }: { onOpen: (id: string) => void; onLocked: () => void }) {
  const [sheets, setSheets] = useState<SheetSummary[] | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const fail = useCallback(
    (err: unknown) => {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setMessage((err as Error).message)
    },
    [onLocked]
  )

  useEffect(() => {
    api<{ sheets: SheetSummary[] }>('/api/admin/inventory/sheets')
      .then((d) => setSheets(d.sheets))
      .catch((err) => {
        setSheets([])
        fail(err)
      })
  }, [fail])

  const create = async (body: Record<string, unknown>) => {
    setBusy(true)
    setMessage('')
    try {
      const sheet = await api<Sheet>('/api/admin/inventory/sheets', { method: 'POST', body: JSON.stringify(body) })
      onOpen(sheet.id)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-ink/70">
        Work out sales and profit for a festival or season. Copy in some of your real orders (or type your own), change quantities,
        prices and costs, and see the profit or loss. Nothing here changes real orders or stock.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void create({ name, note })
        }}
        className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <label className="flex-1 text-xs font-medium text-ink/60">
          New sheet
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tihar 2026" maxLength={100} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="flex-1 text-xs font-medium text-ink/60">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. hampers and sweets, Oct–Nov" maxLength={500} className={`mt-1 ${inputClass}`} />
        </label>
        <button type="submit" disabled={busy || !name.trim()} className={adminButtonClass.primary}>
          + Create sheet
        </button>
      </form>

      {message ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{message}</p> : null}

      {sheets === null ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-ink/50">Loading sheets…</p>
      ) : sheets.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-ink/50">
          No sheets yet. Create one above, e.g. “Tihar 2026”.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sheets.map((s) => (
            <div key={s.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4">
              <button type="button" onClick={() => onOpen(s.id)} className="text-left">
                <p className="font-semibold text-ink hover:text-wine">{s.name}</p>
                {s.note ? <p className="mt-0.5 line-clamp-2 text-xs text-ink/55">{s.note}</p> : null}
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-ink/45">Revenue</p>
                    <p className="font-semibold tabular-nums text-ink">{rs(s.totals.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-ink/45">Cost</p>
                    <p className="font-semibold tabular-nums text-ink">{rs(s.totals.cost)}</p>
                  </div>
                  <div>
                    <p className="text-ink/45">{s.totals.profit < 0 ? 'Loss' : 'Profit'}</p>
                    <p className={`font-semibold tabular-nums ${s.totals.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{signed(s.totals.profit)}</p>
                  </div>
                </div>
              </button>
              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs text-ink/45">
                <span>
                  {s.totals.orders} orders · updated {when(s.updatedAt)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void create({ name: `${s.name} (copy)`.slice(0, 100), note: s.note, copyFrom: s.id })}
                  className="font-semibold text-wine hover:underline"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ editor

function SheetEditor({ id, onBack, onLocked }: { id: string; onBack: () => void; onLocked: () => void }) {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [error, setError] = useState('')
  const [save, setSave] = useState<'saved' | 'unsaved' | 'saving' | 'failed'>('saved')
  const [picking, setPicking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const latest = useRef<Sheet | null>(null)
  const dirty = useRef(false)

  const fail = useCallback(
    (err: unknown) => {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setError((err as Error).message)
    },
    [onLocked]
  )

  useEffect(() => {
    api<Sheet>(`/api/admin/inventory/sheets/${id}`)
      .then((s) => {
        latest.current = s
        setSheet(s)
      })
      .catch(fail)
  }, [id, fail])

  const flush = useCallback(async () => {
    const current = latest.current
    if (!current || !dirty.current) return
    dirty.current = false
    setSave('saving')
    try {
      await api(`/api/admin/inventory/sheets/${current.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: current.name, note: current.note, data: current.data }),
      })
      setSave(dirty.current ? 'unsaved' : 'saved')
    } catch (err) {
      dirty.current = true
      setSave('failed')
      fail(err)
    }
  }, [fail])

  // Leaving the tab saves anything not yet saved.
  useEffect(() => () => void flush(), [flush])

  // Save a moment after the last change.
  useEffect(() => {
    if (save !== 'unsaved') return
    const t = window.setTimeout(() => void flush(), 700)
    return () => window.clearTimeout(t)
  }, [save, sheet, flush])

  const change = (next: Sheet) => {
    latest.current = next
    dirty.current = true
    setSheet(next)
    setSave('unsaved')
  }
  const updateData = (fn: (d: SheetData) => SheetData) => sheet && change({ ...sheet, data: fn(sheet.data) })
  const updateOrder = (key: string, fn: (o: SheetOrder) => SheetOrder) =>
    updateData((d) => ({ ...d, orders: d.orders.map((o) => (o.key === key ? fn(o) : o)) }))

  const totals = useMemo(() => (sheet ? sheetTotals(sheet.data) : null), [sheet])

  if (!sheet || !totals) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-wine hover:underline">
          ← All sheets
        </button>
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-ink/50">{error || 'Loading sheet…'}</p>
      </div>
    )
  }

  const back = async () => {
    await flush()
    onBack()
  }
  const addedOrderIds = new Set(sheet.data.orders.map((o) => o.orderId).filter(Boolean) as string[])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => void back()} className="text-sm font-semibold text-wine hover:underline">
          ← All sheets
        </button>
        <div className="flex items-center gap-3 text-xs">
          <span className={save === 'failed' ? 'text-red-600' : 'text-ink/45'}>
            {save === 'saving' ? 'Saving…' : save === 'unsaved' ? 'Unsaved changes' : save === 'failed' ? 'Not saved' : 'All changes saved'}
          </span>
          {save === 'failed' ? (
            <button type="button" onClick={() => void flush()} className="font-semibold text-wine hover:underline">
              Try again
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-red-600 hover:bg-red-50"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Delete sheet
          </button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink/60">
          Sheet name
          <input
            value={sheet.name}
            maxLength={100}
            onChange={(e) => change({ ...sheet, name: e.target.value })}
            className={`mt-1 ${inputClass} text-base font-semibold`}
          />
        </label>
        <label className="text-xs font-medium text-ink/60">
          Note
          <input value={sheet.note} maxLength={500} onChange={(e) => change({ ...sheet, note: e.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue" value={rs(totals.revenue)} hint={`${totals.orders} orders · ${totals.items} items`} />
        <Kpi label="Total cost" value={rs(totals.cost)} hint="Purchase, packing, delivery, other" />
        <Kpi
          label={totals.profit < 0 ? 'Loss' : 'Profit'}
          value={signed(totals.profit)}
          hint={totals.profit < 0 ? 'Costs are more than revenue' : 'Revenue less all costs'}
          tone={totals.profit < 0 ? 'red' : undefined}
        />
        <Kpi label="Margin" value={totals.margin === null ? '—' : `${totals.margin}%`} hint="Profit as a share of revenue" />
      </div>

      {totals.missingPurchase > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {totals.missingPurchase === 1 ? '1 item has' : `${totals.missingPurchase} items have`} no purchase cost, so it’s counted as Rs 0. Type it in to get the
          real profit.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPicking((v) => !v)} className={adminButtonClass.primary}>
          {picking ? 'Close order list' : '+ Add real orders'}
        </button>
        <button
          type="button"
          onClick={() =>
            updateData((d) => ({
              ...d,
              orders: [
                ...d.orders,
                {
                  key: newKey(),
                  orderId: null,
                  orderNumber: null,
                  label: '',
                  date: null,
                  times: 1,
                  discount: 0,
                  deliveryCharged: 0,
                  deliveryCost: 0,
                  packing: 0,
                  lines: [],
                },
              ],
            }))
          }
          className={adminButtonClass.secondary}
        >
          + Add your own order
        </button>
      </div>

      {picking ? (
        <OrderPicker
          added={addedOrderIds}
          onLocked={onLocked}
          onAdd={(orders) => {
            updateData((d) => ({ ...d, orders: [...d.orders, ...orders] }))
            setPicking(false)
          }}
        />
      ) : null}

      {sheet.data.orders.length === 0 && !picking ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-ink/50">
          No orders yet. Add some of your real orders, or your own.
        </p>
      ) : null}

      <div className="space-y-3">
        {sheet.data.orders.map((order) => (
          <SheetOrderCard
            key={order.key}
            order={order}
            onLocked={onLocked}
            onChange={(fn) => updateOrder(order.key, fn)}
            onRemove={() => updateData((d) => ({ ...d, orders: d.orders.filter((o) => o.key !== order.key) }))}
          />
        ))}
      </div>

      <OtherCosts data={sheet.data} onChange={updateData} />

      <Breakdown totals={totals} />

      {deleting ? (
        <PinConfirm
          title={`Delete “${sheet.name}”?`}
          detail="The sheet and its numbers are deleted. Real orders and stock aren’t touched."
          onLocked={onLocked}
          onClose={() => setDeleting(false)}
          onConfirm={async (pin) => {
            await api(`/api/admin/inventory/sheets/${sheet.id}`, { method: 'DELETE', body: JSON.stringify({ pin }) })
            dirty.current = false
            setDeleting(false)
            onBack()
          }}
        />
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ pick real orders

type PickOrder = {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  source: 'UPAHARO' | 'OFFLINE'
  customer: string
  netSales: number
  lines: Array<{ id: string; name: string; quantity: number }>
}

function OrderPicker({ added, onAdd, onLocked }: { added: Set<string>; onAdd: (orders: SheetOrder[]) => void; onLocked: () => void }) {
  const ranges = useMemo(() => [{ id: 'all', label: 'All time', from: '', to: '' }, ...presets()], [])
  const [range, setRange] = useState('all')
  const [source, setSource] = useState<'all' | 'online' | 'offline'>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<PickOrder[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [range, source, debounced])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const r = ranges.find((x) => x.id === range) || ranges[0]
    const params = new URLSearchParams({ source, view: 'all', page: String(page), perPage: '20' })
    if (r.from) params.set('from', r.from)
    if (r.to) params.set('to', r.to)
    if (debounced) params.set('search', debounced)
    api<{ rows: PickOrder[]; totalPages: number }>(`/api/admin/inventory/orders?${params}`)
      .then((d) => {
        if (cancelled) return
        setRows(d.rows)
        setTotalPages(d.totalPages)
      })
      .catch((err) => {
        if (cancelled) return
        if ((err as { locked?: boolean }).locked) onLocked()
        else setMessage((err as Error).message)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [ranges, range, source, debounced, page, onLocked])

  const add = async () => {
    setBusy(true)
    setMessage('')
    try {
      const d = await api<{ orders: SheetOrder[] }>(`/api/admin/inventory/sheets/order-lines?ids=${[...chosen].join(',')}`)
      onAdd(cleanSheetData({ orders: d.orders }).orders)
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-wine/20 bg-white p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-sm font-semibold text-ink">Pick orders to copy into this sheet</h3>
        <div className="flex flex-wrap gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value)} className={`${inputClass} w-auto`} aria-label="Period">
            {ranges.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={`${inputClass} w-auto`} aria-label="Order source">
            <option value="all">Online + offline</option>
            <option value="online">Online only</option>
            <option value="offline">Offline only</option>
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no., customer, product" className={`${inputClass} w-56`} />
        </div>
      </div>
      {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
      <div className="mt-3 max-h-80 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
        {loading && rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink/50">Loading orders…</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink/50">No orders found.</p>
        ) : (
          rows.map((o) => {
            const already = added.has(o.id)
            return (
              <label key={o.id} className={`flex cursor-pointer items-start gap-3 px-3 py-2 text-sm ${already ? 'opacity-50' : 'hover:bg-stone-50'}`}>
                <input
                  type="checkbox"
                  disabled={already}
                  checked={already || chosen.has(o.id)}
                  onChange={(e) =>
                    setChosen((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(o.id)
                      else next.delete(o.id)
                      return next
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-wine"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">#{o.orderNumber}</span>{' '}
                  <span className="text-xs text-ink/50">
                    {when(o.createdAt)} · {o.source === 'OFFLINE' ? 'Offline' : 'Online'}
                    {o.customer ? ` · ${o.customer}` : ''}
                    {already ? ' · already in the sheet' : ''}
                  </span>
                  <span className="block truncate text-xs text-ink/55">{o.lines.map((l) => `${l.quantity} × ${l.name}`).join(', ')}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{rs(o.netSales)}</span>
              </label>
            )
          })
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-ink/55">
          {totalPages > 1 ? (
            <>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={adminButtonClass.secondary}>
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={adminButtonClass.secondary}>
                Next
              </button>
            </>
          ) : null}
        </div>
        <button type="button" disabled={busy || chosen.size === 0} onClick={() => void add()} className={adminButtonClass.primary}>
          {busy ? 'Adding…' : `Add ${chosen.size || ''} ${chosen.size === 1 ? 'order' : 'orders'}`.replace('  ', ' ')}
        </button>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ one order

type ProductHit = {
  id: string
  name: string
  image: string
  salePrice: number
  unitCost: number | null
  packagingCost: number | null
}

function SheetOrderCard({
  order,
  onChange,
  onRemove,
  onLocked,
}: {
  order: SheetOrder
  onChange: (fn: (o: SheetOrder) => SheetOrder) => void
  onRemove: () => void
  onLocked: () => void
}) {
  const t = orderTotals(order)
  const setLine = (key: string, patch: Partial<SheetLine>) =>
    onChange((o) => ({ ...o, lines: o.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  const addLine = (line: SheetLine) => onChange((o) => ({ ...o, lines: [...o.lines, line] }))

  return (
    <article className="rounded-xl border border-stone-200 bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {order.orderNumber ? `#${order.orderNumber}` : 'Your own order'}
            {order.date ? <span className="ml-2 text-xs font-normal text-ink/45">{when(order.date)}</span> : null}
          </p>
          <input
            value={order.label}
            maxLength={200}
            onChange={(e) => onChange((o) => ({ ...o, label: e.target.value }))}
            placeholder="Customer or description"
            aria-label="Customer or description"
            className="mt-1 w-full max-w-sm rounded-md border border-transparent px-1 py-0.5 text-xs text-ink/70 hover:border-stone-200 focus:border-wine/40 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink/55" title="Count this order this many times, e.g. how many orders like it you expect">
          Count ×
          <PriceCell whole width="w-16" label="Times to count this order" value={order.times} onSave={(v) => onChange((o) => ({ ...o, times: Math.max(1, Math.round(num(v)) || 1) }))} />
        </label>
        <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-ink/35 hover:bg-red-50 hover:text-red-600" aria-label="Remove this order from the sheet" title="Remove from the sheet">
          <TrashIcon />
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-[11px] font-medium uppercase tracking-wider text-ink/45">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Selling price</th>
              <th className="px-2 py-2 text-right">Purchase cost</th>
              <th className="px-2 py-2 text-right">Packing</th>
              <th className="px-2 py-2 text-right">Sales</th>
              <th className="px-2 py-2 text-right">Profit</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {order.lines.map((line) => (
              <tr key={line.key}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Thumb src={line.image} size="h-8 w-8" />
                    {line.productId ? (
                      <span className="max-w-[14rem] truncate text-ink" title={line.name}>
                        {line.name}
                      </span>
                    ) : (
                      <input
                        value={line.name}
                        maxLength={200}
                        onChange={(e) => setLine(line.key, { name: e.target.value })}
                        aria-label="Item name"
                        className={`${inputClass} max-w-[14rem]`}
                      />
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-right">
                  <PriceCell whole width="w-16" label={`Quantity of ${line.name}`} value={line.qty} onSave={(v) => setLine(line.key, { qty: Math.round(num(v)) })} />
                </td>
                <td className="px-2 py-2 text-right">
                  <PriceCell width="w-24" label={`Selling price of ${line.name}`} value={line.price} onSave={(v) => setLine(line.key, { price: num(v) })} />
                </td>
                <td className="px-2 py-2 text-right">
                  <PriceCell
                    width="w-24"
                    placeholder="Add"
                    label={`Purchase cost of ${line.name}`}
                    value={line.purchase}
                    onSave={(v) => setLine(line.key, { purchase: v === '' ? null : num(v) })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <PriceCell width="w-20" placeholder="0" label={`Packing for ${line.name}`} value={line.packing} onSave={(v) => setLine(line.key, { packing: num(v) })} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink">{rs(lineSales(line))}</td>
                <td className={`px-2 py-2 text-right font-medium tabular-nums ${lineProfit(line) < 0 ? 'text-red-600' : 'text-ink'}`}>
                  {line.purchase === null ? <span className="text-xs font-normal text-amber-700">no cost</span> : signed(lineProfit(line))}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onChange((o) => ({ ...o, lines: o.lines.filter((l) => l.key !== line.key) }))}
                    className="rounded p-1 text-ink/30 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${line.name}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {order.lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-center text-xs text-ink/45">
                  No items yet. Add a product or an item below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start gap-2 border-t border-stone-100 px-4 py-2.5">
        <ProductSearch
          onLocked={onLocked}
          onPick={(p) =>
            addLine({
              key: newKey(),
              productId: p.id,
              name: p.name,
              image: p.image,
              qty: 1,
              price: p.salePrice,
              purchase: p.unitCost === null ? null : Math.round((p.unitCost - (p.packagingCost || 0)) * 100) / 100,
              packing: p.packagingCost || 0,
            })
          }
        />
        <button
          type="button"
          onClick={() => addLine({ key: newKey(), productId: null, name: 'Item', image: '', qty: 1, price: 0, purchase: null, packing: 0 })}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-stone-50"
        >
          + Item by name
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-stone-100 px-4 py-3 sm:grid-cols-4">
        <OrderMoney label="Discount / coupon" value={order.discount} onSave={(n) => onChange((o) => ({ ...o, discount: n }))} />
        <OrderMoney label="Delivery charged" hint="Paid by the customer" value={order.deliveryCharged} onSave={(n) => onChange((o) => ({ ...o, deliveryCharged: n }))} />
        <OrderMoney label="Delivery cost" hint="What delivery costs you" value={order.deliveryCost} onSave={(n) => onChange((o) => ({ ...o, deliveryCost: n }))} />
        <OrderMoney label="Order packing" hint="Box, card, bag" value={order.packing} onSave={(n) => onChange((o) => ({ ...o, packing: n }))} />
      </div>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-b-xl border-t border-stone-100 bg-stone-50/70 px-4 py-2.5 text-xs text-ink/60">
        <span>
          Revenue <span className="font-semibold tabular-nums text-ink">{rs(t.revenue)}</span>
        </span>
        <span>
          Cost <span className="tabular-nums">{rs(t.cost)}</span>
        </span>
        <span>
          {t.profit < 0 ? 'Loss' : 'Profit'}{' '}
          <span className={`font-semibold tabular-nums ${t.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{signed(t.profit)}</span>
        </span>
        {order.times > 1 ? (
          <span className="font-medium text-ink">
            × {order.times} = {t.profit < 0 ? 'loss' : 'profit'} {signed(t.profit * order.times)}
          </span>
        ) : null}
      </footer>
    </article>
  )
}

function OrderMoney({ label, hint, value, onSave }: { label: string; hint?: string; value: number; onSave: (n: number) => void }) {
  return (
    <label className="text-xs font-medium text-ink/60" title={hint}>
      {label}
      <div className="mt-1">
        <PriceCell width="w-full" label={label} value={value} onSave={(v) => onSave(num(v))} />
      </div>
      {hint ? <span className="mt-0.5 block text-[11px] font-normal text-ink/40">{hint}</span> : null}
    </label>
  )
}

function ProductSearch({ onPick, onLocked }: { onPick: (p: ProductHit) => void; onLocked: () => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ProductHit[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setHits([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      api<{ rows: ProductHit[] }>(`/api/admin/inventory/products?search=${encodeURIComponent(q)}&perPage=20`)
        .then((d) => !cancelled && setHits(d.rows))
        .catch((err) => {
          if (!cancelled && (err as { locked?: boolean }).locked) onLocked()
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, onLocked])

  return (
    <div className="relative w-full max-w-xs">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="+ Add a product (search)"
        aria-label="Search products to add"
        className={inputClass}
      />
      {open && hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(p)
                  setQuery('')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50"
              >
                <Thumb src={p.image} size="h-7 w-7" />
                <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                <span className="tabular-nums text-ink/55">{rs(p.salePrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ sheet-wide costs and totals

function OtherCosts({ data, onChange }: { data: SheetData; onChange: (fn: (d: SheetData) => SheetData) => void }) {
  const setCost = (key: string, patch: Partial<SheetData['costs'][number]>) =>
    onChange((d) => ({ ...d, costs: d.costs.map((c) => (c.key === key ? { ...c, ...patch } : c)) }))
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Other costs for the season</h3>
          <p className="text-xs text-ink/50">Stall or shop rent, ads, extra staff, decoration… counted once for the whole sheet.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange((d) => ({ ...d, costs: [...d.costs, { key: newKey(), label: '', amount: 0 }] }))}
          className={`${adminButtonClass.secondary} shrink-0 whitespace-nowrap`}
        >
          + Add cost
        </button>
      </div>
      {data.costs.length ? (
        <div className="mt-3 space-y-2">
          {data.costs.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <input
                value={c.label}
                maxLength={200}
                onChange={(e) => setCost(c.key, { label: e.target.value })}
                placeholder="e.g. Facebook ads"
                aria-label="What the cost is for"
                className={`${inputClass} flex-1`}
              />
              <PriceCell width="w-28" label={`Amount for ${c.label || 'cost'}`} value={c.amount} onSave={(v) => setCost(c.key, { amount: num(v) })} />
              <button
                type="button"
                onClick={() => onChange((d) => ({ ...d, costs: d.costs.filter((x) => x.key !== c.key) }))}
                className="rounded p-1.5 text-ink/35 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${c.label || 'cost'}`}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Breakdown({ totals: t }: { totals: SheetTotals }) {
  const row = (label: string, value: string, tone: 'plain' | 'less' | 'bold' = 'plain') => (
    <div className={`flex items-center justify-between gap-4 py-1 text-sm ${tone === 'bold' ? 'font-semibold text-ink' : 'text-ink/70'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${tone === 'less' ? 'text-ink/60' : ''}`}>{value}</span>
    </div>
  )
  return (
    <section className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-2">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-ink">Money in</h3>
        {row(`Item sales (${t.items} items)`, rs(t.sales))}
        {row('Discounts and coupons', `−${rs(t.discount)}`, 'less')}
        {row('Delivery charged', `+${rs(t.deliveryCharged)}`)}
        <div className="mt-1 border-t border-stone-200 pt-1">{row('Revenue', rs(t.revenue), 'bold')}</div>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-ink">Money out</h3>
        {row('Purchase cost', rs(t.purchase))}
        {row('Packing', rs(t.packing))}
        {row('Delivery cost', rs(t.deliveryCost))}
        {row('Other costs', rs(t.otherCosts))}
        <div className="mt-1 border-t border-stone-200 pt-1">{row('Total cost', rs(t.cost), 'bold')}</div>
      </div>
      <div
        className={`flex items-center justify-between rounded-lg px-4 py-3 md:col-span-2 ${t.profit < 0 ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}
      >
        <span className="text-base font-semibold">{t.profit < 0 ? 'Loss' : 'Profit'}</span>
        <span className="text-xl font-bold tabular-nums">
          {signed(t.profit)}
          {t.margin !== null ? <span className="ml-2 text-sm font-medium">({t.margin}% of revenue)</span> : null}
        </span>
      </div>
    </section>
  )
}
