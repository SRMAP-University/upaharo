type SendEmailParams = {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

type SellerAccountTemplateParams = {
  sellerName: string
  businessName: string
  email: string
  password: string
}

type AdminNewSellerTemplateParams = {
  businessName: string
  sellerName: string
  email: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Email for the website (seller accounts, admin notices, test emails).
 * Sends through Brevo: its HTTP API when BREVO_API_KEY is set, otherwise SMTP
 * (Brevo's relay is smtp-relay.brevo.com:587 with your Brevo login and SMTP
 * key as SMTP_USER / SMTP_PASSWORD). The sender address must be a sender or
 * domain verified in Brevo.
 */

function sender() {
  return {
    name: process.env.BREVO_SENDER_NAME || process.env.SMTP_FROM_NAME || 'Upaharo',
    email: process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM_EMAIL || 'no-reply@upaharo.com',
  }
}

function buildFromAddress(): string {
  const { name, email } = sender()
  return `"${name}" <${email}>`
}

async function importOptional(moduleName: string): Promise<any | null> {
  try {
    const importer = new Function('moduleName', 'return import(moduleName)') as (
      m: string
    ) => Promise<any>
    return await importer(moduleName)
  } catch {
    return null
  }
}

export type EmailResult = {
  ok: boolean
  /** How it was sent (or tried): Brevo's API, SMTP, or not at all. */
  via: 'brevo-api' | 'smtp' | 'none'
  /** Why it failed, in the mail service's own words where possible. */
  error?: string
}

/** Which way email would go now, without sending anything (for the admin test card). */
export function emailSetup() {
  const viaApi = Boolean(process.env.BREVO_API_KEY)
  const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  return {
    via: viaApi ? 'brevo-api' : smtpReady ? 'smtp' : 'none',
    sender: sender().email,
    smtpHost: process.env.SMTP_HOST || null,
  } as const
}

async function sendWithBrevoApi(params: SendEmailParams, text: string): Promise<EmailResult> {
  const to = (Array.isArray(params.to) ? params.to : [params.to]).map((email) => ({ email }))
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': String(process.env.BREVO_API_KEY),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ sender: sender(), to, subject: params.subject, htmlContent: params.html, textContent: text }),
    })
    if (res.ok) return { ok: true, via: 'brevo-api' }
    const body = await res.json().catch(() => null)
    const error = `Brevo said ${res.status}: ${body?.message || body?.code || res.statusText}`
    console.error('[email] Brevo API send failed:', error)
    return { ok: false, via: 'brevo-api', error }
  } catch (error) {
    console.error('[email] Brevo API unreachable:', error)
    return { ok: false, via: 'brevo-api', error: `Could not reach Brevo: ${(error as Error).message}` }
  }
}

async function sendWithSmtp(params: SendEmailParams, text: string): Promise<EmailResult> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !user || !pass) {
    console.warn('[email] No BREVO_API_KEY and SMTP settings are missing. Skipping email send.', { subject: params.subject })
    return {
      ok: false,
      via: 'none',
      error: 'Email is not set up: add BREVO_API_KEY (or SMTP_HOST, SMTP_USER and SMTP_PASSWORD) to the server settings.',
    }
  }

  const nodemailerModule = await importOptional('nodemailer')
  const nodemailer = nodemailerModule?.default || nodemailerModule
  if (!nodemailer?.createTransport) {
    console.warn('[email] nodemailer is not installed. Skipping email send.', { subject: params.subject })
    return { ok: false, via: 'smtp', error: 'The mail library (nodemailer) is not installed on the server.' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
    await transporter.sendMail({
      from: buildFromAddress(),
      to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
      subject: params.subject,
      html: params.html,
      text,
    })
    return { ok: true, via: 'smtp' }
  } catch (error) {
    console.error('[email] Failed to send email:', error)
    const e = error as { message?: string; response?: string }
    return { ok: false, via: 'smtp', error: `SMTP said: ${e.response || e.message || 'unknown error'}` }
  }
}

/** Send an email and say exactly what happened. */
export async function sendEmailWithResult(params: SendEmailParams): Promise<EmailResult> {
  const text = params.text || stripHtml(params.html)
  return process.env.BREVO_API_KEY ? sendWithBrevoApi(params, text) : sendWithSmtp(params, text)
}

/** Send an email; true when it went. */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  return (await sendEmailWithResult(params)).ok
}

export const emailTemplates = {
  sellerAccountCreated({
    sellerName,
    businessName,
    email,
    password,
  }: SellerAccountTemplateParams): string {
    const safeSellerName = escapeHtml(sellerName)
    const safeBusinessName = escapeHtml(businessName)
    const safeEmail = escapeHtml(email)
    const safePassword = escapeHtml(password)

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>Welcome to Upaharo Seller Platform</h2>
        <p>Hello ${safeSellerName},</p>
        <p>Your seller account has been created for <strong>${safeBusinessName}</strong>.</p>
        <p>You can log in with the credentials below:</p>
        <ul>
          <li><strong>Email:</strong> ${safeEmail}</li>
          <li><strong>Password:</strong> ${safePassword}</li>
        </ul>
        <p>Please change your password after first login.</p>
      </div>
    `
  },

  adminNewSeller({
    businessName,
    sellerName,
    email,
  }: AdminNewSellerTemplateParams): string {
    const safeBusinessName = escapeHtml(businessName)
    const safeSellerName = escapeHtml(sellerName)
    const safeEmail = escapeHtml(email)

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>New Seller Account Created</h2>
        <p>A new seller has been added to the platform.</p>
        <ul>
          <li><strong>Business:</strong> ${safeBusinessName}</li>
          <li><strong>Seller:</strong> ${safeSellerName}</li>
          <li><strong>Email:</strong> ${safeEmail}</li>
        </ul>
      </div>
    `
  },
}

