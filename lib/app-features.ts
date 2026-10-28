/**
 * Server-driven app features: the contract between the admin panel, the
 * `/api/features` endpoint and the Flutter app runtime
 * (`upaharo_mobile/lib/runtime/`). Pure so client and server can share it.
 *
 * A feature is data, not code: the app ships a fixed set of building blocks
 * (characters, web blocks, update prompts, events and actions) and each
 * feature combines them. Bump RUNTIME_VERSION when the app learns new blocks,
 * and give features that need them a matching `minRuntime`.
 */

export const RUNTIME_VERSION = 1

export const FEATURE_TYPES = ['character', 'web', 'update_prompt'] as const
export type FeatureType = (typeof FEATURE_TYPES)[number]

export const FEATURE_PLATFORMS = ['android', 'ios', 'web'] as const
export type FeaturePlatform = (typeof FEATURE_PLATFORMS)[number]

/** Spots in the app where features can render. */
export const FEATURE_PLACEMENTS = [
  'bottom_nav.start',
  'product.cart_bar',
  'product.details',
  'home.top',
  'cart.top',
] as const

/** Events the app emits; `custom:<name>` events come from web features. */
export const FEATURE_EVENTS = [
  'app.opened',
  'screen.opened',
  'tab.changed',
  'cart.added',
  'tap',
] as const

/** Actions the app runtime can run. Character-only: say, play. */
export const FEATURE_ACTIONS = ['say', 'play', 'open', 'add_to_cart', 'haptic', 'wait', 'emit', 'close'] as const

export const BUILT_IN_FEATURE_KEYS = ['gift-buddy'] as const

export type AppFeature = {
  id: string
  key: string
  name: string
  type: FeatureType
  enabled: boolean
  platforms: FeaturePlatform[]
  minRuntime: number
  minAppVersion: string | null
  maxAppVersion: string | null
  startsAt: string | null
  endsAt: string | null
  priority: number
  config: Record<string, unknown>
  builtIn?: boolean
  updatedAt?: string | null
}

