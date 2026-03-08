/**
 * Login Page — first screen. Large inputs, friendly errors, no jargon.
 * SECURITY: Never store password locally. Account lock message after 5 failed attempts.
 */
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, Pill, LogIn } from "lucide-react"
import toast from "react-hot-toast"
import { useAuthStore } from "@/store/authStore"

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuthStore()
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false); const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (isAuthenticated) navigate("/dashboard", { replace: true }) }, [isAuthenticated, navigate])
  useEffect(() => { emailRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("")
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return }
    setLoading(true)
    try { await login(email, password); toast.success("Welcome back!"); navigate("/dashboard", { replace: true }) }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("locked"))        setError("Account is locked. Please contact the admin.")
      else if (msg.includes("disabled")) setError("Account is disabled. Please contact the admin.")
      else                               setError("Email or password is incorrect. Please try again.")
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <Pill size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">PharmaCare Pro</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="yourname@pharmacy.com" autoComplete="email"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm min-h-touch">
              {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</>
                       : <><LogIn size={17} />Sign In</>}
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-4">Forgot your password? Contact your pharmacy administrator.</p>
        </div>
      </div>
    </div>
  )
}
