'use client'

/** Small pieces shared by the Inventory tabs. */
import { useEffect, useState } from 'react'
import { adminButtonClass } from '@/components/admin/AdminPageHeader'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceNoDecimals } from '@/lib/utils'

export const rs = (n: number) => formatPriceNoDecimals(Math.round(n))
export const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/10'

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`) as Error & { locked?: boolean }
    error.locked = res.status === 423
    throw error
  }
  return data as T
}

export function PriceCell({
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

export function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
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
export function PinConfirm({
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

export function Thumb({ src, size = 'h-10 w-10' }: { src: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolveImageUrl(src)} alt="" className={`${size} shrink-0 rounded-md bg-stone-100 object-cover`} />
  ) : (
    <span className={`${size} shrink-0 rounded-md bg-stone-100`} />
  )
}

export const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000
export const nepalToday = () => new Date(Date.now() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)
export const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

export function presets() {
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

export function Kpi({ label, value, hint, loading = false, tone }: { label: string; value: string; hint: string; loading?: boolean; tone?: 'red' }) {
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
