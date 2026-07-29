'use client'

import { useEffect, useState } from 'react'
import { formatPriceNoDecimals } from '@/lib/utils'

interface User {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'CUSTOMER' | 'ADMIN'
  createdAt: string
  totalSpent: number
  lastOrderAt: string | null
  orderCount: number
  _count: {
    addresses: number
  }
}

interface Address {
  id: string
  label: string
  street: string
  apartment?: string | null
  landmark?: string | null
  city: string
  state: string
  pincode: string
  createdAt: string
}

interface Order {
  id: string
  orderNumber: string
  total: number
  status: string
  paymentMethod: string
  paymentStatus: string
  deliveryFee: number
  discount: number
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    price: number
    product: {
      id: string
      name: string
      image: string
      category: string
    }
  }>
  address: Address | null
}

interface UserDetails extends User {
  emailVerified?: string | null
  completedOrders: number
  addresses: Address[]
  orders: Order[]
  walletBalance?: number
  pendingCashback?: number
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [walletAmount, setWalletAmount] = useState('')
  const [walletNote, setWalletNote] = useState('')
  const [walletSaving, setWalletSaving] = useState(false)
  const [walletMessage, setWalletMessage] = useState('')
  const [walletError, setWalletError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, role: 'CUSTOMER' | 'ADMIN') => {
    if (!confirm(`Change user role to ${role}?`)) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      if (res.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete this user? This will also delete all their orders and addresses.')) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (res.ok) fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const openUserDetails = async (userId: string) => {
    setDetailsError('')
    setWalletAmount('')
    setWalletNote('')
    setWalletMessage('')
    setWalletError('')
    setDetailsLoading(true)
    const baseUser = users.find((user) => user.id === userId)
    if (baseUser) {
      setSelectedUser({
        ...baseUser,
        completedOrders: 0,
        emailVerified: null,
        addresses: [],
        orders: [],
        walletBalance: 0,
        pendingCashback: 0,
      })
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (!res.ok) {
        throw new Error('Failed to load user details')
      }
      const data = await res.json()
      setSelectedUser(data)
    } catch (error) {
      console.error('Error fetching user details:', error)
      setDetailsError('Failed to load user details.')
    } finally {
      setDetailsLoading(false)
    }
  }

  const creditWallet = async () => {
    if (!selectedUser) return
    const amount = Number(walletAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setWalletError('Enter a positive amount to add')
      setWalletMessage('')
      return
    }
    if (!confirm(`Add ${formatPriceNoDecimals(amount)} to ${selectedUser.name}'s wallet?`)) {
      return
    }

    setWalletSaving(true)
    setWalletError('')
    setWalletMessage('')
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          note: walletNote.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add wallet money')
      }
      setSelectedUser((prev) =>
        prev ? { ...prev, walletBalance: Number(data.balance) || 0 } : prev
      )
      setWalletAmount('')
      setWalletNote('')
      setWalletMessage(`Added ${formatPriceNoDecimals(amount)}. New balance: ${formatPriceNoDecimals(Number(data.balance) || 0)}`)
    } catch (error) {
      console.error('Error crediting wallet:', error)
      setWalletError(error instanceof Error ? error.message : 'Failed to add wallet money')
    } finally {
      setWalletSaving(false)
    }
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink">Users</h1>
        <p className="text-ink/55 mt-1">Manage customer and admin accounts</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 md:px-4 md:py-3 border border-wine/15 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink text-sm"
        />
      </div>

