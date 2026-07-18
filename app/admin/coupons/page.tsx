'use client'

import { useEffect, useState } from 'react'

interface Coupon {
  id: string
  code: string
  description: string | null
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  minOrderAmount: number
  maxDiscount: number | null
  usageLimit: number | null
  usedCount: number
  startAt: string | null
  endAt: string | null
  isActive: boolean
  applicability: 'ALL' | 'CATEGORIES' | 'PRODUCTS'
  applicableCategoryIds: string[]
  applicableProductIds: string[]
}

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
}

const COUPON_TYPES = ['PERCENTAGE', 'FIXED']
const APPLICABILITY_OPTIONS = ['ALL', 'CATEGORIES', 'PRODUCTS']

function formatDateLocal(date: string | null | Date) {
  if (!date) return ''
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: '',
    minOrderAmount: '0',
    maxDiscount: '',
    usageLimit: '',
    startAt: '',
    endAt: '',
    isActive: true,
    applicability: 'ALL' as 'ALL' | 'CATEGORIES' | 'PRODUCTS',
    applicableCategoryIds: [] as string[],
    applicableProductIds: [] as string[]
  })

  useEffect(() => {
    fetchCoupons()
    fetchCategories()
    fetchProducts()
  }, [])

  const fetchCoupons = async () => {
    try {
      const res = await fetch('/api/admin/coupons')
      if (res.ok) {
        const data = await res.json()
        setCoupons(data)
      }
    } catch (error) {
      console.error('Error fetching coupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories')
      if (res.ok) setCategories(await res.json())
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products')
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products ?? [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      type: 'PERCENTAGE',
      value: '',
      minOrderAmount: '0',
      maxDiscount: '',
      usageLimit: '',
      startAt: '',
      endAt: '',
      isActive: true,
      applicability: 'ALL',
      applicableCategoryIds: [],
      applicableProductIds: []
    })
    setEditingCoupon(null)
    setShowForm(false)
  }

  const editCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      description: coupon.description ?? '',
      type: coupon.type,
      value: String(coupon.value),
      minOrderAmount: String(coupon.minOrderAmount),
      maxDiscount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : '',
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      startAt: formatDateLocal(coupon.startAt),
      endAt: formatDateLocal(coupon.endAt),
      isActive: coupon.isActive,
      applicability: coupon.applicability,
      applicableCategoryIds: coupon.applicableCategoryIds ?? [],
      applicableProductIds: coupon.applicableProductIds ?? []
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        value: Number(formData.value),
        minOrderAmount: Number(formData.minOrderAmount),
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        startAt: formData.startAt || null,
        endAt: formData.endAt || null
      }

      const url = editingCoupon
        ? `/api/admin/coupons/${editingCoupon.id}`
        : '/api/admin/coupons'
      const method = editingCoupon ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        fetchCoupons()
        resetForm()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save coupon')
      }
    } catch (error) {
      console.error('Error saving coupon:', error)
    }
  }

  const deleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
      if (res.ok) fetchCoupons()
    } catch (error) {
      console.error('Error deleting coupon:', error)
    }
  }

  const toggleArrayValue = (field: 'applicableCategoryIds' | 'applicableProductIds', value: string) => {
    setFormData((prev) => {
      const current = prev[field]
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [field]: updated }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-ink/55">Loading coupons...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Coupons</h1>
          <p className="text-ink/55 mt-1">Create discount codes for customers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-wine hover:bg-wine-deep text-white px-6 py-2.5 rounded-full font-semibold"
        >
          {showForm ? 'Cancel' : '+ Add Coupon'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-[22px] border border-wine/10 p-6 mb-6">
          <h2 className="font-display text-xl font-semibold text-ink mb-4">
            {editingCoupon ? 'Edit Coupon' : 'New Coupon'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Code*</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 uppercase"
                  placeholder="SAVE20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  placeholder="20% off all orders"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Type*</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                >
                  {COUPON_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">
                  Value* {formData.type === 'PERCENTAGE' ? '(%)' : '(amount)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Min Order Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">
                  {formData.type === 'PERCENTAGE' ? 'Max Discount (amount)' : 'Leave empty for full value'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.maxDiscount}
                  onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Usage Limit</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  placeholder="Unlimited if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Applicability</label>
                <select
                  value={formData.applicability}
                  onChange={(e) => setFormData({ ...formData, applicability: e.target.value as any })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                >
                  {APPLICABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Start Date</label>
                <input
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">End Date</label>
                <input
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
            </div>

            {formData.applicability === 'CATEGORIES' && (
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-2">Applicable Categories</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <label
                      key={cat.id}
                      className={`cursor-pointer px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        formData.applicableCategoryIds.includes(cat.name)
                          ? 'bg-wine text-white border-wine'
                          : 'bg-white text-ink/70 border-wine/15 hover:bg-cream'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.applicableCategoryIds.includes(cat.name)}
                        onChange={() => toggleArrayValue('applicableCategoryIds', cat.name)}
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {formData.applicability === 'PRODUCTS' && (
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-2">Applicable Products</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-wine/10 rounded-xl">
                  {products.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-cream cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.applicableProductIds.includes(product.id)}
                        onChange={() => toggleArrayValue('applicableProductIds', product.id)}
                        className="w-4 h-4 text-wine border-wine/30 rounded focus:ring-wine/30"
                      />
                      <span className="text-sm text-ink">{product.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-wine border-wine/30 rounded focus:ring-wine/30"
                />
                <span className="text-sm font-medium text-ink/70">Active</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-wine hover:bg-wine-deep text-white px-6 py-2 rounded-full font-semibold"
              >
                {editingCoupon ? 'Update' : 'Create'} Coupon
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="border border-wine/20 bg-white hover:bg-cream text-wine px-6 py-2 rounded-full font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="bg-white rounded-[22px] border border-wine/10 p-5 flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display text-xl font-semibold text-ink">{coupon.code}</h3>
                <p className="text-ink/55 text-sm">{coupon.description || 'No description'}</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {coupon.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 text-sm text-ink/70 mb-4 flex-1">
              <div className="flex justify-between">
                <span>Discount</span>
                <span className="font-semibold text-ink">
                  {coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : `Rs. ${coupon.value}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Min order</span>
                <span className="font-semibold text-ink">Rs. {coupon.minOrderAmount}</span>
              </div>
              {coupon.maxDiscount != null && (
                <div className="flex justify-between">
                  <span>Max discount</span>
                  <span className="font-semibold text-ink">Rs. {coupon.maxDiscount}</span>
                </div>
              )}
              {coupon.usageLimit != null && (
                <div className="flex justify-between">
                  <span>Usage</span>
                  <span className="font-semibold text-ink">
                    {coupon.usedCount} / {coupon.usageLimit}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Applies to</span>
                <span className="font-semibold text-ink">{coupon.applicability}</span>
              </div>
              {coupon.endAt && (
                <div className="flex justify-between">
                  <span>Expires</span>
                  <span className="font-semibold text-ink">
                    {new Date(coupon.endAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-wine/10">
              <button
                onClick={() => editCoupon(coupon)}
                className="text-wine hover:text-wine-deep text-sm font-semibold"
              >
                Edit
              </button>
              <button
                onClick={() => deleteCoupon(coupon.id)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {coupons.length === 0 && !loading && (
        <div className="text-center py-16 text-ink/55">No coupons yet. Create one to get started.</div>
      )}
    </div>
  )
}
