import type { ReactNode } from 'react'

/** Short QR redirect shell for digital invoices. */
export default function ShortBillLayout({ children }: { children: ReactNode }) {
  return (
    <div data-digital-bill="1" style={{ minHeight: '100vh', background: '#f6f9fc' }}>
      {children}
    </div>
  )
}
