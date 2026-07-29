export type AdminProductsListFilters = {
  page?: number
  search?: string
  category?: string
  availability?: string
  sort?: string
  archived?: boolean
}

function normalizeFilters(input: AdminProductsListFilters = {}) {
  const page = Math.max(1, Number(input.page) || 1)
  const search = String(input.search || '').trim()
  const category = String(input.category || '').trim()
  const availability = String(input.availability || '').trim()
  const sort = String(input.sort || '').trim()
  const archived = Boolean(input.archived)
  return { page, search, category, availability, sort, archived }
}

/** Build admin products list path with optional filters. */
export function adminProductsListPath(filters: AdminProductsListFilters | number = 1, search = '') {
  const normalized =
    typeof filters === 'number'
      ? normalizeFilters({ page: filters, search })
      : normalizeFilters(filters)

  const params = new URLSearchParams()
  if (normalized.page > 1) params.set('page', String(normalized.page))
  if (normalized.search) params.set('search', normalized.search)
  if (normalized.category && normalized.category !== 'all') params.set('category', normalized.category)
  if (normalized.availability && normalized.availability !== 'all') {
    params.set('availability', normalized.availability)
  }
  if (normalized.sort && normalized.sort !== 'newest') params.set('sort', normalized.sort)
  if (normalized.archived) params.set('archived', '1')

  const qs = params.toString()
  return qs ? `/admin/products?${qs}` : '/admin/products'
}

/** Read list state from URL search params (edit page return context). */
export function adminProductsListFromSearchParams(searchParams: URLSearchParams) {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? ''
  const availability = searchParams.get('availability') ?? 'all'
  const sort = searchParams.get('sort') ?? 'newest'
  const archived = searchParams.get('archived') === '1'
  const filters = { page, search, category, availability, sort, archived }
  return { ...filters, href: adminProductsListPath(filters) }
}

/** Append return context query string for product edit links. */
export function adminProductEditHref(productId: string, filters: AdminProductsListFilters | number, search = '') {
  const normalized =
    typeof filters === 'number'
      ? normalizeFilters({ page: filters, search })
      : normalizeFilters(filters)

  const params = new URLSearchParams()
  if (normalized.page > 1) params.set('page', String(normalized.page))
  if (normalized.search) params.set('search', normalized.search)
  if (normalized.category && normalized.category !== 'all') params.set('category', normalized.category)
  if (normalized.availability && normalized.availability !== 'all') {
    params.set('availability', normalized.availability)
  }
  if (normalized.sort && normalized.sort !== 'newest') params.set('sort', normalized.sort)
  if (normalized.archived) params.set('archived', '1')

  const qs = params.toString()
  return qs ? `/admin/products/${productId}?${qs}` : `/admin/products/${productId}`
}
