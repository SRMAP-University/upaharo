'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart'
import { useLocationStore } from '@/lib/store/location'
import { useUserStore } from '@/lib/store/user'
import { formatPrice, formatPriceNoDecimals } from '@/lib/utils'
import LocationPicker from '@/components/LocationPicker'
import LocationModal from '@/components/LocationModal'
import BottomNav from '@/components/BottomNav'
import SkeletonLoader from '@/components/SkeletonLoader'
import { SessionSync } from '@/components/SessionSync'
import { isKathmanduValleyLocation, SERVICE_AREA_UNAVAILABLE_MESSAGE } from '@/lib/service-area'
import { computeCashback, computeMaxWalletSpend, type WalletRules } from '@/lib/wallet-rules'

interface GiftWrap {
  id: string
  name: string
  price: number
  type: string
  image: string
}

interface Occasion {
  id: string
  name: string
  emoji: string
}

interface Recipient {
  id: string
  name: string
  phone: string
  email?: string
}

interface AppSettings {
  supportPhone: string
  supportEmail: string
  supportHours: string
  deliveryEstimate: string
  deliveryNote: string
}

type WalletInfo = WalletRules & {
  balance: number
  pendingCashback: number
}

const DEFAULT_SETTINGS: AppSettings = {
  supportPhone: '',
  supportEmail: '',
  supportHours: '9:00 AM - 9:00 PM',
  deliveryEstimate: 'Estimated delivery: 20-30 minutes',
  deliveryNote: 'Delivery timings may vary based on address and order volume.',
}

