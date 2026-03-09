import { FormEvent, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageHeader } from '@/components/shared/PageHeader'
import { supplierService } from '@/services/supplierService'
import { useAuthStore } from '@/store/authStore'
import type { ISupplier } from '@/types'

type SupplierForm = {
  name: string
  contact_person: string
  phone: string
  email: string
  email_domain: string
  gstin: string
  drug_licence_no: string
  drug_licence_expiry: string
  payment_terms: number
  credit_limit: number
  reliability_score: number
}

const EMPTY_FORM: SupplierForm = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  email_domain: '',
  gstin: '',
  drug_licence_no: '',
  drug_licence_expiry: '',
  payment_terms: 30,
  credit_limit: 0,
  reliability_score: 50,
}

function getLicenceStatus(expiry?: string) {
  if (!expiry) return { label: 'Unknown', className: 'text-slate-600 bg-slate-100' }
  const today = new Date()
  const date = new Date(expiry)
  if (Number.isNaN(date.getTime()))
    return { label: 'Unknown', className: 'text-slate-600 bg-slate-100' }
  const days = Math.floor((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 0) return { label: 'Expired', className: 'text-red-700 bg-red-100' }
  if (days <= 30) return { label: 'Expiring Soon', className: 'text-amber-700 bg-amber-100' }
  return { label: 'Valid', className: 'text-emerald-700 bg-emerald-100' }
}

export default function SuppliersPage() {
  const user = useAuthStore((state) => state.user)
  const [rows, setRows] = useState<ISupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ISupplier | null>(null)
  const [createForm, setCreateForm] = useState<SupplierForm>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<SupplierForm>(EMPTY_FORM)

  const loadSuppliers = async (): Promise<ISupplier[]> => {
    setLoading(true)
    try {
      const data = await supplierService.list()
      setRows(data)
      return data
    } catch {
      toast.error('Could not load suppliers.')
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSuppliers()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.phone ?? '').toLowerCase().includes(q) ||
        (row.email ?? '').toLowerCase().includes(q) ||
        (row.gstin ?? '').toLowerCase().includes(q)
    )
  }, [query, rows])

  const onSelect = (row: ISupplier) => {
    setSelected(row)
    setEditForm({
      name: row.name,
      contact_person: row.contact_person ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      email_domain: row.email_domain ?? '',
      gstin: row.gstin ?? '',
      drug_licence_no: row.drug_licence_no ?? '',
      drug_licence_expiry: row.drug_licence_expiry ?? '',
      payment_terms: row.payment_terms,
      credit_limit: row.credit_limit,
      reliability_score: row.reliability_score,
    })
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!createForm.name.trim()) {
      toast.error('Supplier name is required.')
      return
    }

    setCreating(true)
    try {
      const id = await supplierService.create(
        {
          ...createForm,
          name: createForm.name.trim(),
          contact_person: createForm.contact_person.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
          email: createForm.email.trim() || undefined,
          email_domain: createForm.email_domain.trim() || undefined,
          gstin: createForm.gstin.trim() || undefined,
          drug_licence_no: createForm.drug_licence_no.trim() || undefined,
          drug_licence_expiry: createForm.drug_licence_expiry || undefined,
        },
        user.id
      )
      toast.success('Supplier created.')
      setCreateForm(EMPTY_FORM)
      const fresh = await loadSuppliers()
      const created = fresh.find((row) => row.id === id)
      if (created) onSelect(created)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not create supplier.')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !selected) return
    if (!editForm.name.trim()) {
      toast.error('Supplier name is required.')
      return
    }

    setSaving(true)
    try {
      await supplierService.update(
        selected.id,
        {
          ...editForm,
          name: editForm.name.trim(),
          contact_person: editForm.contact_person.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          email: editForm.email.trim() || undefined,
          email_domain: editForm.email_domain.trim() || undefined,
          gstin: editForm.gstin.trim() || undefined,
          drug_licence_no: editForm.drug_licence_no.trim() || undefined,
          drug_licence_expiry: editForm.drug_licence_expiry || undefined,
          is_active: true,
        },
        user.id
      )
      toast.success('Supplier updated.')
      const fresh = await loadSuppliers()
      const refreshed = fresh.find((row) => row.id === selected.id)
      if (refreshed) onSelect(refreshed)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not update supplier.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <PageHeader title="Suppliers" subtitle="Distributor and supplier management" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-1">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Add Supplier</h3>
          <form className="space-y-2" onSubmit={handleCreate}>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Supplier name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
            <input
              value={createForm.contact_person}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, contact_person: e.target.value }))
              }
              placeholder="Contact person"
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
              {creating ? 'Saving...' : 'Save Supplier'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Suppliers ({filtered.length})</h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search supplier"
              className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
          </div>

          {loading ? (
            <div className="py-10">
              <LoadingSpinner text="Loading suppliers..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4">No suppliers found.</p>
                ) : (
                  filtered.map((row) => {
                    const status = getLicenceStatus(row.drug_licence_expiry)
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => onSelect(row)}
                        className={`w-full text-left px-4 py-3 min-h-touch hover:bg-slate-50 ${
                          selected?.id === row.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-500">
                          {row.phone || 'No phone'} | {row.email || 'No email'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${status.className}`}
                          >
                            {status.label}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Outstanding: Rs {row.outstanding_balance.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                {!selected ? (
                  <p className="text-sm text-slate-500">Select a supplier to edit details.</p>
                ) : (
                  <form className="space-y-2" onSubmit={handleUpdate}>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Edit Supplier</h4>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Supplier name"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                    />
                    <input
                      value={editForm.contact_person}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, contact_person: e.target.value }))
                      }
                      placeholder="Contact person"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                    />
                    <input
                      value={editForm.gstin}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, gstin: e.target.value }))}
                      placeholder="GSTIN"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                    />
                    <input
                      value={editForm.drug_licence_no}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, drug_licence_no: e.target.value }))
                      }
                      placeholder="Drug licence no"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                    />
                    <input
                      value={editForm.drug_licence_expiry}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, drug_licence_expiry: e.target.value }))
                      }
                      type="date"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                    />
                    <input
                      value={editForm.email_domain}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, email_domain: e.target.value }))
                      }
                      placeholder="Email domain for auto-import"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={editForm.payment_terms}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            payment_terms: Number(e.target.value) || 0,
                          }))
                        }
                        type="number"
                        min={0}
                        placeholder="Terms"
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      />
                      <input
                        value={editForm.credit_limit}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            credit_limit: Number(e.target.value) || 0,
                          }))
                        }
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Credit"
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      />
                      <input
                        value={editForm.reliability_score}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            reliability_score: Number(e.target.value) || 0,
                          }))
                        }
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        placeholder="Reliability"
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
                    >
                      {saving ? 'Updating...' : 'Update Supplier'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
