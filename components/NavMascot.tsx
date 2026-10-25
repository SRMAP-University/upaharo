'use client'

import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  useSpring,
  type TargetAndTransition,
} from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useCartStore } from '@/lib/store/cart'
import {
  DEFAULT_ADDED_LINES,
  productMascotScript,
  type MascotProduct,
  type MascotScript,
} from '@/lib/mascot-lines'

type Reaction = 'jump' | 'wiggle' | 'pop' | 'dizzy' | 'love' | 'wake'
type Activity = 'hop' | 'stretch'
type Face = 'idle' | 'happy' | 'wink' | 'surprised' | 'dizzy' | 'love' | 'sleep' | 'yawn'
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
const WINE = '#7c2a47'

// Taps rotate through these so back-to-back taps never feel the same.
const CYCLE: Reaction[] = ['jump', 'wiggle', 'pop']

const LINES: Record<Reaction, string[]> = {
  jump: ['Yay!', 'Hi there!', 'Boing!'],
  wiggle: ['Hehe, that tickles!', 'Wheee!'],
  pop: ['Surprise!', 'Gift time!'],
  dizzy: ['Whoa… so dizzy!'],
  love: DEFAULT_ADDED_LINES,
  wake: ['Huh? I’m awake! 😳', 'Five more minutes… okay, I’m up!'],
}

const FACES: Record<Reaction, Face> = {
  jump: 'happy',
  wiggle: 'wink',
  pop: 'surprised',
  dizzy: 'dizzy',
  love: 'love',
  wake: 'surprised',
}

// Five quick taps inside this window make the buddy dizzy.
const DIZZY_TAPS = 5
const DIZZY_WINDOW_MS = 2500
const DIZZY_MS = 1600

// Nobody has touched the page for this long → nap time.
const SLEEP_AFTER_MS = 40_000
// Unprompted tips stay rare so the buddy doesn't nag.
const TIP_GAP_MS = 45_000
const MAX_TIPS_PER_PAGE = 2

