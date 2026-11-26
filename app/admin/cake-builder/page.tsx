'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import AdminPageHeader, { adminButtonClass } from '@/components/admin/AdminPageHeader'
import CakePreview from '@/components/cake/CakePreview'
import {
  ADDON_VISUALS,
  CAKE_BUILDER_PATH,
  STARTER_CAKE_CONFIG,
  TOPPING_VISUALS,
  cakeConfigProblems,
  sanitizeCakeConfig,
  type CakeBuilderConfig,
} from '@/lib/cake-builder'
import { resolveImageUrl } from '@/lib/image-url'
import { uploadProductImage } from '@/lib/upload-image'

type ListKey = 'sizes' | 'flavours' | 'types' | 'toppings' | 'addons'

type Field =
  | { key: string; label: string; type: 'text'; width?: string; placeholder?: string }
  | { key: string; label: string; type: 'money'; width?: string }
  | { key: string; label: string; type: 'number'; width?: string; step?: number }
  | { key: string; label: string; type: 'color' }
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'select'; options: string[] }
  | { key: string; label: string; type: 'image' }

const LISTS: Array<{ key: ListKey; title: string; help: string; fields: Field[]; blank: Record<string, unknown> }> = [
  {
    key: 'sizes',
    title: 'Sizes',
    help: 'Fixed sizes have a price. Tick “Custom” for a size where the customer types the weight; it is priced per pound.',
    fields: [
      { key: 'label', label: 'Name', type: 'text', width: 'w-32' },
      { key: 'pounds', label: 'Pounds', type: 'number', step: 0.25, width: 'w-20' },
      { key: 'serves', label: 'Serves', type: 'text', width: 'w-28', placeholder: 'Serves 4-6' },
      { key: 'price', label: 'Price', type: 'money' },
      { key: 'diameterInch', label: 'Inches', type: 'number', step: 0.5, width: 'w-20' },
      { key: 'maxFlavours', label: 'Max flavours', type: 'number', step: 1, width: 'w-20' },
      { key: 'custom', label: 'Custom', type: 'bool' },
      { key: 'pricePerPound', label: 'Price / lb', type: 'money' },
      { key: 'minPounds', label: 'Min lb', type: 'number', step: 0.5, width: 'w-20' },
      { key: 'maxPounds', label: 'Max lb', type: 'number', step: 0.5, width: 'w-20' },
      { key: 'stepPounds', label: 'Step lb', type: 'number', step: 0.25, width: 'w-20' },
      { key: 'image', label: 'Photo', type: 'image' },
    ],
    blank: { label: 'New size', pounds: 1, serves: '', price: 0, maxFlavours: 1, active: true },
  },
  {
    key: 'flavours',
    title: 'Flavours',
    help: 'Extra per pound is added on top of the size price. The colours draw the live preview.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', width: 'w-40' },
      { key: 'surchargePerPound', label: 'Extra / lb', type: 'money' },
      { key: 'frosting', label: 'Frosting', type: 'color' },
      { key: 'sponge', label: 'Sponge', type: 'color' },
      { key: 'drip', label: 'Drip', type: 'color' },
      { key: 'image', label: 'Photo', type: 'image' },
    ],
    blank: { name: 'New flavour', surchargePerPound: 0, frosting: '#FFF1E2', sponge: '#EBC99A', drip: '', active: true },
  },
  {
    key: 'types',
    title: 'Cake type',
    help: 'Veg (eggless) and Non-Veg (with egg). Extra per pound is optional.',
    fields: [
      { key: 'label', label: 'Name', type: 'text', width: 'w-36' },
      { key: 'note', label: 'Note', type: 'text', width: 'w-32', placeholder: 'Eggless' },
      { key: 'isVeg', label: 'Veg', type: 'bool' },
      { key: 'surchargePerPound', label: 'Extra / lb', type: 'money' },
    ],
    blank: { label: 'New type', isVeg: true, active: true },
  },
  {
    key: 'toppings',
    title: 'Toppings',
    help: 'Customers may pick several. “Looks like” sets how it is drawn on the preview.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', width: 'w-40' },
      { key: 'price', label: 'Price', type: 'money' },
      { key: 'visual', label: 'Looks like', type: 'select', options: TOPPING_VISUALS },
      { key: 'image', label: 'Photo', type: 'image' },
    ],
    blank: { name: 'New topping', price: 0, visual: 'none', active: true },
  },
  {
    key: 'addons',
    title: 'Extras & decorations',
    help: 'Toppers, candles, photo cakes. “Needs picture” asks the customer to upload one; “Needs note” asks them to describe it.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', width: 'w-40' },
      { key: 'description', label: 'Description', type: 'text', width: 'w-48' },
      { key: 'price', label: 'Price', type: 'money' },
      { key: 'visual', label: 'Looks like', type: 'select', options: ADDON_VISUALS },
      { key: 'needsImage', label: 'Needs picture', type: 'bool' },
      { key: 'needsNote', label: 'Needs note', type: 'bool' },
      { key: 'image', label: 'Photo', type: 'image' },
    ],
    blank: { name: 'New extra', price: 0, visual: 'none', active: true },
  },
]

