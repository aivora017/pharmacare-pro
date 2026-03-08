import { format, differenceInDays, parseISO, isValid } from "date-fns"

export const formatDate      = (d: string) => { try { return format(parseISO(d), "dd MMM yyyy") } catch { return d } }
export const formatDateTime  = (d: string) => { try { return format(parseISO(d), "dd MMM yyyy, hh:mm a") } catch { return d } }
export const formatDateInput = (d: string) => { try { return format(parseISO(d), "yyyy-MM-dd") } catch { return d } }
export const daysUntil       = (d: string) => { try { return differenceInDays(parseISO(d), new Date()) } catch { return 0 } }
export const isExpired       = (d: string) => daysUntil(d) < 0
export const isNearExpiry    = (d: string, days = 30) => { const n = daysUntil(d); return n >= 0 && n <= days }
export const expiryColor     = (d: string) => {
  const n = daysUntil(d)
  if (n < 0)   return "text-red-700 bg-red-100"
  if (n <= 30)  return "text-red-600 bg-red-50"
  if (n <= 90)  return "text-amber-600 bg-amber-50"
  return "text-green-700 bg-green-50"
}
