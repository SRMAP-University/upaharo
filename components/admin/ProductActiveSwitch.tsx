'use client'

/**
 * On/off switch for whether a product is live in the shop.
 * Active products are listed and can be ordered; inactive ones are hidden.
 */
export default function ProductActiveSwitch({
  active,
  onChange,
  busy = false,
  disabled = false,
  label,
}: {
  active: boolean
  onChange: (next: boolean) => void
  busy?: boolean
  disabled?: boolean
  /** Accessible name, e.g. the product name. */
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label ? `${label}: ${active ? 'active' : 'inactive'}` : undefined}
      title={active ? 'Active: shown in the shop. Click to deactivate.' : 'Inactive: hidden from the shop. Click to activate.'}
      disabled={disabled || busy}
      onClick={() => onChange(!active)}
      className="group inline-flex items-center gap-2 rounded-full py-1 focus:outline-none disabled:cursor-wait disabled:opacity-70"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          active ? 'bg-green-600' : 'bg-ink/25'
        } group-focus-visible:ring-2 group-focus-visible:ring-wine/30 group-focus-visible:ring-offset-1`}
      >
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${
            active ? 'translate-x-5' : 'translate-x-0'
          }`}
        >
          {busy ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60" /> : null}
        </span>
      </span>
      <span className={`w-14 text-left text-xs font-semibold ${active ? 'text-green-700' : 'text-ink/55'}`}>
        {active ? 'Active' : 'Inactive'}
      </span>
    </button>
  )
}
