/**
 * PharmaCare Pro - Root Application
 * All pages are lazy-loaded (fast startup, < 2 second).
 * RequireAuth redirects to /login if not authenticated.
 * F2 global shortcut navigates to /billing from anywhere.
 */
import { Suspense, lazy, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { useAuthStore } from "@/store/authStore"

const LoginPage     = lazy(() => import("@/pages/Auth"))
const DashboardPage = lazy(() => import("@/pages/Dashboard"))
const BillingPage   = lazy(() => import("@/pages/Billing"))
const MedicinePage  = lazy(() => import("@/pages/Medicine"))
const PurchasePage  = lazy(() => import("@/pages/Purchase"))
const CustomersPage = lazy(() => import("@/pages/Customers"))
const DoctorsPage   = lazy(() => import("@/pages/Doctors"))
const SuppliersPage = lazy(() => import("@/pages/Suppliers"))
const ExpiryPage    = lazy(() => import("@/pages/Expiry"))
const BarcodesPage  = lazy(() => import("@/pages/Barcodes"))
const ReportsPage   = lazy(() => import("@/pages/Reports"))
const AIPage        = lazy(() => import("@/pages/AI"))
const SettingsPage  = lazy(() => import("@/pages/Settings"))
const Layout        = lazy(() => import("@/components/layout/Layout").then(m => ({ default: m.Layout })))

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading PharmaCare Pro...</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { restoreSession } = useAuthStore()
  useEffect(() => { restoreSession() }, [restoreSession])

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        success: { iconTheme: { primary: "#16a34a", secondary: "#f0fdf4" } },
        error:   { iconTheme: { primary: "#dc2626", secondary: "#fef2f2" } },
      }} />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index                  element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"       element={<DashboardPage />} />
            <Route path="billing"         element={<BillingPage />} />
            <Route path="medicine"        element={<MedicinePage />} />
            <Route path="medicine/:id"    element={<MedicinePage />} />
            <Route path="purchase"        element={<PurchasePage />} />
            <Route path="customers"       element={<CustomersPage />} />
            <Route path="customers/:id"   element={<CustomersPage />} />
            <Route path="doctors"         element={<DoctorsPage />} />
            <Route path="suppliers"       element={<SuppliersPage />} />
            <Route path="expiry"          element={<ExpiryPage />} />
            <Route path="barcodes"        element={<BarcodesPage />} />
            <Route path="reports"         element={<ReportsPage />} />
            <Route path="reports/:type"   element={<ReportsPage />} />
            <Route path="ai"              element={<AIPage />} />
            <Route path="settings"        element={<SettingsPage />} />
            <Route path="settings/:tab"   element={<SettingsPage />} />
            <Route path="*"               element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
