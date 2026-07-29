'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Seller {
  id: string
  businessName: string
  email: string
  phone: string
  businessAddress: string
  gstin?: string
  commission: number
  isActive: boolean
  isVerified: boolean
  user: {
    name: string
    email: string
  }
  _count: {
    products: number
  }
  createdAt: string
}

export default function SellersPage() {
  const router = useRouter()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null)

  useEffect(() => {
    fetchSellers()
  }, [])

  const fetchSellers = async () => {
    try {
      const res = await fetch('/api/admin/sellers')
      if (res.ok) {
        const data = await res.json()
        setSellers(data)
      }
    } catch (error) {
      console.error('Failed to fetch sellers:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSellerStatus = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (res.ok) {
        fetchSellers()
      }
    } catch (error) {
      console.error('Failed to toggle seller status:', error)
    }
  }

  const toggleVerification = async (id: string, isVerified: boolean) => {
    try {
      const res = await fetch(`/api/admin/sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVerified: !isVerified }),
      })

      if (res.ok) {
        fetchSellers()
      }
    } catch (error) {
      console.error('Failed to toggle verification:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wine"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="hidden font-display text-2xl font-semibold text-ink md:block">Sellers Management</h1>
          <p className="text-ink/55">Manage sellers and their products</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-wine text-white px-5 py-2.5 rounded-full font-semibold hover:bg-wine-deep"
        >
          + Add Seller
        </button>
      </div>

      <div className="bg-white rounded-[22px] border border-wine/10 overflow-hidden">
        <table className="min-w-full divide-y divide-wine/10">
          <thead className="bg-cream-deep/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                Business
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                Commission
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                Products
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-wine/10">
            {sellers.map((seller) => (
              <tr key={seller.id} className="hover:bg-cream/60">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {seller.businessName}
                    </div>
                    <div className="text-sm text-ink/55">{seller.businessAddress}</div>
                    {seller.gstin && (
                      <div className="text-xs text-ink/40">VAT/PAN: {seller.gstin}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-ink">{seller.user.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-ink">{seller.phone}</div>
                  <div className="text-sm text-ink/55">{seller.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-ink">{seller.commission}%</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-ink">{seller._count.products}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        seller.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {seller.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        seller.isVerified
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {seller.isVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingSeller(seller)}
                      className="text-wine hover:text-wine-deep font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleVerification(seller.id, seller.isVerified)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      {seller.isVerified ? 'Unverify' : 'Verify'}
                    </button>
                    <button
                      onClick={() => toggleSellerStatus(seller.id, seller.isActive)}
                      className={seller.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                    >
                      {seller.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sellers.length === 0 && (
          <div className="text-center py-12 text-ink/55">
            No sellers found. Add your first seller to get started.
          </div>
        )}
      </div>

      {(showAddModal || editingSeller) && (
        <SellerModal
          seller={editingSeller}
          onClose={() => {
            setShowAddModal(false)
            setEditingSeller(null)
          }}
          onSuccess={() => {
            fetchSellers()
            setShowAddModal(false)
            setEditingSeller(null)
          }}
        />
      )}
    </div>
  )
}

function SellerModal({
  seller,
  onClose,
  onSuccess,
}: {
  seller: Seller | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: seller?.user.name || '',
    email: seller?.email || '',
    phone: seller?.phone || '',
    password: '',
    businessName: seller?.businessName || '',
    businessAddress: seller?.businessAddress || '',
    gstin: seller?.gstin || '',
    commission: seller?.commission || 15,
    bankAccountName: '',
    bankAccountNo: '',
    ifscCode: '',
    panNumber: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = seller ? `/api/admin/sellers/${seller.id}` : '/api/admin/sellers'
      const method = seller ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        onSuccess()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save seller')
      }
    } catch (error) {
      console.error('Failed to save seller:', error)
      alert('Failed to save seller')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[22px] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl font-semibold text-ink mb-4">
          {seller ? 'Edit Seller' : 'Add New Seller'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Owner Name *
              </label>
              <input
                type="text"
                required
                disabled={!!seller}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Phone *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+977 9812345678"
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            {!seller && (
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required={!seller}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Business Name *
              </label>
              <input
                type="text"
                required
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Commission (%) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="100"
                step="0.1"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: parseFloat(e.target.value) })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Business Address *
              </label>
              <textarea
                required
                value={formData.businessAddress}
                onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                VAT / PAN Registration
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                PAN Number
              </label>
              <input
                type="text"
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Bank Account Name
              </label>
              <input
                type="text"
                value={formData.bankAccountName}
                onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Bank Account Number
              </label>
              <input
                type="text"
                value={formData.bankAccountNo}
                onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Bank Code / SWIFT
              </label>
              <input
                type="text"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-wine/20 bg-white text-wine rounded-full font-semibold hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-wine text-white rounded-full font-semibold hover:bg-wine-deep disabled:opacity-50"
            >
              {loading ? 'Saving...' : seller ? 'Update Seller' : 'Add Seller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
