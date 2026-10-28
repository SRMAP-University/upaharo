'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_NAV_ITEMS, ADMIN_QUICK_ACTIONS, AdminIcons } from '@/components/admin/admin-nav'

type Entry = { label: string; hint: string; href: string; search: string; icon: (p: { className?: string }) => React.ReactNode }

const entries: Entry[] = [
  ...ADMIN_NAV_ITEMS.map((item) => ({
    label: item.label,
    hint: item.group,
    href: item.href,
    search: `${item.label} ${item.group} ${item.keywords || ''}`.toLowerCase(),
    icon: item.icon,
  })),
  ...ADMIN_QUICK_ACTIONS.map((action) => ({
    label: action.label,
    hint: 'Action',
    href: action.href,
    search: `${action.label} ${action.keywords || ''}`.toLowerCase(),
    icon: AdminIcons.Plus,
  })),
]

/** Jump to any admin page or common action by typing (Ctrl/⌘ K). */
export default function AdminCommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return words.length ? entries.filter((e) => words.every((w) => e.search.includes(w))) : entries
  }, [query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => setActive(0), [query])

  if (!open) return null

  const go = (entry?: Entry) => {
    if (!entry) return
    onClose()
    router.push(entry.href)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search admin">
      <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" aria-label="Close search" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-stone-200 px-4">
          <AdminIcons.Search className="h-5 w-5 shrink-0 text-ink/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(results.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                go(results[active])
              }
            }}
            placeholder="Search pages and actions…"
            className="h-14 w-full bg-transparent text-[15px] text-ink placeholder:text-ink/40 focus:outline-none"
            aria-label="Search pages and actions"
          />
          <kbd className="hidden rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] font-medium text-ink/45 sm:block">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-ink/50">Nothing matches “{query}”.</li>
          ) : (
            results.map((entry, index) => {
              const Icon = entry.icon
              return (
                <li key={`${entry.hint}-${entry.label}`} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(entry)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                      index === active ? 'bg-wine/[0.07] text-wine' : 'text-ink/80'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                    <span className="flex-1 font-medium">{entry.label}</span>
                    <span className="text-xs text-ink/40">{entry.hint}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
