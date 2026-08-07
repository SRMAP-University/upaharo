'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/lib/store/user'
import Header from '@/components/Header'
import SkeletonLoader from '@/components/SkeletonLoader'

interface Recipient {
  id: string
  name: string
  phone: string
  email?: string
  relationship: string
  birthDate?: string
  anniversary?: string
  interests: string[]
  notes?: string
}

export default function RecipientsPage() {
  const router = useRouter()
  const { user, _hasHydrated } = useUserStore()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    relationship: '',
    birthDate: '',
    anniversary: '',
    interests: '',
    notes: '',
  })

  useEffect(() => {
    if (!_hasHydrated) return
    
    if (!user) {
      router.push('/login')
      return
    }
    fetchRecipients()
  }, [user, router, _hasHydrated])

  const fetchRecipients = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/recipients', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRecipients(data.recipients || [])
      }
    } catch (err) {
      console.error('Error fetching recipients:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const token = localStorage.getItem('token')
      const method = editingId ? 'PUT' : 'POST'
      const body = {
        ...(editingId && { id: editingId }),
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        relationship: formData.relationship,
        birthDate: formData.birthDate || undefined,
        anniversary: formData.anniversary || undefined,
        interests: formData.interests.split(',').map(i => i.trim()).filter(i => i),
        notes: formData.notes || undefined,
      }

      const res = await fetch('/api/recipients', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setFormData({
          name: '',
          phone: '',
          email: '',
          relationship: '',
          birthDate: '',
          anniversary: '',
          interests: '',
          notes: '',
        })
        setEditingId(null)
        setShowForm(false)
        fetchRecipients()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save recipient')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save recipient')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recipient?')) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/recipients', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        fetchRecipients()
      }
    } catch (err) {
      console.error('Error deleting recipient:', err)
    }
  }

  const handleEdit = (recipient: Recipient) => {
    setFormData({
      name: recipient.name,
      phone: recipient.phone,
      email: recipient.email || '',
      relationship: recipient.relationship,
      birthDate: recipient.birthDate ? recipient.birthDate.split('T')[0] : '',
      anniversary: recipient.anniversary ? recipient.anniversary.split('T')[0] : '',
      interests: recipient.interests.join(', '),
      notes: recipient.notes || '',
    })
    setEditingId(recipient.id)
    setShowForm(true)
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-semibold text-ink">Gift Recipients</h1>
            <p className="text-ink/55 mt-1">Manage your favorite gift recipients</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setFormData({
                name: '',
                phone: '',
                email: '',
                relationship: '',
                birthDate: '',
                anniversary: '',
                interests: '',
                notes: '',
              })
            }}
            className="bg-wine text-white px-6 py-3 rounded-full font-semibold shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep transition-colors"
          >
            {showForm ? '✕ Close' : '+ Add Recipient'}
          </motion.button>
        </div>

        {/* Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[22px] border border-wine/10 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)] p-8 mb-8"
          >
            <h2 className="font-display text-2xl font-semibold text-ink mb-6">
              {editingId ? 'Edit Recipient' : 'Add New Recipient'}
            </h2>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-ink/70 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink/70 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                    placeholder="+977 9812345678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-ink/70 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink/70 mb-2">
                    Relationship *
                  </label>
                  <select
                    required
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                  >
                    <option value="">Select relationship</option>
                    <option value="Friend">Friend</option>
                    <option value="Family">Family</option>
                    <option value="Colleague">Colleague</option>
                    <option value="Partner">Partner</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-ink/70 mb-2">
                    Birthday
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink/70 mb-2">
                    Anniversary
                  </label>
                  <input
                    type="date"
                    value={formData.anniversary}
                    onChange={(e) => setFormData({ ...formData, anniversary: e.target.value })}
                    className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink/70 mb-2">
                  Interests (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.interests}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                  className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                  placeholder="Sports, Books, Music"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink/70 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-wine/15 rounded-xl outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink"
                  placeholder="Any special notes..."
                  rows={3}
                />
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 bg-wine text-white py-3 rounded-full font-semibold shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep transition-colors"
                >
                  {editingId ? 'Update Recipient' : 'Add Recipient'}
                </motion.button>
                {editingId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setFormData({
                        name: '',
                        phone: '',
                        email: '',
                        relationship: '',
                        birthDate: '',
                        anniversary: '',
                        interests: '',
                        notes: '',
                      })
                    }}
                    className="flex-1 border border-wine/20 bg-white text-wine py-3 rounded-full font-semibold hover:bg-cream transition-colors"
                  >
                    Cancel Edit
                  </motion.button>
                )}
              </div>
            </form>
          </motion.div>
        )}

        {/* Recipients List */}
        {isLoading ? (
          <div className="space-y-3">
            <SkeletonLoader variant="list" count={4} />
          </div>
        ) : recipients.length === 0 ? (
          <div className="bg-white rounded-[22px] border border-wine/10 shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)] p-12 text-center">
            <p className="text-ink/55 text-lg mb-4">No recipients saved yet</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(true)}
              className="bg-wine text-white px-6 py-3 rounded-full font-semibold shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep transition-colors"
            >
              Add First Recipient
            </motion.button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipients.map((recipient) => (
              <motion.div
                key={recipient.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-[22px] shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)] p-6 border border-wine/10 hover:border-wine/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">{recipient.name}</h3>
                    <p className="text-sm text-ink/55">{recipient.relationship}</p>
                  </div>
                  <span className="text-2xl">
                    {recipient.relationship === 'Friend' && '👫'}
                    {recipient.relationship === 'Family' && '👨‍👩‍👧'}
                    {recipient.relationship === 'Spouse' && '💑'}
                    {recipient.relationship === 'Partner' && '👩‍❤️‍👨'}
                    {!['Friend', 'Family', 'Spouse', 'Partner'].includes(recipient.relationship) && '👤'}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  <p className="text-ink/70">📱 {recipient.phone}</p>
                  {recipient.email && <p className="text-ink/70">✉️ {recipient.email}</p>}
                  {recipient.birthDate && (
                    <p className="text-ink/70">🎂 {new Date(recipient.birthDate).toLocaleDateString()}</p>
                  )}
                  {recipient.interests.length > 0 && (
                    <p className="text-ink/70">💫 {recipient.interests.join(', ')}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleEdit(recipient)}
                    className="flex-1 border border-wine/20 bg-white text-wine py-2 rounded-full text-sm font-semibold hover:bg-cream transition-colors"
                  >
                    Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(recipient.id)}
                    className="flex-1 bg-red-500 text-white py-2 rounded-full text-sm font-semibold hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
