import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type B2BAddress = {
  id: string
  label: string
  street: string
  apartment?: string | null
  landmark?: string | null
  city: string
  state: string
  pincode: string
  latitude: number
  longitude: number
}

export type B2BBusinessSession = {
  token: string
  user: {
    id: string
    name: string
    email: string
    phone: string | null
  }
  shopName: string
  address: B2BAddress | null
}

interface B2BBusinessStore {
  session: B2BBusinessSession | null
  setSession: (session: B2BBusinessSession | null) => void
  clearSession: () => void
  isRegistered: () => boolean
}

/** Isolated from retail user/location stores. */
export const useB2BBusinessStore = create<B2BBusinessStore>()(
  persist(
    (set, get) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
      isRegistered: () => Boolean(get().session?.token && get().session?.shopName),
    }),
    {
      name: 'b2b-business-storage',
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
