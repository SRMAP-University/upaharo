import type { CSSProperties } from 'react'
import type { SceneWeather } from '@/components/home/DeliveryScene'

/**
 * Weather over the whole home hero (not just the illustration): rain, storm
 * flashes, snow, fog and night stars, plus the hero's background colours.
 */

export type HeroPalette = { from: string; to: string; dark: boolean }

const PALETTES: Record<string, HeroPalette> = {
  clear: { from: '#FFF6F3', to: '#FDEBEE', dark: false },
  clouds: { from: '#F5F4F8', to: '#EDE9F1', dark: false },
  rain: { from: '#E9EDF5', to: '#E3E5EF', dark: false },
  storm: { from: '#D5DAE7', to: '#CBCFDD', dark: false },
  snow: { from: '#F5F8FD', to: '#E8EEF7', dark: false },
  fog: { from: '#F5F3F3', to: '#ECE8EA', dark: false },
  night: { from: '#2E3366', to: '#5A5283', dark: true },
}

export function heroPalette(w?: SceneWeather): HeroPalette {
  if (!w) return PALETTES.clear
  if (w.night) return PALETTES.night
  return PALETTES[w.scene] ?? PALETTES.clear
}

// Fixed layouts so server and browser agree.
const DROPS = Array.from({ length: 60 }, (_, i) => ({ left: (i * 37) % 100, delay: ((i * 13) % 20) / 20, len: 10 + (i % 4) * 4 }))
const FLAKES = Array.from({ length: 40 }, (_, i) => ({ left: (i * 23) % 100, delay: (i * 7) % 60 / 10, size: 3 + (i % 3) * 1.5, drift: (i % 2 ? 1 : -1) * (6 + (i % 4) * 3) }))
const STARS = Array.from({ length: 34 }, (_, i) => ({ left: (i * 29) % 100, top: (i * 17) % 55, delay: (i % 8) * 0.35, size: 1.5 + (i % 3) * 0.7 }))

export default function WeatherOverlay({ w, fall = 380 }: { w?: SceneWeather; fall?: number }) {
  if (!w) return null
  const style = { '--fall': `${fall}px` } as CSSProperties
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden" style={style}>
      {w.night
        ? STARS.map((s, i) => (
            <span
              key={`s${i}`}
              className="hw-star absolute rounded-full bg-white"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, '--d': `${s.delay}s` } as CSSProperties}
            />
          ))
        : null}

      {w.scene === 'rain' || w.scene === 'storm'
        ? DROPS.slice(0, w.scene === 'storm' ? 60 : 42).map((d, i) => (
            <span
              key={`r${i}`}
              className="hw-drop absolute -top-8 w-[1.5px] rounded-full"
              style={
                {
                  left: `${d.left}%`,
                  height: d.len,
                  background: w.night ? 'rgba(200,210,240,0.55)' : 'rgba(110,135,195,0.55)',
                  '--d': `${d.delay}s`,
                  '--t': w.scene === 'storm' ? '0.55s' : '0.85s',
                } as CSSProperties
              }
            />
          ))
        : null}

      {w.scene === 'storm' ? <span className="hw-flash absolute inset-0 bg-white" /> : null}

      {w.scene === 'snow'
        ? FLAKES.map((f, i) => (
            <span
              key={`f${i}`}
              className="hw-flake absolute -top-4 rounded-full bg-white shadow-[0_0_2px_rgba(120,140,180,0.5)]"
              style={{ left: `${f.left}%`, width: f.size, height: f.size, '--d': `${f.delay}s`, '--x': `${f.drift}px` } as CSSProperties}
            />
          ))
        : null}

      {w.scene === 'fog'
        ? [18, 42, 66, 84].map((top, i) => (
            <span
              key={top}
              className="hw-fog absolute -left-1/4 h-10 w-[150%] rounded-full bg-white/60 blur-xl"
              style={{ top: `${top}%`, '--d': `${i * 2}s` } as CSSProperties}
            />
          ))
        : null}
    </div>
  )
}
