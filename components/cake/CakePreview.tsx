'use client'

import { useId, type ReactNode } from 'react'
import type { CakeAddonVisual, CakeToppingVisual, CakeVisual } from '@/lib/cake-builder'

/**
 * Draws the customer's cake from their picks: size sets the width and height
 * (two tiers above 2 lb), flavour the frosting, sponge and drip colours,
 * toppings and add-ons sit on top, and the message is piped on the cake.
 */

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'F6E7D7'
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(toward)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const darken = (hex: string, amount: number) => mix(hex, '#000000', amount)
const lighten = (hex: string, amount: number) => mix(hex, '#FFFFFF', amount)

/** Same numbers every render, so the toppings don't jump around. */
function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const DEFAULT_FLAVOUR = { frosting: '#FFF1E2', sponge: '#EBC99A', drip: '' }

type Point = { x: number; y: number; scale: number }

function ringPoints(cx: number, cy: number, rx: number, ry: number, count: number, radius: number, offset = 0): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = offset + (i / count) * Math.PI * 2
    const y = cy + Math.sin(angle) * ry * radius
    // Things at the front of the cake look a touch bigger.
    const scale = 0.85 + 0.25 * ((Math.sin(angle) + 1) / 2)
    return { x: cx + Math.cos(angle) * rx * radius, y, scale }
  }).sort((a, b) => a.y - b.y)
}

export function Topping({ kind, x, y, s, i }: { kind: CakeToppingVisual; x: number; y: number; s: number; i: number }) {
  const t = `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`
  switch (kind) {
    case 'fruits':
      return i % 3 === 2 ? (
        <g transform={t}>
          <circle r={6} cy={-4} fill="#2F3C7E" />
          <circle r={2} cx={-2} cy={-6} fill="#6F7BC2" />
        </g>
      ) : (
        <g transform={t}>
          <path d="M0 2 C-9 -4 -8 -14 0 -13 C8 -14 9 -4 0 2Z" fill={i % 3 === 0 ? '#D7263D' : '#E63946'} />
          <path d="M-5 -13 L0 -17 L5 -13 L0 -11Z" fill="#3A8A3A" />
          <circle r={0.8} cx={-3} cy={-7} fill="#FFE28A" />
          <circle r={0.8} cx={2} cy={-5} fill="#FFE28A" />
          <circle r={0.8} cx={3} cy={-10} fill="#FFE28A" />
        </g>
      )
    case 'cherries':
      return (
        <g transform={t}>
          <path d="M0 -8 C1 -16 5 -19 8 -21" stroke="#4E7A27" strokeWidth={1.4} fill="none" />
          <circle r={7} cy={-4} fill="#B5172B" />
          <circle r={2.2} cx={-2.5} cy={-7} fill="#F26B7A" />
        </g>
      )
    case 'chips':
      return (
        <g transform={t}>
          <path d="M-4 0 Q0 -10 4 0 Q0 3 -4 0Z" fill="#3A1F14" />
          <path d="M5 2 Q9 -6 13 2 Q9 5 5 2Z" fill="#4B2A1B" />
        </g>
      )
    case 'cookies':
      return (
        <g transform={t}>
          <ellipse rx={10} ry={6} cy={-4} fill="#C98A4B" />
          <ellipse rx={10} ry={6} cy={-6} fill="#DDA15E" />
          <circle r={1.3} cx={-4} cy={-7} fill="#4B2A1B" />
          <circle r={1.3} cx={3} cy={-5} fill="#4B2A1B" />
          <circle r={1.1} cx={1} cy={-9} fill="#4B2A1B" />
        </g>
      )
    case 'kitkat':
      return (
        <g transform={`${t} rotate(${i % 2 ? 8 : -8})`}>
          <rect x={-7} y={-22} width={6} height={22} rx={1.5} fill="#7B3F22" />
          <rect x={1} y={-20} width={6} height={20} rx={1.5} fill="#6A361D" />
          <rect x={-6} y={-21} width={2} height={20} fill="#9A5530" opacity={0.6} />
        </g>
      )
    case 'whipped':
      return (
        <g transform={t}>
          <ellipse rx={9} ry={5} cy={-2} fill="#FFFFFF" />
          <ellipse rx={6.5} ry={4.5} cy={-7} fill="#FFFDF8" />
          <ellipse rx={4} ry={3.5} cy={-11} fill="#FFFFFF" />
          <path d="M0 -15 Q2 -12 0 -10" stroke="#EDE4D8" fill="none" />
          <path d="M-8 -2 Q0 1 8 -2" stroke="#EFE6DA" fill="none" />
        </g>
      )
    case 'garnish':
      return (
        <g transform={`${t} rotate(${(i * 37) % 60 - 30})`}>
          <path d="M-8 0 L-2 -18 L6 -3Z" fill="#3B2016" />
          <path d="M-2 -18 L6 -3 L1 -4Z" fill="#5C3424" />
        </g>
      )
    case 'oreo':
      return (
        <g transform={t}>
          <ellipse rx={9} ry={5.5} cy={-3} fill="#1E1A1A" />
          <ellipse rx={9} ry={5.5} cy={-6} fill="#2A2424" />
          <ellipse rx={6} ry={3.2} cy={-6} fill="none" stroke="#3E3636" />
          <rect x={-9} y={-5.5} width={18} height={1.6} fill="#F7F4EE" />
        </g>
      )
    case 'nuts':
      return (
        <g transform={`${t} rotate(${(i * 53) % 90 - 45})`}>
          <ellipse rx={6} ry={3.5} cy={-3} fill="#C48A4A" />
          <path d="M-4 -3 Q0 -5 4 -3" stroke="#8A5A2B" fill="none" />
        </g>
      )
    default:
      return null
  }
}

