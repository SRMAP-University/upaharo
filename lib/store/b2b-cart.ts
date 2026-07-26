import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface B2BCartItem {
  id: string
  name: string
  price: number // wholesale unit price
  quantity: number
  image: string
}

interface B2BCartStore {
  items: B2BCartItem[]
  addItem: (item: Omit<B2BCartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

/** Completely separate from retail `cart-storage`. */
export const useB2BCartStore = create<B2BCartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const addQuantity = item.quantity || 1
        const existing = get().items.find((i) => i.id === item.id)
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + addQuantity } : i
            ),
          })
        } else {
          set({ items: [...get().items, { ...item, quantity: addQuantity }] })
        }
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) })
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id)
        } else {
          set({
            items: get().items.map((i) => (i.id === id ? { ...i, quantity } : i)),
          })
        }
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => get().items.reduce((t, i) => t + i.quantity, 0),

      getTotalPrice: () => get().items.reduce((t, i) => t + i.price * i.quantity, 0),
    }),
    {
      name: 'b2b-cart-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return localStorage
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
    }
  )
)
