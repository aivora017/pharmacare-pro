/**
 * Payment collection panel — slides in from right.
 * Modes: Cash (show change calculator), UPI (show QR), Card, Credit, Split.
 * Copilot:
 * - Cash mode: input amount → auto-calculate change
 * - UPI mode: show QR code using jsbarcode or qrcode library
 * - Split: allow multiple payment modes summing to net_amount
 * - Validate: total payments must equal net_amount before enabling Save button
 * - On Save: call onConfirm(payments)
 */
import { useMemo, useState } from 'react'

interface Props {
  netAmount: number
  onConfirm: (payload: {
    payments: { amount: number; payment_mode: string; reference_no?: string }[]
    print: {
      enabled: boolean
      printer_type: 'thermal' | 'normal'
    }
  }) => void
  onClose: () => void
  isSaving?: boolean
}

const modes = ['cash', 'upi', 'card', 'credit', 'cheque'] as const

interface SplitLine {
  id: number
  mode: (typeof modes)[number]
  amount: string
  referenceNo: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function PaymentPanel({ netAmount, onConfirm, onClose, isSaving = false }: Props) {
  const [paymentMode, setPaymentMode] = useState<(typeof modes)[number]>('cash')
  const [amount, setAmount] = useState(netAmount.toFixed(2))
  const [referenceNo, setReferenceNo] = useState('')
  const [isSplit, setIsSplit] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { id: 1, mode: 'cash', amount: netAmount.toFixed(2), referenceNo: '' },
  ])
  const [printEnabled, setPrintEnabled] = useState(true)
  const [printerType, setPrinterType] = useState<'thermal' | 'normal'>('thermal')

  const amountNumber = useMemo(() => Number(amount || 0), [amount])
  const change = useMemo(() => Math.max(0, amountNumber - netAmount), [amountNumber, netAmount])
  const pending = useMemo(() => Math.max(0, netAmount - amountNumber), [amountNumber, netAmount])
  const isReferenceRequired = paymentMode !== 'cash' && paymentMode !== 'credit'

  const splitTotal = useMemo(
    () => r2(splitLines.reduce((sum, line) => sum + Number(line.amount || 0), 0)),
    [splitLines]
  )
  const splitPending = useMemo(
    () => r2(Math.max(0, netAmount - splitTotal)),
    [netAmount, splitTotal]
  )
  const splitExtra = useMemo(() => r2(Math.max(0, splitTotal - netAmount)), [netAmount, splitTotal])
  const hasInvalidSplitRef = useMemo(
    () =>
      splitLines.some(
        (line) =>
          line.mode !== 'cash' && line.mode !== 'credit' && line.referenceNo.trim().length === 0
      ),
    [splitLines]
  )

  const canSubmitSingle =
    amountNumber >= netAmount && (!isReferenceRequired || referenceNo.trim().length > 0)
  const canSubmitSplit = splitTotal === r2(netAmount) && !hasInvalidSplitRef

  const updateSplitLine = <K extends keyof SplitLine>(id: number, key: K, value: SplitLine[K]) => {
    setSplitLines((prev) => prev.map((line) => (line.id === id ? { ...line, [key]: value } : line)))
  }

  const addSplitLine = () => {
    const nextId = splitLines.length === 0 ? 1 : Math.max(...splitLines.map((l) => l.id)) + 1
    setSplitLines((prev) => [...prev, { id: nextId, mode: 'cash', amount: '0', referenceNo: '' }])
  }

  const removeSplitLine = (id: number) => {
    setSplitLines((prev) => {
      if (prev.length <= 1) {
        return prev
      }
      return prev.filter((line) => line.id !== id)
    })
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md h-full bg-white shadow-xl border-l border-slate-200 p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Collect Payment</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-touch px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4 flex-1 overflow-y-auto">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Net Amount</p>
            <p className="text-2xl font-bold text-slate-900">₹{netAmount.toFixed(2)}</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isSplit}
              onChange={(e) => {
                const checked = e.target.checked
                setIsSplit(checked)
                if (!checked) {
                  setAmount(netAmount.toFixed(2))
                  setPaymentMode('cash')
                  setReferenceNo('')
                }
              }}
              className="w-4 h-4"
            />
            Enable split payment
          </label>

          {!isSplit ? (
            <>
              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={printEnabled}
                    onChange={(e) => setPrintEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Print bill after save
                </label>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Print Format
                  </label>
                  <select
                    value={printerType}
                    onChange={(e) => setPrinterType(e.target.value as 'thermal' | 'normal')}
                    disabled={!printEnabled}
                    className="w-full min-h-touch rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  >
                    <option value="thermal">Thermal (80mm)</option>
                    <option value="normal">Normal (A4)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as (typeof modes)[number])}
                  className="w-full min-h-touch rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {modes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount Received
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full min-h-touch rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                {paymentMode === 'cash' && (
                  <p className="text-xs mt-1 text-slate-500">Change: ₹{change.toFixed(2)}</p>
                )}
                {pending > 0 && (
                  <p className="text-xs mt-1 text-red-600">Pending: ₹{pending.toFixed(2)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reference No {isReferenceRequired ? '(required)' : '(optional)'}
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Txn / card / cheque reference"
                  className="w-full min-h-touch rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {splitLines.map((line) => {
                const refRequired = line.mode !== 'cash' && line.mode !== 'credit'
                return (
                  <div key={line.id} className="rounded-lg border border-slate-200 p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={line.mode}
                        onChange={(e) =>
                          updateSplitLine(line.id, 'mode', e.target.value as (typeof modes)[number])
                        }
                        className="min-h-touch rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      >
                        {modes.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.amount}
                        onChange={(e) => updateSplitLine(line.id, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="min-h-touch rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={line.referenceNo}
                        onChange={(e) => updateSplitLine(line.id, 'referenceNo', e.target.value)}
                        placeholder={refRequired ? 'Reference (required)' : 'Reference (optional)'}
                        className="flex-1 min-h-touch rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSplitLine(line.id)}
                        disabled={splitLines.length <= 1}
                        className="min-h-touch px-3 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={addSplitLine}
                className="min-h-touch w-full rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
              >
                + Add Payment Line
              </button>
              <div className="text-xs text-slate-600">
                <p>Total entered: ₹{splitTotal.toFixed(2)}</p>
                {splitPending > 0 && (
                  <p className="text-red-600">Pending: ₹{splitPending.toFixed(2)}</p>
                )}
                {splitExtra > 0 && (
                  <p className="text-amber-700">Extra: ₹{splitExtra.toFixed(2)}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isSaving || (!isSplit ? !canSubmitSingle : !canSubmitSplit)}
          onClick={() => {
            if (!isSplit) {
              onConfirm({
                payments: [
                  {
                    amount: netAmount,
                    payment_mode: paymentMode,
                    reference_no: referenceNo.trim() || undefined,
                  },
                ],
                print: {
                  enabled: printEnabled,
                  printer_type: printerType,
                },
              })
              return
            }

            onConfirm({
              payments: splitLines
                .map((line) => ({
                  amount: Number(line.amount || 0),
                  payment_mode: line.mode,
                  reference_no: line.referenceNo.trim() || undefined,
                }))
                .filter((line) => line.amount > 0),
              print: {
                enabled: printEnabled,
                printer_type: printerType,
              },
            })
          }}
          className="mt-4 min-h-touch rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving bill...' : 'Confirm Payment'}
        </button>
      </div>
    </div>
  )
}