const input =
  'h-9 rounded-lg border border-stone-300 bg-white px-2.5 text-sm text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15'

function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-center gap-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolveImageUrl(value)} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-stone-200" />
      ) : null}
      <label className="cursor-pointer text-xs font-semibold text-wine hover:underline">
        {busy ? 'Uploading…' : value ? 'Change' : 'Upload'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setBusy(true)
            try {
              onChange(await uploadProductImage(file))
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Upload failed')
            } finally {
              setBusy(false)
            }
          }}
        />
      </label>
      {value ? (
        <button type="button" className="text-xs text-ink/50 hover:text-red-600" onClick={() => onChange('')}>
          Remove
        </button>
      ) : null}
    </div>
  )
}

export default function AdminCakeBuilderPage() {
  const [config, setConfig] = useState<CakeBuilderConfig | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/cake-builder', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        setConfig(sanitizeCakeConfig(data.config))
        setSaved(Boolean(data.saved))
      })
      .catch(() => setMessage({ ok: false, text: 'Could not load the cake builder settings.' }))
  }, [])

  const problems = useMemo(() => (config ? cakeConfigProblems(config) : []), [config])

  const change = (next: CakeBuilderConfig) => {
    setConfig(next)
    setDirty(true)
    setMessage(null)
  }

  const setRow = (list: ListKey, index: number, key: string, value: unknown) => {
    if (!config) return
    const rows = [...(config[list] as unknown as Record<string, unknown>[])]
    rows[index] = { ...rows[index], [key]: value }
    change({ ...config, [list]: rows } as CakeBuilderConfig)
  }

  const moveRow = (list: ListKey, index: number, by: number) => {
    if (!config) return
    const rows = [...(config[list] as unknown[])]
    const to = index + by
    if (to < 0 || to >= rows.length) return
    ;[rows[index], rows[to]] = [rows[to], rows[index]]
    change({ ...config, [list]: rows } as CakeBuilderConfig)
  }

  const removeRow = (list: ListKey, index: number) => {
    if (!config || !confirm('Remove this option? Turning it off keeps it for later.')) return
    const rows = (config[list] as unknown[]).filter((_, i) => i !== index)
    change({ ...config, [list]: rows } as CakeBuilderConfig)
  }

  const addRow = (list: ListKey, blank: Record<string, unknown>) => {
    if (!config) return
    // The id comes from the name when saved; a time stamp keeps new rows apart.
    const rows = [...(config[list] as unknown[]), { ...blank, id: `${list}-${Date.now().toString(36)}` }]
    change({ ...config, [list]: rows } as CakeBuilderConfig)
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/cake-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`)
      setConfig(sanitizeCakeConfig(data.config))
      setSaved(true)
      setDirty(false)
      setMessage({
        ok: true,
        text: data.config.enabled && data.problems.length === 0 ? 'Saved. The cake builder is live.' : 'Saved.',
      })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return (
      <div>
        <AdminPageHeader title="Cake builder" description="Build Your Own Cake options and prices" />
        <p className="text-sm text-ink/60">{message?.text || 'Loading…'}</p>
      </div>
    )
  }

  const live = config.enabled && problems.length === 0
  const sampleFlavour = config.flavours.find((f) => f.active) || config.flavours[0]

  return (
    <div className="pb-24">
      <AdminPageHeader
        title="Cake builder"
        description={
          <>
            Sizes, flavours, toppings, extras and prices for{' '}
            <Link href={CAKE_BUILDER_PATH} target="_blank" className="font-semibold text-wine hover:underline">
              Build Your Own Cake ↗
            </Link>
            . Every price is charged exactly as set here, and checked again when an order is placed.
          </>
        }
        actions={
          <>
            {!saved && config.sizes.length === 0 ? (
              <button
                type="button"
                className={adminButtonClass.secondary}
                onClick={() => change({ ...STARTER_CAKE_CONFIG, productId: config.productId })}
              >
                Load starter options
              </button>
            ) : null}
            <button type="button" className={adminButtonClass.primary} onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      />

      {message ? (
        <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">Status</h3>
              <p className="text-sm text-ink/60">
                {live
                  ? 'Live: customers can design and order cakes.'
                  : config.enabled
                    ? 'Switched on, but not live until the items below are fixed.'
                    : 'Switched off: the page tells customers custom cakes are coming soon.'}
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => change({ ...config, enabled: e.target.checked })}
                className="h-5 w-5 accent-wine"
              />
              Open to customers
            </label>
          </div>
          {problems.length > 0 ? (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-amber-800">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink/70">Page title</span>
              <input className={`${input} w-full`} value={config.title} onChange={(e) => change({ ...config, title: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink/70">Subtitle</span>
              <input className={`${input} w-full`} value={config.subtitle} onChange={(e) => change({ ...config, subtitle: e.target.value })} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-ink/70">Note under the price</span>
              <input
                className={`${input} w-full`}
                value={config.note}
                placeholder="e.g. Please order at least 24 hours ahead"
                onChange={(e) => change({ ...config, note: e.target.value })}
              />
            </label>
            <div className="text-sm">
              <span className="mb-1 block font-medium text-ink/70">Banner cake photo</span>
              <ImageField value={config.heroImage} onChange={(url) => change({ ...config, heroImage: url })} />
            </div>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink/70">Most toppings per cake (0 = no limit)</span>
              <input
                type="number"
                min={0}
                className={`${input} w-24`}
                value={config.maxToppings}
                onChange={(e) => change({ ...config, maxToppings: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-4 rounded-lg bg-stone-50 p-3 text-sm">
            <label className="flex items-center gap-2 font-medium text-ink/80">
              <input
                type="checkbox"
                className="h-4 w-4 accent-wine"
                checked={config.message.enabled}
                onChange={(e) => change({ ...config, message: { ...config.message, enabled: e.target.checked } })}
              />
              Message on the cake
            </label>
            <label>
              <span className="mb-1 block text-ink/60">Most characters</span>
              <input
                type="number"
                min={5}
                max={120}
                className={`${input} w-20`}
                value={config.message.maxLength}
                onChange={(e) => change({ ...config, message: { ...config.message, maxLength: Number(e.target.value) } })}
              />
            </label>
            <label>
              <span className="mb-1 block text-ink/60">Message price (Rs.)</span>
              <input
                type="number"
                min={0}
                className={`${input} w-24`}
                value={config.message.price}
                onChange={(e) => change({ ...config, message: { ...config.message, price: Number(e.target.value) } })}
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">Preview sample</h3>
          <CakePreview
            className="w-full"
            showSizeLabel
            visual={{
              pounds: 1,
              diameterInch: 6,
              flavours: sampleFlavour ? [sampleFlavour] : [],
              toppings: config.toppings.filter((t) => t.active).slice(0, 2).map((t) => t.visual),
              addons: ['candles'],
              message: 'Happy Birthday',
              photoUrl: '',
            }}
          />
        </section>
      </div>

      {LISTS.map((list) => {
        const rows = config[list.key] as unknown as Record<string, any>[]
        return (
          <section key={list.key} className="mb-6 rounded-xl border border-stone-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">{list.title}</h3>
                <p className="text-sm text-ink/60">{list.help}</p>
              </div>
              <button type="button" className={adminButtonClass.secondary} onClick={() => addRow(list.key, list.blank)}>
                + Add
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-lg bg-stone-50 px-3 py-4 text-center text-sm text-ink/50">Nothing here yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink/45">
                      <th className="px-2 py-2">On</th>
                      {list.fields.map((f) => (
                        <th key={f.key} className="whitespace-nowrap px-2 py-2">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rows.map((row, index) => (
                      <tr key={row.id ?? index} className={row.active ? '' : 'opacity-50'}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-wine"
                            checked={Boolean(row.active)}
                            aria-label="Offer this option"
                            onChange={(e) => setRow(list.key, index, 'active', e.target.checked)}
                          />
                        </td>
                        {list.fields.map((f) => {
                          const value = row[f.key]
                          // Fields that only matter for custom sizes, or only for fixed ones.
                          const hidden =
                            list.key === 'sizes' &&
                            ((['pricePerPound', 'minPounds', 'maxPounds', 'stepPounds'].includes(f.key) && !row.custom) ||
                              (f.key === 'price' && row.custom))
                          return (
                            <td key={f.key} className="px-2 py-2 align-middle">
                              {hidden ? (
                                <span className="text-ink/25">—</span>
                              ) : f.type === 'bool' ? (
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-wine"
                                  checked={Boolean(value)}
                                  aria-label={f.label}
                                  onChange={(e) => setRow(list.key, index, f.key, e.target.checked)}
                                />
                              ) : f.type === 'color' ? (
                                <span className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    className="h-8 w-9 cursor-pointer rounded border border-stone-300"
                                    value={value || '#FFFFFF'}
                                    aria-label={f.label}
                                    onChange={(e) => setRow(list.key, index, f.key, e.target.value)}
                                  />
                                  {f.key === 'drip' && value ? (
                                    <button type="button" className="text-xs text-ink/50 hover:text-red-600" onClick={() => setRow(list.key, index, f.key, '')}>
                                      none
                                    </button>
                                  ) : null}
                                </span>
                              ) : f.type === 'select' ? (
                                <select
                                  className={input}
                                  value={value}
                                  aria-label={f.label}
                                  onChange={(e) => setRow(list.key, index, f.key, e.target.value)}
                                >
                                  {f.options.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              ) : f.type === 'image' ? (
                                <ImageField value={value || ''} onChange={(url) => setRow(list.key, index, f.key, url)} />
                              ) : (
                                <input
                                  type={f.type === 'text' ? 'text' : 'number'}
                                  min={f.type === 'text' ? undefined : 0}
                                  step={f.type === 'money' ? 1 : f.type === 'number' ? f.step : undefined}
                                  placeholder={f.type === 'text' ? f.placeholder : undefined}
                                  className={`${input} ${f.type === 'money' ? 'w-24' : f.width || 'w-28'}`}
                                  value={value ?? ''}
                                  aria-label={f.label}
                                  onChange={(e) =>
                                    setRow(
                                      list.key,
                                      index,
                                      f.key,
                                      f.type === 'text' ? e.target.value : e.target.value === '' ? '' : Number(e.target.value)
                                    )
                                  }
                                />
                              )}
                            </td>
                          )
                        })}
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          <button type="button" className="px-1 text-ink/45 hover:text-ink" aria-label="Move up" onClick={() => moveRow(list.key, index, -1)}>
                            ↑
                          </button>
                          <button type="button" className="px-1 text-ink/45 hover:text-ink" aria-label="Move down" onClick={() => moveRow(list.key, index, 1)}>
                            ↓
                          </button>
                          <button type="button" className="ml-1 px-1 text-ink/45 hover:text-red-600" aria-label="Remove" onClick={() => removeRow(list.key, index)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm text-ink/70">You have unsaved changes.</p>
            <button type="button" className={adminButtonClass.primary} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
