/**
 * Category presentation tokens shared by the admin panel and the mobile app.
 * Icon keys are resolved to Flutter `IconData` in `categoryIconFor()`.
 */
export const CATEGORY_ICON_KEYS = [
  'gift',
  'cake',
  'dessert',
  'flower',
  'plant',
  'chocolate',
  'toy',
  'balloon',
  'celebration',
  'heart',
  'star',
  'bag',
  'basket',
  'card',
  'candle',
  'ring',
  'camera',
  'music',
  'book',
  'food',
  'drink',
  'sparkle',
  // Grocery aisles
  'dairy',
  'grain',
  'fruit',
  'vegetable',
  'meat',
  'frozen',
  'bakery',
  'cleaning',
  'spice',
  'oil',
  'staple',
] as const

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number]

/** Preset wash tints offered in the admin colour picker. */
export const CATEGORY_WASH_PRESETS = [
  '#F3C4D4',
  '#E4C7E8',
  '#C9E4D2',
  '#F5D5C0',
  '#C5D8F0',
  '#F0C9D8',
  '#D7CFF0',
  '#F7E7C3',
  '#CFE7E4',
  '#EBD6C2',
] as const

export function normalizeCategoryIcon(value: unknown): string | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return null
  return (CATEGORY_ICON_KEYS as readonly string[]).includes(raw) ? raw : null
}

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6})$/

export function normalizeCategoryWash(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return HEX_COLOR_RE.test(raw) ? raw.toUpperCase() : null
}

export function normalizeCategoryShortName(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw.slice(0, 16)
}
