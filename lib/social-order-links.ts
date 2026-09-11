export type SocialOrderProduct = {
  id: string
  name: string
  price: number
}

export function whatsAppDigits(phone: string): string | null {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('91') && digits.length >= 12) return digits
  if (digits.startsWith('977') && digits.length >= 12) return digits
  if (digits.length === 10 && /^(97|98)\d{8}$/.test(digits)) return `977${digits}`
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return `91${digits}`
  return digits
}

export function normalizeInstagramHandle(input: string): string | null {
  let handle = String(input || '').trim()
  if (!handle) return null
  handle = handle.replace(/^@/, '')
  const fromUrl =
    handle.match(/instagram\.com\/([A-Za-z0-9._]+)/i) ||
    handle.match(/ig\.me\/m\/([A-Za-z0-9._]+)/i)
  if (fromUrl) handle = fromUrl[1]
  handle = handle.replace(/[/?#].*$/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null
  return handle
}

export function whatsAppOrderUrl(
  phone: string,
  product: SocialOrderProduct,
  quantity = 1
): string | null {
  const digits = whatsAppDigits(phone)
  if (!digits) return null
  const qty = Math.max(1, Math.round(quantity))
  const text = [
    "Hi, I'd like to order:",
    `${product.name} x${qty} — Rs. ${Math.round(product.price * qty)}`,
    `https://www.upaharo.com/products/${product.id}`,
  ].join('\n')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function instagramOrderUrl(instagram: string): string | null {
  const handle = normalizeInstagramHandle(instagram)
  if (!handle) return null
  return `https://ig.me/m/${handle}`
}
