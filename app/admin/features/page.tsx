'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminPageHeader, { adminButtonClass } from '@/components/admin/AdminPageHeader'
import {
  FEATURE_ACTIONS,
  FEATURE_EVENTS,
  FEATURE_PLACEMENTS,
  FEATURE_PLATFORMS,
  FEATURE_TYPES,
  type AppFeature,
} from '@/lib/app-features'

type Template = { label: string; feature: Omit<AppFeature, 'id'> }

type FormState = {
  id: string | null
  builtIn: boolean
  key: string
  name: string
  type: AppFeature['type']
  enabled: boolean
  platforms: string[]
  minRuntime: string
  minAppVersion: string
  maxAppVersion: string
  startsAt: string
  endsAt: string
  priority: string
  config: string
}

const inputClass =
  'w-full px-4 py-2 border border-stone-300 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

const TYPE_LABELS: Record<AppFeature['type'], string> = {
  character: 'Character',
  web: 'Web',
  update_prompt: 'Update prompt',
}

function toLocalInput(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function toForm(feature: Omit<AppFeature, 'id'> & { id?: string }): FormState {
  return {
    id: feature.id ?? null,
    builtIn: Boolean(feature.builtIn),
    key: feature.key,
    name: feature.name,
    type: feature.type,
    enabled: feature.enabled,
    platforms: feature.platforms,
    minRuntime: String(feature.minRuntime),
    minAppVersion: feature.minAppVersion ?? '',
    maxAppVersion: feature.maxAppVersion ?? '',
    startsAt: toLocalInput(feature.startsAt),
    endsAt: toLocalInput(feature.endsAt),
    priority: String(feature.priority),
    config: JSON.stringify(feature.config, null, 2),
  }
}

function toPayload(form: FormState, overrides: Partial<FormState> = {}) {
  const f = { ...form, ...overrides }
  return {
    key: f.key,
    name: f.name,
    type: f.type,
    enabled: f.enabled,
    platforms: f.platforms,
    minRuntime: Number(f.minRuntime) || 1,
    minAppVersion: f.minAppVersion || null,
    maxAppVersion: f.maxAppVersion || null,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    priority: Number(f.priority) || 0,
    config: JSON.parse(f.config),
  }
}

/** One-line description of where and how a feature shows up. */
function summary(feature: AppFeature) {
  const config = feature.config as Record<string, unknown>
  const placements = Array.isArray(config.placements) ? (config.placements as string[]).join(', ') : ''
  if (feature.type === 'character') {
    const kind = config.character === 'rive' ? 'Rive character' : 'Gift buddy'
    return placements ? `${kind} · ${placements}` : kind
  }
  if (feature.type === 'web') {
    const trigger = (config.trigger as { event?: string } | undefined)?.event
    return [String(config.presentation ?? ''), placements, trigger ? `on ${trigger}` : '', String(config.url ?? '')]
      .filter(Boolean)
      .join(' · ')
  }
  return `Latest ${String(config.latestVersion ?? '–')} · minimum ${String(config.minSupportedVersion ?? '–')}`
}

function schedule(feature: AppFeature) {
  const fmt = (v: string) => new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  if (feature.startsAt && feature.endsAt) return `${fmt(feature.startsAt)} → ${fmt(feature.endsAt)}`
  if (feature.startsAt) return `From ${fmt(feature.startsAt)}`
  if (feature.endsAt) return `Until ${fmt(feature.endsAt)}`
  return ''
}

export default function AdminFeatures() {
  const [features, setFeatures] = useState<AppFeature[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [tableReady, setTableReady] = useState(true)
  const [runtime, setRuntime] = useState(1)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  const configError = useMemo(() => {
    if (!form) return ''
    try {
      const parsed = JSON.parse(form.config)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? '' : 'Config must be a JSON object'
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON'
    }
  }, [form])

  const load = async () => {
    try {
      const res = await fetch('/api/admin/features')
      if (res.ok) {
        const data = await res.json()
        setFeatures(data.features ?? [])
        setTemplates(data.templates ?? [])
        setTableReady(data.tableReady !== false)
        setRuntime(data.runtime ?? 1)
      }
    } catch (e) {
      console.error('Error fetching features:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  /** Returns an error message, or null when saved. */
  const save = async (state: FormState, overrides: Partial<FormState> = {}) => {
    setSaving(true)
    setError('')
    let message: string | null = null
    try {
      const payload = toPayload(state, overrides)
      const res = await fetch(state.id ? `/api/admin/features/${state.id}` : '/api/admin/features', {
        method: state.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await load()
      } else {
        const data = await res.json().catch(() => ({}))
        message = data.error || 'Could not save the feature'
      }
    } catch (e) {
      message = e instanceof Error ? e.message : 'Could not save the feature'
    } finally {
      setSaving(false)
    }
    if (message) setError(message)
    return message
  }

  const toggle = async (feature: AppFeature) => {
    const message = await save(toForm(feature), { enabled: !feature.enabled })
    if (message) window.alert(message)
  }

  const remove = async (feature: AppFeature) => {
    if (!window.confirm(`Delete "${feature.name}"? The app stops showing it within a few minutes.`)) return
    const res = await fetch(`/api/admin/features/${feature.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || 'Could not delete the feature')
      return
    }
    await load()
  }

  const formatConfig = () => {
    if (!form || configError) return
    setForm({ ...form, config: JSON.stringify(JSON.parse(form.config), null, 2) })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-ink/55">Loading features...</div>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="App features"
        description={
          <span className="block max-w-xl">
            Turn on characters, web blocks, pop-ups and update prompts in the app without a Play Store update. Changes
            reach phones within a few minutes. This app runtime understands version {runtime}.
          </span>
        }
        actions={
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className={adminButtonClass.primary}
          >
            + New feature
          </button>
          {showTemplates ? (
            <div className="absolute right-0 z-10 mt-2 w-64 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
              {templates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => {
                    setShowTemplates(false)
                    setError('')
                    setForm(toForm(template.feature))
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-ink hover:bg-blush-soft"
                >
                  {template.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        }
      />

      {!tableReady ? (
        <div className="mb-6 rounded-2xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-ink">
          The features table isn’t set up on this database yet, so you’re seeing built-in defaults. Run{' '}
          <code className="rounded bg-white px-1">node scripts/_ensure-app-features.mjs</code> on the server (deploys do
          this automatically).
        </div>
      ) : null}

      {form ? (
        <div className="mb-6 rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">
            {form.id ? `Edit ${form.name || form.key}` : 'New feature'}
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (configError) return
              if (!(await save(form))) setForm(null)
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Name</span>
                <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Key (used by the app)</span>
                <input
                  className={`${inputClass} font-mono`}
                  value={form.key}
                  disabled={form.builtIn}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Type</span>
                <select
                  className={inputClass}
                  value={form.type}
                  disabled={form.builtIn}
                  onChange={(e) => setForm({ ...form, type: e.target.value as AppFeature['type'] })}
                >
                  {FEATURE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
              <label className="col-span-2 block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Platforms (none = all)</span>
                <div className="flex h-[42px] items-center gap-4">
                  {FEATURE_PLATFORMS.map((platform) => (
                    <label key={platform} className="flex items-center gap-1.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={form.platforms.includes(platform)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            platforms: e.target.checked
                              ? [...form.platforms, platform]
                              : form.platforms.filter((p) => p !== platform),
                          })
                        }
                      />
                      {platform}
                    </label>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Min runtime</span>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.minRuntime}
                  onChange={(e) => setForm({ ...form, minRuntime: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Min app version</span>
                <input
                  className={inputClass}
                  placeholder="1.0.0"
                  value={form.minAppVersion}
                  onChange={(e) => setForm({ ...form, minAppVersion: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Max app version</span>
                <input
                  className={inputClass}
                  value={form.maxAppVersion}
                  onChange={(e) => setForm({ ...form, maxAppVersion: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Priority</span>
                <input
                  type="number"
                  className={inputClass}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Starts</span>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Ends</span>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </label>
              <label className="flex items-end gap-2 pb-2.5 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                Live
              </label>
            </div>

            <label className="block">
              <span className="mb-1 flex items-center justify-between text-sm font-medium text-ink/70">
                Config (JSON)
                <button type="button" onClick={formatConfig} className="text-xs font-semibold text-wine">
                  Format
                </button>
              </span>
              <textarea
                className={`${inputClass} min-h-[320px] font-mono text-[13px] leading-5`}
                spellCheck={false}
                value={form.config}
                onChange={(e) => setForm({ ...form, config: e.target.value })}
              />
              {configError ? <span className="mt-1 block text-sm text-red-600">{configError}</span> : null}
            </label>

            {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || Boolean(configError)}
                className="rounded-full bg-wine px-6 py-2.5 font-semibold text-white hover:bg-wine-deep disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(null)
                  setError('')
                }}
                className="rounded-full border border-stone-300 px-6 py-2.5 font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="space-y-3">
        {features.map((feature) => (
          <div
            key={feature.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 md:p-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{feature.name}</h3>
                <span className="rounded-full bg-blush-soft px-2 py-0.5 text-[11px] font-semibold text-wine">
                  {TYPE_LABELS[feature.type] ?? feature.type}
                </span>
                {feature.builtIn ? (
                  <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-ink/70">Built-in</span>
                ) : null}
                <code className="text-xs text-ink/45">{feature.key}</code>
              </div>
              <p className="mt-1 truncate text-sm text-ink/60">{summary(feature)}</p>
              <p className="mt-0.5 text-xs text-ink/45">
                {[
                  feature.platforms.length ? feature.platforms.join(', ') : 'All platforms',
                  feature.minAppVersion ? `app ≥ ${feature.minAppVersion}` : '',
                  feature.minRuntime > 1 ? `runtime ≥ ${feature.minRuntime}` : '',
                  schedule(feature),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={feature.enabled} onChange={() => toggle(feature)} disabled={saving} />
              Live
            </label>
            <button
              type="button"
              onClick={() => {
                setError('')
                setForm(toForm(feature))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold text-wine hover:bg-blush-soft"
            >
              Edit
            </button>
            {!feature.builtIn ? (
              <button type="button" onClick={() => remove(feature)} className="text-sm font-semibold text-red-600">
                Delete
              </button>
            ) : null}
          </div>
        ))}
        {features.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-ink/55">
            No features yet. Start from a template with “New feature”.
          </p>
        ) : null}
      </div>

      <details className="mt-8 rounded-xl border border-stone-200 bg-white p-5 text-sm text-ink/70">
        <summary className="cursor-pointer font-semibold text-ink">Building blocks reference</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="mb-1 font-semibold text-ink">Placements</p>
            <ul className="space-y-0.5 font-mono text-xs">
              {FEATURE_PLACEMENTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">Events</p>
            <ul className="space-y-0.5 font-mono text-xs">
              {FEATURE_EVENTS.map((e) => (
                <li key={e}>{e}</li>
              ))}
              <li>custom:&lt;name&gt; (from web features)</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-semibold text-ink">Actions</p>
            <ul className="space-y-0.5 font-mono text-xs">
              {FEATURE_ACTIONS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs">
          Web features can call the app from their page with{' '}
          <code className="rounded bg-stone-50 px-1">window.UpaharoApp.postMessage(JSON.stringify(&#123; do: &apos;add_to_cart&apos;, productId &#125;))</code>{' '}
          (see <code className="rounded bg-stone-50 px-1">lib/app-bridge.ts</code>). Only pages on upaharo.com get the bridge.
        </p>
      </details>
    </div>
  )
}
