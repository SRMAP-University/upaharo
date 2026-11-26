'use client'

import type { CakeAddonVisual, CakeToppingVisual } from '@/lib/cake-builder'
import { Rose, Topping } from './CakePreview'

/** Small drawings for option cards that have no photo yet. */

export function ToppingSwatch({ kind, className = '' }: { kind: CakeToppingVisual; className?: string }) {
  if (kind === 'sprinkles') {
    const colors = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#FF8FAB']
    return (
      <svg viewBox="-30 -24 60 40" className={className} aria-hidden>
        <ellipse cx={0} cy={4} rx={26} ry={10} fill="#FBEFF1" />
        {Array.from({ length: 26 }, (_, i) => {
          const a = i * 2.4
          const r = 4 + (i % 7) * 3
          const x = Math.cos(a) * r
          const y = Math.sin(a) * r * 0.45 + 2
          return (
            <rect key={i} x={x - 3} y={y - 1} width={6} height={2} rx={1} fill={colors[i % colors.length]} transform={`rotate(${(i * 47) % 180} ${x} ${y})`} />
          )
        })}
      </svg>
    )
  }
  const spots = [
    { x: -12, y: 10, s: 1.1 },
    { x: 12, y: 11, s: 1.1 },
    { x: 0, y: 4, s: 1.25 },
  ]
  return (
    <svg viewBox="-30 -24 60 40" className={className} aria-hidden>
      <ellipse cx={0} cy={10} rx={26} ry={8} fill="#FBEFF1" />
      {kind === 'none' ? (
        <circle r={8} cy={2} fill="#F3C6CE" />
      ) : (
        spots.map((p, i) => <Topping key={i} kind={kind} x={p.x} y={p.y} s={p.s} i={i} />)
      )}
    </svg>
  )
}

export function AddonSwatch({ kind, className = '' }: { kind: CakeAddonVisual; className?: string }) {
  const stroke = { fill: 'none', stroke: '#7A1F2B', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="-30 -24 60 44" className={className} aria-hidden>
      <defs>
        <linearGradient id="addon-gold" x1="0" x2="1">
          <stop offset="0%" stopColor="#B8860B" />
          <stop offset="50%" stopColor="#F5D06F" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>
      </defs>
      {kind === 'topper' ? (
        <g>
          <text x={0} y={-4} textAnchor="middle" fontFamily="'Brush Script MT', cursive" fontSize={15} fontWeight={700} fill="url(#addon-gold)" stroke="#8B6508" strokeWidth={0.4}>
            Happy
          </text>
          <text x={0} y={10} textAnchor="middle" fontFamily="'Brush Script MT', cursive" fontSize={15} fontWeight={700} fill="url(#addon-gold)" stroke="#8B6508" strokeWidth={0.4}>
            Birthday
          </text>
          <line x1={-12} y1={12} x2={-10} y2={20} stroke="#C9A227" strokeWidth={1.5} />
          <line x1={12} y1={12} x2={10} y2={20} stroke="#C9A227" strokeWidth={1.5} />
        </g>
      ) : kind === 'candles' ? (
        <g>
          {[-14, -7, 0, 7, 14].map((x, i) => (
            <g key={x}>
              <rect x={x - 2} y={-6} width={4} height={24} rx={1} fill={['#FF8FAB', '#8EC5FF', '#FFD166', '#B9F3C9', '#C3A6FF'][i]} />
              <path d={`M${x} -16 Q${x + 3} -11 ${x} -7 Q${x - 3} -11 ${x} -16Z`} fill="#FFB703" />
            </g>
          ))}
        </g>
      ) : kind === 'flowers' ? (
        <g>
          <Rose x={-10} y={14} s={0.9} />
          <Rose x={10} y={16} s={0.9} />
          <Rose x={0} y={6} s={1} />
        </g>
      ) : kind === 'photo' ? (
        <g>
          <ellipse cx={0} cy={2} rx={24} ry={16} fill="#FBEFF1" stroke="#F3C6CE" />
          <circle cx={0} cy={-3} r={5} fill="#E8A0AE" />
          <path d="M-10 12 Q0 0 10 12" fill="#E8A0AE" />
        </g>
      ) : kind === 'decoration' ? (
        <g>
          <path d="M0 -18 l4 9 9 3 -9 3 -4 9 -4 -9 -9 -3 9 -3z" fill="url(#addon-gold)" />
          <path d="M16 4 l2 4 4 1 -4 1 -2 4 -2 -4 -4 -1 4 -1z" fill="#F5D06F" />
          <path d="M-17 6 l2 4 4 1 -4 1 -2 4 -2 -4 -4 -1 4 -1z" fill="#F5D06F" />
        </g>
      ) : kind === 'reference' ? (
        <g {...stroke}>
          <rect x={-18} y={-14} width={36} height={28} rx={5} />
          <path d="M-18 8 L-6 -2 L4 8 L10 3 L18 10" />
          <circle cx={8} cy={-6} r={3} />
        </g>
      ) : (
        <g {...stroke}>
          <path d="M-12 0 h24 M0 -12 v24" />
        </g>
      )}
    </svg>
  )
}
