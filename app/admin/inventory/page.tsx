'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminPageHeader, { adminButtonClass } from '@/components/admin/AdminPageHeader'
import ProductActiveSwitch from '@/components/admin/ProductActiveSwitch'
import { AdminIcons } from '@/components/admin/admin-nav'
import { resolveImageUrl } from '@/lib/image-url'
import { uploadProductImage } from '@/lib/upload-image'
import { formatPriceNoDecimals } from '@/lib/utils'

type StockStatus = 'in' | 'low' | 'out' | 'untracked'
type Filter = StockStatus | 'hamper' | 'all'

type HamperPart = {
  productId: string
  name: string
  image: string
  quantity: number
  unitCost: number | null
  salePrice: number
  available: number | null
}

type Row = {
  id: string
  name: string
  sku: string | null
  category: string
  image: string
  isAvailable: boolean
  trackStock: boolean
  countedQty: number | null
  countedAt: string | null
  soldSinceCount: number
  available: number | null
  status: StockStatus
  costPrice: number | null
  packagingCost: number | null
  unitCost: number | null
  price: number
  discount: number
  salePrice: number
  unitProfit: number | null
  marginPercent: number | null
  hamper: HamperPart[] | null
}

type Summary = {
  products: number
  tracked: number
  inStock: number
  lowStock: number
  outOfStock: number
  untracked: number
  hampers: number
  withoutPurchasePrice: number
  stockValueAtCost: number
  stockValueAtSale: number
}

type Bucket = {
  key: string
  orders: number
  itemSales: number
  discounts: number
  netSales: number
  cost: number
  profit: number
  uncostedSales: number
  deliveryFees: number
}

type Report = {
  from: string
  to: string
  groupBy: 'day' | 'month'
  /** Orders in range switched off or deleted in the Orders tab. */
  leftOut: number
  totals: Bucket
  buckets: Bucket[]
  topBySales: Array<{ id: string; name: string; quantity: number; sales: number; profit: number | null }>
  topByProfit: Array<{ id: string; name: string; quantity: number; sales: number; profit: number | null }>
}

type OrderView = 'all' | 'counted' | 'off' | 'deleted'

type InvOrderLine = {
  id: string
  productId: string
  name: string
  image: string
  orderedQty: number
  orderedPrice: number
  quantity: number
  price: number
  edited: boolean
  unitCost: number | null
  profit: number | null
}

type InvOrder = {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  source: 'UPAHARO' | 'OFFLINE'
  channel: string | null
  customer: string
  counted: boolean
  deletedAt: string | null
  lines: InvOrderLine[]
  itemSales: number
  discounts: number
  netSales: number
  cost: number
  profit: number
  uncostedSales: number
  deliveryFee: number
}

// Two series validated for contrast and colour-blind separation.
const SALES_COLOR = '#a8385a'
const PROFIT_COLOR = '#3b7dd8'

const rs = (n: number) => formatPriceNoDecimals(Math.round(n))
const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/10'

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`) as Error & { locked?: boolean }
    error.locked = res.status === 423
    throw error
  }
  return data as T
}

// ------------------------------------------------------------------ PIN

function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    if (value.length < 4 || busy) return
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/inventory/lock', { method: 'POST', body: JSON.stringify({ pin: value }) })
      onUnlocked()
    } catch (err) {
      setError((err as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const press = (digit: string) => {
    if (busy) return
    setError('')
    setPin((p) => (p.length < 8 ? p + digit : p))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Enter') void submit(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-stone-200 bg-white p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wine/10 text-wine">
        <AdminIcons.Key className="h-6 w-6" />
      </span>
      <h2 className="mt-3 text-lg font-semibold text-ink">Inventory is locked</h2>
      <p className="mt-1 text-sm text-ink/55">Enter the inventory PIN to see stock, purchase prices and profit.</p>
      <div className="mt-5 flex justify-center gap-2" aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(5, pin.length) }).map((_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-wine' : 'bg-stone-200'}`} />
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-12 rounded-xl bg-stone-100 text-lg font-semibold text-ink hover:bg-stone-200">
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} className="h-12 rounded-xl text-sm font-medium text-ink/60 hover:bg-stone-100" aria-label="Delete last digit">
          ⌫
        </button>
        <button type="button" onClick={() => press('0')} className="h-12 rounded-xl bg-stone-100 text-lg font-semibold text-ink hover:bg-stone-200">
          0
        </button>
        <button
          type="button"
          onClick={() => void submit(pin)}
          disabled={pin.length < 4 || busy}
          className="h-12 rounded-xl bg-wine text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? '…' : 'Unlock'}
        </button>
      </div>
    </div>
  )
}

