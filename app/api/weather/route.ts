import { NextRequest, NextResponse } from 'next/server'
import { currentWeather, daypartAt, parseLocation } from '@/lib/shopping-context'

export const dynamic = 'force-dynamic'

/**
 * GET ?lat&lng — the weather "scene" for the home hero animation:
 * clear | clouds | rain | storm | snow | fog, and whether it is night in Nepal.
 * Coordinates are rounded to ~11 km before anything leaves the server
 * (see currentWeather), and results are kept for 15 minutes here too.
 */

export type HeroWeather = { scene: 'clear' | 'clouds' | 'rain' | 'storm' | 'snow' | 'fog'; night: boolean }

const cache = new Map<string, { at: number; value: HeroWeather }>()
const TTL_MS = 15 * 60 * 1000

function sceneFor(symbol: string | null, raining: boolean): HeroWeather['scene'] {
  const s = symbol || ''
  if (/thunder/.test(s)) return 'storm'
  if (/snow|sleet/.test(s)) return 'snow'
  if (raining || /rain|drizzle/.test(s)) return 'rain'
  if (/fog/.test(s)) return 'fog'
  if (/cloudy/.test(s)) return 'clouds'
  return 'clear'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const { lat, lng } = parseLocation(searchParams.get('lat'), searchParams.get('lng'))
  const key = `${Math.round(lat * 10) / 10}:${Math.round(lng * 10) / 10}`
  const night = daypartAt() === 'night'
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ...hit.value, night }, { headers: { 'Cache-Control': 'private, max-age=600' } })
  }
  try {
    const weather = await currentWeather(lat, lng)
    const value: HeroWeather = { scene: sceneFor(weather?.symbol ?? null, Boolean(weather?.raining)), night }
    cache.set(key, { at: Date.now(), value })
    if (cache.size > 500) cache.delete(cache.keys().next().value as string)
    return NextResponse.json(value, { headers: { 'Cache-Control': 'private, max-age=600' } })
  } catch {
    return NextResponse.json({ scene: 'clear', night } satisfies HeroWeather)
  }
}
