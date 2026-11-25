'use client'

import InventoryWorkspace from './InventoryWorkspace'

/** Record: the whole store's stock, orders, sales & profit and custom sales (was "Inventory"). */
export default function RecordPage() {
  return (
    <InventoryWorkspace
      title="Record"
      description="Stock in hand, orders, purchase and selling prices, and sales and profit for the whole store. Locked with a PIN."
    />
  )
}
