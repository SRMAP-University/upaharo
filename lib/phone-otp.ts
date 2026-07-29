import { createHash, randomInt } from 'crypto'

export const PHONE_OTP_TTL_MS = 5 * 60 * 1000
export const PHONE_OTP_RESEND_COOLDOWN_MS = 60 * 1000
export const PHONE_OTP_MAX_ATTEMPTS = 5
export const PHONE_OTP_SIGNUP_TOKEN_TTL = '10m'

export function generatePhoneOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashPhoneOtp(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex')
}

export function normalizePhoneOtpInput(input: unknown): string {
  return String(input ?? '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

export function phoneOtpsMatch(expectedHash: string, provided: unknown): boolean {
  const code = normalizePhoneOtpInput(provided)
  if (code.length !== 6) return false
  return hashPhoneOtp(code) === expectedHash
}

export function otpSmsMessage(code: string, brand = 'Upaharo'): string {
  return `Your ${brand} login code is ${code}. Valid for 5 minutes. Do not share this code.`
}
