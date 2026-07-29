import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import {
  findFirstProductCompat,
  findManyProductsCompat,
  isMissingRecommendationTablesError,
  type ProductCompatResult,
} from '@/lib/product-db'
import {
  MERCH_TAG_OPTIONS,
  RECOMMENDATION_KINDS,
  type RecommendationKindValue,
  type RecommendationProduct,
  type RecommendationRuleInputMap,
  type RecommendationScopeTypeValue,
  type RecommendationSectionResponse,
} from '@/types/recommendations'

const ACTIVE_VIEW_WINDOW_DAYS = 60
const PRODUCT_VIEW_LIMIT = 100
const RELATED_LIMIT = 8
const ADDON_LIMIT = 6
const COMBO_LIMIT = 3

const COMPLEMENTARY_TAG_MAP: Record<string, string[]> = {
  cake: ['candle', 'popper', 'topper', 'knife', 'greeting-card', 'balloon'],
  chocolate: ['flower-addon', 'soft-toy', 'greeting-card', 'balloon'],
  'gift-hamper': ['greeting-card', 'chocolate', 'balloon'],
  'soft-toy': ['chocolate', 'greeting-card', 'balloon'],
  flowers: ['chocolate', 'greeting-card', 'balloon', 'soft-toy'],
  flower: ['chocolate', 'greeting-card', 'balloon', 'soft-toy'],
}

type RuleRecord = {
  kind: RecommendationKindValue
  position: number
  targetProductId: string
}

type RecommendationContext = {
  source: ProductCompatResult
  categoryId: string | null
  normalizedTags: string[]
  complementaryTags: string[]
  finalPrice: number
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()

  return values.filter((value) => {
    if (!value || seen.has(value)) {
      return false
    }

    seen.add(value)
    return true
  })
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase()
}

function normalizeTags(tags: string[] | null | undefined) {
  return uniqueStrings((Array.isArray(tags) ? tags : []).map((tag) => normalizeTag(String(tag || ''))))
}

function intersectionCount(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0
  }

  const rightSet = new Set(right)
  return left.reduce((count, value) => (rightSet.has(value) ? count + 1 : count), 0)
}

function toRecommendationProduct(product: ProductCompatResult): RecommendationProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image,
    category: product.category,
    discount: product.discount || 0,
    isVeg: product.isVeg,
    isAvailable: product.isAvailable,
  }
}

function buildRecommendationContext(product: ProductCompatResult, categoryId: string | null): RecommendationContext {
  const normalizedTags = normalizeTags(product.tags)
  const baseTags = uniqueStrings([...normalizedTags, normalizeTag(product.category)])
  const complementaryTags = uniqueStrings(baseTags.flatMap((tag) => COMPLEMENTARY_TAG_MAP[tag] || []))

  return {
    source: product,
    categoryId,
    normalizedTags,
    complementaryTags,
    finalPrice: product.price - product.price * ((product.discount || 0) / 100),
  }
}

function emptySections(): RecommendationSectionResponse {
  return {
    buyTogether: [],
    addons: [],
    related: [],
  }
}

function getKindSectionKey(kind: RecommendationKindValue): keyof RecommendationSectionResponse {
  if (kind === 'COMBO') {
    return 'buyTogether'
  }

  if (kind === 'ADDON') {
    return 'addons'
  }

  return 'related'
}

function getKindLimit(kind: RecommendationKindValue) {
  if (kind === 'COMBO') {
    return COMBO_LIMIT
  }

  if (kind === 'ADDON') {
    return ADDON_LIMIT
  }

  return RELATED_LIMIT
}

export function normalizeRecommendationRuleInput(input: unknown): RecommendationRuleInputMap {
  const source = (input || {}) as Partial<Record<RecommendationKindValue, unknown>>

  return {
    RELATED: uniqueStrings(Array.isArray(source.RELATED) ? source.RELATED.map((value) => String(value || '').trim()) : []),
    ADDON: uniqueStrings(Array.isArray(source.ADDON) ? source.ADDON.map((value) => String(value || '').trim()) : []),
    COMBO: uniqueStrings(Array.isArray(source.COMBO) ? source.COMBO.map((value) => String(value || '').trim()) : []),
  }
}

