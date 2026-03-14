/**
 * Reports service - all reports + CA package.
 */
import { invoke } from '@tauri-apps/api/core'

export interface ReportFilter {
  from_date: string
  to_date: string
  supplier_id?: number
  customer_id?: number
  user_id?: number
  module?: string
  action?: string
}

export interface ISalesReportSummary {
  from_date: string
  to_date: string
  total_bills: number
  total_quantity: number
  gross_sales: number
  total_discount: number
  net_sales: number
  avg_bill_value: number
}

export interface ISalesReportDailyRow {
  report_date: string
  bill_count: number
  net_sales: number
  gross_sales: number
  discount_amount: number
}

export interface ISalesReportPaymentRow {
  payment_mode: string
  total_amount: number
}

export interface ISalesReportMedicineRow {
  medicine_name: string
  total_quantity: number
  total_amount: number
}

export interface ISalesReport {
  summary: ISalesReportSummary
  daily: ISalesReportDailyRow[]
  payment_breakdown: ISalesReportPaymentRow[]
  top_medicines: ISalesReportMedicineRow[]
}

export interface IPurchaseReportSummary {
  from_date: string
  to_date: string
  total_bills: number
  total_quantity: number
  gross_purchase: number
  total_discount: number
  net_purchase: number
  avg_bill_value: number
}

export interface IPurchaseReportDailyRow {
  report_date: string
  bill_count: number
  net_purchase: number
  gross_purchase: number
  discount_amount: number
}

export interface IPurchaseReportSupplierRow {
  supplier_id: number
  supplier_name: string
  bill_count: number
  total_amount: number
}

export interface IPurchaseReport {
  summary: IPurchaseReportSummary
  daily: IPurchaseReportDailyRow[]
  supplier_breakdown: IPurchaseReportSupplierRow[]
  top_medicines: ISalesReportMedicineRow[]
}

export interface IStockReportSummary {
  total_lines: number
  total_units: number
  purchase_value: number
  selling_value: number
  estimated_margin: number
}

export interface IStockReportItem {
  medicine_id: number
  medicine_name: string
  quantity_on_hand: number
  purchase_value: number
  selling_value: number
  batch_count: number
}

export interface IStockReport {
  summary: IStockReportSummary
  items: IStockReportItem[]
}

export interface IGstReportSummary {
  from_date: string
  to_date: string
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_gst: number
  total_invoice_value: number
}

export interface IGstReportDailyRow {
  report_date: string
  bill_count: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  invoice_value: number
}

export interface IGstReportHsnRow {
  hsn_code: string
  bill_count: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
}

export interface IGstReport {
  summary: IGstReportSummary
  daily: IGstReportDailyRow[]
  hsn_summary: IGstReportHsnRow[]
}

export interface IProfitLossSummary {
  from_date: string
  to_date: string
  revenue: number
  discounts: number
  estimated_cogs: number
  gross_profit: number
  purchase_expense: number
  net_profit: number
  gross_margin_pct: number
}

export interface IProfitLossDailyRow {
  report_date: string
  revenue: number
  discounts: number
  estimated_cogs: number
  gross_profit: number
  gross_margin_pct: number
}

export interface IProfitLossReport {
  summary: IProfitLossSummary
  daily: IProfitLossDailyRow[]
}

export interface IAuditReportSummary {
  from_date: string
  to_date: string
  total_events: number
  unique_users: number
  unique_modules: number
}

export interface IAuditReportRow {
  id: number
  created_at: string
  user_name: string
  action: string
  module: string
  record_id: string
  old_value: string
  new_value: string
  notes: string
}

export interface IAuditReport {
  summary: IAuditReportSummary
  rows: IAuditReportRow[]
}

export interface IExpiryWriteoffSummary {
  from_date: string
  to_date: string
  expired_lines: number
  near_expiry_lines: number
  expired_stock_value: number
  near_expiry_stock_value: number
  writeoff_value: number
}

export interface IExpiryWriteoffItem {
  medicine_name: string
  batch_number: string
  expiry_date: string
  quantity_on_hand: number
  purchase_value: number
  days_to_expiry: number
  status: 'expired' | 'near_expiry' | 'ok'
}

export interface IExpiryWriteoffReport {
  summary: IExpiryWriteoffSummary
  items: IExpiryWriteoffItem[]
}

export interface ICustomerOutstandingSummary {
  total_customers: number
  total_outstanding: number
  over_30_days: number
  over_90_days: number
}

export interface ICustomerOutstandingRow {
  customer_id: number
  customer_name: string
  phone: string
  outstanding_balance: number
  last_bill_date: string
  days_since_last_bill: number
  age_bucket: '0-30' | '31-90' | '90+'
}

export interface ICustomerOutstandingReport {
  summary: ICustomerOutstandingSummary
  rows: ICustomerOutstandingRow[]
}

export interface ISupplierOutstandingSummary {
  total_suppliers: number
  total_outstanding: number
  over_30_days: number
  over_90_days: number
}

export interface ISupplierOutstandingRow {
  supplier_id: number
  supplier_name: string
  phone: string
  outstanding_balance: number
  last_bill_date: string
  days_since_last_bill: number
  age_bucket: '0-30' | '31-90' | '90+'
}

export interface ISupplierOutstandingReport {
  summary: ISupplierOutstandingSummary
  rows: ISupplierOutstandingRow[]
}

async function safeInvoke<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load report data.'
    throw new Error(message)
  }
}

export const reportService = {
  getSales: async (filter: ReportFilter, actorUserId: number): Promise<ISalesReport> =>
    safeInvoke<ISalesReport>('reports_sales', { filter, actorUserId }),
  getPurchase: async (filter: ReportFilter, actorUserId: number): Promise<IPurchaseReport> =>
    safeInvoke<IPurchaseReport>('reports_purchase', { filter, actorUserId }),
  getStock: async (actorUserId: number): Promise<IStockReport> =>
    safeInvoke<IStockReport>('reports_stock', { actorUserId }),
  getGST: async (filter: ReportFilter, actorUserId: number): Promise<IGstReport> =>
    safeInvoke<IGstReport>('reports_gst', { filter, actorUserId }),
  getProfitLoss: async (filter: ReportFilter, actorUserId: number): Promise<IProfitLossReport> =>
    safeInvoke<IProfitLossReport>('reports_profit_loss', { filter, actorUserId }),
  getExpiryWriteoff: async (
    filter: ReportFilter,
    actorUserId: number
  ): Promise<IExpiryWriteoffReport> =>
    safeInvoke<IExpiryWriteoffReport>('reports_expiry_writeoff', { filter, actorUserId }),
  getCustomerOutstanding: async (actorUserId: number): Promise<ICustomerOutstandingReport> =>
    safeInvoke<ICustomerOutstandingReport>('reports_customer_outstanding', { actorUserId }),
  getSupplierOutstanding: async (actorUserId: number): Promise<ISupplierOutstandingReport> =>
    safeInvoke<ISupplierOutstandingReport>('reports_supplier_outstanding', { actorUserId }),
  getAuditLog: async (filter: ReportFilter, actorUserId: number): Promise<IAuditReport> =>
    safeInvoke<IAuditReport>('reports_audit_log', { filter, actorUserId }),
  /** Generate ZIP with all annual reports for CA. Returns path to ZIP. */
  generateCAPackage: async (financialYear: string, actorUserId: number): Promise<string> =>
    safeInvoke<string>('reports_ca_package', { financialYear, actorUserId }),
}
