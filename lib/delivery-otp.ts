import { randomInt } from 'crypto'

/** 4-digit OTP — easy to read aloud when the customer confirms delivery. */
export function generateDeliveryOtp(): string {
  return String(randomInt(0, 10000)).padStart(4, '0')
}

export function normalizeDeliveryOtp(input: unknown): string {
  return String(input ?? '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

export function deliveryOtpsMatch(expected: string | null | undefined, provided: unknown): boolean {
  if (!expected) return false
  const a = normalizeDeliveryOtp(expected)
  const b = normalizeDeliveryOtp(provided)
  return a.length >= 4 && a === b
}
