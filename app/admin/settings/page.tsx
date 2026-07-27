'use client'

import { useEffect, useState } from 'react'
import {
  clampFloat,
  clampInt,
  DEFAULT_HOME_SECTIONS,
  normalizeDensity,
  normalizeHomeSections,
  UI_DENSITIES,
} from '@/lib/app-settings-schema'
import { MobilePreview } from './mobile-preview'
import { SectionLayoutEditor } from './section-layout-editor'
import { CHECKBOX_CLASS, EMPTY_FORM, INPUT_CLASS, type SettingsForm } from './types'

const DENSITY_LABELS: Record<string, string> = {
  COMPACT: 'Compact — tighter gaps, more on screen',
  COMFORTABLE: 'Comfortable — default spacing',
  SPACIOUS: 'Spacious — airier, larger gaps',
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
      </div>
    </div>
  )
}

function RangeField({
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
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-sm font-medium text-ink/70">{label}</label>
        <span className="font-mono text-sm text-ink/50">{display}</span>
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

function Toggle({
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
    <label className="flex items-start gap-3 text-sm text-ink/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 ${CHECKBOX_CLASS}`}
      />
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-xs text-ink/40">{hint}</span>}
      </span>
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  step,
  maxLength,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  step?: string
  maxLength?: number
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink/70">{label}</label>
      <input
        type={type}
        step={step}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
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

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

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
        homepageShowValueDeals: Boolean(data.homepageShowValueDeals ?? true),
        homepageShowSpinBanner: Boolean(data.homepageShowSpinBanner ?? true),
        homepageRecommendationMode: String(data.homepageRecommendationMode || 'LATEST'),
        homepageRecommendationTitle: String(data.homepageRecommendationTitle || ''),
        homeSectionLayout: normalizeHomeSections(data.homeSectionLayout),
        brandPrimary: String(data.brandPrimary || EMPTY_FORM.brandPrimary).toUpperCase(),
        brandSecondary: String(data.brandSecondary || EMPTY_FORM.brandSecondary).toUpperCase(),
        headerWash: String(data.headerWash || EMPTY_FORM.headerWash).toUpperCase(),
        pageBackground: String(data.pageBackground || EMPTY_FORM.pageBackground).toUpperCase(),
        textInk: String(data.textInk || EMPTY_FORM.textInk).toUpperCase(),
        textMuted: String(data.textMuted || EMPTY_FORM.textMuted).toUpperCase(),
        surfaceSoft: String(data.surfaceSoft || EMPTY_FORM.surfaceSoft).toUpperCase(),
        cardBackground: String(data.cardBackground || EMPTY_FORM.cardBackground).toUpperCase(),
        cornerRadius: clampInt(data.cornerRadius, EMPTY_FORM.cornerRadius, 0, 32),
        buttonRadius: clampInt(data.buttonRadius, EMPTY_FORM.buttonRadius, 0, 40),
        uiDensity: normalizeDensity(data.uiDensity, EMPTY_FORM.uiDensity),
        productGridColumns: clampInt(data.productGridColumns, EMPTY_FORM.productGridColumns, 2, 4),
        productCardAspectRatio: clampFloat(
          data.productCardAspectRatio,
          EMPTY_FORM.productCardAspectRatio,
          0.5,
          1.2
        ),
        productShowDiscountBadge: Boolean(data.productShowDiscountBadge ?? true),
        productShowCategoryLabel: Boolean(data.productShowCategoryLabel ?? false),
        showPromoTab: Boolean(data.showPromoTab ?? true),
        promoOrbLabel: String(data.promoOrbLabel || EMPTY_FORM.promoOrbLabel),
        navHomeLabel: String(data.navHomeLabel || EMPTY_FORM.navHomeLabel),
        navCategoriesLabel: String(data.navCategoriesLabel || EMPTY_FORM.navCategoriesLabel),
        navTopPicksLabel: String(data.navTopPicksLabel || EMPTY_FORM.navTopPicksLabel),
        walletEnabled: Boolean(data.walletEnabled ?? false),
        cashbackPercent: clampFloat(data.cashbackPercent, EMPTY_FORM.cashbackPercent, 0, 100),
        cashbackMaxAmount: data.cashbackMaxAmount == null ? '' : String(data.cashbackMaxAmount),
        walletMaxPercentPerOrder: clampFloat(
          data.walletMaxPercentPerOrder,
          EMPTY_FORM.walletMaxPercentPerOrder,
          0,
          100
        ),
        walletMaxAmountPerOrder:
          data.walletMaxAmountPerOrder == null ? '' : String(data.walletMaxAmountPerOrder),
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
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-ink/55">
          Control app colours, shape, home section order, product cards, navigation, support details
          and map defaults.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-wine/10 bg-white px-4 py-3 text-sm text-ink/70">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <form onSubmit={handleSubmit} className="min-w-0 flex-1 space-y-6">
          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Branding</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField
                label="Site Name"
                value={formData.siteName}
                onChange={(value) => set('siteName', value)}
              />
              <TextField
                label="Homepage Announcement"
                value={formData.announcementText}
                onChange={(value) => set('announcementText', value)}
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Theme colours</h2>
            <p className="mt-1 text-sm text-ink/55">
              The mobile app picks these up on next launch or settings refresh — no app update
              required.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ColorField
                label="Brand primary"
                value={formData.brandPrimary}
                onChange={(hex) => set('brandPrimary', hex)}
              />
              <ColorField
                label="Brand secondary"
                value={formData.brandSecondary}
                onChange={(hex) => set('brandSecondary', hex)}
              />
              <ColorField
                label="Header wash"
                value={formData.headerWash}
                onChange={(hex) => set('headerWash', hex)}
              />
              <ColorField
                label="Page background"
                value={formData.pageBackground}
                onChange={(hex) => set('pageBackground', hex)}
              />
              <ColorField
                label="Primary text"
                value={formData.textInk}
                onChange={(hex) => set('textInk', hex)}
              />
              <ColorField
                label="Muted text"
                value={formData.textMuted}
                onChange={(hex) => set('textMuted', hex)}
              />
              <ColorField
                label="Chip / placeholder fill"
                value={formData.surfaceSoft}
                onChange={(hex) => set('surfaceSoft', hex)}
              />
              <ColorField
                label="Card surface"
                value={formData.cardBackground}
                onChange={(hex) => set('cardBackground', hex)}
              />
            </div>

            <h3 className="mt-8 font-display text-base font-semibold text-ink">Shape and density</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <RangeField
                label="Card corner radius"
                value={formData.cornerRadius}
                min={0}
                max={32}
                display={`${formData.cornerRadius}px`}
                onChange={(value) => set('cornerRadius', value)}
              />
              <RangeField
                label="Button corner radius"
                value={formData.buttonRadius}
                min={0}
                max={40}
                display={`${formData.buttonRadius}px`}
                onChange={(value) => set('buttonRadius', value)}
              />
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-ink/70">Spacing density</label>
                <select
                  value={formData.uiDensity}
                  onChange={(e) => set('uiDensity', e.target.value)}
                  className={INPUT_CLASS}
                >
                  {UI_DENSITIES.map((density) => (
                    <option key={density} value={density}>
                      {DENSITY_LABELS[density]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Home sections</h2>
                <p className="mt-1 text-sm text-ink/55">
                  Drag to reorder, rename, or hide each block of the mobile home feed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => set('homeSectionLayout', DEFAULT_HOME_SECTIONS)}
                className="rounded-full border border-wine/20 px-4 py-1.5 text-sm font-semibold text-wine hover:bg-cream"
              >
                Reset order
              </button>
            </div>

            <SectionLayoutEditor
              sections={formData.homeSectionLayout}
              onChange={(sections) => set('homeSectionLayout', sections)}
            />

            <h3 className="mt-8 font-display text-base font-semibold text-ink">
              Other homepage blocks
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Toggle
                label="Show homepage banner"
                checked={formData.homepageShowBanner}
                onChange={(checked) => set('homepageShowBanner', checked)}
              />
              <Toggle
                label="Show top category cards"
                hint="Required for the Quick picks section."
                checked={formData.homepageShowTopCategories}
                onChange={(checked) => set('homepageShowTopCategories', checked)}
              />
              <Toggle
                label="Show occasion tabs row"
                checked={formData.homepageShowOccasionTabs}
                onChange={(checked) => set('homepageShowOccasionTabs', checked)}
              />
              <Toggle
                label="Show category sections"
                checked={formData.homepageShowCategorySections}
                onChange={(checked) => set('homepageShowCategorySections', checked)}
              />
              <Toggle
                label="Show recommended products section"
                checked={formData.homepageShowRecommendations}
                onChange={(checked) => set('homepageShowRecommendations', checked)}
              />
              <Toggle
                label="Show Value Deals section (mobile home)"
                checked={formData.homepageShowValueDeals}
                onChange={(checked) => set('homepageShowValueDeals', checked)}
              />
              <Toggle
                label="Show Spin & Win banner"
                hint="Still hides itself once a customer spins, until the daily reset."
                checked={formData.homepageShowSpinBanner}
                onChange={(checked) => set('homepageShowSpinBanner', checked)}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">
                  Recommendation Type
                </label>
                <select
                  value={formData.homepageRecommendationMode}
                  onChange={(e) => set('homepageRecommendationMode', e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="LATEST">Latest Arrivals</option>
                  <option value="BEST_OFFER">Best Offers</option>
                </select>
              </div>

              <TextField
                label="Recommendation Title"
                value={formData.homepageRecommendationTitle}
                onChange={(value) => set('homepageRecommendationTitle', value)}
                placeholder="Latest Arrivals"
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Product cards</h2>
            <p className="mt-1 text-sm text-ink/55">
              Applies to the mobile home grid and every category tab.
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">Grid columns</label>
                <select
                  value={formData.productGridColumns}
                  onChange={(e) => set('productGridColumns', Number(e.target.value))}
                  className={INPUT_CLASS}
                >
                  <option value={2}>2 — large cards</option>
                  <option value={3}>3 — compact</option>
                  <option value={4}>4 — dense</option>
                </select>
              </div>
              <RangeField
                label="Card shape (width ÷ height)"
                value={formData.productCardAspectRatio}
                min={0.5}
                max={1.2}
                step={0.02}
                display={formData.productCardAspectRatio.toFixed(2)}
                onChange={(value) => set('productCardAspectRatio', value)}
              />
              <Toggle
                label="Show discount badge"
                checked={formData.productShowDiscountBadge}
                onChange={(checked) => set('productShowDiscountBadge', checked)}
              />
              <Toggle
                label="Show category label above product name"
                checked={formData.productShowCategoryLabel}
                onChange={(checked) => set('productShowCategoryLabel', checked)}
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Bottom navigation</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField
                label="Home tab label"
                value={formData.navHomeLabel}
                onChange={(value) => set('navHomeLabel', value)}
                maxLength={16}
              />
              <TextField
                label="Categories tab label"
                value={formData.navCategoriesLabel}
                onChange={(value) => set('navCategoriesLabel', value)}
                maxLength={16}
              />
              <TextField
                label="Top picks tab label"
                value={formData.navTopPicksLabel}
                onChange={(value) => set('navTopPicksLabel', value)}
                maxLength={16}
              />
              <TextField
                label="Promo orb text"
                value={formData.promoOrbLabel}
                onChange={(value) => set('promoOrbLabel', value)}
                placeholder="20% OFF"
                maxLength={12}
              />
              <div className="md:col-span-2">
                <Toggle
                  label="Show the floating promo orb"
                  hint="Hiding it removes the only nav entry to the Promo / Spin tab."
                  checked={formData.showPromoTab}
                  onChange={(checked) => set('showPromoTab', checked)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Wallet and cashback</h2>
            <p className="mt-1 text-sm text-ink/55">
              Cashback shows as pending when an order is placed and lands in the wallet once it is
              delivered. Cashback is calculated on the amount paid without the wallet.
            </p>

            <div className="mt-5 space-y-5">
              <Toggle
                label="Enable the customer wallet"
                hint="Turning this off hides the wallet at checkout and stops new cashback."
                checked={formData.walletEnabled}
                onChange={(checked) => set('walletEnabled', checked)}
              />

              <div className="grid gap-5 md:grid-cols-2">
                <RangeField
                  label="Cashback earned per order"
                  value={formData.cashbackPercent}
                  min={0}
                  max={50}
                  step={0.5}
                  display={`${formData.cashbackPercent}%`}
                  onChange={(value) => set('cashbackPercent', value)}
                />
                <TextField
                  label="Max cashback per order (Rs)"
                  type="number"
                  step="1"
                  value={formData.cashbackMaxAmount}
                  onChange={(value) => set('cashbackMaxAmount', value)}
                  placeholder="No cap"
                />
                <RangeField
                  label="Max % of order total payable from wallet"
                  value={formData.walletMaxPercentPerOrder}
                  min={0}
                  max={100}
                  step={5}
                  display={`${formData.walletMaxPercentPerOrder}% of order`}
                  onChange={(value) => set('walletMaxPercentPerOrder', value)}
                />
                <TextField
                  label="Max wallet spend per order (Rs)"
                  type="number"
                  step="1"
                  value={formData.walletMaxAmountPerOrder}
                  onChange={(value) => set('walletMaxAmountPerOrder', value)}
                  placeholder="No cap"
                />
              </div>

              <p className="rounded-xl bg-cream px-4 py-3 text-sm text-ink/70">
                {formData.walletEnabled ? (
                  <>
                    Customers earn {formData.cashbackPercent}%
                    {formData.cashbackMaxAmount
                      ? ` (up to Rs ${formData.cashbackMaxAmount})`
                      : ''}{' '}
                    after delivery. At checkout they can pay up to{' '}
                    {formData.walletMaxPercentPerOrder}% of the order total from
                    their wallet
                    {formData.walletMaxAmountPerOrder
                      ? ` (and never more than Rs ${formData.walletMaxAmountPerOrder})`
                      : ''}
                    , limited by their available balance — not a % of the wallet
                    itself.
                  </>
                ) : (
                  'The wallet is currently switched off for all customers.'
                )}
              </p>
            </div>
          </section>

          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Support</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField
                label="Support Phone"
                value={formData.supportPhone}
                onChange={(value) => set('supportPhone', value)}
              />
              <TextField
                label="Support Email"
                type="email"
                value={formData.supportEmail}
                onChange={(value) => set('supportEmail', value)}
              />
              <TextField
                label="Support Hours"
                value={formData.supportHours}
                onChange={(value) => set('supportHours', value)}
                placeholder="9:00 AM - 9:00 PM"
              />
              <TextField
                label="Support Message"
                value={formData.supportMessage}
                onChange={(value) => set('supportMessage', value)}
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-wine/10 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Delivery and Map</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField
                label="Delivery Estimate"
                value={formData.deliveryEstimate}
                onChange={(value) => set('deliveryEstimate', value)}
              />
              <TextField
                label="Delivery Note"
                value={formData.deliveryNote}
                onChange={(value) => set('deliveryNote', value)}
              />
              <div className="md:col-span-2">
                <TextField
                  label="Store Address"
                  value={formData.storeAddress}
                  onChange={(value) => set('storeAddress', value)}
                />
              </div>
              <TextField
                label="Default Map Latitude"
                type="number"
                step="0.000001"
                value={formData.mapLatitude}
                onChange={(value) => set('mapLatitude', value)}
              />
              <TextField
                label="Default Map Longitude"
                type="number"
                step="0.000001"
                value={formData.mapLongitude}
                onChange={(value) => set('mapLongitude', value)}
              />
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

        <div className="xl:sticky xl:top-6 xl:w-[320px] xl:shrink-0">
          <MobilePreview form={formData} />
        </div>
      </div>
    </div>
  )
}
