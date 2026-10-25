#!/usr/bin/env node
/**
 * Upload and promote Android releases on Google Play via the Play Developer API.
 *
 *   node scripts/play-release.mjs status
 *   node scripts/play-release.mjs upload --aab <file.aab> [--track internal] [--notes "…"] [--dry-run]
 *   node scripts/play-release.mjs promote --version-code 10 --to production --yes-production [--rollout 0.2]
 *
 * Key: a service-account JSON with access to the app in Play Console. Looked up
 * in $PLAY_SERVICE_ACCOUNT_JSON, else `.secrets/play-service-account.json` in
 * this folder or any parent (so it works from git worktrees). Never commit it.
 *
 * Anything that would change the production track needs --yes-production.
 * --dry-run validates the whole edit with Google, then throws it away.
 */
import { existsSync, readFileSync, statSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { GoogleAuth } from 'google-auth-library'

const DEFAULT_PACKAGE = 'com.upaharo.upaharo_mobile'
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications'
const TRACKS = ['internal', 'alpha', 'beta', 'production']

function usage(message) {
  if (message) console.error(`\n✗ ${message}\n`)
  console.log(`Usage:
  node scripts/play-release.mjs status [--package ${DEFAULT_PACKAGE}]
  node scripts/play-release.mjs upload --aab <file.aab> [--track internal|alpha|beta|production]
        [--notes "What's new" | --notes-file notes.txt] [--name "1.0.0 (10)"]
        [--status completed|draft] [--rollout 0.1] [--dry-run] [--yes-production]
  node scripts/play-release.mjs promote --version-code <n> --to <track> [--from internal]
        [--rollout 0.1] [--notes "…"] [--dry-run] [--yes-production]`)
  process.exit(message ? 1 : 0)
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const flags = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('--')) usage(`Unexpected argument: ${arg}`)
    const key = arg.slice(2)
    const next = rest[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true
    } else {
      flags[key] = next
      i++
    }
  }
  return { command, flags }
}

