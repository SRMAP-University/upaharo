export type ProductCategoryType = 'PRODUCT' | 'RECIPIENT' | 'OCCASION'

export type ProductCategoryOption = {
  id: string
  name: string
  type: ProductCategoryType
}

export type ProductCategoryGroups = {
  productCategories: ProductCategoryOption[]
  recipientCategories: ProductCategoryOption[]
  occasionCategories: ProductCategoryOption[]
}

export const EMPTY_PRODUCT_CATEGORY_GROUPS: ProductCategoryGroups = {
  productCategories: [],
  recipientCategories: [],
  occasionCategories: [],
}

function uniqueNames(values: string[]) {
  const seen = new Set<string>()

  return values.filter((value) => {
    if (seen.has(value)) {
      return false
    }

    seen.add(value)
    return true
  })
}

function normalizeCategoryOptions(
  input: unknown,
  type: ProductCategoryType
): ProductCategoryOption[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((entry) => {
      const category = entry as Partial<ProductCategoryOption>
      const id = String(category?.id || '').trim()
      const name = String(category?.name || '').trim()

      if (!id || !name) {
        return null
      }

      return { id, name, type }
    })
    .filter((category): category is ProductCategoryOption => Boolean(category))
}

export function parseProductTags(input: string | string[] | null | undefined) {
  const rawTags = Array.isArray(input) ? input : String(input || '').split(',')

  return uniqueNames(
    rawTags
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
  )
}

/**
 * A product's tags: free tags, plus the names of the recipient, occasion and
 * extra shop categories it belongs to. A product sits in its main category and
 * in every category whose name is one of its tags.
 */
export function buildProductTags(
  customTagsInput: string,
  recipientSelections: string[],
  occasionSelections: string[],
  extraCategorySelections: string[] = []
) {
  return uniqueNames([
    ...parseProductTags(customTagsInput),
    ...recipientSelections.map((tag) => tag.trim()).filter(Boolean),
    ...occasionSelections.map((tag) => tag.trim()).filter(Boolean),
    ...extraCategorySelections.map((tag) => tag.trim()).filter(Boolean),
  ])
}

export function splitProductTags(
  input: string | string[] | null | undefined,
  recipientCategories: ProductCategoryOption[],
  occasionCategories: ProductCategoryOption[],
  productCategories: ProductCategoryOption[] = [],
  mainCategory = ''
) {
  const tags = parseProductTags(input)
  const recipientNames = new Set(recipientCategories.map((category) => category.name))
  const occasionNames = new Set(occasionCategories.map((category) => category.name))
  const productNames = new Set(productCategories.map((category) => category.name))

  const recipientSelections = tags.filter((tag) => recipientNames.has(tag))
  const occasionSelections = tags.filter((tag) => occasionNames.has(tag))
  // Extra shop categories ("also show in"); the main category itself is not repeated.
  const extraCategorySelections = tags.filter(
    (tag) => productNames.has(tag) && !recipientNames.has(tag) && !occasionNames.has(tag) && tag !== mainCategory
  )
  const customTags = tags
    .filter((tag) => !recipientNames.has(tag) && !occasionNames.has(tag) && !productNames.has(tag))
    .join(', ')

  return {
    customTags,
    recipientSelections,
    occasionSelections,
    extraCategorySelections,
  }
}

export async function fetchProductCategoryGroups(): Promise<ProductCategoryGroups> {
  const [productResponse, recipientResponse, occasionResponse] = await Promise.all([
    fetch('/api/categories?type=PRODUCT', { cache: 'no-store' }),
    fetch('/api/categories?type=RECIPIENT', { cache: 'no-store' }),
    fetch('/api/categories?type=OCCASION', { cache: 'no-store' }),
  ])

  if (!productResponse.ok || !recipientResponse.ok || !occasionResponse.ok) {
    throw new Error('Failed to load product categories')
  }

  const [productCategories, recipientCategories, occasionCategories] = await Promise.all([
    productResponse.json(),
    recipientResponse.json(),
    occasionResponse.json(),
  ])

  return {
    productCategories: normalizeCategoryOptions(productCategories, 'PRODUCT'),
    recipientCategories: normalizeCategoryOptions(recipientCategories, 'RECIPIENT'),
    occasionCategories: normalizeCategoryOptions(occasionCategories, 'OCCASION'),
  }
}