export function Rose({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 4 Q-20 -6 -8 -6Z" fill="#3E8E41" />
      <path d="M14 4 Q20 -6 8 -6Z" fill="#3E8E41" />
      <circle r={11} cy={-8} fill="#C1121F" />
      <path d="M-6 -10 Q0 -18 6 -10 Q0 -4 -6 -10Z" fill="#E5383B" />
      <path d="M-3 -9 Q0 -13 3 -9" stroke="#8D0B17" fill="none" strokeWidth={1.2} />
      <path d="M-9 -5 Q0 2 9 -5" stroke="#8D0B17" fill="none" strokeWidth={1.2} />
    </g>
  )
}

type TierBox = { cx: number; top: number; base: number; rx: number; ry: number }

export default function CakePreview({
  visual,
  className = '',
  showSizeLabel = false,
  placeholder = false,
}: {
  visual: CakeVisual
  className?: string
  showSizeLabel?: boolean
  /** Faded look while nothing is picked yet. */
  placeholder?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const flavours = visual.flavours.length > 0 ? visual.flavours.slice(0, 4) : [DEFAULT_FLAVOUR]
  const main = flavours[0]
  const pounds = Math.max(0.25, visual.pounds || 1)
  const diameter = visual.diameterInch || 6
  const twoTier = pounds > 2

  const cx = 200
  const plateY = 320
  const rx = Math.max(78, Math.min(150, 82 + (diameter - 5) * 13))
  const height = Math.max(70, Math.min(118, 70 + pounds * 18))
  const ry = rx * 0.3

  const tiers: TierBox[] = twoTier
    ? [
        { cx, base: plateY, top: plateY - height * 0.82, rx, ry },
        {
          cx,
          base: plateY - height * 0.82 + ry * 0.05,
          top: plateY - height * 0.82 - height * 0.7,
          rx: rx * 0.7,
          ry: ry * 0.7,
        },
      ]
    : [{ cx, base: plateY, top: plateY - height, rx, ry }]
  const topTier = tiers[tiers.length - 1]

  const addons = new Set<CakeAddonVisual>(visual.addons)
  const toppings = Array.from(new Set(visual.toppings))
  const hasPhoto = addons.has('photo') && Boolean(visual.photoUrl)
  const message = visual.message.trim()
  // The top is covered by the drip when there is one, so pipe the message in a colour that shows on it.

  const bodyFill = (tierIndex: number, flavourIndex: number) => `url(#${uid}-body-${tierIndex}-${flavourIndex})`

  function tierShape(t: TierBox) {
    return `M${t.cx - t.rx} ${t.top} L${t.cx - t.rx} ${t.base} A${t.rx} ${t.ry} 0 0 0 ${t.cx + t.rx} ${t.base} L${t.cx + t.rx} ${t.top} Z`
  }

  function dripPath(t: TierBox, seed: number) {
    const rand = seeded(seed)
    const steps = 22
    let d = `M${t.cx - t.rx} ${t.top}`
    for (let i = 0; i <= steps; i++) {
      const x = t.cx - t.rx + (i / steps) * t.rx * 2
      const k = (x - t.cx) / t.rx
      const edge = t.top + t.ry * Math.sqrt(Math.max(0, 1 - k * k))
      const len = i % 2 === 0 ? 6 + rand() * ((t.base - t.top) * 0.38) : 4 + rand() * 6
      const w = (t.rx * 2) / steps / 2
      d += ` L${(x - w).toFixed(1)} ${edge.toFixed(1)} Q${x.toFixed(1)} ${(edge + len * 2.1).toFixed(1)} ${(x + w).toFixed(1)} ${edge.toFixed(1)}`
    }
    d += ` L${t.cx + t.rx} ${t.top} A${t.rx} ${t.ry} 0 0 0 ${t.cx - t.rx} ${t.top} Z`
    return d
  }

  function piping(t: TierBox, color: string, keyPrefix: string): ReactNode[] {
    const out: ReactNode[] = []
    const count = Math.round(t.rx / 6)
    for (let i = 0; i <= count; i++) {
      const angle = Math.PI - (i / count) * Math.PI
      const x = t.cx + Math.cos(angle) * t.rx
      const y = t.base + Math.sin(angle) * t.ry
      out.push(<circle key={`${keyPrefix}-${i}`} cx={x} cy={y - 2} r={5.2} fill={color} />)
      out.push(<circle key={`${keyPrefix}-h${i}`} cx={x - 1.5} cy={y - 4} r={1.6} fill="#FFFFFF" opacity={0.45} />)
    }
    return out
  }

  // Toppings ring the top edge; sprinkles scatter over the whole top.
  const ringKinds = toppings.filter((k) => k !== 'sprinkles')
  const toppingScale = Math.max(1, Math.min(1.5, topTier.rx / 85))
  const ringCount = ringKinds.length === 0 ? 0 : Math.max(8, Math.min(16, Math.round(topTier.rx / 9)))
  const ring = ringCount > 0 ? ringPoints(cx, topTier.top, topTier.rx, topTier.ry, ringCount, 0.78, 0.2) : []
  const inner = ringKinds.length > 1 && !hasPhoto && !message
    ? ringPoints(cx, topTier.top, topTier.rx, topTier.ry, 6, 0.4, 0.5)
    : []
  const sprinkleColors = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#FF8FAB']
  const sprinkles = toppings.includes('sprinkles')
    ? (() => {
        const rand = seeded(7)
        return Array.from({ length: Math.round(topTier.rx * 0.45) }, (_, i) => {
          const a = rand() * Math.PI * 2
          const r = Math.sqrt(rand()) * 0.92
          return {
            x: cx + Math.cos(a) * topTier.rx * r,
            y: topTier.top + Math.sin(a) * topTier.ry * r,
            rot: rand() * 180,
            color: sprinkleColors[i % sprinkleColors.length],
          }
        })
      })()
    : []

  // Crop the picture to the cake, leaving room for a topper or candles.
  const headroom = addons.has('topper') ? 100 : addons.has('candles') ? 62 : 28
  const viewTop = Math.max(0, Math.floor(topTier.top - topTier.ry - headroom))
  const viewBottom = showSizeLabel ? 380 : Math.min(380, Math.ceil(plateY + ry + 26))

  const candles = addons.has('candles') ? ringPoints(cx, topTier.top, topTier.rx, topTier.ry, 5, 0.55, -Math.PI / 2 - 0.9).slice(0, 5) : []

  return (
    <svg
      viewBox={`0 ${viewTop} 400 ${viewBottom - viewTop}`}
      className={className}
      role="img"
      aria-label={`Preview of your ${pounds} pound cake`}
      style={placeholder ? { opacity: 0.55, filter: 'saturate(0.6)' } : undefined}
    >
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#FFF1F3" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}-plate`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EDE6E3" />
        </radialGradient>
        <linearGradient id={`${uid}-gold`} x1="0" x2="1">
          <stop offset="0%" stopColor="#B8860B" />
          <stop offset="50%" stopColor="#F5D06F" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>
        {tiers.map((_, ti) =>
          flavours.map((f, fi) => (
            <linearGradient key={`${ti}-${fi}`} id={`${uid}-body-${ti}-${fi}`} x1="0" x2="1">
              <stop offset="0%" stopColor={darken(f.frosting, 0.16)} />
              <stop offset="28%" stopColor={f.frosting} />
              <stop offset="52%" stopColor={lighten(f.frosting, 0.18)} />
              <stop offset="78%" stopColor={f.frosting} />
              <stop offset="100%" stopColor={darken(f.frosting, 0.2)} />
            </linearGradient>
          ))
        )}
        {flavours.length > 1
          ? flavours.map((_, fi) => (
              <clipPath key={fi} id={`${uid}-part-${fi}`}>
                <rect x={cx - 160 + (320 / flavours.length) * fi} y={0} width={320 / flavours.length} height={380} />
              </clipPath>
            ))
          : null}
        <clipPath id={`${uid}-photo`}>
          <ellipse cx={cx} cy={topTier.top} rx={topTier.rx * 0.48} ry={topTier.ry * 0.48} />
        </clipPath>
      </defs>

      <circle cx={200} cy={210} r={175} fill={`url(#${uid}-bg)`} />

      {/* plate */}
      <ellipse cx={cx} cy={plateY + 14} rx={rx + 40} ry={ry + 14} fill="#000" opacity={0.08} />
      <ellipse cx={cx} cy={plateY + 6} rx={rx + 34} ry={ry + 10} fill={`url(#${uid}-plate)`} stroke="#E4D9D4" />
      <ellipse cx={cx} cy={plateY + 2} rx={rx + 22} ry={ry + 4} fill="#FFFFFF" opacity={0.7} />

      {tiers.map((t, ti) => (
        <g key={ti}>
          {/* side */}
          {flavours.length > 1 ? (
            flavours.map((_, fi) => (
              <path key={fi} d={tierShape(t)} fill={bodyFill(ti, fi)} clipPath={`url(#${uid}-part-${fi})`} />
            ))
          ) : (
            <path d={tierShape(t)} fill={bodyFill(ti, 0)} />
          )}
          {/* decoration band */}
          {addons.has('decoration')
            ? Array.from({ length: 11 }, (_, i) => {
                const k = -0.9 + (i / 10) * 1.8
                const x = t.cx + k * t.rx
                const y = t.top + (t.base - t.top) * 0.55 + t.ry * Math.sqrt(1 - k * k)
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={3} fill={`url(#${uid}-gold)`} />
                    {i % 2 === 0 ? <path d={`M${x} ${y - 9} l2 4 4 1 -4 1 -2 4 -2 -4 -4 -1 4 -1z`} fill="#F5D06F" /> : null}
                  </g>
                )
              })
            : null}
          {/* top */}
          {flavours.length > 1 ? (
            flavours.map((f, fi) => (
              <ellipse
                key={fi}
                cx={t.cx}
                cy={t.top}
                rx={t.rx}
                ry={t.ry}
                fill={lighten(f.frosting, 0.08)}
                clipPath={`url(#${uid}-part-${fi})`}
              />
            ))
          ) : (
            <ellipse cx={t.cx} cy={t.top} rx={t.rx} ry={t.ry} fill={lighten(main.frosting, 0.08)} />
          )}
          {main.drip ? <path d={dripPath(t, 11 + ti * 5)} fill={main.drip} /> : null}
          <ellipse cx={t.cx} cy={t.top} rx={t.rx * 0.97} ry={t.ry * 0.9} fill="none" stroke="#FFFFFF" strokeOpacity={0.25} />
          {piping(t, lighten(main.frosting, 0.35), `p${ti}`)}
          {ti > 0
            ? piping({ ...t, base: t.top + 2, ry: t.ry }, lighten(main.frosting, 0.4), `q${ti}`).filter((_, i) => i % 2 === 0)
            : null}
        </g>
      ))}

      {/* sponge peek: a cut slice shows the inside colour */}
      {(() => {
        const t = tiers[0]
        const x = t.cx + t.rx * 0.55
        const y1 = t.top + t.ry * 0.84
        const y2 = t.base + t.ry * 0.84 - 6
        const sponge = flavours[flavours.length - 1].sponge
        return (
          <g opacity={0.95}>
            <path d={`M${x} ${y1} L${x + 18} ${y1 - 6} L${x + 18} ${y2 - 6} L${x} ${y2} Z`} fill={sponge} />
            {[0.33, 0.66].map((p) => (
              <path
                key={p}
                d={`M${x} ${y1 + (y2 - y1) * p} L${x + 18} ${y1 + (y2 - y1) * p - 6}`}
                stroke={lighten(main.frosting, 0.3)}
                strokeWidth={3}
              />
            ))}
          </g>
        )
      })()}

      {hasPhoto ? (
        <g>
          <ellipse cx={cx} cy={topTier.top} rx={topTier.rx * 0.52} ry={topTier.ry * 0.52} fill="#FFFFFF" />
          <image
            href={visual.photoUrl}
            x={cx - topTier.rx * 0.48}
            y={topTier.top - topTier.ry * 0.48}
            width={topTier.rx * 0.96}
            height={topTier.ry * 0.96}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${uid}-photo)`}
          />
        </g>
      ) : null}

      {sprinkles.map((p, i) => (
        <rect
          key={i}
          x={p.x - 2.6}
          y={p.y - 0.9}
          width={5.2}
          height={1.8}
          rx={0.9}
          fill={p.color}
          transform={`rotate(${p.rot.toFixed(0)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
        />
      ))}



      {[...inner, ...ring]
        .sort((a, b) => a.y - b.y)
        .map((p, i) => (
          <Topping key={i} kind={ringKinds[i % ringKinds.length]} x={p.x} y={p.y} s={p.scale * toppingScale} i={i} />
        ))}



      {candles.map((p, i) => (
        <g key={i}>
          <rect x={p.x - 2.5} y={p.y - 34} width={5} height={30} rx={1.5} fill={['#FF8FAB', '#8EC5FF', '#FFD166', '#B9F3C9', '#C3A6FF'][i % 5]} />
          <path d={`M${p.x - 2.5} ${p.y - 26} l5 -3 M${p.x - 2.5} ${p.y - 18} l5 -3 M${p.x - 2.5} ${p.y - 10} l5 -3`} stroke="#FFFFFF" strokeWidth={1} />
          <path d={`M${p.x} ${p.y - 46} Q${p.x + 4} ${p.y - 40} ${p.x} ${p.y - 35} Q${p.x - 4} ${p.y - 40} ${p.x} ${p.y - 46}Z`} fill="#FFB703" />
          <path d={`M${p.x} ${p.y - 42} Q${p.x + 2} ${p.y - 39} ${p.x} ${p.y - 36} Q${p.x - 2} ${p.y - 39} ${p.x} ${p.y - 42}Z`} fill="#FFF3B0" />
        </g>
      ))}

      {addons.has('flowers') ? (
        <g>
          <Rose x={cx - topTier.rx * 0.55} y={topTier.top + topTier.ry * 0.45} s={1} />
          <Rose x={cx - topTier.rx * 0.32} y={topTier.top + topTier.ry * 0.7} s={0.8} />
          <Rose x={cx + topTier.rx * 0.6} y={topTier.top + topTier.ry * 0.35} s={0.75} />
        </g>
      ) : null}

      {message && !hasPhoto ? (
        (() => {
          const size = Math.max(10, Math.min(17, (topTier.rx * 1.9) / Math.max(10, message.length) * 1.25))
          const w = Math.min(topTier.rx * 1.5, message.length * size * 0.56 + 26)
          return (
            <g transform={`translate(0 ${topTier.top}) scale(1 0.7) translate(0 ${-topTier.top})`}>
              <rect
                x={cx - w / 2}
                y={topTier.top - size * 0.95}
                width={w}
                height={size * 1.9}
                rx={size * 0.5}
                fill="#FFF8EE"
                stroke="#E9D3B8"
              />
              <text
                x={cx}
                y={topTier.top + size * 0.35}
                textAnchor="middle"
                fontFamily="'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive"
                fontSize={size}
                fontWeight={700}
                fill="#5A2D1E"
              >
                {message}
              </text>
            </g>
          )
        })()
      ) : null}

      {addons.has('topper') ? (
        <g>
          <line x1={cx - 34} y1={topTier.top - 40} x2={cx - 30} y2={topTier.top - 4} stroke="#C9A227" strokeWidth={2} />
          <line x1={cx + 34} y1={topTier.top - 40} x2={cx + 30} y2={topTier.top - 4} stroke="#C9A227" strokeWidth={2} />
          <text
            x={cx}
            y={topTier.top - 68}
            textAnchor="middle"
            fontFamily="'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive"
            fontSize={28}
            fontWeight={700}
            fill={`url(#${uid}-gold)`}
            stroke="#8B6508"
            strokeWidth={0.6}
          >
            Happy
          </text>
          <text
            x={cx}
            y={topTier.top - 40}
            textAnchor="middle"
            fontFamily="'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive"
            fontSize={30}
            fontWeight={700}
            fill={`url(#${uid}-gold)`}
            stroke="#8B6508"
            strokeWidth={0.6}
          >
            Birthday
          </text>
        </g>
      ) : null}

      {message && hasPhoto ? (
        <g>
          <rect
            x={cx - Math.min(150, 20 + message.length * 5)}
            y={plateY - 4}
            width={Math.min(300, 40 + message.length * 10)}
            height={26}
            rx={13}
            fill="#FFFFFF"
            stroke="#F3C6CE"
          />
          <text x={cx} y={plateY + 14} textAnchor="middle" fontSize={13} fontWeight={600} fill="#7A1F2B">
            {message}
          </text>
        </g>
      ) : null}

      {showSizeLabel ? (
        <g>
          <rect x={cx - 70} y={350} width={140} height={24} rx={12} fill="#FFFFFF" stroke="#F3D3D8" />
          <text x={cx} y={366} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#7A1F2B">
            {`${pounds} lb · about ${diameter}" wide`}
          </text>
        </g>
      ) : null}
    </svg>
  )
}
