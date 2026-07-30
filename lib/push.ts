import { prisma } from '@/lib/prisma'
import { firebaseServiceAccount } from '@/lib/firebase-sa.generated'
import { DEFAULT_STORE_SLUG } from '@/lib/store-constants'

type PushData = Record<string, string>

export type PushPayload = {
  title: string
  body: string
  data?: PushData
  /** Store slug used for Android channel + client filtering. */
  storeSlug?: string
  /**
   * Override Android notification channel.
   * Partner new-order alerts use `partner_new_orders` (max importance + alarm sound).
   */
  androidChannelId?: string
  /** FCM sound name (default `default`). Partner can ship a custom raw resource. */
  sound?: string
}

let messaging: {
  sendEachForMulticast: (message: unknown) => Promise<{
    successCount: number
    responses: Array<{ success: boolean; error?: { code?: string; message?: string } }>
  }>
} | null = null
let initAttempted = false

function getFirebaseMessaging() {
  if (initAttempted) return messaging
  initAttempted = true

  try {
    let creds: Record<string, unknown> | null = firebaseServiceAccount
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!creds && raw) {
      creds = parseServiceAccountJson(raw)
    }
    if (!creds) {
      console.warn('[push] Firebase credentials not set — push disabled')
      return null
    }

    // firebase-admin v12+ modular exports (credential.cert / admin.messaging removed)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeApp, getApps, cert } = require('firebase-admin/app') as any
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging } = require('firebase-admin/messaging') as any

    if (!getApps().length) {
      initializeApp({
        credential: cert(creds),
      })
    }

    messaging = getMessaging()
    return messaging
  } catch (error) {
    console.error('[push] Failed to init Firebase Admin:', error)
    return null
  }
}

/** Accept plain JSON, dotenv-escaped JSON, or base64-encoded JSON. */
function parseServiceAccountJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()

  const attempts: string[] = [
    trimmed,
    trimmed.replace(/^"|"$/g, ''),
    // dotenv sometimes leaves escaped quotes/newlines
    trimmed.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/^"|"$/g, ''),
  ]

  // Prefer base64 for env files (no quote escaping issues)
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8')
    if (decoded.trim().startsWith('{')) {
      attempts.unshift(decoded)
    }
  } catch {
    // ignore
  }

  let lastError: unknown
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && parsed.private_key && parsed.client_email) {
        if (typeof parsed.private_key === 'string' && parsed.private_key.includes('\\n')) {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
        }
        return parsed
      }
    } catch (e) {
      lastError = e
    }
  }

  throw lastError || new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON')
}

async function pruneInvalidToken(token: string) {
  try {
    await prisma.deviceToken.deleteMany({ where: { token } })
  } catch {
    // ignore
  }
}

/** Android channel ids must match Flutter FlavorConfig.orderNotificationChannelId. */
export function androidChannelIdForStore(storeSlug?: string | null): string {
  const slug = (storeSlug || DEFAULT_STORE_SLUG).toLowerCase()
  return slug === 'grocery' ? 'upaharo_grocery_orders' : 'upaharo_orders'
}

/** Loud partner ops channel — must match partner Flutter channel id. */
/** Bump when Android channel sound settings change (channels are immutable). */
export const PARTNER_NEW_ORDER_CHANNEL = 'partner_orders_loud_v3'
/** Custom raw sound in partner app: res/raw/order_alert.* */
export const PARTNER_NEW_ORDER_SOUND = 'order_alert'

/** Send FCM to specific device tokens. Returns count of successful sends. */
export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload
): Promise<number> {
  const unique = [...new Set(tokens.filter(Boolean))]
  if (!unique.length) return 0

  const fcm = getFirebaseMessaging()
  if (!fcm) return 0

  const storeSlug = payload.storeSlug || payload.data?.storeSlug || DEFAULT_STORE_SLUG
  const channelId =
    payload.androidChannelId ||
    payload.data?.androidChannelId ||
    androidChannelIdForStore(storeSlug)
  const sound = payload.sound || 'default'
  const useCustomSound = sound !== 'default'
  const data: PushData = {
    ...(payload.data || {}),
    storeSlug,
    androidChannelId: channelId,
  }

  let success = 0

  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500)
    try {
      const res = await fcm.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId,
            sound,
            // defaultSound:true overrides custom raw sounds on Android.
            defaultSound: !useCustomSound,
            defaultVibrateTimings: true,
            visibility: 'public',
            notificationPriority: 'PRIORITY_MAX',
          },
        },
        apns: {
          payload: {
            aps: {
              sound,
              badge: 1,
              // Interrupt quieter modes for partner order alerts when allowed.
              ...(channelId === PARTNER_NEW_ORDER_CHANNEL
                ? { 'interruption-level': 'time-sensitive' }
                : {}),
            },
          },
        },
      })

      success += res.successCount

      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code || ''
          console.warn('[push] token failed:', code, r.error?.message)
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token')
          ) {
            void pruneInvalidToken(batch[idx])
          }
        }
      })
    } catch (error) {
      console.error('[push] sendEachForMulticast failed:', error)
    }
  }

  return success
}

function isPartnerPush(payload: PushPayload): boolean {
  if (payload.androidChannelId === PARTNER_NEW_ORDER_CHANNEL) return true
  if (payload.data?.audience === 'partner') return true
  const type = payload.data?.type || ''
  return type === 'PARTNER_NEW_ORDER' || type === 'PARTNER_DELIVERY_JOB'
}

/** Send push to devices registered for this user + storefront. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  storeId?: string | null
): Promise<number> {
  const partner = isPartnerPush(payload)
  let devices = await prisma.deviceToken.findMany({
    where: {
      userId,
      ...(storeId ? { storeId } : {}),
      // Customer ORDER_UPDATE must not hit partner-app tokens (same account).
      clientApp: partner ? 'partner' : 'customer',
    },
    select: { token: true },
  })

  // Legacy partner installs may still be tagged customer until they reopen the app.
  if (partner && devices.length === 0) {
    devices = await prisma.deviceToken.findMany({
      where: {
        userId,
        ...(storeId ? { storeId } : {}),
      },
      select: { token: true },
    })
    if (devices.length) {
      console.warn(
        '[push] partner push falling back to untagged tokens for user',
        userId
      )
    }
  }

  return sendPushToTokens(
    devices.map((d) => d.token),
    payload
  )
}
