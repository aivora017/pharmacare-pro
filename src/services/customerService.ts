/**
 * Customer and Doctor service.
 */
import { invoke } from "@tauri-apps/api/core"
import type { ICustomer, IDoctor } from "@/types"

export interface ICustomerSearchItem {
  id: number
  name: string
  phone?: string
  outstanding_balance: number
  loyalty_points: number
}

export interface ICustomerCreateInput {
  name: string
  phone?: string
  email?: string
}

export const customerService = {
  search:       async (query: string): Promise<ICustomerSearchItem[]> =>
    invoke<ICustomerSearchItem[]>("customer_search", { query }),
  get:          async (id: number): Promise<ICustomer> =>
    invoke<ICustomer>("customer_get", { id }),
  create:       async (data: ICustomerCreateInput, userId: number): Promise<number> =>
    invoke<number>("customer_create", { data, userId }),
  update:       async (id: number, data: Partial<ICustomer>, userId: number): Promise<void> =>
    invoke("customer_update", { id, data, userId }),
  getHistory:   async (customerId: number, limit = 50) =>
    invoke("customer_get_history", { customerId, limit }),
  listDoctors:  async (): Promise<IDoctor[]> =>
    invoke<IDoctor[]>("doctor_list"),
  createDoctor: async (data: Partial<IDoctor>, userId: number): Promise<number> =>
    invoke<number>("doctor_create", { data, userId }),
  updateDoctor: async (id: number, data: Partial<IDoctor>, userId: number): Promise<void> =>
    invoke("doctor_update", { id, data, userId }),
}
