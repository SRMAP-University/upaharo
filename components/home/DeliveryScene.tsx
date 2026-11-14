'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/**
 * The home hero's animated story (a 14 s loop, CSS only, see globals.css):
 * a gift pops out of the Upaharo shop and hops onto the scooter; puffs of
 * exhaust, a little wheelie and off it goes past the stupa, over a bump,
 * braking at the house. The gift hops to the doorstep, the door opens, the
 * receiver lifts it and jumps for joy, hearts rise, "Delivered" pops up, the
 * rider waves and rides off, and the door closes. Then it starts again.
 *
 * Depth: three mountain layers (far snowy range, middle hills, near hills)
 * plus the sun and clouds. On opening they rise into place one after the
 * other; after that they move at different speeds when the page scrolls and,
 * with a mouse, shift slightly with the pointer (parallax). Drawn in the same line style as the
 * category illustrations.
 */

const INK = '#2A2024'
const RED = '#E8322B'
const RED_SOFT = '#FDE3E1'
const GOLD = '#F5B83D'
const GOLD_SOFT = '#FFF0CC'
const TAN = '#E9C6A3'
const SOFT_LINE = '#E7B3B9'
const JACKET = '#2BA88A'

const FLAG_COLOURS = ['#6F8FE8', '#FFFFFF', '#E8605A', '#4FB38A', '#F5C04D']

/** Points along a quadratic curve, for the prayer flags. */
function along(p0: [number, number], p1: [number, number], p2: [number, number], steps: number[]) {
  return steps.map((t) => {
    const a = (1 - t) * (1 - t)
    const b = 2 * (1 - t) * t
    const c = t * t
    return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]] as [number, number]
  })
}

const STEPS = [0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86]
const LEFT_FLAGS = along([180, 70], [146, 98], [112, 118], STEPS)
const RIGHT_FLAGS = along([180, 70], [214, 98], [248, 118], STEPS)

function heart(cx: number, cy: number, s: number) {
  return `M${cx} ${cy + 9 * s}c${-9 * s} ${-5 * s} ${-13 * s} ${-10 * s} ${-11 * s} ${-15 * s}c${1.5 * s} ${-4 * s} ${7 * s} ${-5 * s} ${11 * s} ${-1 * s}c${4 * s} ${-4 * s} ${9.5 * s} ${-3 * s} ${11 * s} ${1 * s}c${2 * s} ${5 * s} ${-2 * s} ${10 * s} ${-11 * s} ${15 * s}z`
}

function Wheel({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="sc-wheel">
        <circle r="8" fill="#fff" stroke={INK} strokeWidth={2} />
        <path d="M-5 0h10M0-5v10" stroke={INK} strokeWidth={1.2} opacity="0.6" />
        <circle r="2.2" fill={INK} />
      </g>
    </g>
  )
}

function SmallGift({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth={1.4} strokeLinejoin="round">
      <rect x="0" y="4" width="15" height="12" rx="2" fill={RED} />
      <rect x="-1" y="1" width="17" height="4.5" rx="1.5" fill={RED} />
      <rect x="6" y="1" width="3" height="15" fill={GOLD} strokeWidth={1} />
      <path d="M7.5 1c-2-4-7-5-6.5-2 .4 2 4 2 6.5 2zM7.5 1c2-4 7-5 6.5-2-.4 2-4 2-6.5 2z" fill={GOLD} strokeWidth={1} />
    </g>
  )
}

function Bird({ y, d, t }: { y: number; d: number; t: number }) {
  return (
    <g className="sc-bird" style={{ '--d': `${d}s`, '--t': `${t}s` } as CSSProperties}>
      <g transform={`translate(-24 ${y})`}>
        <path className="sc-flap" d="M0 0q3-3.5 6 0q3-3.5 6 0" stroke={INK} strokeWidth={1.3} opacity="0.55" />
      </g>
    </g>
  )
}

