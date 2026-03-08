import { FormEvent, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  type IBatchItem,
  medicineService,
  type ICategoryItem,
  type IMedicineDetailItem,
  type IMedicineListItem,
} from '@/services/medicineService'
import { useAuthStore } from '@/store/authStore'

const SCHEDULES = ['OTC', 'H', 'H1', 'X', 'Narcotic'] as const
const RACK_LOCATION_REGEX = /^[A-Za-z]-\d+-\d+$/
const DAY_MS = 24 * 60 * 60 * 1000

function getExpiryMeta(expiryDate: string): { label: string; className: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

  if (Number.isNaN(expiry.getTime())) {
    return {
      label: 'Unknown',
      className: 'bg-slate-100 text-slate-700',
    }
  }

  const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / DAY_MS)
  if (daysLeft < 0) {
    return { label: 'Expired', className: 'bg-red-100 text-red-700' }
  }
  if (daysLeft <= 30) {
    return { label: `${daysLeft}d left`, className: 'bg-orange-100 text-orange-700' }
  }
  if (daysLeft <= 90) {
    return { label: `${daysLeft}d left`, className: 'bg-amber-100 text-amber-700' }
  }
  return { label: `${daysLeft}d left`, className: 'bg-emerald-100 text-emerald-700' }
}

