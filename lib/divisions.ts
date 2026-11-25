/**
 * Upaharo runs two inventories in the gifts store: Upaharo Gifts and
 * Upaharo Cakes. Every product belongs to one (Product.division), chosen when
 * it is listed; new products default by their category. Product Inventory in
 * admin shows each one's stock, sales and dashboard separately.
 */

export const DIVISIONS = [
  { id: 'gifts', label: 'Upaharo Gifts', short: 'Gifts' },
  { id: 'cakes', label: 'Upaharo Cakes', short: 'Cakes' },
] as const

export type Division = (typeof DIVISIONS)[number]['id']

export const DEFAULT_DIVISION: Division = 'gifts'

/** Category names that belong to Upaharo Cakes by default. */
export const CAKE_CATEGORY = /cake|pastr|cupcake|bakery|brownie|cookie|dessert/i

export function isDivision(value: unknown): value is Division {
  return value === 'gifts' || value === 'cakes'
}

/** The division a product starts in: Cakes for cake categories, else Gifts. */
export function divisionFor(category: string | null | undefined, wanted?: unknown): Division {
  if (isDivision(wanted)) return wanted
  return CAKE_CATEGORY.test(String(category || '')) ? 'cakes' : 'gifts'
}

export function divisionLabel(division: string | null | undefined) {
  return DIVISIONS.find((d) => d.id === division)?.label ?? DIVISIONS[0].label
}