export function serializeRecommendationRules(records: RuleRecord[]): RecommendationRuleInputMap {
  return records.reduce<RecommendationRuleInputMap>(
    (acc, record) => {
      acc[record.kind].push(record.targetProductId)
      return acc
    },
    {
      RELATED: [],
      ADDON: [],
      COMBO: [],
    }
  )
}

export async function replaceRecommendationRules(input: {
  storeId: string
  scopeType: RecommendationScopeTypeValue
  sourceProductId?: string | null
  sourceCategoryId?: string | null
  rules: RecommendationRuleInputMap
}) {
  const { storeId, scopeType, sourceProductId = null, sourceCategoryId = null, rules } = input

  if (scopeType === 'PRODUCT' && !sourceProductId) {
    return
  }

  if (scopeType === 'CATEGORY' && !sourceCategoryId) {
    return
  }

  await prisma.recommendationRule.deleteMany({
    where:
      scopeType === 'PRODUCT'
        ? { storeId, scopeType, sourceProductId }
        : { storeId, scopeType, sourceCategoryId },
  })

  const flattened = RECOMMENDATION_KINDS.flatMap((kind) =>
    rules[kind].map((targetProductId, index) => ({
      storeId,
      scopeType,
      sourceProductId,
      sourceCategoryId,
      targetProductId,
      kind,
      position: index,
    }))
  )

  if (flattened.length > 0) {
    await prisma.recommendationRule.createMany({ data: flattened })
  }
}

