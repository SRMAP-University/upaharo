'use client'

import { useState, type ReactNode } from 'react'

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000'

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink/80">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 cursor-pointer rounded-xl border border-wine/15 bg-white p-1"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          spellCheck={false}
          className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2.5 font-mono text-sm uppercase text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15"
          placeholder="#RRGGBB"
          maxLength={7}
        />
      </div>
    </div>
  )
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <div className="rounded-2xl border border-wine/10 bg-cream/30 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-ink/80">{label}</label>
        <span className="shrink-0 rounded-lg bg-white px-2 py-0.5 font-mono text-xs text-ink/60">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-wine"
      />
    </div>
  )
}

export function Toggle({
  label,
  checked,
  hint,
  onChange,
}: {
  label: string
  checked: boolean
  hint?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-wine/10 bg-white p-4 transition-colors hover:border-wine/20">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-1 block text-xs leading-relaxed text-ink/50">{hint}</span>}
      </span>
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  step,
  maxLength,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  step?: string
  maxLength?: number
  hint?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink/80">{label}</label>
      <input
        type={type}
        step={step}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2.5 text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15"
      />
      {hint && <p className="mt-2 text-xs leading-relaxed text-ink/50">{hint}</p>}
    </div>
  )
}

export const SETTINGS_TABS = [
  { id: 'general', label: 'General', description: 'Store name and announcement' },
  { id: 'appearance', label: 'Appearance', description: 'Colours, shape and product cards' },
  { id: 'home', label: 'Home page', description: 'Sections, banners and features' },
  { id: 'navigation', label: 'Navigation', description: 'Bottom tab labels' },
  { id: 'checkout', label: 'Checkout', description: 'Wallet, fees and scheduling' },
  { id: 'support', label: 'Support & map', description: 'Contact and delivery info' },
] as const

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

export function SettingsTabNav({
  active,
  onChange,
  variant = 'sidebar',
}: {
  active: SettingsTabId
  onChange: (id: SettingsTabId) => void
  variant?: 'sidebar' | 'horizontal'
}) {
  if (variant === 'horizontal') {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
        {SETTINGS_TABS.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? 'bg-wine text-white shadow-sm'
                  : 'border border-wine/15 bg-white text-ink/70'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <nav className="hidden flex-col gap-1 lg:flex">
      {SETTINGS_TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-2xl px-4 py-3 text-left transition-colors ${
              selected
                ? 'bg-wine text-white shadow-sm'
                : 'text-ink/70 hover:bg-cream hover:text-ink'
            }`}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            <span
              className={`mt-0.5 block text-xs ${
                selected ? 'text-white/80' : 'text-ink/45'
              }`}
            >
              {tab.description}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export function SettingsPanel({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-wine/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-wine/8 bg-cream/25 px-6 py-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/55">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="space-y-8 p-6">{children}</div>
    </section>
  )
}

export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-ink/55">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export function SettingsGrid({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3
  children: ReactNode
}) {
  const colClass =
    cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
  return <div className={`grid gap-5 ${colClass}`}>{children}</div>
}

export function SettingsSubPanel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-wine/10 bg-cream/35 p-5">
      <div>
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-ink/55">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-wine/10 bg-cream/60 px-4 py-3 text-sm leading-relaxed text-ink/70">
      {children}
    </p>
  )
}

export function SettingsAccordion({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-2xl border border-wine/10 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-cream/40"
      >
        <div>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          {description && (
            <span className="mt-1 block text-xs leading-relaxed text-ink/50">{description}</span>
          )}
        </div>
        <span className="shrink-0 text-lg text-ink/40">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="space-y-5 border-t border-wine/8 px-5 py-5">{children}</div>}
    </div>
  )
}

export function StickySaveBar({
  saving,
  message,
}: {
  saving: boolean
  message: string
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-8 rounded-2xl border border-wine/10 bg-white/95 px-5 py-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink/55">
          {message || 'Changes apply to the mobile app after save.'}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-wine px-8 py-2.5 font-semibold text-white transition-colors hover:bg-wine-deep disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
