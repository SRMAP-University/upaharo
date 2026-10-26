'use client'

import { useEffect, useState } from 'react'
import { formatPriceCompact } from '@/lib/utils'

type OfferMode = 'price' | 'percent'

const round2 = (value: number) => Math.round(value * 100) / 100
const toNumber = (value: unknown) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

/** Discount (%) that turns `price` into `offerPrice`, kept exact so the shop shows that offer price. */
function discountFor(price: number, offerPrice: number) {
  if (price <= 0) return 0
  return Math.min(100, Math.max(0, ((price - offerPrice) / price) * 100))
}

/**
 * Offer pricing for a product. The product stores a discount (%); this lets
 * the team type either the offer price or the offer %, and shows the sum.
 */
export default function ProductOfferPriceFields({
  price,
  discount,
  onDiscountChange,
}: {
  price: number | string
  discount: number
  onDiscountChange: (discount: number) => void
}) {
  const [mode, setMode] = useState<OfferMode>('price')
  // What the team is typing, so "12." or an empty box isn't overwritten mid-edit.
  const [draft, setDraft] = useState<string | null>(null)
  // Offer price the team typed; it stays put when the price changes.
  const [offerTarget, setOfferTarget] = useState<number | null>(null)

  const priceValue = toNumber(price)
  const discountValue = Math.min(100, Math.max(0, toNumber(discount)))
  const offerPrice = priceValue - (priceValue * discountValue) / 100
  const saving = priceValue - offerPrice
  const hasOffer = priceValue > 0 && discountValue > 0
  const typedOffer = mode === 'price' && draft !== null && draft.trim() !== '' ? toNumber(draft) : null
  const offerTooHigh = typedOffer !== null && priceValue > 0 && typedOffer > priceValue

  useEffect(() => {
    if (mode !== 'price' || offerTarget === null) return
    const next = discountFor(priceValue, offerTarget)
    if (Math.abs(next - discountValue) > 1e-9) onDiscountChange(next)
    // Only re-run when the price changes; the discount follows from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceValue])

  const switchMode = (next: OfferMode) => {
    setMode(next)
    setDraft(null)
    setOfferTarget(null)
  }

  const handleOfferPrice = (value: string) => {
    setDraft(value)
    if (value.trim() === '') {
      setOfferTarget(null)
      onDiscountChange(0)
      return
    }
    const offer = Math.max(0, toNumber(value))
    setOfferTarget(offer)
    onDiscountChange(discountFor(priceValue, offer))
  }

  const handlePercent = (value: string) => {
    setDraft(value)
    onDiscountChange(value.trim() === '' ? 0 : Math.min(100, Math.max(0, toNumber(value))))
  }

  const inputValue =
    draft !== null
      ? draft
      : mode === 'price'
        ? hasOffer
          ? String(round2(offerPrice))
          : ''
        : discountValue > 0
          ? String(round2(discountValue))
          : ''

  const tabClass = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      active ? 'bg-white text-wine shadow-sm' : 'text-ink/60 hover:text-ink'
    }`

  return (
    <div className="w-full rounded-2xl border border-wine/10 bg-cream/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Offer</h3>
          <p className="text-xs text-ink/55">Set the offer price or the % off. The other is worked out for you.</p>
        </div>
        <div className="flex w-full gap-1 rounded-xl bg-wine/5 p-1 sm:w-auto" role="tablist" aria-label="Set offer by">
          <button type="button" role="tab" aria-selected={mode === 'price'} onClick={() => switchMode('price')} className={tabClass(mode === 'price')}>
            Offer price
          </button>
          <button type="button" role="tab" aria-selected={mode === 'percent'} onClick={() => switchMode('percent')} className={tabClass(mode === 'percent')}>
            Offer %
          </button>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-ink/70" htmlFor="product-offer">
          {mode === 'price' ? 'Offer price (NPR)' : 'Offer (% off)'}
        </label>
        <div className="relative">
          {mode === 'price' ? (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-ink/45">Rs.</span>
          ) : null}
          <input
            id="product-offer"
            type="number"
            min="0"
            max={mode === 'percent' ? '100' : undefined}
            step="0.01"
            inputMode="decimal"
            value={inputValue}
            disabled={priceValue <= 0}
            onChange={(e) => (mode === 'price' ? handleOfferPrice(e.target.value) : handlePercent(e.target.value))}
            onBlur={() => setDraft(null)}
            placeholder={mode === 'price' ? 'Leave empty for no offer' : '0'}
            className={`w-full rounded-xl border border-wine/15 bg-white py-2 text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15 disabled:opacity-60 ${
              mode === 'price' ? 'pl-12 pr-4' : 'pl-4 pr-10'
            }`}
          />
          {mode === 'percent' ? (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink/45">%</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm" aria-live="polite">
        {priceValue <= 0 ? (
          <p className="text-ink/55">Enter the price first.</p>
        ) : offerTooHigh ? (
          <p className="text-red-600">
            The offer price is higher than the price ({formatPriceCompact(priceValue)}), so there’s no offer.
          </p>
        ) : hasOffer ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ink/70">
              <span>{formatPriceCompact(priceValue)}</span>
              <span>−</span>
              <span>
                {round2(discountValue)}% ({formatPriceCompact(saving)})
              </span>
              <span>=</span>
              <span className="font-semibold text-wine">{formatPriceCompact(offerPrice)}</span>
            </div>
            <p className="mt-1 text-xs text-ink/55">
              Shoppers see {formatPriceCompact(offerPrice)} with {formatPriceCompact(priceValue)} struck through and a{' '}
              {Math.round(discountValue)}% OFF badge.
            </p>
          </>
        ) : (
          <p className="text-ink/55">No offer. Sells at {formatPriceCompact(priceValue)}.</p>
        )}
      </div>
    </div>
  )
}
