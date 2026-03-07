import { FormEvent, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { billingService } from '@/services/billingService'
import type { ICartItem } from '@/types'
import { calculateBillTotals, calculateGST, formatINR } from '@/utils/gst'

/**
 * Lightweight billing screen used for local validation and core GST flow tests.
 */
export default function BillingPage() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ICartItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const totals = useMemo(() => calculateBillTotals(items), [items])

  const addLineItem = (event: FormEvent) => {
    event.preventDefault()

    const name = query.trim()
    if (!name) {
      toast.error('Enter a medicine name first.')
      return
    }

    const basePrice = 50
    const timestamp = Date.now()
    const nextItem: ICartItem = {
      medicine_id: timestamp,
      batch_id: timestamp,
      medicine_name: name,
      batch_number: `B-${Math.floor(Math.random() * 1000)}`,
      expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      quantity: 1,
      unit_price: basePrice,
      mrp: basePrice,
      discount_percent: 0,
      discount_amount: 0,
      gst_rate: 12,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: basePrice,
      is_near_expiry: false,
    }

    setItems((prev) => [...prev, calculateGST(nextItem)])
    setQuery('')
  }

  const updateQuantity = (index: number, quantity: number) => {
    const safeQuantity = Number.isNaN(quantity) ? 1 : Math.max(1, quantity)
    setItems((prev) =>
      prev.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item
        }

        const updated: ICartItem = {
          ...item,
          quantity: safeQuantity,
        }

        return calculateGST(updated)
      })
    )
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const holdDraft = async () => {
    if (items.length === 0) {
      toast.error('Add at least one medicine to hold a draft bill.')
      return
    }

    setIsSaving(true)
    try {
      await billingService.holdBill({
        items,
        label: `Draft ${new Date().toLocaleTimeString()}`,
      })
      toast.success('Draft bill saved.')
      setItems([])
    } catch {
      toast.error('Could not save draft bill.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-600">Add medicines, adjust quantity, and hold a bill draft.</p>
      </header>

      <form onSubmit={addLineItem} className="flex gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter medicine name"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} className="mr-2" />
          Add Item
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Medicine</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-right">Unit</th>
              <th className="px-3 py-2 text-right">GST</th>
              <th className="px-3 py-2 text-right">Line Total</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                  No items added yet.
                </td>
              </tr>
            )}
            {items.map((item, index) => (
              <tr key={`${item.batch_id}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.medicine_name}</td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => updateQuantity(index, Number(event.target.value))}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-center"
                  />
                </td>
                <td className="px-3 py-2 text-right">{formatINR(item.unit_price)}</td>
                <td className="px-3 py-2 text-right">{formatINR(item.cgst_amount + item.sgst_amount + item.igst_amount)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatINR(item.total_amount)}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="inline-flex items-center text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex justify-between text-sm text-slate-700">
          <span>Subtotal</span>
          <strong>{formatINR(totals.subtotal)}</strong>
        </div>
        <div className="mt-1 flex justify-between text-sm text-slate-700">
          <span>Total GST</span>
          <strong>{formatINR(totals.total_gst)}</strong>
        </div>
        <div className="mt-2 flex justify-between text-base text-slate-900">
          <span className="font-semibold">Net Amount</span>
          <strong>{formatINR(totals.net_amount)}</strong>
        </div>

        <button
          type="button"
          onClick={holdDraft}
          disabled={isSaving}
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Hold Draft Bill'}
        </button>
      </div>
    </section>
  )
}
