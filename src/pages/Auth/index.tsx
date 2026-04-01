import{useState,useEffect,useRef}from"react"
import{useNavigate}from"react-router-dom"
import{Eye,EyeOff,Pill,ArrowRight}from"lucide-react"
import{useAuthStore}from"@/store/authStore"

export default function AuthPage(){
  const navigate=useNavigate()
  const{login,isAuthenticated}=useAuthStore()
  const emailRef=useRef<HTMLInputElement>(null)
  const[email,setEmail]=useState("")
  const[password,setPassword]=useState("")
  const[showPwd,setShowPwd]=useState(false)
  const[loading,setLoading]=useState(false)
  const[error,setError]=useState("")

  useEffect(()=>{if(isAuthenticated)navigate("/dashboard",{replace:true})},[isAuthenticated,navigate])
  useEffect(()=>{emailRef.current?.focus()},[])

  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();setError("")
    if(!email.trim()||!password){setError("Please enter your login and password.");return}
    setLoading(true)
    try{await login(email,password);navigate("/dashboard",{replace:true})}
    catch(err:unknown){
      const msg=err instanceof Error?err.message:String(err)
      if(msg.includes("locked"))setError("Account locked. Contact the admin.")
      else if(msg.includes("disabled"))setError("Account disabled. Contact the admin.")
      else setError("Login or password is incorrect.")
    }finally{setLoading(false)}
  }

  return(
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] bg-slate-900 p-12 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><Pill size={20} className="text-white"/></div>
          <div><p className="text-white font-bold text-lg leading-none">PharmaCare Pro</p><p className="text-slate-400 text-sm">Pharmacy Management</p></div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">Modern software<br/>for modern<br/>pharmacies.</h1>
          <p className="text-slate-400 text-base leading-relaxed">Billing, inventory, AI analytics, GST reports — all offline, all fast, on any Windows PC.</p>
        </div>
        <div className="space-y-3">
          {[{l:"Fast Billing & POS",d:true},{l:"Medicine & Batch Management",d:true},{l:"GST Reports + CA Package",d:true},{l:"AI Demand Forecasting",d:true},{l:"Multi-PC LAN Mode",d:true},{l:"Multi-Branch Cloud Sync",d:true}].map(f=>(
            <div key={f.l} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${f.d?"bg-green-500":"bg-slate-700"}`}>
                {f.d&&<svg width="10" height="8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span className={`text-sm ${f.d?"text-slate-300":"text-slate-600"}`}>{f.l}</span>
              {!f.d&&<span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">Soon</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><Pill size={20} className="text-white"/></div>
            <div><p className="font-bold text-lg text-slate-900 leading-none">PharmaCare Pro</p><p className="text-slate-500 text-sm">Pharmacy Management</p></div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-7">Sign in to your pharmacy account</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email or Username</label>
                <input ref={emailRef} type="text" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin" autoComplete="username" className="input"/>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPwd?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" className="input pr-10"/>
                  <button type="button" onClick={()=>setShowPwd(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                    {showPwd?<EyeOff size={16}/>:<Eye size={16}/>}
                  </button>
                </div>
              </div>
              {error&&<div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5 animate-fade-in"><span className="mt-0.5">⚠</span><span>{error}</span></div>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-between">
                <span>{loading?"Signing in...":"Sign in"}</span>
                {loading?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<ArrowRight size={16}/>}
              </button>
            </form>
            <p className="text-center text-xs text-slate-400 mt-5">Default: <strong>admin</strong> / <strong>admin123</strong></p>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">Forgot password? Contact your pharmacy administrator.</p>
        </div>
      </div>
    </div>
  )
}
