import{useState,useEffect,useRef,useCallback}from"react"
import{ShoppingCart,Search,User,PauseCircle,X,CheckCircle,AlertTriangle,Banknote,CreditCard,Smartphone}from"lucide-react"
import toast from"react-hot-toast"
import{useCartStore}from"@/store/cartStore"
import{useAuthStore}from"@/store/authStore"
import{billingService}from"@/services/billingService"
import{medicineService}from"@/services/medicineService"
import{customerService}from"@/services/customerService"
import{schemeService,Scheme}from"@/services/schemeService"
import{formatCurrency}from"@/utils/currency"
import{isNearExpiry,formatDate}from"@/utils/date"
import{useKeyboard}from"@/hooks/useKeyboard"
import{useDebounce}from"@/hooks/useDebounce"
import{Spinner}from"@/components/shared/Spinner"
import{calcItemGST}from"@/utils/gst"
import type{IMedicine,IBatch,ICustomer,ICartItem,PaymentMode}from"@/types"

export default function BillingPage(){
  const searchRef=useRef<HTMLInputElement>(null)
  const{user}=useAuthStore()
  const uid=user?.id??1
  const{items,customer,totals,addItem,removeItem,updateQty,updateDiscount,setCustomer,clear}=useCartStore()
  const[searchQ,setSearchQ]=useState("")
  const[searchResults,setSearchResults]=useState<IMedicine[]>([])
  const[searching,setSearching]=useState(false)
  const[showResults,setShowResults]=useState(false)
  const[showPayment,setShowPayment]=useState(false)
  const[interactions,setInteractions]=useState<{drug1:string;drug2:string;severity:string;description:string;management:string}[]>([])

  const checkInteractions=async(cartItems:typeof items)=>{
    if(cartItems.length<2)return
    try{
      const names=cartItems.map(i=>i.medicine_name)
      const res=await invoke<{interactions:typeof interactions}>("network_check_interactions",{medicineNames:names})
      if(res.interactions.length>0){setInteractions(res.interactions)}
    }catch{}
  }
  const[showCustomer,setShowCustomer]=useState(false)
  const[saving,setSaving]=useState(false)
  const[loyaltyRedeem,setLoyaltyRedeem]=useState(0)
  const[applicableSchemes,setApplicableSchemes]=useState<Scheme[]>([])
  const[selectedScheme,setSelectedScheme]=useState<Scheme|null>(null)
  const schemeDiscount=selectedScheme
    ?(selectedScheme.scheme_type==="percent"?Math.round(totals.net_amount*selectedScheme.value/100)
    :selectedScheme.scheme_type==="flat"?selectedScheme.value:0):0
  const debouncedQ=useDebounce(searchQ,200)

  useEffect(()=>{searchRef.current?.focus()},[])
  useKeyboard("F7",()=>{if(items.length>0)setShowPayment(true)})
  useKeyboard("F4",async()=>{if(items.length===0)return;await billingService.holdBill({label:`Held ${new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`,items,created_by:uid});clear();toast.success("Bill held. Press F5 to recall.")})

  // Fetch applicable schemes when cart total changes
  useEffect(()=>{
    if(items.length===0){setApplicableSchemes([]);setSelectedScheme(null);return}
    schemeService.getApplicable(totals.net_amount)
      .then(r=>{setApplicableSchemes((r as any).schemes??[])})
      .catch(()=>{})
  },[items.length,totals.net_amount])

  // Search medicines
  useEffect(()=>{
    if(debouncedQ.length<2){setSearchResults([]);setShowResults(false);return}
    setSearching(true)
    medicineService.search(debouncedQ,true)
      .then(r=>{setSearchResults(r as IMedicine[]);setShowResults(true)})
      .catch(()=>{})
      .finally(()=>setSearching(false))
  },[debouncedQ])

  // Barcode scanner detection: very fast input (>6 chars arriving quickly)
  const lastKeyTime=useRef(0)
  const keyBuffer=useRef("")
  useEffect(()=>{
    const handleKey=(e:KeyboardEvent)=>{
      if(document.activeElement!==searchRef.current)return
      const now=Date.now()
      if(now-lastKeyTime.current<80){keyBuffer.current+=e.key}
      else{keyBuffer.current=e.key}
      lastKeyTime.current=now
      if(e.key==="Enter"&&keyBuffer.current.length>5){
        const barcode=keyBuffer.current.replace("Enter","")
        keyBuffer.current=""
        e.preventDefault()
        handleBarcodeInput(barcode)
      }
    }
    window.addEventListener("keydown",handleKey)
    return()=>window.removeEventListener("keydown",handleKey)
  },[])

  const handleBarcodeInput=useCallback(async(barcode:string)=>{
    setSearchQ("")
    setShowResults(false)
    try{
      const batch=await medicineService.getByBarcode(barcode) as IBatch&{medicine_name:string;generic_name:string;schedule:string;gst_rate:number}
      if(batch.quantity_on_hand<=0){toast.error(`${batch.medicine_name} — out of stock`);return}
      const cartItem:ICartItem=calcItemGST({medicine_id:batch.medicine_id,batch_id:batch.id,medicine_name:batch.medicine_name,batch_number:batch.batch_number,expiry_date:batch.expiry_date,quantity:1,unit_price:batch.selling_price,mrp:batch.selling_price,discount_percent:0,discount_amount:0,gst_rate:batch.gst_rate,cgst_amount:0,sgst_amount:0,igst_amount:0,total_amount:0,is_near_expiry:isNearExpiry(batch.expiry_date),is_schedule_h:["H","H1","X","Narcotic"].includes(batch.schedule)})
      addItem(cartItem)
      if(cartItem.is_schedule_h)toast("Schedule "+batch.schedule+" medicine added — verify prescription.",{icon:"⚠️"})
      if(cartItem.is_near_expiry)toast("Near expiry batch. Check date.",{icon:"⚠️"})
    }catch{toast.error("Barcode not found.")}
  },[addItem])

  const handleMedSelect=useCallback(async(med:IMedicine)=>{
    setSearchQ("");setShowResults(false)
    try{
      const batches=await medicineService.listBatches(med.id) as IBatch[]
      const available=batches.filter(b=>b.quantity_on_hand>0&&!isNearExpiry(b.expiry_date,-1))
      const batch=available.sort((a,b)=>new Date(a.expiry_date).getTime()-new Date(b.expiry_date).getTime())[0]??batches[0]
      if(!batch){toast.error(`${med.name} — no stock available`);return}
      const cartItem:ICartItem=calcItemGST({medicine_id:med.id,batch_id:batch.id,medicine_name:med.name,batch_number:batch.batch_number,expiry_date:batch.expiry_date,quantity:1,unit_price:batch.selling_price,mrp:batch.selling_price,discount_percent:0,discount_amount:0,gst_rate:med.default_gst_rate,cgst_amount:0,sgst_amount:0,igst_amount:0,total_amount:0,is_near_expiry:isNearExpiry(batch.expiry_date),is_schedule_h:["H","H1","X","Narcotic"].includes(med.schedule)})
      addItem(cartItem)
      if(cartItem.is_schedule_h)toast(`Schedule ${med.schedule} — verify prescription`,{icon:"⚠️"})
    }catch{toast.error("Could not fetch stock details.")}
  },[addItem])

  const handleSaveBill=async(payments:{amount:number;payment_mode:PaymentMode;reference_no?:string}[])=>{
    setSaving(true)
    try{
      const id=await billingService.createBill({customer_id:customer?.id,items,payments,discount_amount:totals.bill_discount+schemeDiscount,created_by:uid,loyalty_points_redeemed:loyaltyRedeem>0?loyaltyRedeem:undefined})
      clear();setShowPayment(false);setLoyaltyRedeem(0);setSelectedScheme(null)
      toast.success("Bill saved successfully!")
      // Auto-print receipt
      try{
        await printerService.printBill(id)
        toast("Receipt sent to printer.",{icon:"🖨️",duration:2000})
      }catch{
        // Print failure is non-blocking — bill is already saved
        toast("Bill saved. Configure printer in Settings to print receipts.",{icon:"💡",duration:4000})
      }
    }catch(e:unknown){toast.error(e instanceof Error?e.message:"Could not save bill.")}
    finally{setSaving(false)}
  }

  return(
    <div className="flex h-full -m-5 overflow-hidden">
      {/* Cart */}
      <div className="flex flex-col flex-1 min-w-0 bg-white border-r border-slate-200">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-600"/>
            <h1 className="font-bold text-slate-900">New Bill</h1>
            {customer&&<span className="badge-blue text-xs">{customer.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowCustomer(true)} className="btn-ghost text-xs py-1.5"><User size={14}/>{customer?"Change":"Add Patient"}</button>
            {items.length>0&&<button onClick={async()=>{await billingService.holdBill({label:`Held Bill`,items,created_by:uid});clear();toast.success("Held! Press F4 again to recall.")}} className="btn-ghost text-xs py-1.5"><PauseCircle size={14}/>Hold<kbd className="ml-1 text-slate-400 font-mono text-[10px]">F4</kbd></button>}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0 relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            {searching&&<Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2"/>}
            <input
              ref={searchRef}
              value={searchQ}
              onChange={e=>setSearchQ(e.target.value)}
              onFocus={()=>searchResults.length>0&&setShowResults(true)}
              placeholder="Type medicine name or scan barcode to add…"
              className="input pl-9 text-sm border-blue-200 focus:border-blue-500 bg-blue-50 focus:bg-white"
              autoComplete="off"
            />
          </div>
          {/* Dropdown */}
          {showResults&&searchResults.length>0&&(
            <div className="absolute left-4 right-4 top-full z-30 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {searchResults.map(m=>(
                  <button key={m.id} onMouseDown={e=>{e.preventDefault();handleMedSelect(m)}} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{m.name}</span>
                        {["H","H1","X","Narcotic"].includes(m.schedule)&&<span className="badge-amber text-[10px]">{m.schedule}</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{m.generic_name}{m.category_name&&<span className="ml-2 text-slate-400">· {m.category_name}</span>}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${(m.total_stock??0)<=0?"text-red-500":"text-slate-800"}`}>{m.total_stock??0} {(m.total_stock??0)<=0?"(OOS)":"in stock"}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onMouseDown={()=>setShowResults(false)} className="w-full py-2 text-xs text-slate-400 hover:bg-slate-50 border-t border-slate-100">Close</button>
            </div>
          )}
        </div>

        {/* Drug interactions warning */}
        {interactions.length>0&&(
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-semibold text-xs">⚠ {interactions.length} drug interaction{interactions.length>1?"s":""} detected</span>
                {interactions.slice(0,2).map((i,n)=><span key={n} className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{i.severity}: {i.drug1} + {i.drug2}</span>)}
              </div>
              <button onClick={()=>setInteractions([])} className="text-xs text-red-400 hover:text-red-600">Dismiss</button>
            </div>
          </div>
        )}

        {/* Bill table */}
        <div className="flex-1 overflow-y-auto">
          {items.length===0?(
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
              <ShoppingCart size={48} className="text-slate-200 mb-3"/>
              <p className="font-medium">Bill is empty</p>
              <p className="text-sm mt-1">Search a medicine above or scan a barcode</p>
            </div>
          ):(
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">Medicine</th>
                  <th className="text-center px-2 py-2.5 w-28">Qty</th>
                  <th className="text-right px-2 py-2.5">Rate</th>
                  <th className="text-center px-2 py-2.5 w-20">Disc%</th>
                  <th className="text-right px-2 py-2.5">GST</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="w-8 px-2"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item,i)=>(
                  <tr key={i} className={`hover:bg-slate-50 ${item.is_near_expiry?"bg-amber-50/50":""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.medicine_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Batch: {item.batch_number} · Exp: {formatDate(item.expiry_date)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.is_schedule_h&&<span className="badge-amber text-[10px]">Rx Required</span>}
                        {item.is_near_expiry&&<span className="badge-amber text-[10px]">Near Expiry</span>}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={()=>updateQty(i,item.quantity-1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-base leading-none">−</button>
                        <input type="number" min={1} value={item.quantity} onChange={e=>updateQty(i,parseInt(e.target.value)||1)} className="w-12 text-center border border-slate-200 rounded text-sm py-0.5 outline-none focus:ring-1 focus:ring-blue-500"/>
                        <button onClick={()=>updateQty(i,item.quantity+1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-base leading-none">+</button>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-slate-700 font-medium">₹{item.unit_price.toFixed(2)}</td>
                    <td className="px-2 py-3">
                      <input type="number" min={0} max={100} value={item.discount_percent} onChange={e=>updateDiscount(i,parseFloat(e.target.value)||0)} className="w-16 text-center border border-slate-200 rounded text-sm py-0.5 outline-none focus:ring-1 focus:ring-blue-500 mx-auto block"/>
                    </td>
                    <td className="px-2 py-3 text-right text-xs text-slate-500">₹{(item.cgst_amount+item.sgst_amount+item.igst_amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{item.total_amount.toFixed(2)}</td>
                    <td className="px-2 py-3"><button onClick={()=>removeItem(i)} className="text-slate-300 hover:text-red-500 transition-colors"><X size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer totals */}
        {items.length>0&&(
          <div className="border-t border-slate-200 px-4 py-3 bg-white flex-shrink-0">
            <div className="flex items-end justify-between gap-4">
              <div className="text-sm text-slate-500 space-y-0.5">
                <p>Subtotal: ₹{totals.subtotal.toFixed(2)} · GST: ₹{totals.total_gst.toFixed(2)}</p>
                {totals.item_discount>0&&<p className="text-green-600">Disc: -₹{totals.item_discount.toFixed(2)}</p>}
                {totals.round_off!==0&&<p className="text-slate-400">Round off: ₹{totals.round_off.toFixed(2)}</p>}
                {customer&&(customer.loyalty_points??0)>0&&(
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-green-600 font-medium">{customer.loyalty_points} pts available</span>
                    <input
                      type="number" min={0} max={customer.loyalty_points??0}
                      value={loyaltyRedeem||""}
                      onChange={e=>{const v=Math.min(Number(e.target.value),customer.loyalty_points??0);setLoyaltyRedeem(v)}}
                      placeholder="Redeem pts"
                      className="w-24 border border-slate-200 rounded text-sm py-0.5 px-2 outline-none focus:ring-1 focus:ring-green-500"
                    />
                    {loyaltyRedeem>0&&<span className="text-green-600">-₹{loyaltyRedeem}</span>}
                  </div>
                )}
                {applicableSchemes.length>0&&(
                  <div className="pt-1">
                    <p className="text-xs text-slate-400 mb-1">Applicable Schemes:</p>
                    <div className="flex flex-wrap gap-1">
                      {applicableSchemes.map(s=>(
                        <button key={s.id}
                          onClick={()=>setSelectedScheme(selectedScheme?.id===s.id?null:s)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                            selectedScheme?.id===s.id
                              ?"bg-blue-600 text-white border-blue-600"
                              :"bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          }`}>
                          🏷 {s.name}{s.scheme_type==="percent"?` (${s.value}% off)`:s.scheme_type==="flat"?` (₹${s.value} off)`:` (Buy ${s.buy_quantity} Get ${s.get_quantity})`}
                        </button>
                      ))}
                    </div>
                    {selectedScheme&&schemeDiscount>0&&(
                      <p className="text-xs text-blue-600 font-semibold mt-1">Scheme discount: -₹{schemeDiscount}</p>
                    )}
                    {selectedScheme&&selectedScheme.scheme_type==="bxgy"&&(
                      <p className="text-xs text-blue-600 font-semibold mt-1">BxGy scheme applied — update quantities manually</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(totals.net_amount)}</p>
                </div>
                <button onClick={()=>setShowPayment(true)} className="h-14 px-7 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm">
                  <CheckCircle size={20}/>Collect Payment<kbd className="text-green-200 text-xs font-mono ml-1">F7</kbd>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment panel */}
      {showPayment&&<PaymentPanel netAmount={totals.net_amount} onConfirm={handleSaveBill} onClose={()=>setShowPayment(false)} saving={saving}/>}

      {/* Customer selector */}
      {showCustomer&&<CustomerSelector current={customer} onSelect={c=>{setCustomer(c);setShowCustomer(false)}} onClose={()=>setShowCustomer(false)}/>}
    </div>
  )
}

// ── Payment Panel ─────────────────────────────────────────────
function PaymentPanel({netAmount,onConfirm,onClose,saving}:{netAmount:number;onConfirm:(payments:{amount:number;payment_mode:PaymentMode;reference_no?:string}[])=>void;onClose:()=>void;saving:boolean}){
  const[mode,setMode]=useState<PaymentMode>("cash")
  const[cashEntered,setCashEntered]=useState("")
  const[upiRef,setUpiRef]=useState("")
  const[cardRef,setCardRef]=useState("")

  const change=mode==="cash"&&cashEntered?(parseFloat(cashEntered)||0)-netAmount:0
  const cashInputRef=useRef<HTMLInputElement>(null)
  useEffect(()=>{setTimeout(()=>cashInputRef.current?.focus(),100)},[])

  const handlePay=()=>{
    const payments:[{amount:number;payment_mode:PaymentMode;reference_no?:string}]=mode==="cash"
      ?[{amount:netAmount,payment_mode:"cash"}]
      :mode==="upi"?[{amount:netAmount,payment_mode:"upi",reference_no:upiRef||undefined}]
      :mode==="card"?[{amount:netAmount,payment_mode:"card",reference_no:cardRef||undefined}]
      :[{amount:netAmount,payment_mode:mode}]
    onConfirm(payments)
  }

  return(
    <div className="w-[340px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <h2 className="font-bold text-slate-900">Collect Payment</h2>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16}/></button>
      </div>

      <div className="p-5 flex-1 space-y-5">
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Amount to Collect</p>
          <p className="text-4xl font-bold text-slate-900">{formatCurrency(netAmount)}</p>
        </div>

        {/* Payment modes */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {([{id:"cash",label:"Cash",icon:Banknote},{id:"upi",label:"UPI / QR",icon:Smartphone},{id:"card",label:"Card",icon:CreditCard},{id:"credit",label:"Credit",icon:User}] as {id:PaymentMode;label:string;icon:React.ComponentType<{size:number}>}[]).map(m=>(
              <button key={m.id} onClick={()=>setMode(m.id)} className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-colors text-sm font-medium ${mode===m.id?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200 hover:border-slate-300 text-slate-600"}`}>
                <m.icon size={16}/>{m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode-specific inputs */}
        {mode==="cash"&&(
          <div>
            <label className="label">Cash Received (₹)</label>
            <input ref={cashInputRef} type="number" min={netAmount} value={cashEntered} onChange={e=>setCashEntered(e.target.value)} placeholder={netAmount.toFixed(2)} className="input text-lg font-semibold"/>
            {change>0&&(
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-sm text-green-700 font-medium">Change to return</span>
                <span className="text-lg font-bold text-green-700">{formatCurrency(change)}</span>
              </div>
            )}
          </div>
        )}
        {mode==="upi"&&(
          <div>
            <label className="label">UPI Transaction ID (optional)</label>
            <input value={upiRef} onChange={e=>setUpiRef(e.target.value)} placeholder="e.g. 123456789012" className="input"/>
            <div className="mt-3 bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-700 font-medium mb-1">Ask customer to scan your UPI QR</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(netAmount)}</p>
            </div>
          </div>
        )}
        {mode==="card"&&(
          <div>
            <label className="label">Card Approval Code (optional)</label>
            <input value={cardRef} onChange={e=>setCardRef(e.target.value)} placeholder="e.g. 123456" className="input"/>
          </div>
        )}
        {mode==="credit"&&(
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5"/>
              <p className="text-sm text-amber-800">Amount will be added to customer's outstanding balance. A customer must be selected.</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        <button onClick={handlePay} disabled={saving} className="btn-primary w-full justify-center py-3 text-base">
          {saving?<><Spinner size="sm"/>Saving…</>:<><CheckCircle size={18}/>Save Bill & Print Receipt</>}
        </button>
      </div>
    </div>
  )
}

// ── Customer Selector ─────────────────────────────────────────
function CustomerSelector({current,onSelect,onClose}:{current:Pick<ICustomer,"id"|"name"|"phone"|"outstanding_balance"|"loyalty_points">|null;onSelect:(c:Pick<ICustomer,"id"|"name"|"phone"|"outstanding_balance"|"loyalty_points">)=>void;onClose:()=>void}){
  const[q,setQ]=useState("")
  const[results,setResults]=useState<ICustomer[]>([])
  const[loading,setLoading]=useState(false)
  const dq=useDebounce(q,300)
  useEffect(()=>{
    if(dq.length<1){setResults([]);return}
    setLoading(true)
    customerService.search(dq).then(r=>setResults(r as ICustomer[])).catch(()=>{}).finally(()=>setLoading(false))
  },[dq])

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Select Patient</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18}/></button>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or phone…" className="input pl-9"/>
          </div>
          {loading&&<div className="flex justify-center py-4"><Spinner/></div>}
          {!loading&&results.length>0&&(
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              {results.map(c=>(
                <button key={c.id} onClick={()=>onSelect(c)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-left transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.phone??"No phone"}</p>
                  </div>
                  <div className="text-right">
                    {c.outstanding_balance>0&&<p className="text-xs text-red-600 font-medium">Due: ₹{c.outstanding_balance.toFixed(0)}</p>}
                    {c.loyalty_points>0&&<p className="text-xs text-green-600">{c.loyalty_points} pts</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {!loading&&q.length>=1&&results.length===0&&(
            <p className="text-center text-slate-400 text-sm py-6">No patients found. <button className="text-blue-600 font-medium hover:underline">Add new</button></p>
          )}
        </div>
      </div>
    </div>
  )
}
