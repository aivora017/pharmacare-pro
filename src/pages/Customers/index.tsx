import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageHeader } from '@/components/shared/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { customerService, type ICustomerSearchItem } from '@/services/customerService'
import { useAuthStore } from '@/store/authStore'
import type { ICustomer, IDoctor } from '@/types'

type CustomerCreateForm = {
  name: string
  phone: string
  email: string
}

type CustomerEditForm = {
  name: string
  phone: string
  phone2: string
  email: string
  gender: string
  blood_group: string
  date_of_birth: string
  address: string
  pincode: string
  doctor_id?: number
  notes: string
}

type CustomerHistoryItem = {
  id: number
  bill_number: string
  bill_date: string
  status: string
  net_amount: number
  outstanding: number
  item_count: number
}

const EMPTY_CREATE: CustomerCreateForm = { name: '', phone: '', email: '' }

const EMPTY_EDIT: CustomerEditForm = {
  name: '',
  phone: '',
  phone2: '',
  email: '',
  gender: '',
  blood_group: '',
  date_of_birth: '',
  address: '',
  pincode: '',
  doctor_id: undefined,
  notes: '',
}

export default function CustomersPage() {
  const user = useAuthStore((state) => state.user)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [rows, setRows] = useState<ICustomerSearchItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [payingCredit, setPayingCredit] = useState(false)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<ICustomer | null>(null)
  const [history, setHistory] = useState<CustomerHistoryItem[]>([])
  const [doctors, setDoctors] = useState<IDoctor[]>([])

  const [createForm, setCreateForm] = useState<CustomerCreateForm>(EMPTY_CREATE)
  const [editForm, setEditForm] = useState<CustomerEditForm>(EMPTY_EDIT)

  const loadList = useCallback(async (searchQuery: string, activeSelectedId?: number | null) => {
    setLoadingList(true)
    try {
      const data = await customerService.search(searchQuery)
      setRows(data)
      if (activeSelectedId && !data.some((row) => row.id === activeSelectedId)) {
        setSelectedId(null)
        setSelected(null)
        setHistory([])
      }
    } catch {
      toast.error('Could not load customers.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true)
    try {
      const [customer, customerHistory] = await Promise.all([
        customerService.get(id),
        customerService.getHistory(id, 30),
      ])
      setSelected(customer)
      setHistory(customerHistory as CustomerHistoryItem[])
      setEditForm({
        name: customer.name,
        phone: customer.phone ?? '',
        phone2: customer.phone2 ?? '',
        email: customer.email ?? '',
        gender: customer.gender ?? '',
        blood_group: customer.blood_group ?? '',
        date_of_birth: customer.date_of_birth ?? '',
        address: customer.address ?? '',
        pincode: customer.pincode ?? '',
        doctor_id: customer.doctor_id,
        notes: customer.notes ?? '',
      })
    } catch {
      toast.error('Could not load customer details.')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    void loadList(debouncedQuery, selectedId)
  }, [debouncedQuery, selectedId, loadList])

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const data = await customerService.listDoctors()
        setDoctors(data)
      } catch {
        toast.error('Could not load doctors.')
      }
    }
    void loadDoctors()
  }, [])

  useEffect(() => {
    if (!selectedId) return
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const customerDoctorName = useMemo(() => {
    if (!selected?.doctor_id) return 'Not assigned'
    return doctors.find((row) => row.id === selected.doctor_id)?.name ?? 'Not assigned'
  }, [doctors, selected?.doctor_id])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!createForm.name.trim()) {
      toast.error('Customer name is required.')
      return
    }

    setCreating(true)
    try {
      const id = await customerService.create(
        {
          name: createForm.name.trim(),
          phone: createForm.phone.trim() || undefined,
          email: createForm.email.trim() || undefined,
        },
        user.id
      )
      toast.success('Customer created.')
      setCreateForm(EMPTY_CREATE)
      await loadList(query, selectedId)
      setSelectedId(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not create customer.')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !selectedId) return
    if (!editForm.name.trim()) {
      toast.error('Customer name is required.')
      return
    }

    setSaving(true)
    try {
      await customerService.update(
        selectedId,
        {
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || undefined,
          phone2: editForm.phone2.trim() || undefined,
          email: editForm.email.trim() || undefined,
          gender: (editForm.gender.trim() as ICustomer['gender']) || undefined,
          blood_group: editForm.blood_group.trim() || undefined,
          date_of_birth: editForm.date_of_birth || undefined,
          address: editForm.address.trim() || undefined,
          pincode: editForm.pincode.trim() || undefined,
          doctor_id: editForm.doctor_id,
          notes: editForm.notes.trim() || undefined,
          is_active: true,
        },
        user.id
      )
      toast.success('Customer updated.')
      await Promise.all([loadList(query, selectedId), loadDetail(selectedId)])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not update customer.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreditPayment = async () => {
    if (!user || !selectedId) return
    if (creditAmount <= 0) {
      toast.error('Enter a valid payment amount.')
      return
    }

    setPayingCredit(true)
    try {
      await customerService.recordCreditPayment(selectedId, creditAmount, user.id)
      toast.success('Credit payment recorded.')
      setCreditAmount(0)
      await Promise.all([loadList(query, selectedId), loadDetail(selectedId)])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not record credit payment.')
    } finally {
      setPayingCredit(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <PageHeader title="Customers" subtitle="Customer profiles, balances, and purchase history" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-1 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Add Customer</h3>
            <form className="space-y-2" onSubmit={handleCreate}>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Customer name"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
              <input
                value={createForm.phone}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
              <input
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
              >
                {creating ? 'Saving...' : 'Save Customer'}
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Search</h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or phone"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
          </div>

          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {loadingList ? (
              <div className="py-10">
                <LoadingSpinner text="Loading customers..." />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500 p-4">No customers found.</p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full text-left px-4 py-3 min-h-touch hover:bg-slate-50 ${
                    selectedId === row.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.phone || 'No phone'}</p>
                  <p
                    className={`text-xs ${
                      row.outstanding_balance > 0 ? 'text-red-600' : 'text-slate-500'
                    }`}
                  >
                    Outstanding: Rs {row.outstanding_balance.toFixed(2)} | Loyalty:{' '}
                    {row.loyalty_points}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-2">
          {!selectedId ? (
            <p className="text-sm text-slate-500">Select a customer to view details.</p>
          ) : loadingDetail || !selected ? (
            <div className="py-12">
              <LoadingSpinner text="Loading profile..." />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500">Outstanding</p>
                  <p className="text-sm font-semibold text-red-600">
                    Rs {selected.outstanding_balance.toFixed(2)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={creditAmount || ''}
                      onChange={(e) => setCreditAmount(Number(e.target.value) || 0)}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Pay"
                      className="w-24 border border-slate-300 rounded-md px-2 py-1 text-xs min-h-touch"
                    />
                    <button
                      type="button"
                      onClick={handleCreditPayment}
                      disabled={payingCredit || selected.outstanding_balance <= 0}
                      className="text-xs px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white min-h-touch"
                    >
                      {payingCredit ? 'Saving...' : 'Record Payment'}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500">Loyalty Points</p>
                  <p className="text-sm font-semibold text-slate-800">{selected.loyalty_points}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500">Assigned Doctor</p>
                  <p className="text-sm font-semibold text-slate-800">{customerDoctorName}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500">History Entries</p>
                  <p className="text-sm font-semibold text-slate-800">{history.length}</p>
                </div>
              </div>

              <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleUpdate}>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Name"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={editForm.phone2}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone2: e.target.value }))}
                  placeholder="Alternative phone"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                >
                  <option value="">Gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  value={editForm.blood_group}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, blood_group: e.target.value }))
                  }
                  placeholder="Blood group"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={editForm.date_of_birth}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, date_of_birth: e.target.value }))
                  }
                  type="date"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={editForm.pincode}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, pincode: e.target.value }))}
                  placeholder="Pincode"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <select
                  value={editForm.doctor_id ?? ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      doctor_id: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                >
                  <option value="">Assigned doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch md:col-span-2"
                />
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes"
                  rows={3}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm md:col-span-2"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="md:col-span-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
                >
                  {saving ? 'Updating...' : 'Update Customer'}
                </button>
              </form>

              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Purchase History</h3>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-500 p-4">No bill history yet.</p>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{item.bill_number}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(item.bill_date).toLocaleString()} | Items: {item.item_count}
                        </p>
                        <p className="text-xs text-slate-600">
                          Net: Rs {item.net_amount.toFixed(2)} | Outstanding: Rs{' '}
                          {item.outstanding.toFixed(2)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