function findKeyFile() {
  if (process.env.PLAY_SERVICE_ACCOUNT_JSON) return resolve(process.env.PLAY_SERVICE_ACCOUNT_JSON)
  let dir = process.cwd()
  for (;;) {
    const candidate = join(dir, '.secrets', 'play-service-account.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

async function accessToken() {
  const keyFile = findKeyFile()
  if (!keyFile) {
    throw new Error(
      'No service-account key found. Save it as .secrets/play-service-account.json in the repo root ' +
        '(or set PLAY_SERVICE_ACCOUNT_JSON).'
    )
  }
  const auth = new GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/androidpublisher'] })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Could not get an access token from the service account.')
  return token
}

async function api(token, method, url, body, contentType = 'application/json') {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': contentType } : {}) },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const reason = data?.error?.message || text || res.statusText
    throw new Error(`${method} ${url.replace(/\?.*/, '')} → ${res.status}: ${reason}`)
  }
  return data
}

/** Runs `work` inside a Play "edit"; commits it unless dry-run (then validates and discards). */
async function withEdit(token, pkg, dryRun, work) {
  const base = `${API}/${encodeURIComponent(pkg)}/edits`
  const edit = await api(token, 'POST', base, {})
  const editUrl = `${base}/${edit.id}`
  try {
    const result = await work(editUrl, edit.id)
    if (dryRun) {
      await api(token, 'POST', `${editUrl}:validate`)
      console.log('✓ Google validated the release. Dry run: nothing was published.')
      await api(token, 'DELETE', editUrl).catch(() => {})
    } else {
      await api(token, 'POST', `${editUrl}:commit`)
      console.log('✓ Committed to Google Play.')
    }
    return result
  } catch (error) {
    await api(token, 'DELETE', editUrl).catch(() => {})
    throw error
  }
}

function releaseNotes(flags) {
  const text = flags['notes-file'] ? readFileSync(String(flags['notes-file']), 'utf8') : flags.notes
  if (!text || text === true) return undefined
  return [{ language: String(flags.language || 'en-US'), text: String(text).trim().slice(0, 500) }]
}

function rollout(flags) {
  if (flags.rollout === undefined) return undefined
  const fraction = Number(flags.rollout)
  if (!(fraction > 0 && fraction < 1)) usage('--rollout must be between 0 and 1 (e.g. 0.2 for 20%)')
  return fraction
}

function guardProduction(track, flags) {
  if (track === 'production' && !flags['yes-production'] && !flags['dry-run']) {
    usage('Changing the production track needs --yes-production (or try it first with --dry-run).')
  }
}

function describeTracks(tracks) {
  for (const track of tracks ?? []) {
    console.log(`\n${track.track}`)
    const releases = track.releases ?? []
    if (releases.length === 0) console.log('  (no releases)')
    for (const r of releases) {
      const pct = r.userFraction ? ` ${Math.round(r.userFraction * 100)}%` : ''
      console.log(`  ${r.status}${pct}  versionCodes ${(r.versionCodes ?? []).join(', ') || '–'}  ${r.name ?? ''}`)
    }
  }
}

/** Read-only: opens an edit, lists the tracks, throws the edit away. */
async function status(getToken, pkg) {
  const token = await getToken()
  const base = `${API}/${encodeURIComponent(pkg)}/edits`
  const edit = await api(token, 'POST', base, {})
  try {
    const { tracks } = await api(token, 'GET', `${base}/${edit.id}/tracks`)
    console.log(`✓ Connected. Play tracks for ${pkg}:`)
    describeTracks(tracks)
  } finally {
    await api(token, 'DELETE', `${base}/${edit.id}`).catch(() => {})
  }
}

async function upload(getToken, pkg, flags) {
  const aab = flags.aab && flags.aab !== true ? resolve(String(flags.aab)) : null
  if (!aab || !existsSync(aab) || !aab.toLowerCase().endsWith('.aab')) {
    usage('--aab <path to .aab> is required and must exist')
  }
  const track = String(flags.track || 'internal')
  if (!track || track === 'true') usage(`--track needs a name (${TRACKS.join(', ')} or a custom testing track)`)
  guardProduction(track, flags)
  const dryRun = Boolean(flags['dry-run'])
  const fraction = rollout(flags)
  const sizeMb = (statSync(aab).size / 1048576).toFixed(1)
  const token = await getToken()

  await withEdit(token, pkg, dryRun, async (editUrl) => {
    const editPath = editUrl.replace(API, UPLOAD_API)
    console.log(`Uploading ${aab} (${sizeMb} MB)…`)
    const bundle = await api(
      token,
      'POST',
      `${editPath}/bundles?uploadType=media`,
      readFileSync(aab),
      'application/octet-stream'
    )
    console.log(`✓ Uploaded versionCode ${bundle.versionCode}`)

    const release = {
      name: flags.name && flags.name !== true ? String(flags.name) : undefined,
      versionCodes: [String(bundle.versionCode)],
      status: fraction ? 'inProgress' : String(flags.status || 'completed'),
      ...(fraction ? { userFraction: fraction } : {}),
      releaseNotes: releaseNotes(flags),
    }
    await api(token, 'PUT', `${editUrl}/tracks/${track}`, { track, releases: [release] })
    console.log(`✓ ${dryRun ? 'Would release' : 'Released'} versionCode ${bundle.versionCode} to ${track}` +
      (fraction ? ` at ${Math.round(fraction * 100)}%` : ''))
  })
}

async function promote(getToken, pkg, flags) {
  const versionCode = flags['version-code'] && flags['version-code'] !== true ? String(flags['version-code']) : null
  const to = String(flags.to || '')
  const from = String(flags.from || 'internal')
  if (!versionCode) usage('--version-code <n> is required')
  if (!to || to === 'true') usage(`--to needs a track (${TRACKS.join(', ')} or a custom testing track)`)
  guardProduction(to, flags)
  const dryRun = Boolean(flags['dry-run'])
  const fraction = rollout(flags)
  const token = await getToken()

  await withEdit(token, pkg, dryRun, async (editUrl) => {
    const source = await api(token, 'GET', `${editUrl}/tracks/${from}`)
    const sourceRelease = (source.releases ?? []).find((r) => (r.versionCodes ?? []).includes(versionCode))
    if (!sourceRelease) throw new Error(`versionCode ${versionCode} is not on the ${from} track`)

    const release = {
      name: sourceRelease.name,
      versionCodes: [versionCode],
      status: fraction ? 'inProgress' : 'completed',
      ...(fraction ? { userFraction: fraction } : {}),
      releaseNotes: releaseNotes(flags) ?? sourceRelease.releaseNotes,
    }
    await api(token, 'PUT', `${editUrl}/tracks/${to}`, { track: to, releases: [release] })
    console.log(`✓ ${dryRun ? 'Would promote' : 'Promoted'} versionCode ${versionCode} from ${from} to ${to}` +
      (fraction ? ` at ${Math.round(fraction * 100)}%` : ''))
  })
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2))
  if (!command || command === 'help' || flags.help) usage()
  const pkg = String(flags.package || DEFAULT_PACKAGE)
  const commands = { status, upload, promote }
  if (!commands[command]) usage(`Unknown command: ${command}`)
  // Arguments are checked before the key is touched.
  await commands[command](accessToken, pkg, flags)
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`)
  process.exit(1)
})