function WalletToggle({
  balance,
  maxSpend,
  checked,
  onChange,
}: {
  balance: number
  maxSpend: number
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-wine/15 bg-cream-deep px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-wine/30 text-wine focus:ring-wine/30"
      />
      <span className="text-sm text-ink/80">
        <span className="font-semibold text-ink">Use wallet balance</span>
        <span className="mt-0.5 block text-xs text-ink/50">
          {formatPrice(balance)} available · up to {formatPrice(maxSpend)} on this order
        </span>
      </span>
    </label>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { items, getTotalPrice, clearCart, giftOptions, setGiftOptions } = useCartStore()
  const { deliveryAddress, setDeliveryAddress } = useLocationStore()
  const { user, _hasHydrated } = useUserStore()
  const [isLoading, setIsLoading] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [giftDataLoading, setGiftDataLoading] = useState(true)
  const [showMobileSummary, setShowMobileSummary] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH')
  const [giftWraps, setGiftWraps] = useState<GiftWrap[]>([])
  const [occasions, setOccasions] = useState<Occasion[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [useWalletBalance, setUseWalletBalance] = useState(false)
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    street: '',
    apartment: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    latitude: 0,
    longitude: 0,
    isDefault: true
  })
  
  const subtotal = getTotalPrice()
  const giftWrapPrice = giftOptions.giftWrapId ? (giftWraps.find(w => w.id === giftOptions.giftWrapId)?.price || 0) : 0
  const deliveryFee = (subtotal + giftWrapPrice) > 199 ? 0 : 40
  const tax = 0
  const couponDiscount = appliedCoupon?.discount ?? 0
  const totalBeforeWallet = Math.max(0, subtotal + giftWrapPrice + deliveryFee - couponDiscount)
  const maxWalletSpend = wallet
    ? computeMaxWalletSpend(totalBeforeWallet, wallet.balance, wallet)
    : 0
  const walletApplied = useWalletBalance ? maxWalletSpend : 0
  const total = Math.max(0, totalBeforeWallet - walletApplied)
  const cashbackPreview = wallet ? computeCashback(total, wallet) : 0
  const walletAvailable = Boolean(wallet?.walletEnabled && wallet.balance > 0 && maxWalletSpend > 0)
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) || null
  const isSelectedAddressServiceable = selectedAddress
    ? isKathmanduValleyLocation({
        city: selectedAddress.city,
        state: selectedAddress.state,
        address: [selectedAddress.street, selectedAddress.landmark, selectedAddress.apartment].filter(Boolean).join(', '),
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
      })
    : true

  useEffect(() => {
    if (!_hasHydrated) return
    
    if (!user) {
      router.push('/auth')
      return
    }
    // Don't redirect to home if order was just placed
    if (items.length === 0 && !orderPlaced) {
      router.push('/')
      return
    }
    fetchGiftData()
    fetchAddresses()
    fetchAppSettings()
    fetchWallet()
  }, [user, items, router, _hasHydrated, orderPlaced])

  useEffect(() => {
    if (deliveryAddress?.latitude && deliveryAddress?.longitude) {
      setNewAddress((prev) => ({
        ...prev,
        latitude: deliveryAddress.latitude,
        longitude: deliveryAddress.longitude,
      }))
    }
  }, [deliveryAddress])

  // User abandoned Stripe Checkout — cancel the unpaid placeholder order.
  useEffect(() => {
    const canceled = searchParams.get('canceled')
    const orderId = searchParams.get('orderId')
    if (canceled !== '1' || !orderId) return

    void fetch('/api/payments/stripe/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
      .catch(() => undefined)
      .finally(() => {
        router.replace('/checkout')
      })
  }, [searchParams, router])

  const fetchAddresses = async () => {
    try {
      setAddressesLoading(true)
      const res = await fetch('/api/addresses')
      if (res.ok) {
        const data = await res.json()
        const userAddresses = data.addresses || []
        setAddresses(userAddresses)
        
        // Auto-select default address or first address
        if (userAddresses.length > 0) {
          const defaultAddr = userAddresses.find((a: any) => a.isDefault)
          setSelectedAddressId(defaultAddr?.id || userAddresses[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching addresses:', error)
    } finally {
      setAddressesLoading(false)
    }
  }

  const fetchGiftData = async () => {
    try {
      setGiftDataLoading(true)
      const [wrapsRes, occasionsRes, recipientsRes] = await Promise.all([
        fetch('/api/gift-wraps'),
        fetch('/api/occasions'),
        fetch('/api/recipients')
      ])

      if (wrapsRes.ok) setGiftWraps(await wrapsRes.json())
      if (occasionsRes.ok) setOccasions(await occasionsRes.json())
      if (recipientsRes.ok) {
        const data = await recipientsRes.json()
        setRecipients(data.recipients || [])
      }
    } catch (error) {
      console.error('Error fetching gift data:', error)
    } finally {
      setGiftDataLoading(false)
    }
  }

  const fetchAppSettings = async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setAppSettings({
          supportPhone: String(data.supportPhone || ''),
          supportEmail: String(data.supportEmail || ''),
          supportHours: String(data.supportHours || DEFAULT_SETTINGS.supportHours),
          deliveryEstimate: String(data.deliveryEstimate || DEFAULT_SETTINGS.deliveryEstimate),
          deliveryNote: String(data.deliveryNote || DEFAULT_SETTINGS.deliveryNote),
        })
      }
    } catch (error) {
      console.error('Error fetching app settings:', error)
    }
  }

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/wallet?limit=1', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setWallet({
        walletEnabled: Boolean(data.enabled),
        balance: Number(data.balance) || 0,
        pendingCashback: Number(data.pendingCashback) || 0,
        cashbackPercent: Number(data.cashbackPercent) || 0,
        cashbackMaxAmount: data.cashbackMaxAmount == null ? null : Number(data.cashbackMaxAmount),
        walletMaxPercentPerOrder: Number(data.walletMaxPercentPerOrder) || 0,
        walletMaxAmountPerOrder:
          data.walletMaxAmountPerOrder == null ? null : Number(data.walletMaxAmountPerOrder),
      })
    } catch (error) {
      console.error('Error fetching wallet:', error)
    }
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          subtotal,
          productIds: items.map((item) => item.id)
        })
      })

      const result = await res.json()
      if (result.valid) {
        setAppliedCoupon({ code: couponCode, discount: result.discount })
      } else {
        setAppliedCoupon(null)
        setCouponError(result.message || 'Invalid coupon code')
      }
    } catch (error) {
      console.error('Error applying coupon:', error)
      setCouponError('Failed to apply coupon')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponError('')
    setCouponCode('')
  }

  const handleCreateAddress = async () => {
    if (!newAddress.label || !newAddress.street || !newAddress.city || !newAddress.state || !newAddress.pincode) {
      alert('Please fill all address fields')
      return
    }

    if (!newAddress.latitude || !newAddress.longitude) {
      alert('Please pick your exact location on the map for accurate delivery.')
      return
    }

    if (
      !isKathmanduValleyLocation({
        city: newAddress.city,
        state: newAddress.state,
        address: [newAddress.street, newAddress.landmark, newAddress.apartment].filter(Boolean).join(', '),
        latitude: newAddress.latitude,
        longitude: newAddress.longitude,
      })
    ) {
      alert(SERVICE_AREA_UNAVAILABLE_MESSAGE)
      return
    }

    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAddress)
      })

      if (res.ok) {
        const data = await res.json()
        const newAddresses = [...addresses, data.address]
        setAddresses(newAddresses)
        setSelectedAddressId(data.address.id)
        setShowAddressForm(false)
        setNewAddress({
          label: 'Home',
          street: '',
          apartment: '',
          landmark: '',
          city: '',
          state: '',
          pincode: '',
          latitude: deliveryAddress?.latitude || 0,
          longitude: deliveryAddress?.longitude || 0,
          isDefault: true
        })
        alert('Address saved successfully!')
      } else {
        const errorData = await res.json()
        console.error('Address creation error:', errorData)
        alert(errorData.error || 'Failed to create address')
      }
    } catch (error) {
      console.error('Error creating address:', error)
      alert('Failed to create address')
    }
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddressId && addresses.length === 0) {
      setShowAddressForm(true)
      alert('Please add a delivery address first')
      return
    }

    if (!selectedAddressId) {
      alert('Please select a delivery address')
      return
    }

    if (!isSelectedAddressServiceable) {
      alert(SERVICE_AREA_UNAVAILABLE_MESSAGE)
      return
    }

    if (giftOptions.isGift && !giftOptions.recipientId) {
      alert('Please select a gift recipient')
      return
    }

    setIsLoading(true)

    try {
      const addressLatitude = selectedAddress?.latitude ?? deliveryAddress?.latitude ?? null
      const addressLongitude = selectedAddress?.longitude ?? deliveryAddress?.longitude ?? null
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items,
          addressId: selectedAddressId,
          addressLatitude,
          addressLongitude,
          paymentMethod,
          subtotal,
          deliveryFee,
          tax,
          total,
          couponCode: appliedCoupon?.code || undefined,
          walletAmount: walletApplied,
          isGift: giftOptions.isGift,
          recipientId: giftOptions.recipientId,
          occasionId: giftOptions.occasionId,
          giftWrapId: giftOptions.giftWrapId,
          greetingMessage: giftOptions.greetingMessage,
          senderName: giftOptions.senderName,
          showSenderName: giftOptions.showSenderName,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Order creation failed:', errorData)
        throw new Error(errorData.details || errorData.error || 'Failed to create order')
      }

      const data = await response.json()

      if (paymentMethod === 'ONLINE' && data.paymentUrl) {
        // Keep cart until Stripe return page confirms payment.
        setOrderPlaced(true)
        window.location.href = data.paymentUrl
        return
      }

      // Set flag before clearing cart to prevent redirect
      setOrderPlaced(true)
      clearCart()
      router.push('/orders')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!deliveryAddress) {
    return (
      <div className="min-h-screen bg-cream pb-20 lg:pb-0">
        <div className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-wine/10">
          <div className="flex items-center justify-between px-3 lg:px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-cream-deep rounded-lg transition-colors">
                <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="font-display text-lg font-semibold text-ink lg:text-xl">Checkout</h1>
                <p className="text-xs text-ink/55">Select delivery address</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-20">
          <LocationPicker />
        </div>
        <BottomNav />
      </div>
    )
  }

  const selectedWrap = giftWraps.find(w => w.id === giftOptions.giftWrapId)
  const selectedRecipient = recipients.find(r => r.id === giftOptions.recipientId)

  return (
    <div className="min-h-screen bg-cream pb-32 lg:pb-0">
      {/* Page-Specific Header */}
      <div className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-wine/10">
        <div className="flex items-center justify-between px-3 lg:px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-cream-deep rounded-lg transition-colors">
              <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-display text-lg font-semibold text-ink lg:text-xl">Checkout</h1>
              <p className="text-xs text-ink/55">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink/55">Total</p>
            <p className="text-base font-semibold text-wine">{formatPrice(total)}</p>
          </div>
        </div>
      </div>
      
      <div className="lg:max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 px-3 lg:px-4 py-3 lg:py-6">
          <div className="lg:col-span-3 space-y-4 lg:space-y-6">
            {/* Delivery Address - Open Design */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className=""
            >
              <h2 className="font-display text-base font-semibold text-ink mb-3 lg:text-xl lg:mb-4">📍 Delivery Address</h2>
              
              {addressesLoading ? (
                <div className="space-y-2 lg:space-y-3">
                  <SkeletonLoader variant="list" count={2} />
                </div>
              ) : addresses.length > 0 ? (
                <div className="space-y-2 lg:space-y-3">
                  {!isSelectedAddressServiceable && selectedAddress ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {SERVICE_AREA_UNAVAILABLE_MESSAGE}
                    </div>
                  ) : null}
                  {addresses.map((addr) => (
                    <label key={addr.id} className="flex items-start space-x-2 lg:space-x-3 p-3 lg:p-4 bg-white border-2 rounded-2xl cursor-pointer hover:border-wine/40 hover:shadow-sm transition-all active:scale-[0.98]"
                      style={{ borderColor: selectedAddressId === addr.id ? '#7c2a47' : 'rgba(124,42,71,0.12)' }}>
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-0.5 lg:mt-1 accent-wine"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm lg:text-base">{addr.label || 'Address'}</p>
                        <p className="text-ink/55 text-xs lg:text-sm line-clamp-2">{addr.street}, {addr.city}, {addr.state} - {addr.pincode}</p>
                      </div>
                    </label>
                  ))}
                  <button
                    onClick={() => setShowAddressForm(true)}
                    className="w-full py-3 lg:py-2.5 bg-white border-2 border-dashed border-wine/20 rounded-2xl text-ink/60 hover:border-wine/40 hover:text-wine hover:shadow-sm transition-all text-sm lg:text-base active:scale-[0.98]"
                  >
                    + Add New Address
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 lg:py-8 bg-white rounded-2xl border-2 border-dashed border-wine/20">
                  <p className="text-ink/55 mb-3 lg:mb-4 text-sm lg:text-base">No delivery address added</p>
                  <button
                    onClick={() => setShowAddressForm(true)}
                    className="bg-wine text-white px-5 py-2.5 lg:px-6 rounded-full shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep text-sm lg:text-base active:scale-95"
                  >
                    Add Delivery Address
                  </button>
                </div>
              )}

              {/* Add Address Form */}
              {showAddressForm && (
                <div className="mt-3 lg:mt-4 p-3 lg:p-4 bg-white border border-wine/15 rounded-2xl shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]">
                  <h3 className="font-display font-semibold text-ink mb-2 lg:mb-3 text-sm lg:text-base">New Address</h3>
                  <div className="space-y-2 lg:space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-wine/20 bg-rose-soft px-3 py-2 text-xs text-wine">
                      <span>
                        📍 Pick the exact pin on map for accurate delivery.
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-wine shadow-sm hover:bg-cream"
                      >
                        Choose on Map
                      </button>
                    </div>
                    <select
                      value={newAddress.label}
                      onChange={(e) => setNewAddress({...newAddress, label: e.target.value})}
                      className="w-full px-3 py-2 lg:px-4 border border-wine/15 rounded-xl bg-white text-ink text-sm lg:text-base outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    >
                      <option value="Home">Home</option>
                      <option value="Work">Work</option>
                      <option value="Other">Other</option>
                    </select>
                    <textarea
                      placeholder="Full Address (Street, Building, etc.) *"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress({...newAddress, street: e.target.value})}
                      className="w-full px-3 py-2 lg:px-4 border border-wine/15 rounded-xl text-ink text-sm lg:text-base outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-2 lg:gap-3">
                      <input
                        type="text"
                        placeholder="Apt/Flat No."
                        value={newAddress.apartment}
                        onChange={(e) => setNewAddress({...newAddress, apartment: e.target.value})}
                        className="w-full px-3 py-2 lg:px-4 border border-wine/15 rounded-xl text-ink text-sm lg:text-base outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                      />
                      <input
                        type="text"
                        placeholder="Landmark"
                        value={newAddress.landmark}
                        onChange={(e) => setNewAddress({...newAddress, landmark: e.target.value})}
                        className="w-full px-3 py-2 lg:px-4 border border-wine/15 rounded-xl text-ink text-sm lg:text-base outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:gap-3">
                      <input
                        type="text"
                        placeholder="City *"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                        className="w-full px-3 py-2 lg:px-4 border border-wine/15 rounded-xl text-ink text-sm lg:text-base outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                      />
                      <input
                        type="text"
                        placeholder="State *"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                        className="w-full px-3 py-2 lg:px-4 border border-wine/15 rounded-xl text-ink text-sm lg:text-base outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Pincode *"
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value})}
                      className="w-full px-3 py-2 lg:px-4 border border-wine/15 rounded-xl text-ink text-sm lg:text-base outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateAddress}
                        className="flex-1 bg-wine text-white py-2.5 rounded-full shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep text-sm lg:text-base active:scale-95"
                      >
                        Save Address
                      </button>
                      <button
                        onClick={() => setShowAddressForm(false)}
                        className="px-4 lg:px-6 border border-wine/20 bg-white text-wine py-2.5 rounded-full hover:bg-cream text-sm lg:text-base active:scale-95"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            <LocationModal
              isOpen={isLocationModalOpen}
              onClose={() => setIsLocationModalOpen(false)}
              onSaved={(location) => {
                if (location?.latitude && location?.longitude) {
                  setNewAddress((prev) => ({
                    ...prev,
                    label: location.label || prev.label,
                    street: location.street || prev.street,
                    apartment: location.apartment || prev.apartment,
                    landmark: location.landmark || prev.landmark,
                    city: location.city || prev.city,
                    state: location.state || prev.state,
                    pincode: location.pincode || prev.pincode,
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }))
                  setDeliveryAddress({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    address: location.address || '',
                    label: location.label || 'Selected Location',
                  })
                }
                setIsLocationModalOpen(false)
              }}
            />

            {/* Gift Options - Open Design */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className=""
            >
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h2 className="font-display text-base font-semibold text-ink lg:text-xl">🎁 Send as Gift</h2>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftOptions.isGift}
                    onChange={(e) => setGiftOptions({ ...giftOptions, isGift: e.target.checked })}
                    className="w-4 h-4 lg:w-5 lg:h-5 accent-wine rounded"
                  />
                  <span className="text-xs lg:text-sm font-semibold text-ink/70">Yes, this is a gift</span>
                </label>
              </div>

              {giftOptions.isGift && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 border-t border-wine/10 pt-4"
                >
                  {/* Occasion */}
                  <div>
                    <label className="block text-sm font-semibold text-ink/70 mb-2">
                      Select Occasion
                    </label>
                    {giftDataLoading ? (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex-shrink-0 min-w-[100px]">
                            <div className="animate-pulse bg-cream-deep h-20 rounded-xl"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {occasions.map((occ) => (
                        <button
                          key={occ.id}
                          onClick={() => setGiftOptions({ ...giftOptions, occasionId: occ.id })}
                          className={`flex-shrink-0 p-3 rounded-xl border-2 transition-all min-w-[100px] ${
                            giftOptions.occasionId === occ.id
                              ? 'border-wine bg-rose-soft shadow-sm'
                              : 'border-wine/15 hover:border-wine/40'
                          }`}
                        >
                          <span className="text-2xl block mb-1">{occ.emoji}</span>
                          <span className="text-xs font-semibold text-ink whitespace-nowrap">{occ.name}</span>
                        </button>
                      ))}
                    </div>
                    )}
                  </div>

                  {/* Recipient */}
                  <div>
                    <label className="block text-sm font-semibold text-ink/70 mb-2">
                      Select Recipient
                    </label>
                    <select
                      value={giftOptions.recipientId || ''}
                      onChange={(e) => setGiftOptions({ ...giftOptions, recipientId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                    >
                      <option value="">Choose a recipient...</option>
                      {recipients.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.phone})
                        </option>
                      ))}
                    </select>
                    <a
                      href="/recipients"
                      className="text-wine text-xs font-semibold mt-2 hover:underline inline-block"
                    >
                      + Manage recipients
                    </a>
                  </div>

                  {/* Gift Wrapping */}
                  <div>
                    <label className="block text-sm font-semibold text-ink/70 mb-2">
                      Choose Gift Wrapping
                    </label>
                    {giftDataLoading ? (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex-shrink-0 min-w-[140px]">
                            <div className="animate-pulse bg-cream-deep h-32 rounded-xl"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      <button
                        type="button"
                        onClick={() => setGiftOptions({ ...giftOptions, giftWrapId: undefined })}
                        className={`flex-shrink-0 p-4 rounded-xl border-2 transition-all min-w-[140px] ${
                          !giftOptions.giftWrapId
                            ? 'border-wine bg-rose-soft shadow-sm'
                            : 'border-wine/15 hover:border-wine/40'
                        }`}
                      >
                        <div className="text-center">
                          <span className="text-3xl block mb-2">🚫</span>
                          <p className="font-semibold text-ink text-sm">No Wrap</p>
                          <p className="text-xs text-ink/55 mb-1">Use default packaging</p>
                          <p className="text-wine font-semibold">+{formatPrice(0)}</p>
                        </div>
                      </button>
                      {giftWraps.map((wrap) => {
                        const isSelected = giftOptions.giftWrapId === wrap.id
                        return (
                          <div key={wrap.id} className="relative flex-shrink-0 min-w-[140px]">
                            <button
                              type="button"
                              onClick={() =>
                                setGiftOptions({
                                  ...giftOptions,
                                  giftWrapId: isSelected ? undefined : wrap.id,
                                })
                              }
                              className={`w-full p-4 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-wine bg-rose-soft shadow-sm'
                                  : 'border-wine/15 hover:border-wine/40'
                              }`}
                            >
                              <div className="text-center">
                                <span className="text-3xl block mb-2">{wrap.image}</span>
                                <p className="font-semibold text-ink text-sm">{wrap.name}</p>
                                <p className="text-xs text-ink/55 mb-1">{wrap.type}</p>
                                <p className="text-wine font-semibold">+{formatPrice(wrap.price)}</p>
                              </div>
                            </button>
                            {isSelected ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setGiftOptions({ ...giftOptions, giftWrapId: undefined })
                                }}
                                className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full bg-white text-ink/60 shadow-sm border border-wine/15 hover:bg-cream"
                                aria-label={`Remove ${wrap.name}`}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                    )}
                  </div>

                  {/* Greeting Message */}
                  <div>
                    <label className="block text-sm font-semibold text-ink/70 mb-2">
                      Greeting Message (Optional)
                    </label>
                    <textarea
                      value={giftOptions.greetingMessage || ''}
                      onChange={(e) => setGiftOptions({ ...giftOptions, greetingMessage: e.target.value })}
                      placeholder="Add a personal message on the card..."
                      className="w-full px-4 py-3 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                      rows={3}
                      maxLength={200}
                    />
                    <p className="text-xs text-ink/55 mt-1">
                      {(giftOptions.greetingMessage || '').length}/200 characters
                    </p>
                  </div>

                  {/* Sender Details */}
                  <div className="bg-cream-deep p-4 rounded-2xl space-y-3">
                    <h3 className="font-display font-semibold text-ink text-sm">From</h3>
                    <div>
                      <input
                        type="text"
                        value={giftOptions.senderName || user?.name || ''}
                        onChange={(e) => setGiftOptions({ ...giftOptions, senderName: e.target.value })}
                        placeholder="Your name"
                        className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink text-sm"
                      />
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={giftOptions.showSenderName}
                        onChange={(e) => setGiftOptions({ ...giftOptions, showSenderName: e.target.checked })}
                        className="w-4 h-4 accent-wine rounded"
                      />
                      <span className="text-sm text-ink/70">Show my name on the card</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Payment Method - Open Design */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className=""
            >
              <h2 className="font-display text-base font-semibold text-ink mb-3 lg:text-xl lg:mb-4">💳 Payment Method</h2>
              <div className="space-y-2 lg:space-y-3">
                <label className="flex items-center space-x-2 lg:space-x-3 p-3 lg:p-4 bg-white border-2 border-wine/15 rounded-2xl cursor-pointer hover:border-wine/40 hover:shadow-sm transition-all active:scale-[0.98]">
                  <input
                    type="radio"
                    name="payment"
                    value="CASH"
                    checked={paymentMethod === 'CASH'}
                    onChange={() => setPaymentMethod('CASH')}
                    className="w-4 h-4 lg:w-5 lg:h-5 accent-wine"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-ink text-sm lg:text-base">Cash on Delivery</p>
                    <p className="text-xs lg:text-sm text-ink/55">Pay when you receive</p>
                  </div>
                </label>
                <label className="flex items-center space-x-2 lg:space-x-3 p-3 lg:p-4 bg-white border-2 border-wine/15 rounded-2xl cursor-pointer hover:border-wine/40 hover:shadow-sm transition-all active:scale-[0.98]">
                  <input
                    type="radio"
                    name="payment"
                    value="ONLINE"
                    checked={paymentMethod === 'ONLINE'}
                    onChange={() => setPaymentMethod('ONLINE')}
                    className="w-4 h-4 lg:w-5 lg:h-5 accent-wine"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-ink text-sm lg:text-base">Pay Online</p>
                    <p className="text-xs lg:text-sm text-ink/55">Secure card payment with Stripe</p>
                  </div>
                </label>
              </div>
            </motion.div>
          </div>

          {/* Order Summary - Mobile: Expandable, Desktop: Sticky Sidebar */}
          <div className="lg:col-span-2">
            {/* Desktop Sticky Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="hidden lg:block bg-white rounded-[22px] border border-wine/10 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)] p-6 sticky top-24"
            >
              <h2 className="font-display text-xl font-semibold text-ink mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-ink/60">
                  <span>Items ({items.length})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {giftWrapPrice > 0 && (
                  <div className="flex justify-between text-ink/60">
                    <span>🎁 {selectedWrap?.name}</span>
                    <span>+{formatPrice(giftWrapPrice)}</span>
                  </div>
                )}
                <div className="flex justify-between text-ink/60">
                  <span>Delivery</span>
                  <span className={deliveryFee === 0 ? 'text-green-600 font-semibold' : ''}>
                    {deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon ({appliedCoupon?.code})</span>
                    <span>-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
                {walletApplied > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Wallet</span>
                    <span>-{formatPrice(walletApplied)}</span>
                  </div>
                )}
              </div>

              {/* Coupon input */}
              {couponDiscount === 0 ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-ink/70 mb-1.5">Have a coupon?</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="flex-1 px-3 py-2 border border-wine/15 rounded-xl bg-white text-ink text-sm outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 uppercase"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="bg-wine text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-wine-deep disabled:opacity-50"
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <p className="text-red-500 text-xs mt-1.5">{couponError}</p>}
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                  <span className="text-sm text-green-800 font-medium">{appliedCoupon?.code} applied</span>
                  <button onClick={removeCoupon} className="text-xs text-red-600 font-semibold hover:underline">
                    Remove
                  </button>
                </div>
              )}

              {walletAvailable && (
                <WalletToggle
                  balance={wallet?.balance ?? 0}
                  maxSpend={maxWalletSpend}
                  checked={useWalletBalance}
                  onChange={setUseWalletBalance}
                />
              )}

              <div className="border-t border-wine/10 pt-3 flex justify-between text-xl font-semibold text-ink mb-4">
                <span>Total</span>
                <span className="text-wine">{formatPriceNoDecimals(total)}</span>
              </div>

              {cashbackPreview > 0 && (
                <p className="-mt-2 mb-4 text-sm text-green-700">
                  Earn {formatPrice(cashbackPreview)} cashback once this order is delivered.
                </p>
              )}

              {giftOptions.isGift && selectedRecipient && (
                <div className="bg-rose-soft border border-wine/10 rounded-xl p-3 mb-4 text-sm text-ink/80">
                  <p className="font-semibold mb-1 text-wine">🎁 Sending to:</p>
                  <p>{selectedRecipient.name}</p>
                  <p className="text-xs mt-1">📞 {selectedRecipient.phone}</p>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800 flex items-start space-x-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span>{appSettings.deliveryEstimate}</span>
              </div>

              <div className="bg-cream-deep border border-wine/10 rounded-xl p-3 mb-4 text-sm text-ink/70 space-y-1">
                <p className="font-semibold text-ink">Support</p>
                {appSettings.supportHours ? <p>Hours: {appSettings.supportHours}</p> : null}
                {appSettings.supportPhone ? <p>Phone: {appSettings.supportPhone}</p> : null}
                {appSettings.supportEmail ? <p>Email: {appSettings.supportEmail}</p> : null}
                {appSettings.deliveryNote ? <p>{appSettings.deliveryNote}</p> : null}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePlaceOrder}
                disabled={isLoading || (giftOptions.isGift && !giftOptions.recipientId)}
                className="w-full bg-wine text-white py-3 rounded-full font-semibold shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] smooth-transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-wine-deep"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Placing order...</span>
                  </div>
                ) : (
                  <span>
                    {giftOptions.isGift
                      ? '🎁 Send as Gift'
                      : paymentMethod === 'ONLINE'
                        ? 'Pay Online'
                        : 'Place Order'}
                  </span>
                )}
              </motion.button>
            </motion.div>

            {/* Mobile Fixed Bottom Summary with Expandable Breakdown */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-wine/10 z-50 shadow-[0_-12px_40px_-30px_rgba(43,29,34,0.5)]">
              {/* Expandable Cost Breakdown */}
              <motion.div
                initial={false}
                animate={{ height: showMobileSummary ? 'auto' : 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 py-3 border-b border-wine/10 space-y-2 text-sm">
                  <div className="flex justify-between text-ink/60">
                    <span>Items ({items.length})</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {giftWrapPrice > 0 && (
                    <div className="flex justify-between text-ink/60">
                      <span>🎁 {selectedWrap?.name}</span>
                      <span>+{formatPrice(giftWrapPrice)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-ink/60">
                    <span>Delivery</span>
                    <span className={deliveryFee === 0 ? 'text-green-600 font-semibold' : ''}>
                      {deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}
                    </span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Coupon ({appliedCoupon?.code})</span>
                      <span>-{formatPrice(couponDiscount)}</span>
                    </div>
                  )}
                  {walletApplied > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Wallet</span>
                      <span>-{formatPrice(walletApplied)}</span>
                    </div>
                  )}

                  {walletAvailable && (
                    <div className="pt-2">
                      <WalletToggle
                        balance={wallet?.balance ?? 0}
                        maxSpend={maxWalletSpend}
                        checked={useWalletBalance}
                        onChange={setUseWalletBalance}
                      />
                    </div>
                  )}

                  {cashbackPreview > 0 && (
                    <p className="text-xs text-green-700">
                      Earn {formatPrice(cashbackPreview)} cashback after delivery.
                    </p>
                  )}

                  {couponDiscount === 0 ? (
                    <div className="pt-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Coupon code"
                          className="flex-1 px-3 py-2 border border-wine/15 rounded-xl bg-white text-ink text-sm outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 uppercase"
                        />
                        <button
                          onClick={applyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="bg-wine text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-wine-deep disabled:opacity-50"
                        >
                          {couponLoading ? '...' : 'Apply'}
                        </button>
                      </div>
                      {couponError && <p className="text-red-500 text-xs mt-1.5">{couponError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 mt-2">
                      <span className="text-xs text-green-800 font-medium">{appliedCoupon?.code} applied</span>
                      <button onClick={removeCoupon} className="text-xs text-red-600 font-semibold hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Main Action Bar */}
              <div className="px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <button
                      onClick={() => setShowMobileSummary(!showMobileSummary)}
                      className="flex items-center text-xs text-ink/60 mb-1"
                    >
                      <span>{showMobileSummary ? '▼' : '▶'}</span>
                      <span className="ml-1">View details</span>
                    </button>
                    <p className="text-xs text-ink/60">Total Amount</p>
                    <p className="text-xl font-semibold text-wine">{formatPriceNoDecimals(total)}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePlaceOrder}
                    disabled={isLoading || (giftOptions.isGift && !giftOptions.recipientId)}
                    className="bg-wine text-white px-6 py-3 rounded-full font-semibold shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] smooth-transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 hover:bg-wine-deep"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span className="text-sm">Processing...</span>
                      </div>
                    ) : (
                      <span className="text-sm">
                        {giftOptions.isGift
                          ? '🎁 Send Gift'
                          : paymentMethod === 'ONLINE'
                            ? 'Pay Online'
                            : 'Place Order'}
                      </span>
                    )}
                  </motion.button>
                </div>
                <p className="text-xs text-ink/55">{appSettings.deliveryEstimate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
