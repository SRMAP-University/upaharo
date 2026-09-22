export function isVideoMediaUrl(rawUrl: string): boolean {
  let value = String(rawUrl || '').trim().toLowerCase()
  try {
    value = decodeURIComponent(value)
  } catch {
    // Keep the raw URL when it is not valid encoding.
  }
  const path = value.split('#')[0]
  return /\.(mp4|webm|mov)(?:$|[?#])/.test(path)
}

export function resolveImageUrl(rawUrl: string): string {
  const url = String(rawUrl || '').trim()
  if (!url) return ''
  if (url.startsWith('/api/uploads?key=')) return url

  try {
    const parsed = new URL(url)
    if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) {
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const key = parts.slice(1).join('/')
        return `/api/uploads?key=${encodeURIComponent(key)}`
      }
    }
  } catch {
    return url
  }

  return url
}
