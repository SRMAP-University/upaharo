/**
 * What is going on for a shopper right now — festival or love occasion,
 * rain or cold, time of day — turned into weighted "signals" that say which
 * products fit. Server-side (weather needs the network and Redis).
 */
import { activeOccasions, occasionWhen, outOfSeasonTest, type ActiveOccasion } from '@/lib/occasions'
import { redis } from '@/lib/redis'

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000

/** Kathmandu, used when the shopper's location is unknown. */
export const DEFAULT_LOCATION = { lat: 27.7172, lng: 85.324 }

export type Daypart = 'morning' | 'afternoon' | 'evening' | 'night'

export type Weather = {
  raining: boolean
  /** °C */
  temperature: number | null
  /** MET Norway symbol, e.g. "lightrain_night". */
  symbol: string | null
}

export type ContextSignal = {
  id: string
  kind: 'occasion' | 'weather' | 'daypart'
  emoji: string
  /** Short line above the title, e.g. "Bhai Tika · in 13 days". */
  eyebrow: string
  title: string
  subtitle: string
  /** 0–100: how much this should shape what we show. */
  weight: number
  keywords: string[]
  categoryPattern?: RegExp
  occasion?: Pick<ActiveOccasion, 'id' | 'name' | 'date' | 'daysLeft'>
}

export type ShoppingContext = {
  daypart: Daypart
  weather: Weather | null
  occasions: ActiveOccasion[]
  /** Most important first. */
  signals: ContextSignal[]
  /** True for products made for an occasion that isn't on now. */
  outOfSeason: (product: { name?: string | null; tags?: string[] | null }) => boolean
}

export function nepalHour(now: Date = new Date()) {
  const nepal = new Date(now.getTime() + NEPAL_OFFSET_MS)
  return nepal.getUTCHours() + nepal.getUTCMinutes() / 60
}

export function daypartAt(now: Date = new Date()): Daypart {
  const hour = nepalHour(now)
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 16) return 'afternoon'
  if (hour >= 16 && hour < 20) return 'evening'
  return 'night'
}

const DAYPART_SIGNALS: Record<Daypart, Omit<ContextSignal, 'id' | 'kind'>> = {
  morning: {
    emoji: '☀️',
    eyebrow: 'This morning',
    title: 'Start someone’s day',
    subtitle: 'Fresh flowers and breakfast treats, delivered today.',
    weight: 30,
    keywords: ['flower', 'bouquet', 'rose', 'breakfast', 'coffee', 'tea', 'cookie', 'fruit', 'juice', 'muffin', 'bakery', 'milk', 'bread', 'good morning'],
  },
  afternoon: {
    emoji: '🌤️',
    eyebrow: 'This afternoon',
    title: 'Afternoon pick-me-ups',
    subtitle: 'Chocolates, cakes and hampers to brighten the day.',
    weight: 25,
    keywords: ['chocolate', 'cake', 'hamper', 'snack', 'cookie', 'dessert', 'sweets', 'gift box', 'mug', 'pastry'],
  },
  evening: {
    emoji: '🌆',
    eyebrow: 'This evening',
    title: 'Evening surprises',
    subtitle: 'Cakes, flowers and candles for tonight.',
    weight: 30,
    keywords: ['cake', 'flower', 'bouquet', 'rose', 'candle', 'chocolate', 'dessert', 'pastry', 'dinner', 'snack'],
  },
  night: {
    emoji: '🌙',
    eyebrow: 'Tonight',
    title: 'Plan tomorrow’s surprise',
    subtitle: 'Order tonight and wake them up with a gift.',
    weight: 25,
    keywords: ['chocolate', 'teddy', 'cake', 'flower', 'surprise', 'midnight', 'hamper', 'card', 'gift box', 'bouquet'],
  },
}

// The grocery store shops by meal, not by gift.
const GROCERY_DAYPART_SIGNALS: Record<Daypart, Omit<ContextSignal, 'id' | 'kind'>> = {
  morning: {
    emoji: '🥛',
    eyebrow: 'This morning',
    title: 'Breakfast essentials',
    subtitle: 'Milk, bread, eggs and tea, delivered fast.',
    weight: 30,
    keywords: ['milk', 'bread', 'egg', 'butter', 'jam', 'tea', 'coffee', 'oats', 'cornflakes', 'muesli', 'juice', 'honey', 'paneer', 'curd'],
  },
  afternoon: {
    emoji: '🍪',
    eyebrow: 'This afternoon',
    title: 'Snack time',
    subtitle: 'Biscuits, chips and cold drinks for the afternoon.',
    weight: 25,
    keywords: ['biscuit', 'cookie', 'chips', 'namkeen', 'bhujia', 'juice', 'cold drink', 'noodles', 'chocolate', 'wafer', 'cake'],
  },
  evening: {
    emoji: '🍛',
    eyebrow: 'This evening',
    title: 'Tonight’s dinner',
    subtitle: 'Rice, dal, spices and fresh picks for the evening meal.',
    weight: 30,
    keywords: ['rice', 'dal', 'atta', 'flour', 'oil', 'masala', 'spice', 'vegetable', 'paneer', 'noodles', 'pasta', 'sauce', 'ghee'],
  },
  night: {
    emoji: '🌙',
    eyebrow: 'Tonight',
    title: 'Tomorrow’s breakfast, sorted',
    subtitle: 'Order tonight so mornings are easy.',
    weight: 25,
    keywords: ['milk', 'bread', 'egg', 'butter', 'jam', 'tea', 'coffee', 'oats', 'cornflakes', 'honey'],
  },
}

