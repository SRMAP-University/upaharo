/** Build admin products list path with optional page + search query. */
export function adminProductsListPath(page = 1, search = '') {
  const params = new URLSearchParams()
  const safePage = Math.max(1, page)
  const trimmed = search.trim()
  if (safePage > 1) params.set('page', String(safePage))
  if (trimmed) params.set('search', trimmed)
  const qs = params.toString()
  return qs ? `/admin/products?${qs}` : '/admin/products'
}

/** Read list state from URL search params (edit page return context). */
export function adminProductsListFromSearchParams(searchParams: URLSearchParams) {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const search = searchParams.get('search') ?? ''
  return { page, search, href: adminProductsListPath(page, search) }
}

/** Append return context query string for product edit links. */
export function adminProductEditHref(productId: string, page: number, search: string) {
  const params = new URLSearchParams()
  const safePage = Math.max(1, page)
  const trimmed = search.trim()
  if (safePage > 1) params.set('page', String(safePage))
  if (trimmed) params.set('search', trimmed)
  const qs = params.toString()
  return qs
    ? `/admin/products/${productId}?${qs}`
    : `/admin/products/${productId}`
}