export type FeatureAudience = {
  platform: FeaturePlatform
  appVersion?: string | null
  runtime?: number | null
  now?: Date
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/
const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/

/** Compare dotted versions numerically: 1.10.0 > 1.9.2. */
export function compareVersions(a: string, b: string) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

export function isFeatureLive(feature: AppFeature, audience: FeatureAudience) {
  if (!feature.enabled) return false
  if (feature.platforms.length > 0 && !feature.platforms.includes(audience.platform)) return false

  if (audience.platform !== 'web') {
    const runtime = audience.runtime ?? 0
    if (feature.minRuntime > runtime) return false
    const version = audience.appVersion?.split('+')[0]
    if (version && VERSION_PATTERN.test(version)) {
      if (feature.minAppVersion && compareVersions(version, feature.minAppVersion) < 0) return false
      if (feature.maxAppVersion && compareVersions(version, feature.maxAppVersion) > 0) return false
    }
  }

  const now = (audience.now ?? new Date()).getTime()
  if (feature.startsAt && Date.parse(feature.startsAt) > now) return false
  if (feature.endsAt && Date.parse(feature.endsAt) < now) return false
  return true
}

const GIFT_BUDDY_CONFIG = {
  character: 'gift_buddy',
  size: 38,
  placements: ['bottom_nav.start', 'product.cart_bar'],
  personality: { tapCycle: true, idle: true, glance: true, celebrateCart: true, sleepAfterSeconds: 40 },
  added: ['Yay! Added to your cart!', 'Ooh, great pick! 💝', 'Into the cart it goes! 🛒'],
  scripts: [
    {
      when: { placement: 'bottom_nav.start', tab: 'home' },
      intro: '{greeting}',
      introOnce: 'session',
      lines: ['Psst… try AI search. Just tell me who it’s for!', 'Need ideas? Flowers + chocolate never miss 💐🍫'],
    },
    { when: { placement: 'bottom_nav.start', tab: 'categories' }, lines: ['So many lovely things in here!'] },
    {
      when: { placement: 'bottom_nav.start', tab: 'orders' },
      lines: ['Your gifts are in good hands 🛵', 'I’m keeping an eye on your orders 👀'],
    },
    { when: { placement: 'bottom_nav.start', tab: 'promo' }, lines: ['Deals! My favourite kind of surprise 🎉'] },
    { when: { placement: 'product.cart_bar' }, fetch: '/api/mascot/product/{productId}' },
  ],
  on: [],
}

/** Features every store of a kind gets until an admin edits them. */
export function defaultFeatures(storeSlug: string): AppFeature[] {
  if (storeSlug !== 'gifts') return []
  return [
    {
      id: 'builtin-gift-buddy',
      key: 'gift-buddy',
      name: 'Gift buddy mascot',
      type: 'character',
      enabled: true,
      platforms: [],
      minRuntime: 1,
      minAppVersion: null,
      maxAppVersion: null,
      startsAt: null,
      endsAt: null,
      priority: 0,
      config: GIFT_BUDDY_CONFIG,
      builtIn: true,
    },
  ]
}

/** Starting points offered in the admin panel's "New feature" menu. */
export const FEATURE_TEMPLATES: Array<{ label: string; feature: Omit<AppFeature, 'id'> }> = [
  {
    label: 'Character (Rive animation)',
    feature: {
      key: 'festival-character',
      name: 'Festival character',
      type: 'character',
      enabled: false,
      platforms: ['android', 'ios'],
      minRuntime: 1,
      minAppVersion: null,
      maxAppVersion: null,
      startsAt: null,
      endsAt: null,
      priority: 10,
      config: {
        character: 'rive',
        size: 44,
        rive: {
          url: 'https://example.com/your-character.riv',
          stateMachine: 'State Machine 1',
          inputs: { tap: 'trigger:Tap', love: 'trigger:Love', sleep: 'bool:Sleeping' },
        },
        placements: ['home.top'],
        lines: ['Happy Tihar! ✨'],
        scripts: [],
        on: [{ event: 'tap', actions: [{ do: 'play', name: 'tap' }, { do: 'say', from: 'lines' }] }],
      },
    },
  },
  {
    label: 'Web block (inline)',
    feature: {
      key: 'home-web-block',
      name: 'Home web block',
      type: 'web',
      enabled: false,
      platforms: ['android', 'ios'],
      minRuntime: 1,
      minAppVersion: null,
      maxAppVersion: null,
      startsAt: null,
      endsAt: null,
      priority: 0,
      config: { url: '/app-features/gift-finder', presentation: 'inline', placements: ['home.top'], height: 260 },
    },
  },
  {
    label: 'Right now picks (inline): festivals, weather, time of day',
    feature: {
      key: 'right-now',
      name: 'Right now picks',
      type: 'web',
      enabled: true,
      platforms: ['android', 'ios'],
      minRuntime: 1,
      minAppVersion: null,
      maxAppVersion: null,
      startsAt: null,
      endsAt: null,
      priority: 5,
      config: { url: '/app-features/right-now', presentation: 'inline', placements: ['home.top'], height: 330 },
    },
  },
  {
    label: 'Web pop-up (sheet): gift finder',
    feature: {
      key: 'gift-finder',
      name: 'Gift finder pop-up',
      type: 'web',
      enabled: false,
      platforms: ['android', 'ios'],
      minRuntime: 1,
      minAppVersion: null,
      maxAppVersion: null,
      startsAt: null,
      endsAt: null,
      priority: 0,
      config: {
        url: '/app-features/gift-finder',
        presentation: 'sheet',
        title: 'Gift finder',
        trigger: { event: 'app.opened', once: 'day', delayMs: 1500 },
      },
    },
  },
  {
    label: 'Update prompt',
    feature: {
      key: 'update-prompt',
      name: 'Update prompt',
      type: 'update_prompt',
      enabled: false,
      platforms: ['android'],
      minRuntime: 1,
      minAppVersion: null,
      maxAppVersion: null,
      startsAt: null,
      endsAt: null,
      priority: 100,
      config: {
        latestVersion: '1.1.0',
        minSupportedVersion: '1.0.0',
        title: 'A fresh update is here 🎁',
        message: 'Update Upaharo to get the newest features.',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.upaharo.upaharo_mobile',
        remindAfterHours: 24,
      },
    },
  },
]

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function optionalVersion(value: unknown, field: string) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (!VERSION_PATTERN.test(text)) throw new Error(`${field} must look like 1.2.3`)
  return text
}