const RAIN_SIGNAL: Omit<ContextSignal, 'id' | 'kind'> = {
  emoji: '🌧️',
  eyebrow: 'Raining near you',
  title: 'Rainy day comforts',
  subtitle: 'Hot drinks, chocolates and cosy treats while it pours.',
  weight: 70,
  keywords: ['umbrella', 'raincoat', 'coffee', 'tea', 'hot chocolate', 'mug', 'soup', 'noodles', 'chocolate', 'cookie', 'biscuit', 'blanket', 'candle', 'cozy', 'cosy', 'pakoda'],
}

const COLD_SIGNAL: Omit<ContextSignal, 'id' | 'kind'> = {
  emoji: '🧣',
  eyebrow: 'Chilly outside',
  title: 'Cosy up, it’s cold',
  subtitle: 'Warm shawls, blankets and hot drinks to share.',
  weight: 50,
  keywords: ['blanket', 'shawl', 'sweater', 'scarf', 'muffler', 'gloves', 'hot chocolate', 'coffee', 'tea', 'mug', 'soup', 'candle'],
}

const HOT_SIGNAL: Omit<ContextSignal, 'id' | 'kind'> = {
  emoji: '🍦',
  eyebrow: 'Hot day',
  title: 'Beat the heat',
  subtitle: 'Cool treats and summer picks.',
  weight: 40,
  keywords: ['ice cream', 'cold drink', 'juice', 'lassi', 'cap', 'sunglasses', 'water bottle', 'fruit'],
}

// Valentine's week: each day has its own theme.
const VALENTINE_DAYS: Record<string, { name: string; keyword: string }> = {
  '02-07': { name: 'Rose Day', keyword: 'rose' },
  '02-08': { name: 'Propose Day', keyword: 'ring' },
  '02-09': { name: 'Chocolate Day', keyword: 'chocolate' },
  '02-10': { name: 'Teddy Day', keyword: 'teddy' },
  '02-11': { name: 'Promise Day', keyword: 'couple' },
  '02-12': { name: 'Hug Day', keyword: 'teddy' },
  '02-13': { name: 'Kiss Day', keyword: 'chocolate' },
}

function occasionSignal(occasion: ActiveOccasion, now: Date): ContextSignal {
  const signal: ContextSignal = {
    id: `occasion:${occasion.id}`,
    kind: 'occasion',
    emoji: occasion.emoji,
    eyebrow: `${occasion.name} · ${occasionWhen(occasion)}`,
    title: occasion.headline,
    subtitle: occasion.subtitle,
    weight: occasion.score,
    keywords: occasion.keywords,
    categoryPattern: occasion.categoryPattern,
    occasion: { id: occasion.id, name: occasion.name, date: occasion.date, daysLeft: occasion.daysLeft },
  }
  if (occasion.id === 'valentines-week') {
    const monthDay = new Date(now.getTime() + NEPAL_OFFSET_MS).toISOString().slice(5, 10)
    const theme = VALENTINE_DAYS[monthDay]
    if (theme) {
      signal.eyebrow = `Valentine’s week · ${theme.name} today`
      signal.title = `Happy ${theme.name}`
      signal.keywords = [theme.keyword, ...occasion.keywords.filter((k) => k !== theme.keyword)]
    }
  }
  return signal
}

function weatherSignal(weather: Weather | null): ContextSignal | null {
  if (!weather) return null
  if (weather.raining) return { id: 'weather:rain', kind: 'weather', ...RAIN_SIGNAL }
  if (weather.temperature !== null && weather.temperature <= 12) {
    return { id: 'weather:cold', kind: 'weather', ...COLD_SIGNAL, eyebrow: `${Math.round(weather.temperature)}°C outside` }
  }
  if (weather.temperature !== null && weather.temperature >= 31) {
    return { id: 'weather:hot', kind: 'weather', ...HOT_SIGNAL, eyebrow: `${Math.round(weather.temperature)}°C outside` }
  }
  return null
}

/** MET Norway symbols that mean wet weather. */
const WET = /rain|sleet|drizzle|thunder|snow/

