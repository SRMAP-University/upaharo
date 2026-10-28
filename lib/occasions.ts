/**
 * Gifting occasions in Nepal: festivals (lunar, so dated per year) and
 * fixed-date days such as Valentine's. Pure so the website, the app API and
 * tests share it.
 *
 * Festival dates follow the Ministry of Home Affairs list of public holidays
 * for 2083 BS (Apr 2026 – Apr 2027). Dates marked "provisional" (2084 BS) are
 * from Nepali calendars ahead of the official list — check them against the
 * 2084 notice when it is published and add the following years here.
 */

const DAY_MS = 86_400_000
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000

export type OccasionKind = 'festival' | 'love' | 'family' | 'celebration'

export type OccasionDef = {
  id: string
  name: string
  nepaliName?: string
  emoji: string
  kind: OccasionKind
  /** Main day(s) as YYYY-MM-DD. Fixed-date occasions use `fixed` instead. */
  dates?: string[]
  /** Month-day ("02-14") for occasions on the same date every year. */
  fixed?: string
  /** Start showing this many days before the day. */
  leadDays: number
  /** Keep showing this many days after (multi-day festivals). */
  afterDays?: number
  /** How strongly it leads the feed when active (higher wins). */
  weight: number
  /** Words that mark a product as right for it (name, tags, category). */
  keywords: string[]
  /** Occasion / product categories whose name matches this belong to it. */
  categoryPattern?: RegExp
  headline: string
  subtitle: string
}

const TIHAR_WORDS = [
  'tihar', 'diyo', 'diya', 'deusi', 'bhailo', 'laxmi', 'lakshmi', 'rangoli', 'marigold', 'sayapatri', 'makhamali',
  'mala', 'candle', 'lamp', 'fairy light', 'puja', 'agarbatti', 'incense', 'batti', 'ghee', 'kalash', 'sel roti',
]
const LOVE_WORDS = [
  'valentine', 'love', 'rose', 'roses', 'teddy', 'chocolate', 'heart', 'couple', 'romantic', 'propose',
  'ring', 'perfume', 'bouquet', 'flower',
]

