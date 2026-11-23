'use client'

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'

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

export type SceneWeather = { scene: 'clear' | 'clouds' | 'rain' | 'storm' | 'snow' | 'fog'; night: boolean }

/** Seasonal dressing: wedding season (marigolds, fairy lights) and winter (snowy peaks, a scarf). */
export type SceneSeason = { wedding?: boolean; winter?: boolean }

const MARIGOLD = '#F28C1E'
const FAIRY = '#FFD36B'

const FAR_RANGE = 'M0 80L22 62l16 8 24-36 18 16 18-8 22 18 26-30 24 22 20-8 24 20 26-38 22 20 22-8 22 20 28-22 26 18v72H0z'
const MID_HILLS = 'M0 118L30 98l18 8 34-34 22 18 20-10 26 20 26-16 22 12 34-34 30 30 26-10 30 22 42-14v56H0z'

/** Everything above a jagged snowline at height y (clipped to a mountain outline). */
function snowAbove(y: number) {
  let d = `M-4 -40H364V${y}`
  for (let x = 364, up = true; x > -4; x -= 6, up = !up) d += `L${x - 6} ${up ? y + 3.5 : y}`
  return `${d}z`
}

/** Snow caps for winter: the snowline cuts across both mountain layers. */
function SnowCaps({ id, outline, line }: { id: string; outline: string; line: number }) {
  return (
    <>
      <clipPath id={id}>
        <path d={outline} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <path d={snowAbove(line)} fill="#fff" />
      </g>
      <path d={outline} stroke="#E3C6D6" strokeWidth={1.1} fill="none" />
    </>
  )
}

/** Points along a quadratic curve, evenly stepped. */
function swag(p0: [number, number], p1: [number, number], p2: [number, number], n: number) {
  return along(p0, p1, p2, Array.from({ length: n }, (_, i) => i / (n - 1)))
}

/** A marigold (sayapatri) garland draped between two points, with hanging strands at the ends. */
function Garland({ from, mid, to, n, strands = 2 }: { from: [number, number]; mid: [number, number]; to: [number, number]; n: number; strands?: number }) {
  const beads = swag(from, mid, to, n)
  const hang = (x: number, y: number) => Array.from({ length: strands }, (_, i) => [x, y + 4.2 * (i + 1)] as [number, number])
  return (
    <g className="sc-garland" stroke={INK} strokeWidth={0.8}>
      {[...beads, ...hang(...from), ...hang(...to)].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.3} fill={i % 2 ? GOLD : MARIGOLD} />
      ))}
    </g>
  )
}

/** Warm fairy lights hanging along a line, twinkling one after another. */
function FairyLights({ from, mid, to, n }: { from: [number, number]; mid: [number, number]; to: [number, number]; n: number }) {
  const bulbs = swag(from, mid, to, n)
  return (
    <g>
      <path d={`M${from[0]} ${from[1]}Q${mid[0]} ${mid[1]} ${to[0]} ${to[1]}`} stroke={INK} strokeWidth={0.7} opacity="0.5" />
      {bulbs.map(([x, y], i) => (
        <circle
          key={i}
          className="sc-twinkle"
          style={{ '--d': `${(i % 4) * 0.45}s` } as CSSProperties}
          cx={x}
          cy={y + 1.6}
          r={1.7}
          fill={FAIRY}
          stroke="#E0A92E"
          strokeWidth={0.6}
        />
      ))}
    </g>
  )
}


/** The moon at night (stars, rain, snow and fog cover the whole hero; see WeatherOverlay). */
function WeatherSky({ w }: { w: SceneWeather }) {
  if (!w.night) return null
  return <path d="M300 10a13 13 0 1 0 12 18 10 10 0 1 1-12-18z" fill="#FFF3C4" stroke="#E9D48A" strokeWidth={1} />
}

/** A storm's lightning bolt and puddle splashes on the road when it rains. */
function WeatherFront({ w }: { w: SceneWeather }) {
  if (w.scene !== 'rain' && w.scene !== 'storm') return null
  return (
    <g>
      {[40, 120, 205, 300].map((x, i) => (
        <ellipse key={x} className="sc-splash" cx={x} cy="150" rx="5" ry="1.4" stroke="#7D93C9" strokeWidth={0.8} style={{ '--d': `${i * 0.35}s` } as CSSProperties} />
      ))}
      {w.scene === 'storm' ? (
        <path className="sc-bolt" d="M232 -6l-8 18h7l-6 16 14-21h-7l6-13z" fill="#FFE38A" stroke="#E0A92E" strokeWidth={1} />
      ) : null}
    </g>
  )
}

