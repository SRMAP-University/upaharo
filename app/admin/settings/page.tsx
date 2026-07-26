'use client'

import { useEffect, useState } from 'react'

type SettingsForm = {
  siteName: string
  supportPhone: string
  supportEmail: string
  supportHours: string
  supportMessage: string
  deliveryEstimate: string
  deliveryNote: string
  announcementText: string
  storeAddress: string
  mapLatitude: string
  mapLongitude: string
  homepageShowBanner: boolean
  homepageShowTopCategories: boolean
  homepageShowCategorySections: boolean
  homepageShowOccasionTabs: boolean
  homepageShowRecommendations: boolean
  homepageRecommendationMode: string
  homepageRecommendationTitle: string
  brandPrimary: string
  brandSecondary: string
  headerWash: string
  pageBackground: string
}

const EMPTY_FORM: SettingsForm = {
  siteName: '',
  supportPhone: '',
  supportEmail: '',
  supportHours: '',
  supportMessage: '',
  deliveryEstimate: '',
  deliveryNote: '',
  announcementText: '',
  storeAddress: '',
  mapLatitude: '',
  mapLongitude: '',
  homepageShowBanner: true,
  homepageShowTopCategories: true,
  homepageShowCategorySections: true,
  homepageShowOccasionTabs: true,
  homepageShowRecommendations: true,
  homepageRecommendationMode: 'LATEST',
  homepageRecommendationTitle: '',
  brandPrimary: '#8B5A2B',
  brandSecondary: '#D4AF37',
  headerWash: '#F7F0E8',
  pageBackground: '#FFFFFF',
}

