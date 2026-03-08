import { invoke } from '@tauri-apps/api/core'

export interface ICategoryItem {
  id: number
  name: string
}

export interface IMedicineListItem {
  id: number
  name: string
  generic_name: string
  category_id?: number
  category_name?: string
  schedule: 'OTC' | 'H' | 'H1' | 'X' | 'Narcotic'
  default_gst_rate: number
  reorder_level: number
  total_stock: number
  is_active: boolean
}

export interface IMedicineDetailItem extends IMedicineListItem {
  reorder_quantity: number
}

export interface IBatchItem {
  id: number
  medicine_id: number
  batch_number: string
  barcode?: string
  expiry_date: string
  purchase_price: number
  selling_price: number
  quantity_in: number
  quantity_sold: number
  quantity_adjusted: number
  quantity_on_hand: number
  rack_location?: string
  is_active: boolean
}

export const medicineService = {
  search: async (params: {
    query?: string
    category_id?: number
    in_stock_only?: boolean
    sort?: 'name_asc' | 'name_desc'
  }): Promise<IMedicineListItem[]> => invoke('medicine_search', params),

  listCategories: async (): Promise<ICategoryItem[]> => invoke('medicine_list_categories'),

  get: async (id: number): Promise<IMedicineDetailItem> => invoke('medicine_get', { id }),

  create: async (input: {
    name: string
    generic_name: string
    category_id?: number
    schedule: string
    default_gst_rate: number
    reorder_level: number
    reorder_quantity: number
    created_by: number
  }): Promise<number> => invoke('medicine_create', { input }),

  update: async (
    id: number,
    input: {
      name: string
      generic_name: string
      category_id?: number
      schedule: string
      default_gst_rate: number
      reorder_level: number
      reorder_quantity: number
      updated_by: number
    }
  ): Promise<void> => invoke('medicine_update', { id, input }),

  delete: async (id: number, user_id: number): Promise<void> =>
    invoke('medicine_delete', { id, userId: user_id }),

  getBatchByBarcode: async (barcode: string): Promise<IBatchItem> =>
    invoke('medicine_get_batch_by_barcode', { barcode }),

  listBatches: async (medicineId: number): Promise<IBatchItem[]> =>
    invoke('medicine_list_batches', { medicineId }),

  createBatch: async (input: {
    medicine_id: number
    batch_number: string
    expiry_date: string
    purchase_price: number
    selling_price: number
    quantity_in: number
    rack_location?: string
    created_by: number
  }): Promise<number> => invoke('medicine_create_batch', { input }),

  updateBatch: async (
    batchId: number,
    input: {
      expiry_date: string
      purchase_price: number
      selling_price: number
      rack_location?: string
      updated_by: number
    }
  ): Promise<void> => invoke('medicine_update_batch', { batchId, input }),
}
