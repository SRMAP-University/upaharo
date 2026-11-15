/**
 * Gift Catch game engine (canvas, full screen).
 *
 * Ride the Upaharo scooter along a Kathmandu street and catch falling gifts
 * in the crate. Avoid rain and storm clouds. Power-ups: magnet, +5 seconds,
 * double points. Speeds up, then "Golden rain" in the last 10 seconds.
 * Combos multiply points (up to x4). Sounds via WebAudio, haptics on phones.
 */

export const GAME_SECONDS = 45

type Good = 'gift' | 'giftBlue' | 'cake' | 'bouquet' | 'gold'
type Bad = 'cloud' | 'storm'
type Power = 'magnet' | 'clock' | 'double'
type Kind = Good | Bad | Power

const VALUES: Record<Good, number> = { gift: 1, giftBlue: 1, cake: 2, bouquet: 3, gold: 5 }
const isGood = (k: Kind): k is Good => k in VALUES
const isPower = (k: Kind): k is Power => k === 'magnet' || k === 'clock' || k === 'double'

type Item = { kind: Kind; x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; born: number }
type Popup = { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; shape: 'dot' | 'heart' | 'star' | 'drop' }
type Banner = { text: string; sub?: string; life: number; max: number; color: string }

const INK = '#2A2024'
const RED = '#E8322B'
const RED_DARK = '#C42520'
const RED_SOFT = '#FDE3E1'
const GOLD = '#F5B83D'
const GOLD_DEEP = '#E09A12'
const TEAL = '#2BA88A'
const TAN = '#E9C6A3'
const FLAG_COLOURS = ['#6F8FE8', '#FFFFFF', '#E8605A', '#4FB38A', '#F5C04D']

export type GameCallbacks = {
  onEnd: (score: number) => void
  tiers: Array<{ min: number; percent: number }>
}

// ---------------------------------------------------------------- small drawing helpers

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function fs(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, stroke = true) {
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) ctx.stroke()
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + 0.35 * s)
  ctx.bezierCurveTo(x - 0.62 * s, y - 0.05 * s, x - 0.45 * s, y - 0.62 * s, x, y - 0.25 * s)
  ctx.bezierCurveTo(x + 0.45 * s, y - 0.62 * s, x + 0.62 * s, y - 0.05 * s, x, y + 0.35 * s)
  ctx.closePath()
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
  }
  ctx.closePath()
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, c0: string, c1: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, c0)
  g.addColorStop(1, c1)
  return g
}

// ---------------------------------------------------------------- item sprites (centred, size s)

function drawGiftBox(ctx: CanvasRenderingContext2D, s: number, box: string, boxDark: string, ribbon: string) {
  // body with soft shading
  rr(ctx, -0.4 * s, -0.16 * s, 0.8 * s, 0.56 * s, 0.07 * s)
  fs(ctx, vgrad(ctx, -0.16 * s, 0.4 * s, box, boxDark))
  rr(ctx, -0.46 * s, -0.31 * s, 0.92 * s, 0.18 * s, 0.05 * s)
  fs(ctx, box)
  ctx.beginPath()
  ctx.rect(-0.07 * s, -0.31 * s, 0.14 * s, 0.71 * s)
  fs(ctx, ribbon)
  // shine
  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.fillStyle = '#fff'
  rr(ctx, -0.34 * s, -0.1 * s, 0.07 * s, 0.38 * s, 0.03 * s)
  ctx.fill()
  ctx.restore()
  // bow
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(dir * 0.16 * s, -0.41 * s, 0.17 * s, 0.09 * s, dir * 0.45, 0, Math.PI * 2)
    fs(ctx, ribbon)
    ctx.beginPath()
    ctx.moveTo(dir * 0.04 * s, -0.33 * s)
    ctx.quadraticCurveTo(dir * 0.12 * s, -0.24 * s, dir * 0.17 * s, -0.2 * s)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, -0.36 * s, 0.06 * s, 0, Math.PI * 2)
  fs(ctx, ribbon)
}

function drawCake(ctx: CanvasRenderingContext2D, s: number, t: number) {
  ctx.beginPath()
  ctx.ellipse(0, 0.43 * s, 0.52 * s, 0.07 * s, 0, 0, Math.PI * 2)
  fs(ctx, '#fff')
  rr(ctx, -0.42 * s, 0.03 * s, 0.84 * s, 0.38 * s, 0.08 * s)
  fs(ctx, vgrad(ctx, 0, 0.4 * s, '#FFE1E6', '#F7B9C6'))
  // drips
  ctx.beginPath()
  ctx.moveTo(-0.42 * s, 0.1 * s)
  for (let i = 0; i < 6; i++) {
    const x0 = -0.42 * s + (i * 0.84 * s) / 6
    ctx.quadraticCurveTo(x0 + 0.07 * s, 0.22 * s, x0 + 0.14 * s, 0.1 * s)
  }
  ctx.lineTo(0.42 * s, 0.03 * s)
  ctx.lineTo(-0.42 * s, 0.03 * s)
  ctx.closePath()
  fs(ctx, '#fff')
  rr(ctx, -0.28 * s, -0.26 * s, 0.56 * s, 0.31 * s, 0.07 * s)
  fs(ctx, vgrad(ctx, -0.26 * s, 0.05 * s, '#ffffff', '#F3E6EA'))
  // sprinkles
  const sp = ['#E8322B', '#6F8FE8', '#F5B83D', '#4FB38A']
  for (let i = 0; i < 7; i++) {
    ctx.save()
    ctx.fillStyle = sp[i % 4]
    ctx.translate((-0.3 + i * 0.1) * s, (i % 2 ? 0.28 : 0.33) * s)
    ctx.rotate(i)
    ctx.fillRect(-0.025 * s, -0.008 * s, 0.05 * s, 0.016 * s)
    ctx.restore()
  }
  ctx.save()
  ctx.strokeStyle = RED
  ctx.lineWidth = 0.05 * s
  ctx.beginPath()
  ctx.moveTo(-0.24 * s, -0.1 * s)
  ctx.lineTo(0.24 * s, -0.1 * s)
  ctx.stroke()
  ctx.restore()
  // candle + flicker
  rr(ctx, -0.045 * s, -0.48 * s, 0.09 * s, 0.22 * s, 0.03 * s)
  fs(ctx, GOLD)
  ctx.save()
  ctx.shadowColor = 'rgba(255,170,60,0.9)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.ellipse(0, -0.57 * s, 0.05 * s, (0.08 + Math.sin(t * 22) * 0.012) * s, Math.sin(t * 9) * 0.15, 0, Math.PI * 2)
  ctx.fillStyle = '#FF8A3D'
  ctx.fill()
  ctx.restore()
}

