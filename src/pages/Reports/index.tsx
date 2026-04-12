import { useState, useCallback, useEffect } from "react"
import { BarChart3, ShoppingCart, Package, FileText, TrendingUp, ClipboardList, Download, RefreshCw, AlertOctagon } from "lucide-react"
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

type Tab = "sales" | "purchase" | "stock" | "gst" | "pl" | "audit" | "dead_stock"

const TABS: { id: Tab; label: string; icon: React.ComponentType<{size:number}> }[] = [
  { id:"sales",      label:"Sales",          icon:TrendingUp    },
  { id:"purchase",   label:"Purchase",       icon:ShoppingCart  },
  { id:"stock",      label:"Stock Value",    icon:Package       },
  { id:"gst",        label:"GST / Tax",      icon:FileText      },
  { id:"pl",         label:"Profit & Loss",  icon:BarChart3     },
  { id:"audit",      label:"Audit Log",      icon:ClipboardList },
  { id:"dead_stock", label:"Dead Stock",     icon:AlertOctagon  },
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

      {tab==="sales"      && <SalesReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="purchase"   && <PurchaseReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="stock"      && <StockReport/>}
      {tab==="gst"        && <GstReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="pl"         && <ProfitLossReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="audit"      && <AuditReport defaultFrom={monthStart} defaultTo={today}/>}
      {tab==="dead_stock" && <DeadStockTab/>}
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

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function ProfitLossReport({ defaultFrom: _df, defaultTo: _dt }: { defaultFrom:string;defaultTo:string }) {
  const now = new Date()
  const [period, setPeriod] = useState<"monthly"|"yearly">("monthly")
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData]   = useState<Record<string,unknown>|null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoke<Record<string,unknown>>("pl_report", {
        period, year, month: period === "monthly" ? month : null
      })
      setData(res)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setLoading(false) }
  }, [period, year, month])

  useEffect(() => { load() }, [load])

  const d = data ?? {}
  const revenue      = (d.revenue      as number) ?? 0
  const cogs         = (d.cogs         as number) ?? 0
  const grossProfit  = (d.gross_profit as number) ?? 0
  const grossMargin  = (d.gross_margin_pct as number) ?? 0
  const expenses     = (d.expenses     as number) ?? 0
  const netProfit    = (d.net_profit   as number) ?? 0
  const netMargin    = (d.net_margin_pct as number) ?? 0
  const billCount    = (d.bill_count   as number) ?? 0
  const expBreakdown = (d.expense_breakdown as Record<string,unknown>[]) ?? []
  const monthlyBreak = (d.monthly_breakdown as Record<string,unknown>[]) ?? []

  const years = Array.from({length:6},(_,i) => now.getFullYear()-i)

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {(["monthly","yearly"] as const).map(p=>(
            <button key={p} onClick={()=>setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${period===p?"bg-blue-600 text-white":"text-slate-600 hover:bg-slate-50"}`}>
              {p==="monthly"?"Monthly":"Yearly"}
            </button>
          ))}
        </div>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} className="input py-1.5 text-sm w-28">
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        {period==="monthly" && (
          <select value={month} onChange={e=>setMonth(Number(e.target.value))} className="input py-1.5 text-sm w-28">
            {MONTHS_SHORT.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        )}
        <button onClick={load} disabled={loading} className="btn-primary text-xs px-4 py-2">
          {loading?<><Spinner size="sm"/>Loading…</>:<><RefreshCw size={13}/>Refresh</>}
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Revenue"       value={formatCompact(revenue)}     sub={`${billCount} bills`}                color="green"/>
            <SummaryCard label="COGS"          value={formatCompact(cogs)}         sub="purchase cost"                       color="amber"/>
            <SummaryCard label="Gross Profit"  value={formatCompact(grossProfit)}  sub={`${grossMargin.toFixed(1)}% margin`} color={grossProfit>=0?"green":"red"}/>
            <SummaryCard label="Net Profit"    value={formatCompact(netProfit)}    sub={`${netMargin.toFixed(1)}% net margin`} color={netProfit>=0?"green":"red"}/>
          </div>

          {/* P&L waterfall summary */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">P&amp;L Statement</h3>
            <div className="space-y-2 text-sm">
              {[
                { label:"Revenue (Net Sales)",  value: revenue,     style:"font-semibold text-slate-900" },
                { label:"Cost of Goods Sold",   value:-cogs,        style:"text-amber-700" },
                { label:"Gross Profit",         value: grossProfit, style:"font-semibold text-blue-700 border-t border-slate-200 pt-2 mt-2" },
                { label:"Operating Expenses",   value:-expenses,    style:"text-red-600" },
                { label:"Net Profit",           value: netProfit,   style:`font-bold text-lg border-t-2 border-slate-300 pt-2 mt-2 ${netProfit>=0?"text-green-700":"text-red-700"}` },
              ].map(row=>(
                <div key={row.label} className={`flex justify-between ${row.style}`}>
                  <span>{row.label}</span>
                  <span>{formatCurrency(Math.abs(row.value))}{row.value<0&&row.label!=="Net Profit"?" (-)":""}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expense breakdown */}
          {expBreakdown.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Expense Breakdown</h3>
              <div className="space-y-2">
                {expBreakdown.map((e,i)=>(
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 capitalize">{e.category as string}</span>
                        <span className="font-medium text-slate-900">{formatCurrency(e.amount as number)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{width:`${expenses>0?((e.amount as number)/expenses*100):0}%`}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly chart for yearly view */}
          {period==="yearly" && monthlyBreak.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Monthly Revenue — FY {year}–{year+1}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyBreak}>
                  <XAxis dataKey="month" tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={m=>MONTHS_SHORT[(parseInt(m as string)-1)]}/>
                  <YAxis tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={v=>formatCompact(v as number)} width={55}/>
                  <Tooltip formatter={(v:unknown)=>formatCurrency(v as number)} contentStyle={{fontSize:12,borderRadius:8}}/>
                  <Bar dataKey="revenue" fill="#2563eb" radius={[3,3,0,0]} name="Revenue"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const ACTION_COLOR: Record<string,string> = {
  BILL_CREATED:"badge-green", BILL_CANCELLED:"badge-red",
  MEDICINE_CREATED:"badge-blue", MEDICINE_UPDATED:"badge-blue", MEDICINE_DELETED:"badge-red",
  CUSTOMER_CREATED:"badge-blue", SUPPLIER_CREATED:"badge-blue",
  LOGIN:"badge-slate", LOGOUT:"badge-slate",
  STOCK_ADJUSTED:"badge-amber", PURCHASE_BILL_CREATED:"badge-blue",
  AMENDMENT:"badge-amber", EXPENSE_CREATED:"badge-blue",
}

const AUDIT_MODULES = ["","billing","medicine","customer","supplier","inventory","purchase","auth","expense","scheme"]

function AuditReport({ defaultFrom: _df, defaultTo: _dt }: { defaultFrom:string;defaultTo:string }) {
  const PAGE = 50
  const [rows,   setRows]   = useState<Record<string,unknown>[]>([])
  const [total,  setTotal]  = useState(0)
  const [page,   setPage]   = useState(0)
  const [mod,    setMod]    = useState("")
  const [loading,setLoading]= useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async (pg = 0, module = mod) => {
    setLoading(true)
    try {
      const res = await invoke<{ rows: Record<string,unknown>[]; total: number; modules: string[] }>(
        "audit_log_list",
        { limit: PAGE, offset: pg * PAGE, module: module || null, userId: null }
      )
      setRows(res.rows)
      setTotal(res.total)
      setPage(pg)
      setLoaded(true)
    } catch(e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to load audit log.") }
    finally { setLoading(false) }
  }, [mod])

  // load on first render
  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PAGE))

  const handleModChange = (val: string) => {
    setMod(val)
    load(0, val)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Module</label>
          <select value={mod} onChange={e=>handleModChange(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 capitalize">
            {AUDIT_MODULES.map(m => (
              <option key={m} value={m}>{m === "" ? "All modules" : m}</option>
            ))}
          </select>
        </div>
        <button onClick={()=>load(page)} disabled={loading}
          className="btn-primary text-xs px-4 py-2">
          {loading ? <><Spinner size="sm"/>Loading…</> : <><RefreshCw size={14}/>Refresh</>}
        </button>
        <span className="text-xs text-slate-400 ml-auto">{total} total events</span>
      </div>

      {!loaded && !loading && <EmptyState icon={<ClipboardList size={40}/>} title="Loading audit log…"/>}
      {loading && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}

      {loaded && !loading && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Audit Log</h3>
            <span className="text-xs text-slate-500">Page {page+1} of {totalPages}</span>
          </div>
          {rows.length === 0
            ? <EmptyState title="No events found" subtitle="Try a different module filter"/>
            : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left px-4 py-2.5">Time</th>
                      <th className="text-left px-4 py-2.5">User</th>
                      <th className="text-left px-4 py-2.5">Action</th>
                      <th className="text-left px-4 py-2.5">Module</th>
                      <th className="text-left px-4 py-2.5">Record</th>
                      <th className="text-left px-4 py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="table-row border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{formatDate(r.created_at as string)}</td>
                        <td className="px-4 py-2.5 text-slate-700 font-medium">{r.user_name as string ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`${ACTION_COLOR[r.action as string] ?? "badge-slate"} text-[11px] px-2 py-0.5 rounded-full`}>
                            {(r.action as string).replace(/_/g," ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 capitalize text-xs">{r.module as string}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{r.record_id as string ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[200px] truncate">{r.details as string ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between">
              <button onClick={()=>load(page-1)} disabled={page===0||loading}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
              <span className="text-xs text-slate-500">{page*PAGE+1}–{Math.min((page+1)*PAGE,total)} of {total}</span>
              <button onClick={()=>load(page+1)} disabled={page>=totalPages-1||loading}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeadStockTab() {
  const [data, setData] = useState<any>(null)
  const [days, setDays] = useState(90)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<any>('reports_dead_stock', { days })
      setData(result)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">No sale in last</label>
        <select value={days} onChange={e => { setDays(Number(e.target.value)) }} className="input w-28 py-1 text-sm">
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
          <option value={180}>180 days</option>
        </select>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""}/> Refresh
        </button>
      </div>
      {loading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs text-slate-500">Dead Stock Items</p>
              <p className="text-2xl font-bold text-slate-800">{data.count}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500">Total Value Locked</p>
              <p className="text-2xl font-bold text-red-600">
                ₹{data.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          {data.dead_stock.length === 0 ? (
            <EmptyState icon={<AlertOctagon size={40} className="text-slate-300"/>} message="No dead stock found for this period." />
          ) : (
            <div className="card overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Medicine</th>
                    <th className="px-4 py-3 text-left">Schedule</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-left">Expiry</th>
                    <th className="px-4 py-3 text-left">Last Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.dead_stock.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.generic_name}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.schedule}</td>
                      <td className="px-4 py-3 text-right font-medium">{item.stock}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">
                        ₹{item.stock_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.latest_expiry}</td>
                      <td className="px-4 py-3 text-slate-500">{item.last_sold_date}</td>
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
