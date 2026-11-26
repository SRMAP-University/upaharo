/**
 * Build Your Own Cake: the option list an admin manages, the shopper's picks,
 * and the price and summary worked out from both.
 *
 * This file has no server imports, so the builder page, the cart and the
 * orders API all price a cake with the same code. The server always prices
 * again from the saved config; the browser's numbers are only a preview.
 */

export const CAKE_BUILDER_KIND = 'cake-builder'
/** Tag on the hidden product that order lines for custom cakes point at. */
export const CAKE_BUILDER_TAG = 'cake-builder'
export const CAKE_BUILDER_PATH = '/build-your-cake'
/** Uploaded cake photos go here (see app/api/uploads). */
export const CAKE_UPLOAD_FOLDER = 'cake-photos'

export type CakeToppingVisual =
  | 'fruits'
  | 'chips'
  | 'sprinkles'
  | 'cookies'
  | 'kitkat'
  | 'whipped'
  | 'garnish'
  | 'oreo'
  | 'cherries'
  | 'nuts'
  | 'none'

export type CakeAddonVisual = 'topper' | 'candles' | 'flowers' | 'photo' | 'decoration' | 'reference' | 'none'

export const TOPPING_VISUALS: CakeToppingVisual[] = [
  'fruits',
  'chips',
  'sprinkles',
  'cookies',
  'kitkat',
  'whipped',
  'garnish',
  'oreo',
  'cherries',
  'nuts',
  'none',
]
export const ADDON_VISUALS: CakeAddonVisual[] = ['topper', 'candles', 'flowers', 'photo', 'decoration', 'reference', 'none']

export type CakeSizeOption = {
  id: string
  label: string
  /** Weight in pounds. For the custom size this is the starting weight. */
  pounds: number
  serves: string
  /** Fixed price for this size. Unused when `custom` is true. */
  price: number
  /** Approximate diameter, shown in the preview. */
  diameterInch: number | null
  /** How many flavours a customer may combine at this size. */
  maxFlavours: number
  image: string
  active: boolean
  /** Customer types a weight; priced by `pricePerPound`. */
  custom: boolean
  pricePerPound: number
  minPounds: number
  maxPounds: number
  stepPounds: number
}

export type CakeFlavourOption = {
  id: string
  name: string
  description: string
  /** Extra per pound of cake. */
  surchargePerPound: number
  image: string
  /** Preview colours. */
  frosting: string
  sponge: string
  /** Drip colour over the top edge; empty for none. */
  drip: string
  active: boolean
}

export type CakeTypeOption = {
  id: string
  label: string
  note: string
  isVeg: boolean
  surchargePerPound: number
  active: boolean
}

export type CakeToppingOption = {
  id: string
  name: string
  price: number
  image: string
  visual: CakeToppingVisual
  active: boolean
}

export type CakeAddonOption = {
  id: string
  name: string
  description: string
  price: number
  image: string
  visual: CakeAddonVisual
  /** Customer must upload a picture (photo cake, design reference). */
  needsImage: boolean
  /** Customer must describe what they want (custom decoration). */
  needsNote: boolean
  active: boolean
}

export type CakeBuilderConfig = {
  enabled: boolean
  /** Hidden product every custom-cake order line belongs to. */
  productId: string
  title: string
  subtitle: string
  heroImage: string
  sizes: CakeSizeOption[]
  flavours: CakeFlavourOption[]
  types: CakeTypeOption[]
  toppings: CakeToppingOption[]
  addons: CakeAddonOption[]
  message: { enabled: boolean; maxLength: number; price: number }
  /** 0 = no limit. */
  maxToppings: number
  /** Shown under the price, e.g. "Order 24 hours ahead". */
  note: string
  updatedAt?: string
}

export type CakeSelection = {
  sizeId: string
  customPounds?: number | null
  flavourIds: string[]
  typeId: string
  toppingIds: string[]
  addonIds: string[]
  /** Uploaded picture per add-on that needs one. */
  addonImages: Record<string, string>
  /** Customer's description per add-on that needs one. */
  addonNotes: Record<string, string>
  message: string
}

