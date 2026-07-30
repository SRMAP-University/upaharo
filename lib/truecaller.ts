/**
 * Truecaller OAuth (PKCE) helpers — exchange authorization code for profile.
 * Token endpoint does not require client_secret when using code_verifier.
 */

const TRUECALLER_TOKEN_URL =
  'https://oauth-account-noneu.truecaller.com/v1/token'
const TRUECALLER_USERINFO_URL =
  'https://oauth-account-noneu.truecaller.com/v1/userinfo'

/** Sandbox Client ID from Truecaller console (override with TRUECALLER_CLIENT_ID). */
export const TRUECALLER_SANDBOX_CLIENT_ID =
  'rlhxfbctueeryexcclhw7wnpikukvkbcnnqdbzjt0py'

export function getTruecallerClientId(): string {
  return (
    process.env.TRUECALLER_CLIENT_ID?.trim() || TRUECALLER_SANDBOX_CLIENT_ID
  )
}

export type TruecallerUserInfo = {
  sub?: string
  given_name?: string
  family_name?: string
  phone_number?: string
  email?: string
  picture?: string
  phone_number_verified?: boolean
}

export async function exchangeTruecallerCode(params: {
  authorizationCode: string
  codeVerifier: string
  clientId?: string
}): Promise<{ accessToken: string }> {
  const clientId = params.clientId || getTruecallerClientId()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: params.authorizationCode,
    code_verifier: params.codeVerifier,
  })

  const res = await fetch(TRUECALLER_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !json.access_token) {
    const detail =
      json.error_description || json.error || `HTTP ${res.status}`
    throw new Error(`Truecaller token exchange failed: ${detail}`)
  }

  return { accessToken: json.access_token }
}

export async function fetchTruecallerUserInfo(
  accessToken: string
): Promise<TruecallerUserInfo> {
  const res = await fetch(TRUECALLER_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const json = (await res.json().catch(() => ({}))) as TruecallerUserInfo & {
    error?: string
  }

  if (!res.ok) {
    throw new Error(
      `Truecaller userinfo failed: ${json.error || `HTTP ${res.status}`}`
    )
  }

  return json
}

export function truecallerDisplayName(info: TruecallerUserInfo): string | null {
  const given = (info.given_name || '').trim()
  const family = (info.family_name || '').trim()
  const name = [given, family].filter(Boolean).join(' ').trim()
  return name || null
}
