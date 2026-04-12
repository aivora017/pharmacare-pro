import { invoke } from "@tauri-apps/api/core"

export interface Scheme {
  id: number
  name: string
  scheme_type: 'percent' | 'flat' | 'bxgy'
  value: number
  buy_quantity: number
  get_quantity: number
  medicine_id?: number
  medicine_name: string
  min_bill_amount: number
  start_date?: string
  end_date?: string
  is_active: boolean
  notes: string
  created_at: string
}

export const schemeService = {
  list: (activeOnly = false) =>
    invoke<{ schemes: Scheme[]; count: number }>('scheme_list', { activeOnly }),

  create: (data: Partial<Scheme>, userId: number) =>
    invoke<number>('scheme_create', { data, userId }),

  update: (id: number, data: Partial<Scheme>) =>
    invoke<void>('scheme_update', { id, data }),

  delete: (id: number) =>
    invoke<void>('scheme_delete', { id }),

  getApplicable: (billTotal: number) =>
    invoke<{ schemes: Scheme[] }>('scheme_get_applicable', { billTotal }),
}
