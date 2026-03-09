/**
 * Email import service for auto-fetching distributor invoices via IMAP.
 * Exclusive feature — no other Indian pharmacy software has this.
 */
import { invoke } from '@tauri-apps/api/core'

export interface IEmailImportConfig {
  host: string
  port: number
  email: string
  password: string
}

export interface IEmailImportRow {
  id: number
  email_from: string
  email_subject?: string
  received_at: string
  attachment_name?: string
  status?: string
  error_message?: string
  rows_parsed: number
  rows_imported: number
}

export const emailImportService = {
  testConnection: async (config: IEmailImportConfig): Promise<boolean> =>
    invoke<boolean>('email_test_connection', { config }),
  fetchInvoices: async () => invoke('email_fetch_invoices'),
  importBill: async (importId: number, data: unknown, userId: number): Promise<number> =>
    invoke<number>('email_import_bill', { importId, data, userId }),
  listImports: async (): Promise<IEmailImportRow[]> =>
    invoke<IEmailImportRow[]>('email_list_imports'),
}
