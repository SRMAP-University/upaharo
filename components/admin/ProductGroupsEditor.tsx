'use client'

import { useState } from 'react'
import type { ProductCategoryGroups, ProductCategoryOption } from '@/lib/product-categories'

/**
 * Admin product list: which extra shop categories, occasions and recipient
 * groups a product is in (saved as tags with their names), shown as small
 * chips with a quick editor so products can be sorted without opening each.
 */

export type GroupsProduct = { id: string; name: string; category: string; tags?: string[] | null }

/** The product's groups from its tags, by kind. */
export function productGroups(product: GroupsProduct, groups: ProductCategoryGroups) {
  const tags = product.tags || []
  const names = (options: ProductCategoryOption[]) => {
    const set = new Set(options.map((option) => option.name))
    return tags.filter((tag) => set.has(tag))
  }
  return {
    extra: names(groups.productCategories).filter((name) => name !== product.category),
    occasions: names(groups.occasionCategories),
    recipients: names(groups.recipientCategories),
  }
}

export function ProductGroupChips({
  product,
  groups,
  onEdit,
}: {
  product: GroupsProduct
  groups: ProductCategoryGroups
  onEdit?: () => void
}) {
  const { extra, occasions, recipients } = productGroups(product, groups)
  const chips = [
    ...extra.map((name) => ({ name, kind: 'Also in' })),
    ...occasions.map((name) => ({ name, kind: 'Occasion' })),
    ...recipients.map((name) => ({ name, kind: 'For' })),
  ]
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <span
          key={`${chip.kind}-${chip.name}`}
          title={chip.kind}
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            chip.kind === 'Also in' ? 'bg-stone-200 text-ink/75' : chip.kind === 'Occasion' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'
          }`}
        >
          {chip.name}
        </span>
      ))}
      {onEdit ? (
        <button type="button" onClick={onEdit} className="text-[11px] font-semibold text-wine underline-offset-2 hover:underline">
          {chips.length ? 'Edit' : '+ Categories & occasions'}
        </button>
      ) : null}
    </div>
  )
}

function Toggles({
  title,
  hint,
  options,
  selected,
  onChange,
}: {
  title: string
  hint: string
  options: ProductCategoryOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mb-2 text-xs text-ink/55">{hint}</p>
      {options.length === 0 ? (
        <p className="text-xs text-ink/45">None set up yet (Admin → Categories).</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const on = selected.includes(option.name)
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((name) => name !== option.name) : [...selected, option.name])}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  on ? 'border-transparent bg-wine text-white' : 'border-wine/15 bg-white text-ink/70 hover:border-wine/30'
                }`}
              >
                {option.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ProductGroupsEditor({
  product,
  groups,
  onClose,
  onSaved,
}: {
  product: GroupsProduct
  groups: ProductCategoryGroups
  onClose: () => void
  onSaved: (tags: string[]) => void
}) {
  const start = productGroups(product, groups)
  const [extra, setExtra] = useState(start.extra)
  const [occasions, setOccasions] = useState(start.occasions)
  const [recipients, setRecipients] = useState(start.recipients)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    // Keep every other tag (search words, hamper items) and replace only these groups.
    const groupNames = new Set(
      [...groups.productCategories, ...groups.occasionCategories, ...groups.recipientCategories].map((option) => option.name)
    )
    const kept = (product.tags || []).filter((tag) => !groupNames.has(tag))
    const tags = Array.from(new Set([...kept, ...extra.filter((name) => name !== product.category), ...occasions, ...recipients]))
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onSaved(tags)
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Categories & occasions</p>
            <h2 className="mt-1 text-lg font-bold text-ink">{product.name}</h2>
            <p className="text-xs text-ink/55">Main category: {product.category}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-ink/50 hover:bg-stone-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          <Toggles
            title="Also show in"
            hint="Other shop categories this product appears in, besides its main one."
            options={groups.productCategories.filter((option) => option.name !== product.category)}
            selected={extra}
            onChange={setExtra}
          />
          <Toggles
            title="Occasions"
            hint="Birthday, Anniversary, Wedding… It shows in those occasion sections."
            options={groups.occasionCategories}
            selected={occasions}
            onChange={setOccasions}
          />
          <Toggles
            title="For"
            hint="Who it suits: Her, Him, Kids…"
            options={groups.recipientCategories}
            selected={recipients}
            onChange={setRecipients}
          />
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-ink/70">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-full bg-wine px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
