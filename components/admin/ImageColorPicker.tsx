'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  imageUrl: string
  value: string
  onChange: (hex: string) => void
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

function softTint(hex: string, amount = 0.55) {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  // Mix toward white for a calm home wash.
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount
  )
}

function extractPalette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  count = 6
): string[] {
  const data = ctx.getImageData(0, 0, width, height).data
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()

  // Sample every Nth pixel for speed.
  const step = Math.max(4, Math.floor((width * height) / 8000))
  for (let i = 0; i < data.length; i += 4 * step) {
    const a = data[i + 3]
    if (a < 180) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // Skip near-white / near-black noise.
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max > 245 && min > 230) continue
    if (max < 25) continue

    const key = `${r >> 4},${g >> 4},${b >> 4}`
    const existing = buckets.get(key)
    if (existing) {
      existing.r += r
      existing.g += g
      existing.b += b
      existing.n += 1
    } else {
      buckets.set(key, { r, g, b, n: 1 })
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((c) => rgbToHex(c.r / c.n, c.g / c.n, c.b / c.n))
}

export default function ImageColorPicker({ imageUrl, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [palette, setPalette] = useState<string[]>([])
  const [hoverHex, setHoverHex] = useState<string | null>(null)
  const [softMode, setSoftMode] = useState(true)

  const proxySrc = useMemo(() => {
    const url = imageUrl.trim()
    if (!url) return ''
    // Same-origin / relative uploads can load directly.
    if (url.startsWith('/')) return url
    return `/api/admin/image-proxy?url=${encodeURIComponent(url)}`
  }, [imageUrl])

  const applyColor = useCallback(
    (hex: string) => {
      onChange(softMode ? softTint(hex) : hex.toUpperCase())
    },
    [onChange, softMode]
  )

  useEffect(() => {
    if (!proxySrc) {
      setReady(false)
      setPalette([])
      setError(null)
      return
    }

    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    setReady(false)
    setError(null)

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const maxW = 520
      const scale = Math.min(1, maxW / img.naturalWidth)
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      try {
        setPalette(extractPalette(ctx, w, h))
        setReady(true)
      } catch {
        setError('Could not read colors from this image (CORS). Try another URL.')
        setReady(false)
      }
    }
    img.onerror = () => {
      if (cancelled) return
      setError('Could not load image for color picking.')
      setReady(false)
      setPalette([])
    }
    img.src = proxySrc

    return () => {
      cancelled = true
    }
  }, [proxySrc])

  const sampleAt = (clientX: number, clientY: number, commit: boolean) => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width)
    const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height)
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
    if (a < 40) return
    const hex = rgbToHex(r, g, b)
    setHoverHex(hex)
    if (commit) applyColor(hex)
  }

  if (!imageUrl.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-wine/20 bg-cream/40 px-4 py-6 text-center text-sm text-ink/50">
        Add an image URL first, then pick a color from the image.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-wine/10 bg-cream/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Pick color from image</p>
          <p className="text-xs text-ink/50">Click anywhere on the image to sample</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-ink/70">
          <input
            type="checkbox"
            checked={softMode}
            onChange={(e) => setSoftMode(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-wine/30 text-wine focus:ring-wine/30"
          />
          Soften for background
        </label>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-wine/10 bg-white">
        <canvas
          ref={canvasRef}
          className={`max-h-56 w-full cursor-crosshair object-contain ${ready ? '' : 'opacity-40'}`}
          style={{ imageRendering: 'auto' }}
          onClick={(e) => sampleAt(e.clientX, e.clientY, true)}
          onMouseMove={(e) => sampleAt(e.clientX, e.clientY, false)}
          onMouseLeave={() => setHoverHex(null)}
        />
        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink/50">
            Loading image…
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {palette.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink/60">Suggested from image</p>
          <div className="flex flex-wrap gap-2">
            {palette.map((hex) => {
              const shown = softMode ? softTint(hex) : hex
              const selected = value.toUpperCase() === shown.toUpperCase()
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => applyColor(hex)}
                  title={shown}
                  className={`h-8 w-8 rounded-full border shadow-sm transition ${
                    selected ? 'ring-2 ring-wine ring-offset-2' : 'border-black/10 hover:scale-105'
                  }`}
                  style={{ backgroundColor: shown }}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-ink/60">
        <span
          className="inline-block h-4 w-4 rounded border border-black/10"
          style={{ backgroundColor: hoverHex ? (softMode ? softTint(hoverHex) : hoverHex) : value }}
        />
        {hoverHex
          ? `Hover: ${softMode ? softTint(hoverHex) : hoverHex}`
          : `Selected: ${value || '—'}`}
      </div>
    </div>
  )
}