export type CakeVisual = {
  pounds: number
  diameterInch: number | null
  flavours: Array<{ frosting: string; sponge: string; drip: string }>
  toppings: CakeToppingVisual[]
  addons: CakeAddonVisual[]
  message: string
  photoUrl: string
}

export type CakePriceLine = { label: string; amount: number }

export type CakeSummary = {
  size: string
  pounds: number
  serves: string
  flavours: string[]
  type: string
  isVeg: boolean
  toppings: Array<{ name: string; price: number }>
  addons: Array<{ name: string; price: number; image?: string; note?: string }>
  message: string
  lines: CakePriceLine[]
  unitPrice: number
}

/** What a cart line and an order line keep for a custom cake. */
export type CakeCustomization = {
  kind: typeof CAKE_BUILDER_KIND
  v: 1
  selection: CakeSelection
  summary: CakeSummary
  visual: CakeVisual
}

export type CakeFieldError = { field: string; message: string }

export type CakePriceResult =
  | { ok: true; unitPrice: number; customization: CakeCustomization }
  | { ok: false; errors: CakeFieldError[] }

// ---------------------------------------------------------------- helpers

export const roundRupees = (n: number) => Math.round(n * 100) / 100

const str = (v: unknown, max = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}
const money = (v: unknown) => roundRupees(Math.max(0, num(v)))
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

export function slugId(value: unknown, fallback: string): string {
  const id = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return id || fallback
}

export function normalizeHex(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return ('#' + raw.slice(1).split('').map((c) => c + c).join('')).toUpperCase()
  }
  return fallback
}

/** Only our own uploads or https links are accepted as pictures. */
export function isAllowedImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  const value = url.trim()
  if (!value || value.length > 600) return false
  if (value.startsWith('/api/uploads?key=uploads/')) return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const cleanImage = (v: unknown) => (isAllowedImageUrl(v) ? String(v).trim() : '')

function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.map((item) => {
    let id = item.id
    for (let n = 2; seen.has(id); n++) id = `${item.id}-${n}`
    seen.add(id)
    return { ...item, id }
  })
}

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : [])

// ---------------------------------------------------------------- config

/**
 * Turns whatever is stored (or posted by the admin form) into a safe config:
 * known fields only, prices never negative, ids unique.
 */
