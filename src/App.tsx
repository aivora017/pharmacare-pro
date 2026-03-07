import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Sidebar } from '@/components/layout/Sidebar'
import BillingPage from '@/pages/Billing'

export default function App() {
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

      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/billing" element={<BillingPage />} />
              <Route path="*" element={<Navigate to="/billing" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