/** A layer that drifts with scroll (k) and the pointer (m), and rises in on load. */
function Layer({ k, m, d, from, children }: { k: number; m: number; d: number; from: number; children: ReactNode }) {
  return (
    <g
      style={{
        transform: `translate(calc(var(--mx, 0) * ${m}px), calc(var(--py, 0) * ${k}px))`,
      }}
    >
      <g className="sc-in" style={{ '--d': `${d}s`, '--from': `${from}px` } as CSSProperties}>
        {children}
      </g>
    </g>
  )
}

export default function DeliveryScene({ className = '' }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null)

  // Parallax: scroll (all devices) and pointer (mouse only). Off for reduced motion.
  useEffect(() => {
    const svg = ref.current
    if (!svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => svg.style.setProperty('--py', String(Math.min(window.scrollY, 420))))
    }
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const x = (e.clientX / window.innerWidth) * 2 - 1
      svg.style.setProperty('--mx', x.toFixed(3))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [])

  return (
    <svg ref={ref} viewBox="0 -26 360 182" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* sun, behind everything */}
      <Layer k={0.36} m={-2} d={0.1} from={30}>
        <circle cx="298" cy="22" r="13" fill="#FFE2A6" />
        <circle cx="298" cy="22" r="20" fill="#FFE2A6" opacity="0.35" />
      </Layer>

      {/* far range: snowy peaks */}
      <Layer k={0.28} m={-4} d={0} from={40}>
        <path
          d="M0 80L22 62l16 8 24-36 18 16 18-8 22 18 26-30 24 22 20-8 24 20 26-38 22 20 22-8 22 20 28-22 26 18v72H0z"
          fill="#F2E3EE"
          stroke="#E3C6D6"
          strokeWidth={1.1}
        />
        <path d="M55 44l7-10 7 10-4-2-3 4-3-4z" fill="#fff" />
        <path d="M139 40l7-10 7 10-4-2-3 4-3-4z" fill="#fff" />
        <path d="M233 36l7-10 7 10-4-2-3 4-3-4z" fill="#fff" />
        <path d="M327 46l7-10 7 10-4-2-3 4-3-4z" fill="#fff" />
      </Layer>

      {/* clouds */}
      <Layer k={0.22} m={-6} d={0.2} from={12}>
        <g className="sc-cloud" style={{ '--t': '17s' } as CSSProperties}>
          <path d="M52 34a8 8 0 0 1 14-6 10 10 0 0 1 18 2 7 7 0 0 1 4 12H54a6 6 0 0 1-2-8z" fill="#fff" stroke="#F1D3D7" strokeWidth={1.2} />
        </g>
        <g className="sc-cloud" style={{ '--t': '21s', '--cx': '-16px' } as CSSProperties}>
          <path d="M214 18a7 7 0 0 1 12-5 9 9 0 0 1 16 2 6 6 0 0 1 3 10h-29a5 5 0 0 1-2-7z" fill="#fff" stroke="#F1D3D7" strokeWidth={1.2} />
        </g>
      </Layer>

      {/* birds crossing the sky */}
      <Bird y={24} d={0} t={16} />
      <Bird y={32} d={1.2} t={16} />

      {/* middle hills */}
      <Layer k={0.16} m={-7} d={0.12} from={28}>
        <path
          d="M0 118L30 98l18 8 34-34 22 18 20-10 26 20 26-16 22 12 34-34 30 30 26-10 30 22 42-14v56H0z"
          fill="#FBE6E9"
          stroke={SOFT_LINE}
          strokeWidth={1.3}
        />
        <path d="M74 80l8-8 8 8-4-2-4 4-4-4z" fill="#fff" />
        <path d="M224 70l8-8 8 8-4-2-4 4-4-4z" fill="#fff" />
      </Layer>

      {/* near hills */}
      <Layer k={0.07} m={-10} d={0.24} from={16}>
        <path
          d="M-10 130c30-14 62-16 96-6s62 8 92-4 64-14 98-2 56 10 94-4v40H-10z"
          fill="#F7D8DE"
          stroke="#EDBCC5"
          strokeWidth={1.1}
        />
      </Layer>

      {/* stupa with prayer flags */}
      <g stroke="#D99AA2" strokeWidth={1.3}>
        <path d="M180 70Q146 98 112 118M180 70Q214 98 248 118" />
        <rect x="150" y="128" width="60" height="18" fill="#FFF6F2" />
        <rect x="158" y="120" width="44" height="9" fill="#FFF6F2" />
        <path d="M161 120a19 17 0 0 1 38 0z" fill="#FFFDFB" />
        <rect x="172" y="96" width="16" height="9" fill={GOLD_SOFT} />
        <path d="M175.5 100.5q1.5-1.5 3 0M181.5 100.5q1.5-1.5 3 0" stroke={INK} strokeWidth={0.9} />
        <path d="M174 96l6-24 6 24z" fill={GOLD} />
        <path d="M176.5 88h7M177.5 82h5" strokeWidth={1} />
        <path d="M176 72h8l-4-6z" fill={GOLD} />
      </g>
      <g className="sc-flags">
        {[...LEFT_FLAGS, ...RIGHT_FLAGS].map(([x, y], i) => (
          <path
            key={i}
            d={`M${x - 3} ${y}h6l-3 7z`}
            fill={FLAG_COLOURS[i % FLAG_COLOURS.length]}
            stroke="#D99AA2"
            strokeWidth={0.8}
          />
        ))}
      </g>

      {/* road */}
      <path d="M0 146h360" stroke={INK} strokeWidth={1.6} />
      <path d="M8 152h352" stroke={INK} strokeWidth={1.2} strokeDasharray="10 9" opacity="0.18" />

      {/* the Upaharo shop */}
      <g stroke={INK} strokeWidth={1.6}>
        <rect x="12" y="88" width="70" height="58" fill="#fff" />
        <rect x="20" y="98" width="26" height="20" rx="1.5" fill={RED_SOFT} />
        <rect x="54" y="104" width="20" height="42" fill={GOLD_SOFT} />
        <circle cx="70" cy="126" r="1.3" fill={INK} stroke="none" />
        <rect x="8" y="76" width="78" height="10" fill={RED} />
        <path d="M17.75 76v10M37.25 76v10M56.75 76v10M76.25 76v10" stroke="#fff" strokeWidth={6} />
        <path d="M8 76h78v10H8z" fill="none" />
        <path
          d="M8 86q4.9 6 9.75 0 4.9 6 9.75 0 4.9 6 9.75 0 4.9 6 9.75 0 4.9 6 9.75 0 4.9 6 9.75 0 4.9 6 9.75 0 4.9 6 9.75 0"
          fill={RED}
        />
        <rect x="25" y="61" width="44" height="13" rx="3" fill="#fff" />
      </g>
      <text x="47" y="70.5" textAnchor="middle" fontSize="8" fontWeight={800} fill={RED} fontFamily="inherit">
        upaharo
      </text>
      <SmallGift x={26} y={102} s={0.7} />

      {/* the gift coming out of the shop and hopping onto the scooter */}
      <g className="sc-load">
        <SmallGift x={58} y={130} />
      </g>

      {/* the house */}
      <g stroke={INK} strokeWidth={1.6}>
        <rect x="278" y="92" width="66" height="54" fill="#FFF6EC" />
        <path d="M268 95l43-25 43 25z" fill="#C9493E" />
        <path d="M272 95h78" />
        <rect x="324" y="104" width="13" height="15" fill={RED_SOFT} />
        <path d="M330.5 104v15M324 111.5h13" strokeWidth={1} />
        <rect x="292" y="108" width="20" height="38" fill="#5E3A2B" />
      </g>
      <g className="sc-person">
        <path d="M296 146v-15c0-4 2.5-6.5 6-6.5s6 2.5 6 6.5v15z" fill={GOLD} stroke={INK} strokeWidth={1.3} />
        <circle cx="302" cy="119" r="4.6" fill={TAN} stroke={INK} strokeWidth={1.3} />
        <path d="M297.5 117.5a4.8 4.8 0 0 1 9 0c-2-1-6.5-1-9 0z" fill={INK} />
        <g className="sc-wave">
          <path d="M307.5 130l5-8" stroke={INK} strokeWidth={2} />
        </g>
      </g>
      <g stroke={INK} strokeWidth={1.6}>
        <rect className="sc-door" x="292" y="108" width="20" height="38" fill="#9A6A50" />
        <rect x="287" y="145" width="30" height="2.5" fill={RED_SOFT} stroke="none" />
      </g>

      {/* hearts and the badge when the gift arrives */}
      <path className="sc-heart" style={{ '--d': '0s', '--hx': '-8px' } as CSSProperties} d={heart(300, 112, 0.5)} fill={RED} stroke={INK} strokeWidth={1} />
      <path className="sc-heart" style={{ '--d': '0.25s', '--hx': '4px' } as CSSProperties} d={heart(306, 116, 0.65)} fill={RED_SOFT} stroke={INK} strokeWidth={1} />
      <path className="sc-heart" style={{ '--d': '0.5s', '--hx': '12px' } as CSSProperties} d={heart(310, 112, 0.45)} fill={GOLD} stroke={INK} strokeWidth={1} />
      <g className="sc-badge">
        <rect x="236" y="56" width="58" height="17" rx="8.5" fill="#E6F6EF" stroke="#14A887" strokeWidth={1.2} />
        <path d="M243 64.5l2.5 2.5 4.5-5" stroke="#0E7F69" strokeWidth={1.6} />
        <text x="270" y="68" textAnchor="middle" fontSize="8.5" fontWeight={700} fill="#0E7F69" fontFamily="inherit">
          Delivered
        </text>
      </g>

      {/* the gift landing on the doorstep */}
      <g className="sc-drop">
        <SmallGift x={296} y={130} />
      </g>

      {/* scooter and rider */}
      <g transform="translate(92 138)">
        <g className="sc-ride">
          <g className="sc-speed" stroke={INK} strokeWidth={1.4} opacity="0.35">
            <path d="M-30-22h10M-34-14h12M-28-6h8" />
          </g>
          <circle className="sc-puff" cx="-16" cy="-5" r="3.2" fill="#fff" stroke={INK} strokeWidth={1} />
          <circle className="sc-puff sc-puff-2" cx="-14" cy="-9" r="2.4" fill="#fff" stroke={INK} strokeWidth={1} />
          <g className="sc-lean">
          <g className="sc-bob" stroke={INK} strokeWidth={1.6}>
            <g className="sc-rackbox">
              <SmallGift x={-15} y={-40} />
            </g>
            {/* rider */}
            <path d="M10-24l11 9 7 7" strokeWidth={3.2} />
            <path d="M5-24c-1-8 3-18 9-20l6 2c0 8-3 15-6 18z" fill={JACKET} />
            <path d="M16-40l13 6 8-2" strokeWidth={2.2} />
            <g className="sc-rwave">
              <g className="sc-wave-r">
                <path d="M17-41l-5-11" strokeWidth={2.2} />
              </g>
            </g>
            <circle cx="16" cy="-50" r="6" fill={TAN} />
            <path d="M9.6-50a6.6 6.6 0 0 1 12.8 0l-.4 2H10z" fill={RED} />
            <path d="M19-49.5h3.5" stroke="#fff" strokeWidth={1.2} />
            {/* scooter body */}
            <path d="M-12-4c-1-12 8-18 20-18h12c2 0 3 2 2 5L18-6z" fill={RED} />
            <path d="M14-8h18v4H14z" fill={RED} />
            <path d="M30-4l4-26c.6-3 4-4 6-2l4 28z" fill={RED} />
            <path d="M33-6c2-6 12-6 14 0z" fill={RED} />
            <path d="M0-23h18c2 0 2-3 0-3H2c-2 0-3 3-2 3z" fill={INK} />
            <path d="M38-32l1-5M35-37l9-2" />
            <circle cx="44" cy="-29" r="2.2" fill={GOLD} />
          </g>
          <Wheel x={0} />
          <Wheel x={40} />
          </g>
        </g>
      </g>
    </svg>
  )
}