export function sanitizeCakeConfig(raw: unknown): CakeBuilderConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>

  const sizes = uniqueIds(
    asArray(r.sizes).slice(0, 12).map((s, i): CakeSizeOption => {
      const custom = bool(s?.custom, false)
      const minPounds = Math.max(0.5, num(s?.minPounds, 2))
      const maxPounds = Math.max(minPounds, num(s?.maxPounds, 10))
      return {
        id: slugId(s?.id || s?.label, `size-${i + 1}`),
        label: str(s?.label, 40) || `Size ${i + 1}`,
        pounds: Math.max(0.25, num(s?.pounds, custom ? minPounds : 1)),
        serves: str(s?.serves, 40),
        price: money(s?.price),
        diameterInch: s?.diameterInch === null || s?.diameterInch === '' || s?.diameterInch === undefined
          ? null
          : Math.max(0, num(s?.diameterInch)) || null,
        maxFlavours: Math.min(4, Math.max(1, Math.round(num(s?.maxFlavours, 1)))),
        image: cleanImage(s?.image),
        active: bool(s?.active, true),
        custom,
        pricePerPound: money(s?.pricePerPound),
        minPounds,
        maxPounds,
        stepPounds: Math.min(maxPounds, Math.max(0.25, num(s?.stepPounds, 0.5))),
      }
    })
  )

  const flavours = uniqueIds(
    asArray(r.flavours).slice(0, 40).map((f, i): CakeFlavourOption => ({
      id: slugId(f?.id || f?.name, `flavour-${i + 1}`),
      name: str(f?.name, 40) || `Flavour ${i + 1}`,
      description: str(f?.description, 120),
      surchargePerPound: money(f?.surchargePerPound),
      image: cleanImage(f?.image),
      frosting: normalizeHex(f?.frosting, '#F6E7D7'),
      sponge: normalizeHex(f?.sponge, '#E9C9A0'),
      drip: f?.drip ? normalizeHex(f?.drip, '') : '',
      active: bool(f?.active, true),
    }))
  )

  const typesRaw = asArray(r.types)
  const types = uniqueIds(
    (typesRaw.length ? typesRaw : [{ id: 'veg', isVeg: true }, { id: 'non-veg', isVeg: false }])
      .slice(0, 4)
      .map((t, i): CakeTypeOption => {
        const isVeg = bool(t?.isVeg, i === 0)
        return {
          id: slugId(t?.id || t?.label, isVeg ? 'veg' : 'non-veg'),
          label: str(t?.label, 30) || (isVeg ? 'Veg Cake' : 'Non-Veg Cake'),
          note: str(t?.note, 60),
          isVeg,
          surchargePerPound: money(t?.surchargePerPound),
          active: bool(t?.active, true),
        }
      })
  )

  const toppings = uniqueIds(
    asArray(r.toppings).slice(0, 40).map((t, i): CakeToppingOption => ({
      id: slugId(t?.id || t?.name, `topping-${i + 1}`),
      name: str(t?.name, 40) || `Topping ${i + 1}`,
      price: money(t?.price),
      image: cleanImage(t?.image),
      visual: TOPPING_VISUALS.includes(t?.visual) ? t.visual : 'none',
      active: bool(t?.active, true),
    }))
  )

  const addons = uniqueIds(
    asArray(r.addons).slice(0, 30).map((a, i): CakeAddonOption => ({
      id: slugId(a?.id || a?.name, `addon-${i + 1}`),
      name: str(a?.name, 40) || `Add-on ${i + 1}`,
      description: str(a?.description, 120),
      price: money(a?.price),
      image: cleanImage(a?.image),
      visual: ADDON_VISUALS.includes(a?.visual) ? a.visual : 'none',
      needsImage: bool(a?.needsImage, false),
      needsNote: bool(a?.needsNote, false),
      active: bool(a?.active, true),
    }))
  )

  const m = (r.message && typeof r.message === 'object' ? r.message : {}) as Record<string, unknown>

  return {
    enabled: bool(r.enabled, false),
    productId: str(r.productId, 40),
    title: str(r.title, 60) || 'Build Your Own Cake',
    subtitle: str(r.subtitle, 120) || 'Design it. Customize it. Make it special!',
    heroImage: cleanImage(r.heroImage),
    sizes,
    flavours,
    types,
    toppings,
    addons,
    message: {
      enabled: bool(m.enabled, true),
      maxLength: Math.min(120, Math.max(5, Math.round(num(m.maxLength, 50)))),
      price: money(m.price),
    },
    maxToppings: Math.min(20, Math.max(0, Math.round(num(r.maxToppings, 0)))),
    note: str(r.note, 160),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
  }
}

/** The config with only what shoppers may pick. */
export function activeCakeConfig(config: CakeBuilderConfig): CakeBuilderConfig {
  return {
    ...config,
    sizes: config.sizes.filter((o) => o.active),
    flavours: config.flavours.filter((o) => o.active),
    types: config.types.filter((o) => o.active),
    toppings: config.toppings.filter((o) => o.active),
    addons: config.addons.filter((o) => o.active),
  }
}

/** What stops the builder from opening for shoppers, if anything. */
export function cakeConfigProblems(config: CakeBuilderConfig): string[] {
  const live = activeCakeConfig(config)
  const problems: string[] = []
  if (!config.productId) problems.push('The hidden cake product has not been created yet (save once to create it).')
  if (live.sizes.length === 0) problems.push('Add at least one active size.')
  if (live.flavours.length === 0) problems.push('Add at least one active flavour.')
  if (live.types.length === 0) problems.push('Add at least one active cake type.')
  if (live.sizes.some((s) => !s.custom && s.price <= 0)) problems.push('Every active size needs a price.')
  if (live.sizes.some((s) => s.custom && s.pricePerPound <= 0)) problems.push('The custom size needs a price per pound.')
  return problems
}

// ---------------------------------------------------------------- selection