export const OCCASIONS: OccasionDef[] = [
  {
    id: 'tihar',
    name: 'Tihar',
    nepaliName: 'तिहार',
    emoji: '🪔',
    kind: 'festival',
    dates: ['2026-11-08', '2027-10-29'], // Laxmi Puja; 2027 provisional
    leadDays: 21,
    afterDays: 1,
    weight: 95,
    keywords: TIHAR_WORDS,
    categoryPattern: /tihar|laxmi|lakshmi|deepawali|diwali|puja/i,
    headline: 'Tihar is coming',
    subtitle: 'Diyo, marigold malas, sweets and puja essentials for the festival of lights.',
  },
  {
    id: 'bhai-tika',
    name: 'Bhai Tika',
    nepaliName: 'भाइटीका',
    emoji: '🎁',
    kind: 'family',
    dates: ['2026-11-11', '2027-10-31'], // 2027 provisional
    leadDays: 21,
    weight: 100,
    keywords: ['bhai tika', 'bhaitika', 'brother', 'sister', 'tika', 'makhamali', 'mala', 'dry fruit', 'sweets', 'hamper', 'gift set'],
    categoryPattern: /bhai\s*tika|bhaitika|brother|sister/i,
    headline: 'Bhai Tika gifts',
    subtitle: 'Hampers, sweets and gifts for your brother or sister.',
  },
  {
    id: 'chhath',
    name: 'Chhath',
    nepaliName: 'छठ',
    emoji: '🌅',
    kind: 'festival',
    dates: ['2026-11-15', '2027-11-04'], // 2027 provisional
    leadDays: 7,
    weight: 70,
    keywords: ['chhath', 'puja', 'fruit', 'sugarcane', 'thekua', 'diyo', 'supali', 'daura'],
    categoryPattern: /chhath|puja/i,
    headline: 'Chhath puja',
    subtitle: 'Fruit, diyo and puja items for the offerings to the sun.',
  },
  {
    id: 'dashain',
    name: 'Dashain',
    nepaliName: 'दशैं',
    emoji: '🪁',
    kind: 'festival',
    dates: ['2027-10-09'], // Vijaya Dashami, provisional
    leadDays: 21,
    afterDays: 4,
    weight: 95,
    keywords: ['dashain', 'tika', 'jamara', 'kite', 'new clothes', 'sweets', 'dry fruit', 'hamper', 'gift set', 'mithai'],
    categoryPattern: /dashain|dasain|dussehra|navaratri/i,
    headline: 'Dashain is near',
    subtitle: 'Gifts and sweets for tika day with the family.',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    emoji: '🎄',
    kind: 'celebration',
    fixed: '12-25',
    leadDays: 14,
    weight: 70,
    keywords: ['christmas', 'xmas', 'santa', 'plum cake', 'ornament', 'decoration', 'hamper', 'candle', 'star'],
    categoryPattern: /christmas|xmas/i,
    headline: 'Merry Christmas',
    subtitle: 'Cakes, hampers and little surprises for the season.',
  },
  {
    id: 'tamu-lhosar',
    name: 'Tamu Lhosar',
    nepaliName: 'तमु ल्होसार',
    emoji: '🎉',
    kind: 'festival',
    dates: ['2026-12-30'],
    leadDays: 7,
    weight: 55,
    keywords: ['lhosar', 'losar', 'khada', 'khata', 'sweets', 'hamper', 'cake'],
    categoryPattern: /lhosar|losar/i,
    headline: 'Happy Tamu Lhosar',
    subtitle: 'Sweets and hampers for the Gurung new year.',
  },
  {
    id: 'new-year',
    name: 'New Year',
    emoji: '🥳',
    kind: 'celebration',
    fixed: '01-01',
    leadDays: 7,
    weight: 65,
    keywords: ['new year', 'party', 'cake', 'balloon', 'confetti', 'diary', 'calendar', 'hamper', 'celebration'],
    categoryPattern: /new\s*year|party|celebration/i,
    headline: 'Ring in the New Year',
    subtitle: 'Cakes, party picks and gifts to start the year.',
  },
  {
    id: 'maghe-sankranti',
    name: 'Maghe Sankranti',
    nepaliName: 'माघे संक्रान्ति',
    emoji: '🍠',
    kind: 'festival',
    dates: ['2027-01-15'],
    leadDays: 5,
    weight: 50,
    keywords: ['maghe', 'sankranti', 'ghee', 'chaku', 'til', 'sesame', 'laddu', 'tarul', 'sweet potato', 'yam'],
    categoryPattern: /maghe|sankranti/i,
    headline: 'Maghe Sankranti',
    subtitle: 'Ghee, chaku, til laddu and the season’s treats.',
  },
  {
    id: 'sonam-lhosar',
    name: 'Sonam Lhosar',
    nepaliName: 'सोनाम ल्होसार',
    emoji: '🎉',
    kind: 'festival',
    dates: ['2027-02-07'],
    leadDays: 5,
    weight: 50,
    keywords: ['lhosar', 'losar', 'khada', 'khata', 'sweets', 'hamper', 'cake'],
    categoryPattern: /lhosar|losar/i,
    headline: 'Happy Sonam Lhosar',
    subtitle: 'Sweets and hampers for the Tamang new year.',
  },
  {
    id: 'valentines-week',
    name: 'Valentine’s week',
    emoji: '🌹',
    kind: 'love',
    // Rose Day (7th) through Kiss Day (13th); Valentine's Day itself is below.
    fixed: '02-07',
    leadDays: 3,
    afterDays: 6,
    weight: 105,
    keywords: LOVE_WORDS,
    categoryPattern: /valentine|love|romantic|couple|anniversary/i,
    headline: 'Valentine’s week',
    subtitle: 'Rose Day, Chocolate Day, Teddy Day… a little something every day.',
  },
  {
    id: 'valentines',
    name: 'Valentine’s Day',
    emoji: '❤️',
    kind: 'love',
    fixed: '02-14',
    leadDays: 14,
    weight: 100,
    keywords: LOVE_WORDS,
    categoryPattern: /valentine|love|romantic|couple|anniversary/i,
    headline: 'Valentine’s Day',
    subtitle: 'Roses, chocolates and teddies for the one you love.',
  },
  {
    id: 'basanta-panchami',
    name: 'Basanta Panchami',
    nepaliName: 'बसन्त पञ्चमी',
    emoji: '📚',
    kind: 'festival',
    dates: ['2027-02-11'],
    leadDays: 4,
    weight: 40,
    keywords: ['saraswati', 'pen', 'book', 'notebook', 'stationery', 'diary', 'flower'],
    categoryPattern: /saraswati|stationery/i,
    headline: 'Saraswati Puja',
    subtitle: 'Pens, books and flowers for Basanta Panchami.',
  },
  {
    id: 'shivaratri',
    name: 'Maha Shivaratri',
    nepaliName: 'महाशिवरात्रि',
    emoji: '🔱',
    kind: 'festival',
    dates: ['2027-03-06'],
    leadDays: 5,
    weight: 50,
    keywords: ['shiva', 'shivaratri', 'rudraksha', 'rudrakshya', 'puja', 'bel', 'incense', 'agarbatti', 'dhoop'],
    categoryPattern: /shiva|puja/i,
    headline: 'Maha Shivaratri',
    subtitle: 'Rudraksha, incense and puja items for the night of Shiva.',
  },
  {
    id: 'womens-day',
    name: 'Women’s Day',
    emoji: '💐',
    kind: 'celebration',
    fixed: '03-08',
    leadDays: 5,
    weight: 60,
    keywords: ['women', 'her', 'flower', 'bouquet', 'spa', 'cosmetic', 'makeup', 'jewellery', 'jewelry', 'perfume', 'handbag'],
    categoryPattern: /women|her\b|mother|wife/i,
    headline: 'Women’s Day',
    subtitle: 'Flowers and treats for the women who make your world.',
  },
  {
    id: 'holi',
    name: 'Holi',
    nepaliName: 'होली',
    emoji: '🎨',
    kind: 'festival',
    dates: ['2027-03-21'], // Fagu Purnima in the hills; Terai on the 22nd
    leadDays: 7,
    afterDays: 1,
    weight: 65,
    keywords: ['holi', 'color', 'colour', 'abir', 'gulal', 'pichkari', 'water gun', 'balloon'],
    categoryPattern: /holi|fagu/i,
    headline: 'Holi hai!',
    subtitle: 'Colours, pichkari and sweets for Fagu Purnima.',
  },
  {
    id: 'nepali-new-year',
    name: 'Nepali New Year',
    nepaliName: 'नयाँ वर्ष',
    emoji: '🎊',
    kind: 'celebration',
    dates: ['2027-04-14'], // Baisakh 1, 2084
    leadDays: 5,
    weight: 60,
    keywords: ['new year', 'naya barsa', 'nava barsha', 'cake', 'hamper', 'flower', 'calendar', 'diary', 'celebration'],
    categoryPattern: /new\s*year|celebration/i,
    headline: 'Happy Nepali New Year',
    subtitle: 'Cakes, flowers and gifts for Naya Barsha.',
  },
  {
    id: 'mothers-day',
    name: 'Mother’s Day',
    nepaliName: 'आमाको मुख हेर्ने दिन',
    emoji: '👩',
    kind: 'family',
    dates: ['2027-05-06'], // Mata Tirtha Aunsi, provisional
    leadDays: 10,
    weight: 85,
    keywords: ['mother', 'mom', 'mum', 'aama', 'flower', 'bouquet', 'saree', 'shawl', 'cake', 'jewellery', 'jewelry'],
    categoryPattern: /mother|mom|mum|parents/i,
    headline: 'Mother’s Day',
    subtitle: 'Mata Tirtha Aunsi: thank Aama with something special.',
  },
  {
    id: 'buddha-jayanti',
    name: 'Buddha Jayanti',
    nepaliName: 'बुद्ध जयन्ती',
    emoji: '🪷',
    kind: 'festival',
    dates: ['2027-05-20'],
    leadDays: 4,
    weight: 40,
    keywords: ['buddha', 'lotus', 'incense', 'butter lamp', 'prayer flag', 'khada', 'singing bowl'],
    categoryPattern: /buddha/i,
    headline: 'Buddha Jayanti',
    subtitle: 'Lotus lamps, incense and gifts of peace.',
  },
  {
    id: 'friendship-day',
    name: 'Friendship Day',
    emoji: '🤝',
    kind: 'love',
    dates: ['2027-08-01'], // first Sunday of August
    leadDays: 5,
    weight: 55,
    keywords: ['friend', 'friendship', 'band', 'bracelet', 'mug', 'chocolate', 'teddy', 'photo frame'],
    categoryPattern: /friend/i,
    headline: 'Friendship Day',
    subtitle: 'Bands, mugs and chocolates for your best people.',
  },
  {
    id: 'janai-purnima',
    name: 'Janai Purnima & Raksha Bandhan',
    nepaliName: 'जनै पूर्णिमा',
    emoji: '🧵',
    kind: 'family',
    dates: ['2027-08-17'],
    leadDays: 7,
    weight: 70,
    keywords: ['rakhi', 'raksha', 'janai', 'brother', 'sister', 'sweets', 'chocolate', 'gift set'],
    categoryPattern: /rakhi|raksha|brother|sister/i,
    headline: 'Raksha Bandhan',
    subtitle: 'Rakhi, sweets and gifts for your brother or sister.',
  },
  {
    id: 'fathers-day',
    name: 'Father’s Day',
    nepaliName: 'बुबाको मुख हेर्ने दिन',
    emoji: '👨',
    kind: 'family',
    dates: ['2027-08-31'], // Kushe Aunsi, provisional
    leadDays: 10,
    weight: 80,
    keywords: ['father', 'dad', 'papa', 'buwa', 'watch', 'wallet', 'shirt', 'perfume', 'sweets'],
    categoryPattern: /father|dad|parents|him\b/i,
    headline: 'Father’s Day',
    subtitle: 'Kushe Aunsi: a thank-you for Buwa.',
  },
  {
    id: 'teej',
    name: 'Teej',
    nepaliName: 'तीज',
    emoji: '💃',
    kind: 'festival',
    dates: ['2027-09-03'],
    leadDays: 10,
    weight: 80,
    keywords: ['teej', 'saree', 'sari', 'red', 'bangle', 'chura', 'pote', 'mehendi', 'mehndi', 'tilhari', 'sindoor', 'cosmetic', 'makeup'],
    categoryPattern: /teej|women|her\b|wife/i,
    headline: 'Teej celebrations',
    subtitle: 'Red sarees, pote, chura and mehendi for Haritalika Teej.',
  },
]

