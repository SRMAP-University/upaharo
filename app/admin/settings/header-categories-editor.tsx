'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type CategoryRow = {
  id: string
  name: string
  shortName: string | null
  type: string
  isActive: boolean
  image: string
}

type Props = {
  headerCategoryIds: string[]
  onChange: (ids: string[]) => void
}

export function HeaderCategoriesEditor({ headerCategoryIds, onChange }: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/categories')
        if (!res.ok) throw new Error('Failed to load categories')
        const data = (await res.json()) as CategoryRow[]
        if (cancelled) return
        setCategories(
          data.filter(
            (c) =>
              c.isActive &&
              String(c.type || '').toUpperCase() === 'PRODUCT'
          )
        )
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('Could not load categories.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const byId = useMemo(() => {
    const map = new Map<string, CategoryRow>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const customized = headerCategoryIds.length > 0

  const visible = useMemo(() => {
    if (!customized) return []
    return headerCategoryIds
      .map((id) => byId.get(id))
      .filter((c): c is CategoryRow => Boolean(c))
  }, [headerCategoryIds, byId, customized])

  const hidden = useMemo(() => {
    if (!customized) return []
    const shown = new Set(headerCategoryIds)
    return categories.filter((c) => !shown.has(c.id))
  }, [categories, headerCategoryIds, customized])

  const move = (from: number, to: number) => {
    if (to < 0 || to >= headerCategoryIds.length || from === to) return
    const next = [...headerCategoryIds]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const removeAt = (index: number) => {
    onChange(headerCategoryIds.filter((_, i) => i !== index))
  }

  const addId = (id: string) => {
    if (headerCategoryIds.includes(id)) return
    onChange([...headerCategoryIds, id])
  }

  const startCustomizing = () => {
    onChange(categories.map((c) => c.id))
  }

  const useAll = () => onChange([])

  if (loading) {
    return (
      <p className="text-sm text-ink/50">Loading categories…</p>
    )
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-ink/55">
        No active product categories yet.{' '}
        <Link href="/admin/categories" className="font-semibold text-wine underline">
          Add categories
        </Link>
      </p>
    )
  }

  if (!customized) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/60">
          Using <span className="font-semibold text-ink">all active product categories</span>{' '}
          in A–Z order ({categories.length}). Short names and images are edited under{' '}
          <Link href="/admin/categories" className="font-semibold text-wine underline">
            Categories
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={startCustomizing}
          className="rounded-full border border-wine/20 px-4 py-1.5 text-sm font-semibold text-wine hover:bg-cream"
        >
          Customize header list
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-ink/60">
          Drag to reorder. Hidden categories stay available in Categories / Quick picks.
          Labels &amp; images:{' '}
          <Link href="/admin/categories" className="font-semibold text-wine underline">
            Categories
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={useAll}
          className="ml-auto rounded-full border border-wine/20 px-3 py-1 text-xs font-semibold text-wine hover:bg-cream"
        >
          Use all (A–Z)
        </button>
      </div>

      <ul className="space-y-2">
        {visible.map((cat, index) => {
          const dragging = dragIndex === index
          const label = cat.shortName?.trim() || cat.name
          return (
            <li
              key={cat.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (dragIndex !== null) move(dragIndex, index)
                setDragIndex(null)
              }}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-cream/40 px-3 py-2.5 transition-colors ${
                dragging ? 'border-wine/40 opacity-60' : 'border-wine/10'
              }`}
            >
              <span
                className="cursor-grab select-none text-lg leading-none text-ink/30"
                aria-hidden
                title="Drag to reorder"
              >
                ⠿
              </span>
              <span className="text-xs font-semibold text-ink/40">{index + 1}</span>
              {cat.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cat.image}
                  alt=""
                  className="h-8 w-8 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-ink/40">
                  —
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold text-ink">{label}</p>
                {cat.shortName?.trim() && cat.shortName.trim() !== cat.name ? (
                  <p className="truncate text-[11px] text-ink/45">{cat.name}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Move ${label} up`}
                  className="rounded-lg border border-wine/15 px-2 py-1 text-xs text-wine disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === visible.length - 1}
                  aria-label={`Move ${label} down`}
                  className="rounded-lg border border-wine/15 px-2 py-1 text-xs text-wine disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="rounded-lg border border-wine/15 px-2 py-1 text-xs font-semibold text-ink/55 hover:border-wine/30 hover:text-wine"
                >
                  Hide
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-wine/20 bg-cream/30 px-3 py-3 text-sm text-ink/55">
          No categories in the header. Add some below, or switch back to all (A–Z).
        </p>
      ) : null}

      {hidden.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Hidden from header
          </p>
          <ul className="flex flex-wrap gap-2">
            {hidden.map((cat) => {
              const label = cat.shortName?.trim() || cat.name
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => addId(cat.id)}
                    className="rounded-full border border-wine/15 bg-white px-3 py-1 text-xs font-semibold text-ink/70 hover:border-wine/30 hover:text-wine"
                  >
                    + {label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
