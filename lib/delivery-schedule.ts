/**
 * Scheduled delivery windows.
 *
 * The bookable windows and how many days ahead they run are admin-configurable
 * (`AppSettings.deliverySlots` / `scheduleDayCount`); this module only decides
 * whether a requested instant lands on one of them.
 *
 * All slot maths happen in Nepal time (UTC+05:45) regardless of where the
 * server runs, so a "12–3 PM" slot always means noon in Kathmandu.
 */

import { getAppSettings, type StoreSettingsTarget } from '@/lib/app-settings'
import type { DeliverySlotConfig } from '@/lib/app-settings-schema'

const NEPAL_OFFSET_MINUTES = 5 * 60 + 45
const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE

export type ScheduleConfig = {
  slots: DeliverySlotConfig[]
  /** Furthest bookable day, counting today as 0. */
  maxDaysAhead: number
}

export async function getScheduleConfig(store?: StoreSettingsTarget): Promise<ScheduleConfig> {
  const settings = await getAppSettings(store)
  return {
    slots: settings.deliverySlots,
    maxDaysAhead: settings.scheduleMaxDaysAhead,
  }
}

/** Wall-clock time in Kathmandu, expressed as a UTC-based Date for arithmetic. */
function toNepalWallClock(date: Date) {
  return new Date(date.getTime() + NEPAL_OFFSET_MINUTES * MS_PER_MINUTE)
}

function nepalDayIndex(scheduled: Date, now: Date) {
  const scheduledDay = Math.floor(toNepalWallClock(scheduled).getTime() / MS_PER_DAY)
  const today = Math.floor(toNepalWallClock(now).getTime() / MS_PER_DAY)
  return scheduledDay - today
}

export function dayLabelFor(dayIndex: number, scheduled: Date) {
  if (dayIndex === 0) return 'Today'
  if (dayIndex === 1) return 'Tomorrow'
  return toNepalWallClock(scheduled).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export type ScheduleValidation =
  | { ok: true; scheduledFor: Date | null; deliverySlotLabel: string | null }
  | { ok: false; error: string }

/**
 * Validates a requested delivery window. Returns nulls for an ASAP order.
 * The label is regenerated server-side; the client value is only a hint.
 */
export function validateSchedule(input: {
  scheduledFor?: unknown
  isPickup: boolean
  config: ScheduleConfig
  now?: Date
}): ScheduleValidation {
  const raw = input.scheduledFor

  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, scheduledFor: null, deliverySlotLabel: null }
  }

  if (input.isPickup) {
    return { ok: false, error: 'Pickup orders cannot be scheduled' }
  }

  const { slots, maxDaysAhead } = input.config
  if (slots.length === 0) {
    return { ok: false, error: 'Scheduled delivery is not available right now' }
  }

  const scheduled = new Date(String(raw))
  if (Number.isNaN(scheduled.getTime())) {
    return { ok: false, error: 'Invalid delivery time' }
  }

  const now = input.now ?? new Date()
  if (scheduled.getTime() <= now.getTime()) {
    return { ok: false, error: 'Pick a delivery time in the future' }
  }

  const dayIndex = nepalDayIndex(scheduled, now)
  if (dayIndex < 0 || dayIndex >= maxDaysAhead) {
    return {
      ok: false,
      error:
        maxDaysAhead <= 1
          ? 'Delivery can only be scheduled for today'
          : `Delivery can only be scheduled up to ${maxDaysAhead - 1} days ahead`,
    }
  }

  const wall = toNepalWallClock(scheduled)
  const slot = slots.find(
    (s) =>
      s.startHour === wall.getUTCHours() &&
      wall.getUTCMinutes() === 0 &&
      wall.getUTCSeconds() === 0
  )

  if (!slot) {
    return { ok: false, error: 'Pick one of the available delivery windows' }
  }

  return {
    ok: true,
    scheduledFor: scheduled,
    deliverySlotLabel: `${dayLabelFor(dayIndex, scheduled)}, ${slot.label}`,
  }
}