async function fetchCategoryIdsByName(storeId: string, names: string[]) {
  if (names.length === 0) {
    return new Map<string, string>()
  }

  const categories = await prisma.category.findMany({
    where: {
      storeId,
      type: 'PRODUCT',
      name: { in: names },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  })

  return new Map(categories.map((category) => [category.name, category.id]))
}

async function fetchPinnedRules(input: { storeId: string; productIds: string[]; categoryIds: string[] }) {
  try {
    const [productRules, categoryRules] = await Promise.all([
      input.productIds.length > 0
        ? prisma.recommendationRule.findMany({
            where: {
              storeId: input.storeId,
              scopeType: 'PRODUCT',
              sourceProductId: { in: input.productIds },
            },
            orderBy: [{ kind: 'asc' }, { position: 'asc' }],
            select: {
              sourceProductId: true,
              targetProductId: true,
              kind: true,
              position: true,
            },
          })
        : Promise.resolve([]),
      input.categoryIds.length > 0
        ? prisma.recommendationRule.findMany({
            where: {
              storeId: input.storeId,
              scopeType: 'CATEGORY',
              sourceCategoryId: { in: input.categoryIds },
            },
            orderBy: [{ kind: 'asc' }, { position: 'asc' }],
            select: {
              sourceCategoryId: true,
              targetProductId: true,
              kind: true,
              position: true,
            },
          })
        : Promise.resolve([]),
    ])

    return { productRules, categoryRules }
  } catch (error) {
    if (isMissingRecommendationTablesError(error)) {
      return { productRules: [], categoryRules: [] }
    }

    throw error
  }
}

function resolvePinnedIdsForSourceKind(
  kind: RecommendationKindValue,
  sourceProductId: string,
  sourceCategoryId: string | null,
  productRules: Array<{ sourceProductId: string | null; targetProductId: string; kind: RecommendationKindValue; position: number }>,
  categoryRules: Array<{ sourceCategoryId: string | null; targetProductId: string; kind: RecommendationKindValue; position: number }>
) {
  const productLevel = productRules
    .filter((rule) => rule.sourceProductId === sourceProductId && rule.kind === kind)
    .sort((left, right) => left.position - right.position)
    .map((rule) => rule.targetProductId)

  if (productLevel.length > 0) {
    return productLevel
  }

  if (!sourceCategoryId) {
    return []
  }

  return categoryRules
    .filter((rule) => rule.sourceCategoryId === sourceCategoryId && rule.kind === kind)
    .sort((left, right) => left.position - right.position)
    .map((rule) => rule.targetProductId)
}

async function fetchProductsByIds(storeId: string, ids: string[]) {
  if (ids.length === 0) {
    return []
  }

  const products = await findManyProductsCompat({
    where: {
      storeId,
      id: { in: ids },
      isAvailable: true,
      NOT: {
        tags: {
          has: ARCHIVED_PRODUCT_TAG,
        },
      },
    },
  })

  const productMap = new Map(products.map((product) => [product.id, product]))
  return ids.map((id) => productMap.get(id)).filter((product): product is ProductCompatResult => Boolean(product))
}

async function fetchViewedProducts(storeId: string, viewedProductIds: string[]) {
  return fetchProductsByIds(storeId, viewedProductIds.slice(0, 30))
}

async function getCoViewCountsForProduct(storeId: string, productId: string) {
  try {
    const cutoff = new Date(Date.now() - ACTIVE_VIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const sourceEvents = await prisma.productViewEvent.findMany({
      where: {
        storeId,
        productId,
        viewedAt: { gte: cutoff },
      },
      select: {
        userId: true,
        sessionId: true,
      },
      orderBy: { viewedAt: 'desc' },
      take: 200,
    })

    const userIds = uniqueStrings(sourceEvents.map((event) => String(event.userId || '')).filter(Boolean))
    const sessionIds = uniqueStrings(sourceEvents.map((event) => String(event.sessionId || '')).filter(Boolean))

    if (userIds.length === 0 && sessionIds.length === 0) {
      return new Map<string, number>()
    }

    const relatedEvents = await prisma.productViewEvent.findMany({
      where: {
        storeId,
        productId: { not: productId },
        viewedAt: { gte: cutoff },
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ...(sessionIds.length > 0 ? [{ sessionId: { in: sessionIds } }] : []),
        ],
      },
      select: {
        productId: true,
      },
      take: 400,
    })

    const counts = new Map<string, number>()
    for (const event of relatedEvents) {
      counts.set(event.productId, (counts.get(event.productId) || 0) + 1)
    }

    return counts
  } catch (error) {
    if (isMissingRecommendationTablesError(error)) {
      return new Map<string, number>()
    }

    throw error
  }
}

function scoreCandidateForSource(input: {
  candidate: ProductCompatResult
  source: RecommendationContext
  kind: RecommendationKindValue
  coViewCount: number
  viewedProducts: ProductCompatResult[]
}) {
  const candidateTags = normalizeTags(input.candidate.tags)
  const candidatePrice = input.candidate.price - input.candidate.price * ((input.candidate.discount || 0) / 100)
  const sharedTags = intersectionCount(candidateTags, input.source.normalizedTags)
  const complementaryHits = intersectionCount(candidateTags, input.source.complementaryTags)
  const viewedAffinity = input.viewedProducts.reduce((score, viewedProduct) => {
    const viewedTags = normalizeTags(viewedProduct.tags)
    return score + intersectionCount(candidateTags, viewedTags) + (viewedProduct.category === input.candidate.category ? 2 : 0)
  }, 0)
  const priceGapRatio = input.source.finalPrice > 0 ? Math.abs(candidatePrice - input.source.finalPrice) / input.source.finalPrice : 1
  const discountBoost = Math.min(Number(input.candidate.discount || 0), 50) / 5

  let score = 0

  if (input.kind === 'RELATED') {
    score += input.candidate.category === input.source.source.category ? 30 : 0
    score += sharedTags * 10
    score += input.coViewCount * 8
    score += viewedAffinity * 2
  } else if (input.kind === 'ADDON') {
    score += complementaryHits * 24
    score += normalizeTag(input.candidate.category) === 'addons' ? 10 : 0
    score += sharedTags * 2
    score += input.coViewCount * 3
    score += viewedAffinity
  } else {
    score += complementaryHits * 18
    score += normalizeTag(input.candidate.category) === 'addons' ? 10 : 0
    score += candidatePrice <= input.source.finalPrice * 0.6 ? 12 : 0
    score += input.coViewCount * 4
    score += viewedAffinity
  }

  score += discountBoost
  score -= priceGapRatio * 4

  return score
}

async function fetchCandidatePool(storeId: string, excludeIds: string[], take = 160) {
  return findManyProductsCompat({
    where: {
      storeId,
      isAvailable: true,
      id: { notIn: excludeIds },
      NOT: {
        tags: {
          has: ARCHIVED_PRODUCT_TAG,
        },
      },
    },
    orderBy: [{ discount: 'desc' }, { createdAt: 'desc' }],
    take,
  })
}

async function buildProductSections(input: {
  storeId: string
  sources: RecommendationContext[]
  viewedProductIds: string[]
  excludeIds?: string[]
}) {
  const viewedProducts = await fetchViewedProducts(input.storeId, input.viewedProductIds)
  const { productRules, categoryRules } = await fetchPinnedRules({
    storeId: input.storeId,
    productIds: input.sources.map((source) => source.source.id),
    categoryIds: input.sources.map((source) => source.categoryId).filter((value): value is string => Boolean(value)),
  })

  const coViewMaps = new Map<string, Map<string, number>>()
  for (const source of input.sources) {
    coViewMaps.set(source.source.id, await getCoViewCountsForProduct(input.storeId, source.source.id))
  }

  const excludedIds = uniqueStrings([
    ...input.sources.map((source) => source.source.id),
    ...(input.excludeIds || []),
  ])
  const candidatePool = await fetchCandidatePool(input.storeId, excludedIds)
  const usedIds = new Set(excludedIds)
  const sections = emptySections()

  for (const kind of RECOMMENDATION_KINDS) {
    const sectionKey = getKindSectionKey(kind)
    const limit = getKindLimit(kind)
    const pinnedIds = uniqueStrings(
      input.sources.flatMap((source) =>
        resolvePinnedIdsForSourceKind(kind, source.source.id, source.categoryId, productRules, categoryRules)
      )
    )

    const pinnedProducts = await fetchProductsByIds(input.storeId, pinnedIds)
    for (const product of pinnedProducts) {
      if (sections[sectionKey].length >= limit || usedIds.has(product.id)) {
        continue
      }

      sections[sectionKey].push(toRecommendationProduct(product))
      usedIds.add(product.id)
    }

    if (sections[sectionKey].length >= limit) {
      continue
    }

    const scoredCandidates = candidatePool
      .filter((candidate) => !usedIds.has(candidate.id))
      .map((candidate) => {
        const score = input.sources.reduce((total, source) => {
          const coViewCount = coViewMaps.get(source.source.id)?.get(candidate.id) || 0
          return total + scoreCandidateForSource({
            candidate,
            source,
            kind,
            coViewCount,
            viewedProducts,
          })
        }, 0)

        return { candidate, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        const leftDiscount = Number(left.candidate.discount || 0)
        const rightDiscount = Number(right.candidate.discount || 0)
        if (rightDiscount !== leftDiscount) {
          return rightDiscount - leftDiscount
        }

        return left.candidate.price - right.candidate.price
      })

    for (const entry of scoredCandidates) {
      if (sections[sectionKey].length >= limit) {
        break
      }

      if (usedIds.has(entry.candidate.id)) {
        continue
      }

      sections[sectionKey].push(toRecommendationProduct(entry.candidate))
      usedIds.add(entry.candidate.id)
    }
  }

  return sections
}

export async function getRecentViewHistory(input: {
  storeId: string
  userId?: string | null
  sessionId?: string | null
  excludeProductIds?: string[]
  take?: number
}) {
  if (!input.userId && !input.sessionId) {
    return []
  }

  try {
    const cutoff = new Date(Date.now() - ACTIVE_VIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const excludeProductIds = uniqueStrings(input.excludeProductIds || [])
    const events = await prisma.productViewEvent.findMany({
      where: {
        storeId: input.storeId,
        viewedAt: { gte: cutoff },
        productId: excludeProductIds.length > 0 ? { notIn: excludeProductIds } : undefined,
        OR: [
          ...(input.userId ? [{ userId: input.userId }] : []),
          ...(input.sessionId ? [{ sessionId: input.sessionId }] : []),
        ],
      },
      select: {
        productId: true,
      },
      orderBy: { viewedAt: 'desc' },
      take: Math.max((input.take || 30) * 4, 40),
    })

    return uniqueStrings(events.map((event) => event.productId)).slice(0, input.take || 30)
  } catch (error) {
    if (isMissingRecommendationTablesError(error)) {
      return []
    }

    throw error
  }
}

export async function getProductRecommendations(input: {
  storeId: string
  productId: string
  viewedProductIds?: string[]
}) {
  const product = await findFirstProductCompat({
    where: {
      storeId: input.storeId,
      id: input.productId,
      isAvailable: true,
      NOT: {
        tags: {
          has: ARCHIVED_PRODUCT_TAG,
        },
      },
    },
  })

  if (!product) {
    return emptySections()
  }

  const category = await prisma.category.findFirst({
    where: {
      storeId: input.storeId,
      type: 'PRODUCT',
      name: product.category,
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  return buildProductSections({
    storeId: input.storeId,
    sources: [buildRecommendationContext(product, category?.id || null)],
    viewedProductIds: uniqueStrings((input.viewedProductIds || []).filter((id) => id !== product.id)),
  })
}

export async function getCartRecommendations(input: {
  storeId: string
  productIds: string[]
  viewedProductIds?: string[]
}) {
  const productIds = uniqueStrings(input.productIds)
  if (productIds.length === 0) {
    return emptySections()
  }

  const sources = await findManyProductsCompat({
    where: {
      storeId: input.storeId,
      id: { in: productIds },
      isAvailable: true,
      NOT: {
        tags: {
          has: ARCHIVED_PRODUCT_TAG,
        },
      },
    },
  })

  if (sources.length === 0) {
    return emptySections()
  }

  const categoryIdMap = await fetchCategoryIdsByName(input.storeId, uniqueStrings(sources.map((source) => source.category)))

  return buildProductSections({
    storeId: input.storeId,
    sources: sources.map((source) => buildRecommendationContext(source, categoryIdMap.get(source.category) || null)),
    viewedProductIds: uniqueStrings((input.viewedProductIds || []).filter((id) => !productIds.includes(id))),
    excludeIds: productIds,
  })
}

export async function trackProductView(input: {
  storeId: string
  productId: string
  userId?: string | null
  sessionId?: string | null
}) {
  if (!input.userId && !input.sessionId) {
    return
  }

  try {
    await prisma.productViewEvent.create({
      data: {
        storeId: input.storeId,
        productId: input.productId,
        userId: input.userId || null,
        sessionId: input.sessionId || null,
      },
    })

    await pruneProductViewEvents({
      storeId: input.storeId,
      userId: input.userId || null,
      sessionId: input.sessionId || null,
    })
  } catch (error) {
    if (isMissingRecommendationTablesError(error)) {
      return
    }

    throw error
  }
}

export async function pruneProductViewEvents(input: { storeId: string; userId?: string | null; sessionId?: string | null }) {
  try {
    if (input.userId) {
      const overflow = await prisma.productViewEvent.findMany({
        where: { storeId: input.storeId, userId: input.userId },
        orderBy: { viewedAt: 'desc' },
        skip: PRODUCT_VIEW_LIMIT,
        select: { id: true },
      })

      if (overflow.length > 0) {
        await prisma.productViewEvent.deleteMany({
          where: { storeId: input.storeId, id: { in: overflow.map((event) => event.id) } },
        })
      }
    }

    if (input.sessionId) {
      const overflow = await prisma.productViewEvent.findMany({
        where: { storeId: input.storeId, sessionId: input.sessionId },
        orderBy: { viewedAt: 'desc' },
        skip: PRODUCT_VIEW_LIMIT,
        select: { id: true },
      })

      if (overflow.length > 0) {
        await prisma.productViewEvent.deleteMany({
          where: { storeId: input.storeId, id: { in: overflow.map((event) => event.id) } },
        })
      }
    }
  } catch (error) {
    if (isMissingRecommendationTablesError(error)) {
      return
    }

    throw error
  }
}

export function getMerchTagOptions() {
  return [...MERCH_TAG_OPTIONS]
}