      {/* Users List */}
      <div className="bg-white rounded-[22px] border border-wine/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink/55">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-ink/55">No users found</div>
        ) : (
          <>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead className="bg-cream-deep/50 border-b border-wine/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Spend</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink/55 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wine/10">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-cream/60">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-soft flex items-center justify-center">
                          <span className="text-wine font-bold">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <div className="font-medium text-ink">{user.name}</div>
                          <div className="text-xs text-ink/55">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-ink">{user.phone || 'No phone'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as 'CUSTOMER' | 'ADMIN')}
                        className={`text-xs px-2 py-1 rounded-lg font-medium cursor-pointer ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        <option value="CUSTOMER">CUSTOMER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-ink">{user.orderCount} orders</div>
                      <div className="text-xs text-ink/55">{user._count.addresses} addresses</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-ink">{formatPriceNoDecimals(user.totalSpent || 0)}</div>
                      <div className="text-xs text-ink/55">
                        {user.lastOrderAt ? `Last: ${new Date(user.lastOrderAt).toLocaleDateString()}` : 'No orders yet'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-ink">{new Date(user.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => openUserDetails(user.id)}
                        className="text-wine hover:text-wine-deep text-sm font-semibold mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="md:hidden divide-y divide-wine/10">
              {filteredUsers.map((user) => (
                <div key={`${user.id}-mobile`} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-rose-soft flex items-center justify-center text-wine font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-ink">{user.name}</div>
                        <div className="text-xs text-ink/55">{user.email}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                      user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink/55">
                    <span>{user.phone || 'No phone'}</span>
                    <span>{user.orderCount} orders</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-ink">
                    {formatPriceNoDecimals(user.totalSpent || 0)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openUserDetails(user.id)}
                      className="flex-1 rounded-xl border border-wine/15 px-3 py-2 text-xs font-semibold text-wine hover:bg-cream"
                    >
                      View
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[22px] border border-wine/10 p-4">
          <div className="text-sm text-ink/55 mb-1">Total Users</div>
          <div className="font-display text-2xl font-semibold text-ink">{users.length}</div>
        </div>
        <div className="bg-white rounded-[22px] border border-wine/10 p-4">
          <div className="text-sm text-ink/55 mb-1">Admins</div>
          <div className="font-display text-2xl font-semibold text-purple-600">{users.filter(u => u.role === 'ADMIN').length}</div>
        </div>
        <div className="bg-white rounded-[22px] border border-wine/10 p-4">
          <div className="text-sm text-ink/55 mb-1">Customers</div>
          <div className="font-display text-2xl font-semibold text-blue-600">{users.filter(u => u.role === 'CUSTOMER').length}</div>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[22px] bg-white">
            <div className="sticky top-0 flex items-center justify-between border-b border-wine/10 bg-white p-6">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">User Details</h2>
                <p className="text-sm text-ink/55">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-2xl text-ink/40 hover:text-ink"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 p-6">
              {detailsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detailsError}
                </div>
              ) : null}

              {detailsLoading ? (
                <div className="text-center text-ink/55">Loading details...</div>
              ) : (
                <>
                  <section className="rounded-xl border border-wine/10 bg-cream p-4">
                    <h3 className="mb-3 text-sm font-semibold text-ink">Profile</h3>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <div className="text-ink/55">Name</div>
                        <div className="font-medium text-ink">{selectedUser.name}</div>
                      </div>
                      <div>
                        <div className="text-ink/55">Phone</div>
                        <div className="font-medium text-ink">{selectedUser.phone || 'Not provided'}</div>
                      </div>
                      <div>
                        <div className="text-ink/55">Role</div>
                        <div className="font-medium text-ink">{selectedUser.role}</div>
                      </div>
                      <div>
                        <div className="text-ink/55">Email Verified</div>
                        <div className="font-medium text-ink">
                          {selectedUser.emailVerified ? new Date(selectedUser.emailVerified).toLocaleDateString() : 'Not verified'}
                        </div>
                      </div>
                      <div>
                        <div className="text-ink/55">Joined</div>
                        <div className="font-medium text-ink">
                          {new Date(selectedUser.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-ink/55">Total Spend</div>
                        <div className="font-medium text-ink">{formatPriceNoDecimals(selectedUser.totalSpent || 0)}</div>
                      </div>
                      <div>
                        <div className="text-ink/55">Delivered Orders</div>
                        <div className="font-medium text-ink">{selectedUser.completedOrders || 0}</div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-wine/10 bg-cream p-4">
                    <h3 className="mb-3 text-sm font-semibold text-ink">Wallet</h3>
                    <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-ink/55">Balance</div>
                        <div className="font-display text-xl font-semibold text-ink">
                          {formatPriceNoDecimals(selectedUser.walletBalance || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-ink/55">Pending cashback</div>
                        <div className="font-medium text-ink">
                          {formatPriceNoDecimals(selectedUser.pendingCashback || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                      <label className="text-sm">
                        <span className="mb-1 block text-ink/55">Amount to add</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={walletAmount}
                          onChange={(e) => setWalletAmount(e.target.value)}
                          placeholder="e.g. 100"
                          className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink outline-none focus:border-wine/40"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-ink/55">Note (optional)</span>
                        <input
                          type="text"
                          value={walletNote}
                          onChange={(e) => setWalletNote(e.target.value)}
                          placeholder="Promo credit, support goodwill…"
                          maxLength={160}
                          className="w-full rounded-xl border border-wine/15 bg-white px-3 py-2 text-ink outline-none focus:border-wine/40"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={creditWallet}
                          disabled={walletSaving}
                          className="w-full rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                        >
                          {walletSaving ? 'Adding…' : 'Add money'}
                        </button>
                      </div>
                    </div>
                    {walletError ? (
                      <p className="mt-2 text-sm text-red-600">{walletError}</p>
                    ) : null}
                    {walletMessage ? (
                      <p className="mt-2 text-sm text-emerald-700">{walletMessage}</p>
                    ) : null}
                  </section>

                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-ink">Saved Addresses</h3>
                    {selectedUser.addresses.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-wine/15 px-4 py-6 text-center text-sm text-ink/55">
                        No addresses saved.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedUser.addresses.map((address) => (
                          <div key={address.id} className="rounded-xl border border-wine/10 p-4 text-sm">
                            <div className="font-medium text-ink">{address.label}</div>
                            <div className="text-ink/55">{address.street}</div>
                            {address.apartment ? <div className="text-ink/55">Apt: {address.apartment}</div> : null}
                            {address.landmark ? <div className="text-ink/55">Landmark: {address.landmark}</div> : null}
                            <div className="text-ink/55">
                              {address.city}, {address.state} - {address.pincode}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-ink">Recent Orders</h3>
                    {selectedUser.orders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-wine/15 px-4 py-6 text-center text-sm text-ink/55">
                        No orders placed yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedUser.orders.map((order) => (
                          <div key={order.id} className="rounded-xl border border-wine/10 p-4 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-medium text-ink">{order.orderNumber}</div>
                                <div className="text-ink/55">{new Date(order.createdAt).toLocaleDateString()}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-ink">{formatPriceNoDecimals(order.total)}</div>
                                <div className="text-xs text-ink/55">{order.status} • {order.paymentStatus}</div>
                              </div>
                            </div>
                            <div className="mt-2 grid gap-1 text-xs text-ink/55 md:grid-cols-2">
                              <div>Payment: {order.paymentMethod}</div>
                              <div>Delivery fee: {formatPriceNoDecimals(order.deliveryFee || 0)}</div>
                              <div>Discount: {formatPriceNoDecimals(order.discount || 0)}</div>
                              {order.address ? <div>{order.address.city}, {order.address.state}</div> : null}
                            </div>
                            {order.items.length > 0 ? (
                              <div className="mt-3 space-y-2 rounded-xl border border-wine/10 bg-cream p-3">
                                {order.items.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                    <div className="min-w-0">
                                      <div className="truncate font-medium text-ink/70">{item.product?.name || 'Product removed'}</div>
                                      <div className="text-ink/55">Qty: {item.quantity}</div>
                                    </div>
                                    <div className="font-medium text-ink/70">{formatPriceNoDecimals(item.price * item.quantity)}</div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
