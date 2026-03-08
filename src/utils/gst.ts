/**
 * GST Utilities for Indian Pharmacy Billing
 * Intrastate = CGST + SGST (half each). Interstate = IGST (full rate).
 * ALWAYS use these functions. Never calculate GST inline in components.
 */
import type { ICartItem } from "@/types"

export function calculateItemGST(item: ICartItem, isInterstate = false): ICartItem {
  const gross   = item.unit_price * item.quantity
  const discAmt = gross * (item.discount_percent / 100)
  const taxable = gross - discAmt
  const gstAmt  = r2(taxable * (item.gst_rate / 100))
  item.discount_amount = r2(discAmt)
  if (isInterstate) {
    item.cgst_amount = 0; item.sgst_amount = 0; item.igst_amount = gstAmt
  } else {
    item.cgst_amount = r2(gstAmt / 2); item.sgst_amount = r2(gstAmt / 2); item.igst_amount = 0
  }
  item.total_amount = r2(taxable + gstAmt)
  return { ...item }
}

export interface BillTotals {
  subtotal: number; item_discount: number; bill_discount: number
  taxable_amount: number; cgst_amount: number; sgst_amount: number
  igst_amount: number; total_gst: number; total_amount: number
  round_off: number; net_amount: number
}

export function calculateBillTotals(items: ICartItem[], billDiscount = 0): BillTotals {
  let sub = 0, cgst = 0, sgst = 0, igst = 0, disc = 0
  for (const i of items) {
    sub  += i.unit_price * i.quantity
    disc += i.discount_amount
    cgst += i.cgst_amount; sgst += i.sgst_amount; igst += i.igst_amount
  }
  const totalGST = r2(cgst + sgst + igst)
  const taxable  = r2(sub - disc - billDiscount)
  const total    = r2(taxable + totalGST)
  const roundOff = r2(Math.round(total) - total)
  return {
    subtotal: r2(sub), item_discount: r2(disc), bill_discount: r2(billDiscount),
    taxable_amount: taxable, cgst_amount: r2(cgst), sgst_amount: r2(sgst),
    igst_amount: r2(igst), total_gst: totalGST, total_amount: total,
    round_off: roundOff, net_amount: r2(total + roundOff),
  }
}

export const emptyTotals: BillTotals = {
  subtotal:0, item_discount:0, bill_discount:0, taxable_amount:0,
  cgst_amount:0, sgst_amount:0, igst_amount:0, total_gst:0,
  total_amount:0, round_off:0, net_amount:0,
}

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", minimumFractionDigits:2 }).format(n)

const r2 = (n: number) => Math.round(n * 100) / 100
