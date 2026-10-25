import type { CSSProperties } from 'react'
import styles from './festive.module.css'

/** Stable pseudo-random so server and browser draw the same petals. */
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const MARIGOLD_TONES = [
  ['#f97316', '#c2410c'],
  ['#f59e0b', '#b45309'],
  ['#facc15', '#ca8a04'],
] as const

function Marigold({ cx, cy, r, tone }: { cx: number; cy: number; r: number; tone: number }) {
  const [fill, edge] = MARIGOLD_TONES[tone % MARIGOLD_TONES.length]
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.78}
        fill="none"
        stroke={edge}
        strokeWidth={r * 0.45}
        strokeDasharray={`${r * 0.42} ${r * 0.3}`}
        opacity={0.55}
      />
      <circle cx={cx} cy={cy} r={r * 0.32} fill={edge} opacity={0.9} />
    </g>
  )
}

/** Marigold toran: scalloped swags with swaying strands. */
export function MarigoldGarland({ className = '' }: { className?: string }) {
  const swags = [0, 300, 600, 900]
  const flowers: Array<{ x: number; y: number; tone: number }> = []
  swags.forEach((x0, s) => {
    for (let k = 0; k <= 12; k++) {
      const t = k / 12
      // Quadratic curve from (x0, 12) dipping to the middle and back up.
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + 150) + t * t * (x0 + 300)
      const y = (1 - t) * (1 - t) * 12 + 2 * (1 - t) * t * 104 + t * t * 12
      flowers.push({ x, y, tone: (k + s) % 3 })
    }
  })
  const strands = [0, 300, 600, 900, 1200]

  return (
    <svg
      className={className}
      viewBox="0 0 1200 190"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden
    >
      <path d="M0 12 Q150 104 300 12 Q450 104 600 12 Q750 104 900 12 Q1050 104 1200 12" stroke="#7c4a12" strokeWidth="2" fill="none" opacity="0.5" />
      {flowers.map((f, i) => (
        <Marigold key={`f-${i}`} cx={f.x} cy={f.y} r={11} tone={f.tone} />
      ))}
      {strands.map((x, i) => (
        <g
          key={`s-${x}`}
          className={styles.strand}
          style={{ transformBox: 'fill-box', ['--delay' as string]: `${-i * 0.7}s` } as CSSProperties}
        >
          <line x1={x} y1={12} x2={x} y2={150} stroke="#7c4a12" strokeWidth="1.5" opacity="0.5" />
          {[30, 56, 82, 108, 134].map((y, k) => (
            <Marigold key={k} cx={x} cy={y} r={10} tone={(i + k) % 3} />
          ))}
          <path d={`M${x - 7} 150 Q${x} 176 ${x + 7} 150 Z`} fill="#16a34a" />
          <circle cx={x} cy={152} r={3.5} fill="#fde68a" />
        </g>
      ))}
    </svg>
  )
}

const PETAL_COLORS = ['#f97316', '#f59e0b', '#facc15', '#dc2626', '#fb7185', '#ea580c']

