'use client'

import { useState } from 'react'
import type { HomeSectionConfig } from '@/lib/app-settings-schema'

/** Admin-facing copy for each section id the mobile app knows how to render. */
const SECTION_META: Record<
  string,
  { label: string; subtitleLabel: string | null; hint: string }
> = {
  spinBanner: {
    label: 'Spin & Win banner',
    subtitleLabel: 'Subtitle',
    hint: 'Taps through to the Promo tab. Also needs the Spin banner toggle on.',
  },
  valueDeals: {
    label: 'Value Deals carousel',
    subtitleLabel: 'Accent word',
    hint: 'The accent word renders in the brand secondary colour.',
  },
  quickPicks: {
    label: 'Quick picks circles',
    subtitleLabel: null,
    hint: 'Also needs “Show top category cards” enabled.',
  },
  productGrid: {
    label: 'Product grid',
    subtitleLabel: null,
    hint: 'Every remaining product, using the card settings below.',
  },
}

const FIELD_CLASS =
  'w-full rounded-lg border border-wine/15 bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

type Props = {
  sections: HomeSectionConfig[]
  onChange: (sections: HomeSectionConfig[]) => void
}

export function SectionLayoutEditor({ sections, onChange }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || from === to) return
    const next = [...sections]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const update = (index: number, patch: Partial<HomeSectionConfig>) => {
    onChange(sections.map((section, i) => (i === index ? { ...section, ...patch } : section)))
  }

  return (
    <ol className="mt-4 space-y-3">
      {sections.map((section, index) => {
        const meta = SECTION_META[section.id] ?? {
          label: section.id,
          subtitleLabel: 'Subtitle',
          hint: '',
        }
        const dragging = dragIndex === index

        return (
          <li
            key={section.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (dragIndex !== null) move(dragIndex, index)
              setDragIndex(null)
            }}
            className={`rounded-2xl border bg-cream/40 p-4 transition-colors ${
              dragging ? 'border-wine/40 opacity-60' : 'border-wine/10'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="cursor-grab select-none text-lg leading-none text-ink/30"
                aria-hidden
                title="Drag to reorder"
              >
                ⠿
              </span>
              <span className="text-xs font-semibold text-ink/40">{index + 1}</span>
              <span className="font-display text-sm font-semibold text-ink">{meta.label}</span>

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Move ${meta.label} up`}
                  className="rounded-lg border border-wine/15 px-2 py-1 text-xs text-wine disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === sections.length - 1}
                  aria-label={`Move ${meta.label} down`}
                  className="rounded-lg border border-wine/15 px-2 py-1 text-xs text-wine disabled:opacity-30"
                >
                  ↓
                </button>
                <label className="ml-2 flex items-center gap-2 text-xs text-ink/70">
                  <input
                    type="checkbox"
                    checked={section.visible}
                    onChange={(event) => update(index, { visible: event.target.checked })}
                    className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
                  />
                  Visible
                </label>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink/60">Title</label>
                <input
                  type="text"
                  value={section.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                  className={FIELD_CLASS}
                />
              </div>
              {meta.subtitleLabel && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink/60">
                    {meta.subtitleLabel}
                  </label>
                  <input
                    type="text"
                    value={section.subtitle}
                    onChange={(event) => update(index, { subtitle: event.target.value })}
                    className={FIELD_CLASS}
                  />
                </div>
              )}
            </div>

            {meta.hint && <p className="mt-2 text-xs text-ink/45">{meta.hint}</p>}
          </li>
        )
      })}
    </ol>
  )
}
