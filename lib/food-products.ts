/**
 * Whether a product is something you eat or drink, so the veg / non-veg
 * badge makes sense for it. Decided by its category (Cakes, Bakery, Snacks,
 * Tea & Coffee, …) or, for mixed categories such as "Father Day", by its name
 * (a cake or a chocolate hamper yes, a wallet or a bouquet no).
 */

const FOOD_CATEGORY =
  /cake|bakery|pastr|cookie|biscuit|chocolate|sweet|mithai|dessert|snack|food|dry\s*fruit|fruit|masala|spice|tea\b|coffee|beverage|drink|juice|rice|dal\b|pulse|atta|maida|suji|flour|oil|ghee|noodle|pasta|dairy|milk|ketchup|spread|jam\b|sugar|salt|pickle|energy|frozen|grocery|meat|chicken|egg|ice\s*cream|honey|cereal/i

const FOOD_NAME =
  /\bcakes?\b|cupcake|cheesecake|brownie|pastr(?:y|ies)|cookie|biscuit|chocolate|truffle|\bsweets?\b|mithai|lad(?:d|o)o|laddu|barfi|burfi|rasgulla|\bpeda\b|kaju|dry\s*fruits?|almond|cashew|pistachio|raisin|\bdates\b|\bhoney\b|\btea\b|coffee|juice|snack|namkeen|bhujia|cereal|muffin|donut|doughnut|pizza|burger|momo|biryani|bread|\bpie\b|\btart\b|candy|toffee|gumm(?:y|ies)|ice\s*cream|fruit\s*basket|sel\s*roti|thekua/i

// Things named after food that aren't eaten: cake toppers, "detergent cake", almond hair oil…
const NOT_FOOD_NAME =
  /topper|candles?\b|tea\s*lights?|knife|server|cutter|cutting|balloon|\bstand\b|\bcups?\b|\bplates?\b|\btray|mou?ld|decorat|theme\s*set|detergent|soap|shampoo|hair\s*oil|lotion|agarbatti|incense|dhoop|perfume|scented/i

export function isFoodProduct(product: { category?: string | null; name?: string | null; tags?: string[] | null }) {
  if (product.category && FOOD_CATEGORY.test(product.category)) return true
  if (!product.name || NOT_FOOD_NAME.test(product.name)) return false
  return FOOD_NAME.test(product.name)
}

/** The badge setting to save: only food products may show it. */
export function allowedFoodTypeLabel(
  wanted: unknown,
  product: { category?: string | null; name?: string | null }
) {
  return wanted === true && isFoodProduct(product)
}