/** Marigold and rose petals drifting down. `fall` is how far they travel. */
export function FallingPetals({ count = 18, fall = 900 }: { count?: number; fall?: number }) {
  return (
    <div className={styles.petals} aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const size = 9 + Math.round(seeded(i, 1) * 9)
        const style = {
          left: `${Math.round(seeded(i, 2) * 100)}%`,
          ['--dur' as string]: `${(9 + seeded(i, 3) * 8).toFixed(1)}s`,
          ['--delay' as string]: `${(-seeded(i, 4) * 14).toFixed(1)}s`,
          ['--sway' as string]: `${(2.4 + seeded(i, 5) * 2).toFixed(1)}s`,
          ['--drift' as string]: `${Math.round((seeded(i, 6) - 0.5) * 120)}px`,
          ['--spin' as string]: `${Math.round(180 + seeded(i, 7) * 360)}deg`,
          ['--fall' as string]: `${fall}px`,
        } as CSSProperties
        return (
          <div key={i} className={styles.petal} style={style}>
            <span>
              <svg width={size} height={size * 1.5} viewBox="0 0 10 15">
                <path d="M5 0 C9 4 9 11 5 15 C1 11 1 4 5 0 Z" fill={PETAL_COLORS[i % PETAL_COLORS.length]} opacity="0.9" />
              </svg>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Row of clay diyas with flickering flames. */
export function DiyaRow({ count = 5, className = '' }: { count?: number; className?: string }) {
  const width = count * 90
  return (
    <svg className={className} viewBox={`0 0 ${width} 92`} aria-hidden>
      <defs>
        <radialGradient id="diya-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
        <linearGradient id="diya-clay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
      </defs>
      {Array.from({ length: count }).map((_, i) => {
        const cx = 45 + i * 90
        const delay = { ['--delay' as string]: `${(-i * 0.37).toFixed(2)}s` } as CSSProperties
        return (
          <g key={i}>
            <circle className={styles.glow} style={delay} cx={cx} cy={34} r={30} fill="url(#diya-glow)" />
            <path
              className={styles.flame}
              style={delay}
              d={`M${cx} 12 C${cx + 9} 26 ${cx + 8} 42 ${cx} 46 C${cx - 8} 42 ${cx - 9} 26 ${cx} 12 Z`}
              fill="url(#diya-flame)"
            />
            <path
              d={`M${cx - 34} 50 Q${cx} 92 ${cx + 34} 50 Q${cx + 20} 56 ${cx} 56 Q${cx - 20} 56 ${cx - 34} 50 Z`}
              fill="url(#diya-clay)"
            />
            <path d={`M${cx - 34} 50 Q${cx} 58 ${cx + 34} 50`} stroke="#fdba74" strokeWidth="2" fill="none" opacity="0.7" />
            {[-16, -6, 4, 14].map((dx) => (
              <circle key={dx} cx={cx + dx + 1} cy={66} r={1.8} fill="#fde68a" opacity="0.85" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/** Twinkling four-point stars scattered over a dark background. */
export function Sparkles({ count = 14 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const size = 6 + Math.round(seeded(i, 11) * 10)
        const style = {
          left: `${Math.round(seeded(i, 12) * 96)}%`,
          top: `${Math.round(12 + seeded(i, 13) * 70)}%`,
          ['--dur' as string]: `${(2 + seeded(i, 14) * 3).toFixed(1)}s`,
          ['--delay' as string]: `${(-seeded(i, 15) * 4).toFixed(1)}s`,
        } as CSSProperties
        return (
          <svg key={i} className={styles.sparkle} style={style} width={size} height={size} viewBox="0 0 10 10">
            <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="#fde68a" />
          </svg>
        )
      })}
    </div>
  )
}

/** Slowly turning rangoli used as a soft backdrop. */
export function Rangoli({ className = '' }: { className?: string }) {
  const ring = (count: number, radius: number, rx: number, ry: number, color: string) =>
    Array.from({ length: count }).map((_, i) => {
      const angle = (360 / count) * i
      return (
        <ellipse
          key={`${radius}-${i}`}
          cx={0}
          cy={-radius}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          transform={`rotate(${angle})`}
        />
      )
    })
  return (
    <svg className={className} viewBox="-200 -200 400 400" aria-hidden>
      <g className={styles.rangoli} style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
        {ring(12, 48, 12, 26, '#fbbf24')}
        {ring(16, 104, 14, 34, '#fb923c')}
        {ring(24, 160, 10, 26, '#fde68a')}
        <circle r="18" fill="none" stroke="#fbbf24" strokeWidth="1.4" />
        <circle r="186" fill="none" stroke="#fde68a" strokeWidth="1" strokeDasharray="2 8" />
      </g>
    </svg>
  )
}

const TIKA_COLORS = ['#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#f8fafc', '#ea580c', '#a855f7']

/** The seven colours of saptarangi tika. */
export function TikaDots({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-hidden>
      {TIKA_COLORS.map((color, i) => (
        <span
          key={color}
          className={`${styles.tikaDot} block h-3 w-3 rounded-full ring-1 ring-black/10 shadow-[0_0_10px_rgba(255,255,255,0.35)]`}
          style={{ backgroundColor: color, ['--delay' as string]: `${i * 0.18}s` } as CSSProperties}
        />
      ))}
    </div>
  )
}

export const festiveStyles = styles
