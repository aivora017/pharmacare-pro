import { useEffect, useState } from "react"
import { Cloud, RefreshCw, CheckCircle, AlertTriangle, Database } from "lucide-react"
import toast from "react-hot-toast"
import { invoke } from "@tauri-apps/api/core"
import { settingsService } from "@/services/settingsService"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"

type QueueData = { pending_count: number; last_sync: string; queue: { id:number;entity_type:string;entity_id:number;action:string;created_at:string }[] }

export default function SyncPage() {
  const [supabaseUrl, setSupabaseUrl]   = useState("")
  const [supabaseKey, setSupabaseKey]   = useState("")
  const [queue, setQueue]               = useState<QueueData | null>(null)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [syncing, setSyncing]           = useState(false)

  useEffect(() => {
    Promise.all([settingsService.getAll(), invoke<QueueData>("sync_get_queue")])
      .then(([s, q]) => {
        const all = s as Record<string,string>
        const strip = (k: string) => (all[k] ?? "").replace(/^"|"$/g, "")
        setSupabaseUrl(strip("supabase_url"))
        setSupabaseKey(strip("supabase_anon_key"))
        setQueue(q)
      })
      .catch(() => toast.error("Could not load sync status."))
      .finally(() => setLoading(false))
  }, [])

  const saveConfig = async () => {
    setSaving(true)
    try {
      await settingsService.set("supabase_url",      `"${supabaseUrl.trim()}"`)
      await settingsService.set("supabase_anon_key", `"${supabaseKey.trim()}"`)
      toast.success("Supabase credentials saved.")
    } catch { toast.error("Could not save.") }
    finally { setSaving(false) }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await invoke<{ synced_count:number; message:string }>("sync_push_to_supabase")
      toast.success(res.message)
      const q = await invoke<QueueData>("sync_get_queue")
      setQueue(q)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Sync failed.") }
    finally { setSyncing(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg"/></div>

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Cloud Sync" subtitle="Sync your pharmacy data to Supabase for multi-branch access and backup"/>

      {/* Status card */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Cloud size={16}/>Sync Status</h3>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${supabaseUrl?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>
            {supabaseUrl?<><CheckCircle size={12}/>Configured</>:<><AlertTriangle size={12}/>Not configured</>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <p className="text-2xl font-bold text-slate-900">{queue?.pending_count ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">Pending items</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl col-span-2">
            <p className="text-sm font-medium text-slate-700">{queue?.last_sync ?? "Never"}</p>
            <p className="text-xs text-slate-500 mt-1">Last successful sync</p>
          </div>
        </div>
        <button onClick={syncNow} disabled={syncing || !supabaseUrl} className="btn-primary w-full justify-center mt-4 py-3">
          {syncing ? <><Spinner size="sm"/>Syncing…</> : <><RefreshCw size={15}/>Sync Now ({queue?.pending_count ?? 0} pending)</>}
        </button>
      </div>

      {/* Configuration */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Database size={16}/>Supabase Configuration</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">How to get your Supabase credentials</p>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>Go to <strong>supabase.com</strong> and create a free project</li>
            <li>Go to Settings → API in your Supabase dashboard</li>
            <li>Copy your Project URL and anon public key</li>
          </ol>
        </div>
        <div>
          <label className="label">Supabase Project URL</label>
          <input value={supabaseUrl} onChange={e=>setSupabaseUrl(e.target.value)}
            placeholder="https://xxxxxxxxxxxx.supabase.co" className="input font-mono text-sm"/>
        </div>
        <div>
          <label className="label">Supabase Anon Key</label>
          <input type="password" value={supabaseKey} onChange={e=>setSupabaseKey(e.target.value)}
            placeholder="eyJhbGciOiJ…" className="input font-mono text-sm"/>
        </div>
        <button onClick={saveConfig} disabled={saving} className="btn-primary">
          {saving ? <><Spinner size="sm"/>Saving…</> : "Save Configuration"}
        </button>
      </div>

      {/* Pending queue */}
      {queue && queue.queue.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-200"><h3 className="font-semibold text-slate-800">Pending Sync Queue</h3></div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {queue.queue.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="badge-blue capitalize">{item.entity_type}</span>
                <span className="text-slate-600 font-mono text-xs">#{item.entity_id}</span>
                <span className="badge-amber capitalize">{item.action}</span>
                <span className="text-xs text-slate-400">{item.created_at.slice(0,10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
