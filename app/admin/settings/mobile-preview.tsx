'use client'

import { DENSITY_SCALE } from '@/lib/app-settings-schema'
import type { SettingsForm } from './types'

const SAMPLE_PRODUCTS = [
  { name: 'Red Rose Bouquet', price: 'Rs 1,450', category: 'Flowers', discount: 20 },
  { name: 'Chocolate Truffle Cake', price: 'Rs 1,890', category: 'Cakes', discount: 0 },
  { name: 'Deluxe Gift Hamper', price: 'Rs 2,300', category: 'Hampers', discount: 15 },
  { name: 'Scented Candle Set', price: 'Rs 780', category: 'Decor', discount: 0 },
]

const SAMPLE_CHIPS = ['All', 'Flowers', 'Cakes', 'Hampers']

/**
 * Approximate render of the mobile home screen so colour, radius, density and
 * section-order changes can be judged without rebuilding the Flutter app.
 */
export function MobilePreview({ form }: { form: SettingsForm }) {
  const density = DENSITY_SCALE[form.uiDensity] ?? 1
  const gap = (base: number) => Math.round(base * density)
  const radius = form.cornerRadius
  const pill = form.buttonRadius

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: form.cardBackground,
    borderRadius: radius,
    ...extra,
  })

  const sectionTitle = (title: string, accent?: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        fontSize: 13,
        fontWeight: 800,
        color: form.textInk,
      }}
    >
      <span>{title}</span>
      {accent ? <span style={{ color: form.brandSecondary }}>{accent}</span> : null}
    </div>
  )

  const productTile = (
    product: (typeof SAMPLE_PRODUCTS)[number],
    index: number
  ) => (
    <div key={`${product.name}-${index}`} style={card({ overflow: 'hidden' })}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          backgroundColor: form.surfaceSoft,
        }}
      >
        {form.productShowDiscountBadge && product.discount > 0 && (
          <span
            style={{
              position: 'absolute',
              left: 4,
              top: 4,
              padding: '1px 4px',
              borderRadius: 4,
              backgroundColor: form.brandPrimary,
              color: '#FFFFFF',
              fontSize: 7,
              fontWeight: 900,
            }}
          >
            -{product.discount}%
          </span>
        )}
        <span
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            display: 'grid',
            placeItems: 'center',
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: form.brandPrimary,
            color: '#FFFFFF',
            fontSize: 11,
            lineHeight: 1,
          }}
        >
          +
        </span>
      </div>
      <div style={{ padding: 5 }}>
        {form.productShowCategoryLabel && (
          <div
            style={{
              fontSize: 6,
              fontWeight: 800,
              letterSpacing: 0.3,
              color: form.textMuted,
              opacity: 0.65,
            }}
          >
            {product.category.toUpperCase()}
          </div>
        )}
        <div style={{ fontSize: 8, fontWeight: 600, color: form.textInk, lineHeight: 1.2 }}>
          {product.name}
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: form.brandPrimary }}>
          {product.price}
        </div>
      </div>
    </div>
  )

  const renderSection = (id: string, title: string, subtitle: string) => {
    switch (id) {
      case 'spinBanner':
        if (!form.homepageShowSpinBanner) return null
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: radius + 2,
              backgroundColor: `${form.brandPrimary}14`,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: radius,
                backgroundColor: form.brandPrimary,
                display: 'grid',
                placeItems: 'center',
                color: '#FFFFFF',
                fontSize: 13,
              }}
            >
              ◉
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: form.textInk }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: 8, fontWeight: 600, color: form.textMuted }}>{subtitle}</div>
              )}
            </div>
            <span style={{ color: form.brandPrimary, fontSize: 12 }}>›</span>
          </div>
        )

      case 'valueDeals':
        if (!form.homepageShowValueDeals) return null
        return (
          <div>
            {sectionTitle(title, subtitle)}
            <div style={{ display: 'flex', gap: gap(6), marginTop: gap(6) }}>
              {SAMPLE_PRODUCTS.slice(0, 3).map((product, index) => (
                <div key={index} style={{ ...card({ overflow: 'hidden' }), width: 62 }}>
                  <div style={{ height: 46, backgroundColor: form.surfaceSoft }} />
                  <div style={{ padding: 4 }}>
                    <div style={{ fontSize: 7, color: form.textMuted, lineHeight: 1.2 }}>
                      {product.category}
                    </div>
                    <div style={{ fontSize: 8, fontWeight: 800, color: form.brandPrimary }}>
                      {product.price}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'quickPicks':
        if (!form.homepageShowTopCategories) return null
        return (
          <div>
            {sectionTitle(title, subtitle)}
            <div style={{ display: 'flex', gap: gap(10), marginTop: gap(6) }}>
              {SAMPLE_PRODUCTS.map((product, index) => (
                <div key={index} style={{ textAlign: 'center', width: 40 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      margin: '0 auto',
                      backgroundColor: form.surfaceSoft,
                      border: `1px solid ${form.brandPrimary}22`,
                    }}
                  />
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 6,
                      color: form.textMuted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {product.category}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'productGrid':
        return (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${form.productGridColumns}, minmax(0, 1fr))`,
              gap: gap(6),
            }}
          >
            {SAMPLE_PRODUCTS.slice(0, form.productGridColumns * 2).map(productTile)}
          </div>
        )

      default:
        return null
    }
  }

  const visible = form.homeSectionLayout.filter((section) => section.visible)

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Live preview</h2>
        <span className="text-xs text-ink/45">Approximate</span>
      </div>

      <div
        className="overflow-hidden rounded-[30px] border-4 border-ink/80 shadow-lg"
        style={{ backgroundColor: form.pageBackground, width: 300 }}
      >
        <div
          style={{
            background: `linear-gradient(${form.headerWash}, ${form.pageBackground})`,
            padding: `${gap(12)}px 10px ${gap(8)}px`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 7, color: form.textMuted, opacity: 0.7 }}>DELIVER TO</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: form.textInk }}>
                Kathmandu · 44600
              </div>
            </div>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                backgroundColor: form.surfaceSoft,
              }}
            />
          </div>

          <div
            style={{
              marginTop: gap(8),
              padding: '6px 10px',
              borderRadius: pill,
              backgroundColor: form.cardBackground,
              border: `1px solid ${form.brandPrimary}22`,
              fontSize: 8,
              color: form.textMuted,
            }}
          >
            Search {form.siteName || 'Upaharo'}…
          </div>

          <div style={{ display: 'flex', gap: 5, marginTop: gap(8) }}>
            {SAMPLE_CHIPS.map((chip, index) => (
              <span
                key={chip}
                style={{
                  padding: '3px 8px',
                  borderRadius: pill,
                  fontSize: 7,
                  fontWeight: 700,
                  backgroundColor: index === 0 ? form.brandPrimary : form.surfaceSoft,
                  color: index === 0 ? '#FFFFFF' : form.textMuted,
                }}
              >
                {chip}
              </span>
            ))}
          </div>

          {form.homepageShowBanner && (
            <div
              style={{
                marginTop: gap(8),
                height: 54,
                borderRadius: radius + 4,
                background: `linear-gradient(120deg, ${form.brandPrimary}, ${form.brandSecondary})`,
                display: 'grid',
                placeItems: 'center',
                color: '#FFFFFF',
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {form.announcementText ? form.announcementText.slice(0, 42) : 'Banner'}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: gap(10),
            padding: `0 10px ${gap(10)}px`,
          }}
        >
          {visible.length === 0 ? (
            <p style={{ fontSize: 9, color: form.textMuted, padding: '16px 0', textAlign: 'center' }}>
              Every section is hidden.
            </p>
          ) : (
            visible.map((section) => (
              <div key={section.id}>{renderSection(section.id, section.title, section.subtitle)}</div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 12px' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'space-around',
              padding: '7px 0',
              borderRadius: 16,
              backgroundColor: form.cardBackground,
              border: `1px solid ${form.brandPrimary}1F`,
              boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
            }}
          >
            {[form.navHomeLabel, form.navCategoriesLabel, form.navTopPicksLabel].map(
              (label, index) => (
                <span
                  key={index}
                  style={{
                    fontSize: 7,
                    fontWeight: index === 0 ? 800 : 600,
                    color: index === 0 ? form.brandPrimary : form.textMuted,
                  }}
                >
                  {label || '—'}
                </span>
              )
            )}
          </div>
          {form.showPromoTab && (
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                background: `linear-gradient(135deg, ${form.brandSecondary}, ${form.brandPrimary})`,
                border: '2px solid #FFFFFF',
                color: '#FFFFFF',
                fontSize: 7,
                fontWeight: 900,
                textAlign: 'center',
                lineHeight: 1.1,
              }}
            >
              {form.promoOrbLabel || '20% OFF'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
