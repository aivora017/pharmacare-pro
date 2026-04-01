import { useEffect, useState } from "react"
import { Plus, Edit, X, Users, ShieldCheck } from "lucide-react"
import toast from "react-hot-toast"
import { authService } from "@/services/authService"
import { settingsService } from "@/services/settingsService"
import { useAuthStore } from "@/store/authStore"
import { formatDateTime } from "@/utils/date"
import { Spinner } from "@/components/shared/Spinner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"

type UserRow = { id:number; name:string; email:string; role_id:number; role_name:string; is_active:boolean; last_login_at?:string }
type Role    = { id:number; name:string }

export function UserManagement({ adminId }: { adminId: number }) {
  const [users,   setUsers]   = useState<UserRow[]>([])
  const [roles,   setRoles]   = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editUser,    setEditUser]    = useState<UserRow | null>(null)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [resetting,   setResetting]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [u, r] = await Promise.all([authService.listUsers(), settingsService.getRoles()])
      setUsers(u as UserRow[])
      setRoles(r as Role[])
    } catch { toast.error("Could not load users.") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters."); return
    }
    setResetting(true)
    try {
      await authService.resetPassword(resetTarget.id, newPassword, adminId)
      toast.success(`Password reset for ${resetTarget.name}.`)
      setResetTarget(null); setNewPassword("")
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setResetting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">User Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage staff accounts and permissions</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowForm(true) }} className="btn-primary text-sm">
          <Plus size={15}/>Add User
        </button>
      </div>

      {loading ? <div className="flex justify-center py-8"><Spinner/></div>
      : users.length === 0 ? <EmptyState icon={<Users size={40}/>} title="No users found"/>
      : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Login</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Last Login</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-700">{u.name[0]?.toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={u.role_id===1?"badge-red":"badge-blue"}>{u.role_name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</td>
                  <td className="px-4 py-3 text-center"><span className={u.is_active?"badge-green":"badge-slate"}>{u.is_active?"Active":"Inactive"}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditUser(u); setShowForm(true) }} className="text-xs text-blue-600 hover:underline">Edit</button>
                      {u.id !== adminId && (
                        <button onClick={() => { setResetTarget(u); setNewPassword("") }} className="text-xs text-amber-600 hover:underline">Reset Pwd</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <UserForm user={editUser} roles={roles} adminId={adminId} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);load()}}/>}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
            <h3 className="font-bold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-sm text-slate-500 mb-4">Set new password for <strong>{resetTarget.name}</strong></p>
            <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoFocus
              placeholder="New password (min 8 chars)" className="input mb-4"/>
            <div className="flex gap-3">
              <button onClick={() => { setResetTarget(null); setNewPassword("") }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleResetPassword} disabled={resetting} className="btn-primary flex-1">
                {resetting?<><Spinner size="sm"/>Resetting…</>:"Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UserForm({ user, roles, adminId, onClose, onSaved }: { user:UserRow|null; roles:Role[]; adminId:number; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({
    name: user?.name ?? "", email: user?.email ?? "",
    password: "", role_id: String(user?.role_id ?? 2),
    is_active: user?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const f=(k:string)=>(v:string|boolean)=>setForm(p=>({...p,[k]:v}))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Name required."); return }
    if (!user && form.password.length < 8) { toast.error("Password must be at least 8 characters."); return }
    setSaving(true)
    try {
      if (user) {
        await authService.updateUser(user.id, form.name, parseInt(form.role_id), form.is_active)
      } else {
        await authService.createUser(form.name, form.email, form.password, parseInt(form.role_id))
      }
      toast.success(user ? "User updated." : "User created.")
      onSaved()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold">{user?"Edit User":"Add User"}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="label">Full Name <span className="text-red-500">*</span></label><input value={form.name} onChange={e=>f("name")(e.target.value)} className="input" autoFocus/></div>
          {!user && <div><label className="label">Login (email or username) <span className="text-red-500">*</span></label><input value={form.email} onChange={e=>f("email")(e.target.value)} placeholder="e.g. cashier1" className="input"/></div>}
          {!user && <div><label className="label">Password <span className="text-red-500">*</span></label><input type="password" value={form.password} onChange={e=>f("password")(e.target.value)} placeholder="Min 8 characters" className="input"/></div>}
          <div>
            <label className="label">Role</label>
            <select value={form.role_id} onChange={e=>f("role_id")(e.target.value)} className="input" disabled={user?.id===adminId}>
              {roles.map(r=><option key={r.id} value={String(r.id)} disabled={r.id===1&&user?.id!==adminId}>{r.name}</option>)}
            </select>
            {user?.id===adminId && <p className="text-xs text-slate-400 mt-1">Your own role cannot be changed.</p>}
          </div>
          {user && user.id !== adminId && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ua" checked={form.is_active} onChange={e=>f("is_active")(e.target.checked)} className="w-4 h-4 accent-blue-600"/>
              <label htmlFor="ua" className="text-sm">Account active</label>
            </div>
          )}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving?<><Spinner size="sm"/>{user?"Updating…":"Creating…"}</>:user?"Update User":"Create User"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
