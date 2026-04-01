import { invoke } from "@tauri-apps/api/core"
import type { ICustomer, IDoctor } from "@/types"

export const customerService = {
  search:        async (query: string): Promise<ICustomer[]>  => invoke("customer_search",  { query }),
  get:           async (id: number): Promise<ICustomer>        => invoke("customer_get",     { id }),
  create:        async (data: Partial<ICustomer>, userId: number): Promise<number> =>
    invoke("customer_create", { data, userId }),
  update:        async (id: number, data: Partial<ICustomer>, userId: number): Promise<void> =>
    invoke("customer_update", { id, data, userId }),
  getHistory:    async (customerId: number, limit = 50) =>
    invoke("customer_get_history", { customerId, limit }),
  recordPayment: async (customerId: number, amount: number, userId: number): Promise<void> =>
    invoke("customer_record_payment", { customerId, amount, userId }),
  listDoctors:   async (): Promise<IDoctor[]>  => invoke("doctor_list"),
  createDoctor:  async (data: Record<string, unknown>, userId: number): Promise<number> =>
    invoke("doctor_create", { data, userId }),
  updateDoctor:  async (id: number, data: Record<string, unknown>, userId: number): Promise<void> =>
    invoke("doctor_update", { id, data, userId }),
}
