/**
 * Mini banner tap targets.
 *
 * A tile points at a product or a category by id. Ids can go stale when the
 * target is deleted or deactivated, so links are resolved at read time and a
 * dangling one is downgraded to NONE rather than sending the app to a dead
 * screen.
 */

import { prisma } from '@/lib/prisma'

export const MINI_BANNER_LINK_TYPES = ['NONE', 'PRODUCT', 'CATEGORY'] as const

export type MiniBannerLinkType = (typeof MINI_BANNER_LINK_TYPES)[number]

export type MiniBannerRow = {
  id: string
  title: string
  image: string
  linkType: string
  linkId: string | null
  order: number
  isActive: boolean
}

export type ResolvedMiniBanner = Omit<MiniBannerRow, 'linkType'> & {
  linkType: MiniBannerLinkType
  /** Target name, used as the screen title the app opens. */
  linkLabel: string | null
}

export function normalizeMiniBannerLink(
  rawType: unknown,
  rawId: unknown
): { linkType: MiniBannerLinkType; linkId: string | null } {
  const type = String(rawType ?? '').trim().toUpperCase()
  const id = String(rawId ?? '').trim()

  if (!MINI_BANNER_LINK_TYPES.includes(type as MiniBannerLinkType)) {
    return { linkType: 'NONE', linkId: null }
  }
  if (type === 'NONE' || !id) {
    return { linkType: 'NONE', linkId: null }
  }
  return { linkType: type as MiniBannerLinkType, linkId: id }
}

/** Attaches target names, clearing links whose target no longer exists. */
export async function resolveMiniBannerLinks<T extends MiniBannerRow>(
  banners: T[]
): Promise<(Omit<T, 'linkType'> & { linkType: MiniBannerLinkType; linkLabel: string | null })[]> {
  const productIds = new Set<string>()
  const categoryIds = new Set<string>()

  for (const banner of banners) {
    if (!banner.linkId) continue
    if (banner.linkType === 'PRODUCT') productIds.add(banner.linkId)
    if (banner.linkType === 'CATEGORY') categoryIds.add(banner.linkId)
  }

  const [products, categories] = await Promise.all([
    productIds.size
      ? prisma.product.findMany({
          where: { id: { in: [...productIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    categoryIds.size
      ? prisma.category.findMany({
          where: { id: { in: [...categoryIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ])

  const names = new Map<string, string>()
  for (const product of products) names.set(`PRODUCT:${product.id}`, product.name)
  for (const category of categories) names.set(`CATEGORY:${category.id}`, category.name)

  return banners.map((banner) => {
    const { linkType, linkId } = normalizeMiniBannerLink(banner.linkType, banner.linkId)
    const label = linkId ? names.get(`${linkType}:${linkId}`) ?? null : null

    return {
      ...banner,
      ...(label === null && linkType !== 'NONE'
        ? { linkType: 'NONE' as MiniBannerLinkType, linkId: null }
        : { linkType, linkId }),
      linkLabel: label,
    }
  })
}
