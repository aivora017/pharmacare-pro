import { useState } from "react"
import { MessageCircle, Send, Copy, CheckCircle, RefreshCw } from "lucide-react"
import toast from "react-hot-toast"
import { aiService } from "@/services/aiService"
import { customerService } from "@/services/customerService"
import { useDebounce } from "@/hooks/useDebounce"
import { Spinner } from "@/components/shared/Spinner"
import type { ICustomer } from "@/types"

const SITUATIONS = [
  "Medicine ready for pickup",
  "Outstanding payment reminder",
  "Prescription refill due",
  "Health checkup reminder",
  "Loyalty points update",
  "Custom message",
]
const LANGUAGES = ["English", "Hindi", "Marathi", "Gujarati"]
const TONES     = ["Friendly", "Professional", "Urgent"]

export function WhatsAppComposer() {
  const [custSearch, setCustSearch]   = useState("")
  const [custResults, setCustResults] = useState<ICustomer[]>([])
  const [selectedCust, setSelectedCust] = useState<ICustomer | null>(null)
  const [situation, setSituation]     = useState(SITUATIONS[0])
  const [customSit,  setCustomSit]    = useState("")
  const [language,   setLanguage]     = useState("English")
  const [tone,       setTone]         = useState("Friendly")
  const [generated,  setGenerated]    = useState("")
  const [edited,     setEdited]       = useState("")
  const [loading,    setLoading]      = useState(false)
  const [copied,     setCopied]       = useState(false)
  const [searching,  setSearching]    = useState(false)
  const dq = useDebounce(custSearch, 300)

  const searchCustomers = async (q: string) => {
    if (q.length < 2) { setCustResults([]); return }
    setSearching(true)
    try { setCustResults(await customerService.search(q) as ICustomer[]) }
    catch { /* silent */ } finally { setSearching(false) }
  }

  const generate = async () => {
    const cname = selectedCust?.name || "Valued Customer"
    const sit = situation === "Custom message" ? customSit : situation
    if (!sit.trim()) { toast.error("Enter a situation or message topic."); return }
    setLoading(true); setGenerated(""); setEdited("")
    try {
      const msg = await aiService.composeWhatsapp(cname, sit, language, tone)
      setGenerated(msg); setEdited(msg)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Could not generate. Configure Claude API key in Settings.") }
    finally { setLoading(false) }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(edited)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Message copied!")
  }

  const openWhatsApp = () => {
    const phone = selectedCust?.phone?.replace(/\D/g, '') ?? ""
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(edited)}`
      : `https://wa.me/?text=${encodeURIComponent(edited)}`
    window.open(url, "_blank")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left — inputs */}
      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><MessageCircle size={16} className="text-green-600"/>Compose WhatsApp Message</h3>

          {/* Customer search */}
          <div>
            <label className="label">Patient (optional)</label>
            <div className="relative">
              <input value={custSearch} onChange={e=>{setCustSearch(e.target.value);searchCustomers(e.target.value)}}
                placeholder="Search patient by name…" className="input pr-10"/>
              {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2"/>}
            </div>
            {custResults.length > 0 && (
              <div className="border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-sm">
                {custResults.slice(0,5).map(c=>(
                  <button key={c.id} onClick={()=>{setSelectedCust(c);setCustSearch(c.name);setCustResults([])}}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 text-left border-b border-slate-50 last:border-0">
                    <span className="text-sm font-medium text-slate-800">{c.name}</span>
                    <span className="text-xs text-slate-400">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedCust && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle size={14} className="text-green-600"/>
                <span className="text-sm text-green-800 font-medium">{selectedCust.name}</span>
                {selectedCust.phone && <span className="text-xs text-green-600">· {selectedCust.phone}</span>}
                <button onClick={()=>{setSelectedCust(null);setCustSearch("")}} className="ml-auto text-slate-400 hover:text-slate-600 text-xs">✕</button>
              </div>
            )}
          </div>

          {/* Situation */}
          <div>
            <label className="label">Situation</label>
            <select value={situation} onChange={e=>setSituation(e.target.value)} className="input">
              {SITUATIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {situation === "Custom message" && (
              <textarea value={customSit} onChange={e=>setCustomSit(e.target.value)} rows={2}
                placeholder="Describe the situation in a few words…" className="input mt-2 resize-none"/>
            )}
          </div>

          {/* Language + Tone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Language</label>
              <select value={language} onChange={e=>setLanguage(e.target.value)} className="input">
                {LANGUAGES.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tone</label>
              <select value={tone} onChange={e=>setTone(e.target.value)} className="input">
                {TONES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? <><Spinner size="sm"/>Generating…</> : <><Send size={16}/>Generate Message</>}
          </button>
        </div>
      </div>

      {/* Right — preview */}
      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Message Preview</h3>

          {!generated && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <MessageCircle size={40} className="text-slate-200 mb-3"/>
              <p className="text-sm">Generated message will appear here</p>
              <p className="text-xs mt-1">You can edit before sending</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Spinner size="lg" className="mx-auto mb-3"/>
                <p className="text-sm text-slate-500">Claude is writing your message…</p>
              </div>
            </div>
          )}

          {generated && (
            <>
              {/* WhatsApp bubble preview */}
              <div className="bg-[#e9f5cb] rounded-2xl rounded-bl-sm p-4 max-w-xs">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{edited}</p>
                <p className="text-[10px] text-slate-400 mt-1 text-right">just now ✓✓</p>
              </div>

              {/* Editable textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Edit before sending</label>
                  <span className={`text-xs ${edited.length > 160 ? "text-amber-600" : "text-slate-400"}`}>{edited.length} chars</span>
                </div>
                <textarea value={edited} onChange={e=>setEdited(e.target.value)} rows={4} className="input resize-none font-medium"/>
              </div>

              <div className="flex gap-3">
                <button onClick={generate} className="btn-ghost text-xs flex-1"><RefreshCw size={13}/>Regenerate</button>
                <button onClick={copy} className="btn-secondary flex-1">
                  {copied ? <><CheckCircle size={14} className="text-green-600"/>Copied!</> : <><Copy size={14}/>Copy</>}
                </button>
                <button onClick={openWhatsApp} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors min-h-touch">
                  <MessageCircle size={15}/>Open in WhatsApp
                </button>
              </div>
            </>
          )}
        </div>

        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Review Before Sending</p>
          <p className="text-xs text-amber-700">Always review AI-generated messages before sending. You are responsible for all messages sent to patients.</p>
        </div>
      </div>
    </div>
  )
}
