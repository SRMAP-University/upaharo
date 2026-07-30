'use client'

import {
  formatRadiusEta,
  MAX_DELIVERY_RADIUS_TIERS,
  radiusTierIdFor,
  type DeliveryRadiusTier,
} from '@/lib/app-settings-schema'

const FIELD_CLASS =
  'w-full rounded-lg border border-wine/15 bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

type Props = {
  tiers: DeliveryRadiusTier[]
  onChange: (tiers: DeliveryRadiusTier[]) => void
}

function sortTiers(tiers: DeliveryRadiusTier[]) {
  return [...tiers].sort((a, b) => a.maxRadiusKm - b.maxRadiusKm)
}

export function DeliveryRadiusTiersEditor({ tiers, onChange }: Props) {
  const duplicateRadii = new Set(
    tiers
      .map((tier) => Math.round(tier.maxRadiusKm * 100))
      .filter((km, index, all) => all.indexOf(km) !== index)
  )

  const update = (index: number, patch: Partial<DeliveryRadiusTier>) => {
    onChange(
      sortTiers(
        tiers.map((tier, i) => {
          if (i !== index) return tier
          const next = { ...tier, ...patch }
          return {
            ...next,
            id: radiusTierIdFor(next.maxRadiusKm),
          }
        })
      )
    )
  }

  const remove = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index))
  }

  const add = () => {
    const lastMax = tiers.length
      ? Math.max(...tiers.map((tier) => tier.maxRadiusKm))
      : 0
    const maxRadiusKm = Math.min(Math.round((lastMax + 2) * 10) / 10, 200)
    const prev = tiers[tiers.length - 1]
    onChange(
      sortTiers([
        ...tiers,
        {
          id: radiusTierIdFor(maxRadiusKm),
          maxRadiusKm,
          feeAmount: prev ? Math.round((prev.feeAmount + 20) * 100) / 100 : 40,
          etaMinMinutes: prev ? prev.etaMinMinutes + 10 : 20,
          etaMaxMinutes: prev ? prev.etaMaxMinutes + 15 : 30,
          label: '',
        },
      ])
    )
  }

  return (
    <div className="mt-4">
      {tiers.length === 0 ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-sm text-ink/70">
          No zones yet — checkout will use the flat delivery fee from the Checkout
          tab. Add rings below to charge by distance from the store pin.
        </p>
      ) : (
        <ol className="space-y-3">
          {tiers.map((tier, index) => {
            const prevMax = index === 0 ? 0 : tiers[index - 1].maxRadiusKm
            const invalidEta = tier.etaMaxMinutes < tier.etaMinMinutes
            const duplicate = duplicateRadii.has(Math.round(tier.maxRadiusKm * 100))
            const rangeLabel =
              index === 0
                ? `0 – ${tier.maxRadiusKm} km`
                : `${prevMax} – ${tier.maxRadiusKm} km`

            return (
              <li
                key={`${tier.id}-${index}`}
                className="rounded-2xl border border-wine/10 bg-cream/40 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Zone {index + 1}
                      {tier.label ? ` · ${tier.label}` : ''}
                    </p>
                    <p className="text-xs text-ink/55">{rangeLabel}</p>
                  </div>
                  <p className="text-xs text-ink/60">
                    {formatRadiusEta(tier.etaMinMinutes, tier.etaMaxMinutes)} · Rs{' '}
                    {tier.feeAmount}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[7rem_7rem_6rem_6rem_1fr_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      Up to (km)
                    </label>
                    <input
                      type="number"
                      min={0.1}
                      max={200}
                      step={0.1}
                      value={tier.maxRadiusKm}
                      onChange={(event) =>
                        update(index, {
                          maxRadiusKm: Number(event.target.value),
                        })
                      }
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      Fee (Rs)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1_000_000}
                      step={1}
                      value={tier.feeAmount}
                      onChange={(event) =>
                        update(index, {
                          feeAmount: Number(event.target.value),
                        })
                      }
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      ETA min
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24 * 60}
                      step={1}
                      value={tier.etaMinMinutes}
                      onChange={(event) =>
                        update(index, {
                          etaMinMinutes: Number(event.target.value),
                        })
                      }
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      ETA max
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24 * 60}
                      step={1}
                      value={tier.etaMaxMinutes}
                      onChange={(event) =>
                        update(index, {
                          etaMaxMinutes: Number(event.target.value),
                        })
                      }
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      Label (optional)
                    </label>
                    <input
                      type="text"
                      value={tier.label}
                      placeholder="Near store"
                      onChange={(event) =>
                        update(index, { label: event.target.value })
                      }
                      className={FIELD_CLASS}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove zone up to ${tier.maxRadiusKm} km`}
                    className="rounded-lg border border-wine/15 px-3 py-1.5 text-xs text-wine hover:bg-wine/5"
                  >
                    Remove
                  </button>
                </div>

                {invalidEta && (
                  <p className="mt-2 text-xs text-red-600">
                    Max ETA must be greater than or equal to min ETA.
                  </p>
                )}
                {duplicate && (
                  <p className="mt-2 text-xs text-red-600">
                    Another zone already ends at {tier.maxRadiusKm} km — only the
                    first will be kept on save.
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={add}
        disabled={tiers.length >= MAX_DELIVERY_RADIUS_TIERS}
        className="mt-3 rounded-xl border border-wine/20 px-4 py-2 text-sm font-medium text-wine hover:bg-wine/5 disabled:opacity-40"
      >
        + Add zone
      </button>
      {tiers.length >= MAX_DELIVERY_RADIUS_TIERS && (
        <span className="ml-3 text-xs text-ink/45">
          Maximum {MAX_DELIVERY_RADIUS_TIERS} zones.
        </span>
      )}
    </div>
  )
}
