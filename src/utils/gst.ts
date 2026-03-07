/**
 * PharmaCare Pro — GST Calculation Utilities
 *
 * All GST calculations for Indian pharmacy billing.
 *
 * Rules:
 * - Intrastate sales: CGST (half rate) + SGST (half rate)
 * - Interstate sales: IGST (full rate)
 * - GST is calculated on the taxable amount (after discount)
 * - Round off to nearest ₹1 per GST rules
 *
 * Medicine GST slabs in India (as of 2025):
 * - 0%  : Generic medicines on National Essential Medicines List (NEML)
 * - 5%  : Most common branded medicines
 * - 12% : Most prescription medicines
 * - 18% : Medical devices, some OTC products
 *
 * Copilot Instructions:
 * - Always use integer arithmetic (paise = ₹ * 100) to avoid floating point errors
 * - Round final amounts to 2 decimal places for display
 * - The calculateGST function modifies a cart item in-place and returns it
 */

import type { ICartItem } from '@/types'

/**
 * Calculate GST for a single cart item.
 * Updates the item's GST amounts and total in-place.
 *
 * @param item - Cart item with unit_price, quantity, discount, gst_rate
 * @param isInterstate - True for interstate sales (uses IGST instead of CGST+SGST)
 * @returns The same item with updated GST amounts
 */
export function calculateGST(item: ICartItem, isInterstate = false): ICartItem {
  // Calculate taxable amount (after item discount)
  const grossAmount = item.unit_price * item.quantity
  const discountAmount = grossAmount * (item.discount_percent / 100)
  const taxableAmount = grossAmount - discountAmount

  // Calculate GST
  const gstAmount = roundToTwoPaises(taxableAmount * (item.gst_rate / 100))

  if (isInterstate) {
    item.cgst_amount = 0
    item.sgst_amount = 0
    item.igst_amount = gstAmount
  } else {
    const halfRate = gstAmount / 2
    item.cgst_amount = roundToTwoPaises(halfRate)
    item.sgst_amount = roundToTwoPaises(halfRate)
    item.igst_amount = 0
  }

  item.discount_amount = roundToTwoPaises(discountAmount)
  item.total_amount = roundToTwoPaises(taxableAmount + gstAmount)

  return item
}

/**
 * Calculate GST summary for a full bill.
 * Returns breakdowns by GST rate (for GST reports).
 */
export function calculateBillTotals(items: ICartItem[], billDiscount = 0): BillTotals {
  let subtotal = 0
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0
  let totalItemDiscount = 0

  for (const item of items) {
    const grossAmount = item.unit_price * item.quantity
    subtotal += grossAmount
    totalItemDiscount += item.discount_amount
    totalCGST += item.cgst_amount
    totalSGST += item.sgst_amount
    totalIGST += item.igst_amount
  }

  const totalGST = totalCGST + totalSGST + totalIGST
  const taxableAmount = subtotal - totalItemDiscount - billDiscount
  const totalAmount = taxableAmount + totalGST
  const roundOff = Math.round(totalAmount) - totalAmount
  const netAmount = totalAmount + roundOff

  return {
    subtotal: roundToTwoPaises(subtotal),
    item_discount: roundToTwoPaises(totalItemDiscount),
    bill_discount: roundToTwoPaises(billDiscount),
    taxable_amount: roundToTwoPaises(taxableAmount),
    cgst_amount: roundToTwoPaises(totalCGST),
    sgst_amount: roundToTwoPaises(totalSGST),
    igst_amount: roundToTwoPaises(totalIGST),
    total_gst: roundToTwoPaises(totalGST),
    total_amount: roundToTwoPaises(totalAmount),
    round_off: roundToTwoPaises(roundOff),
    net_amount: roundToTwoPaises(netAmount),
  }
}

/**
 * Get HSN-wise GST breakdown (for GSTR-1 report).
 * Groups items by HSN code and calculates totals per HSN.
 */
export function getHSNSummary(items: Array<{
  hsn_code: string
  gst_rate: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
}>): HSNEntry[] {
  const grouped = new Map<string, HSNEntry>()

  for (const item of items) {
    const key = `${item.hsn_code}-${item.gst_rate}`
    const existing = grouped.get(key)

    if (existing) {
      existing.taxable_amount   += item.taxable_amount
      existing.cgst_amount      += item.cgst_amount
      existing.sgst_amount      += item.sgst_amount
      existing.igst_amount      += item.igst_amount
      existing.total_tax_amount += item.cgst_amount + item.sgst_amount + item.igst_amount
    } else {
      grouped.set(key, {
        hsn_code:         item.hsn_code,
        gst_rate:         item.gst_rate,
        taxable_amount:   item.taxable_amount,
        cgst_rate:        item.gst_rate / 2,
        cgst_amount:      item.cgst_amount,
        sgst_rate:        item.gst_rate / 2,
        sgst_amount:      item.sgst_amount,
        igst_rate:        item.gst_rate,
        igst_amount:      item.igst_amount,
        total_tax_amount: item.cgst_amount + item.sgst_amount + item.igst_amount,
      })
    }
  }

  return Array.from(grouped.values())
}

// ── Helpers ───────────────────────────────────────────────────

function roundToTwoPaises(amount: number): number {
  return Math.round(amount * 100) / 100
}

// ── Types ─────────────────────────────────────────────────────

export interface BillTotals {
  subtotal: number
  item_discount: number
  bill_discount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_gst: number
  total_amount: number
  round_off: number
  net_amount: number
}

export interface HSNEntry {
  hsn_code: string
  gst_rate: number
  taxable_amount: number
  cgst_rate: number
  cgst_amount: number
  sgst_rate: number
  sgst_amount: number
  igst_rate: number
  igst_amount: number
  total_tax_amount: number
}

/**
 * Format a number as Indian currency (₹ with Indian number format).
 * e.g., 125000 → "₹1,25,000.00"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}
