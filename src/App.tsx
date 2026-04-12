import { Suspense, lazy, useEffect, Component, type ReactNode } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { useAuthStore } from "@/store/authStore"
import { useSettingsStore } from "@/store/settingsStore"
import { Spinner } from "@/components/shared/Spinner"

// ── Error boundary — shows error instead of blank page ───────
interface EBState { hasError: boolean; error: string }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, error: "" }
  static getDerivedStateFromError(e: Error): EBState {
    return { hasError: true, error: e.message }
  }
  render() {
    if (this.state.hasError) return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-8">
        <div className="bg-white rounded-2xl border border-red-200 shadow-card p-8 max-w-lg w-full">
          <h2 className="text-xl font-bold text-red-700 mb-3">Something went wrong</h2>
          <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-4 overflow-auto whitespace-pre-wrap break-all">{this.state.error}</pre>
          <button onClick={() => window.location.reload()} className="btn-primary mt-4">Reload App</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

const AuthPage       = lazy(() => import("@/pages/Auth"))
const TechSetupPage  = lazy(() => import("@/pages/TechSetup"))
const DashboardPage  = lazy(() => import("@/pages/Dashboard"))
const BillingPage    = lazy(() => import("@/pages/Billing"))
const MedicinePage   = lazy(() => import("@/pages/Medicine"))
const PurchasePage   = lazy(() => import("@/pages/Purchase"))
const CustomersPage  = lazy(() => import("@/pages/Customers"))
const DoctorsPage    = lazy(() => import("@/pages/Doctors"))
const SuppliersPage  = lazy(() => import("@/pages/Suppliers"))
const ExpiryPage     = lazy(() => import("@/pages/Expiry"))
const BarcodesPage   = lazy(() => import("@/pages/Barcodes"))
const ReportsPage    = lazy(() => import("@/pages/Reports"))
const AIPage         = lazy(() => import("@/pages/AI"))
const SettingsPage   = lazy(() => import("@/pages/Settings"))
const StockAdjustPage= lazy(() => import("@/pages/StockAdjust"))
const BillsPage      = lazy(() => import("@/pages/Bills"))
const NetworkPage    = lazy(() => import("@/pages/Network"))
const SyncPage       = lazy(() => import("@/pages/Sync"))
const GSTCompliancePage = lazy(() => import("@/pages/GSTCompliance"))
const CompliancePage    = lazy(() => import("@/pages/Compliance"))
const PurchaseOrdersPage = lazy(() => import("@/pages/PurchaseOrders"))
const ExpensesPage       = lazy(() => import("@/pages/Expenses"))
const SupplierCreditPage = lazy(() => import("@/pages/SupplierCredit"))
const SchemesPage        = lazy(() => import("@/pages/Schemes"))
const CollectionsPage    = lazy(() => import("@/pages/Collections"))
const OnboardingPage     = lazy(() => import("@/pages/Onboarding"))
const Layout         = lazy(() => import("@/components/layout/Layout").then(m => ({ default: m.Layout })))

function Loader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading PharmaCare Pro…</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const { onboardingComplete } = useSettingsStore()
  if (isLoading) return <Loader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function App() {
  const { restoreSession } = useAuthStore()
  const { loadStatus } = useSettingsStore()
  useEffect(() => { restoreSession() }, [restoreSession])
  useEffect(() => { loadStatus() }, [loadStatus])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontSize: "14px", borderRadius: "10px" },
            success: { iconTheme: { primary: "#16a34a", secondary: "#f0fdf4" } },
            error:   { iconTheme: { primary: "#dc2626", secondary: "#fef2f2" } },
          }}
        />
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/tech" element={<TechSetupPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"   element={<DashboardPage />} />
              <Route path="billing"     element={<BillingPage />} />
              <Route path="bills"       element={<BillsPage />} />
              <Route path="medicine"    element={<MedicinePage />} />
              <Route path="purchase"    element={<PurchasePage />} />
              <Route path="customers"   element={<CustomersPage />} />
              <Route path="doctors"     element={<DoctorsPage />} />
              <Route path="suppliers"   element={<SuppliersPage />} />
              <Route path="expiry"      element={<ExpiryPage />} />
              <Route path="stock-adjust"element={<StockAdjustPage />} />
              <Route path="barcodes"    element={<BarcodesPage />} />
              <Route path="reports"     element={<ReportsPage />} />
              <Route path="ai"          element={<AIPage />} />
              <Route path="network"     element={<NetworkPage />} />
              <Route path="sync"        element={<SyncPage />} />
              <Route path="gst-compliance"  element={<GSTCompliancePage />} />
              <Route path="compliance"      element={<CompliancePage />} />
              <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="expenses"        element={<ExpensesPage />} />
              <Route path="supplier-credit" element={<SupplierCreditPage />} />
              <Route path="schemes"         element={<SchemesPage />} />
              <Route path="collections"     element={<CollectionsPage />} />
              <Route path="settings"    element={<SettingsPage />} />
              <Route path="*"           element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
