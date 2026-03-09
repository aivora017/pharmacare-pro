/**
 * Cart Store - in-memory POS state.
 * Saved to DB only when billing_create_bill is called.
 * All mutations recalculate GST automatically.
 */
import { create } from "zustand"
import { calculateItemGST, calculateBillTotals, emptyTotals, type BillTotals } from "@/utils/gst"
import type { ICartItem, ICustomer } from "@/types"

type CartCustomer = Pick<
  ICustomer,
  "id" | "name" | "phone" | "outstanding_balance" | "loyalty_points" | "allergies" | "chronic_conditions"
>

interface CartStore {
  items: ICartItem[]
  customer: CartCustomer | null
  billDiscount: number
  totals: BillTotals
  addItem: (item: ICartItem) => void
  removeItem: (index: number) => void
  updateQuantity: (index: number, qty: number) => void
  updateItemDiscount: (index: number, pct: number) => void
  setBillDiscount: (amount: number) => void
  setCustomer: (c: CartCustomer | null) => void
  clear: () => void
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [], customer: null, billDiscount: 0, totals: emptyTotals,

  addItem: (raw) => {
    const item = calculateItemGST({ ...raw })
    const idx  = get().items.findIndex(i => i.batch_id === item.batch_id)
    const items = idx >= 0
      ? get().items.map((i,n) => n===idx ? calculateItemGST({...i, quantity: i.quantity+item.quantity}) : i)
      : [...get().items, item]
    set({ items, totals: calculateBillTotals(items, get().billDiscount) })
  },

  removeItem: (idx) => {
    const items = get().items.filter((_,i) => i !== idx)
    set({ items, totals: calculateBillTotals(items, get().billDiscount) })
  },

  updateQuantity: (idx, qty) => {
    if (qty <= 0) { get().removeItem(idx); return }
    const items = get().items.map((i,n) => n===idx ? calculateItemGST({...i, quantity: qty}) : i)
    set({ items, totals: calculateBillTotals(items, get().billDiscount) })
  },

  updateItemDiscount: (idx, pct) => {
    const items = get().items.map((i,n) => n===idx ? calculateItemGST({...i, discount_percent: pct}) : i)
    set({ items, totals: calculateBillTotals(items, get().billDiscount) })
  },

  setBillDiscount: (amount) => {
    set({ billDiscount: amount, totals: calculateBillTotals(get().items, amount) })
  },

  setCustomer: (customer) => set({ customer }),
  clear: () => set({ items: [], customer: null, billDiscount: 0, totals: emptyTotals }),
}))
