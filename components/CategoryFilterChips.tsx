'use client'

import type { ChipGroup, FilterGroup, Selection } from '@/lib/category-filters'

/**
 * Rows of options inside a category: For (Her, Him, Couple…), Occasion,
 * the category's own types (cake flavours, flowers…) and Price. One choice per
 * row; tap again to clear it. Each shows how many gifts it leaves.
 */
export default function CategoryFilterChips({
  groups,
  selection,
  onChange,
  onClear,
}: {
  groups: ChipGroup[]
  selection: Selection
  onChange: (group: FilterGroup['id'], option: string | null) => void
  onClear: () => void
}) {
  if (groups.length === 0) return null
  const anyChosen = Object.values(selection).some(Boolean)

  return (
    <div className="mt-5 space-y-2.5 lg:mt-6">
      {groups.map((group) => (
        <div
          key={group.id}
          role="group"
          aria-label={group.title}
          className="scrollbar-hide -mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          <span className="min-w-[66px] shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40">{group.title}</span>
          {group.chips.map((chip) => {
            const on = selection[group.id] === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(group.id, on ? null : chip.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-[0.97] ${
                  on ? 'bg-ink text-white' : 'bg-mist text-ink hover:bg-mist-deep'
                }`}
              >
                {chip.label}
                <span className={`text-[12px] font-medium ${on ? 'text-white/60' : 'text-ink/40'}`}>{chip.count}</span>
                {on ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                ) : null}
              </button>
            )
          })}
        </div>
      ))}
      {anyChosen ? (
        <button type="button" onClick={onClear} className="text-[13px] font-semibold text-brand">
          Clear all
        </button>
      ) : null}
    </div>
  )
}
