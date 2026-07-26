import type { Config } from '@netlify/functions'

/**
 * Netlify Scheduled Function — replaces Vercel Cron for birthday/anniversary reminders.
 * Invokes the Next.js route handler with the shared CRON_SECRET.
 */
export default async () => {
  const baseUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
  if (!baseUrl) {
    console.error('reminders-cron: URL env is missing')
    return
  }

  const secret = process.env.CRON_SECRET
  const headers: Record<string, string> = {}
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  const response = await fetch(`${baseUrl}/api/cron/reminders`, { headers })
  const body = await response.text()
  console.log(`reminders-cron: ${response.status} ${body.slice(0, 500)}`)
}

export const config: Config = {
  schedule: '0 3 * * *',
}
