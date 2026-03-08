interface Props { icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }
export function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-slate-200 mb-4">{icon}</div>}
      <p className="text-slate-600 font-medium text-base">{title}</p>
      {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
