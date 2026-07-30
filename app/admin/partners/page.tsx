'use client'

import { useState, useEffect, FormEvent } from 'react'

type PartnerRow = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  partnerAccess: {
    sellerEnabled: boolean
    deliveryEnabled: boolean
    giftsEnabled: boolean
    groceryEnabled: boolean
  } | null
  seller: {
    id: string
    businessName: string
    commission: number
    isActive: boolean
    isVerified: boolean
    _count?: { products: number }
  } | null
  deliveryPartner: {
    id: string
    vehicleType: string
    vehicleNumber: string
    isAvailable: boolean
  } | null
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  sellerEnabled: true,
  deliveryEnabled: false,
  giftsEnabled: true,
  groceryEnabled: false,
  grantAdmin: false,
  businessName: '',
  businessAddress: '',
  commission: 15,
  isVerified: false,
  vehicleType: 'bike',
  vehicleNumber: '',
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PartnerRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/admin/partners')
      if (res.ok) setPartners(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPartners()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEdit = (p: PartnerRow) => {
    setEditing(p)
    setForm({
      name: p.name,
      email: p.email,
      phone: p.phone || '',
      sellerEnabled: p.partnerAccess?.sellerEnabled ?? Boolean(p.seller),
      deliveryEnabled:
        p.partnerAccess?.deliveryEnabled ?? Boolean(p.deliveryPartner),
      giftsEnabled: p.partnerAccess?.giftsEnabled ?? true,
      groceryEnabled: p.partnerAccess?.groceryEnabled ?? false,
      grantAdmin: p.role === 'ADMIN',
      businessName: p.seller?.businessName || '',
      businessAddress: '',
      commission: p.seller?.commission ?? 15,
      isVerified: p.seller?.isVerified ?? false,
      vehicleType: p.deliveryPartner?.vehicleType || 'bike',
      vehicleNumber: p.deliveryPartner?.vehicleNumber || '',
    })
    setError('')
    setShowModal(true)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url = editing
        ? `/api/admin/partners/${editing.id}`
        : '/api/admin/partners'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Save failed')
        return
      }
      setShowModal(false)
      await fetchPartners()
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-wine/60">Loading partners…</div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-wine">Partners</h1>
          <p className="text-sm text-wine/60">
            Merchant (seller) and delivery access for Upaharo & Grooll
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-wine px-4 py-2 text-sm font-medium text-white"
        >
          Add partner
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-wine/10 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-wine/5 text-left text-wine/70">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Stores</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const access = p.partnerAccess
              return (
                <tr key={p.id} className="border-t border-wine/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-wine">{p.name}</div>
                    <div className="text-xs text-wine/50">{p.email}</div>
                    {p.seller ? (
                      <div className="text-xs text-wine/50">
                        {p.seller.businessName}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-wine/80">{p.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(access?.sellerEnabled || p.seller) && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                          Merchant
                        </span>
                      )}
                      {(access?.deliveryEnabled || p.deliveryPartner) && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
                          Delivery
                        </span>
                      )}
                      {p.role === 'ADMIN' && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-800">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(access?.giftsEnabled ?? true) && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-800">
                          Upaharo
                        </span>
                      )}
                      {access?.groceryEnabled && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          Grooll
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-wine/60">
                    {p.seller
                      ? `${p.seller.isVerified ? 'Verified' : 'Unverified'} · ${
                          p.seller.isActive ? 'Active' : 'Inactive'
                        }`
                      : p.deliveryPartner?.isAvailable
                        ? 'Online'
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="text-sm font-medium text-wine underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
            {partners.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-wine/50"
                >
                  No partners yet. Add a merchant or delivery partner.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <form
            onSubmit={onSubmit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-wine">
              {editing ? 'Edit partner' : 'Add partner'}
            </h2>
            <p className="mt-1 text-xs text-wine/50">
              Partners log in to the partner app with phone OTP.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="block text-sm">
                <span className="text-wine/70">Name</span>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-wine/70">Email</span>
                <input
                  required
                  type="email"
                  disabled={Boolean(editing)}
                  className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2 disabled:bg-wine/5"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-wine/70">Phone (Nepal)</span>
                <input
                  required={!editing}
                  className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="98xxxxxxxx"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.sellerEnabled}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sellerEnabled: e.target.checked,
                      }))
                    }
                  />
                  Merchant
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.deliveryEnabled}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        deliveryEnabled: e.target.checked,
                      }))
                    }
                  />
                  Delivery
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.giftsEnabled}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        giftsEnabled: e.target.checked,
                      }))
                    }
                  />
                  Upaharo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.groceryEnabled}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        groceryEnabled: e.target.checked,
                      }))
                    }
                  />
                  Grooll
                </label>
              </div>

              {editing ? (
                <label className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50/60 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.grantAdmin}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        grantAdmin: e.target.checked,
                        ...(e.target.checked
                          ? { sellerEnabled: true, deliveryEnabled: true }
                          : {}),
                      }))
                    }
                  />
                  <span>
                    <span className="font-semibold text-purple-900">
                      Grant admin access
                    </span>
                    <span className="mt-0.5 block text-xs text-purple-800/70">
                      Web admin dashboard plus full partner-app access: view,
                      edit, and delete all products, manage all orders, and
                      run delivery. Enables Merchant + Delivery automatically.
                    </span>
                  </span>
                </label>
              ) : null}

              {form.sellerEnabled && (
                <div className="space-y-3 rounded-xl border border-wine/10 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-wine/50">
                    Merchant
                  </div>
                  <label className="block text-sm">
                    <span className="text-wine/70">Business name</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2"
                      value={form.businessName}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          businessName: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-wine/70">Business address</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2"
                      value={form.businessAddress}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          businessAddress: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-wine/70">Commission %</span>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2"
                      value={form.commission}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          commission: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isVerified}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isVerified: e.target.checked,
                        }))
                      }
                    />
                    Verified (can add products)
                  </label>
                </div>
              )}

              {form.deliveryEnabled && (
                <div className="space-y-3 rounded-xl border border-wine/10 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-wine/50">
                    Delivery
                  </div>
                  <label className="block text-sm">
                    <span className="text-wine/70">Vehicle type</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2"
                      value={form.vehicleType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          vehicleType: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-wine/70">Vehicle number</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-wine/15 px-3 py-2"
                      value={form.vehicleNumber}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          vehicleNumber: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-wine/70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-wine px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
