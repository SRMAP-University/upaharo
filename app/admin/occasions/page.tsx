'use client'

import { useEffect, useState } from 'react'

interface Occasion {
  id: string
  name: string
  emoji: string
  description: string
  icon: string
  isActive: boolean
}

export default function AdminOccasions() {
  const [occasions, setOccasions] = useState<Occasion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingOccasion, setEditingOccasion] = useState<Occasion | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    emoji: '',
    description: '',
    icon: '',
    isActive: true
  })

  useEffect(() => {
    fetchOccasions()
  }, [])

  const fetchOccasions = async () => {
    try {
      const res = await fetch('/api/admin/occasions')
      if (res.ok) {
        const data = await res.json()
        setOccasions(data)
      }
    } catch (error) {
      console.error('Error fetching occasions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingOccasion
        ? `/api/admin/occasions/${editingOccasion.id}`
        : '/api/admin/occasions'
      const method = editingOccasion ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        fetchOccasions()
        resetForm()
      }
    } catch (error) {
      console.error('Error saving occasion:', error)
    }
  }

  const deleteOccasion = async (id: string) => {
    if (!confirm('Delete this occasion?')) return
    try {
      const res = await fetch(`/api/admin/occasions/${id}`, { method: 'DELETE' })
      if (res.ok) fetchOccasions()
    } catch (error) {
      console.error('Error deleting occasion:', error)
    }
  }

  const editOccasion = (occasion: Occasion) => {
    setEditingOccasion(occasion)
    setFormData({
      name: occasion.name,
      emoji: occasion.emoji,
      description: occasion.description,
      icon: occasion.icon,
      isActive: occasion.isActive
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({ name: '', emoji: '', description: '', icon: '', isActive: true })
    setEditingOccasion(null)
    setShowForm(false)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="hidden font-display text-3xl font-semibold text-ink md:block">Occasions</h1>
          <p className="text-ink/55 mt-1">Manage special occasion categories</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-wine hover:bg-wine-deep text-white px-6 py-2.5 rounded-full font-semibold"
        >
          {showForm ? 'Cancel' : '+ Add Occasion'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-[22px] border border-wine/10 p-6 mb-6">
          <h2 className="font-display text-xl font-semibold text-ink mb-4">{editingOccasion ? 'Edit Occasion' : 'New Occasion'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Name*</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Emoji*</label>
                <input
                  type="text"
                  required
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  placeholder="🎂"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink/70 mb-1">Icon*</label>
                <input
                  type="text"
                  required
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                  placeholder="🎂"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-ink/70 mb-1">Description*</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-wine/15 rounded-xl bg-white text-ink focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40"
                />
              </div>
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
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-wine hover:bg-wine-deep text-white px-6 py-2 rounded-full font-semibold">
                {editingOccasion ? 'Update' : 'Create'} Occasion
              </button>
              <button type="button" onClick={resetForm} className="border border-wine/20 bg-white hover:bg-cream text-wine px-6 py-2 rounded-full font-semibold">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Occasions List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-8 text-center text-ink/55">Loading...</div>
        ) : occasions.length === 0 ? (
          <div className="col-span-3 p-8 text-center text-ink/55">No occasions yet</div>
        ) : (
          occasions.map((occasion) => (
            <div key={occasion.id} className="bg-white rounded-[22px] border border-wine/10 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl">{occasion.icon}</div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-ink">{occasion.name}</h3>
                </div>
                {occasion.isActive && (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-medium">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-ink/55 mb-3">{occasion.description}</p>
              <div className="flex gap-2">
                <button onClick={() => editOccasion(occasion)} className="text-wine hover:text-wine-deep text-sm font-semibold">
                  Edit
                </button>
                <button onClick={() => deleteOccasion(occasion.id)} className="text-red-600 hover:text-red-700 text-sm font-medium">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
