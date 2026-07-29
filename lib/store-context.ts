import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'
import {
  ADMIN_STORE_COOKIE,
  DEFAULT_STORE_SLUG,
  STORE_HEADER,
} from '@/lib/store-constants'

export { ADMIN_STORE_COOKIE, DEFAULT_STORE_SLUG, STORE_HEADER }

export type StoreIdentity = {
  id: string
  slug: string
  name: string
  isActive: boolean
}

export type StoreContext = {
  slug: string
  store: StoreIdentity
}

function normalizeStoreSlug(value: string | null | undefined): string {
  const slug = String(value || '').trim().toLowerCase()
  return /^[a-z0-9-]{1,48}$/.test(slug) ? slug : DEFAULT_STORE_SLUG
}

export function resolveStoreSlug(request: Pick<Request, 'headers'>): string {
  return normalizeStoreSlug(request.headers.get(STORE_HEADER))
}

export async function getStore(slug: string): Promise<StoreIdentity | null> {
  const normalizedSlug = normalizeStoreSlug(slug)

  return getOrSetJson<StoreIdentity | null>(
    REDIS_KEYS.STORE(normalizedSlug),
    300,
    async () => {
      const store = await prisma.store.findUnique({
        where: { slug: normalizedSlug },
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
        },
      })

      return store && store.isActive ? store : null
    }
  )
}

export async function resolveStoreContext(
  request: Pick<Request, 'headers'>
): Promise<StoreContext | null> {
  const slug = resolveStoreSlug(request)
  const store = await getStore(slug)
  return store ? { slug: store.slug, store } : null
}

export async function resolveAdminStoreSlug(): Promise<string> {
  const cookieStore = await cookies()
  return normalizeStoreSlug(cookieStore.get(ADMIN_STORE_COOKIE)?.value)
}

export async function resolveAdminStoreContext(): Promise<StoreContext | null> {
  const slug = await resolveAdminStoreSlug()
  const store = await getStore(slug)
  return store ? { slug: store.slug, store } : null
}
