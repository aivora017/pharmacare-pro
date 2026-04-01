import { useState, useEffect, useRef } from "react"
import { Bot, TrendingUp, Clock, Users, BarChart3, AlertOctagon, Send, Loader2, MessageCircle, FileText, ShieldCheck } from "lucide-react"
import toast from "react-hot-toast"
import { aiService } from "@/services/aiService"
import { formatCurrency, formatCompact } from "@/utils/currency"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { WhatsAppComposer } from "./WhatsAppComposer"

type Tab = "briefing"|"forecast"|"expiry"|"segments"|"abc"|"anomalies"|"whatsapp"|"ca_checks"|"ca_narration"|"ask"

const TABS: {id:Tab;label:string;icon:React.ComponentType<{size:number}>;tier:string}[] = [
  {id:"briefing",    label:"Morning Briefing",  icon:Bot,          tier:"offline"},
  {id:"forecast",    label:"Demand Forecast",   icon:TrendingUp,   tier:"offline"},
  {id:"expiry",      label:"Expiry Risk",        icon:Clock,        tier:"offline"},
  {id:"segments",    label:"Customers",          icon:Users,        tier:"offline"},
  {id:"abc",         label:"ABC/XYZ",            icon:BarChart3,    tier:"offline"},
  {id:"anomalies",   label:"Anomalies",          icon:AlertOctagon, tier:"offline"},
  {id:"whatsapp",    label:"WhatsApp",           icon:MessageCircle,tier:"claude"},
  {id:"ca_checks",   label:"CA Pre-checks",      icon:ShieldCheck,  tier:"offline"},
  {id:"ca_narration",label:"CA Narration",       icon:FileText,     tier:"claude"},
  {id:"ask",         label:"Ask PharmaCare",     icon:Bot,          tier:"claude"},
]

const SEG_COLORS: Record<string,string> = {champion:"badge-green",loyal:"badge-blue",new:"badge-blue",regular:"badge-slate",at_risk:"badge-amber",dormant:"badge-red"}
const RISK_COLORS: Record<string,string> = {critical:"badge-red",high:"badge-amber",medium:"badge-amber",low:"badge-green"}
const ABC_BG: Record<string,string> = {A:"bg-green-100 text-green-800",B:"bg-blue-100 text-blue-800",C:"bg-slate-100 text-slate-600"}

