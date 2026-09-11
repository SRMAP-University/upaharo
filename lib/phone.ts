/** Normalize Nepal mobile numbers to 10 digits (98… / 97…). */
export function normalizeNepalPhone(input: unknown): string | null {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (!digits) return null

  let phone = digits
  if (phone.startsWith('977') && phone.length >= 13) {
    phone = phone.slice(3)
  }
  if (phone.startsWith('0') && phone.length === 11) {
    phone = phone.slice(1)
  }

  if (phone.length !== 10) return null
  if (!/^(98|97)\d{8}$/.test(phone)) return null
  return phone
}

export function isValidNepalPhone(input: unknown): boolean {
  return normalizeNepalPhone(input) !== null
}

/**
 * Partner-app login numbers: Nepal 97/98, or any other 10-digit mobile (6–9…).
 * Strips +91 / 91 and leading 0 so Indian admin numbers can sign in.
 */
export function normalizePartnerPhone(input: unknown): string | null {
  const nepal = normalizeNepalPhone(input)
  if (nepal) return nepal

  const digits = String(input ?? '').replace(/\D/g, '')
  if (!digits) return null

  let phone = digits
  if (phone.startsWith('91') && phone.length === 12) {
    phone = phone.slice(2)
  }
  if (phone.startsWith('977') && phone.length >= 13) {
    phone = phone.slice(3)
  }
  if (phone.startsWith('0') && phone.length === 11) {
    phone = phone.slice(1)
  }
  if (phone.length === 10 && /^[6-9]\d{9}$/.test(phone)) {
    return phone
  }
  return null
}