function drawBouquet(ctx: CanvasRenderingContext2D, s: number) {
  for (const [dx, dy, rot] of [[-0.32, -0.18, 0.7], [0.32, -0.2, -0.7], [-0.15, -0.42, 0.2], [0.18, -0.44, -0.25]] as const) {
    ctx.beginPath()
    ctx.ellipse(dx * s, dy * s, 0.08 * s, 0.17 * s, rot, 0, Math.PI * 2)
    fs(ctx, '#A9D9C2')
  }
  const rose = (x: number, y: number, r: number, c: string, cd: string) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    fs(ctx, vgrad(ctx, y - r, y + r, c, cd))
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(x, y, r * 0.55, 0.3, Math.PI * 1.6)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + r * 0.08, y + r * 0.05, r * 0.25, 2, Math.PI * 3.2)
    ctx.stroke()
    ctx.restore()
  }
  rose(-0.2 * s, -0.12 * s, 0.17 * s, '#FFD36B', GOLD_DEEP)
  rose(0.21 * s, -0.12 * s, 0.17 * s, '#FFB3C4', '#F27A98')
  rose(0, -0.3 * s, 0.2 * s, '#FF5A4F', RED_DARK)
  ctx.beginPath()
  ctx.moveTo(-0.36 * s, -0.02 * s)
  ctx.lineTo(0.36 * s, -0.02 * s)
  ctx.lineTo(0.08 * s, 0.5 * s)
  ctx.lineTo(-0.08 * s, 0.5 * s)
  ctx.closePath()
  fs(ctx, vgrad(ctx, 0, 0.5 * s, '#FFF3F5', RED_SOFT))
  ctx.beginPath()
  ctx.moveTo(-0.1 * s, -0.02 * s)
  ctx.lineTo(0.02 * s, 0.5 * s)
  ctx.stroke()
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(dir * 0.09 * s, 0.2 * s, 0.09 * s, 0.05 * s, dir * 0.5, 0, Math.PI * 2)
    fs(ctx, RED)
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, s: number, t: number, storm: boolean) {
  const body = storm ? '#7D8AA6' : '#D7DFEC'
  const line = storm ? '#4D5873' : '#8C9AB8'
  ctx.save()
  ctx.strokeStyle = line
  ctx.beginPath()
  ctx.moveTo(-0.46 * s, 0.12 * s)
  ctx.arc(-0.26 * s, 0.02 * s, 0.2 * s, Math.PI * 0.9, Math.PI * 1.75)
  ctx.arc(0.02 * s, -0.12 * s, 0.27 * s, Math.PI * 1.15, Math.PI * 1.95)
  ctx.arc(0.3 * s, 0.04 * s, 0.18 * s, Math.PI * 1.35, Math.PI * 0.35)
  ctx.closePath()
  fs(ctx, vgrad(ctx, -0.4 * s, 0.2 * s, storm ? '#9AA6C0' : '#EEF2F8', body))
  // grumpy face
  ctx.fillStyle = storm ? '#2A2F40' : '#56607A'
  ctx.beginPath()
  ctx.arc(-0.1 * s, 0.0, 0.03 * s, 0, Math.PI * 2)
  ctx.arc(0.1 * s, 0.0, 0.03 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.lineWidth = 1.5
  ctx.arc(0, 0.12 * s, 0.07 * s, Math.PI * 1.15, Math.PI * 1.85)
  ctx.stroke()
  if (storm) {
    ctx.fillStyle = GOLD
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0.02 * s, 0.2 * s)
    ctx.lineTo(-0.1 * s, 0.42 * s)
    ctx.lineTo(0.0, 0.4 * s)
    ctx.lineTo(-0.06 * s, 0.6 * s)
    ctx.lineTo(0.12 * s, 0.33 * s)
    ctx.lineTo(0.02 * s, 0.35 * s)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.strokeStyle = '#6F8FE8'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const x = (-0.22 + i * 0.22) * s
      const off = ((t * 3 + i * 0.3) % 1) * 0.12 * s
      ctx.beginPath()
      ctx.moveTo(x, 0.28 * s + off)
      ctx.lineTo(x - 0.04 * s, 0.4 * s + off)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawPower(ctx: CanvasRenderingContext2D, kind: Power, s: number, t: number) {
  // glowing bubble
  ctx.save()
  ctx.shadowColor = 'rgba(111,143,232,0.7)'
  ctx.shadowBlur = 12 + Math.sin(t * 6) * 4
  ctx.beginPath()
  ctx.arc(0, 0, 0.5 * s, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(-0.15 * s, -0.2 * s, 0.05 * s, 0, 0, 0.5 * s)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#DCE6FF')
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#6F8FE8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 0.5 * s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = INK
  if (kind === 'magnet') {
    ctx.lineWidth = 0.13 * s
    ctx.strokeStyle = RED
    ctx.beginPath()
    ctx.arc(0, -0.02 * s, 0.2 * s, Math.PI, 0)
    ctx.lineTo(0.2 * s, 0.2 * s)
    ctx.moveTo(-0.2 * s, -0.02 * s)
    ctx.lineTo(-0.2 * s, 0.2 * s)
    ctx.stroke()
    ctx.strokeStyle = '#D8DDE6'
    ctx.beginPath()
    ctx.moveTo(-0.2 * s, 0.13 * s)
    ctx.lineTo(-0.2 * s, 0.24 * s)
    ctx.moveTo(0.2 * s, 0.13 * s)
    ctx.lineTo(0.2 * s, 0.24 * s)
    ctx.stroke()
  } else if (kind === 'clock') {
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0.02 * s, 0.25 * s, 0, Math.PI * 2)
    fs(ctx, '#fff')
    ctx.beginPath()
    ctx.moveTo(0, 0.02 * s)
    ctx.lineTo(0, -0.14 * s)
    ctx.moveTo(0, 0.02 * s)
    ctx.lineTo(0.11 * s, 0.08 * s)
    ctx.stroke()
    ctx.fillStyle = TEAL
    ctx.font = `800 ${0.2 * s}px system-ui`
    ctx.textAlign = 'center'
    ctx.fillText('+5', 0.27 * s, -0.24 * s)
  } else {
    ctx.lineWidth = 2
    star(ctx, 0, 0, 0.3 * s)
    fs(ctx, GOLD)
    ctx.fillStyle = INK
    ctx.font = `800 ${0.2 * s}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('×2', 0, 0.02 * s)
    ctx.textBaseline = 'alphabetic'
  }
}

// ---------------------------------------------------------------- the scooter (player)

function drawScooter(
  ctx: CanvasRenderingContext2D,
  k: number,
  o: { lean: number; wheel: number; facing: number; squash: number; stun: number; t: number; bob: number }
) {
  ctx.save()
  ctx.scale(k * o.facing, k)
  ctx.rotate(o.lean * o.facing)
  ctx.translate(0, o.bob)
  ctx.lineWidth = 2 / k
  ctx.strokeStyle = INK
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // shadow
  ctx.save()
  ctx.fillStyle = 'rgba(42,32,36,0.15)'
  ctx.beginPath()
  ctx.ellipse(0, 15, 58, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // crate on the back (the catch zone)
  ctx.save()
  ctx.translate(-38, -48)
  ctx.scale(1 + o.squash * 0.08, 1 - o.squash * 0.12)
  rr(ctx, -32, -18, 64, 36, 4)
  fs(ctx, vgrad(ctx, -18, 18, '#F7C860', GOLD_DEEP))
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(160,100,20,0.55)'
  ctx.lineWidth = 1.5
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 12, -18)
    ctx.lineTo(i * 12, 18)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(-32, 2)
  ctx.lineTo(32, 2)
  ctx.stroke()
  ctx.restore()
  rr(ctx, -35, -22, 70, 8, 3)
  fs(ctx, '#FFD87A')
  // tiny brand tag
  rr(ctx, -12, -6, 24, 12, 3)
  fs(ctx, RED)
  ctx.fillStyle = '#fff'
  ctx.font = '800 9px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('U', 0, 0.5)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
  // rack
  ctx.beginPath()
  ctx.moveTo(-64, -28)
  ctx.lineTo(-12, -28)
  ctx.stroke()

  // wheels
  for (const wx of [-34, 34]) {
    ctx.save()
    ctx.translate(wx, 0)
    ctx.beginPath()
    ctx.arc(0, 0, 14, 0, Math.PI * 2)
    fs(ctx, '#3A3236')
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    fs(ctx, '#EDE7EA')
    ctx.rotate(o.wheel)
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3
      ctx.moveTo(Math.cos(a) * -7, Math.sin(a) * -7)
      ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7)
    }
    ctx.stroke()
    ctx.restore()
  }

  // body
  ctx.beginPath()
  ctx.moveTo(-52, -6)
  ctx.bezierCurveTo(-54, -26, -36, -34, -18, -32)
  ctx.lineTo(10, -32)
  ctx.bezierCurveTo(16, -32, 16, -26, 12, -20)
  ctx.lineTo(8, -10)
  ctx.lineTo(26, -10)
  ctx.lineTo(32, -46)
  ctx.bezierCurveTo(33, -52, 40, -54, 43, -50)
  ctx.lineTo(50, -8)
  ctx.bezierCurveTo(52, -2, 46, 0, 40, -2)
  ctx.lineTo(-44, -2)
  ctx.closePath()
  fs(ctx, vgrad(ctx, -54, 0, '#FF5A4F', RED_DARK))
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(-40, -26)
  ctx.quadraticCurveTo(-28, -30, -14, -29)
  ctx.stroke()
  ctx.restore()
  // front fender
  ctx.beginPath()
  ctx.moveTo(22, -6)
  ctx.bezierCurveTo(26, -18, 44, -18, 48, -6)
  ctx.closePath()
  fs(ctx, RED)
  // seat
  rr(ctx, -20, -40, 34, 9, 4)
  fs(ctx, INK)
  // handlebar + headlight
  ctx.beginPath()
  ctx.moveTo(38, -50)
  ctx.lineTo(40, -60)
  ctx.moveTo(34, -61)
  ctx.lineTo(48, -63)
  ctx.stroke()
  ctx.save()
  ctx.shadowColor = 'rgba(255,214,107,0.9)'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(47, -47, 4, 0, Math.PI * 2)
  fs(ctx, '#FFE38A')
  ctx.restore()

  // rider (wobbles when it rains on them)
  ctx.save()
  ctx.translate(0, 0)
  if (o.stun > 0) ctx.rotate(Math.sin(o.t * 40) * 0.05)
  // leg
  ctx.lineWidth = 6
  ctx.strokeStyle = '#3A3236'
  ctx.beginPath()
  ctx.moveTo(0, -40)
  ctx.lineTo(16, -26)
  ctx.lineTo(24, -12)
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  // torso
  ctx.beginPath()
  ctx.moveTo(-8, -40)
  ctx.bezierCurveTo(-10, -56, -2, -72, 8, -74)
  ctx.lineTo(18, -71)
  ctx.bezierCurveTo(19, -58, 14, -46, 10, -40)
  ctx.closePath()
  fs(ctx, vgrad(ctx, -74, -40, '#3CC09D', TEAL))
  // arm
  ctx.lineWidth = 4
  ctx.strokeStyle = '#21866E'
  ctx.beginPath()
  ctx.moveTo(10, -66)
  ctx.lineTo(28, -58)
  ctx.lineTo(38, -61)
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  // head + helmet
  ctx.beginPath()
  ctx.arc(10, -84, 10, 0, Math.PI * 2)
  fs(ctx, TAN)
  ctx.beginPath()
  ctx.arc(10, -86, 11.5, Math.PI * 1.02, Math.PI * 2.02)
  ctx.lineTo(21, -82)
  ctx.lineTo(-1, -82)
  ctx.closePath()
  fs(ctx, vgrad(ctx, -98, -82, '#FF6A5F', RED_DARK))
  ctx.save()
  ctx.strokeStyle = '#fff'
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.moveTo(14, -85)
  ctx.lineTo(20, -85)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(15, -80, 1.4, 0, Math.PI * 2)
  ctx.fill()
  if (o.stun > 0) {
    // a little rain over the rider
    ctx.strokeStyle = '#6F8FE8'
    for (let i = 0; i < 4; i++) {
      const dx = -6 + i * 7
      const dy = ((o.t * 120 + i * 9) % 18) - 112
      ctx.beginPath()
      ctx.moveTo(dx, dy)
      ctx.lineTo(dx - 2, dy + 6)
      ctx.stroke()
    }
  }
  ctx.restore()
  ctx.restore()
}

// ---------------------------------------------------------------- sound (tiny synth, no files)

function makeSound() {
  let ac: AudioContext | null = null
  let muted = false
  const ensure = () => {
    if (!ac) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AC) ac = new AC()
    }
    if (ac?.state === 'suspended') void ac.resume()
    return ac
  }
  const tone = (freq: number, dur: number, type: OscillatorType, vol: number, slide?: number, delay = 0) => {
    if (muted) return
    const a = ensure()
    if (!a) return
    const t0 = a.currentTime + delay
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g).connect(a.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }
  return {
    unlock: ensure,
    setMuted(m: boolean) {
      muted = m
    },
    catch(combo: number) {
      tone(520 + Math.min(combo, 16) * 35, 0.09, 'triangle', 0.08)
    },
    gold() {
      ;[660, 880, 1100].forEach((f, i) => tone(f, 0.12, 'triangle', 0.08, undefined, i * 0.06))
    },
    bad() {
      tone(180, 0.25, 'sawtooth', 0.05, 90)
    },
    power() {
      tone(400, 0.25, 'sine', 0.1, 1200)
    },
    beep(high = false) {
      tone(high ? 880 : 520, 0.12, 'square', 0.04)
    },
    end() {
      ;[784, 659, 523, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, undefined, i * 0.12))
    },
  }
}

// ---------------------------------------------------------------- engine

export function createGiftCatch(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
  const ctx = canvas.getContext('2d')!
  const bg = document.createElement('canvas')
  const bgx = bg.getContext('2d')!
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'
  const sound = makeSound()

  let W = 0
  let H = 0
  let dpr = 1
  let PW = 0 // play-area width
  let OX = 0 // play-area left
  let groundY = 0
  let roadY = 0
  let k = 1 // scooter scale

  let mode: 'idle' | 'play' | 'over' = 'idle'
  let raf = 0
  let last = 0
  let clock = 0 // always running, for idle animation
  let t = 0
  let bonus = 0
  let score = 0
  let combo = 0
  let best = 0
  let items: Item[] = []
  let popups: Popup[] = []
  let sparks: Spark[] = []
  let banners: Banner[] = []
  let spawnIn = 0.5
  let x = 0
  let vx = 0
  let target = 0
  let keyDir = 0
  let facing = 1
  let wheel = 0
  let shake = 0
  let flash = 0
  let squash = 0
  let stun = 0
  let magnet = 0
  let double = 0
  let saidFaster = false
  let saidGolden = false
  let lastPowerAt = -10
  const clouds = [
    { x: 0.15, y: 0.16, s: 1, v: 6 },
    { x: 0.6, y: 0.1, s: 0.8, v: 4 },
    { x: 0.85, y: 0.24, s: 0.65, v: 8 },
  ]

  const duration = () => GAME_SECONDS + bonus
  const crateX = () => x - 38 * k * facing
  const crateTop = () => roadY - 84 * k

  // ---------------------------------------------- static background (drawn once per resize)
  function paintBackground() {
    bg.width = Math.round(W * dpr)
    bg.height = Math.round(H * dpr)
    const c = bgx
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.lineJoin = 'round'
    c.lineCap = 'round'
    // sky
    c.fillStyle = vgrad(c, 0, groundY, '#FFF7F2', '#FDE3EA')
    c.fillRect(0, 0, W, H)
    // sun
    const sx = OX + PW * 0.8
    const sy = H * 0.2
    const glow = c.createRadialGradient(sx, sy, 4, sx, sy, Math.min(W, H) * 0.16)
    glow.addColorStop(0, 'rgba(255, 214, 140, 0.9)')
    glow.addColorStop(1, 'rgba(255, 214, 140, 0)')
    c.fillStyle = glow
    c.fillRect(0, 0, W, H)
    c.fillStyle = '#FFE0A0'
    c.beginPath()
    c.arc(sx, sy, Math.min(W, H) * 0.045, 0, Math.PI * 2)
    c.fill()
    // far snowy range
    const far = groundY - H * 0.26
    c.fillStyle = '#F1E2EE'
    c.strokeStyle = '#E2C5D6'
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(0, far + 30)
    const peaks: Array<[number, number]> = []
    for (let px = -40; px < W + 80; px += 70) {
      const h = 50 + ((px * 37) % 60)
      peaks.push([px + 35, far - h])
      c.lineTo(px + 35, far - h)
      c.lineTo(px + 70, far + 10 - ((px * 13) % 20))
    }
    c.lineTo(W, groundY)
    c.lineTo(0, groundY)
    c.closePath()
    c.fill()
    c.stroke()
    c.fillStyle = '#fff'
    for (const [pxx, py] of peaks) {
      c.beginPath()
      c.moveTo(pxx - 10, py + 14)
      c.lineTo(pxx, py)
      c.lineTo(pxx + 10, py + 14)
      c.lineTo(pxx + 5, py + 11)
      c.lineTo(pxx, py + 16)
      c.lineTo(pxx - 5, py + 11)
      c.closePath()
      c.fill()
    }
    // middle hills
    c.fillStyle = '#FADCE3'
    c.strokeStyle = '#EDBDC7'
    c.beginPath()
    c.moveTo(0, groundY - H * 0.12)
    for (let px = 0; px <= W + 60; px += 60) {
      c.quadraticCurveTo(px + 30, groundY - H * (0.17 + ((px / 60) % 2) * 0.04), px + 60, groundY - H * 0.12)
    }
    c.lineTo(W, groundY)
    c.lineTo(0, groundY)
    c.closePath()
    c.fill()
    c.stroke()
    // skyline: houses, a pagoda and the stupa (muted so the gifts stand out)
    const base = groundY
    c.strokeStyle = 'rgba(42,32,36,0.35)'
    c.lineWidth = 1.2
    const house = (hx: number, w: number, h: number, roof: string) => {
      c.fillStyle = '#FFF4EC'
      c.fillRect(hx, base - h, w, h)
      c.strokeRect(hx, base - h, w, h)
      c.fillStyle = roof
      c.beginPath()
      c.moveTo(hx - 5, base - h)
      c.lineTo(hx + w / 2, base - h - w * 0.45)
      c.lineTo(hx + w + 5, base - h)
      c.closePath()
      c.fill()
      c.stroke()
      c.fillStyle = 'rgba(232,96,90,0.35)'
      for (let wy = base - h + 8; wy < base - 12; wy += 14) {
        for (let wx = hx + 6; wx < hx + w - 8; wx += 12) c.fillRect(wx, wy, 6, 7)
      }
    }
    const pagoda = (px: number) => {
      c.fillStyle = '#FFF4EC'
      c.fillRect(px - 14, base - 34, 28, 34)
      c.strokeRect(px - 14, base - 34, 28, 34)
      for (let i = 0; i < 3; i++) {
        const y = base - 34 - i * 16
        const w = 44 - i * 10
        c.fillStyle = '#C9493E'
        c.beginPath()
        c.moveTo(px - w / 2, y)
        c.lineTo(px - w / 2 + 8, y - 10)
        c.lineTo(px + w / 2 - 8, y - 10)
        c.lineTo(px + w / 2, y)
        c.closePath()
        c.fill()
        c.stroke()
      }
      c.fillStyle = GOLD
      c.beginPath()
      c.moveTo(px - 3, base - 82)
      c.lineTo(px, base - 94)
      c.lineTo(px + 3, base - 82)
      c.fill()
    }
    const stupa = (px: number) => {
      c.fillStyle = '#FFFDFB'
      c.fillRect(px - 34, base - 12, 68, 12)
      c.strokeRect(px - 34, base - 12, 68, 12)
      c.beginPath()
      c.arc(px, base - 12, 26, Math.PI, 0)
      c.fill()
      c.stroke()
      c.fillStyle = '#FFF0CC'
      c.fillRect(px - 9, base - 50, 18, 12)
      c.strokeRect(px - 9, base - 50, 18, 12)
      c.fillStyle = INK
      c.beginPath()
      c.ellipse(px - 4, base - 44, 2, 1, 0, 0, Math.PI * 2)
      c.ellipse(px + 4, base - 44, 2, 1, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = GOLD
      c.beginPath()
      c.moveTo(px - 7, base - 50)
      c.lineTo(px, base - 80)
      c.lineTo(px + 7, base - 50)
      c.closePath()
      c.fill()
      c.stroke()
    }
    let hx = -20
    let i = 0
    while (hx < W + 20) {
      if (i % 5 === 2) {
        pagoda(hx + 22)
        hx += 54
      } else {
        const w = 34 + ((i * 17) % 18)
        house(hx, w, 36 + ((i * 23) % 26), i % 2 ? '#C9493E' : '#B25A48')
        hx += w + 8
      }
      i++
    }
    stupa(OX + PW * 0.5)
    // grass strip and road
    c.fillStyle = '#CFEBDD'
    c.fillRect(0, groundY, W, roadY - groundY - 8)
    c.strokeStyle = '#7FBFA3'
    c.lineWidth = 1.4
    for (let gx = 6; gx < W; gx += 18) {
      c.beginPath()
      c.moveTo(gx, groundY + 8)
      c.lineTo(gx + 3, groundY + 2)
      c.moveTo(gx + 6, groundY + 9)
      c.lineTo(gx + 7, groundY + 3)
      c.stroke()
      if ((gx / 18) % 4 === 1) {
        c.fillStyle = ['#E8605A', '#F5C04D', '#fff'][(gx / 18) % 3]
        c.beginPath()
        c.arc(gx + 10, groundY + 6, 2.4, 0, Math.PI * 2)
        c.fill()
      }
    }
    c.fillStyle = vgrad(c, roadY - 8, H, '#E9DADF', '#DCC9CF')
    c.fillRect(0, roadY - 8, W, H - roadY + 8)
    c.strokeStyle = INK
    c.lineWidth = 1.6
    c.beginPath()
    c.moveTo(0, roadY - 8)
    c.lineTo(W, roadY - 8)
    c.stroke()
    c.strokeStyle = 'rgba(255,255,255,0.8)'
    c.lineWidth = 3
    c.setLineDash([18, 16])
    c.beginPath()
    c.moveTo(0, roadY + (H - roadY) * 0.55)
    c.lineTo(W, roadY + (H - roadY) * 0.55)
    c.stroke()
    c.setLineDash([])
    // soft edges outside the play area on wide screens
    if (W > PW + 20) {
      c.fillStyle = 'rgba(255,255,255,0.35)'
      c.fillRect(0, 0, OX, H)
      c.fillRect(OX + PW, 0, W - OX - PW, H)
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = rect.width
    H = rect.height
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    PW = Math.min(W, 560)
    OX = (W - PW) / 2
    roadY = H - Math.max(54, H * 0.08)
    groundY = roadY - Math.max(26, H * 0.04)
    k = Math.max(0.78, Math.min(1.15, PW / 420))
    if (!x) x = target = OX + PW / 2
    paintBackground()
  }

  // ---------------------------------------------- gameplay
  function say(text: string, color = RED, sub?: string, life = 1.3) {
    banners.push({ text, sub, life, max: life, color })
  }

  function spawn() {
    const p = t / duration()
    const golden = duration() - t <= 10
    const table: Array<[Kind, number]> = [
      ['gift', 0.34 - 0.08 * p],
      ['giftBlue', 0.1],
      ['cake', 0.18],
      ['bouquet', 0.12],
      ['gold', golden ? 0.16 : 0.04],
      ['cloud', 0.11 + 0.08 * p],
      ['storm', t > 20 ? 0.05 : 0],
    ]
    if (t - lastPowerAt > 6 && !items.some((it) => isPower(it.kind))) {
      table.push(['magnet', 0.025], ['clock', 0.02], ['double', 0.025])
    }
    let roll = Math.random() * table.reduce((s, [, w]) => s + w, 0)
    let kind: Kind = 'gift'
    for (const [kk, w] of table) {
      roll -= w
      if (roll <= 0) {
        kind = kk
        break
      }
    }
    if (isPower(kind)) lastPowerAt = t
    const size = Math.max(42, Math.min(60, PW * 0.13)) * (kind === 'cloud' || kind === 'storm' ? 1.25 : isPower(kind) ? 1.05 : 1)
    items.push({
      kind,
      x: OX + size / 2 + Math.random() * (PW - size),
      y: -size,
      vx: (Math.random() - 0.5) * 20,
      vy: (H * 0.27 + H * 0.34 * p) * (0.85 + Math.random() * 0.3) * (kind === 'gold' ? 1.2 : 1) * (golden ? 1.1 : 1),
      size,
      rot: (Math.random() - 0.5) * 0.5,
      vr: (Math.random() - 0.5) * 1.6,
      born: t,
    })
  }

  function burst(px: number, py: number, color: string, shape: Spark['shape'], n: number, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
      const v = (90 + Math.random() * 160) * power
      sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9, max: 0.9, color, shape })
    }
  }

  const vibrate = (ms: number) => {
    try {
      navigator.vibrate?.(ms)
    } catch {
      // ignore
    }
  }

  function collect(it: Item) {
    const top = crateTop()
    if (it.kind === 'cloud' || it.kind === 'storm') {
      const loss = it.kind === 'storm' ? 5 : 3
      score = Math.max(0, score - loss)
      combo = 0
      stun = it.kind === 'storm' ? 0.9 : 0.55
      shake = it.kind === 'storm' ? 0.5 : 0.3
      if (it.kind === 'storm') flash = 0.35
      popups.push({ x: it.x, y: top - 10, text: `−${loss}`, color: '#4D5873', life: 1, max: 1, size: 24 })
      burst(it.x, top, '#6F8FE8', 'drop', 10, 0.7)
      sound.bad()
      vibrate(70)
      return
    }
    if (isPower(it.kind)) {
      sound.power()
      vibrate(25)
      burst(it.x, top, '#6F8FE8', 'star', 12)
      if (it.kind === 'magnet') {
        magnet = 6
        say('Magnet!', '#6F8FE8', 'Gifts fly to you')
      } else if (it.kind === 'clock') {
        bonus += 5
        say('+5 seconds', TEAL)
      } else {
        double = 8
        say('Double points!', GOLD_DEEP)
      }
      return
    }
    combo += 1
    const mult = 1 + Math.min(3, Math.floor(combo / 6))
    const pts = VALUES[it.kind as Good] * mult * (double > 0 ? 2 : 1)
    score += pts
    squash = 1
    const big = it.kind === 'gold'
    popups.push({ x: it.x, y: top - 14, text: `+${pts}`, color: big ? GOLD_DEEP : mult > 1 || double > 0 ? '#D97706' : RED, life: 0.9, max: 0.9, size: big ? 30 : 22 })
    burst(it.x, top, big ? GOLD : RED, big ? 'star' : 'heart', big ? 16 : 8)
    if (big) {
      sound.gold()
      vibrate(30)
    } else {
      sound.catch(combo)
      vibrate(12)
    }
    if (combo % 6 === 0 && mult > 1) say(`Combo ×${mult}!`, RED)
  }

  function update(dt: number) {
    clock += dt
    for (const cl of clouds) {
      cl.x += (cl.v * dt) / Math.max(W, 1)
      if (cl.x > 1.15) cl.x = -0.15
    }

    // movement (also in idle so the scooter feels alive)
    const slow = stun > 0 ? 0.35 : 1
    const bound = 70 * k
    target += keyDir * PW * 1.5 * dt
    target = Math.min(Math.max(target, OX + bound), OX + PW - bound)
    const prevX = x
    x += (target - x) * Math.min(1, dt * 14 * slow)
    vx = (x - prevX) / Math.max(dt, 0.001)
    if (Math.abs(vx) > 30) facing = vx > 0 ? 1 : -1
    wheel += (vx / (14 * k)) * dt + (mode === 'play' ? dt * 2 : 0)

    squash = Math.max(0, squash - dt * 5)
    shake = Math.max(0, shake - dt)
    flash = Math.max(0, flash - dt)
    stun = Math.max(0, stun - dt)
    magnet = Math.max(0, magnet - dt)
    double = Math.max(0, double - dt)

    banners = banners.filter((b) => (b.life -= dt) > 0)
    popups = popups.filter((pp) => {
      pp.life -= dt
      pp.y -= 46 * dt
      return pp.life > 0
    })
    sparks = sparks.filter((sp) => {
      sp.life -= dt
      sp.vy += 380 * dt
      sp.x += sp.vx * dt
      sp.y += sp.vy * dt
      return sp.life > 0
    })
    // exhaust puffs when riding fast
    if (Math.abs(vx) > 160 && Math.random() < dt * 18) {
      sparks.push({ x: x - facing * 56 * k, y: roadY - 14 * k, vx: -facing * 40, vy: -30, life: 0.5, max: 0.5, color: 'rgba(255,255,255,0.9)', shape: 'dot' })
    }

    if (mode !== 'play') return

    t += dt
    const left = duration() - t
    if (!saidFaster && t > 18) {
      saidFaster = true
      say('Faster!', RED, 'Here comes the rush')
    }
    if (!saidGolden && left <= 10) {
      saidGolden = true
      say('Golden rain!', GOLD_DEEP, 'Last 10 seconds')
    }
    if (left <= 0) {
      mode = 'over'
      best = Math.max(best, score)
      sound.end()
      callbacks.onEnd(score)
      return
    }

    spawnIn -= dt
    if (spawnIn <= 0) {
      spawn()
      const p = t / duration()
      const golden = left <= 10
      spawnIn = Math.max(0.36, (golden ? 0.55 : 0.92) - 0.48 * p) * (0.8 + Math.random() * 0.4)
    }

    const top = crateTop()
    const cx = crateX()
    const half = 40 * k
    items = items.filter((it) => {
      if (magnet > 0 && isGood(it.kind)) {
        const dx = cx - it.x
        if (Math.abs(dx) < PW * 0.45 && it.y > top - H * 0.55) it.vx += Math.sign(dx) * 900 * dt
        it.vx *= 0.96
      }
      const prevBottom = it.y + it.size * 0.3
      it.x += it.vx * dt
      it.y += it.vy * dt
      it.rot += it.vr * dt
      it.x = Math.min(Math.max(it.x, OX + it.size / 2), OX + PW - it.size / 2)
      const bottom = it.y + it.size * 0.3
      if (Math.abs(it.x - cx) < half + it.size * 0.2 && prevBottom <= top + 14 && bottom >= top - 6) {
        collect(it)
        return false
      }
      if (it.y - it.size > roadY) {
        if (isGood(it.kind)) combo = 0
        return false
      }
      return true
    })
  }

  // ---------------------------------------------- drawing
  function drawFlags() {
    const y0 = H * 0.09
    const ctxx = ctx
    ctxx.strokeStyle = 'rgba(42,32,36,0.35)'
    ctxx.lineWidth = 1
    ctxx.beginPath()
    ctxx.moveTo(0, y0)
    ctxx.quadraticCurveTo(W / 2, y0 + 36, W, y0)
    ctxx.stroke()
    const n = Math.max(10, Math.floor(W / 26))
    for (let i = 1; i < n; i++) {
      const tt = i / n
      const px = tt * W
      const py = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * (y0 + 36) + tt * tt * y0
      const sway = Math.sin(clock * 3 + i * 0.7) * 3
      ctxx.fillStyle = FLAG_COLOURS[i % FLAG_COLOURS.length]
      ctxx.beginPath()
      ctxx.moveTo(px - 6, py)
      ctxx.lineTo(px + 6, py)
      ctxx.lineTo(px + sway, py + 13)
      ctxx.closePath()
      ctxx.fill()
      ctxx.strokeStyle = 'rgba(42,32,36,0.25)'
      ctxx.stroke()
    }
  }

  function drawSkyClouds() {
    for (const cl of clouds) {
      const cx = cl.x * W
      const cy = cl.y * H
      const s = 34 * cl.s
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeStyle = 'rgba(241,211,215,1)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(cx - s * 0.5, cy, s * 0.42, Math.PI * 0.5, Math.PI * 1.5)
      ctx.arc(cx, cy - s * 0.25, s * 0.55, Math.PI, Math.PI * 2)
      ctx.arc(cx + s * 0.55, cy, s * 0.38, Math.PI * 1.5, Math.PI * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  function drawItem(it: Item) {
    ctx.save()
    ctx.translate(it.x, it.y)
    ctx.rotate(it.kind === 'cloud' || it.kind === 'storm' || isPower(it.kind) ? Math.sin(clock * 3 + it.born) * 0.08 : it.rot)
    ctx.lineWidth = 2
    ctx.strokeStyle = INK
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    switch (it.kind) {
      case 'gift':
        drawGiftBox(ctx, it.size, '#FF5A4F', RED_DARK, GOLD)
        break
      case 'giftBlue':
        drawGiftBox(ctx, it.size, '#8FA8F0', '#5C79D6', '#FFB3C4')
        break
      case 'cake':
        drawCake(ctx, it.size, clock)
        break
      case 'bouquet':
        drawBouquet(ctx, it.size)
        break
      case 'gold':
        ctx.save()
        ctx.shadowColor = 'rgba(245, 184, 61, 0.95)'
        ctx.shadowBlur = 16 + Math.sin(clock * 8) * 5
        drawGiftBox(ctx, it.size, '#FFD36B', GOLD_DEEP, RED)
        ctx.restore()
        if (Math.random() < 0.3) sparks.push({ x: it.x + (Math.random() - 0.5) * it.size, y: it.y, vx: 0, vy: -20, life: 0.5, max: 0.5, color: GOLD, shape: 'star' })
        break
      case 'cloud':
      case 'storm':
        drawCloud(ctx, it.size, clock, it.kind === 'storm')
        break
      default:
        drawPower(ctx, it.kind, it.size, clock)
    }
    ctx.restore()
  }

  function drawHud() {
    const left = Math.max(0, duration() - t)
    const pad = 16
    // score
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = `800 34px ${font}`
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.strokeText(String(score), OX + pad, 92)
    ctx.fillText(String(score), OX + pad, 92)
    // time pill
    const tl = `${Math.ceil(left)}s`
    ctx.font = `800 16px ${font}`
    const tw = ctx.measureText(tl).width + 26
    rr(ctx, OX + PW / 2 - tw / 2, 64, tw, 30, 15)
    ctx.fillStyle = left <= 10 ? RED : INK
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(tl, OX + PW / 2, 85)
    // reward bar: progress to each coupon tier
    const tiers = callbacks.tiers
    const maxT = tiers[tiers.length - 1].min
    const bx = OX + pad
    const bw = PW - pad * 2
    const by = 104
    rr(ctx, bx, by, bw, 10, 5)
    ctx.fillStyle = 'rgba(42,32,36,0.1)'
    ctx.fill()
    rr(ctx, bx, by, Math.max(10, bw * Math.min(1, score / maxT)), 10, 5)
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0)
    g.addColorStop(0, '#FF8A80')
    g.addColorStop(1, RED)
    ctx.fillStyle = g
    ctx.fill()
    ctx.font = `700 10.5px ${font}`
    for (const tier of tiers) {
      const tx = bx + bw * (tier.min / maxT)
      const got = score >= tier.min
      ctx.beginPath()
      ctx.arc(Math.min(tx, bx + bw - 6), by + 5, 7, 0, Math.PI * 2)
      ctx.fillStyle = got ? GOLD : '#fff'
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.fillStyle = got ? INK : 'rgba(42,32,36,0.6)'
      ctx.textAlign = 'center'
      ctx.fillText(`${tier.percent}%`, Math.min(tx, bx + bw - 10), by + 26)
    }
    // active effects and combo
    let chipX = OX + PW - pad
    const chip = (label: string, color: string) => {
      ctx.font = `800 12px ${font}`
      const w = ctx.measureText(label).width + 18
      chipX -= w
      rr(ctx, chipX, 140, w, 24, 12)
      ctx.fillStyle = color
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText(label, chipX + w / 2, 156)
      chipX -= 6
    }
    const mult = 1 + Math.min(3, Math.floor(combo / 6))
    if (mult > 1) chip(`Combo ×${mult}`, RED)
    if (double > 0) chip(`×2 ${Math.ceil(double)}s`, GOLD_DEEP)
    if (magnet > 0) chip(`Magnet ${Math.ceil(magnet)}s`, '#6F8FE8')
    // combo progress (dots to the next level)
    if (combo > 0 && mult < 4) {
      const into = combo % 6
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.arc(OX + pad + 6 + i * 12, 142, 4, 0, Math.PI * 2)
        ctx.fillStyle = i < into ? RED : 'rgba(42,32,36,0.15)'
        ctx.fill()
      }
    }
  }

  function drawBanners() {
    for (const b of banners) {
      const p = 1 - b.life / b.max
      const scale = p < 0.15 ? 0.6 + (p / 0.15) * 0.5 : p > 0.8 ? 1 - (p - 0.8) * 2 : 1.1 - Math.min(0.1, (p - 0.15) * 0.3)
      ctx.save()
      ctx.globalAlpha = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1
      ctx.translate(OX + PW / 2, H * 0.36)
      ctx.scale(scale, scale)
      ctx.textAlign = 'center'
      ctx.font = `800 40px ${font}`
      ctx.lineWidth = 8
      ctx.strokeStyle = '#fff'
      ctx.strokeText(b.text, 0, 0)
      ctx.fillStyle = b.color
      ctx.fillText(b.text, 0, 0)
      if (b.sub) {
        ctx.font = `700 15px ${font}`
        ctx.lineWidth = 5
        ctx.strokeText(b.sub, 0, 26)
        ctx.fillStyle = INK
        ctx.fillText(b.sub, 0, 26)
      }
      ctx.restore()
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save()
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake)
    ctx.drawImage(bg, 0, 0, W, H)
    drawSkyClouds()
    drawFlags()
    // golden glow at the end
    if (mode === 'play' && duration() - t <= 10) {
      ctx.fillStyle = `rgba(255, 210, 110, ${0.08 + Math.sin(clock * 4) * 0.04})`
      ctx.fillRect(0, 0, W, H)
    }
    for (const it of items) drawItem(it)
    // magnet field
    if (magnet > 0) {
      ctx.save()
      ctx.strokeStyle = 'rgba(111,143,232,0.35)'
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(crateX(), crateTop(), 40 + ((clock * 60 + i * 30) % 90), Math.PI * 1.1, Math.PI * 1.9)
        ctx.stroke()
      }
      ctx.restore()
    }
    // scooter
    ctx.save()
    ctx.translate(x, roadY - 14 * k)
    const lean = Math.max(-0.16, Math.min(0.16, vx / 2600)) * facing
    drawScooter(ctx, k, {
      lean: mode === 'play' ? lean : 0,
      wheel,
      facing,
      squash,
      stun,
      t: clock,
      bob: Math.sin(clock * (mode === 'play' ? 16 : 3)) * (mode === 'play' ? 0.8 : 1.2),
    })
    ctx.restore()
    // sparks and popups
    for (const sp of sparks) {
      ctx.globalAlpha = Math.max(0, sp.life / sp.max)
      ctx.fillStyle = sp.color
      if (sp.shape === 'heart') {
        heart(ctx, sp.x, sp.y, 12)
        ctx.fill()
      } else if (sp.shape === 'star') {
        star(ctx, sp.x, sp.y, 6)
        ctx.fill()
      } else if (sp.shape === 'drop') {
        ctx.beginPath()
        ctx.ellipse(sp.x, sp.y, 2.5, 5, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 4 * (sp.life / sp.max) + 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    for (const pp of popups) {
      const p = 1 - pp.life / pp.max
      ctx.globalAlpha = Math.min(1, pp.life * 2.5)
      ctx.font = `800 ${pp.size * (p < 0.15 ? 0.7 + p * 2 : 1)}px ${font}`
      ctx.lineWidth = 5
      ctx.strokeStyle = '#fff'
      ctx.strokeText(pp.text, pp.x, pp.y)
      ctx.fillStyle = pp.color
      ctx.fillText(pp.text, pp.x, pp.y)
    }
    ctx.globalAlpha = 1
    if (mode === 'play') {
      drawHud()
      drawBanners()
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 1.6})`
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    update(dt)
    draw()
    raf = requestAnimationFrame(frame)
  }

  // controls
  const onPointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    target = e.clientX - rect.left
  }
  const onKey = (e: KeyboardEvent) => {
    if (mode !== 'play') return
    const down = e.type === 'keydown'
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) {
      keyDir = down ? -1 : keyDir === -1 ? 0 : keyDir
      e.preventDefault()
    } else if (['ArrowRight', 'd', 'D'].includes(e.key)) {
      keyDir = down ? 1 : keyDir === 1 ? 0 : keyDir
      e.preventDefault()
    }
  }
  const onVisibility = () => {
    last = performance.now()
  }
  canvas.addEventListener('pointerdown', onPointer)
  canvas.addEventListener('pointermove', onPointer)
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
  document.addEventListener('visibilitychange', onVisibility)
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  last = performance.now()
  raf = requestAnimationFrame(frame)

  return {
    start() {
      sound.unlock()
      t = 0
      bonus = 0
      score = 0
      combo = 0
      items = []
      popups = []
      sparks = []
      banners = []
      spawnIn = 0.4
      keyDir = 0
      stun = magnet = double = 0
      saidFaster = saidGolden = false
      lastPowerAt = -10
      mode = 'play'
      say('Go!', RED, 'Catch the gifts', 1)
    },
    beep(high = false) {
      sound.unlock()
      sound.beep(high)
    },
    setMuted(m: boolean) {
      sound.setMuted(m)
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointer)
      canvas.removeEventListener('pointermove', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
