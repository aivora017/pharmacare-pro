interface Props { status: string; size?: "sm"|"md" }
const CONFIG: Record<string, string> = {
  active:   "bg-green-100 text-green-800",
  paid:     "bg-green-100 text-green-800",
  success:  "bg-green-100 text-green-800",
  unpaid:   "bg-red-100 text-red-800",
  cancelled:"bg-red-100 text-red-800",
  expired:  "bg-red-100 text-red-800",
  critical: "bg-red-100 text-red-800",
  partial:  "bg-amber-100 text-amber-800",
  pending:  "bg-amber-100 text-amber-800",
  high:     "bg-amber-100 text-amber-800",
  warning:  "bg-amber-100 text-amber-800",
  draft:    "bg-slate-100 text-slate-700",
  low:      "bg-blue-100 text-blue-800",
  info:     "bg-blue-100 text-blue-800",
}
export function StatusBadge({ status, size="sm" }: Props) {
  const cls = CONFIG[status.toLowerCase()] ?? "bg-slate-100 text-slate-700"
  const sz  = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
  return <span className={`inline-flex items-center rounded-full font-medium capitalize ${cls} ${sz}`}>{status}</span>
}
