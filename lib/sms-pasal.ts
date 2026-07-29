/**
 * SMS Pasal HTTP API client.
 * Docs shape: GET /smsapi/index?key=&contacts=&senderid=&msg=&responsetype=json
 */

const DEFAULT_URL = 'https://sms.smspasal.com/smsapi/index'
const DEFAULT_SENDER = 'SMSBit'

export class SmsPasalError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'SmsPasalError'
  }
}

function getConfig() {
  const apiKey = process.env.SMS_PASAL_API_KEY?.trim()
  const apiUrl = (process.env.SMS_PASAL_API_URL || DEFAULT_URL).trim()
  const senderId = (process.env.SMS_PASAL_SENDER_ID || DEFAULT_SENDER).trim()

  if (!apiKey) {
    throw new SmsPasalError('SMS_PASAL_API_KEY is not configured')
  }

  return { apiKey, apiUrl, senderId }
}

export async function sendSms(params: {
  to: string
  message: string
}): Promise<void> {
  const { apiKey, apiUrl, senderId } = getConfig()
  const contacts = params.to.replace(/\D/g, '')
  const url = new URL(apiUrl)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('contacts', contacts)
  url.searchParams.set('senderid', senderId)
  url.searchParams.set('msg', params.message)
  url.searchParams.set('responsetype', 'json')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    throw new SmsPasalError(`SMS Pasal HTTP ${response.status}`, data)
  }

  // Providers vary: treat explicit failure flags as errors when present.
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const status = String(record.status ?? record.Status ?? record.response ?? '').toLowerCase()
    if (
      status === 'error' ||
      status === 'failed' ||
      status === 'fail' ||
      record.error ||
      record.Error
    ) {
      const message = String(
        record.message ?? record.Message ?? record.error ?? 'SMS send failed'
      )
      throw new SmsPasalError(message, data)
    }
  }
}