export default function DeliveryScene({
  className = '',
  weather,
  season,
}: {
  className?: string
  weather?: SceneWeather
  season?: SceneSeason
}) {
  const w: SceneWeather = weather ?? { scene: 'clear', night: false }
  const wedding = Boolean(season?.wedding)
  const winter = Boolean(season?.winter)
  const ref = useRef<SVGSVGElement>(null)
  const uid = useId().replace(/:/g, '')

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
      <defs>
        <linearGradient id="sc-night-land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E2250" stopOpacity="0" />
          <stop offset="0.35" stopColor="#1E2250" stopOpacity="0.28" />
          <stop offset="1" stopColor="#1E2250" stopOpacity="0.32" />
        </linearGradient>
      </defs>
      <WeatherSky w={w} />

      {/* sun, behind everything (dimmed behind clouds, gone at night) */}
      {!w.night ? (
        <Layer k={0.36} m={-2} d={0.1} from={30}>
          <g opacity={w.scene === 'clear' ? 1 : w.scene === 'clouds' || w.scene === 'fog' ? 0.45 : 0}>
            <circle cx="298" cy="22" r="13" fill="#FFE2A6" />
            <circle cx="298" cy="22" r="20" fill="#FFE2A6" opacity="0.35" />
          </g>
        </Layer>
      ) : null}

      {/* far range: snowy peaks */}
      <Layer k={0.28} m={-4} d={0} from={40}>
        <path d={FAR_RANGE} fill="#F2E3EE" stroke="#E3C6D6" strokeWidth={1.1} />
        {winter ? <SnowCaps id={`${uid}-far`} outline={FAR_RANGE} line={47} /> : null}
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

      {w.scene !== 'clear' && w.scene !== 'fog' ? (
        <Layer k={0.2} m={-5} d={0.25} from={10}>
          {[
            [28, 6, 1],
            [150, -4, 1.2],
            [262, 10, 1],
          ].map(([cx, cy, s]) => (
            <g key={cx} className="sc-cloud" style={{ '--t': `${15 + cx / 40}s` } as CSSProperties}>
              <path
                transform={`translate(${cx} ${cy}) scale(${s})`}
                d="M0 12a9 9 0 0 1 16-7 11 11 0 0 1 20 2 8 8 0 0 1 5 13H2a7 7 0 0 1-2-8z"
                fill={w.scene === 'storm' ? '#AEB6CB' : '#D9DEE9'}
                stroke={w.scene === 'storm' ? '#8A94AE' : '#C2C9D8'}
                strokeWidth={1.1}
              />
            </g>
          ))}
        </Layer>
      ) : null}

      {/* birds crossing the sky (not in bad weather or at night) */}
      {w.scene === 'clear' && !w.night ? (
        <>
          <Bird y={24} d={0} t={16} />
          <Bird y={32} d={1.2} t={16} />
        </>
      ) : null}

      {/* middle hills */}
      <Layer k={0.16} m={-7} d={0.12} from={28}>
        <path d={MID_HILLS} fill="#FBE6E9" stroke={SOFT_LINE} strokeWidth={1.3} />
        {winter ? <SnowCaps id={`${uid}-mid`} outline={MID_HILLS} line={82} /> : null}
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
      {wedding ? <Garland from={[9, 89]} mid={[47, 104]} to={[85, 89]} n={13} /> : null}

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
      {wedding ? (
        <>
          <FairyLights from={[270, 96]} mid={[290, 90]} to={[311, 72]} n={7} />
          <FairyLights from={[311, 72]} mid={[332, 90]} to={[352, 96]} n={7} />
        </>
      ) : null}
      <g className="sc-person">
        <path d="M296 146v-15c0-4 2.5-6.5 6-6.5s6 2.5 6 6.5v15z" fill={wedding ? RED : GOLD} stroke={INK} strokeWidth={1.3} />
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
      {wedding ? <Garland from={[288, 106]} mid={[302, 116]} to={[316, 106]} n={7} strands={3} /> : null}

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
            {winter ? (
              <g className="sc-scarf">
                <path d="M11-44c-4 .6-8 2.4-11.5 5.6l1.8 2.2c3.2-2.6 6.6-4.2 10.4-4.8z" fill={GOLD} strokeWidth={1.1} />
                <path d="M3.6-41.2l1.6 2M7-42.8l1.4 2.1" stroke={RED} strokeWidth={1.3} />
              </g>
            ) : null}
            <path d="M5-24c-1-8 3-18 9-20l6 2c0 8-3 15-6 18z" fill={JACKET} />
            {winter ? <path d="M10.4-45.6c3.4 1.6 7.4 1.8 11 .2l.5 3c-3.9 1.6-8.1 1.4-12-.2z" fill={GOLD} strokeWidth={1.1} /> : null}
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
      <WeatherFront w={w} />
      {w.night ? <rect x="-10" y="-30" width="380" height="190" fill="url(#sc-night-land)" pointerEvents="none" /> : null}
    </svg>
  )
}
