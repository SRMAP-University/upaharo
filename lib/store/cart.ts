import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { rememberCartAdd } from '@/lib/shopper-memory'
import { trackProductEvent } from '@/lib/product-events'
import type { CakeCustomization } from '@/lib/cake-builder'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
  isVeg: boolean
  /** Build Your Own Cake picks; the order API prices these again. */
  customization?: CakeCustomization
  /** Page to open from the cart (defaults to the product page). */
  href?: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string) => void
  /** Puts an edited item where the old one was (a rebuilt custom cake). */
  replaceItem: (oldId: string, item: CartItem) => void
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
        trackProductEvent(item.id, 'add_to_cart', addQuantity)
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

      replaceItem: (oldId, item) => {
        const items = get().items
        const at = items.findIndex((i) => i.id === oldId)
        const rest = items.filter((i) => i.id !== oldId && i.id !== item.id)
        const same = items.find((i) => i.id === item.id && i.id !== oldId)
        const next = same ? { ...item, quantity: same.quantity + item.quantity } : item
        if (at < 0) {
          set({ items: [...rest, next] })
          return
        }
        rest.splice(Math.min(at, rest.length), 0, next)
        set({ items: rest })
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
