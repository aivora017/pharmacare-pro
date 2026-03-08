import type { IMedicineListItem } from '@/services/medicineService'

interface Props {
  query: string
  results: IMedicineListItem[]
  isLoading: boolean
  onSelect: (medicine: IMedicineListItem) => void
}

function highlightText(text: string, query: string): string {
  const safeQuery = query.trim().toLowerCase()
  if (!safeQuery) {
    return text
  }

  const idx = text.toLowerCase().indexOf(safeQuery)
  if (idx < 0) {
    return text
  }

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + safeQuery.length)
  const after = text.slice(idx + safeQuery.length)
  return `${before}[${match}]${after}`
}

export function MedicineSearchDropdown({ query, results, isLoading, onSelect }: Props) {
  if (query.trim().length < 2) {
    return null
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm max-h-72 overflow-y-auto">
      {isLoading ? (
        <p className="px-3 py-3 text-sm text-slate-500">Searching medicines...</p>
      ) : results.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-500">No matching medicine found.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="w-full min-h-touch px-3 py-2 text-left hover:bg-blue-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-800">
                  {highlightText(item.name, query)}
                </p>
                <p className="text-xs text-slate-500">{highlightText(item.generic_name, query)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stock: {item.total_stock} | GST: {item.default_gst_rate}%
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
