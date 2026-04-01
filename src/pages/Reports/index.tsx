import { useState, useCallback } from "react"
import { BarChart3, ShoppingCart, Package, FileText, TrendingUp, ClipboardList, Download, RefreshCw } from "lucide-react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import toast from "react-hot-toast"
import { reportService } from "@/services/reportService"
import { invoke } from "@tauri-apps/api/core"
import { backupService } from "@/services/backupService"
import { formatCurrency, formatCompact } from "@/utils/currency"
import { formatDate } from "@/utils/date"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Spinner } from "@/components/shared/Spinner"

type Tab = "sales" | "purchase" | "stock" | "gst" | "pl" | "audit"

const TABS: { id: Tab; label: string; icon: React.ComponentType<{size:number}> }[] = [
  { id:"sales",    label:"Sales",          icon:TrendingUp    },
  { id:"purchase", label:"Purchase",       icon:ShoppingCart  },
  { id:"stock",    label:"Stock Value",    icon:Package       },
  { id:"gst",      label:"GST / Tax",      icon:FileText      },
  { id:"pl",       label:"Profit & Loss",  icon:BarChart3     },
  { id:"audit",    label:"Audit Log",      icon:ClipboardList },
]

const PIE_COLORS = ["#2563eb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2"]

function DateRange({ from, to, onFrom, onTo, onLoad, loading }: { from:string;to:string;onFrom:(v:string)=>void;onTo:(v:string)=>void;onLoad:()=>void;loading:boolean }) {
  const exportCsv = async () => {
    try {
      const path = await invoke<string>("reports_export_csv", { reportType: "sales", fromDate: from, toDate: to })
      toast.success("CSV saved: " + path.split(/[\\/]/).pop())
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Export failed.") }
  }
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">From</label>
        <input type="date" value={from} onChange={e=>onFrom(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">To</label>
        <input type="date" value={to} onChange={e=>onTo(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <button onClick={onLoad} disabled={loading} className="btn-primary text-xs px-4 py-2">
        {loading ? <><Spinner size="sm"/>Loading…</> : <><RefreshCw size={14}/>Load Report</>}
      </button>
    </div>
  )
}

function SummaryCard({ label, value, sub, color = "blue" }: { label:string;value:string;sub?:string;color?:string }) {
  const colors: Record<string,string> = { blue:"bg-blue-50 text-blue-600", green:"bg-green-50 text-green-600", amber:"bg-amber-50 text-amber-600", red:"bg-red-50 text-red-600" }
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]?.split(' ')[1] ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("sales")
  const today = new Date().toISOString().slice(0,10)
  const monthStart = today.slice(0,8)+"01"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Reports" subtitle="Business analytics and compliance reports" />
        <CaPackageButton />
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t.id?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {tab==="sales"    && <SalesReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="purchase" && <PurchaseReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="stock"    && <StockReport/>}
      {tab==="gst"      && <GstReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="pl"       && <ProfitLossReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="audit"    && <AuditReport defaultFrom={monthStart} defaultTo={today}/>}
    </div>
  )
}

function CaPackageButton() {
  const [generating, setGenerating] = useState(false)
  const currentFY = () => {
    const now = new Date(); const yr = now.getFullYear(); const mo = now.getMonth()+1
    return mo >= 4 ? `${yr}-${yr+1}` : `${yr-1}-${yr}`
  }
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const path = await reportService.caPackage(currentFY())
      toast.success(`CA Package saved to: ${path}`, { duration: 6000 })
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Could not generate CA package.") }
    finally { setGenerating(false) }
  }
  return (
    <button onClick={handleGenerate} disabled={generating} className="btn-secondary text-sm">
      {generating ? <><Spinner size="sm"/>Generating…</> : <><Download size={15}/>CA Package {currentFY()}</>}
    </button>
  )
}

function SalesReport({ defaultFrom, defaultTo }: { defaultFrom:string;defaultTo:string }) {
  const [from, setFrom] = useState(defaultFrom)
  const [to,   setTo]   = useState(defaultTo)
  const [data, setData] = useState<Record<string,unknown>|null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!from||!to) { toast.error("Select date range."); return }
    setLoading(true)
    try { setData(await reportService.sales(from,to) as Record<string,unknown>) }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Could not load report.") }
    finally { setLoading(false) }
  }, [from, to])

  const s = data?.summary as Record<string,unknown> | undefined
  const daily = (data?.daily as unknown[]) ?? []
  const top   = (data?.top_medicines as unknown[]) ?? []
  const pays  = (data?.payment_breakdown as unknown[]) ?? []

  return (
    <div className="space-y-4">
      <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onLoad={load} loading={loading}/>
      {!data && !loading && <EmptyState icon={<TrendingUp size={40}/>} title="Select a date range and click Load Report"/>}
      {loading && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {data && s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Total Revenue" value={formatCompact(s.total_revenue as number)} sub={`${s.bill_count} bills`} color="green"/>
            <SummaryCard label="Avg Bill Value" value={formatCurrency(s.avg_bill_value as number)} color="blue"/>
            <SummaryCard label="Total Discount" value={formatCurrency(s.total_discount as number)} color="amber"/>
            <SummaryCard label="Bills Raised" value={String(s.bill_count)} sub="in period" color="blue"/>
          </div>
          {daily.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Daily Sales Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={daily as Record<string,unknown>[]} barSize={20}>
                  <XAxis dataKey="date" tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={d=>{try{return new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}catch{return d}}}/>
                  <YAxis tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={v=>formatCompact(v as number)} width={60}/>
                  <Tooltip formatter={(v:unknown)=>[formatCurrency(v as number),"Revenue"]} contentStyle={{fontSize:12,borderRadius:8}}/>
                  <Bar dataKey="net_sales" fill="#2563eb" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {top.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-3">Top 10 Medicines</h3>
                <div className="space-y-2">
                  {(top as Record<string,unknown>[]).map((m,i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">{i+1}</span>
                        <span className="text-sm text-slate-700">{m.medicine_name as string}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(m.total_amount as number)}</p>
                        <p className="text-xs text-slate-400">{m.quantity as number} units</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pays.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-3">Payment Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pays as Record<string,unknown>[]} dataKey="amount" nameKey="mode" cx="50%" cy="50%" outerRadius={80} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {(pays as Record<string,unknown>[]).map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v:unknown)=>formatCurrency(v as number)}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PurchaseReport({ defaultFrom, defaultTo }: { defaultFrom:string;defaultTo:string }) {
  const [from,setFrom]=useState(defaultFrom);const[to,setTo]=useState(defaultTo);const[data,setData]=useState<Record<string,unknown>|null>(null);const[loading,setLoading]=useState(false)
  const load=useCallback(async()=>{if(!from||!to){toast.error("Select date range.");return};setLoading(true);try{setData(await reportService.purchase(from,to) as Record<string,unknown>)}catch(e:unknown){toast.error(e instanceof Error?e.message:"Error")}finally{setLoading(false)}},[from,to])
  const s=data?.summary as Record<string,unknown>|undefined;const by_s=(data?.by_supplier as unknown[])??[]
  return(
    <div className="space-y-4">
      <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onLoad={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<ShoppingCart size={40}/>} title="Select a date range and click Load Report"/>}
      {loading&&<div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {data&&s&&(
        <>
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard label="Total Purchase" value={formatCompact(s.total_purchase as number)} sub={`${s.bill_count} bills`} color="blue"/>
            <SummaryCard label="Suppliers Used" value={String(by_s.length)} color="blue"/>
          </div>
          {by_s.length>0&&(
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Purchase by Supplier</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">Supplier</th><th className="text-center px-4 py-2">Bills</th><th className="text-right px-4 py-2">Amount</th></tr></thead>
                  <tbody>{(by_s as Record<string,unknown>[]).map((s,i)=><tr key={i} className="table-row"><td className="px-4 py-2.5 font-medium text-slate-800">{s.supplier_name as string}</td><td className="px-4 py-2.5 text-center text-slate-600">{s.bill_count as number}</td><td className="px-4 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(s.total_amount as number)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StockReport() {
  const[data,setData]=useState<Record<string,unknown>|null>(null);const[loading,setLoading]=useState(false)
  const load=useCallback(async()=>{setLoading(true);try{setData(await reportService.stock() as Record<string,unknown>)}catch(e:unknown){toast.error(e instanceof Error?e.message:"Error")}finally{setLoading(false)}},[])
  const s=data?.summary as Record<string,unknown>|undefined;const items=(data?.items as unknown[])??[]
  return(
    <div className="space-y-4">
      <button onClick={load} disabled={loading} className="btn-primary text-xs px-4 py-2">{loading?<><Spinner size="sm"/>Loading…</>:<><RefreshCw size={14}/>Load Stock Report</>}</button>
      {!data&&!loading&&<EmptyState icon={<Package size={40}/>} title="Click Load Stock Report to view current inventory valuation"/>}
      {loading&&<div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {data&&s&&(
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Medicine Lines" value={String(s.medicine_count)} color="blue"/>
            <SummaryCard label="Total Units" value={String(s.total_units)} color="blue"/>
            <SummaryCard label="Cost Value" value={formatCompact(s.cost_value as number)} color="amber"/>
            <SummaryCard label="Potential Margin" value={formatCompact(s.potential_margin as number)} color="green"/>
          </div>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-200"><h3 className="font-semibold text-slate-800">Stock Valuation by Medicine</h3></div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">Medicine</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Cost Value</th><th className="text-right px-4 py-2">Sell Value</th><th className="text-right px-4 py-2">Margin</th></tr></thead>
                <tbody>{(items as Record<string,unknown>[]).map((m,i)=>{const cv=m.cost_value as number,sv=m.selling_value as number;return(<tr key={i} className="table-row"><td className="px-4 py-2.5 font-medium text-slate-800">{m.medicine_name as string}</td><td className="px-4 py-2.5 text-right text-slate-600">{m.quantity_on_hand as number}</td><td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(cv)}</td><td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(sv)}</td><td className={`px-4 py-2.5 text-right font-semibold ${(sv-cv)>=0?"text-green-600":"text-red-600"}`}>{formatCurrency(sv-cv)}</td></tr>)})}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function GstReport({ defaultFrom, defaultTo }: { defaultFrom:string;defaultTo:string }) {
  const[from,setFrom]=useState(defaultFrom);const[to,setTo]=useState(defaultTo);const[data,setData]=useState<Record<string,unknown>|null>(null);const[loading,setLoading]=useState(false)
  const load=useCallback(async()=>{if(!from||!to){toast.error("Select date range.");return};setLoading(true);try{setData(await reportService.gst(from,to) as Record<string,unknown>)}catch(e:unknown){toast.error(e instanceof Error?e.message:"Error")}finally{setLoading(false)}},[from,to])
  const s=data?.summary as Record<string,unknown>|undefined;const hsn=(data?.hsn_summary as unknown[])??[]
  return(
    <div className="space-y-4">
      <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onLoad={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<FileText size={40}/>} title="Select date range and load GST report"/>}
      {loading&&<div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {data&&s&&(
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Taxable Amount" value={formatCompact(s.taxable_amount as number)} color="blue"/>
            <SummaryCard label="CGST" value={formatCurrency(s.cgst as number)} color="amber"/>
            <SummaryCard label="SGST" value={formatCurrency(s.sgst as number)} color="amber"/>
            <SummaryCard label="Total GST" value={formatCurrency(s.total_gst as number)} color="red"/>
          </div>
          {hsn.length>0&&(
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-200"><h3 className="font-semibold text-slate-800">HSN-wise Summary (for GSTR-1)</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">HSN</th><th className="text-right px-4 py-2">Taxable</th><th className="text-right px-4 py-2">CGST</th><th className="text-right px-4 py-2">SGST</th><th className="text-right px-4 py-2">IGST</th><th className="text-right px-4 py-2">Total</th></tr></thead>
                  <tbody>{(hsn as Record<string,unknown>[]).map((h,i)=><tr key={i} className="table-row"><td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">{h.hsn_code as string}</td><td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(h.taxable as number)}</td><td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(h.cgst as number)}</td><td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(h.sgst as number)}</td><td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(h.igst as number)}</td><td className="px-4 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(h.total as number)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProfitLossReport({ defaultFrom, defaultTo }: { defaultFrom:string;defaultTo:string }) {
  const[from,setFrom]=useState(defaultFrom);const[to,setTo]=useState(defaultTo);const[data,setData]=useState<Record<string,unknown>|null>(null);const[loading,setLoading]=useState(false)
  const load=useCallback(async()=>{if(!from||!to){toast.error("Select date range.");return};setLoading(true);try{setData(await reportService.profitLoss(from,to) as Record<string,unknown>)}catch(e:unknown){toast.error(e instanceof Error?e.message:"Error")}finally{setLoading(false)}},[from,to])
  const s=data?.summary as Record<string,unknown>|undefined;const daily=(data?.daily as unknown[])??[]
  return(
    <div className="space-y-4">
      <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onLoad={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<TrendingUp size={40}/>} title="Select date range and load P&L report"/>}
      {loading&&<div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {data&&s&&(
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Revenue" value={formatCompact(s.revenue as number)} color="green"/>
            <SummaryCard label="Est. COGS" value={formatCompact(s.cogs as number)} color="amber"/>
            <SummaryCard label="Gross Profit" value={formatCompact(s.gross_profit as number)} color={(s.gross_profit as number)>=0?"green":"red"}/>
            <SummaryCard label="Gross Margin" value={`${(s.gross_margin_pct as number).toFixed(1)}%`} color={(s.gross_margin_pct as number)>=20?"green":"amber"}/>
          </div>
          {daily.length>0&&(
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Daily Revenue vs COGS</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={daily as Record<string,unknown>[]}>
                  <XAxis dataKey="date" tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={d=>{try{return new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}catch{return d}}}/>
                  <YAxis tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={v=>formatCompact(v as number)} width={60}/>
                  <Tooltip formatter={(v:unknown)=>formatCurrency(v as number)} contentStyle={{fontSize:12,borderRadius:8}}/>
                  <Legend/>
                  <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} name="Revenue"/>
                  <Line type="monotone" dataKey="cogs" stroke="#d97706" strokeWidth={2} dot={false} name="COGS"/>
                  <Line type="monotone" dataKey="gross_profit" stroke="#2563eb" strokeWidth={2} dot={false} name="Gross Profit" strokeDasharray="4 2"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AuditReport({ defaultFrom, defaultTo }: { defaultFrom:string;defaultTo:string }) {
  const[from,setFrom]=useState(defaultFrom);const[to,setTo]=useState(defaultTo);const[data,setData]=useState<Record<string,unknown>|null>(null);const[loading,setLoading]=useState(false)
  const load=useCallback(async()=>{if(!from||!to){toast.error("Select date range.");return};setLoading(true);try{setData(await reportService.auditLog(from,to) as Record<string,unknown>)}catch(e:unknown){toast.error(e instanceof Error?e.message:"Error")}finally{setLoading(false)}},[from,to])
  const rows=(data?.rows as unknown[])??[]
  const ACTION_COLOR: Record<string,string>={BILL_CREATED:"badge-green",MEDICINE_CREATED:"badge-blue",MEDICINE_UPDATED:"badge-blue",MEDICINE_DELETED:"badge-red",CUSTOMER_CREATED:"badge-blue",SUPPLIER_CREATED:"badge-blue",LOGIN:"badge-slate",BILL_CANCELLED:"badge-red",STOCK_ADJUSTED:"badge-amber",PURCHASE_BILL_CREATED:"badge-blue"}
  return(
    <div className="space-y-4">
      <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onLoad={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<ClipboardList size={40}/>} title="Select date range to view audit log"/>}
      {loading&&<div className="flex justify-center py-16"><Spinner size="lg"/></div>}
      {data&&(
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Audit Log</h3>
            <span className="badge-slate">{data.total as number} events</span>
          </div>
          {rows.length===0?<EmptyState title="No events in this period"/>:(
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">Time</th><th className="text-left px-4 py-2">User</th><th className="text-left px-4 py-2">Action</th><th className="text-left px-4 py-2">Module</th><th className="text-left px-4 py-2">Record</th></tr></thead>
                <tbody>
                  {(rows as Record<string,unknown>[]).map((r,i)=>(
                    <tr key={i} className="table-row">
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(r.created_at as string)}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.user_name as string}</td>
                      <td className="px-4 py-2.5"><span className={ACTION_COLOR[r.action as string]??"badge-slate"}>{r.action as string}</span></td>
                      <td className="px-4 py-2.5 text-slate-500 capitalize">{r.module as string}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{r.record_id as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
