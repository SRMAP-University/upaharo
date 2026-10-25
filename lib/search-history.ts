import { redis } from '@/lib/redis'

/** Signed-in shoppers' recent searches, used to personalise festive picks. */
const MAX_SEARCHES = 10
const KEEP_SECONDS = 60 * 24 * 60 * 60

const key = (storeId: string, userId: string) => `search-history:${storeId}:${userId}`

export async function getUserSearches(storeId: string, userId: string): Promise<string[]> {
  try {
    const raw = await redis.get(key(storeId, userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map((q) => String(q || '')).filter(Boolean) : []
  } catch {
    return []
  }
}

export async function recordUserSearch(storeId: string, userId: string, query: string) {
  const phrase = query.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (phrase.length < 2) return
  const existing = await getUserSearches(storeId, userId)
  const next = [phrase, ...existing.filter((q) => q.toLowerCase() !== phrase.toLowerCase())].slice(0, MAX_SEARCHES)
  await redis.setex(key(storeId, userId), KEEP_SECONDS, JSON.stringify(next))
}
