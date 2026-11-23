import type { ReactElement, ReactNode, SVGProps } from 'react'

/**
 * Upaharo's own spot illustrations: thin ink outlines with the brand red,
 * gold and blush fills. One quiet drawing per category, plus a small
 * still-life for the home hero. Plain SVG, so they stay crisp at any size.
 */

const INK = '#2A2024'
const RED = '#E8322B'
const RED_SOFT = '#FDE3E1'
const GOLD = '#F5B83D'
const GOLD_SOFT = '#FFF0CC'
const CREAM = '#FFF9F4'
const TAN = '#E9C6A3'
const TAN_SOFT = '#F7E4D2'
const MINT = '#D3EDE2'
const COCOA = '#8A5A44'

type ArtProps = SVGProps<SVGSVGElement>

function Art({ children, ...rest }: ArtProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <ellipse cx="60" cy="106" rx="34" ry="4" fill={INK} opacity="0.07" stroke="none" />
      {children}
    </svg>
  )
}

const heart = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy + 9 * s}c${-9 * s} ${-5 * s} ${-13 * s} ${-10 * s} ${-11 * s} ${-15 * s}c${1.5 * s} ${-4 * s} ${7 * s} ${-5 * s} ${11 * s} ${-1 * s}c${4 * s} ${-4 * s} ${9.5 * s} ${-3 * s} ${11 * s} ${1 * s}c${2 * s} ${5 * s} ${-2 * s} ${10 * s} ${-11 * s} ${15 * s}z`

export function CakeArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M20 102h80" />
      <rect x="27" y="72" width="66" height="30" rx="7" fill={RED_SOFT} />
      <path d="M27 81c5.5 0 5.5 5 11 5s5.5-5 11-5 5.5 5 11 5 5.5-5 11-5 5.5 5 11 5 5.5-5 11-5" />
      <circle cx="41" cy="93" r="2" fill={RED} stroke="none" />
      <circle cx="60" cy="93" r="2" fill={RED} stroke="none" />
      <circle cx="79" cy="93" r="2" fill={RED} stroke="none" />
      <rect x="38" y="48" width="44" height="26" rx="6" fill="#fff" />
      <path d="M41 61h38" stroke={RED} strokeWidth={3} />
      <rect x="56.5" y="31" width="7" height="17" rx="2.5" fill={GOLD} />
      <path d="M60 18c3.5 4.5 4.5 8 0 11-4.5-3-3.5-6.5 0-11z" fill={RED} stroke={RED} strokeWidth={1.4} />
    </Art>
  )
}

export function CupcakeArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M37 70h46l-6 32H43z" fill={GOLD_SOFT} />
      <path d="M50 73l2 27M60 73v27M70 73l-2 27" opacity="0.45" />
      <path d="M33 71c-4-12 6-21 14-18 1-12 25-13 27 0 9-3 17 7 13 18z" fill={RED_SOFT} />
      <path d="M44 62c5 3 11 3 16 0s11-3 16 0" opacity="0.5" />
      <circle cx="61" cy="42" r="6.5" fill={RED} />
      <path d="M61 35.5c0-5.5 3.5-8.5 8.5-9.5" />
    </Art>
  )
}

export function BouquetArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M38 52c-11-5-14-15-10-22 9 1 13 10 10 22z" fill={MINT} />
      <path d="M82 50c11-5 14-14 10-21-9 1-13 9-10 21z" fill={MINT} />
      <circle cx="44" cy="46" r="11" fill={GOLD} />
      <circle cx="44" cy="46" r="3.5" fill="#fff" />
      <circle cx="76" cy="46" r="11" fill="#fff" />
      <circle cx="76" cy="46" r="4" fill={RED_SOFT} />
      <circle cx="60" cy="35" r="13" fill={RED} />
      <path d="M60 29c4 0 6.5 3 5.5 6s-6 4.5-8.5 1.5 0-6.5 3.5-7.5" stroke="#fff" strokeWidth={1.8} />
      <path d="M35 55h50L66 104H54z" fill={RED_SOFT} />
      <path d="M47 55l12 49" opacity="0.35" />
      <path d="M60 82c-9-8-17-3-12 3 4 4 12-3 12-3zM60 82c9-8 17-3 12 3-4 4-12-3-12-3z" fill={RED} />
      <path d="M60 82l-6 11M60 82l6 11" />
    </Art>
  )
}

export function GiftBoxArt(p: ArtProps) {
  return (
    <Art {...p}>
      <rect x="30" y="58" width="60" height="44" rx="5" fill={RED} />
      <rect x="26" y="46" width="68" height="14" rx="4" fill={RED} />
      <rect x="56" y="46" width="8" height="56" fill={GOLD} />
      <path d="M60 46c-6-14-24-16-22-6 1 6 14 6 22 6zM60 46c6-14 24-16 22-6-1 6-14 6-22 6z" fill={GOLD} />
      <rect x="56" y="41" width="8" height="7" rx="2" fill={GOLD} />
      <path d="M31 51h9" stroke="#fff" opacity="0.7" />
    </Art>
  )
}

export function TeddyArt(p: ArtProps) {
  return (
    <Art {...p}>
      <circle cx="44" cy="38" r="8" fill={TAN} />
      <circle cx="76" cy="38" r="8" fill={TAN} />
      <circle cx="44" cy="38" r="3.5" fill={TAN_SOFT} stroke="none" />
      <circle cx="76" cy="38" r="3.5" fill={TAN_SOFT} stroke="none" />
      <ellipse cx="60" cy="86" rx="22" ry="17" fill={TAN} />
      <ellipse cx="60" cy="89" rx="11" ry="9" fill={TAN_SOFT} stroke="none" />
      <ellipse cx="45" cy="100" rx="8" ry="5.5" fill={TAN} />
      <ellipse cx="75" cy="100" rx="8" ry="5.5" fill={TAN} />
      <circle cx="60" cy="52" r="18" fill={TAN} />
      <ellipse cx="60" cy="58" rx="8" ry="6" fill={TAN_SOFT} />
      <ellipse cx="60" cy="55.5" rx="2.6" ry="2" fill={INK} stroke="none" />
      <path d="M60 58v2.5M57 61c1.5 1.4 4.5 1.4 6 0" strokeWidth={1.6} />
      <circle cx="53" cy="48" r="1.8" fill={INK} stroke="none" />
      <circle cx="67" cy="48" r="1.8" fill={INK} stroke="none" />
      <path d="M60 71l-8-5v10zM60 71l8-5v10z" fill={RED} />
    </Art>
  )
}

export function BlocksArt(p: ArtProps) {
  return (
    <Art {...p}>
      <rect x="26" y="72" width="30" height="30" rx="4" fill={RED_SOFT} />
      <circle cx="41" cy="87" r="6" fill="#fff" />
      <rect x="64" y="72" width="30" height="30" rx="4" fill={GOLD_SOFT} />
      <path d="M79 80l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8z" fill={GOLD} strokeWidth={1.6} />
      <rect x="45" y="42" width="30" height="30" rx="4" fill={RED} />
      <path d={heart(60, 55, 0.62)} fill="#fff" strokeWidth={1.6} />
    </Art>
  )
}

export function FrameArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M48 96l-6 9M72 96l6 9" />
      <rect x="32" y="24" width="56" height="72" rx="5" fill={GOLD} />
      <rect x="40" y="32" width="40" height="56" rx="2" fill={CREAM} />
      <path d="M40 80l11-10 8 7 7-5 14 11v5H40z" fill={RED_SOFT} />
      <path d={heart(60, 50, 0.7)} fill={RED} strokeWidth={1.6} />
    </Art>
  )
}

export function KeyringArt(p: ArtProps) {
  return (
    <Art {...p}>
      <circle cx="44" cy="32" r="12" />
      <path d="M52 41l6 7" />
      <g transform="rotate(-14 69 73)">
        <rect x="50" y="48" width="38" height="50" rx="12" fill={RED_SOFT} />
        <circle cx="69" cy="56" r="3" fill="#fff" />
        <path d={heart(69, 72, 0.75)} fill={RED} strokeWidth={1.6} />
      </g>
    </Art>
  )
}

export function BalloonsArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M46 70c-2 10 8 16 12 34M77 74c2 10-8 16-14 30" strokeWidth={1.6} />
      <ellipse cx="46" cy="46" rx="17" ry="21" fill={RED} />
      <path d="M43 67h6l-3 4z" fill={RED} />
      <path d="M37 39c1-5 4-8 8-9" stroke="#fff" strokeWidth={2.4} opacity="0.8" />
      <ellipse cx="77" cy="53" rx="15" ry="19" fill={GOLD} />
      <path d="M74 72h6l-3 4z" fill={GOLD} />
      <path d="M69 46c1-4 3-7 7-8" stroke="#fff" strokeWidth={2.4} opacity="0.8" />
    </Art>
  )
}

export function ChocolateArt(p: ArtProps) {
  return (
    <Art {...p}>
      <rect x="34" y="26" width="52" height="76" rx="5" fill={COCOA} />
      <path d="M34 44h52M60 26v36" stroke="#5E3A2B" opacity="0.7" />
      <path d="M34 62l5.2-4 5.2 4 5.2-4 5.2 4 5.2-4 5.2 4 5.2-4 5.2 4 5.2-4 5.2 4v35a5 5 0 0 1-5 5H39a5 5 0 0 1-5-5z" fill={RED} />
      <rect x="44" y="76" width="32" height="13" rx="3" fill={GOLD_SOFT} />
    </Art>
  )
}

export function TagArt(p: ArtProps) {
  return (
    <Art {...p}>
      <g transform="rotate(-10 60 62)">
        <path d="M24 38c4-9 14-9 18-2" />
        <path d="M46 40h42a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H46L28 62z" fill={GOLD} />
        <circle cx="40" cy="62" r="3.5" fill="#fff" />
        <text x="68" y="68" textAnchor="middle" fontSize="16" fontWeight={800} fill={INK} stroke="none" fontFamily="inherit">
          999
        </text>
      </g>
    </Art>
  )
}

export function RingArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path fillRule="evenodd" d="M36 78a24 24 0 1 0 48 0a24 24 0 1 0-48 0zm7 0a17 17 0 1 0 34 0a17 17 0 1 0-34 0z" fill={GOLD} />
      <path d="M48 44h24l7 9-19 17-19-17z" fill="#fff" />
      <path d="M41 53h38M54 44l-3 9 9 17 9-17-3-9" strokeWidth={1.4} opacity="0.55" />
      <path d="M90 36v8M86 40h8" stroke={GOLD} />
    </Art>
  )
}

export function HeartsArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d={heart(56, 76, 2.3)} fill={RED} />
      <path d={heart(86, 40, 0.9)} fill={RED_SOFT} />
    </Art>
  )
}

export function PartyHatArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M60 24l26 76H34z" fill={RED_SOFT} />
      <circle cx="60" cy="50" r="3" fill={RED} stroke="none" />
      <circle cx="51" cy="70" r="3" fill={GOLD} stroke="none" />
      <circle cx="68" cy="74" r="3" fill={RED} stroke="none" />
      <circle cx="46" cy="90" r="3" fill={RED} stroke="none" />
      <circle cx="62" cy="92" r="3" fill={GOLD} stroke="none" />
      <circle cx="76" cy="92" r="3" fill={RED} stroke="none" />
      <path d="M30 100h60" />
      <circle cx="60" cy="20" r="6" fill={GOLD} />
    </Art>
  )
}

export function EnvelopeArt(p: ArtProps) {
  return (
    <Art {...p}>
      <rect x="34" y="32" width="52" height="24" rx="3" fill={RED_SOFT} />
      <rect x="26" y="44" width="68" height="48" rx="5" fill="#fff" />
      <path d="M26 50l34 24 34-24" />
      <path d="M26 90l25-19M94 90L69 71" opacity="0.45" />
      <path d={heart(60, 68, 0.6)} fill={RED} strokeWidth={1.6} />
    </Art>
  )
}

export function GemArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M40 42h40l15 18-35 42-35-42z" fill={RED_SOFT} />
      <path d="M25 60h70M52 42l-6 18 14 42 14-42-6-18" strokeWidth={1.6} opacity="0.7" />
    </Art>
  )
}

export function BagArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M48 50v-8a12 12 0 0 1 24 0v8" />
      <path d="M34 50h52l-4 52H38z" fill={RED} />
      <path d="M52 66v9a8 8 0 0 0 16 0v-9" stroke="#fff" strokeWidth={4} />
    </Art>
  )
}

/** Wedding: two linked rings, one with a stone, and two hearts. */
export function WeddingArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path fillRule="evenodd" d="M24 76a21 21 0 1 0 42 0a21 21 0 1 0-42 0zm6.5 0a14.5 14.5 0 1 0 29 0a14.5 14.5 0 1 0-29 0z" fill={GOLD} />
      <path fillRule="evenodd" d="M54 76a21 21 0 1 0 42 0a21 21 0 1 0-42 0zm6.5 0a14.5 14.5 0 1 0 29 0a14.5 14.5 0 1 0-29 0z" fill={GOLD_SOFT} />
      {/* the first ring passes back over the second, so they link */}
      <path d="M62.22 80.29A17.75 17.75 0 0 1 55.93 89.99" stroke={GOLD} strokeWidth={6.5} strokeLinecap="butt" />
      <path d="M65.38 81.08A21 21 0 0 1 57.93 92.55M59.07 79.51A14.5 14.5 0 0 1 53.93 87.43" />
      <path d="M68 48h16l5 6-13 11-13-11z" fill="#fff" />
      <path d="M63 54h26M72 48l-2 6 6 11 6-11-2-6" strokeWidth={1.3} opacity="0.5" />
      <path d={heart(40, 32, 0.95)} fill={RED} />
      <path d={heart(84, 28, 0.55)} fill={RED_SOFT} strokeWidth={1.6} />
      <path d="M100 18v6M97 21h6" stroke={GOLD} />
    </Art>
  )
}

/** Winter: a warm mug with steam and a snowflake. */
export function WinterArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M44 40c-4-4 3-7 0-12M56 38c-4-4 3-7 0-12M68 40c-4-4 3-7 0-12" strokeWidth={1.8} opacity="0.55" />
      <path d="M78 60h5a10 10 0 0 1 0 20h-5" strokeWidth={5} stroke={INK} />
      <path d="M78 60h5a10 10 0 0 1 0 20h-5" strokeWidth={2.5} stroke={RED} />
      <path d="M32 48h48v40a12 12 0 0 1-12 12H44a12 12 0 0 1-12-12z" fill={RED} />
      <path d="M32 60h48" stroke="#fff" strokeWidth={3} opacity="0.9" />
      <path d={heart(56, 76, 0.75)} fill="#fff" strokeWidth={1.6} />
      <g stroke="#7FA7D9" strokeWidth={1.8}>
        <path d="M96 22v20M87.3 27l17.4 10M87.3 37l17.4-10" />
        <path d="M93 22.5l3 3 3-3M93 41.5l3-3 3 3" strokeWidth={1.4} />
      </g>
    </Art>
  )
}

const BY_KEYWORD: Array<[RegExp, (p: ArtProps) => ReactElement]> = [
  // Seasons first ("Winter Warmers" would otherwise match the budget tag below).
  [/winter|woolen|woollen|cosy|cozy/, WinterArt],
  [/wedding|marriage|bibaha|bride|groom/, WeddingArt],
  [/mini\s*cake|cupcake|pastry/, CupcakeArt],
  [/cake/, CakeArt],
  [/flower|bouquet|rose|bloom/, BouquetArt],
  [/hamper|basket|combo/, GiftBoxArt],
  [/soft\s*toy|teddy|plush/, TeddyArt],
  [/toy|kid/, BlocksArt],
  [/personal|photo|frame|custom/, FrameArt],
  [/key/, KeyringArt],
  [/event|balloon|party|decor/, BalloonsArt],
  [/chocolate|sweet/, ChocolateArt],
  [/under|budget|deal|rs\b/, TagArt],
  [/engage/, RingArt],
  [/anniversary/, HeartsArt],
  [/birthday/, PartyHatArt],
  [/love|valentine|romance/, EnvelopeArt],
  [/jewel|gem/, GemArt],
]

/** The illustration for a category or occasion name. */
export function CategoryArt({ name, ...rest }: ArtProps & { name: string }) {
  const n = name.toLowerCase()
  const Found = BY_KEYWORD.find(([rx]) => rx.test(n))?.[1] ?? BagArt
  return <Found {...rest} />
}
