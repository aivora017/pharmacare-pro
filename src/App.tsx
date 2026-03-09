import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/store/authStore'
import AuthPage from '@/pages/Auth'
import DashboardPage from '@/pages/Dashboard'
import BillingPage from '@/pages/Billing'
import MedicinePage from '@/pages/Medicine'
import PurchasePage from '@/pages/Purchase'
import CustomersPage from '@/pages/Customers'
import DoctorsPage from '@/pages/Doctors'
import SuppliersPage from '@/pages/Suppliers'
import { ModulePlaceholderPage } from '@/pages/ModulePlaceholder'

void useNavigate

function ProtectedLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault()
        navigate('/billing')
      }

      if (event.key === 'Escape') {
        const active = document.activeElement as HTMLElement | null
        active?.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Header />
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/medicine" element={<MedicinePage />} />
            <Route path="/purchase" element={<PurchasePage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/doctors" element={<DoctorsPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route
              path="/reports"
              element={
                <ModulePlaceholderPage
                  title="Reports"
                  description="Sales, GST, and stock reports will appear here once report APIs are ready."
                />
              }
            />
            <Route
              path="/settings"
              element={
                <ModulePlaceholderPage
                  title="Settings"
                  description="Pharmacy profile and user settings screens are under active development."
                />
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, isLoading, restoreSession } = useAuthStore()

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  return (
    <BrowserRouter>
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
          error: { iconTheme: { primary: '#dc2626', secondary: '#fef2f2' } },
        }}
      />

      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">Restoring session...</p>
        </div>
      ) : (
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />}
          />
          <Route
            path="/*"
            element={isAuthenticated ? <ProtectedLayout /> : <Navigate to="/login" replace />}
          />
        </Routes>
      )}
    </BrowserRouter>
  )
}
