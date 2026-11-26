'use client'

import { isCakeCustomization, type CakeCustomization } from '@/lib/cake-builder'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceCompact } from '@/lib/utils'
import CakePreview from './CakePreview'

/**
 * A custom cake's picks, for the cart, the customer's orders and admin. Shows
 * everything the bakery needs: size, flavour, type, toppings, add-ons with
 * uploaded pictures and notes, and the message.
 */
export default function CakeLineDetails({
  customization,
  showPrices = false,
  className = '',
}: {
  customization: unknown
  showPrices?: boolean
  className?: string
}) {
  if (!isCakeCustomization(customization)) return null
  const s = (customization as CakeCustomization).summary
  const rows: Array<[string, string]> = [
    ['Size', `${s.size}${s.serves ? ` · ${s.serves}` : ''}`],
    ['Flavour', s.flavours.join(' & ')],
    ['Type', s.type],
  ]
  if (s.toppings.length) rows.push(['Toppings', s.toppings.map((t) => t.name).join(', ')])
  if (s.addons.length) rows.push(['Add-ons', s.addons.map((a) => a.name).join(', ')])
  if (s.message) rows.push(['Message', `“${s.message}”`])

  const extras = s.addons.filter((a) => a.image || a.note)

  return (
    <div className={`text-xs text-ink/70 ${className}`}>
      <dl className="space-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt className="flex-shrink-0 font-medium text-ink/50">{label}:</dt>
            <dd className="min-w-0 break-words text-ink/80">{value}</dd>
          </div>
        ))}
      </dl>
      {extras.length > 0 ? (
        <div className="mt-1.5 space-y-1.5">
          {extras.map((a) => (
            <div key={a.name} className="flex items-start gap-2">
              {a.image ? (
                <a href={resolveImageUrl(a.image)} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveImageUrl(a.image)} alt={`${a.name} upload`} className="h-12 w-12 rounded-lg border border-ink/10 object-cover" />
                </a>
              ) : null}
              <p className="min-w-0 break-words">
                <span className="font-medium text-ink/60">{a.name}</span>
                {a.note ? `: ${a.note}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {showPrices && s.lines.length > 0 ? (
        <dl className="mt-2 space-y-0.5 border-t border-ink/10 pt-1.5">
          {s.lines.map((line, i) => (
            <div key={`${line.label}-${i}`} className="flex justify-between gap-3">
              <dt>{line.label}</dt>
              <dd className="tabular-nums">{formatPriceCompact(line.amount)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

/** The cake drawing, for thumbnails where a product photo would go. */
export function CakeThumb({ customization, className = '' }: { customization: unknown; className?: string }) {
  if (!isCakeCustomization(customization)) return null
  return <CakePreview visual={(customization as CakeCustomization).visual} className={className} />
}
