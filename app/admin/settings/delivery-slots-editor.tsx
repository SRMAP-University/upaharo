'use client'

import {
  formatSlotLabel,
  slotIdFor,
  MAX_DELIVERY_SLOTS,
  type DeliverySlotConfig,
} from '@/lib/app-settings-schema'

const FIELD_CLASS =
  'w-full rounded-lg border border-wine/15 bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40'

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, hour) => hour)

function hourLabel(hour: number) {
  if (hour === 0 || hour === 24) return '12:00 AM'
  if (hour === 12) return '12:00 PM'
  return hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`
}

type Props = {
  slots: DeliverySlotConfig[]
  onChange: (slots: DeliverySlotConfig[]) => void
}

export function DeliverySlotsEditor({ slots, onChange }: Props) {
  /**
   * Two windows cannot share a start hour: the order API identifies the chosen
   * window by its start, so a duplicate would be unreachable.
   */
  const duplicateStarts = new Set(
    slots
      .map((slot) => slot.startHour)
      .filter((hour, index, all) => all.indexOf(hour) !== index)
  )

  const update = (index: number, patch: Partial<DeliverySlotConfig>) => {
    onChange(
      slots.map((slot, i) => {
        if (i !== index) return slot
        const next = { ...slot, ...patch }
        return { ...next, id: slotIdFor(next.startHour, next.endHour) }
      })
    )
  }

  const remove = (index: number) => {
    onChange(slots.filter((_, i) => i !== index))
  }

  const add = () => {
    const lastEnd = slots.length ? Math.max(...slots.map((slot) => slot.endHour)) : 10
    const startHour = Math.min(lastEnd, 22)
    const endHour = Math.min(startHour + 2, 24)
    onChange([
      ...slots,
      {
        id: slotIdFor(startHour, endHour),
        startHour,
        endHour,
        label: formatSlotLabel(startHour, endHour),
      },
    ])
  }

  return (
    <div className="mt-4">
      {slots.length === 0 ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-sm text-ink/70">
          No windows configured — customers can only choose “Deliver now”.
        </p>
      ) : (
        <ol className="space-y-3">
          {slots.map((slot, index) => {
            const invalidRange = slot.endHour <= slot.startHour
            const duplicate = duplicateStarts.has(slot.startHour)

            return (
              <li
                key={index}
                className="rounded-2xl border border-wine/10 bg-cream/40 p-4"
              >
                <div className="grid gap-3 md:grid-cols-[7rem_7rem_1fr_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      Starts
                    </label>
                    <select
                      value={slot.startHour}
                      onChange={(event) =>
                        update(index, { startHour: Number(event.target.value) })
                      }
                      className={FIELD_CLASS}
                    >
                      {HOUR_OPTIONS.slice(0, 24).map((hour) => (
                        <option key={hour} value={hour}>
                          {hourLabel(hour)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      Ends
                    </label>
                    <select
                      value={slot.endHour}
                      onChange={(event) =>
                        update(index, { endHour: Number(event.target.value) })
                      }
                      className={FIELD_CLASS}
                    >
                      {HOUR_OPTIONS.slice(1).map((hour) => (
                        <option key={hour} value={hour}>
                          {hourLabel(hour)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/60">
                      Label shown to customers
                    </label>
                    <input
                      type="text"
                      value={slot.label}
                      placeholder={formatSlotLabel(slot.startHour, slot.endHour)}
                      onChange={(event) => update(index, { label: event.target.value })}
                      className={FIELD_CLASS}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${slot.label} window`}
                    className="rounded-lg border border-wine/15 px-3 py-1.5 text-xs text-wine hover:bg-wine/5"
                  >
                    Remove
                  </button>
                </div>

                {invalidRange && (
                  <p className="mt-2 text-xs text-red-600">
                    End time must be after the start time — this window will be dropped
                    on save.
                  </p>
                )}
                {!invalidRange && duplicate && (
                  <p className="mt-2 text-xs text-red-600">
                    Another window already starts at {hourLabel(slot.startHour)} — only
                    the first will be kept.
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
        disabled={slots.length >= MAX_DELIVERY_SLOTS}
        className="mt-3 rounded-xl border border-wine/20 px-4 py-2 text-sm font-medium text-wine hover:bg-wine/5 disabled:opacity-40"
      >
        + Add window
      </button>
      {slots.length >= MAX_DELIVERY_SLOTS && (
        <span className="ml-3 text-xs text-ink/45">
          Maximum {MAX_DELIVERY_SLOTS} windows.
        </span>
      )}
    </div>
  )
}
