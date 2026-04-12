import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { invoke } from "@tauri-apps/api/core"
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, ChevronDown, ChevronRight, Pill, ShieldAlert, Key, LogOut } from "lucide-react"
import toast from "react-hot-toast"
import { Spinner } from "@/components/shared/Spinner"

interface TechFields {
  // Business identity
  pharmacy_name:    string
  pharmacy_address: string
  pharmacy_phone:   string
  pin_code:         string
  drug_licence_no:  string
  // GST
  gstin:            string
  irp_username:     string
  irp_password:     string
  irp_app_key:      string
  ewb_username:     string
  ewb_password:     string
  // Owner account
  owner_name:       string
  owner_email:      string
  owner_password:   string
  owner_password2:  string
}

const EMPTY: TechFields = {
  pharmacy_name:"", pharmacy_address:"", pharmacy_phone:"", pin_code:"", drug_licence_no:"",
  gstin:"", irp_username:"", irp_password:"", irp_app_key:"",
  ewb_username:"", ewb_password:"",
  owner_name:"", owner_email:"", owner_password:"", owner_password2:"",
}

function Section({ title, subtitle, open, onToggle, children }: {
  title: string; subtitle: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
      </button>
      {open && <div className="p-5 space-y-4 bg-white">{children}</div>}
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function TechSetupPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [form, setForm]       = useState<TechFields>(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [loading, setLoading] = useState(true)
  const [showPwds, setShowPwds] = useState<Record<string, boolean>>({})

  // Sections open state
  const [sec, setSec] = useState({ biz: true, gst: false, owner: false, techpwd: false })
  const toggleSec = (k: keyof typeof sec) => setSec(p => ({ ...p, [k]: !p[k] }))

  // Tech change-password state
  const [techPwd, setTechPwd] = useState({ current: "", next: "", next2: "" })
  const [changingPwd, setChangingPwd] = useState(false)

  // Guard: must have come through tech_auth (state.authed)
  const authed = (location.state as Record<string, unknown> | null)?.authed === true
  useEffect(() => {
    if (!authed) { navigate("/login", { replace: true }); return }
    // Pre-fill existing config
    invoke<Record<string, string>>("tech_get_config")
      .then(c => setForm(p => ({ ...p,
        pharmacy_name:    c.pharmacy_name    ?? "",
        pharmacy_address: c.pharmacy_address ?? "",
        pharmacy_phone:   c.pharmacy_phone   ?? "",
        pin_code:         c.pin_code         ?? "",
        drug_licence_no:  c.drug_licence_no  ?? "",
        gstin:            c.gstin            ?? "",
        irp_username:     c.irp_username     ?? "",
        irp_app_key:      c.irp_app_key      ?? "",
        ewb_username:     c.ewb_username     ?? "",
        owner_name:       "",  // never pre-fill credentials
        owner_email:      "",
        owner_password:   "",
        owner_password2:  "",
      })))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authed, navigate])

  const set = (k: keyof TechFields) => (v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"

  const generateAppKey = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    const b64 = btoa(String.fromCharCode(...bytes))
    set("irp_app_key")(b64)
    toast.success("New App Key generated.")
  }

  const handleSave = async () => {
    if (!form.pharmacy_name.trim()) { toast.error("Pharmacy name is required."); return }
    if (form.owner_password && form.owner_password !== form.owner_password2) {
      toast.error("Owner passwords do not match."); return
    }
    if (form.owner_password && form.owner_password.length < 6) {
      toast.error("Owner password must be at least 6 characters."); return
    }

    setSaving(true)
    try {
      const result = await invoke<{ success: boolean; irp_app_key: string }>(
        "tech_setup_save", { fields: form }
      )
      if (result.success) {
        // Update form with the (possibly auto-generated) app key
        setForm(p => ({ ...p, irp_app_key: result.irp_app_key }))
        setSaved(true)
        toast.success("Setup saved. Pharmacy is activated.", { duration: 4000 })
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed.")
    } finally { setSaving(false) }
  }

  const handleChangeTechPwd = async () => {
    if (techPwd.next.length < 8) { toast.error("New password must be 8+ characters."); return }
    if (techPwd.next !== techPwd.next2) { toast.error("Passwords do not match."); return }
    setChangingPwd(true)
    try {
      const ok = await invoke<boolean>("tech_change_password", {
        currentPassword: techPwd.current,
        newPassword: techPwd.next,
      })
      if (ok) {
        toast.success("Tech password updated.")
        setTechPwd({ current: "", next: "", next2: "" })
      } else {
        toast.error("Current password is incorrect.")
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update password.")
    } finally { setChangingPwd(false) }
  }

  const pwdInput = (k: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <div className="relative">
      <input type={showPwds[k] ? "text" : "password"} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${inp} pr-9`}/>
      <button type="button" onClick={() => setShowPwds(p => ({ ...p, [k]: !p[k] }))}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {showPwds[k] ? <EyeOff size={14}/> : <Eye size={14}/>}
      </button>
    </div>
  )

  if (!authed) return null
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <Spinner size="lg"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Pill size={16} className="text-white"/>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">PharmaCare Pro</p>
            <p className="text-slate-400 text-xs mt-0.5">Technician Setup Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1">
            <ShieldAlert size={12} className="text-amber-400"/>
            <span className="text-amber-400 text-xs font-semibold">INTERNAL USE ONLY</span>
          </div>
          <button onClick={() => navigate("/login", { replace: true })}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <LogOut size={13}/>Exit
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <h1 className="text-xl font-bold text-white">Installation Setup</h1>
            <p className="text-slate-400 text-sm mt-1">
              Fill in the required details for this pharmacy. Credentials entered here are saved locally on this machine only.
            </p>
          </div>

          {/* ── Section 1: Business Identity ── */}
          <Section title="1. Business Identity" subtitle="Pharmacy name, address, licence — appears on bills and reports"
            open={sec.biz} onToggle={() => toggleSec("biz")}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Pharmacy / Store Name" required>
                  <input value={form.pharmacy_name} onChange={e => set("pharmacy_name")(e.target.value)}
                    placeholder="e.g. Shree Ram Medical Store" className={inp}/>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Full Address">
                  <input value={form.pharmacy_address} onChange={e => set("pharmacy_address")(e.target.value)}
                    placeholder="Shop no, Street, Area, City" className={inp}/>
                </Field>
              </div>
              <Field label="Phone">
                <input value={form.pharmacy_phone} onChange={e => set("pharmacy_phone")(e.target.value)}
                  placeholder="10-digit mobile" className={inp}/>
              </Field>
              <Field label="PIN Code">
                <input value={form.pin_code} onChange={e => set("pin_code")(e.target.value)}
                  placeholder="421301" className={inp} maxLength={6}/>
              </Field>
              <div className="col-span-2">
                <Field label="Drug Licence Number">
                  <input value={form.drug_licence_no} onChange={e => set("drug_licence_no")(e.target.value)}
                    placeholder="e.g. MH-KL-12345" className={inp}/>
                </Field>
              </div>
            </div>
          </Section>

          {/* ── Section 2: GST & API ── */}
          <Section title="2. GST Registration & API Credentials"
            subtitle="GSTIN enables GST features. IRP + EWB enable E-Invoice and E-Way Bill."
            open={sec.gst} onToggle={() => toggleSec("gst")}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="GSTIN" hint="15-character GST number. Leave blank if the pharmacy is unregistered.">
                  <input value={form.gstin} onChange={e => set("gstin")(e.target.value.toUpperCase())}
                    placeholder="27AAAPA1234A1Z5" className={`${inp} font-mono tracking-widest`} maxLength={15}/>
                </Field>
                {form.gstin.length > 0 && form.gstin.length < 15 && (
                  <p className="text-xs text-amber-500 mt-1">⚠ GSTIN must be exactly 15 characters ({form.gstin.length}/15)</p>
                )}
                {form.gstin.length === 15 && (
                  <p className="text-xs text-green-600 mt-1">✓ GST features will be enabled</p>
                )}
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">IRP Credentials (E-Invoice)</p>
              </div>
              <Field label="IRP Username" hint="Usually your GSTIN">
                <input value={form.irp_username} onChange={e => set("irp_username")(e.target.value)}
                  placeholder="GSTIN or portal username" className={inp}/>
              </Field>
              <Field label="IRP Password">
                {pwdInput("irp_pwd", form.irp_password, set("irp_password"), "IRP portal password")}
              </Field>
              <div className="col-span-2">
                <Field label="IRP App Key (16-byte AES key)"
                  hint="Auto-generated if left blank. Required for encrypting e-invoice API calls.">
                  <div className="flex gap-2">
                    <input value={form.irp_app_key} onChange={e => set("irp_app_key")(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className={`${inp} font-mono text-xs flex-1`}/>
                    <button onClick={generateAppKey} type="button"
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                      <RefreshCw size={12}/>Generate
                    </button>
                  </div>
                </Field>
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">NIC Credentials (E-Way Bill)</p>
              </div>
              <Field label="EWB Username" hint="Usually your GSTIN">
                <input value={form.ewb_username} onChange={e => set("ewb_username")(e.target.value)}
                  placeholder="EWB portal username" className={inp}/>
              </Field>
              <Field label="EWB Password">
                {pwdInput("ewb_pwd", form.ewb_password, set("ewb_password"), "EWB portal password")}
              </Field>
            </div>
          </Section>

          {/* ── Section 3: Owner Account ── */}
          <Section title="3. Owner / Admin Account"
            subtitle="Creates the pharmacy owner's login. Skip if account already exists."
            open={sec.owner} onToggle={() => toggleSec("owner")}>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700 mb-4">
              ⚠ If an admin account already exists, this will <strong>update</strong> that account's credentials.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input value={form.owner_name} onChange={e => set("owner_name")(e.target.value)}
                  placeholder="Pharmacy owner's name" className={inp}/>
              </Field>
              <Field label="Email / Username">
                <input value={form.owner_email} onChange={e => set("owner_email")(e.target.value)}
                  placeholder="admin@pharmacy.com" className={inp}/>
              </Field>
              <Field label="Password" required>
                {pwdInput("own_pwd", form.owner_password, set("owner_password"), "Set login password")}
              </Field>
              <Field label="Confirm Password">
                {pwdInput("own_pwd2", form.owner_password2, set("owner_password2"), "Re-enter password")}
              </Field>
              {form.owner_password && form.owner_password !== form.owner_password2 && (
                <div className="col-span-2">
                  <p className="text-xs text-red-500">Passwords do not match.</p>
                </div>
              )}
            </div>
          </Section>

          {/* ── Section 4: Change Tech Password ── */}
          <Section title="4. Change Technician Password"
            subtitle="Update the password used to access this setup panel."
            open={sec.techpwd} onToggle={() => toggleSec("techpwd")}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Current Tech Password">
                  {pwdInput("tcp_cur", techPwd.current,
                    v => setTechPwd(p => ({ ...p, current: v })), "Current password")}
                </Field>
              </div>
              <Field label="New Password">
                {pwdInput("tcp_new", techPwd.next,
                  v => setTechPwd(p => ({ ...p, next: v })), "8+ characters")}
              </Field>
              <Field label="Confirm New Password">
                {pwdInput("tcp_new2", techPwd.next2,
                  v => setTechPwd(p => ({ ...p, next2: v })), "Re-enter new password")}
              </Field>
            </div>
            <button onClick={handleChangeTechPwd} disabled={changingPwd || !techPwd.current || !techPwd.next}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
              {changingPwd ? <><Spinner size="sm"/>Updating…</> : <><Key size={14}/>Update Tech Password</>}
            </button>
          </Section>

          {/* ── Save button ── */}
          <div className="sticky bottom-0 bg-slate-900 pt-4 pb-2">
            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors
                         bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
              {saving
                ? <><Spinner size="sm"/>Saving…</>
                : saved
                  ? <><CheckCircle size={16}/>Saved — Save Again to Update</>
                  : <><Save size={16}/>Save & Activate Pharmacy</>}
            </button>
            {saved && (
              <button onClick={() => navigate("/login", { replace: true })}
                className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                ← Back to Login Screen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