export function emptyCakeSelection(config?: CakeBuilderConfig): CakeSelection {
  const live = config ? activeCakeConfig(config) : null
  return {
    sizeId: '',
    customPounds: live?.sizes.find((s) => s.custom)?.minPounds ?? null,
    flavourIds: [],
    typeId: live?.types.find((t) => t.isVeg)?.id ?? live?.types[0]?.id ?? '',
    toppingIds: [],
    addonIds: [],
    addonImages: {},
    addonNotes: {},
    message: '',
  }
}

/** Accepts untrusted input (a request body, an old cart line). */
export function sanitizeCakeSelection(raw: unknown): CakeSelection {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const ids = (v: unknown) =>
    Array.from(new Set(asArray(v).map((x) => str(x, 48)).filter(Boolean))).slice(0, 40)
  const record = (v: unknown, max: number) => {
    const out: Record<string, string> = {}
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 30)) {
        const value = str(val, max)
        if (value) out[str(k, 48)] = value
      }
    }
    return out
  }
  const customPounds = r.customPounds === null || r.customPounds === undefined || r.customPounds === ''
    ? null
    : num(r.customPounds, NaN)
  return {
    sizeId: str(r.sizeId, 48),
    customPounds: Number.isFinite(customPounds as number) ? (customPounds as number) : null,
    flavourIds: ids(r.flavourIds),
    typeId: str(r.typeId, 48),
    toppingIds: ids(r.toppingIds),
    addonIds: ids(r.addonIds),
    addonImages: record(r.addonImages, 600),
    addonNotes: record(r.addonNotes, 300),
    message: String(r.message ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200),
  }
}

function poundsFor(size: CakeSizeOption | undefined, selection: CakeSelection): number {
  if (!size) return 1
  if (!size.custom) return size.pounds
  const p = num(selection.customPounds, size.minPounds)
  return Math.min(size.maxPounds, Math.max(size.minPounds, p))
}

/** Rough diameter for a weight, when the size doesn't give one. */
export function diameterForPounds(pounds: number): number {
  return Math.round((5 + pounds * 2) * 2) / 2
}

/**
 * Preview data for the picks so far. Works on half-finished picks, so the
 * preview can follow the shopper from the first tap.
 */
export function buildCakeVisual(config: CakeBuilderConfig, selection: CakeSelection): CakeVisual {
  const size = config.sizes.find((s) => s.id === selection.sizeId)
  const pounds = poundsFor(size, selection)
  const flavours = selection.flavourIds
    .map((id) => config.flavours.find((f) => f.id === id))
    .filter((f): f is CakeFlavourOption => Boolean(f))
    .map((f) => ({ frosting: f.frosting, sponge: f.sponge, drip: f.drip }))
  const addons = selection.addonIds
    .map((id) => config.addons.find((a) => a.id === id))
    .filter((a): a is CakeAddonOption => Boolean(a))
  const photoAddon = addons.find((a) => a.visual === 'photo')
  return {
    pounds,
    diameterInch: size?.custom || !size ? diameterForPounds(pounds) : size.diameterInch ?? diameterForPounds(pounds),
    flavours,
    toppings: selection.toppingIds
      .map((id) => config.toppings.find((t) => t.id === id)?.visual)
      .filter((v): v is CakeToppingVisual => Boolean(v) && v !== 'none'),
    addons: addons.map((a) => a.visual).filter((v) => v !== 'none' && v !== 'reference'),
    message: config.message.enabled ? selection.message.trim() : '',
    photoUrl: photoAddon ? selection.addonImages[photoAddon.id] || '' : '',
  }
}

