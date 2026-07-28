'use client'

interface PickupLocationCardProps {
  latitude: number
  longitude: number
  address?: string | null
  note?: string
}

export default function PickupLocationCard({
  latitude,
  longitude,
  address,
  note,
}: PickupLocationCardProps) {
  return (
    <div className="rounded-2xl border border-wine/15 bg-white p-3 lg:p-4">
      <p className="font-semibold text-ink text-sm lg:text-base">
        {address || 'Pickup point'}
      </p>
      {note ? <p className="mt-0.5 text-xs text-ink/55">{note}</p> : null}

      <div className="mt-3 overflow-hidden rounded-xl border border-wine/10">
        <iframe
          title="Pickup location"
          width="100%"
          height="200"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`}
        />
        <div className="grid grid-cols-2 gap-2 border-t border-wine/10 bg-white p-2">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-wine/15 px-3 py-2 text-center text-xs font-semibold text-ink/70 hover:bg-cream"
          >
            📍 Open Map
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-wine px-3 py-2 text-center text-xs font-semibold text-white hover:bg-wine-deep"
          >
            🧭 Directions
          </a>
        </div>
      </div>
    </div>
  )
}