export type ActiveOccasion = OccasionDef & {
  /** The main day this time round (YYYY-MM-DD). */
  date: string
  /** Days until it (0 = today, negative while a multi-day festival runs). */
  daysLeft: number
  /** How strongly it should lead right now (weight, higher when close). */
  score: number
}

function nepalToday(now: Date) {
  const nepal = new Date(now.getTime() + NEPAL_OFFSET_MS)
  return Date.UTC(nepal.getUTCFullYear(), nepal.getUTCMonth(), nepal.getUTCDate())
}

function occurrences(def: OccasionDef, today: number): string[] {
  if (def.dates) return def.dates
  if (!def.fixed) return []
  const year = new Date(today).getUTCFullYear()
  return [year - 1, year, year + 1].map((y) => `${y}-${def.fixed}`)
}

/** Occasions to show right now, most important first. */
export function activeOccasions(now: Date = new Date()): ActiveOccasion[] {
  const today = nepalToday(now)
  const active: ActiveOccasion[] = []
  for (const def of OCCASIONS) {
    for (const iso of occurrences(def, today)) {
      const [y, m, d] = iso.split('-').map(Number)
      const daysLeft = Math.round((Date.UTC(y, m - 1, d) - today) / DAY_MS)
      if (daysLeft > def.leadDays || daysLeft < -(def.afterDays ?? 0)) continue
      // Closer is stronger; the last few days before matter most.
      const closeness = daysLeft <= 0 ? 1 : 1 - daysLeft / (def.leadDays + 1)
      active.push({ ...def, date: iso, daysLeft, score: def.weight * (0.55 + 0.45 * closeness) })
      break
    }
  }
  return active.sort((a, b) => b.score - a.score)
}

