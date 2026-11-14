import type { CSSProperties } from 'react'

/**
 * The home hero's animated story (a 12 s loop, CSS only, see globals.css):
 * a rider leaves the Upaharo shop on a red scooter with a gift on the back,
 * rides past the hills and a stupa with prayer flags, stops at a house, the
 * gift hops to the doorstep, the door opens, hearts rise and a "Delivered"
 * badge pops up. Then it starts again. Drawn in the same line style as the
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

export default function DeliveryScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 14 360 142" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* sky */}
      <circle cx="322" cy="38" r="13" fill="#FFE7B0" />
      <g className="sc-cloud" style={{ '--t': '17s' } as CSSProperties}>
        <path d="M52 40a8 8 0 0 1 14-6 10 10 0 0 1 18 2 7 7 0 0 1 4 12H54a6 6 0 0 1-2-8z" fill="#fff" stroke="#F1D3D7" strokeWidth={1.2} />
      </g>
      <g className="sc-cloud" style={{ '--t': '21s', '--cx': '-16px' } as CSSProperties}>
        <path d="M232 30a7 7 0 0 1 12-5 9 9 0 0 1 16 2 6 6 0 0 1 3 10h-29a5 5 0 0 1-2-7z" fill="#fff" stroke="#F1D3D7" strokeWidth={1.2} />
      </g>

      {/* hills */}
      <path
        d="M0 118L30 98l18 8 34-34 22 18 20-10 26 20 26-16 22 12 34-34 30 30 26-10 30 22 42-14v56H0z"
        fill="#FBE6E9"
        stroke={SOFT_LINE}
        strokeWidth={1.3}
      />
      <path d="M74 80l8-8 8 8-4-2-4 4-4-4z" fill="#fff" />
      <path d="M224 70l8-8 8 8-4-2-4 4-4-4z" fill="#fff" />

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

      {/* the house */}
      <g stroke={INK} strokeWidth={1.6}>
        <rect x="278" y="92" width="66" height="54" fill="#FFF6EC" />
        <path d="M268 95l43-25 43 25z" fill="#C9493E" />
        <path d="M272 95h78" />
        <rect x="324" y="104" width="13" height="15" fill={RED_SOFT} />
        <path d="M330.5 104v15M324 111.5h13" strokeWidth={1} />
        <rect x="292" y="108" width="20" height="38" fill="#5E3A2B" />
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
          <g className="sc-bob" stroke={INK} strokeWidth={1.6}>
            <g className="sc-rackbox">
              <SmallGift x={-15} y={-40} />
            </g>
            {/* rider */}
            <path d="M10-24l11 9 7 7" strokeWidth={3.2} />
            <path d="M5-24c-1-8 3-18 9-20l6 2c0 8-3 15-6 18z" fill={JACKET} />
            <path d="M16-40l13 6 8-2" strokeWidth={2.2} />
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
    </svg>
  )
}
