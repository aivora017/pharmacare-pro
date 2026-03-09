import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { customerService, type ICustomerSearchItem } from '@/services/customerService'

interface Props {
  onSelect: (c: {
    id: number
    name: string
    phone?: string
    outstanding_balance: number
    loyalty_points: number
  }) => void
  onClose: () => void
  userId?: number
}

export function CustomerSelector({ onSelect, onClose, userId }: Props) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<ICustomerSearchItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true)
        const result = await customerService.search(query)
        if (active) {
          setRows(result)
        }
      } catch {
        if (active) {
          toast.error('Failed to search customers.')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="fixed inset-0 z-30 bg-black/20 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Select Customer</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone"
            className="w-full min-h-touch rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-4 text-sm text-slate-500">Searching...</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">No customer found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => (
                <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.phone || 'No phone'} | Outstanding: Rs{' '}
                      {row.outstanding_balance.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">Loyalty: {row.loyalty_points} pts</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="min-h-touch px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    Select
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs font-medium text-slate-700 mb-2">Quick add customer</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="min-h-touch rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone"
              className="min-h-touch rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                if (!userId) {
                  toast.error('Login required to create customer.')
                  return
                }
                if (newName.trim().length === 0) {
                  toast.error('Customer name is required.')
                  return
                }
                try {
                  const id = await customerService.create(
                    { name: newName.trim(), phone: newPhone.trim() || undefined },
                    userId
                  )
                  onSelect({
                    id,
                    name: newName.trim(),
                    phone: newPhone.trim() || undefined,
                    outstanding_balance: 0,
                    loyalty_points: 0,
                  })
                  toast.success('Customer created and selected.')
                } catch {
                  toast.error('Failed to create customer.')
                }
              }}
              className="min-h-touch rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
            >
              Create + Select
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
