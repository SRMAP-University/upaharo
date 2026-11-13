import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { rememberCartAdd } from '@/lib/shopper-memory'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
  isVeg: boolean
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  
  // Gift features
  giftOptions: {
    isGift: boolean
    recipientId?: string
    occasionId?: string
    giftWrapId?: string
    greetingMessage?: string
    senderName?: string
    showSenderName: boolean
  }
  setGiftOptions: (options: CartStore['giftOptions']) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      giftOptions: {
        isGift: false,
        showSenderName: true,
      },
      
      setGiftOptions: (options) => {
        set({ giftOptions: options })
      },
      
      addItem: (item) => {
        const addQuantity = item.quantity || 1
        rememberCartAdd(item.id)
        const existingItem = get().items.find((i) => i.id === item.id)
        if (existingItem) {
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
            items: get().items.map((i) =>
              i.id === id ? { ...i, quantity } : i
            ),
          })
        }
      },
      
      clearCart: () => {
        set({ items: [] })
      },
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },
      
      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0)
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      skipHydration: false,
    }
  )
)
