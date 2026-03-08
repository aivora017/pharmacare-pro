import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export default function SettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      toast.error('Session not found. Please login again.')
      return
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.')
      return
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.')
      return
    }

    setIsSaving(true)
    try {
      await authService.changePassword({
        user_id: user.id,
        current_password: currentPassword,
        new_password: newPassword,
      })

      toast.success('Password changed successfully. Please login again.')

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not change password.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <PageHeader title="Settings" subtitle="App configuration and account security" />

      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          Update your login password. You will be logged out from active sessions.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Password'}
          </button>
        </form>
      </section>
    </div>
  )
}
