/**
 * PharmaCare Pro — Point of Sale (Billing Screen)
 *
 * THIS IS THE MOST IMPORTANT SCREEN in the application.
 * Pharmacists use this 50-200 times per day.
 * It MUST be fast, simple, and work with barcode scanners.
 *
 * KEYBOARD SHORTCUTS (all work without clicking anything):
 * - F2         → Open a new bill (from anywhere in the app)
 * - Tab        → Move between fields
 * - Enter      → Confirm current action (add item, process payment)
 * - Escape     → Cancel / close current dialog
 * - F4         → Hold current bill
 * - F5         → Open held bills list
 * - F6         → Add customer to bill
 * - F7         → Open payment screen
 * - F8         → Print last bill
 *
 * USER FLOW:
 * 1. Cashier types medicine name (or scans barcode)
 * 2. Selects medicine from dropdown (or auto-selects if exact barcode match)
 * 3. Adjusts quantity with +/- buttons or typing
 * 4. Repeats for all medicines
 * 5. Presses F7 or clicks "Collect Payment"
 * 6. Selects payment mode (Cash/UPI/Card)
 * 7. Enters amount → app shows change
 * 8. Clicks "Save Bill" → receipt prints automatically
 *
 * Copilot Instructions:
 * - The medicine search input is ALWAYS focused when this page loads
 * - Barcode scanner sends a string followed by Enter key — handle this as barcode scan
 * - If barcode matches exactly one batch, auto-add it to cart (quantity 1)
 * - Show drug interaction warnings as a non-blocking yellow banner (not a blocking popup)
 * - Near-expiry items (< 30 days) show an amber warning icon on the row
 * - Discount can be applied per-item (%) or per-bill (flat ₹ or %)
 * - GST is calculated using the utils/gst.ts helper
 * - On Save: write to bills + bill_items + payments tables in a transaction
 * - On Print: call printerService.printBill(billId) which handles thermal + A4
 * - AI suggestions from billingAssistant appear in a right-side panel (can be hidden)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ShoppingCart, User, Search, Plus, Printer, PauseCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { BillingAssistant } from './components/BillingAssistant'
import { BillItemRow } from './components/BillItemRow'
import { PaymentPanel } from './components/PaymentPanel'
import { CustomerSelector } from './components/CustomerSelector'
import { HeldBills } from './components/HeldBills'
import { BillPreview } from './components/BillPreview'
import { SearchBox } from '@/components/ui/SearchBox'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { billingService } from '@/services/billingService'
import { medicineService } from '@/services/medicineService'
import { formatCurrency } from '@/utils/currency'
import { calculateGST } from '@/utils/gst'
import type { ICartItem, IMedicine, IBatch } from '@/types'

// ── Component ─────────────────────────────────────────────────

export default function BillingPage() {
  // ── State ────────────────────────────────────────────────────
  const searchRef = useRef<HTMLInputElement>(null)

  const [searchQuery,       setSearchQuery]       = useState('')
  const [searchResults,     setSearchResults]     = useState<IMedicine[]>([])
  const [isSearching,       setIsSearching]       = useState(false)
  const [showPayment,       setShowPayment]       = useState(false)
  const [showCustomer,      setShowCustomer]      = useState(false)
  const [showHeld,          setShowHeld]          = useState(false)
  const [showPreview,       setShowPreview]       = useState(false)
  const [showAssistant,     setShowAssistant]     = useState(true)
  const [isSaving,          setIsSaving]          = useState(false)
  const [savedBillId,       setSavedBillId]       = useState<number | null>(null)

  const { user } = useAuthStore()
  const {
    items, customer, doctor, discount,
    addItem, removeItem, updateQuantity, updateDiscount,
    setCustomer, clear,
    subtotal, totalGST, totalAmount, netAmount
  } = useCartStore()

  // ── Auto-focus search when page loads ────────────────────────
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // ── Medicine Search (with barcode detection) ──────────────────
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    // Detect barcode scan: barcodes are usually 8-20 chars with no spaces
    // Barcode scanners send the full code very quickly (< 50ms between chars)
    const isBarcode = /^[A-Z0-9\-]{6,20}$/.test(query) && !query.includes(' ')

    setIsSearching(true)
    try {
      if (isBarcode) {
        // Try exact barcode match first
        const batch = await medicineService.getBatchByBarcode(query)
        if (batch) {
          // Auto-add to cart immediately — no dropdown needed
          addToCart(batch)
          setSearchQuery('')
          setSearchResults([])
          return
        }
      }

      // Regular name search
      const results = await medicineService.searchMedicines(query, { in_stock_only: true })
      setSearchResults(results)
    } catch (err) {
      toast.error('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }, [])

  // ── Add Medicine to Cart ──────────────────────────────────────
  const addToCart = useCallback((batch: IBatch, medicine?: IMedicine) => {
    const item: ICartItem = {
      medicine_id:   batch.medicine_id,
      batch_id:      batch.id,
      medicine_name: medicine?.name || batch.medicine_name || '',
      batch_number:  batch.batch_number,
      expiry_date:   batch.expiry_date,
      quantity:      1,
      unit_price:    batch.selling_price,
      mrp:           batch.selling_price,
      discount_percent: 0,
      discount_amount:  0,
      gst_rate:      medicine?.default_gst_rate || 12,
      cgst_amount:   0,
      sgst_amount:   0,
      igst_amount:   0,
      total_amount:  batch.selling_price,
      is_near_expiry: isDaysUntilExpiry(batch.expiry_date) < 30,
    }

    // Recalculate GST for the item
    const withGST = calculateGST(item)
    addItem(withGST)

    // Clear search and refocus
    setSearchQuery('')
    setSearchResults([])
    searchRef.current?.focus()
  }, [addItem])

  // ── Save Bill ─────────────────────────────────────────────────
  const handleSaveBill = async (payments: IPayment[]) => {
    if (items.length === 0) {
      toast.error('Please add at least one medicine to the bill.')
      return
    }

    setIsSaving(true)
    try {
      const billId = await billingService.createBill({
        customer_id: customer?.id,
        doctor_id:   doctor?.id,
        items,
        payments,
        discount_amount: discount,
        created_by: user!.id,
      })

      setSavedBillId(billId)
      setShowPayment(false)
      setShowPreview(true)         // Show print preview
      clear()                       // Clear the cart
      toast.success('Bill saved successfully! 🎉')
    } catch (err) {
      toast.error('Could not save the bill. Please try again.')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Hold Current Bill ─────────────────────────────────────────
  const handleHoldBill = async () => {
    if (items.length === 0) return
    await billingService.holdBill({ items, customer, label: `Bill held at ${new Date().toLocaleTimeString()}` })
    clear()
    toast.success('Bill held. You can recall it anytime.')
    searchRef.current?.focus()
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">

      {/* ── LEFT: Cart Area ── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-slate-200">

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-blue-600" size={20} />
            <h1 className="font-bold text-slate-800 text-lg">New Bill</h1>
            <span className="text-xs text-slate-400 font-mono">Press F2 anytime</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Customer link button */}
            <Button variant="outline" size="sm" onClick={() => setShowCustomer(true)}>
              <User size={14} className="mr-1.5" />
              {customer ? customer.name : 'Add Customer'}
            </Button>
            {/* Hold bill */}
            {items.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleHoldBill}>
                <PauseCircle size={14} className="mr-1.5" />
                Hold  <kbd className="ml-1 text-slate-400 text-xs">F4</kbd>
              </Button>
            )}
            {/* Recall held bills */}
            <Button variant="ghost" size="sm" onClick={() => setShowHeld(true)}>
              Held Bills <kbd className="ml-1 text-slate-400 text-xs">F5</kbd>
            </Button>
          </div>
        </div>

        {/* Medicine search bar */}
        <div className="p-4 bg-white border-b border-slate-200">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Type medicine name or scan barcode...  (Tab to add quantity)"
              className="w-full pl-10 pr-4 py-3 text-base border-2 border-blue-200 focus:border-blue-500 rounded-xl outline-none transition-colors bg-blue-50 focus:bg-white"
              autoComplete="off"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {searchResults.map((medicine) => (
                <MedicineSearchResult
                  key={medicine.id}
                  medicine={medicine}
                  onSelect={(batch) => addToCart(batch, medicine)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bill items list */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <ShoppingCart size={48} className="text-slate-200" />
              <p className="text-lg font-medium">Bill is empty</p>
              <p className="text-sm">Search for a medicine above or scan a barcode to start</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Medicine</th>
                  <th className="text-center px-2 py-2">Batch</th>
                  <th className="text-center px-2 py-2">Expiry</th>
                  <th className="text-center px-2 py-2">Qty</th>
                  <th className="text-right px-2 py-2">Rate</th>
                  <th className="text-center px-2 py-2">Disc%</th>
                  <th className="text-right px-2 py-2">GST</th>
                  <th className="text-right px-4 py-2">Amount</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <BillItemRow
                    key={`${item.batch_id}-${index}`}
                    item={item}
                    index={index}
                    onQuantityChange={(qty) => updateQuantity(index, qty)}
                    onDiscountChange={(disc) => updateDiscount(index, disc)}
                    onRemove={() => removeItem(index)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bill totals footer */}
        {items.length > 0 && (
          <div className="bg-white border-t border-slate-200 p-4">
            <div className="flex items-end justify-between">
              {/* Totals breakdown */}
              <div className="space-y-1 text-sm text-slate-600">
                <div className="flex gap-8">
                  <span>Subtotal: <strong>{formatCurrency(subtotal)}</strong></span>
                  <span>GST: <strong>{formatCurrency(totalGST)}</strong></span>
                  {discount > 0 && <span className="text-green-600">Discount: <strong>-{formatCurrency(discount)}</strong></span>}
                </div>
              </div>
              {/* Net amount + payment button */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(netAmount)}</p>
                </div>
                <Button
                  size="lg"
                  onClick={() => setShowPayment(true)}
                  className="h-14 px-8 text-base font-bold bg-green-600 hover:bg-green-700"
                >
                  <Printer size={18} className="mr-2" />
                  Collect Payment
                  <kbd className="ml-2 text-green-200 text-xs">F7</kbd>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: AI Assistant Panel ── */}
      {showAssistant && (
        <div className="w-72 flex-shrink-0 bg-white border-l border-slate-200">
          <BillingAssistant
            items={items}
            customer={customer}
            onHide={() => setShowAssistant(false)}
          />
        </div>
      )}

      {/* ── Modals ── */}
      {showPayment && (
        <PaymentPanel
          netAmount={netAmount}
          onConfirm={handleSaveBill}
          onClose={() => setShowPayment(false)}
          isSaving={isSaving}
        />
      )}

      {showCustomer && (
        <CustomerSelector
          current={customer}
          onSelect={setCustomer}
          onClose={() => setShowCustomer(false)}
        />
      )}

      {showHeld && (
        <HeldBills
          onSelect={(cart) => { /* restore cart */ setShowHeld(false) }}
          onClose={() => setShowHeld(false)}
        />
      )}

      {showPreview && savedBillId && (
        <BillPreview
          billId={savedBillId}
          onClose={() => { setShowPreview(false); setSavedBillId(null) }}
        />
      )}
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────

function isDaysUntilExpiry(dateStr: string): number {
  const today = new Date()
  const expiry = new Date(dateStr)
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Single row in the medicine search dropdown.
 * Shows: medicine name, stock level, expiry of nearest batch.
 * Copilot: clicking a result should show its batches (FEFO order)
 * and let user pick or auto-pick the first available batch.
 */
function MedicineSearchResult({
  medicine,
  onSelect,
}: {
  medicine: IMedicine
  onSelect: (batch: IBatch) => void
}) {
  // TODO (Copilot): render medicine name, generic name, stock count
  // If only one available batch, call onSelect immediately on click
  // If multiple batches, show a sub-list of batches for selection
  return (
    <div className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
         onClick={() => medicine.batches?.[0] && onSelect(medicine.batches[0])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900 text-sm">{medicine.name}</p>
          <p className="text-xs text-slate-500">{medicine.generic_name} · {medicine.drug_form}</p>
        </div>
        <div className="text-right">
          <Badge variant={medicine.total_stock > 0 ? 'success' : 'danger'} size="sm">
            {medicine.total_stock > 0 ? `${medicine.total_stock} in stock` : 'Out of stock'}
          </Badge>
          <p className="text-xs text-slate-400 mt-0.5">₹{medicine.batches?.[0]?.selling_price || 0}</p>
        </div>
      </div>
    </div>
  )
}