const fmtPounds = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(2).replace(/0$/, '')} lb`

/**
 * Checks the picks against the config and prices them. Only active options
 * count, so a switched-off flavour can't be ordered from an old cart.
 */
export function priceCake(config: CakeBuilderConfig, rawSelection: unknown): CakePriceResult {
  const selection = sanitizeCakeSelection(rawSelection)
  const live = activeCakeConfig(config)
  const errors: CakeFieldError[] = []

  const size = live.sizes.find((s) => s.id === selection.sizeId)
  if (!size) errors.push({ field: 'size', message: 'Choose a cake size.' })

  let pounds = size?.pounds ?? 1
  if (size?.custom) {
    const p = num(selection.customPounds, NaN)
    const steps = (p - size.minPounds) / size.stepPounds
    if (!Number.isFinite(p) || p < size.minPounds || p > size.maxPounds) {
      errors.push({
        field: 'size',
        message: `Enter a weight between ${fmtPounds(size.minPounds)} and ${fmtPounds(size.maxPounds)}.`,
      })
    } else if (Math.abs(steps - Math.round(steps)) > 1e-6) {
      errors.push({ field: 'size', message: `Weight goes up in steps of ${fmtPounds(size.stepPounds)}.` })
    } else {
      pounds = p
    }
  }

  const flavours = selection.flavourIds.map((id) => live.flavours.find((f) => f.id === id))
  const maxFlavours = size?.maxFlavours ?? 1
  if (flavours.length === 0) errors.push({ field: 'flavour', message: 'Choose a flavour.' })
  else if (flavours.some((f) => !f)) errors.push({ field: 'flavour', message: 'A chosen flavour is no longer available.' })
  else if (flavours.length > maxFlavours) {
    errors.push({
      field: 'flavour',
      message: maxFlavours === 1 ? 'This size has one flavour.' : `This size takes up to ${maxFlavours} flavours.`,
    })
  }

  const type = live.types.find((t) => t.id === selection.typeId)
  if (!type) errors.push({ field: 'type', message: 'Choose Veg or Non-Veg.' })

  const toppings = selection.toppingIds.map((id) => live.toppings.find((t) => t.id === id))
  if (toppings.some((t) => !t)) errors.push({ field: 'toppings', message: 'A chosen topping is no longer available.' })
  if (config.maxToppings > 0 && toppings.length > config.maxToppings) {
    errors.push({ field: 'toppings', message: `Pick up to ${config.maxToppings} toppings.` })
  }

  const addons = selection.addonIds.map((id) => live.addons.find((a) => a.id === id))
  if (addons.some((a) => !a)) errors.push({ field: 'addons', message: 'A chosen add-on is no longer available.' })
  for (const addon of addons) {
    if (!addon) continue
    if (addon.needsImage && !isAllowedImageUrl(selection.addonImages[addon.id])) {
      errors.push({ field: `addon:${addon.id}`, message: `Upload a picture for ${addon.name}.` })
    }
    if (addon.needsNote && !selection.addonNotes[addon.id]?.trim()) {
      errors.push({ field: `addon:${addon.id}`, message: `Tell us what you'd like for ${addon.name}.` })
    }
  }

  const message = selection.message.trim()
  if (message && !config.message.enabled) errors.push({ field: 'message', message: 'Cake messages are not available.' })
  if ([...message].length > config.message.maxLength) {
    errors.push({ field: 'message', message: `Keep the message to ${config.message.maxLength} characters.` })
  }

  if (errors.length > 0 || !size || !type) return { ok: false, errors }

  const chosenFlavours = flavours as CakeFlavourOption[]
  const chosenToppings = toppings as CakeToppingOption[]
  const chosenAddons = addons as CakeAddonOption[]

  const lines: CakePriceLine[] = []
  const sizeLabel = size.custom ? `${size.label} (${fmtPounds(pounds)})` : size.label
  lines.push({
    label: sizeLabel,
    amount: roundRupees(size.custom ? size.pricePerPound * pounds : size.price),
  })
  // Mixed flavours are charged at the dearest one's rate.
  const flavourRate = Math.max(0, ...chosenFlavours.map((f) => f.surchargePerPound))
  if (flavourRate > 0) {
    const dearest = chosenFlavours.find((f) => f.surchargePerPound === flavourRate)!
    lines.push({ label: `${dearest.name} flavour`, amount: roundRupees(flavourRate * pounds) })
  }
  if (type.surchargePerPound > 0) {
    lines.push({ label: type.label, amount: roundRupees(type.surchargePerPound * pounds) })
  }
  for (const t of chosenToppings) if (t.price > 0) lines.push({ label: t.name, amount: t.price })
  for (const a of chosenAddons) if (a.price > 0) lines.push({ label: a.name, amount: a.price })
  if (message && config.message.price > 0) lines.push({ label: 'Cake message', amount: config.message.price })

  const unitPrice = roundRupees(lines.reduce((sum, line) => sum + line.amount, 0))
  const cleanSelection: CakeSelection = {
    sizeId: size.id,
    customPounds: size.custom ? pounds : null,
    flavourIds: chosenFlavours.map((f) => f.id),
    typeId: type.id,
    toppingIds: chosenToppings.map((t) => t.id),
    addonIds: chosenAddons.map((a) => a.id),
    addonImages: Object.fromEntries(
      chosenAddons.filter((a) => a.needsImage).map((a) => [a.id, selection.addonImages[a.id]])
    ),
    addonNotes: Object.fromEntries(
      chosenAddons.filter((a) => a.needsNote).map((a) => [a.id, selection.addonNotes[a.id].trim()])
    ),
    message,
  }

  return {
    ok: true,
    unitPrice,
    customization: {
      kind: CAKE_BUILDER_KIND,
      v: 1,
      selection: cleanSelection,
      summary: {
        size: sizeLabel,
        pounds,
        serves: size.serves,
        flavours: chosenFlavours.map((f) => f.name),
        type: type.label,
        isVeg: type.isVeg,
        toppings: chosenToppings.map((t) => ({ name: t.name, price: t.price })),
        addons: chosenAddons.map((a) => ({
          name: a.name,
          price: a.price,
          ...(a.needsImage ? { image: cleanSelection.addonImages[a.id] } : {}),
          ...(a.needsNote ? { note: cleanSelection.addonNotes[a.id] } : {}),
        })),
        message,
        lines,
        unitPrice,
      },
      visual: buildCakeVisual(config, cleanSelection),
    },
  }
}

