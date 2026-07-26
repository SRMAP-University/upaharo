'use client'

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import B2BHeader from '@/components/b2b/B2BHeader'
import MapPicker from '@/components/MapPicker'
import { useB2BBusinessStore } from '@/lib/store/b2b-business'
import { isKathmanduValleyLocation, SERVICE_AREA_UNAVAILABLE_MESSAGE } from '@/lib/service-area'

type Step = 'account' | 'map' | 'details'

function B2BRegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/b2b'
  const setSession = useB2BBusinessStore((s) => s.setSession)
  const existing = useB2BBusinessStore((s) => s.session)

  const [step, setStep] = useState<Step>('account')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const latestLookupId = useRef(0)

  const [account, setAccount] = useState({
    shopName: '',
    name: '',
    email: '',
    phone: '',
    password: '',
  })

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedAddress, setSelectedAddress] = useState('')
  const [formData, setFormData] = useState({
    street: '',
    apartment: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  })

  useEffect(() => {
    if (existing?.token && existing.shopName) {
      router.replace(next)
    }
  }, [existing, next, router])

  const applyParsedAddress = (parsed?: {
    street?: string
    area?: string
    landmark?: string
    city?: string
    state?: string
    pincode?: string
  }) => {
    if (!parsed) return
    setFormData((prev) => ({
      ...prev,
      street: parsed.street || prev.street || '',
      apartment: parsed.area || prev.apartment || '',
      landmark: parsed.landmark || prev.landmark || '',
      city: parsed.city || prev.city || '',
      state: parsed.state || prev.state || '',
      pincode: parsed.pincode || prev.pincode || '',
    }))
  }

  const hydrateFromAddress = (address: string) => {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    setFormData((prev) => ({
      ...prev,
      street: parts[0] || '',
      apartment: parts.at(1) || '',
      city: parts.at(-3) || parts.at(-2) || '',
      state: parts.at(-2) || '',
    }))
  }

  const handleLocationSelect = async (
    lat: number,
    lng: number,
    address: string,
    parsed?: {
      street?: string
      area?: string
      landmark?: string
      city?: string
      state?: string
      pincode?: string
    }
  ) => {
    const lookupId = Date.now()
    latestLookupId.current = lookupId
    setCoords({ lat, lng })
    setError(null)

    const immediate =
      address && address !== 'Resolving exact address...'
        ? address
        : 'Fetching exact address...'
    setSelectedAddress(immediate)
    hydrateFromAddress(immediate)
    applyParsedAddress(parsed)
    setIsResolvingAddress(!parsed?.street && !parsed?.city && !parsed?.state)

    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 8000)
      const response = await fetch(`/api/location/reverse-geocode?lat=${lat}&lng=${lng}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)
      if (!response.ok) throw new Error('Reverse geocode failed')
      const data = await response.json()
      if (latestLookupId.current !== lookupId) return
      if (data.address) setSelectedAddress(data.address)
      if (data.parsed) applyParsedAddress(data.parsed)
    } catch {
      // keep pin + partial parse
    } finally {
      if (latestLookupId.current === lookupId) setIsResolvingAddress(false)
    }
  }

  const goToMap = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!account.shopName.trim() || !account.name.trim() || !account.email.trim() || !account.phone.trim()) {
      setError('Please fill shop name, your name, email and phone')
      return
    }
    if (account.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setStep('map')
  }

  const goToDetails = () => {
    if (!coords) {
      setError('Select your shop location on the map')
      return
    }
    const ok = isKathmanduValleyLocation({
      city: formData.city,
      state: formData.state,
      address: selectedAddress,
      latitude: coords.lat,
      longitude: coords.lng,
    })
    if (!ok) {
      setError(SERVICE_AREA_UNAVAILABLE_MESSAGE)
      return
    }
    setError(null)
    setStep('details')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!coords) {
      setError('Select location on the map')
      setStep('map')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/b2b/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...account,
          ...formData,
          latitude: coords.lat,
          longitude: coords.lng,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      setSession({
        token: data.token,
        user: data.user,
        shopName: data.shopName,
        address: data.address,
      })
      router.push(next)
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8 pb-24">
      <p className="text-xs font-semibold uppercase tracking-wider text-wine/70">Business account</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Register your shop</h1>
      <p className="mt-1 text-sm text-ink/50">
        Shop name, contact details, and delivery location — same style as the retail site.
      </p>

      <div className="mt-5 flex gap-2 text-xs font-semibold">
        {(['account', 'map', 'details'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`flex-1 rounded-full py-1.5 text-center ${
              step === s ? 'bg-wine text-white' : 'bg-wine/10 text-wine/60'
            }`}
          >
            {i + 1}. {s === 'account' ? 'Shop' : s === 'map' ? 'Map' : 'Address'}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 'account' && (
        <form onSubmit={goToMap} className="mt-6 space-y-3 rounded-2xl border border-wine/10 bg-white p-4">
          <Field
            label="Shop / business name *"
            value={account.shopName}
            onChange={(v) => setAccount({ ...account, shopName: v })}
            required
            placeholder="e.g. Himalayan Gift House"
          />
          <Field
            label="Your name *"
            value={account.name}
            onChange={(v) => setAccount({ ...account, name: v })}
            required
            placeholder="Contact person"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Phone *"
              type="tel"
              value={account.phone}
              onChange={(v) => setAccount({ ...account, phone: v })}
              required
            />
            <Field
              label="Email *"
              type="email"
              value={account.email}
              onChange={(v) => setAccount({ ...account, email: v })}
              required
            />
          </div>
          <Field
            label="Password *"
            type="password"
            value={account.password}
            onChange={(v) => setAccount({ ...account, password: v })}
            required
            placeholder="At least 6 characters"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-deep"
          >
            Next: choose location
          </button>
        </form>
      )}

      {step === 'map' && (
        <div className="mt-6 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-wine/10 bg-white">
            <div className="border-b border-wine/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Pin your shop location</h2>
              <p className="text-xs text-ink/45">
                Search or drag the pin — we deliver in the Kathmandu Valley.
              </p>
            </div>
            <div className="h-[340px]">
              <MapPicker onLocationSelect={handleLocationSelect} />
            </div>
            {(selectedAddress || isResolvingAddress) && (
              <p className="border-t border-wine/10 px-4 py-2 text-xs text-ink/60">
                {isResolvingAddress ? 'Resolving address…' : selectedAddress}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('account')}
              className="flex-1 rounded-full border border-wine/20 py-3 text-sm font-semibold text-wine"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goToDetails}
              disabled={!coords}
              className="flex-1 rounded-full bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-deep disabled:opacity-50"
            >
              Confirm pin
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <form onSubmit={onSubmit} className="mt-6 space-y-3 rounded-2xl border border-wine/10 bg-white p-4">
          <h2 className="text-sm font-semibold text-ink">Shop address details</h2>
          <Field
            label="Street / area *"
            value={formData.street}
            onChange={(v) => setFormData({ ...formData, street: v })}
            required
          />
          <Field
            label="Apartment / building"
            value={formData.apartment}
            onChange={(v) => setFormData({ ...formData, apartment: v })}
          />
          <Field
            label="Landmark"
            value={formData.landmark}
            onChange={(v) => setFormData({ ...formData, landmark: v })}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="City *"
              value={formData.city}
              onChange={(v) => setFormData({ ...formData, city: v })}
              required
            />
            <Field
              label="State *"
              value={formData.state}
              onChange={(v) => setFormData({ ...formData, state: v })}
              required
            />
            <Field
              label="Pincode *"
              value={formData.pincode}
              onChange={(v) => setFormData({ ...formData, pincode: v })}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep('map')}
              className="flex-1 rounded-full border border-wine/20 py-3 text-sm font-semibold text-wine"
            >
              Back to map
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-full bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-deep disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create business account'}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink/50">
        Already registered?{' '}
        <Link href={`/b2b/login?next=${encodeURIComponent(next)}`} className="font-semibold text-wine">
          Log in
        </Link>
      </p>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-ink/55">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-wine/15 bg-[#F7F2EE]/50 px-3 py-2.5 text-sm outline-none focus:border-wine"
      />
    </label>
  )
}

export default function B2BRegisterPage() {
  return (
    <>
      <B2BHeader />
      <Suspense fallback={<div className="p-10 text-center text-ink/40">Loading…</div>}>
        <B2BRegisterForm />
      </Suspense>
    </>
  )
}
