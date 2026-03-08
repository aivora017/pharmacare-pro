/**
 * Always use this before deleting anything.
 * Copilot: import and use: <ConfirmDialog open={showConfirm} onConfirm={handleDelete} onCancel={() => setShowConfirm(false)} title="Delete Medicine?" message="This cannot be undone." />
 */
interface Props {
  open: boolean; title: string; message: string
  confirmText?: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({ open, title, message, confirmText="Delete", danger=true, onConfirm, onCancel }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors min-h-touch">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors min-h-touch ${danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
