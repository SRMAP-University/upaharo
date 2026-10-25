'use client'

import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  type TargetAndTransition,
} from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type Reaction = 'jump' | 'wiggle' | 'pop' | 'dizzy'
type Face = 'idle' | 'happy' | 'wink' | 'surprised' | 'dizzy'
type Particle = {
  id: number
  kind: 'heart' | 'sparkle'
  dx: number
  dy: number
  rotate: number
  delay: number
  size: number
}

const INK = '#2b1d22'
const BLUSH = '#E85A8C'
const LID = '#F27BA4'
const BOW = '#F1C35A'
const BOW_EDGE = '#b8893f'
const CHEEK = '#FFC0D4'
const TONGUE = '#FF8FB1'

// Taps rotate through these so back-to-back taps never feel the same.
const CYCLE: Reaction[] = ['jump', 'wiggle', 'pop']

const LINES: Record<Reaction, string[]> = {
  jump: ['Yay!', 'Hi there!', 'Boing!'],
  wiggle: ['Hehe, that tickles!', 'Wheee!'],
  pop: ['Surprise!', 'Gift time!'],
  dizzy: ['Whoa… so dizzy!'],
}

const FACES: Record<Reaction, Face> = {
  jump: 'happy',
  wiggle: 'wink',
  pop: 'surprised',
  dizzy: 'dizzy',
}

// Five quick taps inside this window make the buddy dizzy.
const DIZZY_TAPS = 5
const DIZZY_WINDOW_MS = 2500
const DIZZY_MS = 1600

const BODY_MOTION: Record<Reaction, TargetAndTransition> = {
  jump: {
    y: [0, 3, -18, 0, -4, 0],
    scaleX: [1, 1.15, 0.9, 1.1, 0.98, 1],
    scaleY: [1, 0.82, 1.12, 0.9, 1.03, 1],
    transition: { duration: 0.8, times: [0, 0.12, 0.4, 0.65, 0.82, 1], ease: 'easeOut' },
  },
  wiggle: {
    rotate: [0, -14, 12, -10, 7, -3, 0],
    transition: { duration: 0.7, ease: 'easeInOut' },
  },
  pop: {
    y: [0, 2, -6, 0],
    scaleX: [1, 1.1, 0.96, 1],
    scaleY: [1, 0.88, 1.06, 1],
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  dizzy: {
    y: [0, -14, 0],
    transition: { duration: 0.9, ease: 'easeInOut' },
  },
}

const HEART_PATH =
  'M12 21s-6.7-4.35-9.33-8.1C.6 9.9 2.1 5.5 6.2 5.1c2.2-.2 3.9 1 5.8 3 1.9-2 3.6-3.2 5.8-3 4.1.4 5.6 4.8 3.53 7.8C18.7 16.65 12 21 12 21z'
const SPARKLE_PATH =
  'M12 2c.6 4.6 2.4 7.4 10 10-7.6 2.6-9.4 5.4-10 10-.6-4.6-2.4-7.4-10-10 7.6-2.6 9.4-5.4 10-10z'

function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

function burst(reaction: Reaction, seed: number): Particle[] {
  const kind = reaction === 'jump' || reaction === 'wiggle' ? 'heart' : 'sparkle'
  const count = reaction === 'wiggle' ? 3 : reaction === 'dizzy' ? 4 : 5
  return Array.from({ length: count }, (_, i) => {
    // Fan out across the upper arc, nudged so repeat taps don't look identical.
    const spread = i / (count - 1) - 0.5
    const angle = (spread * 110 + (Math.random() - 0.5) * 18) * (Math.PI / 180)
    const distance = 26 + Math.random() * 14
    return {
      id: seed * 10 + i,
      kind,
      dx: Math.sin(angle) * distance,
      dy: Math.cos(angle) * distance,
      rotate: (Math.random() - 0.5) * 50,
      delay: i * 0.04,
      size: kind === 'heart' ? 11 + Math.random() * 4 : 9 + Math.random() * 5,
    }
  })
}

function Eye({ face, blink, cx, side }: { face: Face; blink: boolean; cx: number; side: 'left' | 'right' }) {
  const cy = 30.6
  const stroke = { stroke: INK, strokeWidth: 1.6, strokeLinecap: 'round' as const, fill: 'none' }

  if (face === 'dizzy') {
    return <path d={`M${cx - 2} ${cy - 2}L${cx + 2} ${cy + 2}M${cx + 2} ${cy - 2}L${cx - 2} ${cy + 2}`} {...stroke} />
  }
  if (face === 'happy' || (face === 'wink' && side === 'right')) {
    return <path d={`M${cx - 2.3} ${cy + 0.8}Q${cx} ${cy - 2.4} ${cx + 2.3} ${cy + 0.8}`} {...stroke} />
  }
  if (blink && face === 'idle') {
    return <path d={`M${cx - 2.2} ${cy}Q${cx} ${cy + 1.1} ${cx + 2.2} ${cy}`} {...stroke} />
  }

  const r = face === 'surprised' ? 2.5 : 2.1
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={r} ry={face === 'surprised' ? 2.5 : 2.6} fill={INK} />
      <circle cx={cx + 0.7} cy={cy - 0.9} r={face === 'surprised' ? 0.95 : 0.75} fill="#fff" />
    </g>
  )
}

