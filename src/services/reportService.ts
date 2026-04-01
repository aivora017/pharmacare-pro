import { invoke } from "@tauri-apps/api/core"

export const reportService = {
  sales:       async (fromDate: string, toDate: string) => invoke("reports_sales",      { fromDate, toDate }),
  purchase:    async (fromDate: string, toDate: string) => invoke("reports_purchase",   { fromDate, toDate }),
  stock:       async ()                                  => invoke("reports_stock"),
  gst:         async (fromDate: string, toDate: string) => invoke("reports_gst",        { fromDate, toDate }),
  profitLoss:  async (fromDate: string, toDate: string) => invoke("reports_profit_loss",{ fromDate, toDate }),
  caPackage:   async (financialYear: string): Promise<string> => invoke("reports_ca_package", { financialYear }),
  auditLog:    async (fromDate: string, toDate: string) => invoke("reports_audit_log",  { fromDate, toDate }),
}