/**
 * Running total while the shopper is still choosing: the same rules as
 * `priceCake`, but counting whatever is picked so far.
 */
export function previewCakeTotal(config: CakeBuilderConfig, selection: CakeSelection): number {
  const live = activeCakeConfig(config)
  const size = live.sizes.find((s) => s.id === selection.sizeId)
  const pounds = poundsFor(size, selection)
  let total = size ? (size.custom ? size.pricePerPound * pounds : size.price) : 0
  const rates = selection.flavourIds.map((id) => live.flavours.find((f) => f.id === id)?.surchargePerPound ?? 0)
  total += Math.max(0, ...rates) * pounds
  total += (live.types.find((t) => t.id === selection.typeId)?.surchargePerPound ?? 0) * pounds
  for (const id of selection.toppingIds) total += live.toppings.find((t) => t.id === id)?.price ?? 0
  for (const id of selection.addonIds) total += live.addons.find((a) => a.id === id)?.price ?? 0
  if (selection.message.trim() && config.message.enabled) total += config.message.price
  return roundRupees(total)
}

export function isCakeCustomization(value: unknown): value is CakeCustomization {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { kind?: unknown }).kind === CAKE_BUILDER_KIND &&
      (value as { summary?: unknown }).summary &&
      (value as { visual?: unknown }).visual
  )
}

/** Same cake, same cart line: the id is the product plus a hash of the picks. */
export function cakeCartLineId(productId: string, selection: CakeSelection): string {
  const text = JSON.stringify(selection)
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return `${productId}::cake-${(hash >>> 0).toString(36)}`
}

export function cakeLineName(summary: CakeSummary): string {
  return `Custom Cake · ${summary.size} ${summary.flavours.join(' & ')}`
}

// ---------------------------------------------------------------- starter

/**
 * Suggested options an admin can load in the editor and then change. Never
 * used for pricing until an admin saves it.
 */
