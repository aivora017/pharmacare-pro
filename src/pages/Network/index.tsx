import { useEffect, useState } from "react"
import { Wifi, Server, Monitor, CheckCircle, AlertCircle, Copy, Globe } from "lucide-react"
import toast from "react-hot-toast"
import { invoke } from "@tauri-apps/api/core"
import { setTransportMode, type NetworkMode } from "@/utils/transport"
import { settingsService } from "@/services/settingsService"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"

type NetworkStatus = {
  local_ip: string; lan_port: number; server_enabled: boolean
  server_url: string; network_mode: string; server_address: string
}

export default function NetworkPage() {
  const [status, setStatus]     = useState<NetworkStatus | null>(null)
  const [loading, setLoading]   = useState(true)
  const [starting, setStarting] = useState(false)
  const [mode, setMode]         = useState<NetworkMode>("standalone")
  const [serverUrl, setServerUrl] = useState("")
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await invoke<NetworkStatus>("network_get_status")
      setStatus(s)
      setMode(s.network_mode as NetworkMode)
      setServerUrl(s.server_url)
    } catch { toast.error("Could not get network status.") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const startServer = async () => {
    setStarting(true)
    try {
      const addr = await invoke<string>("network_start_server")
      await settingsService.set("lan_server_enabled", '"true"')
      await settingsService.set("network_mode", '"server"')
      setMode("server")
      toast.success(`LAN Server started on ${addr}`)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Could not start server.") }
    finally { setStarting(false) }
  }

  const stopServer = async () => {
    await invoke("network_stop_server")
    await settingsService.set("network_mode", '"standalone"')
    setMode("standalone")
    toast.success("Server stopped.")
    load()
  }

  const saveClientSettings = async () => {
    if (!serverUrl.trim()) { toast.error("Enter server URL."); return }
    await settingsService.set("lan_server_url", `"${serverUrl.trim()}"`)
    await settingsService.set("network_mode", '"client"')
    setTransportMode("client", serverUrl.trim())
    setMode("client")
    toast.success("Client mode saved. App will connect to server for billing.")
  }

  const testConnection = async () => {
    if (!serverUrl.trim()) { toast.error("Enter server URL first."); return }
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch(`${serverUrl}/api/health`)
      const data = await res.json()
      setTestResult(`✓ Connected to ${data.app ?? "PharmaCare Pro"}`)
    } catch { setTestResult("✗ Could not connect. Check IP and that server is running.") }
    finally { setTesting(false) }
  }

  const copyAddress = () => {
    if (!status) return
    const url = `http://${status.server_address}`
    navigator.clipboard.writeText(url)
    toast.success("Server URL copied!")
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg"/></div>

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Multi-PC Network" subtitle="Connect multiple computers to share one pharmacy database"/>

      {/* Mode selector */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Select This Computer's Role</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id:"standalone", label:"Standalone", sub:"Single PC setup", icon:Monitor },
            { id:"server",     label:"Server PC",  sub:"Has the database, others connect here", icon:Server },
            { id:"client",     label:"Client PC",  sub:"Connects to Server PC over LAN", icon:Wifi },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id as NetworkMode)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${mode===m.id?"border-blue-600 bg-blue-50":"border-slate-200 hover:border-slate-300"}`}>
              <m.icon size={22} className={mode===m.id?"text-blue-600":"text-slate-400"}/>
              <p className={`text-sm font-semibold ${mode===m.id?"text-blue-700":"text-slate-700"}`}>{m.label}</p>
              <p className="text-xs text-slate-400 text-center leading-tight">{m.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Server mode panel */}
      {mode === "server" && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Server size={16}/>Server PC Configuration</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">This PC will host the pharmacy database.</p>
            <p className="text-xs text-blue-700">Other PCs connect to <strong>http://{status?.local_ip}:{status?.lan_port}</strong> to use the database.</p>
            <p className="text-xs text-blue-600 mt-1">Keep this PC ON during pharmacy hours. All other PCs will stop working if this PC is off.</p>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="flex-1">
              <p className="text-xs text-slate-500">Server Address</p>
              <p className="font-bold text-slate-900 font-mono">http://{status?.local_ip}:{status?.lan_port}</p>
            </div>
            <button onClick={copyAddress} className="btn-ghost text-xs"><Copy size={13}/>Copy</button>
          </div>
          {!status?.server_enabled ? (
            <button onClick={startServer} disabled={starting} className="btn-primary w-full justify-center py-3">
              {starting ? <><Spinner size="sm"/>Starting server…</> : <><Server size={16}/>Start LAN Server</>}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle size={16} className="flex-shrink-0"/>
                <span className="text-sm font-medium">LAN Server is running on port {status.lan_port}</span>
              </div>
              <button onClick={stopServer} className="btn-danger w-full justify-center text-sm py-2.5">Stop Server</button>
            </div>
          )}
        </div>
      )}

      {/* Client mode panel */}
      {mode === "client" && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Wifi size={16}/>Client PC Configuration</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">This PC connects to the Server PC.</p>
            <p className="text-xs text-amber-700">Ask the pharmacist at the Server PC to share their server address (copy button on that PC).</p>
          </div>
          <div>
            <label className="label">Server PC Address</label>
            <input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.5:4200" className="input font-mono"/>
            <p className="text-xs text-slate-400 mt-1">Enter the full URL shown on the Server PC</p>
          </div>
          <div className="flex gap-3">
            <button onClick={testConnection} disabled={testing} className="btn-secondary flex-1">
              {testing ? <><Spinner size="sm"/>Testing…</> : "Test Connection"}
            </button>
            <button onClick={saveClientSettings} className="btn-primary flex-1">Save & Connect</button>
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${testResult.startsWith("✓")?"bg-green-50 text-green-700 border border-green-200":"bg-red-50 text-red-700 border border-red-200"}`}>
              {testResult.startsWith("✓")?<CheckCircle size={14}/>:<AlertCircle size={14}/>}
              {testResult}
            </div>
          )}
        </div>
      )}

      {/* Standalone mode */}
      {mode === "standalone" && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Monitor size={16}/>Standalone Mode</h3>
          <p className="text-sm text-slate-500 mb-4">Running as a single PC. All data stays on this computer. No network required.</p>
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0"/>
            <p className="text-sm text-green-800">Standalone mode active. Your data is local and secure.</p>
          </div>
          <button onClick={() => settingsService.set("network_mode", '"standalone"').then(load)} className="btn-secondary mt-3 text-sm">Confirm Standalone Mode</button>
        </div>
      )}

      {/* How it works */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Globe size={16}/>How Multi-PC LAN Works</h3>
        <div className="space-y-3 text-sm text-slate-600">
          {[
            ["1. Install on all PCs", "Install PharmaCare Pro on every billing PC. Each gets its own app."],
            ["2. Pick the Server PC", "Choose one PC as the server — usually the owner's PC or the most reliable one."],
            ["3. Start the server", "On the Server PC, go to Network → Server PC → Start LAN Server."],
            ["4. Connect clients", "On each Client PC, go to Network → Client PC, enter the Server address, and click Save."],
            ["5. All PCs share data", "Every PC now bills from the same database — same stock, same customers, same reports."],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-3">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-blue-600 rounded-full"/>
              </div>
              <div><p className="font-medium text-slate-700">{title}</p><p className="text-xs text-slate-500 mt-0.5">{desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
