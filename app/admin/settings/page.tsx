'use client'

import { useEffect, useState } from 'react'
import {
  clampFloat,
  clampInt,
  DEFAULT_DELIVERY_SLOTS,
  DEFAULT_HOME_SECTIONS,
  MAX_SCHEDULE_DAY_COUNT,
  MAX_SCHEDULE_DAYS_AHEAD,
  normalizeDeliverySlots,
  normalizeDensity,
  normalizeHomeSections,
  normalizeScheduleDays,
  normalizeValueDealsProductIds,
  UI_DENSITIES,
} from '@/lib/app-settings-schema'
import SubProductSelector from '@/components/admin/SubProductSelector'
import { DeliverySlotsEditor } from './delivery-slots-editor'
import { MobilePreview } from './mobile-preview'
import { SectionLayoutEditor } from './section-layout-editor'
import {
  ColorField,
  InfoBanner,
  RangeField,
  SettingsAccordion,
  SettingsGrid,
  SettingsGroup,
  SettingsPanel,
  SettingsSubPanel,
  SettingsTabNav,
  StickySaveBar,
  TextField,
  Toggle,
  type SettingsTabId,
} from './settings-shell'
import { EMPTY_FORM, INPUT_CLASS, type SettingsForm } from './types'

const DENSITY_LABELS: Record<string, string> = {
  COMPACT: 'Compact — tighter gaps, more on screen',
  COMFORTABLE: 'Comfortable — default spacing',
  SPACIOUS: 'Spacious — airier, larger gaps',
}

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState<SettingsForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general')

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
        homepageBannerHeight: clampInt(
          data.homepageBannerHeight,
          EMPTY_FORM.homepageBannerHeight,
          200,
          520
        ),
        homepageBannerProductHeight: clampInt(
          data.homepageBannerProductHeight,
          EMPTY_FORM.homepageBannerProductHeight,
          72,
          180
        ),
        miniBannerColumns: clampInt(
          data.miniBannerColumns,
          EMPTY_FORM.miniBannerColumns,
          1,
          4
        ),
        miniBannerHeight: clampInt(
          data.miniBannerHeight,
          EMPTY_FORM.miniBannerHeight,
          56,
          240
        ),
        homepageShowTopCategories: Boolean(data.homepageShowTopCategories ?? true),
        homepageShowCategorySections: Boolean(data.homepageShowCategorySections ?? true),
        homepageShowOccasionTabs: Boolean(data.homepageShowOccasionTabs ?? true),
        homepageShowRecommendations: Boolean(data.homepageShowRecommendations ?? true),
        homepageShowValueDeals: Boolean(data.homepageShowValueDeals ?? true),
        valueDealsProductIds: normalizeValueDealsProductIds(data.valueDealsProductIds),
        valueDealsPromoText: String(
          data.valueDealsPromoText || EMPTY_FORM.valueDealsPromoText
        ),
        valueDealsUnlockAmount: clampFloat(
          data.valueDealsUnlockAmount,
          EMPTY_FORM.valueDealsUnlockAmount,
          0,
          1_000_000
        ),
        homepageShowSpinBanner: Boolean(data.homepageShowSpinBanner ?? true),
        featureGiftOptions: Boolean(data.featureGiftOptions ?? true),
        featureAiAssistant: Boolean(data.featureAiAssistant ?? true),
        featureWishlist: Boolean(data.featureWishlist ?? true),
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
        checkoutMinPayable: clampFloat(
          data.checkoutMinPayable,
          EMPTY_FORM.checkoutMinPayable,
          0,
          1_000_000
        ),
        checkoutMinOrderAmount: clampFloat(
          data.checkoutMinOrderAmount,
          EMPTY_FORM.checkoutMinOrderAmount,
          0,
          1_000_000
        ),
        freeDeliveryMinAmount: clampFloat(
          data.freeDeliveryMinAmount,
          EMPTY_FORM.freeDeliveryMinAmount,
          0,
          1_000_000
        ),
        deliveryFeeAmount: clampFloat(
          data.deliveryFeeAmount,
          EMPTY_FORM.deliveryFeeAmount,
          0,
          1_000_000
        ),
        deliverySlots: normalizeDeliverySlots(data.deliverySlots),
        ...normalizeScheduleDays(data.scheduleDayCount, data.scheduleMaxDaysAhead),
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
      <div className="mb-5 hidden md:mb-6 md:block">
        <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 max-w-2xl text-ink/55">
          Configure your mobile app by category. Changes apply after you save.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            message.includes('success')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-wine/10 bg-white text-ink/70'
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* Mobile / tablet tabs — stick under header */}
        <div className="sticky top-12 z-30 -mx-4 border-b border-wine/10 bg-cream/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-cream/90 xl:hidden">
          <SettingsTabNav active={activeTab} onChange={setActiveTab} variant="horizontal" />
        </div>

        {/* Desktop settings menu — stick under header while form scrolls */}
        <aside className="hidden xl:sticky xl:top-14 xl:block xl:w-56 xl:shrink-0 xl:self-start xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto xl:pb-4">
          <SettingsTabNav active={activeTab} onChange={setActiveTab} variant="sidebar" />
        </aside>

        <div className="min-w-0 flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {activeTab === 'general' && (
              <SettingsPanel
                title="General"
                description="Basic store identity shown in the app header and announcement bar."
              >
                <SettingsGrid>
                  <TextField
                    label="Site name"
                    value={formData.siteName}
                    onChange={(value) => set('siteName', value)}
                    hint="Displayed in the app header and share previews."
                  />
                  <TextField
                    label="Homepage announcement"
                    value={formData.announcementText}
                    onChange={(value) => set('announcementText', value)}
                    hint="Optional banner text on the home screen. Leave empty to hide."
                  />
                </SettingsGrid>
              </SettingsPanel>
            )}

            {activeTab === 'appearance' && (
              <>
                <SettingsPanel
                  title="Theme colours"
                  description="The mobile app picks these up on next launch or settings refresh — no app update required."
                >
                  <SettingsGroup title="Brand palette">
                    <SettingsGrid cols={3}>
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
                    </SettingsGrid>
                  </SettingsGroup>

                  <SettingsGroup
                    title="Shape and density"
                    description="Control corner rounding and spacing across the app."
                  >
                    <SettingsGrid>
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
                        <label className="mb-2 block text-sm font-medium text-ink/80">
                          Spacing density
                        </label>
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
                    </SettingsGrid>
                  </SettingsGroup>
                </SettingsPanel>

                <SettingsPanel
                  title="Product cards"
                  description="Applies to the mobile home grid and every category tab."
                >
                  <SettingsGrid>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink/80">
                        Grid columns
                      </label>
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
                  </SettingsGrid>
                </SettingsPanel>
              </>
            )}

            {activeTab === 'home' && (
              <>
                <SettingsPanel
                  title="Home section order"
                  description="Sticky header carousel is separate from feed banner sections — each has its own Visible switch. Drag feed blocks to reorder."
                  action={
                    <button
                      type="button"
                      onClick={() => set('homeSectionLayout', DEFAULT_HOME_SECTIONS)}
                      className="rounded-full border border-wine/20 px-4 py-1.5 text-sm font-semibold text-wine hover:bg-cream"
                    >
                      Reset order
                    </button>
                  }
                >
                  <SectionLayoutEditor
                    sections={formData.homeSectionLayout}
                    onChange={(sections) => set('homeSectionLayout', sections)}
                    homepageShowBanner={formData.homepageShowBanner}
                    onHomepageShowBannerChange={(visible) => set('homepageShowBanner', visible)}
                  />
                </SettingsPanel>

                <SettingsPanel
                  title="Homepage visibility"
                  description="Toggle which blocks appear on the mobile home screen."
                >
                  <SettingsGrid>
                    <Toggle
                      label="Show sticky header carousel"
                      hint="Top-of-home only. Feed banner sections use their own Visible switches in Home section order."
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
                      label="Show Value Deals section"
                      checked={formData.homepageShowValueDeals}
                      onChange={(checked) => set('homepageShowValueDeals', checked)}
                    />
                    <Toggle
                      label="Show Spin & Win banner"
                      hint="Still hides itself once a customer spins, until the daily reset."
                      checked={formData.homepageShowSpinBanner}
                      onChange={(checked) => set('homepageShowSpinBanner', checked)}
                    />
                  </SettingsGrid>
                </SettingsPanel>

                <SettingsPanel title="Banner sizing">
                  <SettingsGrid>
                    <RangeField
                      label="Banner height (mobile)"
                      value={formData.homepageBannerHeight}
                      min={200}
                      max={520}
                      step={4}
                      display={`${formData.homepageBannerHeight}px`}
                      onChange={(value) => set('homepageBannerHeight', value)}
                    />
                    <RangeField
                      label="Banner product tile height"
                      value={formData.homepageBannerProductHeight}
                      min={72}
                      max={180}
                      step={2}
                      display={`${formData.homepageBannerProductHeight}px`}
                      onChange={(value) => set('homepageBannerProductHeight', value)}
                    />
                  </SettingsGrid>
                </SettingsPanel>

                <SettingsPanel title="Features">
                  <SettingsGrid>
                    <Toggle
                      label="Enable gift checkout options"
                      hint="Shows gift wrap, recipient, occasion and greeting fields at checkout."
                      checked={formData.featureGiftOptions}
                      onChange={(checked) => set('featureGiftOptions', checked)}
                    />
                    <Toggle
                      label="Enable AI shopping assistant"
                      checked={formData.featureAiAssistant}
                      onChange={(checked) => set('featureAiAssistant', checked)}
                    />
                    <Toggle
                      label="Enable wishlist"
                      checked={formData.featureWishlist}
                      onChange={(checked) => set('featureWishlist', checked)}
                    />
                  </SettingsGrid>
                </SettingsPanel>

                <SettingsAccordion
                  title="Mini banner row"
                  description="Sizing for the Featured row of small tiles. Edit tiles in Mini Banners."
                  defaultOpen={false}
                >
                  <InfoBanner>
                    Add and edit tiles in{' '}
                    <a href="/admin/mini-banners" className="font-semibold text-wine underline">
                      Mini Banners
                    </a>
                    . The row has no heading — reorder or hide it in Home section order.
                  </InfoBanner>
                  <SettingsGrid>
                    <RangeField
                      label="Tiles per row"
                      value={formData.miniBannerColumns}
                      min={1}
                      max={4}
                      step={1}
                      display={`${formData.miniBannerColumns} across`}
                      onChange={(value) => set('miniBannerColumns', value)}
                    />
                    <RangeField
                      label="Tile height"
                      value={formData.miniBannerHeight}
                      min={56}
                      max={240}
                      step={4}
                      display={`${formData.miniBannerHeight}px`}
                      onChange={(value) => set('miniBannerHeight', value)}
                    />
                  </SettingsGrid>
                  <p className="text-xs text-ink/45">
                    Tile width is the screen split {formData.miniBannerColumns} ways. Extra active
                    tiles stay reachable by scrolling the row sideways.
                  </p>
                </SettingsAccordion>

                <SettingsAccordion
                  title="Value Deals content"
                  description="Products, promo line, and unlock spend threshold."
                  defaultOpen={false}
                >
                  <TextField
                    label="Promo text (use {amount} for unlock threshold)"
                    value={formData.valueDealsPromoText}
                    onChange={(value) => set('valueDealsPromoText', value)}
                    placeholder="Shop for {amount} to unlock deals"
                  />
                  <TextField
                    label="Unlock amount (Rs)"
                    type="number"
                    step="1"
                    value={String(formData.valueDealsUnlockAmount)}
                    onChange={(value) =>
                      set(
                        'valueDealsUnlockAmount',
                        clampFloat(value, EMPTY_FORM.valueDealsUnlockAmount, 0, 1_000_000)
                      )
                    }
                    hint="Progress bar unlocks when the cart reaches this total."
                  />
                  <SubProductSelector
                    value={formData.valueDealsProductIds}
                    onChange={(ids) => set('valueDealsProductIds', ids)}
                    title="Value Deals products"
                    hint="Order matters — first selected shows first in the carousel. Max 40."
                    searchPlaceholder="Search products to feature in Value Deals..."
                  />
                </SettingsAccordion>

                <SettingsPanel title="Recommendations">
                  <SettingsGrid>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink/80">
                        Recommendation type
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
                      label="Recommendation title"
                      value={formData.homepageRecommendationTitle}
                      onChange={(value) => set('homepageRecommendationTitle', value)}
                      placeholder="Latest Arrivals"
                    />
                  </SettingsGrid>
                </SettingsPanel>
              </>
            )}

            {activeTab === 'navigation' && (
              <SettingsPanel
                title="Bottom navigation"
                description="Labels for the mobile bottom tab bar and floating promo orb."
              >
                <SettingsGrid>
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
                </SettingsGrid>
                <div className="mt-5">
                  <Toggle
                    label="Show the floating promo orb"
                    hint="Hiding it removes the only nav entry to the Promo / Spin tab."
                    checked={formData.showPromoTab}
                    onChange={(checked) => set('showPromoTab', checked)}
                  />
                </div>
              </SettingsPanel>
            )}

            {activeTab === 'checkout' && (
              <>
                <SettingsPanel
                  title="Wallet and cashback"
                  description="Cashback shows as pending when an order is placed and lands in the wallet once delivered."
                >
                  <Toggle
                    label="Enable the customer wallet"
                    hint="Turning this off hides the wallet at checkout and stops new cashback."
                    checked={formData.walletEnabled}
                    onChange={(checked) => set('walletEnabled', checked)}
                  />

                  <SettingsGrid cols={1}>
                    <SettingsSubPanel title="Cashback rules">
                      <SettingsGrid>
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
                      </SettingsGrid>
                    </SettingsSubPanel>

                    <SettingsSubPanel title="Wallet limits at checkout">
                      <SettingsGrid>
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
                        <TextField
                          label="Minimum payable after wallet (Rs)"
                          type="number"
                          step="1"
                          value={String(formData.checkoutMinPayable)}
                          onChange={(value) =>
                            set('checkoutMinPayable', clampFloat(value, 0, 0, 1_000_000))
                          }
                          placeholder="0"
                        />
                        <TextField
                          label="Minimum order amount (Rs)"
                          type="number"
                          step="1"
                          value={String(formData.checkoutMinOrderAmount)}
                          onChange={(value) =>
                            set('checkoutMinOrderAmount', clampFloat(value, 0, 0, 1_000_000))
                          }
                          placeholder="0 = no minimum"
                        />
                      </SettingsGrid>
                    </SettingsSubPanel>
                  </SettingsGrid>

                  <InfoBanner>
                    {formData.walletEnabled ? (
                      <>
                        Customers earn {formData.cashbackPercent}%
                        {formData.cashbackMaxAmount
                          ? ` (up to Rs ${formData.cashbackMaxAmount})`
                          : ''}{' '}
                        after delivery. At checkout they can pay up to{' '}
                        {formData.walletMaxPercentPerOrder}% of the order total from their wallet
                        {formData.walletMaxAmountPerOrder
                          ? ` (and never more than Rs ${formData.walletMaxAmountPerOrder})`
                          : ''}
                        {formData.checkoutMinPayable > 0
                          ? `, leaving at least Rs ${formData.checkoutMinPayable} to pay`
                          : ''}
                        .
                      </>
                    ) : (
                      'The wallet is currently switched off for all customers.'
                    )}
                  </InfoBanner>
                </SettingsPanel>

                <SettingsPanel
                  title="Delivery fees"
                  description="Free delivery kicks in once items + gift wrap reach the threshold."
                >
                  <SettingsGrid>
                    <TextField
                      label="Free delivery above (Rs)"
                      type="number"
                      step="1"
                      value={String(formData.freeDeliveryMinAmount)}
                      onChange={(value) =>
                        set('freeDeliveryMinAmount', clampFloat(value, 199, 0, 1_000_000))
                      }
                    />
                    <TextField
                      label="Delivery fee when below threshold (Rs)"
                      type="number"
                      step="1"
                      value={String(formData.deliveryFeeAmount)}
                      onChange={(value) =>
                        set('deliveryFeeAmount', clampFloat(value, 40, 0, 1_000_000))
                      }
                    />
                  </SettingsGrid>
                  <InfoBanner>
                    Goods total ≥ Rs {formData.freeDeliveryMinAmount} → free delivery. Otherwise Rs{' '}
                    {formData.deliveryFeeAmount} delivery fee.
                    {formData.checkoutMinOrderAmount > 0
                      ? ` Checkout also requires a minimum order of Rs ${formData.checkoutMinOrderAmount}.`
                      : ''}
                  </InfoBanner>
                </SettingsPanel>

                <SettingsPanel
                  title="Scheduled delivery"
                  description="Windows customers can book at checkout, in Nepal time."
                  action={
                    <button
                      type="button"
                      onClick={() => set('deliverySlots', DEFAULT_DELIVERY_SLOTS)}
                      className="rounded-full border border-wine/20 px-4 py-1.5 text-sm font-semibold text-wine hover:bg-cream"
                    >
                      Reset to defaults
                    </button>
                  }
                >
                  <DeliverySlotsEditor
                    slots={formData.deliverySlots}
                    onChange={(slots) => set('deliverySlots', slots)}
                  />

                  <SettingsGrid>
                    <TextField
                      label="Quick day chips (including today)"
                      type="number"
                      step="1"
                      value={String(formData.scheduleDayCount)}
                      onChange={(value) =>
                        set('scheduleDayCount', clampInt(value, 3, 1, MAX_SCHEDULE_DAY_COUNT))
                      }
                      hint="One-tap days shown at checkout. Beyond these, customers pick a date."
                    />
                    <TextField
                      label="Furthest bookable date (days ahead)"
                      type="number"
                      step="1"
                      value={String(formData.scheduleMaxDaysAhead)}
                      onChange={(value) =>
                        set(
                          'scheduleMaxDaysAhead',
                          clampInt(value, 30, 1, MAX_SCHEDULE_DAYS_AHEAD)
                        )
                      }
                      hint="Upper limit for the custom date picker."
                    />
                  </SettingsGrid>

                  <InfoBanner>
                    {formData.deliverySlots.length === 0
                      ? 'Scheduling is off — checkout will only offer “Deliver now”.'
                      : `${formData.deliverySlots.length} window${
                          formData.deliverySlots.length === 1 ? '' : 's'
                        } per day. Checkout defaults to the next day, opens with ${
                          formData.scheduleDayCount
                        } day chip${
                          formData.scheduleDayCount === 1 ? '' : 's'
                        }, and allows custom dates up to ${
                          Math.max(formData.scheduleDayCount, formData.scheduleMaxDaysAhead) - 1
                        } days out. Windows that have already started are hidden automatically.`}
                  </InfoBanner>
                </SettingsPanel>
              </>
            )}

            {activeTab === 'support' && (
              <>
                <SettingsPanel
                  title="Customer support"
                  description="Contact details shown in the app help and order screens."
                >
                  <SettingsGrid>
                    <TextField
                      label="Support phone"
                      value={formData.supportPhone}
                      onChange={(value) => set('supportPhone', value)}
                    />
                    <TextField
                      label="Support email"
                      type="email"
                      value={formData.supportEmail}
                      onChange={(value) => set('supportEmail', value)}
                    />
                    <TextField
                      label="Support hours"
                      value={formData.supportHours}
                      onChange={(value) => set('supportHours', value)}
                      placeholder="9:00 AM - 9:00 PM"
                    />
                    <TextField
                      label="Support message"
                      value={formData.supportMessage}
                      onChange={(value) => set('supportMessage', value)}
                    />
                  </SettingsGrid>
                </SettingsPanel>

                <SettingsPanel
                  title="Delivery and map"
                  description="Default delivery messaging and store location for the address picker."
                >
                  <SettingsGrid>
                    <TextField
                      label="Delivery estimate"
                      value={formData.deliveryEstimate}
                      onChange={(value) => set('deliveryEstimate', value)}
                    />
                    <TextField
                      label="Delivery note"
                      value={formData.deliveryNote}
                      onChange={(value) => set('deliveryNote', value)}
                    />
                    <div className="md:col-span-2">
                      <TextField
                        label="Store address"
                        value={formData.storeAddress}
                        onChange={(value) => set('storeAddress', value)}
                      />
                    </div>
                    <TextField
                      label="Default map latitude"
                      type="number"
                      step="0.000001"
                      value={formData.mapLatitude}
                      onChange={(value) => set('mapLatitude', value)}
                    />
                    <TextField
                      label="Default map longitude"
                      type="number"
                      step="0.000001"
                      value={formData.mapLongitude}
                      onChange={(value) => set('mapLongitude', value)}
                    />
                  </SettingsGrid>
                </SettingsPanel>
              </>
            )}

            <StickySaveBar saving={saving} />
          </form>
        </div>

        {(activeTab === 'appearance' || activeTab === 'home' || activeTab === 'navigation') && (
          <div className="hidden xl:block xl:w-[300px] xl:shrink-0">
            <div className="xl:sticky xl:top-14 xl:pb-28">
              <MobilePreview form={formData} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
