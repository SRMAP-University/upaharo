'use client'

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocationStore } from '@/lib/store/location'
import { useUserStore } from '@/lib/store/user'
import MapPicker from './MapPicker'
import { isKathmanduValleyLocation, SERVICE_AREA_UNAVAILABLE_MESSAGE } from '@/lib/service-area'

interface LocationModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: (address: any) => void
}

const PENDING_ADDRESS_TEXT = ['Resolving exact address...', 'Fetching exact address...']

function Field({
  label,
  optional,
  ...inputProps
}: { label: string; optional?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink/40"> (optional)</span> : null}
      </span>
      <input
        {...inputProps}
        className="h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-[15px] text-ink outline-none transition placeholder:text-ink/35 focus:border-wine/50 focus:ring-2 focus:ring-wine/15"
      />
    </label>
  )
}

function PinBadge() {
  return (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-soft text-wine">
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 1 1 9.9 9.9L10 18.9l-4.95-4.95a7 7 0 0 1 0-9.9ZM10 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clipRule="evenodd" />
      </svg>
    </span>
  )
}

const LABEL_ICONS: Record<string, string> = {
  Home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
  Work: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0',
  Other: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
}

export default function LocationModal({ isOpen, onClose, onSaved }: LocationModalProps) {
  const { setCurrentLocation, setDeliveryAddress, deliveryAddress } = useLocationStore()
  const { user } = useUserStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'form'>('select')
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Escape closes; the page behind stays still while the sheet is open.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  const [selectedAddress, setSelectedAddress] = useState('')
  const latestLookupId = useRef(0)
  const [formData, setFormData] = useState({
    label: 'Home',
    street: '',
    apartment: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  })

  const hydrateFromAddress = (address: string) => {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    setFormData((prev) => ({
      ...prev,
      street: parts[0] || '',
      landmark: '',
      apartment: parts.at(1) || '',
      city: parts.at(-3) || parts.at(-2) || '',
      state: parts.at(-2) || '',
      pincode: '',
    }))
  }

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

    const immediateAddress =
      address && address !== 'Resolving exact address...'
        ? address
        : 'Fetching exact address...'

    setSelectedAddress(immediateAddress)
    hydrateFromAddress(immediateAddress)
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

      if (!response.ok) {
        throw new Error('Reverse geocode request failed')
      }

      const data = await response.json()
      if (latestLookupId.current !== lookupId) {
        return
      }

      if (data.address) {
        setSelectedAddress(data.address)
      }

      if (data.parsed) {
        applyParsedAddress(data.parsed)
      } else {
        // Fallback to manual parsing
        const addressComponents = data.fullResult?.address_components || []
        const street = data.fullResult?.formatted_address?.split(',')[0] || ''
        const formattedAddress = data.fullResult?.formatted_address

        if (formattedAddress) {
          setSelectedAddress(formattedAddress)
        }

        let city = '', state = '', pincode = ''
        addressComponents.forEach((component: any) => {
          if (component.types.includes('locality')) {
            city = component.long_name
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name
          }
          if (component.types.includes('postal_code')) {
            pincode = component.long_name
          }
        })

        setFormData((prev) => ({
          ...prev,
          street,
          apartment: city || prev.apartment || '',
          city,
          state,
          pincode,
        }))
      }
    } catch (err) {
      console.error('Error parsing address:', err)
      if (!parsed?.street && !parsed?.city && !parsed?.state) {
        setSelectedAddress(address && address !== 'Resolving exact address...' ? address : 'Move the map slightly to retry address detection')
      }
    } finally {
      if (latestLookupId.current === lookupId) {
        setIsResolvingAddress(false)
      }
    }
  }

  const handleProceedToForm = () => {
    if (!coords) return

    const isServiceable = isKathmanduValleyLocation({
      city: formData.city,
      state: formData.state,
      address: selectedAddress,
      latitude: coords.lat,
      longitude: coords.lng,
    })

    if (!isServiceable) {
      setError(SERVICE_AREA_UNAVAILABLE_MESSAGE)
      return
    }

    setError(null)
    setStep('form')
  }

  const handleBackToMap = () => {
    setError(null)
    setStep('select')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const isServiceable = isKathmanduValleyLocation({
        city: formData.city,
        state: formData.state,
        address: selectedAddress || `${formData.street}, ${formData.city}, ${formData.state}`,
        latitude: coords?.lat,
        longitude: coords?.lng,
      })

      if (!isServiceable) {
        throw new Error(SERVICE_AREA_UNAVAILABLE_MESSAGE)
      }

      const location = {
        latitude: coords?.lat || 0,
        longitude: coords?.lng || 0,
        address: `${formData.street}, ${formData.city}, ${formData.state} - ${formData.pincode}`,
        ...formData,
      }

      // Save to location store
      setCurrentLocation(location)
      setDeliveryAddress(location)

      // If user is logged in, save to database
      if (user) {
        const response = await fetch('/api/addresses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            latitude: coords?.lat || 0,
            longitude: coords?.lng || 0,
            isDefault: true, // Set as default address
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to save address')
        }

        const data = await response.json()
        onSaved?.(data.address)
      } else {
        onSaved?.(location)
      }

      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save address')
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) return null

  const addressPending = Boolean(selectedAddress) && (PENDING_ADDRESS_TEXT.includes(selectedAddress) || isResolvingAddress)
  const [addressTitle, ...addressRestParts] = selectedAddress.split(',').map((part) => part.trim()).filter(Boolean)
  const addressRest = addressRestParts.join(', ')

  const errorBanner = error ? (
    <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      <span>{error}</span>
    </div>
  ) : null

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-ink/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] flex items-end justify-center lg:items-center lg:p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={step === 'select' ? 'Choose delivery location' : 'Address details'}
              className="flex h-[100dvh] w-full flex-col overflow-hidden bg-cream lg:h-[min(760px,90vh)] lg:max-w-xl lg:rounded-[28px] lg:shadow-[0_40px_90px_-50px_rgba(43,29,34,0.7)]"
            >
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-ink/10 bg-white px-3 py-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] lg:pt-2.5">
                <button
                  type="button"
                  onClick={step === 'form' ? handleBackToMap : onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-cream-deep"
                  aria-label={step === 'form' ? 'Back to map' : 'Close'}
                >
                  {step === 'form' ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-semibold text-ink">
                    {step === 'select' ? 'Choose delivery location' : 'Address details'}
                  </h2>
                  {step === 'select' ? (
                    <p className="truncate text-xs text-ink/50">We deliver across Kathmandu Valley</p>
                  ) : null}
                </div>
                {step === 'form' ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-ink/55 transition hover:bg-cream-deep"
                    aria-label="Close"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>

              {step === 'select' ? (
                <>
                  <div className="relative min-h-0 flex-1">
                    <MapPicker
                      onLocationSelect={handleLocationSelect}
                      // Coming back from the address form reopens on the chosen point.
                      initialLat={coords?.lat ?? deliveryAddress?.latitude}
                      initialLng={coords?.lng ?? deliveryAddress?.longitude}
                    />
                  </div>

                  <div className="relative z-10 -mt-5 flex-shrink-0 rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 shadow-[0_-16px_40px_-24px_rgba(43,29,34,0.45)] lg:pb-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Deliver to</p>
                    <div className="mt-2.5 flex items-start gap-3">
                      <PinBadge />
                      <div className="min-w-0 flex-1 pt-0.5" aria-live="polite">
                        {!selectedAddress ? (
                          <p className="pt-2 text-sm text-ink/55">Search or move the map to choose a spot</p>
                        ) : addressPending ? (
                          <div className="space-y-2 pt-1">
                            <div className="h-4 w-3/5 animate-pulse rounded-full bg-cream-deep" />
                            <div className="h-3 w-4/5 animate-pulse rounded-full bg-cream-deep" />
                          </div>
                        ) : (
                          <>
                            <p className="truncate text-base font-semibold text-ink">{addressTitle}</p>
                            {addressRest ? (
                              <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink/55">{addressRest}</p>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    {errorBanner ? <div className="mt-4">{errorBanner}</div> : null}

                    <button
                      type="button"
                      onClick={handleProceedToForm}
                      disabled={!coords}
                      className="mt-5 flex h-[52px] w-full items-center justify-center rounded-2xl bg-wine text-base font-semibold text-white transition hover:bg-wine-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40"
                    >
                      Confirm location
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                  <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    <div className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-white p-3.5">
                      <PinBadge />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-[15px] font-semibold text-ink">{addressTitle || 'Selected location'}</p>
                        {addressRest ? <p className="line-clamp-2 text-xs leading-snug text-ink/55">{addressRest}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={handleBackToMap}
                        className="flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-wine transition hover:bg-rose-soft"
                      >
                        Change
                      </button>
                    </div>

                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-ink">Save as</legend>
                      <div className="flex gap-2">
                        {['Home', 'Work', 'Other'].map((type) => {
                          const selected = formData.label === type
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormData({ ...formData, label: type })}
                              aria-pressed={selected}
                              className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                                selected
                                  ? 'border-wine bg-wine text-white'
                                  : 'border-ink/15 bg-white text-ink/70 hover:border-wine/40'
                              }`}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={LABEL_ICONS[type]} />
                              </svg>
                              {type}
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>

                    <Field
                      label="House / flat / building"
                      required
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="e.g. House 12, Sunrise Apartments"
                      autoComplete="address-line1"
                    />
                    <Field
                      label="Area / road"
                      optional
                      value={formData.apartment}
                      onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                      placeholder="e.g. Baneshwor, Ring Road"
                      autoComplete="address-line2"
                    />
                    <Field
                      label="Landmark"
                      optional
                      value={formData.landmark}
                      onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                      placeholder="e.g. Opposite Bhatbhateni"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="City"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Kathmandu"
                        autoComplete="address-level2"
                      />
                      <Field
                        label="Postal code"
                        required
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        placeholder="44600"
                        inputMode="numeric"
                        autoComplete="postal-code"
                      />
                    </div>
                    <Field
                      label="Province"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="Bagmati"
                      autoComplete="address-level1"
                    />

                    {errorBanner}
                  </div>

                  <div className="flex-shrink-0 border-t border-ink/10 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 lg:pb-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-wine text-base font-semibold text-white transition hover:bg-wine-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? (
                        <>
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Saving…
                        </>
                      ) : (
                        'Save address'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
