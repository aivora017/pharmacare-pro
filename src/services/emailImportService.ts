/**
 * Email import service for auto-fetching distributor invoices via IMAP.
 * Exclusive feature — no other Indian pharmacy software has this.
 */
import { invoke } from "@tauri-apps/api/core"

export const emailImportService = {
  testConnection: async (config: Record<string,unknown>): Promise<boolean> =>
    invoke<boolean>("email_test_connection", { config }),
  fetchInvoices:  async () =>
    invoke("email_fetch_invoices"),
  importBill:     async (importId: number, data: unknown, userId: number): Promise<number> =>
    invoke<number>("email_import_bill", { importId, data, userId }),
  listImports:    async () =>
    invoke("email_list_imports"),
}
