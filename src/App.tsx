/**
 * PharmaCare Pro — Root Application Component
 *
 * This is the entry point for the React app.
 * It sets up:
 * 1. The router (all page routes)
 * 2. The authentication guard (redirect to login if not logged in)
 * 3. The global notification system (toast messages)
 * 4. Keyboard shortcuts handler
 *
 * Copilot Instructions:
 * - All routes are defined in this file
 * - Protected routes require the user to be logged in (checked via authStore)
 * - The Layout component wraps all protected pages (provides sidebar + header)
 * - Lazy-load every page component using React.lazy() to keep the app fast
 */

import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Layout } from '@/components/layout/Layout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useAuthStore } from '@/store/authStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import { initDatabase } from '@/db'

// ── Lazy-loaded pages (each page is a separate code chunk) ────────────────
// This keeps the initial app load fast — pages only load when first visited

const LoginPage         = lazy(() => import('@/pages/Auth'))
const DashboardPage     = lazy(() => import('@/pages/Dashboard'))
const BillingPage       = lazy(() => import('@/pages/Billing'))
const MedicinePage      = lazy(() => import('@/pages/Medicine'))
const PurchasePage      = lazy(() => import('@/pages/Purchase'))
const CustomersPage     = lazy(() => import('@/pages/Customers'))
const DoctorsPage       = lazy(() => import('@/pages/Doctors'))
const SuppliersPage     = lazy(() => import('@/pages/Suppliers'))
const ExpiryPage        = lazy(() => import('@/pages/Expiry'))
const BarcodesPage      = lazy(() => import('@/pages/Barcodes'))
const ReportsPage       = lazy(() => import('@/pages/Reports'))
const AIPage            = lazy(() => import('@/pages/AI'))
const SettingsPage      = lazy(() => import('@/pages/Settings'))

// ── Auth Guard ────────────────────────────────────────────────────────────
// Wraps routes that require login. Redirects to /login if not authenticated.

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <LoadingSpinner size="lg" message="Starting PharmaCare Pro..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// ── Page Loader ───────────────────────────────────────────────────────────
// Shows while a lazy page is being loaded

function PageLoader() {
  return (
    <div className="flex items-center justify-center flex-1 h-full">
      <LoadingSpinner size="md" message="Loading..." />
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────

export default function App() {
  const { restoreSession } = useAuthStore()

  // Initialise database and restore session on app start
  useEffect(() => {
    async function init() {
      await initDatabase()    // Run migrations, check schema
      await restoreSession()  // Check for saved session token
    }
    init()
  }, [restoreSession])

  // Register global keyboard shortcuts (F2=billing, F3=search, etc.)
  useKeyboard()

  return (
    <BrowserRouter>
      {/* Global toast notifications — shows at top-right of screen */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '14px',
            borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif',
          },
          success: { iconTheme: { primary: '#16a34a', secondary: '#f0fdf4' } },
          error:   { iconTheme: { primary: '#dc2626', secondary: '#fef2f2' } },
        }}
      />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public routes (no login required) ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Protected routes (login required) ── */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            {/* Default redirect to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Core screens */}
            <Route path="dashboard"  element={<DashboardPage />} />
            <Route path="billing"    element={<BillingPage />} />     {/* F2 shortcut */}
            <Route path="medicine"   element={<MedicinePage />} />
            <Route path="medicine/:id" element={<MedicinePage />} />

            {/* Purchase & Suppliers */}
            <Route path="purchase"   element={<PurchasePage />} />
            <Route path="suppliers"  element={<SuppliersPage />} />

            {/* People */}
            <Route path="customers"  element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomersPage />} />
            <Route path="doctors"    element={<DoctorsPage />} />

            {/* Inventory */}
            <Route path="expiry"     element={<ExpiryPage />} />
            <Route path="barcodes"   element={<BarcodesPage />} />

            {/* Analytics */}
            <Route path="reports"    element={<ReportsPage />} />
            <Route path="reports/:type" element={<ReportsPage />} />
            <Route path="ai"         element={<AIPage />} />

            {/* Admin */}
            <Route path="settings"   element={<SettingsPage />} />
            <Route path="settings/:tab" element={<SettingsPage />} />

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
