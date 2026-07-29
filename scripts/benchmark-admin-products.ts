import { findManyProductsCompat } from '../lib/product-db'
import { ARCHIVED_PRODUCT_TAG } from '../lib/product-archive'

async function main() {
  const started = Date.now()
  const products = await findManyProductsCompat({
    where: {
      storeId: 'store_grocery',
      NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const json = JSON.stringify({ products })
  console.log({
    count: products.length,
    ms: Date.now() - started,
    bytes: json.length,
    mb: (json.length / 1024 / 1024).toFixed(2),
  })
}

main()
