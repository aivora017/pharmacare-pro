import { invoke } from "@tauri-apps/api/core"

export interface Expense {
  id: number
  expense_date: string
  category: string
  description: string
  amount: number
  payment_mode: string
  reference_no: string
  vendor_name: string
  notes: string
  created_at: string
}

export const EXPENSE_CATEGORIES = [
  'Rent', 'Electricity', 'Salary', 'Transport',
  'Stationery', 'Maintenance', 'General', 'Other'
]

export const expenseService = {
  list: (from: string, to: string, category?: string) =>
    invoke<{ expenses: Expense[]; count: number; total: number }>(
      'expense_list', { from, to, category: category ?? null }
    ),

  create: (data: Partial<Expense>, userId: number) =>
    invoke<number>('expense_create', { data, userId }),

  update: (id: number, data: Partial<Expense>) =>
    invoke<void>('expense_update', { id, data }),

  delete: (id: number) =>
    invoke<void>('expense_delete', { id }),

  cashBook: (from: string, to: string) =>
    invoke<{ cash_sales: number; cash_expenses: number; cash_purchases: number; net_cash: number }>(
      'expense_cash_book', { from, to }
    ),

  summary: (from: string, to: string) =>
    invoke<{ by_category: any[]; grand_total: number }>('expense_summary', { from, to }),
}