export const STARTER_CAKE_CONFIG: CakeBuilderConfig = sanitizeCakeConfig({
  enabled: false,
  title: 'Build Your Own Cake',
  subtitle: 'Design it. Customize it. Make it special!',
  note: 'Freshly baked to order. Please order at least 24 hours ahead.',
  sizes: [
    { id: 'half-pound', label: '0.5 Pound', pounds: 0.5, serves: 'Serves 2-3', price: 500, diameterInch: 5, maxFlavours: 1 },
    { id: 'one-pound', label: '1 Pound', pounds: 1, serves: 'Serves 4-6', price: 850, diameterInch: 6, maxFlavours: 1 },
    { id: 'one-half-pound', label: '1.5 Pound', pounds: 1.5, serves: 'Serves 7-10', price: 1250, diameterInch: 7, maxFlavours: 2 },
    {
      id: 'custom',
      label: 'Custom',
      serves: 'Big celebrations',
      custom: true,
      pricePerPound: 800,
      minPounds: 2,
      maxPounds: 10,
      stepPounds: 0.5,
      pounds: 2,
      maxFlavours: 2,
    },
  ],
  flavours: [
    { id: 'chocolate-truffle', name: 'Chocolate Truffle', frosting: '#5B3221', sponge: '#3E2117', drip: '#2B140C' },
    { id: 'vanilla-classic', name: 'Vanilla Classic', frosting: '#FFF6E4', sponge: '#F3DDA8', drip: '' },
    { id: 'red-velvet', name: 'Red Velvet', surchargePerPound: 100, frosting: '#FFF4F1', sponge: '#B3202E', drip: '' },
    { id: 'black-forest', name: 'Black Forest', frosting: '#FFF8F1', sponge: '#3B2016', drip: '#2B140C' },
    { id: 'butterscotch', name: 'Butterscotch', frosting: '#FBE6BF', sponge: '#E9B86A', drip: '#D98C2B' },
    { id: 'strawberry-cream', name: 'Strawberry Cream', surchargePerPound: 50, frosting: '#F9C5D0', sponge: '#FBE3E8', drip: '#E0567A' },
    { id: 'white-forest', name: 'White Forest', frosting: '#FFFFFF', sponge: '#F4E3C5', drip: '#F2E6D6' },
    { id: 'pineapple', name: 'Pineapple', frosting: '#FFF8DC', sponge: '#F7D56B', drip: '#F2B705' },
    { id: 'chocolate-fudge', name: 'Chocolate Fudge', surchargePerPound: 100, frosting: '#4A2617', sponge: '#2E160D', drip: '#1E0D07' },
  ],
  types: [
    { id: 'veg', label: 'Veg Cake', note: 'Eggless', isVeg: true },
    { id: 'non-veg', label: 'Non-Veg Cake', note: 'Contains egg', isVeg: false },
  ],
  toppings: [
    { id: 'fresh-fruits', name: 'Fresh Fruits', price: 100, visual: 'fruits' },
    { id: 'chocolate-chips', name: 'Chocolate Chips', price: 100, visual: 'chips' },
    { id: 'rainbow-sprinkles', name: 'Rainbow Sprinkles', price: 50, visual: 'sprinkles' },
    { id: 'mini-cookies', name: 'Mini Cookies', price: 100, visual: 'cookies' },
    { id: 'kitkat-pieces', name: 'KitKat Pieces', price: 150, visual: 'kitkat' },
    { id: 'whipped-cream', name: 'Whipped Cream', price: 100, visual: 'whipped' },
    { id: 'chocolate-garnish', name: 'Chocolate Garnish', price: 50, visual: 'garnish' },
    { id: 'oreo-crumbs', name: 'Oreo Crumbs', price: 80, visual: 'oreo' },
    { id: 'cherries', name: 'Cherries', price: 80, visual: 'cherries' },
  ],
  addons: [
    { id: 'happy-birthday-topper', name: 'Happy Birthday Topper', price: 50, visual: 'topper' },
    { id: 'candles', name: 'Candles', price: 30, visual: 'candles' },
    { id: 'flowers', name: 'Flowers', price: 100, visual: 'flowers' },
    {
      id: 'personalized-photo',
      name: 'Personalized Photo',
      description: 'Your photo printed on the cake',
      price: 200,
      visual: 'photo',
      needsImage: true,
    },
    {
      id: 'custom-decoration',
      name: 'Custom Decoration',
      description: 'Tell us the theme or design',
      price: 300,
      visual: 'decoration',
      needsNote: true,
    },
    {
      id: 'reference-image',
      name: 'Upload Image',
      description: 'A picture of the design you want',
      price: 0,
      visual: 'reference',
      needsImage: true,
    },
  ],
  message: { enabled: true, maxLength: 50, price: 0 },
  maxToppings: 0,
})
