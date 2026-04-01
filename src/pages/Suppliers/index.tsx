import { useNavigate } from "react-router-dom"
import { Truck, ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"

export default function SuppliersPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <PageHeader title="Suppliers" subtitle="Supplier management is available inside Purchase Management"/>
      <div className="card p-8 text-center">
        <Truck size={40} className="text-slate-200 mx-auto mb-4"/>
        <p className="text-slate-600 font-medium mb-2">Supplier management has been merged into Purchase</p>
        <p className="text-slate-400 text-sm mb-5">All supplier CRUD, outstanding balances, and purchase bills are in one place.</p>
        <button onClick={() => navigate("/purchase")} className="btn-primary mx-auto">
          Go to Purchase Management <ArrowRight size={15}/>
        </button>
      </div>
    </div>
  )
}
