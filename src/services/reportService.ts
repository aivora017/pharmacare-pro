/**
 * Reports service - all reports + CA package.
 */
import { invoke } from "@tauri-apps/api/core"

export interface ReportFilter { from_date: string; to_date: string; supplier_id?: number; customer_id?: number }

export const reportService = {
  getSales:       async (filter: ReportFilter) => invoke("reports_sales",       { filter }),
  getPurchase:    async (filter: ReportFilter) => invoke("reports_purchase",    { filter }),
  getStock:       async ()                      => invoke("reports_stock"),
  getGST:         async (filter: ReportFilter) => invoke("reports_gst",        { filter }),
  getProfitLoss:  async (filter: ReportFilter) => invoke("reports_profit_loss",{ filter }),
  getAuditLog:    async (filter: ReportFilter) => invoke("reports_audit_log",  { filter }),
  /** Generate ZIP with all annual reports for CA. Returns path to ZIP. */
  generateCAPackage: async (financialYear: string): Promise<string> =>
    invoke<string>("reports_ca_package", { financialYear }),
}
