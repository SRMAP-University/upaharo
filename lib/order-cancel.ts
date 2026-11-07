/**
 * Who cancelled an order and why. Stored on Order.cancelledBy / cancelReason;
 * plain helpers (no database) shared by the APIs and the pages.
 */

export type CancelledBy = 'CUSTOMER' | 'ADMIN' | 'SELLER' | 'SYSTEM'

/** Reasons a customer picks from (or "Other" with their own words). */
export const CUSTOMER_CANCEL_REASONS = [
  'Ordered by mistake',
  'Want to change items or address',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'No longer needed',
]

/** Reasons the store (admin) picks from. The customer sees the reason. */
export const STORE_CANCEL_REASONS = [
  'Out of stock',
  'Customer asked to cancel',
  'Could not reach the customer',
  'Address outside our delivery area',
  'Payment not received',
  'Duplicate or test order',
]

export const CANCEL_REASON_MAX = 300

/** A tidy reason from user input, or null when empty. */
export function readCancelReason(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, CANCEL_REASON_MAX)
  return text || null
}

/** "Cancelled by customer" for the store, "Cancelled by you" for the customer. */
export function cancelledByLabel(by: string | null | undefined, viewer: 'store' | 'customer') {
  switch (by) {
    case 'CUSTOMER':
      return viewer === 'customer' ? 'Cancelled by you' : 'Cancelled by customer'
    case 'ADMIN':
      return viewer === 'customer' ? 'Cancelled by Upaharo' : 'Cancelled by admin'
    case 'SELLER':
      return viewer === 'customer' ? 'Cancelled by the seller' : 'Cancelled by seller'
    case 'SYSTEM':
      return 'Cancelled automatically'
    default:
      return 'Cancelled'
  }
}
