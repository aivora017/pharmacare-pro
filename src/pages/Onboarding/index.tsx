import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { invoke } from "@tauri-apps/api/core"
import { Pill, Building2, FileText, CheckCircle, ArrowRight, Loader2, ShieldCheck, AlertCircle } from "lucide-react"
import toast from "react-hot-toast"
import { useSettingsStore } from "@/store/settingsStore"
import { Spinner } from "@/components/shared/Spinner"

type GstChoice = "yes" | "no" | "later"

interface FormData {
  // Step 1 — Pharmacy basics
  pharmacy_name: string
  pharmacy_address: string
  pharmacy_phone: string
  pin_code: string
  drug_licence_no: string
  // Step 2 — GST
  gst_choice: GstChoice
  gstin: string
  legal_name: string
  trade_name: string
  state_code: string
  state_name: string
  reg_type: string
}

const INITIAL: FormData = {
  pharmacy_name: "", pharmacy_address: "", pharmacy_phone: "",
  pin_code: "", drug_licence_no: "",
  gst_choice: "later", gstin: "", legal_name: "", trade_name: "",
  state_code: "", state_name: "", reg_type: "Regular",
}

const REG_TYPES = ["Regular", "Composite", "SEZ", "Casual Taxable Person"]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { setGstEnabled, setOnboardingComplete } = useSettingsStore()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [verifying, setVerifying] = useState(false)
  const [gstinStatus, setGstinStatus] = useState<{ valid: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof FormData, v: string) => setForm(p => ({ ...p, [k]: v }))

  const verifyGstin = async () => {
    if (form.gstin.length < 15) { toast.error("Enter complete 15-character GSTIN."); return }
    setVerifying(true)
    setGstinStatus(null)
    try {
      const res = await invoke<{ valid: boolean; state_code: string; state_name: string; message: string }>(
        "gstin_verify", { gstin: form.gstin.toUpperCase() }
      )
      setGstinStatus({ valid: res.valid, message: res.message })
      if (res.valid) {
        setForm(p => ({ ...p, state_code: res.state_code, state_name: res.state_name, gstin: form.gstin.toUpperCase() }))
        toast.success(`GSTIN valid · ${res.state_name}`)
      }
    } catch {
      setGstinStatus({ valid: false, message: "Verification failed. Check the GSTIN and try again." })
    } finally { setVerifying(false) }
  }

  const canProceedStep1 = form.pharmacy_name.trim().length > 0

  const canProceedStep2 = () => {
    if (form.gst_choice === "later" || form.gst_choice === "no") return true
    return gstinStatus?.valid && form.legal_name.trim().length > 0
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const gst_enabled = form.gst_choice === "yes" && !!gstinStatus?.valid
      await invoke("onboarding_save", {
        pharmacyName:    form.pharmacy_name,
        pharmacyAddress: form.pharmacy_address,
        pharmacyPhone:   form.pharmacy_phone,
        pinCode:         form.pin_code,
        drugLicenceNo:   form.drug_licence_no,
        gstin:           gst_enabled ? form.gstin : "",
        legalName:       gst_enabled ? form.legal_name : "",
        tradeName:       gst_enabled ? form.trade_name : "",
        stateCode:       gst_enabled ? form.state_code : "",
        stateName:       gst_enabled ? form.state_name : "",
        regType:         gst_enabled ? form.reg_type : "Unregistered",
        gstEnabled:      gst_enabled,
      })
      setGstEnabled(gst_enabled)
      setOnboardingComplete(true)
      toast.success("Setup complete! Welcome to PharmaCare Pro.")
      navigate("/dashboard", { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Setup failed. Try again.")
    } finally { setSaving(false) }
  }

  const STEPS = [
    { label: "Pharmacy Info", icon: Building2 },
    { label: "GST Setup",     icon: FileText  },
    { label: "Done",          icon: CheckCircle },
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] bg-slate-900 p-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Pill size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">PharmaCare Pro</p>
            <p className="text-slate-400 text-sm">Setup Wizard</p>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">Let's set up your pharmacy.</h2>
          <p className="text-slate-400 text-sm leading-relaxed">Takes 2 minutes. You can update everything later in Settings.</p>
          <div className="mt-8 space-y-3">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 transition-opacity ${i > step ? "opacity-30" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                  ${i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-sm font-medium ${i === step ? "text-white" : "text-slate-400"}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-xs">Works 100% offline. Your data stays on your PC.</p>
      </div>

      {/* Right content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">

          {/* Step 0 — Pharmacy Basics */}
          {step === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Pharmacy Details</h2>
                <p className="text-slate-500 text-sm mt-1">This appears on every receipt and report.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Pharmacy / Store Name <span className="text-red-500">*</span></label>
                  <input value={form.pharmacy_name} onChange={e => set("pharmacy_name", e.target.value)}
                    placeholder="e.g. Jagannath Medical Store" className="input" autoFocus />
                </div>
                <div>
                  <label className="label">Full Address</label>
                  <input value={form.pharmacy_address} onChange={e => set("pharmacy_address", e.target.value)}
                    placeholder="Shop no, Street, Area, City" className="input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Phone Number</label>
                    <input value={form.pharmacy_phone} onChange={e => set("pharmacy_phone", e.target.value)}
                      placeholder="10-digit mobile" className="input" type="tel" />
                  </div>
                  <div>
                    <label className="label">PIN Code</label>
                    <input value={form.pin_code} onChange={e => set("pin_code", e.target.value)}
                      placeholder="421301" className="input" maxLength={6} />
                  </div>
                </div>
                <div>
                  <label className="label">Drug Licence Number</label>
                  <input value={form.drug_licence_no} onChange={e => set("drug_licence_no", e.target.value)}
                    placeholder="e.g. MH-KL-12345" className="input" />
                  <p className="text-xs text-slate-400 mt-1">Found on your retail drug licence certificate.</p>
                </div>
              </div>
              <button onClick={() => setStep(1)} disabled={!canProceedStep1}
                className="btn-primary w-full justify-between">
                Next: GST Setup <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 1 — GST Setup */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">GST Setup</h2>
                <p className="text-slate-500 text-sm mt-1">GST features unlock GSTR filing, E-Invoice, and tax-split receipts.</p>
              </div>

              {/* Choice cards */}
              <div className="space-y-3">
                {([
                  { id: "yes",   title: "Yes, I'm GST registered",  sub: "Enable GST billing, GSTR filing, E-Invoice",  icon: "🏢" },
                  { id: "no",    title: "No, I'm unregistered",      sub: "GST features hidden. Switch on later in Settings.", icon: "🏪" },
                  { id: "later", title: "I'll add GSTIN later",      sub: "Start billing now, add GSTIN from Settings whenever ready.", icon: "⏳" },
                ] as const).map(c => (
                  <button key={c.id} onClick={() => { setForm(p => ({ ...p, gst_choice: c.id })); setGstinStatus(null) }}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors
                      ${form.gst_choice === c.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <span className="text-2xl flex-shrink-0">{c.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${form.gst_choice === c.id ? "text-blue-800" : "text-slate-800"}`}>{c.title}</p>
                      <p className={`text-xs mt-0.5 ${form.gst_choice === c.id ? "text-blue-600" : "text-slate-400"}`}>{c.sub}</p>
                    </div>
                    {form.gst_choice === c.id && (
                      <CheckCircle size={18} className="text-blue-600 ml-auto flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>

              {/* GSTIN fields — only when "yes" */}
              {form.gst_choice === "yes" && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="label">GSTIN <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <input
                        value={form.gstin}
                        onChange={e => { set("gstin", e.target.value.toUpperCase()); setGstinStatus(null) }}
                        placeholder="27AAAAA0000A1Z5"
                        className="input font-mono flex-1"
                        maxLength={15}
                      />
                      <button onClick={verifyGstin} disabled={verifying || form.gstin.length < 15}
                        className="btn-secondary px-4 flex-shrink-0">
                        {verifying ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        {verifying ? "Verifying…" : "Verify"}
                      </button>
                    </div>
                    {gstinStatus && (
                      <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg
                        ${gstinStatus.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {gstinStatus.valid ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                        {gstinStatus.message}
                      </div>
                    )}
                    {gstinStatus?.valid && form.state_name && (
                      <p className="text-xs text-slate-500 mt-1">State: <strong>{form.state_name}</strong> (Code: {form.state_code})</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">15-character GSTIN from your GST registration certificate.</p>
                  </div>
                  <div>
                    <label className="label">Legal Name (as per GST) <span className="text-red-500">*</span></label>
                    <input value={form.legal_name} onChange={e => set("legal_name", e.target.value)}
                      placeholder="Registered business name" className="input" />
                  </div>
                  <div>
                    <label className="label">Trade Name <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input value={form.trade_name} onChange={e => set("trade_name", e.target.value)}
                      placeholder="Common trading name if different" className="input" />
                  </div>
                  <div>
                    <label className="label">Registration Type</label>
                    <select value={form.reg_type} onChange={e => set("reg_type", e.target.value)} className="input">
                      {REG_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(0)} className="btn-secondary flex-1">← Back</button>
                <button onClick={() => setStep(2)} disabled={!canProceedStep2()}
                  className="btn-primary flex-1 justify-center">
                  Next: Review <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Done */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 space-y-5 animate-fade-in">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Ready to go!</h2>
                <p className="text-slate-500 text-sm mt-1">Here's a summary of your setup.</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pharmacy</span>
                  <span className="font-semibold text-slate-800">{form.pharmacy_name || "—"}</span>
                </div>
                {form.pharmacy_phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone</span>
                    <span className="font-semibold text-slate-800">{form.pharmacy_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">GST Status</span>
                  <span className={`font-semibold ${form.gst_choice === "yes" && gstinStatus?.valid ? "text-green-700" : "text-amber-600"}`}>
                    {form.gst_choice === "yes" && gstinStatus?.valid
                      ? `Registered · ${form.state_name}`
                      : form.gst_choice === "no" ? "Unregistered" : "Will add later"}
                  </span>
                </div>
                {form.gst_choice === "yes" && gstinStatus?.valid && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">GSTIN</span>
                    <span className="font-mono text-sm font-semibold text-slate-800">{form.gstin}</span>
                  </div>
                )}
                {form.drug_licence_no && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Drug Licence</span>
                    <span className="font-semibold text-slate-800">{form.drug_licence_no}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 text-center">
                Everything can be updated anytime in <strong>Settings → Business Profile</strong>.
              </p>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                <button onClick={handleFinish} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <><Spinner size="sm" />Saving…</> : <>Open PharmaCare Pro <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
