import{useEffect,useState,useCallback}from"react"
import{Plus,Search,Pill,Edit,Trash2,ChevronRight,X,Package,AlertTriangle,Thermometer}from"lucide-react"
import toast from"react-hot-toast"
import{medicineService}from"@/services/medicineService"
import{useAuthStore}from"@/store/authStore"
import{useDebounce}from"@/hooks/useDebounce"
import{formatDate,daysUntil,expiryBadgeClass}from"@/utils/date"
import{formatCurrency}from"@/utils/currency"
import{PageHeader}from"@/components/shared/PageHeader"
import{EmptyState}from"@/components/shared/EmptyState"
import{ConfirmDialog}from"@/components/shared/ConfirmDialog"
import{Spinner}from"@/components/shared/Spinner"
import type{IMedicine,IBatch}from"@/types"

const SCHEDULES=["OTC","H","H1","X","Narcotic"] as const
const SCHEDULE_COLORS:{[k:string]:string}={OTC:"badge-green",H:"badge-amber",H1:"badge-amber",X:"badge-red",Narcotic:"badge-red"}

export default function MedicinePage(){
  const{user}=useAuthStore()
  const uid=user?.id??1
  const[medicines,setMedicines]=useState<IMedicine[]>([])
  const[categories,setCategories]=useState<{id:number;name:string}[]>([])
  const[loading,setLoading]=useState(true)
  const[search,setSearch]=useState("")
  const[selectedMed,setSelectedMed]=useState<IMedicine|null>(null)
  const[batches,setBatches]=useState<IBatch[]>([])
  const[showForm,setShowForm]=useState(false)
  const[editMed,setEditMed]=useState<IMedicine|null>(null)
  const[showBatchForm,setShowBatchForm]=useState(false)
  const[confirmDelete,setConfirmDelete]=useState<{id:number;name:string}|null>(null)
  const[deleting,setDeleting]=useState(false)
  const q=useDebounce(search,300)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const[meds,cats]=await Promise.all([medicineService.search(q),medicineService.listCategories()])
      setMedicines(meds as IMedicine[])
      setCategories(cats as {id:number;name:string}[])
    }catch{toast.error("Could not load medicines.")}
    finally{setLoading(false)}
  },[q])

  useEffect(()=>{load()},[load])

  const selectMed=async(med:IMedicine)=>{
    setSelectedMed(med)
    try{setBatches(await medicineService.listBatches(med.id))}catch{setBatches([])}
  }

  const handleDelete=async()=>{
    if(!confirmDelete)return
    setDeleting(true)
    try{await medicineService.delete(confirmDelete.id,uid);toast.success("Medicine deleted.");setConfirmDelete(null);if(selectedMed?.id===confirmDelete.id)setSelectedMed(null);load()}
    catch(e:unknown){toast.error(e instanceof Error?e.message:"Could not delete.")}
    finally{setDeleting(false)}
  }

  return(
    <div className="flex h-full -m-5 overflow-hidden">
      {/* List panel */}
      <div className="flex flex-col w-[420px] flex-shrink-0 border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-slate-900">Medicines</h1>
            <button onClick={()=>{setEditMed(null);setShowForm(true)}} className="btn-primary text-xs px-3 py-2">
              <Plus size={14}/>Add
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or generic…" className="input pl-9 py-2 text-sm"/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading?(
            <div className="flex items-center justify-center h-32"><Spinner/></div>
          ):medicines.length===0?(
            <EmptyState icon={<Pill size={40}/>} title="No medicines found" subtitle={q?"Try a different search term.":"Add your first medicine to get started."} action={<button onClick={()=>{setEditMed(null);setShowForm(true)}} className="btn-primary text-sm"><Plus size={15}/>Add Medicine</button>}/>
          ):(
            <div className="divide-y divide-slate-100">
              {medicines.map(m=>(
                <button key={m.id} onClick={()=>selectMed(m)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selectedMed?.id===m.id?"bg-blue-50 border-r-2 border-blue-600":""}`}>
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Pill size={16} className="text-blue-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                      <span className={SCHEDULE_COLORS[m.schedule]??"badge-slate"}>{m.schedule}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{m.generic_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${(m.total_stock??0)<=0?"text-red-600":(m.total_stock??0)<=m.reorder_level?"text-amber-600":"text-slate-700"}`}>{m.total_stock??0}</p>
                    <p className="text-[10px] text-slate-400">in stock</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0"/>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {!selectedMed?(
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Pill size={48} className="text-slate-200 mb-3"/>
            <p className="font-medium">Select a medicine</p>
            <p className="text-sm mt-1">Click any medicine on the left to view details</p>
          </div>
        ):(
          <div className="max-w-2xl space-y-4 animate-fade-in">
            {/* Header */}
            <div className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-slate-900">{selectedMed.name}</h2>
                    <span className={SCHEDULE_COLORS[selectedMed.schedule]??"badge-slate"}>{selectedMed.schedule}</span>
                    {selectedMed.is_cold_chain&&<span className="badge-blue flex items-center gap-1"><Thermometer size={10}/>Cold Chain</span>}
                  </div>
                  <p className="text-slate-500 text-sm">{selectedMed.generic_name}</p>
                  {selectedMed.composition&&<p className="text-slate-400 text-xs mt-1">{selectedMed.composition}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>{setEditMed(selectedMed);setShowForm(true)}} className="btn-ghost text-xs"><Edit size={14}/>Edit</button>
                  <button onClick={()=>setConfirmDelete({id:selectedMed.id,name:selectedMed.name})} className="btn-ghost text-xs text-red-500 hover:bg-red-50"><Trash2 size={14}/>Delete</button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                {[
                  {label:"Category",value:selectedMed.category_name||"—"},
                  {label:"GST Rate",value:`${selectedMed.default_gst_rate}%`},
                  {label:"HSN Code",value:selectedMed.hsn_code||"—"},
                  {label:"Drug Form",value:selectedMed.drug_form||"—"},
                  {label:"Strength",value:selectedMed.strength||"—"},
                  {label:"Pack Size",value:selectedMed.pack_size||"—"},
                ].map(f=>(
                  <div key={f.label}>
                    <p className="text-xs text-slate-500">{f.label}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>

              {selectedMed.notes&&<p className="mt-3 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{selectedMed.notes}</p>}
            </div>

            {/* Stock alert */}
            {(selectedMed.total_stock??0)<=selectedMed.reorder_level&&(
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0"/>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Low Stock Alert</p>
                  <p className="text-xs text-amber-700">Current stock ({selectedMed.total_stock??0}) is at or below reorder level ({selectedMed.reorder_level})</p>
                </div>
              </div>
            )}

            {/* Batches */}
            <div className="card">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-slate-500"/>
                  <h3 className="font-semibold text-slate-800">Batches ({batches.length})</h3>
                </div>
                <button onClick={()=>setShowBatchForm(true)} className="btn-secondary text-xs py-1.5"><Plus size={13}/>Add Batch</button>
              </div>
              {batches.length===0?(
                <div className="py-10 text-center text-slate-400">
                  <Package size={32} className="mx-auto text-slate-200 mb-2"/>
                  <p className="text-sm">No batches. Add a batch to track stock.</p>
                </div>
              ):(
                <div className="divide-y divide-slate-100">
                  {batches.map(b=>{
                    const days=daysUntil(b.expiry_date)
                    return(
                      <div key={b.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800">{b.batch_number}</p>
                            <span className={expiryBadgeClass(b.expiry_date)}>{days<0?"Expired":`${days}d`}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">Expires: {formatDate(b.expiry_date)}{b.rack_location&&<span className="ml-2 text-slate-400">Rack: {b.rack_location}</span>}</p>
                          {b.barcode&&<p className="text-[10px] text-slate-400 font-mono mt-0.5">{b.barcode}</p>}
                        </div>
                        <div className="text-center px-3">
                          <p className={`text-lg font-bold ${b.quantity_on_hand<=0?"text-red-500":"text-slate-900"}`}>{b.quantity_on_hand}</p>
                          <p className="text-[10px] text-slate-400">in stock</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-700">{formatCurrency(b.selling_price)}</p>
                          <p className="text-xs text-slate-400">Cost: {formatCurrency(b.purchase_price)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Medicine Form */}
      {showForm&&<MedicineForm med={editMed} categories={categories} uid={uid} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load();if(editMed&&selectedMed?.id===editMed.id){medicineService.get(editMed.id).then(m=>setSelectedMed(m as IMedicine)).catch(()=>{})}}}/>}

      {/* Add Batch Form */}
      {showBatchForm&&selectedMed&&<BatchForm medId={selectedMed.id} uid={uid} onClose={()=>setShowBatchForm(false)} onSaved={async()=>{setShowBatchForm(false);const bs=await medicineService.listBatches(selectedMed.id);setBatches(bs);load()}}/>}

      <ConfirmDialog open={!!confirmDelete} title="Delete Medicine?" message={`Delete "${confirmDelete?.name}"? This cannot be undone.`} loading={deleting} onConfirm={handleDelete} onCancel={()=>setConfirmDelete(null)}/>
    </div>
  )
}

// ── Medicine Form ─────────────────────────────────────────────
function MedicineForm({med,categories,uid,onClose,onSaved}:{med:IMedicine|null;categories:{id:number;name:string}[];uid:number;onClose:()=>void;onSaved:()=>void}){
  const[form,setForm]=useState({
    name:med?.name??"",generic_name:med?.generic_name??"",composition:med?.composition??"",
    hsn_code:med?.hsn_code??"",schedule:med?.schedule??"OTC",drug_form:med?.drug_form??"",
    strength:med?.strength??"",pack_size:med?.pack_size??"",
    default_gst_rate:String(med?.default_gst_rate??12),
    reorder_level:String(med?.reorder_level??10),reorder_quantity:String(med?.reorder_quantity??50),
    category_id:String(med?.category_id??""),is_cold_chain:med?.is_cold_chain??false,notes:med?.notes??""
  })
  const[saving,setSaving]=useState(false)
  const[errors,setErrors]=useState<Record<string,string>>({})
  const f=(k:string)=>(v:string)=>setForm(p=>({...p,[k]:v}))

  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault()
    const errs:Record<string,string>={}
    if(!form.name.trim())errs.name="Required"
    if(!form.generic_name.trim())errs.generic_name="Required"
    if(Object.keys(errs).length){setErrors(errs);return}
    setSaving(true)
    try{
      const data={...form,default_gst_rate:parseFloat(form.default_gst_rate)||12,reorder_level:parseInt(form.reorder_level)||10,reorder_quantity:parseInt(form.reorder_quantity)||50,category_id:form.category_id?parseInt(form.category_id):undefined}
      if(med)await medicineService.update(med.id,data,uid)
      else await medicineService.create(data,uid)
      toast.success(med?"Medicine updated.":"Medicine added.")
      onSaved()
    }catch(e:unknown){toast.error(e instanceof Error?e.message:"Could not save.")}
    finally{setSaving(false)}
  }

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-slate-900">{med?"Edit Medicine":"Add New Medicine"}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Medicine Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e=>f("name")(e.target.value)} placeholder="e.g. Paracetamol 500mg" className={`input ${errors.name?"border-red-400 focus:ring-red-500":""}`}/>
              {errors.name&&<p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Generic Name <span className="text-red-500">*</span></label>
              <input value={form.generic_name} onChange={e=>f("generic_name")(e.target.value)} placeholder="e.g. Paracetamol" className={`input ${errors.generic_name?"border-red-400":""}`}/>
              {errors.generic_name&&<p className="text-red-500 text-xs mt-1">{errors.generic_name}</p>}
            </div>
          </div>

          <div>
            <label className="label">Composition</label>
            <input value={form.composition} onChange={e=>f("composition")(e.target.value)} placeholder="e.g. Paracetamol IP 500mg" className="input"/>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Schedule</label>
              <select value={form.schedule} onChange={e=>f("schedule")(e.target.value)} className="input">
                {SCHEDULES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select value={form.category_id} onChange={e=>f("category_id")(e.target.value)} className="input">
                <option value="">None</option>
                {categories.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">GST Rate (%)</label>
              <select value={form.default_gst_rate} onChange={e=>f("default_gst_rate")(e.target.value)} className="input">
                {["0","5","12","18","28"].map(r=><option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="label">Drug Form</label>
              <input value={form.drug_form} onChange={e=>f("drug_form")(e.target.value)} placeholder="Tablet, Syrup…" className="input"/>
            </div>
            <div>
              <label className="label">Strength</label>
              <input value={form.strength} onChange={e=>f("strength")(e.target.value)} placeholder="500mg" className="input"/>
            </div>
            <div>
              <label className="label">Pack Size</label>
              <input value={form.pack_size} onChange={e=>f("pack_size")(e.target.value)} placeholder="10 tabs" className="input"/>
            </div>
            <div>
              <label className="label">HSN Code</label>
              <input value={form.hsn_code} onChange={e=>f("hsn_code")(e.target.value)} placeholder="30049099" className="input"/>
            </div>
            <div>
              <label className="label">Reorder Level</label>
              <input type="number" min="0" value={form.reorder_level} onChange={e=>f("reorder_level")(e.target.value)} className="input"/>
            </div>
            <div>
              <label className="label">Reorder Qty</label>
              <input type="number" min="1" value={form.reorder_quantity} onChange={e=>f("reorder_quantity")(e.target.value)} className="input"/>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e=>f("notes")(e.target.value)} rows={2} placeholder="Any special instructions…" className="input resize-none"/>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="cold-chain" checked={form.is_cold_chain} onChange={e=>setForm(p=>({...p,is_cold_chain:e.target.checked}))} className="w-4 h-4 accent-blue-600"/>
            <label htmlFor="cold-chain" className="text-sm text-slate-700">Requires cold chain storage (2–8°C)</label>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving?<><Spinner size="sm"/>{med?"Updating…":"Adding…"}</>:med?"Update Medicine":"Add Medicine"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Batch Form ────────────────────────────────────────────────
function BatchForm({medId,uid,onClose,onSaved}:{medId:number;uid:number;onClose:()=>void;onSaved:()=>void}){
  const[form,setForm]=useState({batch_number:"",expiry_date:"",purchase_price:"",selling_price:"",quantity_in:"",rack_location:""})
  const[saving,setSaving]=useState(false)
  const f=(k:string)=>(v:string)=>setForm(p=>({...p,[k]:v}))

  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(!form.batch_number||!form.expiry_date||!form.selling_price||!form.quantity_in){toast.error("Please fill all required fields.");return}
    setSaving(true)
    try{
      await medicineService.createBatch({medicine_id:medId,batch_number:form.batch_number,expiry_date:form.expiry_date,purchase_price:parseFloat(form.purchase_price)||0,selling_price:parseFloat(form.selling_price),quantity_in:parseInt(form.quantity_in),rack_location:form.rack_location||undefined},uid)
      toast.success("Batch added.")
      onSaved()
    }catch(e:unknown){toast.error(e instanceof Error?e.message:"Could not save batch.")}
    finally{setSaving(false)}
  }

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Add Batch</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Batch Number <span className="text-red-500">*</span></label>
              <input value={form.batch_number} onChange={e=>f("batch_number")(e.target.value)} placeholder="e.g. ABT2025" className="input" autoFocus/>
            </div>
            <div className="col-span-2">
              <label className="label">Expiry Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.expiry_date} onChange={e=>f("expiry_date")(e.target.value)} className="input"/>
            </div>
            <div>
              <label className="label">Purchase Price (₹)</label>
              <input type="number" min="0" step="0.01" value={form.purchase_price} onChange={e=>f("purchase_price")(e.target.value)} placeholder="0.00" className="input"/>
            </div>
            <div>
              <label className="label">Selling Price (₹) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" value={form.selling_price} onChange={e=>f("selling_price")(e.target.value)} placeholder="0.00" className="input"/>
            </div>
            <div>
              <label className="label">Quantity <span className="text-red-500">*</span></label>
              <input type="number" min="1" value={form.quantity_in} onChange={e=>f("quantity_in")(e.target.value)} placeholder="100" className="input"/>
            </div>
            <div>
              <label className="label">Rack Location</label>
              <input value={form.rack_location} onChange={e=>f("rack_location")(e.target.value)} placeholder="A-1-2" className="input"/>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving?<><Spinner size="sm"/>Adding…</>:"Add Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
