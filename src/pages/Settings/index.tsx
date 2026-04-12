import { invoke } from "@tauri-apps/api/core"
import { useEffect, useState } from "react"
import { Save, Printer, Building2, User, Key, Download, Users, Wifi as WifiIcon, RefreshCw as CloudIcon, ShieldCheck as ShieldIcon, FileJson, CheckCircle, AlertCircle, Loader2, MessageSquare, Send } from "lucide-react"
import toast from "react-hot-toast"
import { settingsService } from "@/services/settingsService"
import { backupService } from "@/services/backupService"
import { UserManagement } from "./UserManagement"
import { printerService } from "@/services/printerService"
import { useAuthStore } from "@/store/authStore"
import { useSettingsStore } from "@/store/settingsStore"
import { GstComplianceTab } from "./GstComplianceTab"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"

type SettingsData = Record<string, string>

function BackupPanel() {
  const [backups, setBackups] = useState<{file_name:string;file_path:string;size_bytes:number;modified_at:number}[]>([])
  const [loading, setLoading]   = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    backupService.list().then(b => setBackups(b as typeof backups)).catch(() => {})
  }, [])

  const create = async () => {
    setCreating(true)
    try {
      const path = await backupService.create()
      toast.success("Backup created: " + path.split(/[\/]/).pop())
      const updated = await backupService.list()
      setBackups(updated as typeof backups)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Backup failed.") }
    finally { setCreating(false) }
  }

  const restore = async (path: string) => {
    if (!window.confirm("Restore this backup? Current data will be replaced.")) return
    setRestoring(true)
    try {
      await backupService.restore(path)
      toast.success("Backup restored. Please restart the app.")
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Restore failed.") }
    finally { setRestoring(false) }
  }

  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-semibold text-slate-800">Backup & Restore</h2>
      <p className="text-sm text-slate-500 -mt-3">Create regular backups to protect your pharmacy data.</p>
      <button onClick={create} disabled={creating} className="btn-primary">
        {creating ? <><Spinner size="sm"/>Creating…</> : <><Download size={16}/>Create Backup Now</>}
      </button>
      {backups.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Saved Backups</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {backups.map(b => (
              <div key={b.file_path} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-800">{b.file_name}</p>
                  <p className="text-xs text-slate-400">{(b.size_bytes/1024).toFixed(0)} KB · {new Date(b.modified_at*1000).toLocaleString("en-IN")}</p>
                </div>
                <button onClick={() => restore(b.file_path)} disabled={restoring} className="text-xs text-blue-600 hover:underline">Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LicensePanel() {
  const [licStatus, setLicStatus] = useState<{status:string;is_active:boolean;trial_days_remaining:number;license_key?:string;plan:string;expires_message:string}|null>(null)
  const [licKey, setLicKey]   = useState("")
  const [activating, setAct]  = useState(false)

  useEffect(() => {
    invoke<typeof licStatus>("license_get_status").then(setLicStatus).catch(()=>{})
  }, [])

  const activate = async () => {
    if (!licKey.trim()) { toast.error("Enter a license key."); return }
    setAct(true)
    try {
      const res = await invoke<{status:string;message:string}>("license_activate", { licenseKey: licKey.trim() })
      toast.success(res.message)
      const s = await invoke<typeof licStatus>("license_get_status")
      setLicStatus(s)
      setLicKey("")
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Activation failed.") }
    finally { setAct(false) }
  }

  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-semibold text-slate-800">License</h2>
      {licStatus && (
        <div className={`p-4 rounded-xl border ${licStatus.status==="active"?"bg-green-50 border-green-200":"licStatus.trial_days_remaining>0"?"bg-blue-50 border-blue-200":"bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${licStatus.status==="active"?"bg-green-100":"bg-blue-100"}`}>
              <span className="text-lg">{licStatus.status==="active"?"✓":"⏱"}</span>
            </div>
            <div>
              <p className={`font-bold text-lg ${licStatus.status==="active"?"text-green-800":"text-blue-800"}`}>{licStatus.plan}</p>
              <p className={`text-sm ${licStatus.status==="active"?"text-green-700":"text-blue-700"}`}>{licStatus.expires_message}</p>
            </div>
          </div>
        </div>
      )}
      {licStatus?.status !== "active" && (
        <div className="space-y-3">
          <div>
            <label className="label">Enter License Key</label>
            <input value={licKey} onChange={e=>setLicKey(e.target.value.toUpperCase())}
              placeholder="PPRO-XXXX-XXXX-XXXX" className="input font-mono tracking-widest"/>
            <p className="text-xs text-slate-400 mt-1">Purchase at pharmacarepro.in · Price: ₹4,999–₹24,999/yr</p>
          </div>
          <button onClick={activate} disabled={activating} className="btn-primary w-full justify-center">
            {activating?<><Spinner size="sm"/>Activating…</>:"Activate License"}
          </button>
        </div>
      )}
      <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
        <p className="font-semibold text-slate-700">What you get with a license:</p>
        {["Unlimited bills per month","Multi-PC LAN mode","Cloud sync for multiple branches","Priority support via WhatsApp","Free updates for 1 year","AI features (with Claude API key)"].map(f=>(
          <div key={f} className="flex items-center gap-2 text-slate-600"><span className="text-green-500">✓</span>{f}</div>
        ))}
      </div>
    </div>
  )
}

const REG_TYPES = ["Regular", "Composite", "SEZ", "Casual Taxable Person", "Unregistered"]

export default function SettingsPage() {
  const { user } = useAuthStore()
  const uid = user?.id ?? 1
  const { setGstEnabled } = useSettingsStore()
  const [settings, setSettings] = useState<SettingsData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingPrint, setTestingPrint] = useState(false)
  const [activeTab, setActiveTab] = useState("pharmacy")
  // GSTIN verify state
  const [verifying, setVerifying] = useState(false)
  const [gstinStatus, setGstinStatus] = useState<{ valid: boolean; message: string } | null>(null)

  useEffect(() => {
    settingsService.getAll().then(s => { setSettings(s as SettingsData); setLoading(false) })
      .catch(() => { toast.error("Could not load settings."); setLoading(false) })
  }, [])

  const get = (key: string) => {
    const val = settings[key] ?? ""
    return val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1) : val
  }

  const set = (key: string, val: string) => setSettings(p => ({ ...p, [key]: `"${val}"` }))

  const saveSettings = async (keys: string[]) => {
    setSaving(true)
    try {
      await Promise.all(keys.map(k => settingsService.set(k, settings[k] ?? '""', uid)))
      toast.success("Settings saved.")
    } catch { toast.error("Could not save settings.") }
    finally { setSaving(false) }
  }

  const testPrint = async () => {
    const printer = get("thermal_printer")
    if (!printer) { toast.error("Enter a printer name first."); return }
    setTestingPrint(true)
    try { await printerService.test(printer); toast.success("Test receipt sent!") }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Print test failed.") }
    finally { setTestingPrint(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const TABS = [
    { id: "pharmacy", label: "Pharmacy Info", icon: Building2 },
    { id: "printer",  label: "Printer",       icon: Printer  },
    { id: "api",      label: "API Keys",       icon: Key      },
    { id: "backup",   label: "Backup",          icon: Download },
  { id: "users",    label: "Users",           icon: Users    },
  { id: "network",  label: "LAN Mode",         icon: WifiIcon },
  { id: "sync",     label: "Cloud Sync",       icon: CloudIcon},
  { id: "license",       label: "License",          icon: ShieldIcon },
  { id: "gst_compliance", label: "GST Compliance",  icon: FileJson      },
  { id: "sms",            label: "SMS",             icon: MessageSquare },
  { id: "account",        label: "My Account",       icon: User         },
  ]

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle="Configure your pharmacy details and system preferences" />

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "pharmacy" && (
        <div className="space-y-4">
          {/* Basic info */}
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-slate-800">Business Profile</h2>
              <p className="text-sm text-slate-500 mt-0.5">Appears on receipts, reports, and GST documents.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Pharmacy / Store Name <span className="text-red-500">*</span></label>
                <input value={get("pharmacy_name")} onChange={e => set("pharmacy_name", e.target.value)}
                  placeholder="e.g. Jagannath Medical Store" className="input" />
              </div>
              <div>
                <label className="label">Full Address</label>
                <input value={get("pharmacy_address")} onChange={e => set("pharmacy_address", e.target.value)}
                  placeholder="Shop no, Street, Area, City" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Phone</label>
                  <input value={get("pharmacy_phone")} onChange={e => set("pharmacy_phone", e.target.value)}
                    placeholder="10-digit mobile" className="input" />
                </div>
                <div>
                  <label className="label">PIN Code</label>
                  <input value={get("pin_code")} onChange={e => set("pin_code", e.target.value)}
                    placeholder="421301" className="input" maxLength={6} />
                </div>
              </div>
              <div>
                <label className="label">Drug Licence Number</label>
                <input value={get("drug_licence_no")} onChange={e => set("drug_licence_no", e.target.value)}
                  placeholder="e.g. MH-KL-12345" className="input" />
              </div>
            </div>
            <button onClick={() => saveSettings(["pharmacy_name","pharmacy_address","pharmacy_phone","pin_code","drug_licence_no"])}
              disabled={saving} className="btn-primary">
              {saving ? <><Spinner size="sm" />Saving…</> : <><Save size={16} />Save</>}
            </button>
          </div>

          {/* GST section */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">GST Registration</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {get("gst_enabled") === "true"
                    ? "GST features are active."
                    : "Add your GSTIN to unlock GST billing, GSTR filing, and E-Invoice."}
                </p>
              </div>
              {get("gst_enabled") === "true" && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-green-100 text-green-700 rounded-full">
                  <CheckCircle size={12} /> GST Active
                </span>
              )}
            </div>

            {/* GSTIN input + verify */}
            <div>
              <label className="label">GSTIN</label>
              <div className="flex gap-2">
                <input
                  value={get("gstin")}
                  onChange={e => {
                    set("gstin", e.target.value.toUpperCase())
                    setGstinStatus(null)
                  }}
                  placeholder="27AAAAA0000A1Z5"
                  className="input font-mono flex-1"
                  maxLength={15}
                />
                <button
                  onClick={async () => {
                    const gstin = get("gstin")
                    if (gstin.length < 15) { toast.error("Enter complete 15-character GSTIN."); return }
                    setVerifying(true); setGstinStatus(null)
                    try {
                      const res = await invoke<{ valid: boolean; state_code: string; state_name: string; message: string }>(
                        "gstin_verify", { gstin }
                      )
                      setGstinStatus({ valid: res.valid, message: res.message })
                      if (res.valid) {
                        set("state_code", res.state_code)
                        set("state_name", res.state_name)
                        toast.success(`GSTIN valid · ${res.state_name}`)
                      }
                    } catch { setGstinStatus({ valid: false, message: "Verification failed." }) }
                    finally { setVerifying(false) }
                  }}
                  disabled={verifying || get("gstin").length < 15}
                  className="btn-secondary px-4 flex-shrink-0">
                  {verifying ? <Loader2 size={14} className="animate-spin" /> : <ShieldIcon size={14} />}
                  {verifying ? "Checking…" : "Verify"}
                </button>
              </div>
              {gstinStatus && (
                <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg
                  ${gstinStatus.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {gstinStatus.valid ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {gstinStatus.message}
                </div>
              )}
              {get("state_name") && (
                <p className="text-xs text-slate-500 mt-1">
                  State: <strong>{get("state_name")}</strong>
                  {get("state_code") && <span className="text-slate-400"> · Code {get("state_code")}</span>}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Leave blank if unregistered. You can add GSTIN at any time — GST features activate automatically.
              </p>
            </div>

            {/* GST-specific fields — shown only when GSTIN is present */}
            {get("gstin").length === 15 && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="label">Legal Name <span className="text-slate-400 font-normal text-xs">(as per GST certificate)</span></label>
                  <input value={get("legal_name")} onChange={e => set("legal_name", e.target.value)}
                    placeholder="Registered business / proprietor name" className="input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Trade Name <span className="text-slate-400 font-normal text-xs">(optional)</span></label>
                    <input value={get("trade_name")} onChange={e => set("trade_name", e.target.value)}
                      placeholder="Common name if different" className="input" />
                  </div>
                  <div>
                    <label className="label">Registration Type</label>
                    <select value={get("reg_type") || "Regular"} onChange={e => set("reg_type", e.target.value)} className="input">
                      {REG_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                const gstin = get("gstin")
                const gstEnabled = gstin.length === 15
                set("gst_enabled", gstEnabled ? "true" : "false")
                await saveSettings([
                  "gstin","legal_name","trade_name","state_code","state_name","reg_type","gst_enabled"
                ])
                setGstEnabled(gstEnabled)
              }}
              disabled={saving}
              className="btn-primary">
              {saving ? <><Spinner size="sm" />Saving…</> : <><Save size={16} />Save GST Settings</>}
            </button>
          </div>
        </div>
      )}

      {activeTab === "printer" && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-slate-800">Printer Configuration</h2>
          <p className="text-sm text-slate-500 -mt-3">Configure your thermal printer for automatic receipt printing.</p>
          <div className="space-y-4">
            <div>
              <label className="label">Thermal Printer Name</label>
              <input value={get("thermal_printer")} onChange={e => set("thermal_printer", e.target.value)}
                placeholder="e.g. POS-80 or \\\\Server\\Printer" className="input font-mono" />
              <p className="text-xs text-slate-400 mt-1">Windows: Use the printer name from Control Panel → Devices and Printers. Linux: Use the CUPS printer name (e.g. <code>POS80</code>).</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">How to find your printer name</p>
              <p className="text-xs text-blue-700">On Windows: Press Win+R, type <code>control printers</code>, press Enter. Right-click your thermal printer and copy its name exactly.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => saveSettings(["thermal_printer"])} disabled={saving} className="btn-primary">
              {saving ? <><Spinner size="sm" />Saving…</> : <><Save size={16} />Save</>}
            </button>
            <button onClick={testPrint} disabled={testingPrint} className="btn-secondary">
              {testingPrint ? <><Spinner size="sm" />Printing…</> : <><Printer size={16} />Test Print</>}
            </button>
          </div>
        </div>
      )}

      {activeTab === "api" && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-slate-800">API Keys</h2>
          <p className="text-sm text-slate-500 -mt-3">Optional — required only for AI assistant and WhatsApp features.</p>
          <div className="space-y-4">
            <div>
              <label className="label">Claude API Key</label>
              <input type="password" value={get("claude_api_key")} onChange={e => set("claude_api_key", e.target.value)}
                placeholder="sk-ant-api03-…" className="input font-mono" />
              <p className="text-xs text-slate-400 mt-1">Get from console.anthropic.com. Required for Ask PharmaCare AI feature.</p>
            </div>
            <div>
              <label className="label">WhatsApp Business Token</label>
              <input type="password" value={get("whatsapp_token")} onChange={e => set("whatsapp_token", e.target.value)}
                placeholder="Bearer token from Meta Business Suite" className="input font-mono" />
            </div>
          </div>
          <button onClick={() => saveSettings(["claude_api_key","whatsapp_token"])} disabled={saving} className="btn-primary">
            {saving ? <><Spinner size="sm" />Saving…</> : <><Save size={16} />Save API Keys</>}
          </button>
        </div>
      )}


      {activeTab === "network" && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Multi-PC LAN Setup</h2>
          <p className="text-sm text-slate-500 -mt-3">Configure this PC's role in your pharmacy network.</p>
          <button onClick={() => window.location.hash = "#/network"} className="btn-primary text-sm">
            Open Network Configuration →
          </button>
        </div>
      )}

      {activeTab === "sync" && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Cloud Sync (Supabase)</h2>
          <p className="text-sm text-slate-500 -mt-3">Sync your pharmacy data to the cloud for multi-branch access.</p>
          <button onClick={() => window.location.hash = "#/sync"} className="btn-primary text-sm">
            Open Cloud Sync Setup →
          </button>
        </div>
      )}

      {activeTab === "license" && <LicensePanel />}
      {activeTab === "gst_compliance" && <GstComplianceTab />}

      {activeTab === "sms" && <SmsSettingsTab />}

      {activeTab === "users" && (
        <UserManagement adminId={uid} />
      )}

      {activeTab === "backup" && (
        <BackupPanel />
      )}
      {activeTab === "account" && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-slate-800">My Account</h2>
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-white">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="font-semibold text-slate-900">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email} · <span className="capitalize">{user?.role_name}</span></p>
            </div>
          </div>
          <p className="text-sm text-slate-500">To change your password or update your profile, contact your system administrator.</p>
        </div>
      )}
    </div>
  )
}

function SmsSettingsTab() {
  const { user } = useAuthStore()
  const uid = user?.id ?? 1

  const [apiKey,   setApiKey]   = useState("")
  const [senderId, setSenderId] = useState("")
  const [enabled,  setEnabled]  = useState(false)
  const [testPhone,setTestPhone] = useState("")
  const [testMsg,  setTestMsg]  = useState("Hello from PharmaCare Pro! This is a test SMS.")
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [testing,  setTesting]  = useState(false)

  useEffect(() => {
    invoke<{ sms_api_key: string; sms_sender_id: string; sms_enabled: boolean }>("sms_settings_get")
      .then(r => {
        setApiKey(r.sms_api_key ?? "")
        setSenderId(r.sms_sender_id ?? "")
        setEnabled(r.sms_enabled ?? false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await invoke("sms_settings_save", { apiKey, senderId, enabled, userId: uid })
      toast.success("SMS settings saved.")
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Could not save.") }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    if (!testPhone.trim()) { toast.error("Enter a phone number for test."); return }
    setTesting(true)
    try {
      await invoke("sms_send", { phone: testPhone, message: testMsg })
      toast.success("Test SMS sent! Check your phone.")
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "SMS failed.") }
    finally { setTesting(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><Spinner size="lg"/></div>

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><MessageSquare size={16}/>SMS Configuration</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            PharmaCare Pro uses <a href="https://www.fast2sms.com" target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2">Fast2SMS</a> for sending SMS.
            Create a free account and paste your API key below.
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-800">Enable SMS</p>
            <p className="text-xs text-slate-500 mt-0.5">Turn on to allow sending due-reminders, bill summaries and alerts.</p>
          </div>
          <button onClick={() => setEnabled(v => !v)}
            className={`w-12 h-6 rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-slate-300"} relative`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-0.5"}`}/>
          </button>
        </div>

        <div>
          <label className="label">Fast2SMS API Key</label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your Fast2SMS API key here" className="input font-mono text-sm" />
          <p className="text-xs text-slate-400 mt-1">Get it from: Fast2SMS → Dev API → API Key</p>
        </div>

        <div>
          <label className="label">Sender ID <span className="text-slate-400 text-xs font-normal">(optional)</span></label>
          <input value={senderId} onChange={e => setSenderId(e.target.value)}
            placeholder="e.g. PHARMA" className="input" maxLength={11} />
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <><Spinner size="sm"/>Saving…</> : <><Save size={15}/>Save SMS Settings</>}
        </button>
      </div>

      {/* Test SMS */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Send size={15}/>Send Test SMS</h3>
        <div>
          <label className="label">Test Mobile Number</label>
          <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
            placeholder="10-digit mobile" className="input" maxLength={13} />
        </div>
        <div>
          <label className="label">Test Message</label>
          <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)}
            rows={2} className="input resize-none text-sm"/>
        </div>
        <button onClick={handleTest} disabled={testing || !enabled}
          className="btn-secondary disabled:opacity-50">
          {testing ? <><Spinner size="sm"/>Sending…</> : <><Send size={14}/>Send Test SMS</>}
        </button>
        {!enabled && <p className="text-xs text-amber-600">⚠ Enable SMS above before testing.</p>}
      </div>
    </div>
  )
}