/**
 * Current weather from MET Norway (free, commercial use allowed with credit;
 * they ask for an identifying User-Agent and caching). Coordinates are rounded
 * to ~11 km so nothing precise leaves the server. Cached 30 minutes per cell.
 */
export async function currentWeather(lat: number, lng: number): Promise<Weather | null> {
  const cellLat = Math.round(lat * 10) / 10
  const cellLng = Math.round(lng * 10) / 10
  const key = `weather:v1:${cellLat}:${cellLng}`
  const cached = await redis.get(key)
  if (cached) {
    try {
      const value = JSON.parse(cached)
      return value?.failed ? null : (value as Weather)
    } catch {
      // refetch
    }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${cellLat}&lon=${cellLng}`,
      {
        headers: { 'User-Agent': 'Upaharo/1.0 (+https://www.upaharo.com)', Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      }
    ).finally(() => clearTimeout(timer))
    if (!res.ok) throw new Error(`MET Norway ${res.status}`)
    const data = await res.json()
    // First entry at or after now.
    const series: any[] = data?.properties?.timeseries || []
    const nowMs = Date.now() - 60 * 60_000
    const entry = series.find((s) => new Date(s.time).getTime() >= nowMs) || series[0]
    const nextHour = entry?.data?.next_1_hours
    const symbol: string | null = nextHour?.summary?.symbol_code ?? null
    const rainMm = Number(nextHour?.details?.precipitation_amount ?? 0)
    const temperature = entry?.data?.instant?.details?.air_temperature
    const weather: Weather = {
      raining: rainMm >= 0.2 || (symbol ? WET.test(symbol) : false),
      temperature: typeof temperature === 'number' ? temperature : null,
      symbol,
    }
    await redis.setex(key, 30 * 60, JSON.stringify(weather))
    return weather
  } catch (error) {
    console.warn('Weather lookup failed:', error instanceof Error ? error.message : error)
    // Don't retry on every request while the service is down.
    await redis.setex(key, 5 * 60, JSON.stringify({ failed: true }))
    return null
  }
}

function validCoord(value: unknown, min: number, max: number) {
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max && n !== 0 ? n : null
}

export function parseLocation(lat: unknown, lng: unknown) {
  const la = validCoord(lat, -90, 90)
  const ln = validCoord(lng, -180, 180)
  return la !== null && ln !== null ? { lat: la, lng: ln } : DEFAULT_LOCATION
}

/** Everything that should shape recommendations right now. */
export async function getShoppingContext(
  options: { now?: Date; lat?: number; lng?: number; withWeather?: boolean; storeSlug?: string } = {}
): Promise<ShoppingContext> {
  const now = options.now ?? new Date()
  const daypart = daypartAt(now)
  const occasions = activeOccasions(now)
  const location = parseLocation(options.lat, options.lng)
  const weather = options.withWeather === false ? null : await currentWeather(location.lat, location.lng)

  const signals: ContextSignal[] = []
  // Two occasions at most, one per kind of gift (Valentine's day + week → one).
  const seenKinds = new Set<string>()
  for (const occasion of occasions) {
    const group = occasion.kind === 'love' ? 'love' : occasion.id
    if (seenKinds.has(group)) continue
    seenKinds.add(group)
    signals.push(occasionSignal(occasion, now))
    if (signals.length === 2) break
  }
  const fromWeather = weatherSignal(weather)
  if (fromWeather) signals.push(fromWeather)
  const dayparts = options.storeSlug === 'grocery' ? GROCERY_DAYPART_SIGNALS : DAYPART_SIGNALS
  signals.push({ id: `daypart:${daypart}`, kind: 'daypart', ...dayparts[daypart] })
  signals.sort((a, b) => b.weight - a.weight)

  return { daypart, weather, occasions, signals, outOfSeason: outOfSeasonTest(occasions) }
}

type ScorableProduct = { name?: string | null; category?: string | null; tags?: string[] | null; description?: string | null }

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Scores products against one signal; compiled once per signal. */
export function signalScorer(signal: Pick<ContextSignal, 'keywords' | 'categoryPattern'>) {
  const patterns = signal.keywords.map(
    (keyword) => new RegExp(`(^|[^a-z])${escapeRegExp(keyword.toLowerCase())}(e?s)?([^a-z]|$)`)
  )
  return (product: ScorableProduct) => {
    const name = String(product.name || '').toLowerCase()
    const meta = [product.category || '', ...(product.tags || [])].join(' | ').toLowerCase()
    const description = String(product.description || '').slice(0, 600).toLowerCase()
    let score = 0
    for (const pattern of patterns) {
      if (pattern.test(name)) score += 3
      else if (pattern.test(meta)) score += 2
      else if (pattern.test(description)) score += 0.5
    }
    if (signal.categoryPattern) {
      if (product.category && signal.categoryPattern.test(product.category)) score += 6
      else if ((product.tags || []).some((tag) => signal.categoryPattern!.test(tag))) score += 6
    }
    return score
  }
}
