/** Per-banner scroll/header wash: solid (null) or multi-stop linear gradient. */

export type BannerBgStop = {
  color: string
  /** 0–1 position; omitted stops are spaced evenly. */
  at?: number
}

export type BannerBgGradient = {
  mode: 'solid' | 'gradient'
  /** CSS degrees; 180 = top → bottom (default). */
  angle: number
  stops: BannerBgStop[]
}

const HEX = /^#([0-9a-f]{6})$/i

export function normalizeHexColor(raw: unknown, fallback = '#FFE0E8'): string {
  if (typeof raw !== 'string') return fallback
  const value = raw.trim()
  if (HEX.test(value)) return value.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value.toUpperCase()}`
  return fallback
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function normalizeStops(raw: unknown): BannerBgStop[] {
  if (!Array.isArray(raw)) return []
  const stops: BannerBgStop[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const color = normalizeHexColor(row.color, '')
    if (!color || color === '') continue
    const atRaw = row.at
    const at =
      typeof atRaw === 'number'
        ? clamp01(atRaw)
        : typeof atRaw === 'string' && atRaw.trim() !== ''
          ? clamp01(Number(atRaw))
          : undefined
    stops.push(at === undefined ? { color } : { color, at })
    if (stops.length >= 6) break
  }
  return stops
}

function spaceStops(stops: BannerBgStop[]): BannerBgStop[] {
  if (stops.length === 0) return []
  const allHaveAt = stops.every((s) => typeof s.at === 'number')
  if (allHaveAt) {
    return [...stops]
      .map((s) => ({ color: s.color, at: clamp01(s.at!) }))
      .sort((a, b) => a.at! - b.at!)
  }
  if (stops.length === 1) return [{ color: stops[0].color, at: 0 }]
  return stops.map((s, i) => ({
    color: s.color,
    at: i / (stops.length - 1),
  }))
}

/** Accept admin/API payload; return null for solid (store nothing extra). */
export function normalizeBannerBgGradient(raw: unknown): BannerBgGradient | null {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const modeRaw = typeof row.mode === 'string' ? row.mode.trim().toLowerCase() : ''
  const mode = modeRaw === 'gradient' ? 'gradient' : 'solid'
  if (mode === 'solid') return null

  const stops = spaceStops(normalizeStops(row.stops))
  if (stops.length < 2) return null

  let angle = 180
  if (typeof row.angle === 'number' && Number.isFinite(row.angle)) {
    angle = ((row.angle % 360) + 360) % 360
  } else if (typeof row.angle === 'string' && row.angle.trim() !== '') {
    const n = Number(row.angle)
    if (Number.isFinite(n)) angle = ((n % 360) + 360) % 360
  }

  return { mode: 'gradient', angle, stops }
}

/** CSS background value for header wash preview / storefront. */
export function bannerWashCss(
  bgColor: string | null | undefined,
  bgGradient: BannerBgGradient | null | undefined,
  fallback = '#F7F0E8'
): string {
  const solid = normalizeHexColor(bgColor, fallback)
  const g = bgGradient?.mode === 'gradient' ? bgGradient : null
  if (!g || g.stops.length < 2) {
    return `linear-gradient(180deg, ${solid} 0%, ${solid}ee 42%, #faf5f0 78%, #faf5f0 100%)`
  }
  const parts = g.stops.map((s) => {
    const pct = Math.round(clamp01(s.at ?? 0) * 100)
    return `${s.color} ${pct}%`
  })
  // Keep a soft fade into the page cream after the last stop.
  const last = g.stops[g.stops.length - 1]
  const lastPct = Math.round(clamp01(last.at ?? 1) * 72)
  return `linear-gradient(${g.angle}deg, ${parts.join(', ')}, ${last.color} ${lastPct}%, #faf5f0 100%)`
}

export function bannerGradientPreviewCss(
  bgColor: string | null | undefined,
  bgGradient: BannerBgGradient | null | undefined
): string {
  const solid = normalizeHexColor(bgColor, '#FFE0E8')
  const g = bgGradient?.mode === 'gradient' ? bgGradient : null
  if (!g || g.stops.length < 2) return solid
  const parts = spaceStops(g.stops).map((s) => {
    const pct = Math.round(clamp01(s.at ?? 0) * 100)
    return `${s.color} ${pct}%`
  })
  return `linear-gradient(${g.angle}deg, ${parts.join(', ')})`
}
