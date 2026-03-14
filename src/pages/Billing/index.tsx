/**
 * POS Billing — most used screen (50-200x per day).
 * Keyboard: F2=new, F4=hold, F5=held bills, F7=payment, Escape=close
 * Barcode scan: fast chars+Enter → auto-add item
 * FEFO: batch with nearest expiry is selected automatically
 * Drug interactions: warn in amber banner but NEVER block billing
 *
 * Copilot next steps for this file:
 * 1. Implement medicine search dropdown (medicineService.search)
 * 2. Implement barcode scan detection and auto-add
 * 3. Build PaymentPanel component in ./components/PaymentPanel.tsx
 * 4. Build CustomerSelector modal in ./components/CustomerSelector.tsx
 * 5. Build HeldBillsPanel in ./components/HeldBillsPanel.tsx
 * 6. Drug interaction check when adding each item
 * 7. Call billingService.createBill() on payment confirm
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { ShoppingCart, Search, User, PauseCircle, Paperclip, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import {
  billingService,
  type IHeldBillSummary,
  type ISaleReturnSummary,
} from '@/services/billingService'
import { printerService } from '@/services/printerService'
import {
  medicineService,
  type IBatchItem,
  type IMedicineListItem,
} from '@/services/medicineService'
import type { IBill, ICartItem } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { MedicineSearchDropdown } from './components/MedicineSearchDropdown'
import { PaymentPanel } from './components/PaymentPanel'
import { CustomerSelector } from './components/CustomerSelector'

function makeCartItem(medicine: IMedicineListItem, batch: IBatchItem): ICartItem {
  const nearExpiryDays = 30
  const expiryMs = new Date(batch.expiry_date).getTime()
  const nowMs = Date.now()
  const daysToExpiry = Math.ceil((expiryMs - nowMs) / (24 * 60 * 60 * 1000))

  return {
    medicine_id: medicine.id,
    batch_id: batch.id,
    medicine_name: medicine.name,
    batch_number: batch.batch_number,
    expiry_date: batch.expiry_date,
    quantity: 1,
    unit_price: batch.selling_price,
    mrp: batch.selling_price,
    discount_percent: 0,
    discount_amount: 0,
    gst_rate: medicine.default_gst_rate,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    total_amount: batch.selling_price,
    is_near_expiry: daysToExpiry >= 0 && daysToExpiry <= nearExpiryDays,
    interaction_warnings: [],
  }
}

export default function BillingPage() {
  const searchRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const [searchResults, setSearchResults] = useState<IMedicineListItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isSavingBill, setIsSavingBill] = useState(false)
  const [showHeldBills, setShowHeldBills] = useState(false)
  const [showBillHistory, setShowBillHistory] = useState(false)
  const [showSalesReturn, setShowSalesReturn] = useState(false)
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false)
  const [heldBills, setHeldBills] = useState<IHeldBillSummary[]>([])
  const [returnBillIdInput, setReturnBillIdInput] = useState('')
  const [isLoadingReturnBill, setIsLoadingReturnBill] = useState(false)
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false)
  const [returnBill, setReturnBill] = useState<IBill | null>(null)
  const [returnQtyByItemId, setReturnQtyByItemId] = useState<Record<number, number>>({})
  const [returnReason, setReturnReason] = useState('Customer return')
  const [recentReturns, setRecentReturns] = useState<ISaleReturnSummary[]>([])
  const [isLoadingRecentReturns, setIsLoadingRecentReturns] = useState(false)
  const [recentBills, setRecentBills] = useState<IBill[]>([])
  const [isLoadingRecentBills, setIsLoadingRecentBills] = useState(false)
  const [historyPrinterType, setHistoryPrinterType] = useState<'thermal' | 'normal'>('thermal')
  const [printingBillId, setPrintingBillId] = useState<number | null>(null)
  const [prescriptionRef, setPrescriptionRef] = useState('')
  const [prescriptionImage, setPrescriptionImage] = useState<string | undefined>(undefined)
  const [redeemInput, setRedeemInput] = useState('0')
  const [redeemedPoints, setRedeemedPoints] = useState(0)
  const [allergyWarning, setAllergyWarning] = useState('')
  const scannerBufferRef = useRef('')
  const scannerFirstTsRef = useRef(0)
  const scannerLastTsRef = useRef(0)
  const user = useAuthStore((state) => state.user)
  const {
    items,
    customer,
    totals,
    addItem,
    removeItem,
    updateQuantity,
    updateItemDiscount,
    billDiscount,
    setBillDiscount,
    setCustomer,
    clear,
  } = useCartStore()

  const payableNetAmount = Math.max(0, totals.net_amount - redeemedPoints)

  const maybeShowInteractionWarning = useCallback(
    (incomingMedicineName: string) => {
      const normalizedIncoming = incomingMedicineName.toLowerCase()
      const existing = items.map((item) => item.medicine_name.toLowerCase())

      const dangerPairs: Array<[string, string, string]> = [
        ['diclo', 'ibuprofen', 'Avoid combining two NSAIDs unless explicitly prescribed.'],
        ['aceclo', 'ibuprofen', 'Avoid combining two NSAIDs unless explicitly prescribed.'],
        ['paracetamol', 'dolo', 'Possible duplicate paracetamol exposure. Verify dose.'],
      ]

      for (const [a, b, message] of dangerPairs) {
        const hasA = normalizedIncoming.includes(a) || existing.some((name) => name.includes(a))
        const hasB = normalizedIncoming.includes(b) || existing.some((name) => name.includes(b))
        if (hasA && hasB) {
          toast(message, { icon: '⚠️' })
          break
        }
      }
    },
    [items]
  )

  const loadHeldBills = useCallback(async () => {
    try {
      setIsLoadingHeldBills(true)
      const rows = await billingService.getHeldBills()
      setHeldBills(rows)
    } catch {
      toast.error('Failed to load held bills.')
    } finally {
      setIsLoadingHeldBills(false)
    }
  }, [])

  const recallHeldBill = useCallback(
    async (heldBillId: number) => {
      try {
        setIsLoadingHeldBills(true)
        const restoredItems = await billingService.restoreHeldBill(heldBillId)
        clear()
        setCustomer(null)
        for (const item of restoredItems) {
          addItem(item)
        }
        setShowHeldBills(false)
        toast.success('Held bill restored.')
      } catch {
        toast.error('Failed to restore held bill.')
      } finally {
        setIsLoadingHeldBills(false)
      }
    },
    [addItem, clear, setCustomer]
  )

  const loadReturnBill = useCallback(async () => {
    const billId = Number(returnBillIdInput)
    if (!Number.isInteger(billId) || billId <= 0) {
      toast.error('Enter a valid bill ID.')
      return
    }

    try {
      setIsLoadingReturnBill(true)
      const bill = await billingService.getBill(billId)
      if (bill.status !== 'active') {
        toast.error('Only active bills can be returned.')
        setReturnBill(null)
        return
      }

      setReturnBill(bill)
      const initialQty: Record<number, number> = {}
      for (const item of bill.items ?? []) {
        initialQty[item.id] = 0
      }
      setReturnQtyByItemId(initialQty)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load bill for return.'
      toast.error(message)
      setReturnBill(null)
    } finally {
      setIsLoadingReturnBill(false)
    }
  }, [returnBillIdInput])

  const submitSalesReturn = useCallback(async () => {
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }

    if (!returnBill) {
      toast.error('Load a bill first.')
      return
    }

    const lines = (returnBill.items ?? [])
      .map((item) => ({
        bill_item_id: item.id,
        quantity: Math.max(0, Math.floor(returnQtyByItemId[item.id] ?? 0)),
      }))
      .filter((item) => item.quantity > 0)

    if (lines.length === 0) {
      toast.error('Select at least one item quantity for return.')
      return
    }

    try {
      setIsSubmittingReturn(true)
      const returnId = await billingService.createReturn(
        returnBill.id,
        lines,
        returnReason.trim() || 'Customer return',
        user.id
      )
      toast.success(`Sales return #${returnId} created.`)
      try {
        const latest = await billingService.listReturns(10)
        setRecentReturns(latest)
      } catch {
        // Non-blocking refresh failure; creation already succeeded.
      }
      setShowSalesReturn(false)
      setReturnBill(null)
      setReturnBillIdInput('')
      setReturnQtyByItemId({})
      setReturnReason('Customer return')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create sales return.'
      toast.error(message)
    } finally {
      setIsSubmittingReturn(false)
    }
  }, [returnBill, returnQtyByItemId, returnReason, user])

  const loadRecentReturns = useCallback(async () => {
    try {
      setIsLoadingRecentReturns(true)
      const rows = await billingService.listReturns(10)
      setRecentReturns(rows)
    } catch {
      toast.error('Could not load recent sales returns.')
    } finally {
      setIsLoadingRecentReturns(false)
    }
  }, [])

  const loadRecentBills = useCallback(async () => {
    try {
      setIsLoadingRecentBills(true)
      const payload = await billingService.listBills({ page: 1, page_size: 20, status: 'active' })
      setRecentBills(payload.bills ?? [])
    } catch {
      toast.error('Could not load bill history.')
    } finally {
      setIsLoadingRecentBills(false)
    }
  }, [])

  const reprintBill = useCallback(
    async (billId: number) => {
      try {
        if (!user) {
          toast.error('Session expired. Please login again.')
          return
        }
        setPrintingBillId(billId)
        await printerService.printBill(billId, historyPrinterType, user.id)
        toast.success(`Bill #${billId} sent to printer.`)
      } catch {
        toast.error('Reprint failed. Check printer connection and try again.')
      } finally {
        setPrintingBillId(null)
      }
    },
    [historyPrinterType]
  )

  const addMedicineToCart = useCallback(
    async (medicine: IMedicineListItem) => {
      try {
        setIsAddingItem(true)
        const batches = await medicineService.listBatches(medicine.id)
        const sellable = batches
          .filter((batch) => batch.quantity_on_hand > 0)
          .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))

        if (sellable.length === 0) {
          toast.error('No sellable batch available for this medicine.')
          return
        }

        addItem(makeCartItem(medicine, sellable[0]))
        maybeShowInteractionWarning(medicine.name)
        setSearchQuery('')
        setSearchResults([])
        toast.success('Medicine added to bill.')
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to add medicine.'
        toast.error(msg)
      } finally {
        setIsAddingItem(false)
      }
    },
    [addItem, maybeShowInteractionWarning]
  )

  const addBarcodeToCart = useCallback(
    async (barcode: string) => {
      try {
        setIsAddingItem(true)
        const batch = await medicineService.getBatchByBarcode(barcode)
        if (batch.quantity_on_hand <= 0) {
          toast.error('This batch is out of stock.')
          return
        }

        const medicine = await medicineService.get(batch.medicine_id)
        addItem(
          makeCartItem(
            {
              id: medicine.id,
              name: medicine.name,
              generic_name: medicine.generic_name,
              category_id: medicine.category_id,
              category_name: medicine.category_name,
              schedule: medicine.schedule,
              default_gst_rate: medicine.default_gst_rate,
              reorder_level: medicine.reorder_level,
              total_stock: medicine.total_stock,
              is_active: medicine.is_active,
            },
            batch
          )
        )
        maybeShowInteractionWarning(medicine.name)
        setSearchQuery('')
        setSearchResults([])
        toast.success('Barcode item added to bill.')
      } catch {
        toast.error('Barcode not found. Please search medicine manually.')
      } finally {
        setIsAddingItem(false)
      }
    },
    [addItem, maybeShowInteractionWarning]
  )

  const handlePaymentConfirm = async (payload: {
    payments: { amount: number; payment_mode: string; reference_no?: string }[]
    print: {
      enabled: boolean
      printer_type: 'thermal' | 'normal'
    }
  }) => {
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }

    try {
      setIsSavingBill(true)
      const billId = await billingService.createBill({
        customer_id: customer?.id,
        prescription_ref: prescriptionRef.trim() || undefined,
        prescription_image: prescriptionImage,
        loyalty_points_redeemed: redeemedPoints,
        items,
        payments: payload.payments,
        discount_amount: totals.bill_discount + redeemedPoints,
        created_by: user.id,
      })
      clear()
      setPrescriptionRef('')
      setPrescriptionImage(undefined)
      setRedeemedPoints(0)
      setRedeemInput('0')
      setShowPayment(false)
      toast.success(`Bill #${billId} saved successfully.`)

      if (payload.print.enabled) {
        try {
          await printerService.printBill(billId, payload.print.printer_type, user.id)
          toast.success('Print job queued.')
        } catch {
          toast.error('Print failed. Please retry from bill history.')
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save bill.'
      toast.error(msg)
    } finally {
      setIsSavingBill(false)
    }
  }

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    let active = true
    setIsSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const result = await medicineService.search({
          query: q,
          in_stock_only: true,
          sort: 'name_asc',
        })
        if (active) {
          setSearchResults(result)
        }
      } catch {
        if (active) {
          setSearchResults([])
          toast.error('Medicine search failed. Try again.')
        }
      } finally {
        if (active) {
          setIsSearching(false)
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  useEffect(() => {
    if (!showSalesReturn) {
      return
    }
    void loadRecentReturns()
  }, [loadRecentReturns, showSalesReturn])

  useEffect(() => {
    if (!showBillHistory) {
      return
    }
    void loadRecentBills()
  }, [loadRecentBills, showBillHistory])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditableTarget =
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')

      if (e.key === 'F7' && items.length > 0) {
        e.preventDefault()
        setShowPayment(true)
        return
      }

      if (e.key === 'F5') {
        e.preventDefault()
        setShowHeldBills(true)
        void loadHeldBills()
        return
      }

      if (e.key === 'Escape') {
        setShowPayment(false)
        setShowHeldBills(false)
        setShowBillHistory(false)
        setShowSalesReturn(false)
        return
      }

      if (showPayment) {
        return
      }

      if (isEditableTarget && target !== searchRef.current) {
        return
      }

      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const now = Date.now()
        if (now - scannerLastTsRef.current > 100) {
          scannerBufferRef.current = ''
          scannerFirstTsRef.current = now
        } else if (!scannerFirstTsRef.current) {
          scannerFirstTsRef.current = now
        }
        scannerBufferRef.current += e.key
        scannerLastTsRef.current = now
        return
      }

      if (e.key === 'Enter') {
        const barcode = scannerBufferRef.current.trim()
        const firstTs = scannerFirstTsRef.current
        const lastTs = scannerLastTsRef.current
        scannerBufferRef.current = ''
        scannerFirstTsRef.current = 0
        scannerLastTsRef.current = 0

        const charCount = barcode.length
        const totalMs =
          firstTs > 0 && lastTs >= firstTs ? lastTs - firstTs : Number.MAX_SAFE_INTEGER
        const avgMsPerChar = charCount > 1 ? totalMs / (charCount - 1) : Number.MAX_SAFE_INTEGER
        const looksLikeScannerInput = charCount >= 6 && avgMsPerChar <= 35

        if (looksLikeScannerInput) {
          void addBarcodeToCart(barcode)
        }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [items.length, addBarcodeToCart, showPayment, loadHeldBills])

  useEffect(() => {
    if (!customer || items.length === 0) {
      setAllergyWarning('')
      return
    }

    const tags = [...(customer.allergies ?? []), ...(customer.chronic_conditions ?? [])]
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 1)
    if (tags.length === 0) {
      setAllergyWarning('')
      return
    }

    const hits = items.filter((item) =>
      tags.some((tag) => item.medicine_name.toLowerCase().includes(tag))
    )

    if (hits.length === 0) {
      setAllergyWarning('')
      return
    }

    setAllergyWarning(
      `Potential allergy/condition match for: ${hits.map((item) => item.medicine_name).join(', ')}`
    )
  }, [customer, items])

  return (
    <div className="flex h-full bg-slate-50 -m-4 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-600" />
            <h1 className="font-bold text-slate-800">New Bill</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowCustomerSelector(true)
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-touch"
            >
              <User size={14} />
              {customer ? customer.name : 'Add Customer (F6)'}
            </button>
            <label className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-touch cursor-pointer">
              <Paperclip size={14} />
              <span>{prescriptionRef ? 'Prescription Attached' : 'Attach Prescription'}</span>
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setPrescriptionRef(file.name)

                  // Store as base64 so bill record can retain attachment content offline.
                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(String(reader.result || ''))
                    reader.onerror = () => reject(new Error('Could not read file'))
                    reader.readAsDataURL(file)
                  })
                  setPrescriptionImage(dataUrl)
                  toast.success('Prescription file attached.')
                }}
              />
            </label>
            {items.length > 0 && (
              <button
                onClick={async () => {
                  try {
                    await billingService.holdBill({
                      items,
                      customer,
                      created_by: user?.id,
                      label: `Held ${new Date().toLocaleTimeString()}`,
                    })
                    clear()
                    toast.success('Bill held.')
                  } catch {
                    toast.error('Failed to hold bill. Please retry.')
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-touch"
              >
                <PauseCircle size={14} />
                Hold<kbd className="ml-1 text-slate-400 text-xs font-mono">F4</kbd>
              </button>
            )}
            <button
              onClick={() => {
                setShowHeldBills(true)
                void loadHeldBills()
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-touch"
            >
              Held Bills<kbd className="ml-1 text-slate-400 text-xs font-mono">F5</kbd>
            </button>
            <button
              onClick={() => {
                setShowBillHistory(true)
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-touch"
            >
              Bill History
            </button>
            <button
              onClick={() => {
                setShowSalesReturn(true)
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-touch"
            >
              Sales Return
            </button>
          </div>
        </div>
        <div className="px-4 py-3 bg-white border-b border-slate-200">
          {allergyWarning && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{allergyWarning}</span>
            </div>
          )}
          <div className="relative">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') {
                  return
                }

                const trimmed = searchQuery.trim()
                if (trimmed.length >= 6 && /^\d+$/.test(trimmed)) {
                  e.preventDefault()
                  void addBarcodeToCart(trimmed)
                  return
                }

                if (searchResults.length === 1) {
                  e.preventDefault()
                  void addMedicineToCart(searchResults[0])
                }
              }}
              placeholder="Type medicine name or scan barcode to add..."
              autoComplete="off"
              className="w-full pl-10 pr-4 py-3 text-sm border-2 border-blue-200 focus:border-blue-500 rounded-xl outline-none bg-blue-50 focus:bg-white transition-colors"
            />
          </div>
          <MedicineSearchDropdown
            query={searchQuery}
            results={searchResults}
            isLoading={isSearching || isAddingItem}
            onSelect={(medicine) => {
              void addMedicineToCart(medicine)
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-16">
              <ShoppingCart size={48} className="text-slate-200" />
              <p className="text-base font-medium">Bill is empty</p>
              <p className="text-sm">Search for a medicine above or scan a barcode</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">Medicine</th>
                  <th className="text-center px-2 py-2.5">Expiry</th>
                  <th className="text-center px-2 py-2.5">Qty</th>
                  <th className="text-right px-2 py-2.5">Rate</th>
                  <th className="text-center px-2 py-2.5 w-20">Disc%</th>
                  <th className="text-right px-2 py-2.5">GST</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, i) => (
                  <tr key={i} className={item.is_near_expiry ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.medicine_name}</p>
                      <p className="text-xs text-slate-400">Batch: {item.batch_number}</p>
                      {item.is_near_expiry && (
                        <span className="text-xs text-amber-600 font-medium">⚠ Near expiry</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center text-xs text-slate-500">
                      {item.expiry_date}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateQuantity(i, item.quantity - 1)}
                          className="w-6 h-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-100 text-slate-700"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(i, parseInt(e.target.value) || 1)}
                          className="w-12 text-center border border-slate-300 rounded text-sm py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => updateQuantity(i, item.quantity + 1)}
                          className="w-6 h-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-100 text-slate-700"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-slate-700">₹{item.unit_price}</td>
                    <td className="px-2 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.discount_percent}
                        onChange={(e) => updateItemDiscount(i, parseFloat(e.target.value) || 0)}
                        className="w-16 text-center border border-slate-300 rounded text-sm py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-3 text-right text-xs text-slate-500">
                      ₹{(item.cgst_amount + item.sgst_amount + item.igst_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      ₹{item.total_amount.toFixed(2)}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => removeItem(i)}
                        className="text-slate-300 hover:text-red-500 text-lg leading-none"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {items.length > 0 && (
          <div className="bg-white border-t border-slate-200 px-4 py-3">
            <div className="flex items-end justify-between">
              <div className="text-sm text-slate-600 space-y-0.5">
                {customer && (
                  <p className="text-xs text-slate-500">
                    Customer points: {customer.loyalty_points} | Outstanding: ₹
                    {customer.outstanding_balance.toFixed(2)}
                  </p>
                )}
                <p>
                  Subtotal: ₹{totals.subtotal.toFixed(2)} &nbsp;|&nbsp; GST: ₹
                  {totals.total_gst.toFixed(2)}
                </p>
                {customer && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Redeem points</label>
                    <input
                      type="number"
                      min={0}
                      value={redeemInput}
                      onChange={(e) => setRedeemInput(e.target.value)}
                      className="w-24 text-center border border-slate-300 rounded text-sm py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const value = Math.floor(Number(redeemInput) || 0)
                        const maxAllowed = Math.min(
                          customer.loyalty_points,
                          Math.floor(totals.net_amount)
                        )
                        const finalPoints = Math.max(0, Math.min(value, maxAllowed))
                        setRedeemedPoints(finalPoints)
                        setRedeemInput(finalPoints.toString())
                      }}
                      className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100 min-h-touch"
                    >
                      Apply
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Bill discount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={billDiscount}
                    onChange={(e) => setBillDiscount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-24 text-center border border-slate-300 rounded text-sm py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {totals.item_discount > 0 && (
                  <p className="text-green-600">Discount: -₹{totals.item_discount.toFixed(2)}</p>
                )}
                {totals.bill_discount > 0 && (
                  <p className="text-green-600">
                    Bill discount: -₹{totals.bill_discount.toFixed(2)}
                  </p>
                )}
                {redeemedPoints > 0 && (
                  <p className="text-green-600">Loyalty redeemed: -₹{redeemedPoints.toFixed(2)}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Amount</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {formatCurrency(payableNetAmount)}
                  </p>
                </div>
                <button
                  onClick={() => setShowPayment(true)}
                  className="h-14 px-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow flex items-center gap-2"
                >
                  Collect Payment <kbd className="text-green-200 text-xs font-mono">F7</kbd>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showPayment && (
        <PaymentPanel
          netAmount={payableNetAmount}
          isSaving={isSavingBill}
          onClose={() => setShowPayment(false)}
          onConfirm={(payload) => {
            void handlePaymentConfirm(payload)
          }}
        />
      )}
      {showCustomerSelector && (
        <CustomerSelector
          userId={user?.id}
          onClose={() => setShowCustomerSelector(false)}
          onSelect={(c) => {
            setCustomer(c)
            setRedeemedPoints(0)
            setRedeemInput('0')
            setShowCustomerSelector(false)
            toast.success('Customer linked to bill.')
          }}
        />
      )}
      {showHeldBills && (
        <div className="fixed inset-0 z-30 bg-black/20 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Held Bills</h3>
              <button
                type="button"
                onClick={() => setShowHeldBills(false)}
                className="min-h-touch px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {isLoadingHeldBills ? (
                <p className="px-4 py-4 text-sm text-slate-500">Loading held bills...</p>
              ) : heldBills.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">No held bill found.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {heldBills.map((bill) => (
                    <li key={bill.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{bill.label}</p>
                        <p className="text-xs text-slate-500">{bill.created_at}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void recallHeldBill(bill.id)
                        }}
                        className="min-h-touch px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                      >
                        Recall
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {showBillHistory && (
        <div className="fixed inset-0 z-30 bg-black/20 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Bill History & Reprint</h3>
              <button
                type="button"
                onClick={() => setShowBillHistory(false)}
                className="min-h-touch px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Print Format</label>
                  <select
                    value={historyPrinterType}
                    onChange={(e) => setHistoryPrinterType(e.target.value as 'thermal' | 'normal')}
                    className="min-h-touch rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="thermal">Thermal (80mm)</option>
                    <option value="normal">Normal (A4)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void loadRecentBills()
                  }}
                  disabled={isLoadingRecentBills}
                  className="min-h-touch rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {isLoadingRecentBills ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {isLoadingRecentBills ? (
                  <p className="p-4 text-sm text-slate-500">Loading bill history...</p>
                ) : recentBills.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No bills found.</p>
                ) : (
                  <div className="max-h-[420px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="text-left text-slate-600">
                          <th className="px-3 py-2.5 font-medium">Bill #</th>
                          <th className="px-3 py-2.5 font-medium">Bill Date</th>
                          <th className="px-3 py-2.5 font-medium text-right">Net Amount</th>
                          <th className="px-3 py-2.5 font-medium">Status</th>
                          <th className="px-3 py-2.5 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBills.map((bill) => (
                          <tr key={bill.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2.5 text-slate-800 font-medium">{bill.bill_number}</td>
                            <td className="px-3 py-2.5 text-slate-600">{bill.bill_date}</td>
                            <td className="px-3 py-2.5 text-right text-slate-800">
                              {formatCurrency(bill.net_amount)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 capitalize">{bill.status}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  void reprintBill(bill.id)
                                }}
                                disabled={printingBillId === bill.id}
                                className="min-h-touch rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                              >
                                {printingBillId === bill.id ? 'Printing...' : 'Reprint'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showSalesReturn && (
        <div className="fixed inset-0 z-30 bg-black/20 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Create Sales Return</h3>
              <button
                type="button"
                onClick={() => setShowSalesReturn(false)}
                className="min-h-touch px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600 mb-2">Recent Sales Returns</p>
                {isLoadingRecentReturns ? (
                  <p className="text-sm text-slate-500">Loading recent returns...</p>
                ) : recentReturns.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent sales returns found.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {recentReturns.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setReturnBillIdInput(String(row.original_bill_id))}
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-left hover:bg-slate-100"
                      >
                        <p className="text-xs font-medium text-slate-800">
                          {row.return_number} | Bill #{row.original_bill_id} ({row.original_bill_number || 'N/A'})
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.return_date} | Amount: {formatCurrency(row.total_amount)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Bill ID</label>
                  <input
                    type="number"
                    min={1}
                    value={returnBillIdInput}
                    onChange={(e) => setReturnBillIdInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
                    placeholder="Enter original bill ID"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={() => void loadReturnBill()}
                    disabled={isLoadingReturnBill}
                    className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:bg-slate-400 min-h-touch"
                  >
                    {isLoadingReturnBill ? 'Loading...' : 'Load Bill'}
                  </button>
                </div>
              </div>

              {returnBill && (
                <>
                  <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                    <p className="text-sm text-slate-700">
                      Bill: <span className="font-semibold">{returnBill.bill_number}</span> | Date:{' '}
                      {returnBill.bill_date}
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-medium">Medicine</th>
                          <th className="px-3 py-2.5 text-right font-medium">Sold Qty</th>
                          <th className="px-3 py-2.5 text-right font-medium">Return Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(returnBill.items ?? []).map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-2.5 text-slate-700">{item.medicine_name}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                max={item.quantity}
                                value={returnQtyByItemId[item.id] ?? 0}
                                onChange={(e) => {
                                  const value = Math.max(
                                    0,
                                    Math.min(item.quantity, Math.floor(Number(e.target.value) || 0))
                                  )
                                  setReturnQtyByItemId((prev) => ({ ...prev, [item.id]: value }))
                                }}
                                className="w-24 rounded border border-slate-300 px-2 py-1 text-right min-h-touch"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Reason</label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
                      placeholder="Reason for return"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submitSalesReturn()}
                      disabled={isSubmittingReturn}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300 min-h-touch"
                    >
                      {isSubmittingReturn ? 'Saving...' : 'Create Sales Return'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