function ChangePin({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== again) return setMessage('The new PINs don’t match')
    setBusy(true)
    try {
      await api('/api/admin/inventory/pin', { method: 'POST', body: JSON.stringify({ currentPin: current, newPin: next }) })
      setMessage('PIN changed.')
      setCurrent('')
      setNext('')
      setAgain('')
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const pinInput = (value: string, set: (v: string) => void, label: string) => (
    <label className="text-sm font-medium text-ink">
      {label}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
        className={`mt-1 ${inputClass}`}
      />
    </label>
  )
  return (
    <form onSubmit={save} className="mb-5 grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-4 sm:items-end">
      {pinInput(current, setCurrent, 'Current PIN')}
      {pinInput(next, setNext, 'New PIN (4–8 digits)')}
      {pinInput(again, setAgain, 'New PIN again')}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={adminButtonClass.primary}>
          Save PIN
        </button>
        <button type="button" onClick={onClose} className={adminButtonClass.secondary}>
          Close
        </button>
      </div>
      {message ? <p className="text-sm text-ink/70 sm:col-span-4">{message}</p> : null}
    </form>
  )
}

// ------------------------------------------------------------------ Stock

const STATUS_LABEL: Record<StockStatus, string> = { in: 'In stock', low: 'Low stock', out: 'Out of stock', untracked: 'Not tracked' }
const STATUS_STYLE: Record<StockStatus, string> = {
  in: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  low: 'bg-amber-50 text-amber-800 ring-amber-200',
  out: 'bg-red-50 text-red-700 ring-red-200',
  untracked: 'bg-stone-100 text-ink/60 ring-stone-200',
}

function PriceCell({
  value,
  onSave,
  placeholder,
  width = 'w-24',
  label,
  whole = false,
}: {
  value: number | null
  onSave: (v: string) => void
  placeholder?: string
  width?: string
  label?: string
  /** Whole numbers (quantities). */
  whole?: boolean
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  useEffect(() => setDraft(value === null ? '' : String(value)), [value])
  return (
    <input
      inputMode={whole ? 'numeric' : 'decimal'}
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const before = value === null ? '' : String(value)
        if (draft.trim() !== before) onSave(draft.trim())
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`${inputClass} ${width} text-right`}
    />
  )
}

function StockCell({ row, onPatch }: { row: Row; onPatch: (body: Record<string, unknown>) => void }) {
  const [add, setAdd] = useState('')
  const [count, setCount] = useState('')
  if (row.hamper) {
    return (
      <div className="min-w-[11rem]">
        {row.available === null ? (
          <p className="text-xs text-ink/45">Its items aren’t tracked</p>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tabular-nums text-ink">{row.available}</span>
            <span className="text-xs text-ink/45">can be made</span>
          </div>
        )}
        <ul className="mt-0.5 space-y-0.5 text-[11px] text-ink/50">
          {row.hamper.map((part) => (
            <li key={part.productId} className="max-w-[14rem] truncate" title={part.name}>
              {part.quantity} × {part.name}
              {part.available !== null ? ` · ${part.available} left` : ''}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (!row.trackStock) {
    return (
      <button type="button" onClick={() => onPatch({ trackStock: true })} className="text-xs font-semibold text-wine hover:underline">
        Track stock
      </button>
    )
  }
  return (
    <div className="min-w-[11rem]">
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-ink">{row.available}</span>
        <span className="text-xs text-ink/45">left</span>
      </div>
      <p className="text-[11px] text-ink/45">
        Counted {row.countedQty}
        {row.countedAt ? ` on ${new Date(row.countedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
        {row.soldSinceCount ? ` · ${row.soldSinceCount} sold since` : ''}
      </p>
      <div className="mt-1.5 flex items-center gap-1">
        <input
          inputMode="numeric"
          value={add}
          onChange={(e) => setAdd(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="+ qty"
          className="w-16 rounded-md border border-stone-300 px-2 py-1 text-xs"
          aria-label={`Units received for ${row.name}`}
        />
        <button
          type="button"
          disabled={!add}
          onClick={() => {
            onPatch({ addStock: Number(add) })
            setAdd('')
          }}
          className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-ink disabled:opacity-40"
        >
          Add
        </button>
        <input
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="count"
          className="w-16 rounded-md border border-stone-300 px-2 py-1 text-xs"
          aria-label={`New stock count for ${row.name}`}
        />
        <button
          type="button"
          disabled={count === ''}
          onClick={() => {
            onPatch({ setStock: Number(count) })
            setCount('')
          }}
          className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-ink disabled:opacity-40"
        >
          Set
        </button>
      </div>
    </div>
  )
}

function AddCustomItem({ categories, onAdded, onClose }: { categories: string[]; onAdded: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', category: '', costPrice: '', packagingCost: '', price: '', stock: '', sku: '', sellOnline: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const margin =
    Number(form.price) > 0 && form.costPrice !== ''
      ? Number(form.price) - Number(form.costPrice) - (Number(form.packagingCost) || 0)
      : null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/inventory/products', { method: 'POST', body: JSON.stringify(form) })
      onAdded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-5 space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Add a custom item</h3>
        <button type="button" onClick={onClose} className="text-sm text-ink/50 hover:text-ink">
          Close
        </button>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-ink sm:col-span-2">
          Name
          <input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm font-medium text-ink">
          Category
          <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={`mt-1 ${inputClass}`}>
            <option value="">Custom item</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-ink">
          Purchase price (Rs)
          <input inputMode="decimal" value={form.costPrice} onChange={(e) => set({ costPrice: e.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm font-medium text-ink">
          Packaging cost (Rs)
          <input inputMode="decimal" value={form.packagingCost} onChange={(e) => set({ packagingCost: e.target.value })} placeholder="Box, wrap, ribbon…" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm font-medium text-ink">
          Selling price (Rs)
          <input required inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm font-medium text-ink">
          Stock in hand
          <input inputMode="numeric" value={form.stock} onChange={(e) => set({ stock: e.target.value.replace(/[^\d]/g, '') })} placeholder="Leave empty to not track" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm font-medium text-ink">
          SKU (optional)
          <input value={form.sku} onChange={(e) => set({ sku: e.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink sm:col-span-3">
          <input type="checkbox" checked={form.sellOnline} onChange={(e) => set({ sellOnline: e.target.checked })} />
          Also sell it on the website and app (otherwise it stays in-store only, and can be used in offline orders)
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="text-sm text-ink/60">
          {margin !== null ? `Profit per unit: ${rs(margin)}${Number(form.price) > 0 ? ` (${Math.round((margin / Number(form.price)) * 100)}%)` : ''}` : ' '}
        </p>
        <button type="submit" disabled={busy} className={adminButtonClass.primary}>
          {busy ? 'Saving…' : 'Add item'}
        </button>
      </div>
    </form>
  )
}

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}

/** Asks for the inventory PIN again before a delete. onConfirm throws to show an error. */
function PinConfirm({
  title,
  detail,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
  onLocked,
}: {
  title: string
  detail: string
  confirmLabel?: string
  onConfirm: (pin: string) => Promise<void>
  onClose: () => void
  onLocked: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{4,8}$/.test(pin)) {
      setError('Enter your 4–8 digit inventory PIN.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onConfirm(pin)
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setError((err as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-confirm-title"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 id="pin-confirm-title" className="text-base font-semibold text-ink">
          {title}
        </h3>
        <p className="mt-1.5 text-sm text-ink/60">{detail}</p>
        <label className="mt-4 block text-xs font-medium text-ink/60">
          Inventory PIN
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className={`mt-1 ${inputClass} tracking-[0.3em]`}
          />
        </label>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={adminButtonClass.secondary}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

function Thumb({ src, size = 'h-10 w-10' }: { src: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolveImageUrl(src)} alt="" className={`${size} shrink-0 rounded-md bg-stone-100 object-cover`} />
  ) : (
    <span className={`${size} shrink-0 rounded-md bg-stone-100`} />
  )
}

/** Make or change a hamper: pick products and quantities, packaging, and a price. */
function HamperBuilder({
  categories,
  editing,
  onSaved,
  onClose,
  onLocked,
}: {
  categories: string[]
  editing: Row | null
  onSaved: (row: Row, created: boolean) => void
  onClose: () => void
  onLocked: () => void
}) {
  const [name, setName] = useState(editing?.name || '')
  const [category, setCategory] = useState(editing?.category || categories.find((c) => /hamper/i.test(c)) || '')
  const [items, setItems] = useState<HamperPart[]>(editing?.hamper || [])
  const [packaging, setPackaging] = useState(editing?.packagingCost != null ? String(editing.packagingCost) : '')
  const [price, setPrice] = useState(editing ? String(editing.price) : '')
  const [sellOnline, setSellOnline] = useState(editing ? editing.isAvailable : false)
  const [image, setImage] = useState(editing?.image || '')
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Row[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Categories can arrive after the form opens.
  useEffect(() => {
    if (category) return
    const hampers = categories.find((c) => /hamper/i.test(c))
    if (hampers) setCategory(hampers)
  }, [categories, category])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      api<{ rows: Row[] }>(`/api/admin/inventory/products?${new URLSearchParams({ search: q, perPage: '20' })}`)
        .then((data) => !cancelled && setResults(data.rows.filter((r) => !r.hamper && r.id !== editing?.id)))
        .catch((err) => {
          if (cancelled) return
          if ((err as { locked?: boolean }).locked) onLocked()
          else setError((err as Error).message)
        })
        .finally(() => !cancelled && setSearching(false))
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, editing?.id, onLocked])

  const addItem = (row: Row) =>
    setItems((prev) =>
      prev.some((i) => i.productId === row.id)
        ? prev.map((i) => (i.productId === row.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [
            ...prev,
            { productId: row.id, name: row.name, image: row.image, quantity: 1, unitCost: row.unitCost, salePrice: row.salePrice, available: row.available },
          ]
    )
  const setQuantity = (productId: string, quantity: number) =>
    setItems((prev) =>
      quantity <= 0 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    )

  const units = items.reduce((s, i) => s + i.quantity, 0)
  const missingCost = items.filter((i) => i.unitCost === null)
  const itemsCost = items.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0)
  const packagingValue = Number(packaging) || 0
  const totalCost = itemsCost + packagingValue
  const separately = items.reduce((s, i) => s + i.salePrice * i.quantity, 0)
  const priceValue = Number(price) || 0
  const profit = priceValue > 0 && missingCost.length === 0 ? priceValue - totalCost : null
  const tracked = items.filter((i) => i.available !== null)
  const canMake = tracked.length ? Math.min(...tracked.map((i) => Math.floor(i.available! / i.quantity))) : null
  const shownImage = image || items.find((i) => i.image)?.image || ''

  const upload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      setImage(await uploadProductImage(file))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = JSON.stringify({
        name,
        category,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        packagingCost: packaging.trim() === '' ? null : packaging.trim(),
        price: price.trim(),
        sellOnline,
        image,
      })
      const row = editing
        ? await api<Row>(`/api/admin/inventory/hampers/${editing.id}`, { method: 'PATCH', body })
        : await api<Row>('/api/admin/inventory/hampers', { method: 'POST', body })
      onSaved(row, !editing)
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-5 rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">{editing ? `Edit hamper: ${editing.name}` : 'Create a hamper'}</h3>
        <button type="button" onClick={onClose} className="text-sm text-ink/50 hover:text-ink">
          Close
        </button>
      </div>
      {error ? <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-5 p-4 lg:grid-cols-[1.2fr_1fr]">
        {/* What goes inside */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">What goes inside</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products to add (name or SKU)"
            className={inputClass}
            aria-label="Search products to add to the hamper"
          />
          {query.trim().length >= 2 ? (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200">
              {searching && results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink/50">Searching…</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink/50">No products match.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {results.map((row) => {
                    const inside = items.find((i) => i.productId === row.id)?.quantity
                    return (
                      <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                        <Thumb src={row.image} size="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink" title={row.name}>
                            {row.name}
                          </p>
                          <p className="text-[11px] text-ink/45">
                            Sells {rs(row.salePrice)} · {row.unitCost === null ? 'no purchase price' : `costs ${rs(row.unitCost)}`}
                            {row.available !== null ? ` · ${row.available} left` : ''}
                          </p>
                        </div>
                        <button type="button" onClick={() => addItem(row)} className="shrink-0 rounded-md bg-wine/10 px-2.5 py-1 text-xs font-semibold text-wine hover:bg-wine/15">
                          {inside ? `Add another (${inside})` : 'Add'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 px-3 py-6 text-center text-sm text-ink/50">
              Search above and add the products that go into this hamper.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
              {items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 px-3 py-2">
                  <Thumb src={item.image} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[11px] text-ink/45">
                      {item.unitCost === null ? (
                        <span className="text-amber-700">No purchase price</span>
                      ) : (
                        `${rs(item.unitCost)} each · ${rs(item.unitCost * item.quantity)}`
                      )}
                      {item.available !== null ? ` · ${item.available} left` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center rounded-md border border-stone-300">
                    <button type="button" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="px-2 py-1 text-sm text-ink/70 hover:bg-stone-50" aria-label={`One less ${item.name}`}>
                      −
                    </button>
                    <input
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => setQuantity(item.productId, Math.min(999, Number(e.target.value.replace(/[^\d]/g, '')) || 0))}
                      className="w-9 border-x border-stone-300 py-1 text-center text-sm tabular-nums"
                      aria-label={`How many ${item.name}`}
                    />
                    <button type="button" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="px-2 py-1 text-sm text-ink/70 hover:bg-stone-50" aria-label={`One more ${item.name}`}>
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => setQuantity(item.productId, 0)} className="shrink-0 text-xs text-ink/45 hover:text-red-600">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details and price */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink">
            Hamper name
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tihar Sweet Hamper" className={`mt-1 ${inputClass}`} />
          </label>
          <label className="block text-sm font-medium text-ink">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1 ${inputClass}`}>
              {categories.includes('Gift Hampers') ? null : <option value="">Gift Hampers</option>}
              {(category && !categories.includes(category) ? [category, ...categories] : categories).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <Thumb src={shownImage} size="h-14 w-14" />
            <div className="text-sm">
              <label className={`${adminButtonClass.secondary} cursor-pointer`}>
                {uploading ? 'Uploading…' : image ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0] || null)} />
              </label>
              <p className="mt-1 text-[11px] text-ink/45">{image ? ' ' : 'Uses the first item’s photo until you upload one.'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-ink">
              Packaging cost (Rs)
              <input inputMode="decimal" value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="Box, basket, wrap…" className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-sm font-medium text-ink">
              Selling price (Rs)
              <input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          {separately > 0 ? (
            <p className="text-[11px] text-ink/50">
              Bought separately these cost the customer {rs(separately)}.{' '}
              <button type="button" onClick={() => setPrice(String(Math.round(separately)))} className="font-semibold text-wine hover:underline">
                Use {rs(separately)}
              </button>
            </p>
          ) : null}

          <dl className="space-y-1.5 rounded-lg bg-stone-50 px-3 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">
                Items ({units} {units === 1 ? 'piece' : 'pieces'})
              </dt>
              <dd className="tabular-nums text-ink">{rs(itemsCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Packaging</dt>
              <dd className="tabular-nums text-ink">{rs(packagingValue)}</dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-1.5 font-medium">
              <dt className="text-ink">Cost of one hamper</dt>
              <dd className="tabular-nums text-ink">{rs(totalCost)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt className="text-ink">Profit per hamper</dt>
              <dd className={`tabular-nums ${profit !== null && profit < 0 ? 'text-red-600' : 'text-ink'}`}>
                {profit === null ? '—' : `${rs(profit)}${priceValue > 0 ? ` (${Math.round((profit / priceValue) * 100)}%)` : ''}`}
              </dd>
            </div>
            {missingCost.length > 0 ? (
              <p className="pt-1 text-[11px] text-amber-800">
                {missingCost.length === 1 ? `${missingCost[0].name} has` : `${missingCost.length} items have`} no purchase price yet, so the profit can’t be worked out.
              </p>
            ) : null}
            {canMake !== null ? (
              <p className="pt-1 text-[11px] text-ink/55">
                With the stock in hand you can make {canMake} {canMake === 1 ? 'hamper' : 'hampers'}. Each one sold takes its items out of stock.
              </p>
            ) : null}
          </dl>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={sellOnline} onChange={(e) => setSellOnline(e.target.checked)} />
            Sell it on the website and app
          </label>
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
            <button type="button" onClick={onClose} className={adminButtonClass.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={busy || uploading || units < 2} className={adminButtonClass.primary}>
              {busy ? 'Saving…' : editing ? 'Save hamper' : 'Create hamper'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function StockTab({ onLocked }: { onLocked: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [status, setStatus] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [adding, setAdding] = useState(false)
  // null = closed, 'new' = creating, a row = editing that hamper.
  const [hamperForm, setHamperForm] = useState<Row | 'new' | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [debounced, status, perPage])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status, page: String(page), perPage: String(perPage) })
      if (debounced) params.set('search', debounced)
      const data = await api<{ rows: Row[]; total: number; totalPages: number; summary: Summary }>(`/api/admin/inventory/products?${params}`)
      setRows(data.rows)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setSummary(data.summary)
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [status, page, perPage, debounced, onLocked])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    fetch('/api/categories?type=PRODUCT', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCategories((Array.isArray(data) ? data : []).map((c: { name?: string }) => String(c?.name || '')).filter(Boolean)))
      .catch(() => undefined)
  }, [])

  const patch = async (row: Row, body: Record<string, unknown>) => {
    setSaving(row.id)
    setMessage('')
    try {
      const updated = await api<Row>(`/api/admin/inventory/products/${row.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setMessage(`${row.name}: ${(err as Error).message}`)
    } finally {
      setSaving(null)
    }
  }

  const chips: Array<{ id: Filter; label: string; count?: number }> = [
    { id: 'all', label: 'All', count: summary?.products },
    { id: 'in', label: 'In stock', count: summary?.inStock },
    { id: 'low', label: 'Low stock', count: summary?.lowStock },
    { id: 'out', label: 'Out of stock', count: summary?.outOfStock },
    { id: 'untracked', label: 'Not tracked', count: summary?.untracked },
    { id: 'hamper', label: 'Hampers', count: summary?.hampers },
  ]
  const openHamper = (value: Row | 'new') => {
    setAdding(false)
    setHamperForm(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tracked products" value={String(summary?.tracked ?? '—')} hint={`${summary?.inStock ?? 0} in stock · ${summary?.lowStock ?? 0} low`} />
        <Kpi label="Out of stock" value={String(summary?.outOfStock ?? '—')} hint="Tracked products with 0 left" tone={summary?.outOfStock ? 'red' : undefined} />
        <Kpi label="Stock value (purchase)" value={summary ? rs(summary.stockValueAtCost) : '—'} hint="What the stock in hand cost" />
        <Kpi label="Stock value (selling)" value={summary ? rs(summary.stockValueAtSale) : '—'} hint="At today’s selling prices" />
      </div>
      {summary && summary.withoutPurchasePrice > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {summary.withoutPurchasePrice.toLocaleString()} products have no purchase price yet. Add it below so their profit can be worked out.
        </p>
      ) : null}

      {adding ? (
        <AddCustomItem
          categories={categories}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            setMessage('Custom item added.')
            void load()
          }}
        />
      ) : null}

      {hamperForm ? (
        <HamperBuilder
          key={hamperForm === 'new' ? 'new' : hamperForm.id}
          categories={categories}
          editing={hamperForm === 'new' ? null : hamperForm}
          onLocked={onLocked}
          onClose={() => setHamperForm(null)}
          onSaved={(row, created) => {
            setHamperForm(null)
            setMessage(created ? `Hamper “${row.name}” created.` : `Hamper “${row.name}” saved.`)
            if (created) void load()
            else setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)))
          }}
        />
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatus(chip.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === chip.id ? 'bg-wine text-white' : 'bg-white text-ink/70 ring-1 ring-stone-200 hover:bg-stone-50'}`}
            >
              {chip.label}
              {chip.count !== undefined ? <span className="ml-1 opacity-70">{chip.count.toLocaleString()}</span> : null}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU" className={`${inputClass} w-56`} />
          {!hamperForm ? (
            <button type="button" onClick={() => openHamper('new')} className={adminButtonClass.secondary}>
              + Create hamper
            </button>
          ) : null}
          {!adding ? (
            <button
              type="button"
              onClick={() => {
                setHamperForm(null)
                setAdding(true)
              }}
              className={adminButtonClass.primary}
            >
              + Custom item
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-ink/70">{message}</p> : null}

      {deleting ? (
        <PinConfirm
          title={`Delete “${deleting.name}”?`}
          detail={
            deleting.hamper
              ? 'The hamper comes off the website and out of Inventory. Its items stay. Past orders keep it.'
              : 'It comes off the website, the product list and Inventory. Past orders keep it.'
          }
          onLocked={onLocked}
          onClose={() => setDeleting(null)}
          onConfirm={async (pin) => {
            await api(`/api/admin/inventory/products/${deleting.id}`, { method: 'DELETE', body: JSON.stringify({ pin }) })
            setMessage(`“${deleting.name}” deleted.`)
            setDeleting(null)
            void load()
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-ink/50">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Stock</th>
              <th className="px-4 py-2.5 text-right">Purchase price</th>
              <th className="px-4 py-2.5 text-right">Packaging</th>
              <th className="px-4 py-2.5 text-right">Selling price</th>
              <th className="px-4 py-2.5 text-right">Profit / unit</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">On sale</th>
              <th className="px-2 py-2.5">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink/50">
                  Loading stock…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink/50">
                  {status === 'hamper' ? 'No hampers yet. Use “+ Create hamper” to make one from your products.' : 'Nothing here.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={saving === row.id ? 'opacity-60' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb src={row.image} />
                      <div className="min-w-0">
                        <p className="max-w-[16rem] truncate font-medium text-ink" title={row.name}>
                          {row.name}
                        </p>
                        <p className="text-xs text-ink/45">
                          {row.hamper ? (
                            <>
                              <span className="mr-1 rounded bg-wine/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-wine">Hamper</span>
                              {row.hamper.reduce((s, p) => s + p.quantity, 0)} pieces ·{' '}
                              <button type="button" onClick={() => openHamper(row)} className="font-semibold text-wine hover:underline">
                                Edit
                              </button>
                            </>
                          ) : (
                            <>
                              {row.category}
                              {row.sku ? ` · SKU ${row.sku}` : ''}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StockCell row={row} onPatch={(body) => void patch(row, body)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.hamper ? (
                      <span className="text-xs text-ink/55" title="What its items cost">
                        Items{' '}
                        {row.unitCost === null ? (
                          <span className="text-amber-700">need prices</span>
                        ) : (
                          <span className="font-medium tabular-nums text-ink">{rs(row.unitCost - (row.packagingCost || 0))}</span>
                        )}
                      </span>
                    ) : (
                      <PriceCell value={row.costPrice} placeholder="Add" onSave={(v) => void patch(row, { costPrice: v === '' ? null : v })} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PriceCell value={row.packagingCost} placeholder="0" onSave={(v) => void patch(row, { packagingCost: v === '' ? null : v })} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PriceCell value={row.price} onSave={(v) => void patch(row, { price: v })} />
                    {row.discount > 0 ? (
                      <p className="mt-0.5 text-[11px] text-ink/45">
                        {Math.round(row.discount * 100) / 100}% off → {rs(row.salePrice)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.unitProfit === null || row.unitCost === null ? (
                      <span className="text-xs text-ink/40">{row.hamper ? 'Needs item purchase prices' : 'Needs purchase price'}</span>
                    ) : (
                      <>
                        <span className={row.unitProfit < 0 ? 'font-semibold text-red-600' : 'font-semibold text-ink'}>{rs(row.unitProfit)}</span>
                        <p className="text-[11px] text-ink/45">
                          Cost {rs(row.unitCost)} · {row.marginPercent}% margin
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProductActiveSwitch
                      active={row.isAvailable}
                      busy={saving === row.id}
                      label={row.name}
                      onChange={(next) => void patch(row, { isAvailable: next })}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleting(row)}
                      className="rounded-md p-1.5 text-ink/35 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${row.name}`}
                      title="Delete (asks for the PIN)"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink/55">
        <span>
          {total.toLocaleString()} products
          <label className="ml-3">
            Show{' '}
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="rounded-md border border-stone-300 bg-white px-1.5 py-1">
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>{' '}
            per page
          </label>
        </span>
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

// ------------------------------------------------------------------ Reports

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000
const nepalToday = () => new Date(Date.now() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)
const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

function presets() {
  const today = nepalToday()
  const [y, m] = today.split('-').map(Number)
  const monthStart = `${today.slice(0, 7)}-01`
  const lastMonthEnd = shiftDay(monthStart, -1)
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`
  const pad = (n: number) => String(n).padStart(2, '0')
  const threeMonthsStart = `${m <= 2 ? y - 1 : y}-${pad(((m - 3 + 12) % 12) + 1)}-01`
  return [
    { id: 'today', label: 'Today', from: today, to: today },
    { id: 'yesterday', label: 'Yesterday', from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { id: '7d', label: 'Last 7 days', from: shiftDay(today, -6), to: today },
    { id: 'month', label: 'This month', from: monthStart, to: today },
    { id: 'lastMonth', label: 'Last month', from: lastMonthStart, to: lastMonthEnd },
    { id: '3m', label: 'Last 3 months', from: threeMonthsStart, to: today },
    { id: 'year', label: `This year (${y})`, from: `${y}-01-01`, to: today },
    // Festival seasons (Nepal): Ghatasthapana to Chhath.
    { id: 'dashain-tihar-2026', label: 'Dashain–Tihar 2026', from: '2026-10-11', to: '2026-11-15' },
  ]
}

function ReportTab({ onLocked }: { onLocked: () => void }) {
  const options = useMemo(presets, [])
  const [preset, setPreset] = useState('today')
  const [from, setFrom] = useState(options[0].from)
  const [to, setTo] = useState(options[0].to)
  const [source, setSource] = useState<'all' | 'online' | 'offline'>('all')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hover, setHover] = useState<number | null>(null)

  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  const groupBy = days > 62 ? 'month' : 'day'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api<Report>(`/api/admin/inventory/report?from=${from}&to=${to}&groupBy=${groupBy}&source=${source}`)
      .then((data) => !cancelled && setReport(data))
      .catch((err) => {
        if (cancelled) return
        if ((err as { locked?: boolean }).locked) onLocked()
        else setError((err as Error).message)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [from, to, source, groupBy, onLocked])

  const t = report?.totals
  const margin = t && t.netSales - t.uncostedSales > 0 ? Math.round((t.profit / (t.netSales - t.uncostedSales)) * 1000) / 10 : null
  const max = Math.max(1, ...(report?.buckets || []).map((b) => Math.max(b.netSales, b.profit)))
  const label = (key: string) =>
    groupBy === 'month'
      ? new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })
      : new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              setPreset(o.id)
              setFrom(o.from)
              setTo(o.to)
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${preset === o.id ? 'bg-wine text-white' : 'bg-white text-ink/70 ring-1 ring-stone-200 hover:bg-stone-50'}`}
          >
            {o.label}
          </button>
        ))}
        <label className="text-xs text-ink/55">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setPreset('custom')
              setFrom(e.target.value)
            }}
            className={`mt-0.5 ${inputClass} w-auto`}
          />
        </label>
        <label className="text-xs text-ink/55">
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setPreset('custom')
              setTo(e.target.value)
            }}
            className={`mt-0.5 ${inputClass} w-auto`}
          />
        </label>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={`${inputClass} w-auto`} aria-label="Order source">
          <option value="all">Online + offline</option>
          <option value="online">Online only</option>
          <option value="offline">Offline only</option>
        </select>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Sales" value={t ? rs(t.netSales) : '—'} hint={t ? `${t.orders} orders · after ${rs(t.discounts)} discounts` : ' '} loading={loading} />
        <Kpi label="Cost" value={t ? rs(t.cost) : '—'} hint="Purchase + packaging, items with a price" loading={loading} />
        <Kpi label="Profit" value={t ? rs(t.profit) : '—'} hint={margin !== null ? `${margin}% margin` : 'Add purchase prices'} loading={loading} tone={t && t.profit < 0 ? 'red' : undefined} />
        <Kpi label="Delivery fees" value={t ? rs(t.deliveryFees) : '—'} hint="Collected, not in profit" loading={loading} />
        <Kpi label="Avg. order" value={t && t.orders ? rs(t.netSales / t.orders) : '—'} hint={`${from === to ? label(from) : `${label(from)} – ${label(to)}`}`} loading={loading} />
      </div>
      {report && report.leftOut > 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-ink/70">
          {report.leftOut === 1
            ? '1 order in this period is switched off or deleted in the Orders tab, so it isn’t counted here.'
            : `${report.leftOut} orders in this period are switched off or deleted in the Orders tab, so they aren’t counted here.`}
        </p>
      ) : null}
      {t && t.uncostedSales > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {rs(t.uncostedSales)} of these sales are of items without a purchase price, so they aren’t in the profit. Add purchase prices in the Stock tab.
        </p>
      ) : null}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{groupBy === 'month' ? 'Sales and profit by month' : 'Daily sales and profit'}</h3>
          <div className="flex items-center gap-4 text-xs text-ink/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SALES_COLOR }} /> Sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PROFIT_COLOR }} /> Profit
            </span>
          </div>
        </div>
        {report && report.buckets.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="relative flex h-48 w-full items-end gap-1 border-b border-stone-200 pt-6" style={{ minWidth: report.buckets.length * 16 }}>
              {report.buckets.map((b, i) => (
                <button
                  key={b.key}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="relative flex h-full min-w-[14px] flex-1 items-end justify-center gap-[2px] focus:outline-none"
                  aria-label={`${label(b.key)}: sales ${rs(b.netSales)}, profit ${rs(b.profit)}, ${b.orders} orders`}
                >
                  <span className="block w-1/2 max-w-[18px] rounded-t" style={{ height: `${(Math.max(0, b.netSales) / max) * 100}%`, background: SALES_COLOR, opacity: hover === null || hover === i ? 1 : 0.45 }} />
                  <span className="block w-1/2 max-w-[18px] rounded-t" style={{ height: `${(Math.max(0, b.profit) / max) * 100}%`, background: PROFIT_COLOR, opacity: hover === null || hover === i ? 1 : 0.45 }} />
                  {hover === i ? (
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-xs shadow-lg">
                      <span className="block font-medium text-ink">{label(b.key)}</span>
                      <span className="block text-ink/70">Sales {rs(b.netSales)} · Profit {rs(b.profit)}</span>
                      <span className="block text-ink/50">{b.orders} orders</span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex w-full gap-1" style={{ minWidth: report.buckets.length * 16 }} aria-hidden>
              {report.buckets.map((b, i) => (
                <span key={b.key} className="min-w-[14px] flex-1 truncate text-center text-[10px] text-ink/45">
                  {i % Math.max(1, Math.ceil(report.buckets.length / 10)) === 0 ? label(b.key) : ''}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-ink/50">{loading ? 'Loading…' : 'No sales in this period.'}</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-ink/50">
            <tr>
              <th className="px-4 py-2.5">{groupBy === 'month' ? 'Month' : 'Day'}</th>
              <th className="px-4 py-2.5 text-right">Orders</th>
              <th className="px-4 py-2.5 text-right">Item sales</th>
              <th className="px-4 py-2.5 text-right">Discounts</th>
              <th className="px-4 py-2.5 text-right">Sales</th>
              <th className="px-4 py-2.5 text-right">Cost</th>
              <th className="px-4 py-2.5 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 tabular-nums">
            {(report?.buckets || [])
              .filter((b) => b.orders > 0 || (report?.buckets.length ?? 0) <= 31)
              .slice()
              .reverse()
              .map((b) => (
                <tr key={b.key}>
                  <td className="px-4 py-2 text-ink">{label(b.key)}</td>
                  <td className="px-4 py-2 text-right">{b.orders}</td>
                  <td className="px-4 py-2 text-right">{rs(b.itemSales)}</td>
                  <td className="px-4 py-2 text-right text-ink/60">{b.discounts ? `−${rs(b.discounts)}` : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium text-ink">{rs(b.netSales)}</td>
                  <td className="px-4 py-2 text-right text-ink/60">{rs(b.cost)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${b.profit < 0 ? 'text-red-600' : 'text-ink'}`}>{rs(b.profit)}</td>
                </tr>
              ))}
            {t ? (
              <tr className="bg-stone-50 font-semibold text-ink">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right">{t.orders}</td>
                <td className="px-4 py-2.5 text-right">{rs(t.itemSales)}</td>
                <td className="px-4 py-2.5 text-right">{t.discounts ? `−${rs(t.discounts)}` : '—'}</td>
                <td className="px-4 py-2.5 text-right">{rs(t.netSales)}</td>
                <td className="px-4 py-2.5 text-right">{rs(t.cost)}</td>
                <td className="px-4 py-2.5 text-right">{rs(t.profit)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Best sellers" rows={report?.topBySales || []} value={(r) => rs(r.sales)} />
        <TopList title="Most profit" rows={report?.topByProfit || []} value={(r) => rs(r.profit ?? 0)} empty="Add purchase prices to see profit by product." />
      </div>
    </div>
  )
}

function TopList({
  title,
  rows,
  value,
  empty = 'No sales in this period.',
}: {
  title: string
  rows: Report['topBySales']
  value: (r: Report['topBySales'][number]) => string
  empty?: string
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white">
      <h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink/50">{empty}</p>
      ) : (
        <ol className="divide-y divide-stone-100">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-5 text-ink/40">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
              <span className="text-xs text-ink/45">×{r.quantity}</span>
              <span className="w-24 text-right font-semibold tabular-nums text-ink">{value(r)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ Orders

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
}

const orderDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Kathmandu',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

/** On/off switch for whether an order counts in stock and profit. */
function CountSwitch({ counted, busy, label, onChange }: { counted: boolean; busy: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={counted}
      aria-label={`${label}: ${counted ? 'counts in stock and profit' : 'not counted'}`}
      title={counted ? 'Counts in stock and profit. Click to switch off.' : 'Not counted. Click to count it.'}
      disabled={busy}
      onClick={() => onChange(!counted)}
      className="group inline-flex items-center gap-2 rounded-full py-1 focus:outline-none disabled:cursor-wait disabled:opacity-70"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          counted ? 'bg-green-600' : 'bg-ink/25'
        } group-focus-visible:ring-2 group-focus-visible:ring-wine/30 group-focus-visible:ring-offset-1`}
      >
        <span className={`inline-flex h-5 w-5 rounded-full bg-white shadow transition-transform ${counted ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
      <span className={`w-20 text-left text-xs font-semibold ${counted ? 'text-green-700' : 'text-ink/55'}`}>{counted ? 'Counted' : 'Switched off'}</span>
    </button>
  )
}

function OrderCard({
  order,
  busy,
  deletedView,
  selected,
  onSelect,
  onPatch,
  onDelete,
}: {
  order: InvOrder
  busy: boolean
  deletedView: boolean
  selected: boolean
  onSelect: (on: boolean) => void
  onPatch: (body: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const uncosted = order.lines.some((l) => l.unitCost === null && l.quantity > 0)
  return (
    <article className={`rounded-xl border border-stone-200 ${order.counted ? 'bg-white' : 'bg-stone-50'} ${busy ? 'opacity-60' : ''}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-100 px-4 py-3">
        {!deletedView ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Select order #${order.orderNumber}`}
            className="h-4 w-4 rounded border-stone-300 accent-wine"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
            #{order.orderNumber}
            <span className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${order.source === 'OFFLINE' ? 'bg-sky-50 text-sky-800' : 'bg-wine/10 text-wine'}`}>
              {order.source === 'OFFLINE' ? `Offline${order.channel ? ` · ${order.channel.replace(/_/g, ' ').toLowerCase()}` : ''}` : 'Online'}
            </span>
            <span className="rounded bg-stone-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-ink/60">
              {ORDER_STATUS_LABEL[order.status] || order.status}
            </span>
          </p>
          <p className="mt-0.5 truncate text-xs text-ink/50">
            {orderDate(order.createdAt)}
            {order.customer ? ` · ${order.customer}` : ''}
          </p>
        </div>
        {deletedView ? (
          <button type="button" disabled={busy} onClick={() => onPatch({ restore: true })} className={adminButtonClass.secondary}>
            Put back
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <CountSwitch counted={order.counted} busy={busy} label={`Order #${order.orderNumber}`} onChange={(next) => onPatch({ counted: next })} />
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1.5 text-ink/35 hover:bg-red-50 hover:text-red-600"
              aria-label={`Delete order #${order.orderNumber} from Inventory`}
              title="Delete from Inventory (asks for the PIN)"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </header>

      <div className="divide-y divide-stone-100">
        {order.lines.map((line) => (
          <div key={line.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
            <Thumb src={line.image} size="h-9 w-9" />
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-sm font-medium text-ink" title={line.name}>
                {line.name}
              </p>
              {line.edited ? (
                <p className="text-[11px] text-ink/45">
                  Ordered {line.orderedQty} × {rs(line.orderedPrice)} ·{' '}
                  <button
                    type="button"
                    disabled={busy || deletedView}
                    onClick={() => onPatch({ lines: [{ id: line.id, quantity: null, price: null }] })}
                    className="font-semibold text-wine hover:underline disabled:opacity-50"
                  >
                    Undo change
                  </button>
                </p>
              ) : null}
            </div>
            <div className="flex w-full items-center gap-2.5 sm:ml-auto sm:w-auto">
              <label className="flex items-center gap-1.5 text-[11px] text-ink/50">
                Qty
                <PriceCell
                  whole
                  width="w-14"
                  label={`Quantity of ${line.name}`}
                  value={line.quantity}
                  onSave={(v) => onPatch({ lines: [{ id: line.id, quantity: v === '' ? null : v }] })}
                />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-ink/50">
                Price
                <PriceCell
                  width="w-20"
                  label={`Price of ${line.name}`}
                  value={line.price}
                  onSave={(v) => onPatch({ lines: [{ id: line.id, price: v === '' ? null : v }] })}
                />
              </label>
              <div className="ml-auto min-w-[5.5rem] text-right sm:w-28">
                <p className="text-sm font-semibold tabular-nums text-ink">{rs(line.quantity * line.price)}</p>
                <p className="text-[11px] text-ink/45">
                  {line.profit === null ? 'No purchase price' : <span className={line.profit < 0 ? 'text-red-600' : ''}>Profit {rs(line.profit)}</span>}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-b-xl border-t border-stone-100 bg-stone-50/70 px-4 py-2.5 text-xs text-ink/60">
        <span>
          Items <span className="tabular-nums">{rs(order.itemSales)}</span>
        </span>
        {order.discounts ? (
          <span>
            Discount <span className="tabular-nums">−{rs(order.discounts)}</span>
          </span>
        ) : null}
        <span>
          Sales <span className="font-semibold tabular-nums text-ink">{rs(order.netSales)}</span>
        </span>
        <span>
          Cost <span className="tabular-nums">{rs(order.cost)}</span>
        </span>
        <span>
          Profit{' '}
          <span className={`font-semibold tabular-nums ${order.profit < 0 ? 'text-red-600' : 'text-ink'}`}>{rs(order.profit)}</span>
          {uncosted ? <span className="text-amber-700"> · some items have no purchase price</span> : null}
        </span>
        {!order.counted && !deletedView ? <span className="font-medium text-amber-800">Not counted in stock or profit</span> : null}
      </footer>
    </article>
  )
}

function OrdersTab({ onLocked }: { onLocked: () => void }) {
  const ranges = useMemo(() => [{ id: 'all', label: 'All time', from: '', to: '' }, ...presets()], [])
  const [range, setRange] = useState('all')
  const [source, setSource] = useState<'all' | 'online' | 'offline'>('all')
  const [status, setStatus] = useState('')
  const [view, setView] = useState<OrderView>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [rows, setRows] = useState<InvOrder[]>([])
  const [counts, setCounts] = useState<Record<OrderView, number> | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<InvOrder | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])
  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [range, source, status, view, debounced, perPage])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const chosen = ranges.find((r) => r.id === range) || ranges[0]
      const params = new URLSearchParams({ source, view, page: String(page), perPage: String(perPage) })
      if (chosen.from) params.set('from', chosen.from)
      if (chosen.to) params.set('to', chosen.to)
      if (status) params.set('status', status)
      if (debounced) params.set('search', debounced)
      const data = await api<{ rows: InvOrder[]; counts: Record<OrderView, number>; total: number; totalPages: number }>(
        `/api/admin/inventory/orders?${params}`
      )
      setRows(data.rows)
      setCounts(data.counts)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [ranges, range, source, view, status, debounced, page, perPage, onLocked])

  useEffect(() => {
    void load()
  }, [load])

  const patchOrder = async (order: InvOrder, body: Record<string, unknown>) => {
    setBusy(order.id)
    setMessage('')
    try {
      const updated = await api<InvOrder>(`/api/admin/inventory/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setRows((prev) => prev.map((r) => (r.id === order.id ? updated : r)))
      // Counting or putting back moves the order between lists.
      if (body.counted !== undefined || body.restore) {
        if (body.restore) setMessage(`Order #${order.orderNumber} is back in Inventory.`)
        void load()
      }
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setMessage(`#${order.orderNumber}: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const bulk = async (counted: boolean) => {
    const ids = [...selected]
    setMessage('')
    try {
      const data = await api<{ updated: number }>('/api/admin/inventory/orders', { method: 'PATCH', body: JSON.stringify({ ids, counted }) })
      setMessage(
        counted
          ? `${data.updated} ${data.updated === 1 ? 'order now counts' : 'orders now count'} in stock and profit.`
          : `${data.updated} ${data.updated === 1 ? 'order' : 'orders'} switched off.`
      )
      setSelected(new Set())
      void load()
    } catch (err) {
      if ((err as { locked?: boolean }).locked) onLocked()
      else setMessage((err as Error).message)
    }
  }

  const chips: Array<{ id: OrderView; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'counted', label: 'Counted' },
    { id: 'off', label: 'Switched off' },
    { id: 'deleted', label: 'Deleted' },
  ]
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-ink/70">
        Every order counts in stock and in Sales &amp; profit. Switch off the ones that shouldn’t (tests, unpaid), or correct a quantity or
        price here. This only changes Inventory: the order, its invoice and what the customer sees stay as they are.
      </p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setView(chip.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${view === chip.id ? 'bg-wine text-white' : 'bg-white text-ink/70 ring-1 ring-stone-200 hover:bg-stone-50'}`}
            >
              {chip.label}
              {counts ? <span className="ml-1 opacity-70">{counts[chip.id].toLocaleString()}</span> : null}
            </button>
          ))}
        </div>
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
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto`} aria-label="Order status">
            <option value="">Any status</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no., customer, product" className={`${inputClass} w-56`} />
        </div>
      </div>

      {view !== 'deleted' && rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm">
          <label className="flex items-center gap-2 text-ink/70">
            <input
              type="checkbox"
              checked={allOnPage}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Set(prev)
                  for (const r of rows) {
                    if (e.target.checked) next.add(r.id)
                    else next.delete(r.id)
                  }
                  return next
                })
              }
              className="h-4 w-4 rounded border-stone-300 accent-wine"
            />
            Select all on this page
          </label>
          {selected.size > 0 ? (
            <>
              <span className="text-ink/55">{selected.size} selected</span>
              <button type="button" onClick={() => void bulk(false)} className={adminButtonClass.secondary}>
                Switch off
              </button>
              <button type="button" onClick={() => void bulk(true)} className={adminButtonClass.secondary}>
                Count them
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-ink/70">{message}</p> : null}

      {deleting ? (
        <PinConfirm
          title={`Delete order #${deleting.orderNumber} from Inventory?`}
          detail="It stops counting in stock and in Sales & profit. The order itself isn’t changed, and you can put it back from Deleted."
          onLocked={onLocked}
          onClose={() => setDeleting(null)}
          onConfirm={async (pin) => {
            await api(`/api/admin/inventory/orders/${deleting.id}`, { method: 'DELETE', body: JSON.stringify({ pin }) })
            setMessage(`Order #${deleting.orderNumber} deleted from Inventory.`)
            setSelected((prev) => {
              const next = new Set(prev)
              next.delete(deleting.id)
              return next
            })
            setDeleting(null)
            void load()
          }}
        />
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-ink/50">Loading orders…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-ink/50">
          {view === 'deleted' ? 'No orders deleted from Inventory.' : view === 'off' ? 'No orders switched off.' : 'No orders here.'}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              busy={busy === order.id}
              deletedView={view === 'deleted'}
              selected={selected.has(order.id)}
              onSelect={(on) =>
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (on) next.add(order.id)
                  else next.delete(order.id)
                  return next
                })
              }
              onPatch={(body) => void patchOrder(order, body)}
              onDelete={() => setDeleting(order)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink/55">
        <span>
          {total.toLocaleString()} orders
          <label className="ml-3">
            Show{' '}
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="rounded-md border border-stone-300 bg-white px-1.5 py-1">
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>{' '}
            per page
          </label>
        </span>
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


function Kpi({ label, value, hint, loading = false, tone }: { label: string; value: string; hint: string; loading?: boolean; tone?: 'red' }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-ink/55">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-stone-100" />
      ) : (
        <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${tone === 'red' ? 'text-red-600' : 'text-ink'}`}>{value}</p>
      )}
      <p className="mt-1 truncate text-xs text-ink/45">{hint}</p>
    </div>
  )
}

// ------------------------------------------------------------------ Page

export default function AdminInventoryPage() {
  const [state, setState] = useState<'checking' | 'locked' | 'open' | 'no-pin'>('checking')
  const [tab, setTab] = useState<'stock' | 'orders' | 'report'>('stock')
  const [changingPin, setChangingPin] = useState(false)

  const check = useCallback(() => {
    api<{ unlocked: boolean; pinSet: boolean }>('/api/admin/inventory/lock')
      .then((data) => setState(data.unlocked ? 'open' : data.pinSet ? 'locked' : 'no-pin'))
      .catch(() => setState('locked'))
  }, [])
  useEffect(check, [check])

  const lock = async () => {
    await fetch('/api/admin/inventory/lock', { method: 'DELETE' }).catch(() => undefined)
    setChangingPin(false)
    setState('locked')
  }
  const onLocked = useCallback(() => setState('locked'), [])

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        description="Stock in hand, orders, purchase and selling prices, and sales and profit. Locked with a PIN."
        actions={
          state === 'open' ? (
            <>
              <button type="button" onClick={() => setChangingPin((v) => !v)} className={adminButtonClass.secondary}>
                Change PIN
              </button>
              <button type="button" onClick={() => void lock()} className={adminButtonClass.secondary}>
                <AdminIcons.Key className="h-4 w-4" /> Lock
              </button>
            </>
          ) : null
        }
      />

      {state === 'checking' ? <p className="py-10 text-center text-sm text-ink/50">Checking…</p> : null}
      {state === 'no-pin' ? (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          No inventory PIN has been set up yet.
        </p>
      ) : null}
      {state === 'locked' ? <PinGate onUnlocked={() => setState('open')} /> : null}

      {state === 'open' ? (
        <>
          {changingPin ? <ChangePin onClose={() => setChangingPin(false)} /> : null}
          <div className="mb-5 flex gap-1 rounded-xl bg-stone-200/60 p-1 sm:w-fit" role="tablist">
            {(
              [
                ['stock', 'Stock'],
                ['orders', 'Orders'],
                ['report', 'Sales & profit'],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-medium sm:flex-none ${tab === id ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'}`}
              >
                {text}
              </button>
            ))}
          </div>
          {tab === 'stock' ? (
            <StockTab onLocked={onLocked} />
          ) : tab === 'orders' ? (
            <OrdersTab onLocked={onLocked} />
          ) : (
            <ReportTab onLocked={onLocked} />
          )}
        </>
      ) : null}
    </div>
  )
}
