/**
 * Bhai Tika dates in Nepal (Kartik Shukla Dwitiya, YYYY-MM-DD).
 * Check each new year against the Nepal Calendar Determination Committee and
 * add it here — 2027 is provisional until the official calendar is out.
 */
const BHAI_TIKA_DATES = ['2026-11-11', '2027-10-31']

/** Only count down when the festival is this close. */
const SHOW_WITHIN_DAYS = 60

const NEPAL_OFFSET_MINUTES = 5 * 60 + 45

export type FestivalCountdown = {
  daysLeft: number
  /** e.g. "Wednesday, 11 November" */
  dateLabel: string
}

/** Days until the next Bhai Tika, counted in Nepal time; null when it is far off or past. */
export function bhaiTikaCountdown(now: Date = new Date()): FestivalCountdown | null {
  const nepalNow = new Date(now.getTime() + NEPAL_OFFSET_MINUTES * 60_000)
  const today = Date.UTC(nepalNow.getUTCFullYear(), nepalNow.getUTCMonth(), nepalNow.getUTCDate())

  for (const iso of BHAI_TIKA_DATES) {
    const [year, month, day] = iso.split('-').map(Number)
    const festival = Date.UTC(year, month - 1, day)
    const daysLeft = Math.round((festival - today) / 86_400_000)
    if (daysLeft < 0) continue
    if (daysLeft > SHOW_WITHIN_DAYS) return null
    return {
      daysLeft,
      dateLabel: new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(new Date(festival)),
    }
  }
  return null
}