function optionalDate(value: unknown, field: string) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const time = Date.parse(text)
  if (Number.isNaN(time)) throw new Error(`${field} is not a valid date`)
  return new Date(time).toISOString()
}

/** Same-site paths or https only; web features run with the app bridge. */
function checkUrl(value: unknown, field: string) {
  const url = String(value ?? '').trim()
  if (!url) throw new Error(`${field} is required`)
  if (!url.startsWith('/') && !/^https:\/\//i.test(url)) {
    throw new Error(`${field} must be https:// or start with /`)
  }
  return url
}

function checkActions(value: unknown, where: string) {
  if (value === undefined) return
  if (!Array.isArray(value)) throw new Error(`${where} must be a list`)
  for (const action of value) {
    const name = asObject(action).do
    if (!FEATURE_ACTIONS.includes(name as (typeof FEATURE_ACTIONS)[number])) {
      throw new Error(`${where}: unknown action "${String(name)}" (use ${FEATURE_ACTIONS.join(', ')})`)
    }
  }
}

function checkPlacements(value: unknown) {
  if (value === undefined) return
  if (!Array.isArray(value)) throw new Error('config.placements must be a list')
  for (const placement of value) {
    if (!FEATURE_PLACEMENTS.includes(placement as (typeof FEATURE_PLACEMENTS)[number])) {
      throw new Error(`Unknown placement "${String(placement)}" (use ${FEATURE_PLACEMENTS.join(', ')})`)
    }
  }
}

function checkConfig(type: FeatureType, config: Record<string, unknown>) {
  if (type === 'character') {
    const kind = config.character
    if (kind !== 'gift_buddy' && kind !== 'rive') throw new Error('config.character must be "gift_buddy" or "rive"')
    if (kind === 'rive') checkUrl(asObject(config.rive).url, 'config.rive.url')
    checkPlacements(config.placements)
    if (config.on !== undefined && !Array.isArray(config.on)) throw new Error('config.on must be a list')
    for (const [i, rule] of ((config.on as unknown[]) ?? []).entries()) {
      checkActions(asObject(rule).actions, `config.on[${i}].actions`)
    }
  } else if (type === 'web') {
    checkUrl(config.url, 'config.url')
    const presentation = config.presentation
    if (presentation !== 'inline' && presentation !== 'sheet' && presentation !== 'page') {
      throw new Error('config.presentation must be "inline", "sheet" or "page"')
    }
    if (presentation === 'inline') checkPlacements(config.placements ?? [])
  } else if (type === 'update_prompt') {
    optionalVersion(config.latestVersion, 'config.latestVersion')
    optionalVersion(config.minSupportedVersion, 'config.minSupportedVersion')
    checkUrl(config.storeUrl, 'config.storeUrl')
  }
}

/** Validates admin input into a storable feature; throws a readable Error. */
export function normalizeFeatureInput(input: unknown): Omit<AppFeature, 'id'> {
  const body = asObject(input)
  const key = String(body.key ?? '').trim().toLowerCase()
  if (!KEY_PATTERN.test(key)) throw new Error('Key must be 2–48 characters: lowercase letters, numbers and dashes')

  const type = body.type as FeatureType
  if (!FEATURE_TYPES.includes(type)) throw new Error(`Type must be one of ${FEATURE_TYPES.join(', ')}`)

  const config = typeof body.config === 'string' ? (JSON.parse(body.config) as unknown) : body.config
  const configObject = asObject(config)
  checkConfig(type, configObject)

  const platforms = (Array.isArray(body.platforms) ? body.platforms : []).filter((p): p is FeaturePlatform =>
    FEATURE_PLATFORMS.includes(p as FeaturePlatform)
  )

  return {
    key,
    name: String(body.name ?? '').trim().slice(0, 80) || key,
    type,
    enabled: body.enabled !== false,
    platforms,
    minRuntime: Math.max(1, Math.min(99, parseInt(String(body.minRuntime ?? 1), 10) || 1)),
    minAppVersion: optionalVersion(body.minAppVersion, 'Min app version'),
    maxAppVersion: optionalVersion(body.maxAppVersion, 'Max app version'),
    startsAt: optionalDate(body.startsAt, 'Start time'),
    endsAt: optionalDate(body.endsAt, 'End time'),
    priority: Math.max(-999, Math.min(999, parseInt(String(body.priority ?? 0), 10) || 0)),
    config: configObject,
  }
}
