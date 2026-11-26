import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import {
  CAKE_BUILDER_TAG,
  cakeConfigProblems,
  isCakeCustomization,
  priceCake,
  roundRupees,
  sanitizeCakeConfig,
  type CakeBuilderConfig,
  type CakeCustomization,
} from '@/lib/cake-builder'

function isMissingCakeTableError(error: unknown) {
  const message = String((error as { message?: string })?.message || '')
  return /CakeBuilderSettings|does not exist|P2021/i.test(message)
}

/** The saved config for a store, or a disabled empty one. */
export async function getCakeBuilderConfig(storeId: string): Promise<CakeBuilderConfig> {
  try {
    const row = await prisma.cakeBuilderSettings.findUnique({ where: { storeId } })
    const config = sanitizeCakeConfig(row?.config)
    if (row) config.updatedAt = row.updatedAt.toISOString()
    return config
  } catch (error) {
    if (isMissingCakeTableError(error)) return sanitizeCakeConfig(null)
    throw error
  }
}

/** True when shoppers can open the builder and order. */
export function isCakeBuilderLive(config: CakeBuilderConfig) {
  return config.enabled && cakeConfigProblems(config).length === 0
}

/**
 * Every custom cake order line points at one hidden product per store, so
 * orders, inventory and reports keep working. It is tagged archived so it
 * never shows in the shop.
 */
async function ensureCakeProduct(storeId: string, config: CakeBuilderConfig): Promise<string> {
  if (config.productId) {
    const existing = await prisma.product.findFirst({
      where: { id: config.productId, storeId },
      select: { id: true },
    })
    if (existing) return existing.id
  }

  const tagged = await prisma.product.findFirst({
    where: { storeId, tags: { has: CAKE_BUILDER_TAG } },
    select: { id: true },
  })
  if (tagged) return tagged.id

  const created = await prisma.product.create({
    data: {
      storeId,
      name: 'Custom Cake (Build Your Own)',
      description: 'A cake designed by the customer in Build Your Own Cake. See the order line for size, flavour, toppings and message.',
      category: 'Cakes',
      price: 0,
      image: config.heroImage || '',
      isVeg: true,
      isAvailable: true,
      division: 'cakes',
      tags: [ARCHIVED_PRODUCT_TAG, CAKE_BUILDER_TAG],
    },
    select: { id: true },
  })
  return created.id
}

export async function saveCakeBuilderConfig(storeId: string, raw: unknown): Promise<CakeBuilderConfig> {
  const config = sanitizeCakeConfig(raw)
  config.productId = await ensureCakeProduct(storeId, config)
  const { updatedAt: _ignored, ...rest } = config
  const stored = rest as unknown as Prisma.InputJsonValue
  const row = await prisma.cakeBuilderSettings.upsert({
    where: { storeId },
    create: { storeId, config: stored },
    update: { config: stored },
  })
  return { ...config, updatedAt: row.updatedAt.toISOString() }
}

export type CakeOrderLine = {
  productId: string
  quantity: number
  price: number
  customization: CakeCustomization
}

/**
 * Prices the custom cakes in an order from the saved config. A cake whose
 * price no longer matches the cart (the admin changed a price, or the cart
 * was tampered with) is refused, so the customer reviews it first.
 */
export async function priceCakeOrderLines(
  storeId: string,
  items: Array<{ id?: unknown; price?: unknown; quantity?: unknown; customization?: unknown }>
): Promise<{ ok: true; lines: CakeOrderLine[] } | { ok: false; status: number; error: string }> {
  if (items.length === 0) return { ok: true, lines: [] }

  const config = await getCakeBuilderConfig(storeId)
  if (!isCakeBuilderLive(config)) {
    return { ok: false, status: 400, error: 'Custom cakes are not available right now. Please remove the custom cake from your cart.' }
  }

  const lines: CakeOrderLine[] = []
  for (const item of items) {
    const customization = item.customization as CakeCustomization
    const result = priceCake(config, customization?.selection)
    if (!result.ok) {
      return {
        ok: false,
        status: 400,
        error: `Your custom cake needs a change: ${result.errors[0]?.message || 'please rebuild it.'}`,
      }
    }
    const quantity = Math.round(Number(item.quantity))
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
      return { ok: false, status: 400, error: 'Custom cakes can be ordered 1 to 20 at a time.' }
    }
    if (Math.abs(roundRupees(Number(item.price) || 0) - result.unitPrice) > 0.5) {
      return {
        ok: false,
        status: 409,
        error: `The price of your custom cake has changed to Rs. ${result.unitPrice}. Please review it in your cart.`,
      }
    }
    lines.push({
      productId: config.productId,
      quantity,
      price: result.unitPrice,
      customization: result.customization,
    })
  }
  return { ok: true, lines }
}

export function isCakeOrderItem(item: { customization?: unknown }) {
  return isCakeCustomization(item?.customization)
}
