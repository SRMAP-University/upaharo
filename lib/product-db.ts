import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const LEGACY_PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  price: true,
  wholesalePrice: true,
  image: true,
  images: true,
  variants: true,
  imageAlt: true,
  isAvailable: true,
  isVeg: true,
  prepTime: true,
  tags: true,
  discount: true,
  sellerId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect

export const LEGACY_PRODUCT_SELECT_WITH_MINI = {
  ...LEGACY_PRODUCT_SELECT,
  miniDescription: true,
} satisfies Prisma.ProductSelect

export const PRODUCT_CARD_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  price: true,
  wholesalePrice: true,
  image: true,
  isAvailable: true,
  isVeg: true,
  prepTime: true,
  discount: true,
  showFoodTypeLabel: true,
  miniDescription: true,
} satisfies Prisma.ProductSelect

type LegacyProductShape = Prisma.ProductGetPayload<{ select: typeof LEGACY_PRODUCT_SELECT }>
type ProductCardShape = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CARD_SELECT }>
export type ProductCompatResult = LegacyProductShape & { showFoodTypeLabel: boolean; miniDescription: string | null }
export type ProductCardCompatResult = ProductCardShape & {
  showFoodTypeLabel: boolean
  miniDescription: string | null
}

export function isMissingAppSettingsTableError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  const message = String((error as { message?: string } | null)?.message || '')

  return code === 'P2021' && message.includes('AppSettings')
}

export function isMissingTableError(error: unknown, tableName: string) {
  const code = (error as { code?: string } | null)?.code
  const message = String((error as { message?: string } | null)?.message || '')

  return code === 'P2021' && message.toLowerCase().includes(tableName.toLowerCase())
}

export function isMissingRecommendationTablesError(error: unknown) {
  return (
    isMissingTableError(error, 'ProductViewEvent') ||
    isMissingTableError(error, 'RecommendationRule')
  )
}

export function isMissingProductFoodTypeColumnError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  const message = String((error as { message?: string } | null)?.message || '')

  return (
    (code === 'P2022' && (message.includes('showFoodTypeLabel') || message.includes('miniDescription'))) ||
    message.includes('The column `(not available)` does not exist in the current database')
  )
}

export function withProductCompatibility<T extends Record<string, unknown>>(
  product: T
): T & { showFoodTypeLabel: boolean; miniDescription: string | null } {
  const value = (product as { showFoodTypeLabel?: boolean | null }).showFoodTypeLabel
  const miniDescription = (product as { miniDescription?: string | null }).miniDescription

  return {
    ...product,
    showFoodTypeLabel: Boolean(value),
    miniDescription: typeof miniDescription === 'string' && miniDescription.trim().length > 0 ? miniDescription : null,
  }
}

export function stripFoodTypeLabelField<T extends Record<string, unknown>>(data: T) {
  const { showFoodTypeLabel: _showFoodTypeLabel, ...rest } = data
  return rest
}

export function stripMiniDescriptionField<T extends Record<string, unknown>>(data: T) {
  const { miniDescription: _miniDescription, ...rest } = data
  return rest
}

export async function withProductWriteCompatibility<T>(
  data: Record<string, unknown>,
  run: (safeData: any) => Promise<T>
) {
  try {
    return await run(data)
  } catch (error) {
    if (!isMissingProductFoodTypeColumnError(error)) {
      throw error
    }

    const withoutFoodType = stripFoodTypeLabelField(data)

    try {
      return await run(withoutFoodType)
    } catch (innerError) {
      if (!isMissingProductFoodTypeColumnError(innerError)) {
        throw innerError
      }

      return run(stripMiniDescriptionField(withoutFoodType))
    }
  }
}

export async function findManyProductsCompat(
  args: Omit<Prisma.ProductFindManyArgs, 'select'>
): Promise<ProductCompatResult[]> {
  try {
    const products = await prisma.product.findMany(args)
    return products.map((product) => withProductCompatibility(product)) as ProductCompatResult[]
  } catch (error) {
    if (!isMissingProductFoodTypeColumnError(error)) {
      throw error
    }

    try {
      const products = await prisma.product.findMany({
        ...args,
        select: LEGACY_PRODUCT_SELECT_WITH_MINI,
      })

      return products.map((product) => withProductCompatibility(product)) as ProductCompatResult[]
    } catch (innerError) {
      if (!isMissingProductFoodTypeColumnError(innerError)) {
        throw innerError
      }

      const products = await prisma.product.findMany({
        ...args,
        select: LEGACY_PRODUCT_SELECT,
      })

      return products.map((product) => withProductCompatibility(product)) as ProductCompatResult[]
    }
  }
}

export async function findManyProductCardsCompat(
  args: Omit<Prisma.ProductFindManyArgs, 'select'>
): Promise<ProductCardCompatResult[]> {
  try {
    const products = await prisma.product.findMany({
      ...args,
      select: PRODUCT_CARD_SELECT,
    })
    return products.map((product) => withProductCompatibility(product)) as ProductCardCompatResult[]
  } catch (error) {
    if (!isMissingProductFoodTypeColumnError(error)) {
      throw error
    }

    try {
      const products = await prisma.product.findMany({
        ...args,
        select: LEGACY_PRODUCT_SELECT_WITH_MINI,
      })

      return products.map((product) => withProductCompatibility(product)) as ProductCardCompatResult[]
    } catch (innerError) {
      if (!isMissingProductFoodTypeColumnError(innerError)) {
        throw innerError
      }

      const products = await prisma.product.findMany({
        ...args,
        select: LEGACY_PRODUCT_SELECT,
      })

      return products.map((product) => withProductCompatibility(product)) as ProductCardCompatResult[]
    }
  }
}

export async function findFirstProductCompat(
  args: Omit<Prisma.ProductFindFirstArgs, 'select'>
): Promise<ProductCompatResult | null> {
  try {
    const product = await prisma.product.findFirst(args)
    return product ? (withProductCompatibility(product) as ProductCompatResult) : null
  } catch (error) {
    if (!isMissingProductFoodTypeColumnError(error)) {
      throw error
    }

    try {
      const product = await prisma.product.findFirst({
        ...args,
        select: LEGACY_PRODUCT_SELECT_WITH_MINI,
      })

      return product ? (withProductCompatibility(product) as ProductCompatResult) : null
    } catch (innerError) {
      if (!isMissingProductFoodTypeColumnError(innerError)) {
        throw innerError
      }

      const product = await prisma.product.findFirst({
        ...args,
        select: LEGACY_PRODUCT_SELECT,
      })

      return product ? (withProductCompatibility(product) as ProductCompatResult) : null
    }
  }
}
