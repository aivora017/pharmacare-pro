import { useEffect, useState, useCallback } from "react"
import { Plus, Stethoscope, Edit, X } from "lucide-react"
import toast from "react-hot-toast"
import { customerService } from "@/services/customerService"
import { useAuthStore } from "@/store/authStore"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Spinner } from "@/components/shared/Spinner"
import type { IDoctor } from "@/types"

export default function DoctorsPage() {
  const { user } = useAuthStore()
  const uid = user?.id ?? 1
  const [doctors, setDoctors] = useState<IDoctor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editDoc, setEditDoc] = useState<IDoctor | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setDoctors(await customerService.listDoctors() as IDoctor[]) }
    catch { toast.error("Could not load doctors.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <PageHeader title="Doctors" subtitle="Manage prescribing doctors for Schedule H/X medicines"
        actions={<button onClick={()=>{setEditDoc(null);setShowForm(true)}} className="btn-primary text-sm"><Plus size={15}/>Add Doctor</button>}/>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner/></div>
        : doctors.length === 0 ? <EmptyState icon={<Stethoscope size={40}/>} title="No doctors added" subtitle="Add doctors to link with prescriptions."
            action={<button onClick={()=>{setEditDoc(null);setShowForm(true)}} className="btn-primary text-sm"><Plus size={15}/>Add Doctor</button>}/>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Reg. No</th>
                <th className="text-left px-4 py-3">Specialisation</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="w-16 px-4 py-3"/>
              </tr></thead>
              <tbody>
                {doctors.map(d=>(
                  <tr key={d.id} className="table-row">
                    <td className="px-4 py-3 font-semibold text-slate-800">Dr. {d.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.registration_no??'—'}</td>
                    <td className="px-4 py-3 text-slate-600">{d.specialisation??'—'}</td>
                    <td className="px-4 py-3 text-slate-600">{d.phone??'—'}</td>
                    <td className="px-4 py-3 text-center"><span className={d.is_active?"badge-green":"badge-slate"}>{d.is_active?"Active":"Inactive"}</span></td>
                    <td className="px-4 py-3"><button onClick={()=>{setEditDoc(d);setShowForm(true)}} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Edit size={13}/>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <DoctorForm doc={editDoc} uid={uid} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load()}}/>}
    </div>
  )
}

function DoctorForm({ doc, uid, onClose, onSaved }: { doc: IDoctor|null; uid: number; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ name:doc?.name??"", registration_no:doc?.registration_no??"", specialisation:doc?.specialisation??"", phone:doc?.phone??"", is_active:doc?.is_active??true })
  const [saving, setSaving] = useState(false)
  const f=(k:string)=>(v:string|boolean)=>setForm(p=>({...p,[k]:v}))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Name required."); return }
    setSaving(true)
    try {
      if (doc) await customerService.updateDoctor(doc.id, form, uid)
      else await customerService.createDoctor(form, uid)
      toast.success(doc?"Doctor updated.":"Doctor added.")
      onSaved()
    } catch (e: unknown) { toast.error(e instanceof Error?e.message:"Could not save.") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold">{doc?"Edit Doctor":"Add Doctor"}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="label">Full Name <span className="text-red-500">*</span></label><input value={form.name} onChange={e=>f("name")(e.target.value)} placeholder="e.g. Mehta" className="input" autoFocus/></div>
          <div><label className="label">Registration No.</label><input value={form.registration_no} onChange={e=>f("registration_no")(e.target.value)} placeholder="MCI-12345" className="input font-mono"/></div>
          <div><label className="label">Specialisation</label><input value={form.specialisation} onChange={e=>f("specialisation")(e.target.value)} placeholder="General Physician" className="input"/></div>
          <div><label className="label">Phone</label><input value={form.phone} onChange={e=>f("phone")(e.target.value)} className="input"/></div>
          {doc && <div className="flex items-center gap-3"><input type="checkbox" id="active" checked={form.is_active} onChange={e=>f("is_active")(e.target.checked)} className="w-4 h-4 accent-blue-600"/><label htmlFor="active" className="text-sm">Active</label></div>}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving?<><Spinner size="sm"/>{doc?"Updating…":"Adding…"}</>:doc?"Update":"Add Doctor"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
