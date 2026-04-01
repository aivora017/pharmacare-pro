import{NavLink}from"react-router-dom"
import{LayoutDashboard,ShoppingCart,Pill,Package,Users,Stethoscope,Truck,AlertTriangle,Barcode,BarChart3,Bot,Settings,ChevronLeft,ChevronRight,LogOut,ClipboardList,Receipt,Wifi,RefreshCw as Cloud,FileJson,ShieldCheck}from"lucide-react"
import{useState}from"react"
import{useAuthStore}from"@/store/authStore"
import{cn}from"@/utils/cn"

const NAV=[
  {section:"Daily Work",items:[{label:"Dashboard",icon:LayoutDashboard,path:"/dashboard"},{label:"New Bill",icon:ShoppingCart,path:"/billing",shortcut:"F2"},{label:"Bill History",icon:Receipt,path:"/bills"}]},
  {section:"Stock",items:[{label:"Medicines",icon:Pill,path:"/medicine"},{label:"Purchase",icon:Package,path:"/purchase"},{label:"Suppliers",icon:Truck,path:"/suppliers"},{label:"Expiry Check",icon:AlertTriangle,path:"/expiry"},{label:"Stock Adjust",icon:ClipboardList,path:"/stock-adjust"},{label:"Barcodes",icon:Barcode,path:"/barcodes"}]},
  {section:"People",items:[{label:"Customers",icon:Users,path:"/customers"},{label:"Doctors",icon:Stethoscope,path:"/doctors"}]},
  {section:"Insights",items:[{label:"Reports",icon:BarChart3,path:"/reports"},{label:"AI Assistant",icon:Bot,path:"/ai"}]},
  {section:"Compliance",items:[{label:"GST Filing",icon:FileJson,path:"/gst-compliance"},{label:"Compliance",icon:ShieldCheck,path:"/compliance"}]},
  {section:"System",items:[{label:"Multi-PC LAN",icon:Wifi,path:"/network"},{label:"Cloud Sync",icon:Cloud,path:"/sync"}]},
]

export function Sidebar(){
  const[collapsed,setCollapsed]=useState(false)
  const{user,logout}=useAuthStore()
  return(
    <aside className={cn("flex flex-col h-screen bg-slate-900 text-white transition-all duration-200 flex-shrink-0",collapsed?"w-[60px]":"w-[220px]")}>
      <div className={cn("flex items-center gap-3 border-b border-slate-800 flex-shrink-0",collapsed?"px-3 py-4 justify-center":"px-4 py-4")}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0"><Pill size={16} className="text-white"/></div>
        {!collapsed&&<div className="min-w-0"><p className="text-sm font-bold text-white leading-none truncate">PharmaCare Pro</p><p className="text-[11px] text-slate-400 mt-0.5">Pharmacy Management</p></div>}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(g=>(
          <div key={g.section} className="mb-4">
            {!collapsed&&<p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 mb-1">{g.section}</p>}
            {g.items.map(item=>(
              <NavLink key={item.path} to={item.path} title={collapsed?item.label:undefined}
                className={({isActive})=>cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5",isActive?"bg-blue-600 text-white":"text-slate-400 hover:bg-slate-800 hover:text-white")}>
                <item.icon size={16} className="flex-shrink-0"/>
                {!collapsed&&<><span className="flex-1 truncate">{item.label}</span>{"shortcut"in item&&<kbd className="text-[10px] text-slate-500 font-mono">{(item as {shortcut:string}).shortcut}</kbd>}</>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-800 px-2 py-2 flex-shrink-0 space-y-1">
        <NavLink to="/settings" title={collapsed?"Settings":undefined} className={({isActive})=>cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",isActive?"bg-blue-600 text-white":"text-slate-400 hover:bg-slate-800 hover:text-white")}>
          <Settings size={16} className="flex-shrink-0"/>{!collapsed&&<span>Settings</span>}
        </NavLink>
        {!collapsed&&user&&(
          <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-800 rounded-lg">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-[10px] font-bold text-white">{user.name[0]?.toUpperCase()}</span></div>
            <div className="flex-1 min-w-0"><p className="text-[12px] font-semibold text-white truncate">{user.name}</p><p className="text-[10px] text-slate-400 capitalize truncate">{user.role_name}</p></div>
            <button onClick={logout} title="Logout" className="text-slate-500 hover:text-red-400 transition-colors p-1"><LogOut size={14}/></button>
          </div>
        )}
        <button onClick={()=>setCollapsed(c=>!c)} className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-[11px]">
          {collapsed?<ChevronRight size={14}/>:<><ChevronLeft size={14}/><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
