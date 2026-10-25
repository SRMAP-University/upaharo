import { randomUUID } from 'crypto'
import {
  BUILT_IN_FEATURE_KEYS,
  defaultFeatures,
  type AppFeature,
  type FeaturePlatform,
  type FeatureType,
} from '@/lib/app-features'
import { prisma } from '@/lib/prisma'
import { getOrSetJson, redis, REDIS_KEYS } from '@/lib/redis'

/**
 * Storage for `AppFeature` rows. Raw SQL so it works before the Prisma client
 * is regenerated; the table is created by scripts/_ensure-app-features.mjs.
 */

type FeatureRow = {
  id: string
  key: string
  name: string
  type: string
  enabled: boolean
  platforms: string[] | null
  minRuntime: number
  minAppVersion: string | null
  maxAppVersion: string | null
  startsAt: Date | null
  endsAt: Date | null
  priority: number
  config: unknown
  updatedAt: Date | null
}

type StoreRef = { id: string; slug: string }

function isMissingFeatureTable(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || '')
  return message.includes('AppFeature') && /does not exist|42P01/.test(message)
}

function toFeature(row: FeatureRow): AppFeature {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    type: row.type as FeatureType,
    enabled: row.enabled,
    platforms: (row.platforms ?? []) as FeaturePlatform[],
    minRuntime: row.minRuntime,
    minAppVersion: row.minAppVersion,
    maxAppVersion: row.maxAppVersion,
    startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
    endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    priority: row.priority,
    config: (row.config && typeof row.config === 'object' ? row.config : {}) as Record<string, unknown>,
    builtIn: (BUILT_IN_FEATURE_KEYS as readonly string[]).includes(row.key),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }
}

async function selectRows(storeId: string): Promise<AppFeature[] | null> {
  try {
    const rows = await prisma.$queryRaw<FeatureRow[]>`
      SELECT "id", "key", "name", "type", "enabled", "platforms", "minRuntime", "minAppVersion",
             "maxAppVersion", "startsAt", "endsAt", "priority", "config", "updatedAt"
      FROM "AppFeature"
      WHERE "storeId" = ${storeId}
      ORDER BY "priority" DESC, "createdAt" ASC
    `
    return rows.map(toFeature)
  } catch (error) {
    if (isMissingFeatureTable(error)) return null
    throw error
  }
}

/** Saved features plus built-in defaults that haven't been saved yet. */
function withDefaults(storeSlug: string, saved: AppFeature[]) {
  const keys = new Set(saved.map((f) => f.key))
  const missing = defaultFeatures(storeSlug).filter((f) => !keys.has(f.key))
  return [...saved, ...missing].sort((a, b) => b.priority - a.priority)
}

/** Everything for a store, cached briefly; filtering per device happens after. */
export async function getStoreFeatures(store: StoreRef): Promise<AppFeature[]> {
  return getOrSetJson(REDIS_KEYS.APP_FEATURES(store.slug), 60, async () => {
    const saved = await selectRows(store.id)
    return withDefaults(store.slug, saved ?? [])
  })
}

export async function invalidateStoreFeatures(storeSlug: string) {
  await redis.del(REDIS_KEYS.APP_FEATURES(storeSlug))
}

/** Admin list: saves built-in defaults first so every row is editable. */
export async function listFeaturesForAdmin(store: StoreRef): Promise<{ features: AppFeature[]; tableReady: boolean }> {
  const saved = await selectRows(store.id)
  if (saved === null) return { features: withDefaults(store.slug, []), tableReady: false }

  const keys = new Set(saved.map((f) => f.key))
  const unsaved = defaultFeatures(store.slug).filter((f) => !keys.has(f.key))
  for (const feature of unsaved) {
    await insertFeature(store.id, feature)
  }
  return { features: unsaved.length > 0 ? ((await selectRows(store.id)) ?? []) : saved, tableReady: true }
}

export async function insertFeature(storeId: string, feature: Omit<AppFeature, 'id'>) {
  const id = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "AppFeature" (
      "id", "storeId", "key", "name", "type", "enabled", "platforms", "minRuntime", "minAppVersion",
      "maxAppVersion", "startsAt", "endsAt", "priority", "config", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${storeId}, ${feature.key}, ${feature.name}, ${feature.type}, ${feature.enabled},
      ${feature.platforms}::text[], ${feature.minRuntime}, ${feature.minAppVersion}, ${feature.maxAppVersion},
      ${feature.startsAt}::timestamp(3), ${feature.endsAt}::timestamp(3), ${feature.priority},
      ${JSON.stringify(feature.config)}::jsonb, NOW(), NOW()
    )
    ON CONFLICT ("storeId", "key") DO NOTHING
  `
  return id
}

export async function updateFeature(storeId: string, id: string, feature: Omit<AppFeature, 'id'>) {
  const count = await prisma.$executeRaw`
    UPDATE "AppFeature" SET
      "key" = ${feature.key}, "name" = ${feature.name}, "type" = ${feature.type},
      "enabled" = ${feature.enabled}, "platforms" = ${feature.platforms}::text[],
      "minRuntime" = ${feature.minRuntime}, "minAppVersion" = ${feature.minAppVersion},
      "maxAppVersion" = ${feature.maxAppVersion}, "startsAt" = ${feature.startsAt}::timestamp(3),
      "endsAt" = ${feature.endsAt}::timestamp(3), "priority" = ${feature.priority},
      "config" = ${JSON.stringify(feature.config)}::jsonb, "updatedAt" = NOW()
    WHERE "id" = ${id} AND "storeId" = ${storeId}
  `
  return count > 0
}

export async function findFeature(storeId: string, id: string) {
  const rows = await selectRows(storeId)
  return rows?.find((f) => f.id === id) ?? null
}

export async function deleteFeature(storeId: string, id: string) {
  const count = await prisma.$executeRaw`DELETE FROM "AppFeature" WHERE "id" = ${id} AND "storeId" = ${storeId}`
  return count > 0
}

export function isUniqueKeyError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || '')
  return /23505|unique constraint/i.test(message)
}
