import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { authService } from '@/services/authService'
import { emailImportService, type IEmailImportRow } from '@/services/emailImportService'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/store/authStore'

export default function SettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState(993)
  const [imapEmail, setImapEmail] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [imapUseTls, setImapUseTls] = useState(true)
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isTestingEmail, setIsTestingEmail] = useState(false)
  const [importRows, setImportRows] = useState<IEmailImportRow[]>([])
  const [isLoadingImports, setIsLoadingImports] = useState(false)

  useEffect(() => {
    const loadEmailConfig = async () => {
      try {
        const settings = await settingsService.getAll()
        setImapHost(settings.email_imap_host ?? '')
        setImapPort(Number(settings.email_imap_port ?? '993'))
        setImapEmail(settings.email_imap_email ?? '')
        setImapUseTls((settings.email_imap_tls ?? 'true') === 'true')
      } catch {
        toast.error('Could not load email settings.')
      }
    }

    const loadImports = async () => {
      setIsLoadingImports(true)
      try {
        const rows = await emailImportService.listImports()
        setImportRows(rows)
      } catch {
        toast.error('Could not load import logs.')
      } finally {
        setIsLoadingImports(false)
      }
    }

    void Promise.all([loadEmailConfig(), loadImports()])
  }, [])

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

  const handleSaveEmailConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Session not found. Please login again.')
      return
    }
    if (!imapHost.trim() || !imapEmail.trim() || imapPort <= 0) {
      toast.error('Host, port, and email are required.')
      return
    }

    setIsSavingEmail(true)
    try {
      await Promise.all([
        settingsService.set('email_imap_host', imapHost.trim(), user.id),
        settingsService.set('email_imap_port', String(imapPort), user.id),
        settingsService.set('email_imap_email', imapEmail.trim(), user.id),
        settingsService.set('email_imap_tls', imapUseTls ? 'true' : 'false', user.id),
      ])
      toast.success('Email settings saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not save email settings.')
    } finally {
      setIsSavingEmail(false)
    }
  }

  const handleTestEmailConnection = async () => {
    if (!imapHost.trim() || !imapEmail.trim() || imapPort <= 0 || !imapPassword.trim()) {
      toast.error('Enter host, port, email, and password before testing.')
      return
    }

    setIsTestingEmail(true)
    try {
      const ok = await emailImportService.testConnection({
        host: imapHost.trim(),
        port: imapPort,
        email: imapEmail.trim(),
        password: imapPassword,
      })
      if (ok) toast.success('IMAP connection test passed.')
      else toast.error('IMAP connection test failed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not test IMAP connection.')
    } finally {
      setIsTestingEmail(false)
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

      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Email Import Configuration</h2>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          Configure IMAP to fetch distributor invoices. Password is used only for connection tests.
        </p>

        <form onSubmit={handleSaveEmailConfig} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-700 mb-1">IMAP Host</label>
              <input
                value={imapHost}
                onChange={(event) => setImapHost(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                placeholder="imap.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">IMAP Port</label>
              <input
                type="number"
                value={imapPort}
                onChange={(event) => setImapPort(Number(event.target.value) || 0)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">IMAP Email</label>
              <input
                value={imapEmail}
                onChange={(event) => setImapEmail(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                placeholder="pharmacy@domain.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">Password (for Test)</label>
              <input
                type="password"
                value={imapPassword}
                onChange={(event) => setImapPassword(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                placeholder="Enter app password"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={imapUseTls}
              onChange={(event) => setImapUseTls(event.target.checked)}
            />
            Use TLS
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSavingEmail}
              className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSavingEmail ? 'Saving...' : 'Save Email Settings'}
            </button>
            <button
              type="button"
              onClick={handleTestEmailConnection}
              disabled={isTestingEmail}
              className="h-11 rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isTestingEmail ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </form>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Import Log</h3>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {isLoadingImports ? (
              <p className="text-sm text-slate-500 p-3">Loading import logs...</p>
            ) : importRows.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No import logs yet.</p>
            ) : (
              importRows.map((row) => (
                <div key={row.id} className="px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{row.email_from}</p>
                  <p className="text-xs text-slate-500">
                    {row.email_subject || 'No subject'} |{' '}
                    {new Date(row.received_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-600">
                    Status: {row.status || 'pending'} | Parsed: {row.rows_parsed} | Imported:{' '}
                    {row.rows_imported}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