function ColorField({
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
      <label className="mb-1 block text-sm font-medium text-ink/70">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-lg border border-wine/15 bg-white p-1"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          spellCheck={false}
          className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 font-mono text-sm uppercase text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
          placeholder="#RRGGBB"
          maxLength={7}
        />
        <span
          className="h-10 w-10 shrink-0 rounded-xl border border-wine/10"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState<SettingsForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (!res.ok) {
        throw new Error('Failed to load settings')
      }

      const data = await res.json()
      setFormData({
        siteName: String(data.siteName || ''),
        supportPhone: String(data.supportPhone || ''),
        supportEmail: String(data.supportEmail || ''),
        supportHours: String(data.supportHours || ''),
        supportMessage: String(data.supportMessage || ''),
        deliveryEstimate: String(data.deliveryEstimate || ''),
        deliveryNote: String(data.deliveryNote || ''),
        announcementText: String(data.announcementText || ''),
        storeAddress: String(data.storeAddress || ''),
        mapLatitude: String(data.mapLatitude ?? ''),
        mapLongitude: String(data.mapLongitude ?? ''),
        homepageShowBanner: Boolean(data.homepageShowBanner ?? true),
        homepageShowTopCategories: Boolean(data.homepageShowTopCategories ?? true),
        homepageShowCategorySections: Boolean(data.homepageShowCategorySections ?? true),
        homepageShowOccasionTabs: Boolean(data.homepageShowOccasionTabs ?? true),
        homepageShowRecommendations: Boolean(data.homepageShowRecommendations ?? true),
        homepageRecommendationMode: String(data.homepageRecommendationMode || 'LATEST'),
        homepageRecommendationTitle: String(data.homepageRecommendationTitle || ''),
        brandPrimary: String(data.brandPrimary || EMPTY_FORM.brandPrimary).toUpperCase(),
        brandSecondary: String(data.brandSecondary || EMPTY_FORM.brandSecondary).toUpperCase(),
        headerWash: String(data.headerWash || EMPTY_FORM.headerWash).toUpperCase(),
        pageBackground: String(data.pageBackground || EMPTY_FORM.pageBackground).toUpperCase(),
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
      setMessage('Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          mapLatitude: Number(formData.mapLatitude),
          mapLongitude: Number(formData.mapLongitude),
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save settings')
      }

      setMessage('Settings updated successfully.')
    } catch (error: any) {
      console.error('Failed to update settings:', error)
      setMessage(error?.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-ink/55">Loading settings...</div>
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-ink/55">
          Control app colors, homepage layout, support details, delivery text, and map defaults.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-wine/10 bg-white px-4 py-3 text-sm text-ink/70">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-[22px] border border-wine/10 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Branding</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Site Name</label>
              <input
                type="text"
                value={formData.siteName}
                onChange={(e) => setFormData((prev) => ({ ...prev, siteName: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Homepage Announcement</label>
              <input
                type="text"
                value={formData.announcementText}
                onChange={(e) => setFormData((prev) => ({ ...prev, announcementText: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-wine/10 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">App appearance</h2>
              <p className="mt-1 text-sm text-ink/55">
                Mobile app picks this up on next launch / settings refresh — no app update required.
              </p>
            </div>
            <div
              className="flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: formData.brandPrimary }}
            >
              Primary preview
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ColorField
              label="Brand primary"
              value={formData.brandPrimary}
              onChange={(hex) => setFormData((prev) => ({ ...prev, brandPrimary: hex }))}
            />
            <ColorField
              label="Brand secondary"
              value={formData.brandSecondary}
              onChange={(hex) => setFormData((prev) => ({ ...prev, brandSecondary: hex }))}
            />
            <ColorField
              label="Header wash"
              value={formData.headerWash}
              onChange={(hex) => setFormData((prev) => ({ ...prev, headerWash: hex }))}
            />
            <ColorField
              label="Page background"
              value={formData.pageBackground}
              onChange={(hex) => setFormData((prev) => ({ ...prev, pageBackground: hex }))}
            />
          </div>

          <h3 className="mt-8 font-display text-base font-semibold text-ink">Homepage layout</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={formData.homepageShowBanner}
                onChange={(e) => setFormData((prev) => ({ ...prev, homepageShowBanner: e.target.checked }))}
                className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
              />
              Show homepage banner
            </label>

            <label className="flex items-center gap-3 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={formData.homepageShowTopCategories}
                onChange={(e) => setFormData((prev) => ({ ...prev, homepageShowTopCategories: e.target.checked }))}
                className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
              />
              Show top category cards
            </label>

            <label className="flex items-center gap-3 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={formData.homepageShowOccasionTabs}
                onChange={(e) => setFormData((prev) => ({ ...prev, homepageShowOccasionTabs: e.target.checked }))}
                className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
              />
              Show occasion tabs row
            </label>

            <label className="flex items-center gap-3 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={formData.homepageShowCategorySections}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, homepageShowCategorySections: e.target.checked }))
                }
                className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
              />
              Show category sections
            </label>

            <label className="flex items-center gap-3 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={formData.homepageShowRecommendations}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, homepageShowRecommendations: e.target.checked }))
                }
                className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
              />
              Show recommended products section
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Recommendation Type</label>
              <select
                value={formData.homepageRecommendationMode}
                onChange={(e) => setFormData((prev) => ({ ...prev, homepageRecommendationMode: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              >
                <option value="LATEST">Latest Arrivals</option>
                <option value="BEST_OFFER">Best Offers</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Recommendation Title</label>
              <input
                type="text"
                value={formData.homepageRecommendationTitle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, homepageRecommendationTitle: e.target.value }))
                }
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                placeholder="Latest Arrivals"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-wine/10 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Support</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Support Phone</label>
              <input
                type="text"
                value={formData.supportPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, supportPhone: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Support Email</label>
              <input
                type="email"
                value={formData.supportEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, supportEmail: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Support Hours</label>
              <input
                type="text"
                value={formData.supportHours}
                onChange={(e) => setFormData((prev) => ({ ...prev, supportHours: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                placeholder="9:00 AM - 9:00 PM"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Support Message</label>
              <input
                type="text"
                value={formData.supportMessage}
                onChange={(e) => setFormData((prev) => ({ ...prev, supportMessage: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-wine/10 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Delivery and Map</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Delivery Estimate</label>
              <input
                type="text"
                value={formData.deliveryEstimate}
                onChange={(e) => setFormData((prev) => ({ ...prev, deliveryEstimate: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Delivery Note</label>
              <input
                type="text"
                value={formData.deliveryNote}
                onChange={(e) => setFormData((prev) => ({ ...prev, deliveryNote: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-ink/70">Store Address</label>
              <input
                type="text"
                value={formData.storeAddress}
                onChange={(e) => setFormData((prev) => ({ ...prev, storeAddress: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Default Map Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={formData.mapLatitude}
                onChange={(e) => setFormData((prev) => ({ ...prev, mapLatitude: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink/70">Default Map Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={formData.mapLongitude}
                onChange={(e) => setFormData((prev) => ({ ...prev, mapLongitude: e.target.value }))}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-wine px-6 py-2.5 font-semibold text-white transition-colors hover:bg-wine-deep disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