function Mouth({ face }: { face: Face }) {
  switch (face) {
    case 'happy':
      return (
        <g>
          <path d="M20.8 33.8Q24 39 27.2 33.8Z" fill={INK} />
          <ellipse cx={24} cy={35.6} rx={1.6} ry={0.8} fill={TONGUE} />
        </g>
      )
    case 'surprised':
      return <ellipse cx={24} cy={35.3} rx={1.6} ry={2} fill={INK} />
    case 'dizzy':
      return (
        <path
          d="M20.6 35.2q1.15-1.3 2.3 0t2.3 0t2.3 0"
          stroke={INK}
          strokeWidth={1.3}
          strokeLinecap="round"
          fill="none"
        />
      )
    default:
      return (
        <path
          d={face === 'wink' ? 'M21 34.2Q24 37.4 27 34.2' : 'M21.6 34.4Q24 36.6 26.4 34.4'}
          stroke={INK}
          strokeWidth={1.4}
          strokeLinecap="round"
          fill="none"
        />
      )
  }
}

/**
 * Gift-box buddy that peeks over the bottom nav and reacts when tapped.
 * Position it with `className`; it sits behind its container (z -1) so the
 * nav bar hides the bottom of the box.
 */
export default function NavMascot({
  className = '',
  hidden = false,
}: {
  className?: string
  hidden?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const body = useAnimationControls()
  const spin = useAnimationControls()
  const lid = useAnimationControls()
  const [face, setFace] = useState<Face>('idle')
  const [blink, setBlink] = useState(false)
  const [line, setLine] = useState<{ id: number; text: string } | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const cycleRef = useRef(0)
  const tapsRef = useRef<number[]>([])
  const dizzyUntilRef = useRef(0)
  const seedRef = useRef(0)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const faceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lineTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(faceTimerRef.current)
      clearTimeout(lineTimerRef.current)
    }
  }, [])

  // Blink every few seconds while idle.
  useEffect(() => {
    if (face !== 'idle') return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true)
        timer = setTimeout(() => {
          setBlink(false)
          schedule()
        }, 140)
      }, 2500 + Math.random() * 3000)
    }
    schedule()
    return () => {
      clearTimeout(timer)
      setBlink(false)
    }
  }, [face])

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t)
      fn()
    }, ms)
    timersRef.current.add(t)
  }

  const react = async () => {
    const now = Date.now()
    // Let the dizzy spell play out instead of cutting it short.
    if (now < dizzyUntilRef.current) return
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < DIZZY_WINDOW_MS), now]

    let reaction: Reaction
    if (tapsRef.current.length >= DIZZY_TAPS) {
      reaction = 'dizzy'
      tapsRef.current = []
      dizzyUntilRef.current = now + DIZZY_MS
    } else {
      reaction = CYCLE[cycleRef.current % CYCLE.length]
      cycleRef.current += 1
    }

    if (typeof navigator !== 'undefined') navigator.vibrate?.(10)

    setFace(FACES[reaction])
    clearTimeout(faceTimerRef.current)
    faceTimerRef.current = setTimeout(() => setFace('idle'), reaction === 'dizzy' ? DIZZY_MS : 1100)

    const seed = ++seedRef.current
    setLine({ id: seed, text: pick(LINES[reaction]) })
    clearTimeout(lineTimerRef.current)
    lineTimerRef.current = setTimeout(() => setLine(null), 1800)

    if (reduceMotion) return

    const fresh = burst(reaction, seed)
    setParticles((prev) => [...prev, ...fresh])
    later(() => {
      const ids = new Set(fresh.map((p) => p.id))
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)))
    }, 1200)

    body.stop()
    spin.stop()
    lid.stop()
    body.set({ y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
    spin.set({ rotate: 0 })
    lid.set({ y: 0, rotate: 0 })

    if (reaction === 'pop') {
      lid.start({
        y: [0, -11, -11, 0],
        rotate: [0, -16, 8, 0],
        transition: { duration: 0.75, times: [0, 0.3, 0.6, 1], ease: 'easeOut' },
      })
    }
    if (reaction === 'dizzy') {
      spin.start({ rotate: [0, 360], transition: { duration: 0.9, ease: 'easeInOut' } })
    }
    await body.start(BODY_MOTION[reaction])
  }

  return (
    <motion.div
      className={`pointer-events-none absolute -z-10 h-11 w-11 ${className}`}
      initial={false}
      animate={{ y: hidden ? 56 : 7, opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <motion.div
        className="h-full w-full"
        animate={reduceMotion ? undefined : { y: [0, -1.5, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div className="h-full w-full" style={{ originY: 1 }} animate={body}>
          <motion.button
            type="button"
            onClick={react}
            aria-label="Gift buddy — tap to say hi"
            className="pointer-events-auto block h-full w-full touch-manipulation select-none outline-none [-webkit-tap-highlight-color:transparent] focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-blush/60"
            animate={spin}
          >
            <svg viewBox="0 0 48 48" className="h-full w-full overflow-visible" aria-hidden>
              {/* White sticker edge keeps the box readable on the pink delivery chip. */}
              <rect x={9} y={22} width={30} height={21} rx={6} fill={BLUSH} stroke="#fff" strokeWidth={1.4} />
              <rect x={12} y={26} width={2.6} height={9} rx={1.3} fill="#fff" opacity={0.28} />
              <ellipse cx={15.6} cy={34.2} rx={2.4} ry={1.5} fill={CHEEK} opacity={0.85} />
              <ellipse cx={32.4} cy={34.2} rx={2.4} ry={1.5} fill={CHEEK} opacity={0.85} />
              <Eye face={face} blink={blink} cx={19} side="left" />
              <Eye face={face} blink={blink} cx={29} side="right" />
              <Mouth face={face} />
              <motion.g animate={lid} style={{ originX: 0.5, originY: 1 }}>
                <path
                  d="M24 14C20 6.5 13.5 8 15.5 12.5C16.6 15 21 15 24 14ZM24 14C28 6.5 34.5 8 32.5 12.5C31.4 15 27 15 24 14Z"
                  fill={BOW}
                  stroke={BOW_EDGE}
                  strokeWidth={1.1}
                  strokeLinejoin="round"
                />
                <rect x={6.5} y={14.5} width={35} height={8.5} rx={3.5} fill={LID} stroke="#fff" strokeWidth={1.4} />
                <rect x={21.25} y={14.5} width={5.5} height={8.5} fill={BOW} />
                <ellipse cx={24} cy={14.4} rx={3} ry={2.3} fill="#E0AE48" stroke={BOW_EDGE} strokeWidth={1} />
              </motion.g>
            </svg>
          </motion.button>
        </motion.div>
      </motion.div>

      {particles.map((p) => (
        <motion.svg
          key={p.id}
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1"
          style={{ width: p.size, height: p.size, marginLeft: -p.size / 2 }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ x: p.dx, y: -p.dy, opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.8], rotate: p.rotate }}
          transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
        >
          <path d={p.kind === 'heart' ? HEART_PATH : SPARKLE_PATH} fill={p.kind === 'heart' ? BLUSH : BOW} />
        </motion.svg>
      ))}

      <div aria-live="polite" className="absolute bottom-[62%] left-[85%]">
        <AnimatePresence>
          {line && (
            <motion.p
              key="bubble"
              className="absolute bottom-0 left-0 origin-bottom-left whitespace-nowrap rounded-2xl rounded-bl-md border border-wine/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink shadow-[0_8px_20px_-10px_rgba(43,29,34,0.45)]"
              initial={{ opacity: 0, scale: 0.6, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            >
              {/* Re-keyed per tap so a new line pops in place instead of stacking bubbles. */}
              <motion.span
                key={line.id}
                className="block"
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 20 }}
              >
                {line.text}
              </motion.span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
