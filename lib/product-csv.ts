/** CSV helpers for admin product import/export. */

export const PRODUCT_CSV_COLUMNS = [
  'name',
  'category',
  'price',
  'wholesalePrice',
  'image',
  'sku',
  'stockQty',
  'unit',
  'unitValue',
  'aisle',
  'isAvailable',
  'discount',
  'miniDescription',
  'description',
] as const

export type ProductCsvColumn = (typeof PRODUCT_CSV_COLUMNS)[number]

export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function rowToCsvLine(values: unknown[]): string {
  return values.map(escapeCsvCell).join(',')
}

/** Parse a CSV string into header + rows (supports quoted fields). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let inQuotes = false

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    // Skip completely empty trailing lines
    if (row.length === 1 && row[0] === '' && rows.length > 0) {
      row = []
      return
    }
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      pushCell()
    } else if (ch === '\n') {
      pushCell()
      pushRow()
    } else if (ch === '\r') {
      // ignore; handle \r\n via \n
    } else {
      cell += ch
    }
  }

  if (cell.length > 0 || row.length > 0) {
    pushCell()
    pushRow()
  }

  if (!rows.length) return { headers: [], rows: [] }

  const headers = rows[0].map((h) => h.trim())
  return { headers, rows: rows.slice(1) }
}

export function csvRowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? '').trim()
      })
      return obj
    })
}

function parseBool(value: string, fallback = true): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return fallback
  if (['1', 'true', 'yes', 'y'].includes(v)) return true
  if (['0', 'false', 'no', 'n'].includes(v)) return false
  return fallback
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export type NormalizedImportRow = {
  name: string
  category: string
  price: number
  wholesalePrice: number | null
  image: string
  sku: string | null
  stockQty: number | null
  trackStock: boolean
  unit: string | null
  unitValue: number | null
  aisle: string | null
  isAvailable: boolean
  discount: number
  miniDescription: string
  description: string
}

/** Map a native export-format row into import fields. */
export function mapNativeCsvRow(row: Record<string, string>): { ok: true; data: NormalizedImportRow } | { ok: false; error: string } {
  const name = (row.name || '').trim()
  if (!name) return { ok: false, error: 'name is required' }

  const category = (row.category || '').trim()
  if (!category) return { ok: false, error: 'category is required' }

  const price = Number(row.price)
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'invalid price' }

  const wholesaleRaw = parseOptionalNumber(row.wholesalePrice || '')
  const stockRaw = parseOptionalNumber(row.stockQty || '')
  const unitValueRaw = parseOptionalNumber(row.unitValue || '')
  const discountRaw = parseOptionalNumber(row.discount || '')
  const sku = (row.sku || '').trim() || null
  const unit = (row.unit || '').trim().toLowerCase() || null
  const aisle = (row.aisle || '').trim() || null
  const image = (row.image || '').trim() || '/images/gift-box.svg'

  return {
    ok: true,
    data: {
      name: name.slice(0, 200),
      category,
      price,
      wholesalePrice: wholesaleRaw != null && wholesaleRaw >= 0 ? wholesaleRaw : null,
      image,
      sku: sku ? sku.slice(0, 64) : null,
      stockQty: stockRaw != null && stockRaw >= 0 ? Math.round(stockRaw) : null,
      trackStock: stockRaw != null && stockRaw >= 0,
      unit,
      unitValue: unitValueRaw != null && unitValueRaw > 0 ? unitValueRaw : null,
      aisle: aisle ? aisle.slice(0, 64) : null,
      isAvailable: parseBool(row.isAvailable || '', true),
      discount: discountRaw != null && discountRaw >= 0 ? Math.min(100, discountRaw) : 0,
      miniDescription: (row.miniDescription || '').trim().slice(0, 500),
      description: (row.description || '').trim(),
    },
  }
}

/** Map a Rasanmart CSV row into import fields. */
export function mapRasanmartCsvRow(row: Record<string, string>): { ok: true; data: NormalizedImportRow } | { ok: false; error: string } {
  const name = (row.name || '').trim()
  if (!name) return { ok: false, error: 'name is required' }

  const category = (row.category_name || row.category || '').trim()
  if (!category) return { ok: false, error: 'category_name is required' }

  const price = Number(row.price)
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'invalid price' }

  const original = parseOptionalNumber(row.original_price || '')
  let discount = 0
  if (original != null && original > price) {
    discount = Math.round(((original - price) / original) * 100)
  }

  const image = (row.image_url || row.image || '').trim() || '/images/gift-box.svg'
  const sku = (row.id || row.sku || '').trim() || null
  const inStock = parseBool(row.in_stock || 'True', true)

  return {
    ok: true,
    data: {
      name: name.slice(0, 200),
      category,
      price,
      wholesalePrice: null,
      image,
      sku: sku ? `rm-${sku}`.slice(0, 64) : null,
      stockQty: null,
      trackStock: false,
      unit: null,
      unitValue: null,
      aisle: null,
      isAvailable: inStock,
      discount,
      miniDescription: '',
      description: '',
    },
  }
}