export default function MedicinePage() {
  const user = useAuthStore((state) => state.user)

  const [items, setItems] = useState<IMedicineListItem[]>([])
  const [categories, setCategories] = useState<ICategoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState<'name_asc' | 'name_desc'>('name_asc')

  const [name, setName] = useState('')
  const [genericName, setGenericName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState<number | undefined>(undefined)
  const [schedule, setSchedule] = useState<(typeof SCHEDULES)[number]>('OTC')
  const [gstRate, setGstRate] = useState(12)
  const [reorderLevel, setReorderLevel] = useState(10)
  const [reorderQty, setReorderQty] = useState(50)
  const [creating, setCreating] = useState(false)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<IMedicineDetailItem | null>(null)
  const [batches, setBatches] = useState<IBatchItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [creatingBatch, setCreatingBatch] = useState(false)

  const [editName, setEditName] = useState('')
  const [editGenericName, setEditGenericName] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<number | undefined>(undefined)
  const [editSchedule, setEditSchedule] = useState<(typeof SCHEDULES)[number]>('OTC')
  const [editGstRate, setEditGstRate] = useState(12)
  const [editReorderLevel, setEditReorderLevel] = useState(10)
  const [editReorderQty, setEditReorderQty] = useState(50)

  const [batchNumber, setBatchNumber] = useState('')
  const [batchExpiry, setBatchExpiry] = useState('')
  const [batchPurchasePrice, setBatchPurchasePrice] = useState(0)
  const [batchSellingPrice, setBatchSellingPrice] = useState(0)
  const [batchQuantity, setBatchQuantity] = useState(1)
  const [batchRack, setBatchRack] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [medicineRows, categoryRows] = await Promise.all([
        medicineService.search({
          query,
          category_id: categoryId,
          in_stock_only: inStockOnly,
          sort,
        }),
        medicineService.listCategories(),
      ])
      setItems(medicineRows)
      setCategories(categoryRows)
    } catch {
      toast.error('Could not load medicines.')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: number) => {
    setDetailLoading(true)
    try {
      const [medicine, batchRows] = await Promise.all([
        medicineService.get(id),
        medicineService.listBatches(id),
      ])
      setSelected(medicine)
      setBatches(batchRows)

      setEditName(medicine.name)
      setEditGenericName(medicine.generic_name)
      setEditCategoryId(medicine.category_id)
      setEditSchedule(medicine.schedule as (typeof SCHEDULES)[number])
      setEditGstRate(medicine.default_gst_rate)
      setEditReorderLevel(medicine.reorder_level)
      setEditReorderQty(medicine.reorder_quantity)
    } catch {
      toast.error('Could not load medicine details.')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [query, categoryId, inStockOnly, sort])

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId)
    }
  }, [selectedId])

  const lowStockCount = useMemo(
    () => items.filter((m) => m.total_stock <= m.reorder_level).length,
    [items]
  )

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!name.trim() || !genericName.trim()) {
      toast.error('Medicine name and generic name are required.')
      return
    }

    setCreating(true)
    try {
      await medicineService.create({
        name: name.trim(),
        generic_name: genericName.trim(),
        category_id: formCategoryId,
        schedule,
        default_gst_rate: gstRate,
        reorder_level: reorderLevel,
        reorder_quantity: reorderQty,
        created_by: user.id,
      })

      setName('')
      setGenericName('')
      setFormCategoryId(undefined)
      setSchedule('OTC')
      setGstRate(12)
      setReorderLevel(10)
      setReorderQty(50)
      toast.success('Medicine added.')
      void load()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not create medicine.')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !selectedId) {
      return
    }

    if (batchRack.trim() && !RACK_LOCATION_REGEX.test(batchRack.trim())) {
      toast.error('Rack location must be in A-1-1 format.')
      return
    }

    setSavingDetail(true)
    try {
      await medicineService.update(selectedId, {
        name: editName.trim(),
        generic_name: editGenericName.trim(),
        category_id: editCategoryId,
        schedule: editSchedule,
        default_gst_rate: editGstRate,
        reorder_level: editReorderLevel,
        reorder_quantity: editReorderQty,
        updated_by: user.id,
      })
      toast.success('Medicine updated.')
      await Promise.all([load(), loadDetail(selectedId)])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not update medicine.')
    } finally {
      setSavingDetail(false)
    }
  }

  const handleCreateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !selectedId) {
      return
    }

    setCreatingBatch(true)
    try {
      await medicineService.createBatch({
        medicine_id: selectedId,
        batch_number: batchNumber.trim(),
        expiry_date: batchExpiry,
        purchase_price: batchPurchasePrice,
        selling_price: batchSellingPrice,
        quantity_in: batchQuantity,
        rack_location: batchRack.trim() || undefined,
        created_by: user.id,
      })

      setBatchNumber('')
      setBatchExpiry('')
      setBatchPurchasePrice(0)
      setBatchSellingPrice(0)
      setBatchQuantity(1)
      setBatchRack('')

      toast.success('Batch added.')
      await Promise.all([load(), loadDetail(selectedId)])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not create batch.')
    } finally {
      setCreatingBatch(false)
    }
  }

  return (
    <section className="p-4 md:p-6 space-y-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Medicine Master</h1>
        <p className="text-sm text-slate-600">
          Manage medicines with search, category filter, and stock indicators.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or generic"
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 md:col-span-2"
            />
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'name_asc' | 'name_desc')}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            In-stock only
          </label>

          <div className="text-xs text-slate-500">
            Total medicines: <strong>{items.length}</strong> | Low stock:{' '}
            <strong>{lowStockCount}</strong>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Generic</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Schedule</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">GST %</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={7}>
                      Loading medicines...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={7}>
                      No medicines found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const lowStock = item.total_stock <= item.reorder_level
                    return (
                      <tr
                        key={item.id}
                        className={`border-t border-slate-100 cursor-pointer ${selectedId === item.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                        <td className="px-3 py-2 text-slate-700">{item.generic_name}</td>
                        <td className="px-3 py-2 text-slate-700">{item.category_name ?? '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{item.schedule}</td>
                        <td className="px-3 py-2">
                          {item.total_stock === 0 ? (
                            <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">
                              Out of stock
                            </span>
                          ) : lowStock ? (
                            <span className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              Healthy
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={lowStock ? 'text-red-600 font-semibold' : 'text-slate-800'}
                          >
                            {item.total_stock}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-800">
                          {item.default_gst_rate}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
        >
          <h2 className="text-lg font-semibold text-slate-900">Add Medicine</h2>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Medicine name"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
          />

          <input
            value={genericName}
            onChange={(e) => setGenericName(e.target.value)}
            placeholder="Generic name"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={formCategoryId ?? ''}
            onChange={(e) => setFormCategoryId(e.target.value ? Number(e.target.value) : undefined)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Category (optional)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value as (typeof SCHEDULES)[number])}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
          >
            {SCHEDULES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              max={28}
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))}
              placeholder="GST %"
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
            />
            <input
              type="number"
              min={0}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(Number(e.target.value))}
              placeholder="Reorder level"
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <input
            type="number"
            min={1}
            value={reorderQty}
            onChange={(e) => setReorderQty(Number(e.target.value))}
            placeholder="Reorder quantity"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={creating}
            className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? 'Saving...' : 'Save Medicine'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Medicine Detail</h2>

        {!selectedId ? (
          <p className="text-sm text-slate-500">
            Select a medicine row to edit and manage batches.
          </p>
        ) : detailLoading || !selected ? (
          <p className="text-sm text-slate-500">Loading detail...</p>
        ) : (
          <>
            <form onSubmit={handleUpdate} className="space-y-2">
              <div className="text-xs text-slate-500">Editing #{selected.id}</div>

              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Medicine name"
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              />

              <input
                value={editGenericName}
                onChange={(e) => setEditGenericName(e.target.value)}
                placeholder="Generic name"
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              />

              <select
                value={editCategoryId ?? ''}
                onChange={(e) =>
                  setEditCategoryId(e.target.value ? Number(e.target.value) : undefined)
                }
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Category (optional)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editSchedule}
                  onChange={(e) => setEditSchedule(e.target.value as (typeof SCHEDULES)[number])}
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                >
                  {SCHEDULES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={editGstRate}
                  onChange={(e) => setEditGstRate(Number(e.target.value))}
                  placeholder="GST %"
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={editReorderLevel}
                  onChange={(e) => setEditReorderLevel(Number(e.target.value))}
                  placeholder="Reorder level"
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  min={1}
                  value={editReorderQty}
                  onChange={(e) => setEditReorderQty(Number(e.target.value))}
                  placeholder="Reorder quantity"
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingDetail}
                className="h-11 w-full rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
              >
                {savingDetail ? 'Updating...' : 'Update Medicine'}
              </button>
            </form>

            <div className="border-t border-slate-200 pt-3">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Add Batch</h3>
              <form onSubmit={handleCreateBatch} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="Batch no"
                    className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    type="date"
                    value={batchExpiry}
                    onChange={(e) => setBatchExpiry(e.target.value)}
                    className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={batchPurchasePrice}
                    onChange={(e) => setBatchPurchasePrice(Number(e.target.value))}
                    placeholder="Cost"
                    className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={batchSellingPrice}
                    onChange={(e) => setBatchSellingPrice(Number(e.target.value))}
                    placeholder="MRP"
                    className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    min={1}
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(Number(e.target.value))}
                    placeholder="Qty"
                    className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <input
                  value={batchRack}
                  onChange={(e) => setBatchRack(e.target.value)}
                  placeholder="Rack location (optional)"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                />

                <button
                  type="submit"
                  disabled={creatingBatch}
                  className="h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {creatingBatch ? 'Adding batch...' : 'Save Batch'}
                </button>
              </form>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left">Batch</th>
                      <th className="px-2 py-1 text-left">Expiry</th>
                      <th className="px-2 py-1 text-left">Risk</th>
                      <th className="px-2 py-1 text-right">Stock</th>
                      <th className="px-2 py-1 text-left">Rack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.length === 0 ? (
                      <tr>
                        <td className="px-2 py-2 text-slate-500" colSpan={5}>
                          No active batches.
                        </td>
                      </tr>
                    ) : (
                      batches.map((batch) => {
                        const expiryMeta = getExpiryMeta(batch.expiry_date)
                        return (
                          <tr key={batch.id} className="border-t border-slate-100">
                            <td className="px-2 py-1">{batch.batch_number}</td>
                            <td className="px-2 py-1">{batch.expiry_date}</td>
                            <td className="px-2 py-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${expiryMeta.className}`}
                              >
                                {expiryMeta.label}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-right">{batch.quantity_on_hand}</td>
                            <td className="px-2 py-1">{batch.rack_location ?? '-'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