export default function AIPage() {
  const [tab, setTab] = useState<Tab>("briefing")
  return (
    <div className="space-y-5">
      <PageHeader title="AI Assistant" subtitle="Intelligent insights — Tier 1 runs offline, Tier 3 uses Claude API"/>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${tab===t.id?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
            <t.icon size={14}/>{t.label}
            {t.tier==="claude" && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"/>}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">● Blue dot = requires Claude API key in Settings</p>

      {tab==="briefing"     && <MorningBriefingTab/>}
      {tab==="forecast"     && <DemandForecastTab/>}
      {tab==="expiry"       && <ExpiryRiskTab/>}
      {tab==="segments"     && <CustomerSegmentsTab/>}
      {tab==="abc"          && <AbcXyzTab/>}
      {tab==="anomalies"    && <AnomaliesTab/>}
      {tab==="whatsapp"     && <WhatsAppComposer/>}
      {tab==="ca_checks"    && <CaChecksTab/>}
      {tab==="ca_narration" && <CaNarrationTab/>}
      {tab==="ask"          && <AskTab/>}
    </div>
  )
}

function LoadBtn({label,onClick,loading}:{label:string;onClick:()=>void;loading:boolean}){
  return <button onClick={onClick} disabled={loading} className="btn-primary text-xs px-4 py-2">{loading?<><Spinner size="sm"/>Analysing…</>:label}</button>
}

function MorningBriefingTab(){
  const[data,setData]=useState<{actions:{priority:string;icon:string;message:string;link:string}[]}|null>(null)
  const[loading,setLoading]=useState(false)
  useEffect(()=>{setLoading(true);aiService.morningBriefing().then(d=>setData(d)).catch(()=>toast.error("Could not load.")).finally(()=>setLoading(false))},[])
  if(loading)return<div className="flex justify-center py-16"><Spinner size="lg"/></div>
  if(!data)return<EmptyState title="No data"/>
  const pri:Record<string,string>={urgent:"border-red-200 bg-red-50",important:"border-amber-200 bg-amber-50",info:"border-slate-200 bg-slate-50"}
  const ptx:Record<string,string>={urgent:"text-red-700",important:"text-amber-700",info:"text-slate-700"}
  return(
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-slate-500">Updated as of {new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
      {data.actions.map((a,i)=>(
        <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border ${pri[a.priority]??pri.info}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.priority==="urgent"?"bg-red-100":a.priority==="important"?"bg-amber-100":"bg-slate-100"}`}>
            <span className="text-sm">{a.priority==="urgent"?"⚠":a.priority==="important"?"⏰":"ℹ️"}</span>
          </div>
          <p className={`text-sm font-medium ${ptx[a.priority]??ptx.info}`}>{a.message}</p>
        </div>
      ))}
    </div>
  )
}

function DemandForecastTab(){
  const[data,setData]=useState<unknown[]|null>(null);const[loading,setLoading]=useState(false)
  const load=()=>{setLoading(true);aiService.demandForecast().then(d=>setData(d as unknown[])).catch(()=>toast.error("Error")).finally(()=>setLoading(false))}
  return(
    <div className="space-y-4">
      <LoadBtn label="Run Demand Forecast" onClick={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<TrendingUp size={40}/>} title="Click to analyse 90-day sales patterns"/>}
      {data&&(
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200"><h3 className="font-semibold text-slate-800">Demand Forecast — Next 30 Days</h3></div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">Medicine</th><th className="text-right px-4 py-2">Stock</th><th className="text-right px-4 py-2">Sold 30d</th><th className="text-right px-4 py-2">Forecast</th><th className="text-right px-4 py-2 text-blue-600">Order</th><th className="text-center px-4 py-2">Trend</th></tr></thead>
              <tbody>
                {(data as Record<string,unknown>[]).map((m,i)=>(
                  <tr key={i} className={`table-row ${(m.recommended_order as number)>0?"bg-blue-50/20":""}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{m.medicine_name as string}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${(m.current_stock as number)<=0?"text-red-600":"text-slate-700"}`}>{m.current_stock as number}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{m.sold_last_30d as number}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{m.forecast_30day as number}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${(m.recommended_order as number)>0?"text-blue-600":"text-slate-300"}`}>{m.recommended_order as number}</td>
                    <td className="px-4 py-2.5 text-center"><span className={`badge-${m.trend==="up"?"green":m.trend==="down"?"red":"slate"}`}>{m.trend==="up"?"↑":m.trend==="down"?"↓":"→"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ExpiryRiskTab(){
  const[data,setData]=useState<unknown[]|null>(null);const[loading,setLoading]=useState(false)
  const load=()=>{setLoading(true);aiService.expiryRisks().then(d=>setData(d as unknown[])).catch(()=>toast.error("Error")).finally(()=>setLoading(false))}
  return(
    <div className="space-y-4">
      <LoadBtn label="Run Expiry Risk Analysis" onClick={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<Clock size={40}/>} title="Scores every batch on expiry urgency"/>}
      {data&&(
        <div className="card overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">Medicine</th><th className="text-left px-4 py-2">Batch</th><th className="text-right px-4 py-2">Qty</th><th className="text-center px-4 py-2">Days</th><th className="text-center px-4 py-2">Score</th><th className="text-center px-4 py-2">Risk</th><th className="text-left px-4 py-2">Action</th></tr></thead>
              <tbody>
                {(data as Record<string,unknown>[]).filter(r=>(r.risk_score as number)>=4).sort((a,b)=>(b.risk_score as number)-(a.risk_score as number)).map((r,i)=>(
                  <tr key={i} className={`table-row ${(r.risk_score as number)>=9?"bg-red-50/40":""}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.medicine_name as string}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.batch_number as string}</td>
                    <td className="px-4 py-2.5 text-right">{r.quantity_on_hand as number}</td>
                    <td className={`px-4 py-2.5 text-center font-semibold ${(r.days_to_expiry as number)<0?"text-red-600":(r.days_to_expiry as number)<=30?"text-orange-600":"text-amber-600"}`}>{(r.days_to_expiry as number)<0?`${Math.abs(r.days_to_expiry as number)}d ago`:`${r.days_to_expiry}d`}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-lg">{r.risk_score as number}</td>
                    <td className="px-4 py-2.5 text-center"><span className={RISK_COLORS[r.risk_level as string]??"badge-slate"}>{r.risk_level as string}</span></td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{r.action_suggested as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerSegmentsTab(){
  const[data,setData]=useState<unknown[]|null>(null);const[loading,setLoading]=useState(false)
  const load=()=>{setLoading(true);aiService.customerSegments().then(d=>setData(d as unknown[])).catch(()=>toast.error("Error")).finally(()=>setLoading(false))}
  const counts=(segs:string[])=>{const c:Record<string,number>={};segs.forEach(s=>{c[s]=(c[s]??0)+1});return c}
  const segs=data?counts((data as Record<string,unknown>[]).map(r=>r.segment as string)):{}
  return(
    <div className="space-y-4">
      <LoadBtn label="Analyse Customer Segments" onClick={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<Users size={40}/>} title="RFM segmentation: Champions, Loyal, At-Risk, Dormant"/>}
      {data&&(
        <>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {["champion","loyal","regular","new","at_risk","dormant"].map(s=>(
              <div key={s} className="card p-3 text-center">
                <p className="text-2xl font-bold">{segs[s]??0}</p>
                <span className={`mt-1 ${SEG_COLORS[s]??"badge-slate"}`}>{s.replace("_"," ")}</span>
              </div>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">Patient</th><th className="text-center px-4 py-2">Segment</th><th className="text-right px-4 py-2">Spend 90d</th><th className="text-right px-4 py-2">Visits</th><th className="text-right px-4 py-2">Days Since</th><th className="text-right px-4 py-2">CLV/yr</th></tr></thead>
                <tbody>
                  {(data as Record<string,unknown>[]).map((r,i)=>(
                    <tr key={i} className="table-row">
                      <td className="px-4 py-2.5"><p className="font-medium text-slate-800">{r.customer_name as string}</p>{r.phone&&<p className="text-xs text-slate-400">{r.phone as string}</p>}</td>
                      <td className="px-4 py-2.5 text-center"><span className={SEG_COLORS[r.segment as string]??"badge-slate"}>{(r.segment as string).replace("_"," ")}</span></td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(r.spend_90_days as number)}</td>
                      <td className="px-4 py-2.5 text-right">{r.visit_count_90_days as number}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${(r.days_since_last_visit as number)>90?"text-red-500":(r.days_since_last_visit as number)>30?"text-amber-500":"text-slate-600"}`}>{r.days_since_last_visit as number}d</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatCompact(r.estimated_annual_clv as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AbcXyzTab(){
  const[data,setData]=useState<unknown[]|null>(null);const[loading,setLoading]=useState(false)
  const load=()=>{setLoading(true);aiService.abcXyz().then(d=>setData(d as unknown[])).catch(()=>toast.error("Error")).finally(()=>setLoading(false))}
  return(
    <div className="space-y-4">
      <LoadBtn label="Run ABC/XYZ Analysis" onClick={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<BarChart3 size={40}/>} title="ABC = revenue contribution · XYZ = demand consistency"/>}
      {data&&(
        <div className="card overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0"><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-4 py-2">Medicine</th><th className="text-right px-4 py-2">Revenue 90d</th><th className="text-right px-4 py-2">Qty</th><th className="text-center px-4 py-2">ABC</th><th className="text-center px-4 py-2">XYZ</th><th className="text-center px-4 py-2">Class</th></tr></thead>
              <tbody>
                {(data as Record<string,unknown>[]).map((m,i)=>(
                  <tr key={i} className="table-row">
                    <td className="px-4 py-2.5 font-medium">{m.medicine_name as string}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(m.revenue_90_days as number)}</td>
                    <td className="px-4 py-2.5 text-right">{m.quantity_90_days as number}</td>
                    <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded text-xs font-bold ${ABC_BG[m.abc_class as string]??"bg-slate-100 text-slate-600"}`}>{m.abc_class as string}</span></td>
                    <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">{m.xyz_class as string}</span></td>
                    <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">{m.combined_class as string}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AnomaliesTab(){
  const[data,setData]=useState<unknown[]|null>(null);const[loading,setLoading]=useState(false)
  const load=()=>{setLoading(true);aiService.anomalies().then(d=>setData(d as unknown[])).catch(()=>toast.error("Error")).finally(()=>setLoading(false))}
  const SEV:Record<string,string>={high:"badge-red",medium:"badge-amber",low:"badge-slate"}
  return(
    <div className="space-y-4">
      <LoadBtn label="Detect Anomalies" onClick={load} loading={loading}/>
      {!data&&!loading&&<EmptyState icon={<AlertOctagon size={40}/>} title="Detects high discounts, below-cost sales, unusual patterns"/>}
      {data&&data.length===0&&<EmptyState icon={<AlertOctagon size={40}/>} title="No anomalies detected" subtitle="Your billing data looks clean."/>}
      {data&&data.length>0&&(
        <div className="space-y-3">
          {(data as Record<string,unknown>[]).map((a,i)=>(
            <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border ${a.severity==="high"?"border-red-200 bg-red-50/50":"border-amber-200 bg-amber-50/50"}`}>
              <AlertOctagon size={18} className={a.severity==="high"?"text-red-600":"text-amber-600"}/>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1"><span className={SEV[a.severity as string]??"badge-slate"}>{a.severity as string}</span><span className="badge-slate text-xs">{(a.type as string).replace(/_/g," ")}</span></div>
                <p className="text-sm text-slate-800">{a.description as string}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CaChecksTab(){
  const today = new Date(); const yr = today.getFullYear(); const mo = today.getMonth()+1
  const defaultFY = mo>=4 ? `${yr}-${yr+1}` : `${yr-1}-${yr}`
  const[fy,setFy]=useState(defaultFY)
  const[data,setData]=useState<unknown[]|null>(null);const[loading,setLoading]=useState(false)
  const load=()=>{setLoading(true);aiService.caChecks(fy).then(d=>setData(d as unknown[])).catch((e:unknown)=>toast.error(e instanceof Error?e.message:"Error")).finally(()=>setLoading(false))}
  const SEV_CONFIG:Record<string,{bg:string;border:string;icon:string}> = {
    high:   {bg:"bg-red-50",   border:"border-red-200",   icon:"🔴"},
    medium: {bg:"bg-amber-50", border:"border-amber-200", icon:"🟡"},
    low:    {bg:"bg-blue-50",  border:"border-blue-200",  icon:"🔵"},
    info:   {bg:"bg-green-50", border:"border-green-200", icon:"✅"},
  }
  return(
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Financial Year</label>
          <input value={fy} onChange={e=>setFy(e.target.value)} placeholder="2025-26" className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-28"/>
        </div>
        <LoadBtn label="Run CA Pre-checks" onClick={load} loading={loading}/>
      </div>
      {!data&&!loading&&<EmptyState icon={<ShieldCheck size={40}/>} title="Pre-export validation for your CA package" subtitle="Checks for missing GSTIN, cash limits, stock reconciliation, and more."/>}
      {loading&&<div className="flex justify-center py-12"><Spinner size="lg"/></div>}
      {data&&(
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Found {data.length} item{data.length!==1?"s":""} · Review before generating CA package</p>
          {(data as Record<string,unknown>[]).map((c,i)=>{
            const cfg=SEV_CONFIG[c.severity as string]??SEV_CONFIG.info
            return(
              <div key={i} className={`p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${c.severity==="high"?"text-red-700":c.severity==="medium"?"text-amber-700":c.severity==="low"?"text-blue-700":"text-green-700"}`}>{c.severity as string}</span>
                      {(c.count as number)>0&&<span className="badge-slate">{c.count as number} items</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-800">{c.message as string}</p>
                    <p className="text-xs text-slate-500 mt-1">{c.action as string}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CaNarrationTab(){
  const today = new Date(); const yr = today.getFullYear(); const mo = today.getMonth()+1
  const defaultFY = mo>=4 ? `${yr}-${yr+1}` : `${yr-1}-${yr}`
  const[fy,setFy]=useState(defaultFY)
  const[narration,setNarration]=useState("")
  const[loading,setLoading]=useState(false)
  const[copied,setCopied]=useState(false)
  const generate=async()=>{
    setLoading(true);setNarration("")
    try{const n=await aiService.caNarration(fy);setNarration(n)}
    catch(e:unknown){toast.error(e instanceof Error?e.message:"Error. Configure Claude API key in Settings.")}
    finally{setLoading(false)}
  }
  const copy=async()=>{await navigator.clipboard.writeText(narration);setCopied(true);setTimeout(()=>setCopied(false),2000);toast.success("Copied to clipboard!")}
  return(
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Financial Year</label>
          <input value={fy} onChange={e=>setFy(e.target.value)} placeholder="2025-26" className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-28"/>
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary text-xs px-4 py-2">
          {loading?<><Spinner size="sm"/>Generating…</>:<><FileText size={14}/>Generate CA Summary</>}
        </button>
      </div>
      {!narration&&!loading&&<EmptyState icon={<FileText size={40}/>} title="AI-written summary for your CA" subtitle="Claude analyses your FY data and writes a plain-English executive summary that your CA can read in 2 minutes."/>}
      {loading&&(
        <div className="card p-8 text-center">
          <Spinner size="lg" className="mx-auto mb-4"/>
          <p className="text-slate-600 font-medium">Claude is analysing your financial year data…</p>
          <p className="text-sm text-slate-400 mt-1">This takes about 5–10 seconds</p>
        </div>
      )}
      {narration&&(
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">CA Executive Summary — FY {fy}</h3>
            <button onClick={copy} className="btn-secondary text-xs px-3 py-1.5">{copied?"✓ Copied":"Copy"}</button>
          </div>
          <div className="p-5">
            <div className="prose prose-sm max-w-none">
              {narration.split('\n').map((para,i)=>para.trim()&&<p key={i} className="text-slate-700 leading-relaxed mb-3">{para}</p>)}
            </div>
          </div>
          <div className="px-5 pb-5">
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">⚠ This summary is AI-generated from your data. It is a guide for your CA, not a replacement for professional tax advice. Always have your CA verify all figures.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function AskTab(){
  const[messages,setMessages]=useState<{role:"user"|"assistant";text:string}[]>([])
  const[input,setInput]=useState("")
  const[loading,setLoading]=useState(false)
  const bottomRef=useRef<HTMLDivElement>(null)
  const inputRef=useRef<HTMLInputElement>(null)
  const send=async()=>{
    const q=input.trim();if(!q||loading)return
    setMessages(p=>[...p,{role:"user",text:q}]);setInput("");setLoading(true)
    try{const ans=await aiService.askPharmaCare(q);setMessages(p=>[...p,{role:"assistant",text:ans}])}
    catch(e:unknown){setMessages(p=>[...p,{role:"assistant",text:e instanceof Error?e.message:"Sorry, could not answer. Check API key in Settings."}])}
    finally{setLoading(false)}
  }
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages])
  const SUGGESTIONS=["How were today's sales?","Which medicines are running low?","Who are my top customers this month?","What should I order this week?","Show me anomalies in recent billing"]
  return(
    <div className="max-w-3xl">
      <div className="card flex flex-col" style={{height:"60vh"}}>
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Bot size={16} className="text-white"/></div>
          <div><p className="font-semibold text-slate-900">Ask PharmaCare</p><p className="text-xs text-slate-500">Powered by Claude · Configure API key in Settings → API Keys</p></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length===0&&(
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Bot size={40} className="text-slate-200"/>
              <p className="text-slate-500 text-sm">Ask anything about your pharmacy in English or Hindi</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s=><button key={s} onClick={()=>{setInput(s);setTimeout(()=>inputRef.current?.focus(),50)}} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors">{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m,i)=>(
            <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role==="user"?"bg-blue-600 text-white rounded-br-sm":"bg-slate-100 text-slate-800 rounded-bl-sm"}`}>
                {m.text.split('\n').map((line,j)=><p key={j}>{line||'\u00a0'}</p>)}
              </div>
            </div>
          ))}
          {loading&&<div className="flex justify-start"><div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3"><Loader2 size={16} className="text-slate-400 animate-spin"/></div></div>}
          <div ref={bottomRef}/>
        </div>
        <div className="p-3 border-t border-slate-200">
          <div className="flex gap-2">
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ask about sales, stock, customers…" className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
            <button onClick={send} disabled={loading||!input.trim()} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Send size={16} className="text-white"/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
