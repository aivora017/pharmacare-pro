import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageHeader } from '@/components/shared/PageHeader'
import { customerService } from '@/services/customerService'
import { useAuthStore } from '@/store/authStore'
import type { IDoctor } from '@/types'

type DoctorFormState = {
  name: string
  registration_no: string
  specialisation: string
  qualification: string
  clinic_name: string
  phone: string
  email: string
}

const EMPTY_FORM: DoctorFormState = {
  name: '',
  registration_no: '',
  specialisation: '',
  qualification: '',
  clinic_name: '',
  phone: '',
  email: '',
}

export default function DoctorsPage() {
  const user = useAuthStore((state) => state.user)
  const [rows, setRows] = useState<IDoctor[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [createForm, setCreateForm] = useState<DoctorFormState>(EMPTY_FORM)
  const [selected, setSelected] = useState<IDoctor | null>(null)
  const [editForm, setEditForm] = useState<DoctorFormState>(EMPTY_FORM)

  const loadDoctors = useCallback(async (selectedDoctorId?: number): Promise<IDoctor[]> => {
    setLoading(true)
    try {
      const data = await customerService.listDoctors()
      setRows(data)
      if (selectedDoctorId) {
        const refreshed = data.find((item) => item.id === selectedDoctorId)
        if (refreshed) {
          setSelected(refreshed)
          setEditForm({
            name: refreshed.name ?? '',
            registration_no: refreshed.registration_no ?? '',
            specialisation: refreshed.specialisation ?? '',
            qualification: refreshed.qualification ?? '',
            clinic_name: refreshed.clinic_name ?? '',
            phone: refreshed.phone ?? '',
            email: refreshed.email ?? '',
          })
        }
      }
      return data
    } catch {
      toast.error('Could not load doctors.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDoctors()
  }, [loadDoctors])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.specialisation ?? '').toLowerCase().includes(q) ||
        (row.registration_no ?? '').toLowerCase().includes(q) ||
        (row.phone ?? '').toLowerCase().includes(q)
    )
  }, [query, rows])

  const onSelect = (row: IDoctor) => {
    setSelected(row)
    setEditForm({
      name: row.name ?? '',
      registration_no: row.registration_no ?? '',
      specialisation: row.specialisation ?? '',
      qualification: row.qualification ?? '',
      clinic_name: row.clinic_name ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
    })
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!createForm.name.trim()) {
      toast.error('Doctor name is required.')
      return
    }

    setCreating(true)
    try {
      const id = await customerService.createDoctor(
        {
          ...createForm,
          name: createForm.name.trim(),
        },
        user.id
      )
      toast.success('Doctor saved.')
      setCreateForm(EMPTY_FORM)
      const fresh = await loadDoctors()
      const created = fresh.find((row) => row.id === id)
      if (created) onSelect(created)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not save doctor.')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !selected) return
    if (!editForm.name.trim()) {
      toast.error('Doctor name is required.')
      return
    }

    setSaving(true)
    try {
      await customerService.updateDoctor(
        selected.id,
        {
          ...editForm,
          name: editForm.name.trim(),
          is_active: true,
        },
        user.id
      )
      toast.success('Doctor updated.')
      await loadDoctors(selected.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not update doctor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Doctors"
        subtitle="Manage doctor profiles used in prescriptions and billing"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Add Doctor</h3>
          <form className="space-y-3" onSubmit={handleCreate}>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Doctor name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
            <input
              value={createForm.specialisation}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, specialisation: e.target.value }))
              }
              placeholder="Specialisation"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
            <input
              value={createForm.registration_no}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, registration_no: e.target.value }))
              }
              placeholder="Registration number"
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg px-4 py-2 text-sm font-medium min-h-touch"
            >
              {creating ? 'Saving...' : 'Save Doctor'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Doctors ({filtered.length})</h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search doctor, speciality, reg no"
              className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
          </div>

          {loading ? (
            <div className="py-10">
              <LoadingSpinner text="Loading doctors..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4">No doctors found.</p>
                ) : (
                  filtered.map((row) => (
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
                        {row.specialisation || 'General'}
                        {row.registration_no ? ` | Reg: ${row.registration_no}` : ''}
                      </p>
                      <p className="text-xs text-slate-500">{row.phone || 'No phone'}</p>
                    </button>
                  ))
                )}
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                {!selected ? (
                  <p className="text-sm text-slate-500">Select a doctor to edit details.</p>
                ) : (
                  <form className="space-y-3" onSubmit={handleUpdate}>
                    <h4 className="text-sm font-semibold text-slate-800">Edit Doctor</h4>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      placeholder="Doctor name"
                    />
                    <input
                      value={editForm.specialisation}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, specialisation: e.target.value }))
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      placeholder="Specialisation"
                    />
                    <input
                      value={editForm.registration_no}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, registration_no: e.target.value }))
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      placeholder="Registration number"
                    />
                    <input
                      value={editForm.qualification}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, qualification: e.target.value }))
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      placeholder="Qualification"
                    />
                    <input
                      value={editForm.clinic_name}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, clinic_name: e.target.value }))
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      placeholder="Clinic name"
                    />
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      placeholder="Phone"
                    />
                    <input
                      value={editForm.email}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                      placeholder="Email"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg px-4 py-2 text-sm font-medium min-h-touch"
                    >
                      {saving ? 'Updating...' : 'Update Doctor'}
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
