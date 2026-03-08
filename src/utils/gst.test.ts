import { describe, expect, it } from 'vitest'
import { calculateItemGST } from './gst'

describe('calculateItemGST', () => {
  it('computes a valid item total shape', () => {
    const result = calculateItemGST({
      quantity: 2,
      unit_price: 100,
      discount_percent: 0,
      discount_amount: 0,
      gst_rate: 12,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
      medicine_id: 1,
      batch_id: 1,
      medicine_name: 'Sample',
      batch_number: 'B001',
      expiry_date: '2026-12-31',
      mrp: 100,
    })

    expect(result.total_amount).toBeGreaterThan(0)
    expect(result.cgst_amount).toBeGreaterThanOrEqual(0)
    expect(result.sgst_amount).toBeGreaterThanOrEqual(0)
  })
})