/** "today", "tomorrow", "in 5 days", or "on now" while it runs. */
export function occasionWhen(occasion: Pick<ActiveOccasion, 'daysLeft'>) {
  if (occasion.daysLeft < 0) return 'on now'
  if (occasion.daysLeft === 0) return 'today'
  if (occasion.daysLeft === 1) return 'tomorrow'
  return `in ${occasion.daysLeft} days`
}

/**
 * Words that tie a product to one occasion ("Father's Day cake", "Rakhi
 * combo"). When none of the group's occasions is on, those products are held
 * back so last season's gifts don't lead.
 */
const SEASONAL_GROUPS: Array<{ ids: string[]; pattern: RegExp }> = [
  { ids: ['tihar', 'bhai-tika'], pattern: /tihar|deepawali|diwali|la(?:k?sh|x)mi\s*puja|bhai\s*tika|bhaitika/i },
  { ids: ['chhath'], pattern: /chhath/i },
  { ids: ['dashain'], pattern: /dashain|dasain|vijaya\s*dashami/i },
  { ids: ['christmas'], pattern: /christmas|xmas|santa/i },
  { ids: ['tamu-lhosar', 'sonam-lhosar'], pattern: /lhosar|losar/i },
  { ids: ['new-year', 'nepali-new-year'], pattern: /new\s*year/i },
  { ids: ['maghe-sankranti'], pattern: /maghe|sankranti/i },
  { ids: ['valentines', 'valentines-week'], pattern: /valentine/i },
  { ids: ['basanta-panchami'], pattern: /saraswati|basanta/i },
  { ids: ['shivaratri'], pattern: /shivaratri/i },
  { ids: ['womens-day'], pattern: /women['’]?s\s*day/i },
  { ids: ['holi'], pattern: /\bholi\b|fagu/i },
  { ids: ['mothers-day'], pattern: /mother['’]?s\s*day|mata\s*tirtha/i },
  { ids: ['buddha-jayanti'], pattern: /buddha\s*jayanti/i },
  { ids: ['friendship-day'], pattern: /friendship\s*day/i },
  { ids: ['janai-purnima'], pattern: /raksha|rakhi|janai/i },
  { ids: ['fathers-day'], pattern: /father['’]?s\s*day|kushe/i },
  { ids: ['teej'], pattern: /\bteej\b/i },
]

/** True for products made for an occasion that isn't on right now. */
export function outOfSeasonTest(active: Array<Pick<ActiveOccasion, 'id'>>) {
  const on = new Set(active.map((occasion) => occasion.id))
  const off = SEASONAL_GROUPS.filter((group) => !group.ids.some((id) => on.has(id))).map((group) => group.pattern)
  return (product: { name?: string | null; tags?: string[] | null }) => {
    const text = [product.name || '', ...(product.tags || [])].join(' | ')
    return off.some((pattern) => pattern.test(text))
  }
}
