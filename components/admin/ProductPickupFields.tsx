'use client'

import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-ink/55">Loading map...</div>
  ),
})

export type ProductPickupValue = {
  pickupEnabled: boolean
  pickupLatitude: number | null
  pickupLongitude: number | null
  pickupAddress: string
}

interface ProductPickupFieldsProps {
  value: ProductPickupValue
  onChange: (value: ProductPickupValue) => void
}

export default function ProductPickupFields({ value, onChange }: ProductPickupFieldsProps) {
  const hasPin = value.pickupLatitude !== null && value.pickupLongitude !== null

  return (
    <div className="col-span-2 rounded-xl border border-wine/10 bg-cream/50 p-4">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={value.pickupEnabled}
          onChange={(e) => onChange({ ...value, pickupEnabled: e.target.checked })}
          className="h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
        />
        <span className="text-sm font-medium text-ink/70">Allow customer pickup</span>
      </label>
      <p className="mt-1 text-xs text-ink/55">
        Customers can collect this item instead of paying delivery. Pickup is offered at checkout only when
        every item in the cart shares this exact location.
      </p>

      {value.pickupEnabled && (
        <div className="mt-4 space-y-3">
          <div className="h-[380px] overflow-hidden rounded-xl border border-wine/10">
            <MapPicker
              initialLat={value.pickupLatitude ?? undefined}
              initialLng={value.pickupLongitude ?? undefined}
              onLocationSelect={(lat, lng, address) =>
                onChange({
                  ...value,
                  pickupLatitude: lat,
                  pickupLongitude: lng,
                  pickupAddress: value.pickupAddress.trim() ? value.pickupAddress : address,
                })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Pickup address shown to customers</label>
            <input
              type="text"
              value={value.pickupAddress}
              onChange={(e) => onChange({ ...value, pickupAddress: e.target.value })}
              placeholder="e.g. Upaharo Store, Jhamsikhel, Lalitpur"
              className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2 text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/15"
            />
          </div>

          <p className="text-xs text-ink/55">
            {hasPin
              ? `Pin set at ${value.pickupLatitude?.toFixed(6)}, ${value.pickupLongitude?.toFixed(6)}`
              : 'Drop a pin on the map to set the pickup point.'}
          </p>
        </div>
      )}
    </div>
  )
}
