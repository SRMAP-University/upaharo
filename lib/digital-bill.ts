import { createHmac, timingSafeEqual } from 'crypto'

function billSecret() {
  return (
    process.env.BILL_VIEW_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'upaharo-digital-bill'
  )
}

function billHmacHex(orderNumber: string): string {
  return createHmac('sha256', billSecret())
    .update(`bill:v1:${String(orderNumber).trim()}`)
    .digest('hex')
}

/** Short HMAC so QR codes stay small on 58mm printers. */
export function billAccessKey(orderNumber: string): string {
  return billHmacHex(orderNumber).slice(0, 8)
}

export function verifyBillAccessKey(
  orderNumber: string,
  key: string | null | undefined
): boolean {
  const provided = String(key || '').trim().toLowerCase()
  if (!/^[a-f0-9]{8}$|^[a-f0-9]{12}$/.test(provided)) return false
  const hex = billHmacHex(orderNumber).toLowerCase()
  const expected = hex.slice(0, provided.length)
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

export function appOrigin(fallback = 'https://www.upaharo.com'): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    fallback
  return String(raw).replace(/\/$/, '')
}

export function digitalBillUrl(orderNumber: string, origin?: string): string {
  const base = (origin || appOrigin()).replace(/\/$/, '')
  // Compact path keeps QR version low on 58mm thermal printers.
  const n = encodeURIComponent(String(orderNumber).trim())
  const k = billAccessKey(orderNumber)
  return `${base}/b/${n}/${k}`
}