const BODY_MOTION: Record<Reaction | Activity, TargetAndTransition> = {
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
  love: {
    y: [0, 3, -20, 0, -6, 0, -2, 0],
    scaleX: [1, 1.15, 0.9, 1.1, 0.96, 1.04, 1, 1],
    scaleY: [1, 0.82, 1.14, 0.9, 1.05, 0.97, 1, 1],
    transition: { duration: 1.1, ease: 'easeOut' },
  },
  wake: {
    y: [0, -10, 0, -3, 0],
    transition: { duration: 0.55, ease: 'easeOut' },
  },
  hop: {
    y: [0, 1.5, -7, 0, -2, 0],
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  stretch: {
    scaleY: [1, 1.14, 1.14, 0.94, 1],
    scaleX: [1, 0.93, 0.93, 1.05, 1],
    transition: { duration: 1.3, times: [0, 0.3, 0.65, 0.85, 1], ease: 'easeInOut' },
  },
}

const HEART_PATH =
  'M12 21s-6.7-4.35-9.33-8.1C.6 9.9 2.1 5.5 6.2 5.1c2.2-.2 3.9 1 5.8 3 1.9-2 3.6-3.2 5.8-3 4.1.4 5.6 4.8 3.53 7.8C18.7 16.65 12 21 12 21z'
const SPARKLE_PATH =
  'M12 2c.6 4.6 2.4 7.4 10 10-7.6 2.6-9.4 5.4-10 10-.6-4.6-2.4-7.4-10-10 7.6-2.6 9.4-5.4 10-10z'

function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

/** Long lines stay up longer so they can be read. */
function lineDuration(text: string) {
  return Math.min(4800, Math.max(1800, 1800 + (text.length - 18) * 55))
}

function burst(reaction: Reaction, seed: number): Particle[] {
  const kind = reaction === 'jump' || reaction === 'wiggle' || reaction === 'love' ? 'heart' : 'sparkle'
  const count = reaction === 'love' ? 7 : reaction === 'wiggle' || reaction === 'wake' ? 3 : reaction === 'dizzy' ? 4 : 5
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
  if (face === 'love') {
    return (
      <path
        d={`M${cx} ${cy + 2.4}C${cx - 3.4} ${cy}${cx - 2.9} ${cy - 2.6}${cx - 1.4} ${cy - 2.3}C${cx - 0.6} ${cy - 2.1}${cx} ${cy - 1.3}${cx} ${cy - 1.3}C${cx} ${cy - 1.3}${cx + 0.6} ${cy - 2.1}${cx + 1.4} ${cy - 2.3}C${cx + 2.9} ${cy - 2.6}${cx + 3.4} ${cy}${cx} ${cy + 2.4}Z`}
        fill={WINE}
      />
    )
  }
  if (face === 'sleep' || face === 'yawn') {
    return <path d={`M${cx - 2.2} ${cy - 0.4}Q${cx} ${cy + 1.8} ${cx + 2.2} ${cy - 0.4}`} {...stroke} />
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
    case 'love':
      return (
        <g>
          <path d="M20.8 33.8Q24 39 27.2 33.8Z" fill={INK} />
          <ellipse cx={24} cy={35.6} rx={1.6} ry={0.8} fill={TONGUE} />
        </g>
      )
    case 'surprised':
      return <ellipse cx={24} cy={35.3} rx={1.6} ry={2} fill={INK} />
    case 'yawn':
      return <ellipse cx={24} cy={35.4} rx={2.2} ry={2.6} fill={INK} />
    case 'sleep':
      return <ellipse cx={24} cy={35} rx={0.9} ry={1.1} fill={INK} />
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
 * Lines for a product page: rules right away, then Workers AI lines from
 * `/api/mascot/product/[id]` when they arrive. The intro waits briefly for the
 * AI so the first thing the buddy says is the cute one.
 */
export function useProductMascot(product: (MascotProduct & { id: string }) | null) {
  const [script, setScript] = useState<MascotScript | undefined>(undefined)
  const productId = product?.id

  useEffect(() => {
    if (!product || !productId) {
      setScript(undefined)
      return
    }
    const local = productMascotScript(product)
    setScript({ lines: local.lines, added: local.added })

    let cancelled = false
    let introShown = false
    const showIntro = (intro: string | undefined) => {
      if (cancelled || introShown) return
      introShown = true
      setScript((prev) => ({ ...(prev ?? local), intro: intro || local.intro }))
    }
    const startedAt = Date.now()
    const fallback = setTimeout(() => showIntro(local.intro), 2500)

    fetch(`/api/mascot/product/${encodeURIComponent(productId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: (MascotScript & { source?: string }) | null) => {
        if (cancelled || !data) return
        let lines = Array.isArray(data.lines) ? data.lines.filter((l) => typeof l === 'string') : local.lines
        // Too late for the intro: save the AI's opener for the first tap instead.
        if (introShown && data.intro) lines = [data.intro, ...lines]
        const added = Array.isArray(data.added) && data.added.length > 0 ? data.added : local.added
        setScript((prev) => ({ ...prev, lines, added }))
        // Give the page a beat to settle before the buddy pipes up.
        const wait = Math.max(0, 900 - (Date.now() - startedAt))
        setTimeout(() => showIntro(data.intro), wait)
      })
      .catch(() => null)

    return () => {
      cancelled = true
      clearTimeout(fallback)
    }
    // Only re-run for a different product; the object identity changes on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  return script
}

/**
 * Gift-box buddy that peeks over the bottom nav and reacts when tapped.
 * Position it with `className`; it sits behind its container (z -1) so the
 * bar hides the bottom of the box. The container must form a stacking context.
 *
 * Besides taps it celebrates cart additions, follows the pointer with its
 * eyes, glances around, naps when the page is left alone, and says the
 * page's `script` lines (an `intro` plays once per `scriptKey`).
 */
export default function NavMascot({
  className = '',
  hidden = false,
  script,
  scriptKey,
}: {
  className?: string
  hidden?: boolean
  script?: MascotScript
  scriptKey?: string
}) {
  const reduceMotion = useReducedMotion()
  const body = useAnimationControls()
  const spin = useAnimationControls()
  const lid = useAnimationControls()
  const gazeX = useSpring(0, { stiffness: 220, damping: 22 })
  const gazeY = useSpring(0, { stiffness: 220, damping: 22 })
  const cartCount = useCartStore((s) => s.getTotalItems())
  const [face, setFace] = useState<Face>('idle')
  const [blink, setBlink] = useState(false)
  const [asleep, setAsleep] = useState(false)
  const [line, setLine] = useState<{ id: number; text: string } | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const buttonRef = useRef<HTMLButtonElement>(null)
  const cycleRef = useRef(0)
  const tapCountRef = useRef(0)
  const scriptIndexRef = useRef(0)
  const tapsRef = useRef<number[]>([])
  const dizzyUntilRef = useRef(0)
  const busyUntilRef = useRef(0)
  const lookingUntilRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const lastTipRef = useRef(Date.now())
  const tipsRef = useRef(0)
  const seedRef = useRef(0)
  const introKeyRef = useRef<string | undefined>(undefined)
  const cartRef = useRef<{ count: number; warmUntil: number }>({ count: cartCount, warmUntil: Date.now() + 1500 })
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const faceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lineTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Latest values for timers and listeners that outlive a render.
  const live = useRef({ hidden, asleep, script, reduceMotion })
  live.current = { hidden, asleep, script, reduceMotion }

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t)
      fn()
    }, ms)
    timersRef.current.add(t)
    return t
  }

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

  const setFaceFor = (next: Face, ms: number) => {
    setFace(next)
    clearTimeout(faceTimerRef.current)
    faceTimerRef.current = setTimeout(() => setFace(live.current.asleep ? 'sleep' : 'idle'), ms)
  }

  const say = (text: string) => {
    const ms = lineDuration(text)
    const seed = ++seedRef.current
    setLine({ id: seed, text })
    clearTimeout(lineTimerRef.current)
    lineTimerRef.current = setTimeout(() => setLine(null), ms)
    busyUntilRef.current = Math.max(busyUntilRef.current, Date.now() + ms)
  }

  const nextScriptLine = () => {
    const lines = live.current.script?.lines ?? []
    if (lines.length === 0) return undefined
    const text = lines[scriptIndexRef.current % lines.length]
    scriptIndexRef.current += 1
    return text
  }

  const move = async (kind: Reaction | Activity) => {
    if (live.current.reduceMotion) return
    body.stop()
    spin.stop()
    lid.stop()
    body.set({ y: 0, rotate: 0, scaleX: 1, scaleY: 1 })
    spin.set({ rotate: 0 })
    lid.set({ y: 0, rotate: 0 })

    if (kind === 'pop' || kind === 'wake') {
      const big = kind === 'pop'
      lid.start({
        y: [0, big ? -11 : -6, big ? -11 : -6, 0],
        rotate: [0, big ? -16 : 10, big ? 8 : -4, 0],
        transition: { duration: big ? 0.75 : 0.5, times: [0, 0.3, 0.6, 1], ease: 'easeOut' },
      })
    }
    if (kind === 'dizzy') {
      spin.start({ rotate: [0, 360], transition: { duration: 0.9, ease: 'easeInOut' } })
    }
    await body.start(BODY_MOTION[kind])
  }

  const react = (reaction: Reaction, text?: string) => {
    const now = Date.now()
    if (typeof navigator !== 'undefined' && reaction !== 'love') navigator.vibrate?.(10)

    setFaceFor(FACES[reaction], reaction === 'dizzy' ? DIZZY_MS : reaction === 'love' ? 1500 : 1100)
    say(text ?? pick(LINES[reaction]))
    busyUntilRef.current = Math.max(busyUntilRef.current, now + 1200)

    if (live.current.reduceMotion) return
    const seed = seedRef.current
    const fresh = burst(reaction, seed)
    setParticles((prev) => [...prev, ...fresh])
    later(() => {
      const ids = new Set(fresh.map((p) => p.id))
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)))
    }, 1300)
    void move(reaction)
  }

  const wake = (quietly: boolean) => {
    setAsleep(false)
    lastActivityRef.current = Date.now()
    if (quietly) {
      setFaceFor('yawn', 900)
      void move('stretch')
    } else {
      react('wake')
    }
  }

  const onTap = () => {
    const now = Date.now()
    lastActivityRef.current = now
    if (live.current.asleep) {
      wake(false)
      return
    }
    // Let the dizzy spell play out instead of cutting it short.
    if (now < dizzyUntilRef.current) return
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < DIZZY_WINDOW_MS), now]

    if (tapsRef.current.length >= DIZZY_TAPS) {
      tapsRef.current = []
      dizzyUntilRef.current = now + DIZZY_MS
      react('dizzy')
      return
    }

    const reaction = CYCLE[cycleRef.current % CYCLE.length]
    cycleRef.current += 1
    // Every other tap shares something about the page instead of a squeak.
    const scripted = tapCountRef.current % 2 === 0 ? nextScriptLine() : undefined
    tapCountRef.current += 1
    react(reaction, scripted)
  }

  // Intro: once per script key, after the buddy is on screen.
  useEffect(() => {
    const intro = script?.intro
    if (!intro || introKeyRef.current === (scriptKey ?? intro)) return
    introKeyRef.current = scriptKey ?? intro
    let tries = 0
    const attempt = () => {
      if (live.current.hidden && tries++ < 20) {
        later(attempt, 1000)
        return
      }
      if (live.current.asleep) setAsleep(false)
      lastActivityRef.current = Date.now()
      lastTipRef.current = Date.now()
      react('pop', intro)
    }
    later(attempt, 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.intro, scriptKey])

  // New page or product: start the line rotation and tip budget over.
  useEffect(() => {
    scriptIndexRef.current = 0
    tipsRef.current = 0
  }, [scriptKey])

  // Celebrate whenever something lands in the cart (but not on page load).
  useEffect(() => {
    const prev = cartRef.current
    const now = Date.now()
    if (now < prev.warmUntil) {
      cartRef.current = { ...prev, count: cartCount }
      return
    }
    if (cartCount > prev.count) {
      if (live.current.asleep) setAsleep(false)
      lastActivityRef.current = now
      react('love', pick(live.current.script?.added?.length ? live.current.script.added : DEFAULT_ADDED_LINES))
    }
    cartRef.current = { ...prev, count: cartCount }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartCount])

  // Eyes follow the pointer (and glance at taps on touch screens).
  useEffect(() => {
    if (reduceMotion) return
    let frame = 0
    let lastBump = 0
    const onPointer = (event: PointerEvent) => {
      const now = Date.now()
      if (now - lastBump > 1000) {
        lastBump = now
        lastActivityRef.current = now
        if (live.current.asleep && !buttonRef.current?.contains(event.target as Node)) wake(true)
      }
      if (frame || now < lookingUntilRef.current) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const el = buttonRef.current
        if (!el || live.current.hidden) return
        const r = el.getBoundingClientRect()
        const dx = event.clientX - (r.left + r.width / 2)
        const dy = event.clientY - (r.top + r.height * 0.65)
        const dist = Math.hypot(dx, dy) || 1
        const reach = Math.min(1, dist / 140)
        gazeX.set((dx / dist) * 1.4 * reach)
        gazeY.set((dy / dist) * 1.1 * reach)
      })
    }
    const onOther = () => {
      lastActivityRef.current = Date.now()
      if (live.current.asleep) wake(true)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('keydown', onOther)
    window.addEventListener('scroll', onOther, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onOther)
      window.removeEventListener('scroll', onOther)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion])

  // Little things it does on its own: look around, hop, stretch, nap, share a tip.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      timer = setTimeout(() => {
        const now = Date.now()
        const { hidden: isHidden, asleep: isAsleep, script: current, reduceMotion: still } = live.current
        const quiet = isHidden || isAsleep || document.hidden || now < busyUntilRef.current
        if (!quiet) {
          const idleFor = now - lastActivityRef.current
          if (idleFor > SLEEP_AFTER_MS) {
            setAsleep(true)
            setFace('sleep')
            gazeX.set(0)
            gazeY.set(0)
          } else {
            const roll = Math.random()
            const canTip =
              (current?.lines?.length ?? 0) > 0 &&
              tipsRef.current < MAX_TIPS_PER_PAGE &&
              now - lastTipRef.current > TIP_GAP_MS
            if (canTip && roll < 0.35) {
              tipsRef.current += 1
              lastTipRef.current = now
              setFaceFor('happy', 1200)
              const text = nextScriptLine()
              if (text) say(text)
              void move('hop')
            } else if (roll < 0.7 && !still) {
              // Glance left, then right, then back.
              lookingUntilRef.current = now + 1800
              gazeX.set(-1.5)
              gazeY.set(-0.2)
              later(() => gazeX.set(1.5), 650)
              later(() => {
                gazeX.set(0)
                gazeY.set(0)
              }, 1350)
            } else if (idleFor > 15_000) {
              setFaceFor('yawn', 1200)
              void move('stretch')
            } else {
              void move('hop')
            }
          }
        }
        tick()
      }, 8000 + Math.random() * 7000)
    }
    tick()
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shownFace: Face = asleep && face === 'idle' ? 'sleep' : face

  return (
    <motion.div
      className={`pointer-events-none absolute -z-10 h-11 w-11 ${className}`}
      initial={false}
      animate={{ y: hidden ? 56 : 7, opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <motion.div
        className="h-full w-full"
        animate={reduceMotion ? undefined : asleep ? { y: [0, 1, 0] } : { y: [0, -1.5, 0] }}
        transition={{ duration: asleep ? 3.6 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div className="h-full w-full" style={{ originY: 1 }} animate={body}>
          <motion.button
            ref={buttonRef}
            type="button"
            onClick={onTap}
            aria-label={asleep ? 'Gift buddy is napping — tap to wake it' : 'Gift buddy — tap to say hi'}
            className="pointer-events-auto block h-full w-full touch-manipulation select-none outline-none [-webkit-tap-highlight-color:transparent] focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-blush/60"
            animate={spin}
          >
            <svg viewBox="0 0 48 48" className="h-full w-full overflow-visible" aria-hidden>
              {/* White sticker edge keeps the box readable on the pink delivery chip. */}
              <rect x={9} y={22} width={30} height={21} rx={6} fill={BLUSH} stroke="#fff" strokeWidth={1.4} />
              <rect x={12} y={26} width={2.6} height={9} rx={1.3} fill="#fff" opacity={0.28} />
              <ellipse cx={15.6} cy={34.2} rx={2.4} ry={1.5} fill={CHEEK} opacity={0.85} />
              <ellipse cx={32.4} cy={34.2} rx={2.4} ry={1.5} fill={CHEEK} opacity={0.85} />
              <motion.g style={{ x: gazeX, y: gazeY }}>
                <Eye face={shownFace} blink={blink} cx={19} side="left" />
                <Eye face={shownFace} blink={blink} cx={29} side="right" />
              </motion.g>
              <Mouth face={shownFace} />
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

      {asleep
        ? [0, 1, 2].map((i) => (
            <motion.span
              key={`z${i}`}
              aria-hidden
              className="pointer-events-none absolute left-[70%] top-0 select-none font-semibold text-wine/70"
              style={{ fontSize: 9 + i * 2 }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={reduceMotion ? { opacity: 0.8 } : { opacity: [0, 1, 0], x: [0, 6 + i * 3], y: [0, -16 - i * 6] }}
              transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity, ease: 'easeOut' }}
            >
              z
            </motion.span>
          ))
        : null}

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
              className="absolute bottom-0 left-0 w-max max-w-[min(210px,58vw)] origin-bottom-left rounded-2xl rounded-bl-md border border-wine/10 bg-white px-2.5 py-1 text-[11px] font-semibold leading-snug text-ink shadow-[0_8px_20px_-10px_rgba(43,29,34,0.45)]"
              initial={{ opacity: 0, scale: 0.6, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            >
              {/* Re-keyed per line so a new one pops in place instead of stacking bubbles. */}
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
