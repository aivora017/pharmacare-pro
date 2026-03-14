import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { open } from '@tauri-apps/plugin-shell'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuthStore } from '@/store/authStore'
import {
  type IAuditReport,
  type IAuditReportSummary,
  type ICustomerOutstandingReport,
  type ICustomerOutstandingSummary,
  type IExpiryWriteoffReport,
  type IExpiryWriteoffSummary,
  type IGstReport,
  type IGstReportSummary,
  type IProfitLossReport,
  type IProfitLossSummary,
  type ISupplierOutstandingReport,
  type ISupplierOutstandingSummary,
  type IStockReport,
  type IStockReportSummary,
  reportService,
  type IPurchaseReport,
  type IPurchaseReportSummary,
  type ISalesReport,
  type ISalesReportSummary,
} from '@/services/reportService'
import { supplierService } from '@/services/supplierService'
import type { ISupplier } from '@/types'
import { formatCurrency, formatNumber } from '@/utils/currency'

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultDateRange() {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 29)
  return {
    from: toDateInputValue(from),
    to: toDateInputValue(today),
  }
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

const emptySummary: ISalesReportSummary = {
  from_date: '',
  to_date: '',
  total_bills: 0,
  total_quantity: 0,
  gross_sales: 0,
  total_discount: 0,
  net_sales: 0,
  avg_bill_value: 0,
}

const emptyPurchaseSummary: IPurchaseReportSummary = {
  from_date: '',
  to_date: '',
  total_bills: 0,
  total_quantity: 0,
  gross_purchase: 0,
  total_discount: 0,
  net_purchase: 0,
  avg_bill_value: 0,
}

const emptyStockSummary: IStockReportSummary = {
  total_lines: 0,
  total_units: 0,
  purchase_value: 0,
  selling_value: 0,
  estimated_margin: 0,
}

const emptyGstSummary: IGstReportSummary = {
  from_date: '',
  to_date: '',
  taxable_amount: 0,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 0,
  total_gst: 0,
  total_invoice_value: 0,
}

const emptyProfitLossSummary: IProfitLossSummary = {
  from_date: '',
  to_date: '',
  revenue: 0,
  discounts: 0,
  estimated_cogs: 0,
  gross_profit: 0,
  purchase_expense: 0,
  net_profit: 0,
  gross_margin_pct: 0,
}

const emptyAuditSummary: IAuditReportSummary = {
  from_date: '',
  to_date: '',
  total_events: 0,
  unique_users: 0,
  unique_modules: 0,
}

const emptyExpiryWriteoffSummary: IExpiryWriteoffSummary = {
  from_date: '',
  to_date: '',
  expired_lines: 0,
  near_expiry_lines: 0,
  expired_stock_value: 0,
  near_expiry_stock_value: 0,
  writeoff_value: 0,
}

const emptyCustomerOutstandingSummary: ICustomerOutstandingSummary = {
  total_customers: 0,
  total_outstanding: 0,
  over_30_days: 0,
  over_90_days: 0,
}

const emptySupplierOutstandingSummary: ISupplierOutstandingSummary = {
  total_suppliers: 0,
  total_outstanding: 0,
  over_30_days: 0,
  over_90_days: 0,
}

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user)
  const defaults = useMemo(() => defaultDateRange(), [])
  const [activeReport, setActiveReport] = useState<
    | 'sales'
    | 'purchase'
    | 'stock'
    | 'gst'
    | 'profit-loss'
    | 'expiry-writeoff'
    | 'customer-outstanding'
    | 'supplier-outstanding'
    | 'audit'
    | 'ca-package'
  >('sales')
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [isLoading, setIsLoading] = useState(false)
  const [sales, setSales] = useState<ISalesReport | null>(null)
  const [purchase, setPurchase] = useState<IPurchaseReport | null>(null)
  const [stock, setStock] = useState<IStockReport | null>(null)
  const [gst, setGst] = useState<IGstReport | null>(null)
  const [profitLoss, setProfitLoss] = useState<IProfitLossReport | null>(null)
  const [expiryWriteoff, setExpiryWriteoff] = useState<IExpiryWriteoffReport | null>(null)
  const [customerOutstanding, setCustomerOutstanding] = useState<ICustomerOutstandingReport | null>(
    null
  )
  const [supplierOutstanding, setSupplierOutstanding] = useState<ISupplierOutstandingReport | null>(
    null
  )
  const [auditLog, setAuditLog] = useState<IAuditReport | null>(null)
  const [suppliers, setSuppliers] = useState<ISupplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | undefined>(undefined)
  const [financialYear, setFinancialYear] = useState(
    `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`
  )
  const [lastCAPackagePath, setLastCAPackagePath] = useState('')

  const loadSuppliers = useCallback(async () => {
    try {
      const rows = await supplierService.list()
      setSuppliers(rows)
    } catch {
      toast.error('Could not load suppliers for filter.')
    }
  }, [])

  const loadSalesReport = useCallback(async () => {
    if (activeReport === 'ca-package') {
      return
    }

    if (
      activeReport !== 'stock' &&
      activeReport !== 'customer-outstanding' &&
      activeReport !== 'supplier-outstanding' &&
      (!fromDate || !toDate)
    ) {
      toast.error('Please select both from and to dates.')
      return
    }

    if (
      activeReport !== 'stock' &&
      activeReport !== 'customer-outstanding' &&
      activeReport !== 'supplier-outstanding' &&
      fromDate > toDate
    ) {
      toast.error('From date cannot be after to date.')
      return
    }

    try {
      if (!user) {
        toast.error('Session expired. Please login again.')
        return
      }
      setIsLoading(true)
      if (activeReport === 'sales') {
        const data = await reportService.getSales({ from_date: fromDate, to_date: toDate }, user.id)
        setSales(data)
      } else if (activeReport === 'purchase') {
        const data = await reportService.getPurchase(
          {
            from_date: fromDate,
            to_date: toDate,
            supplier_id: selectedSupplierId,
          },
          user.id
        )
        setPurchase(data)
      } else if (activeReport === 'stock') {
        const data = await reportService.getStock(user.id)
        setStock(data)
      } else if (activeReport === 'gst') {
        const data = await reportService.getGST({ from_date: fromDate, to_date: toDate }, user.id)
        setGst(data)
      } else if (activeReport === 'expiry-writeoff') {
        const data = await reportService.getExpiryWriteoff(
          { from_date: fromDate, to_date: toDate },
          user.id
        )
        setExpiryWriteoff(data)
      } else if (activeReport === 'customer-outstanding') {
        const data = await reportService.getCustomerOutstanding(user.id)
        setCustomerOutstanding(data)
      } else if (activeReport === 'supplier-outstanding') {
        const data = await reportService.getSupplierOutstanding(user.id)
        setSupplierOutstanding(data)
      } else if (activeReport === 'audit') {
        const data = await reportService.getAuditLog(
          { from_date: fromDate, to_date: toDate },
          user.id
        )
        setAuditLog(data)
      } else {
        const data = await reportService.getProfitLoss(
          { from_date: fromDate, to_date: toDate },
          user.id
        )
        setProfitLoss(data)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to load ${
              activeReport === 'sales'
                ? 'sales'
                : activeReport === 'purchase'
                  ? 'purchase'
                  : activeReport === 'stock'
                    ? 'stock'
                    : activeReport === 'gst'
                      ? 'gst'
                      : activeReport === 'expiry-writeoff'
                        ? 'expiry/write-off'
                        : activeReport === 'customer-outstanding'
                          ? 'customer outstanding'
                          : activeReport === 'supplier-outstanding'
                            ? 'supplier outstanding'
                            : activeReport === 'audit'
                              ? 'audit'
                              : 'profit-loss'
            } report.`
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [activeReport, fromDate, selectedSupplierId, toDate, user])

  useEffect(() => {
    void loadSalesReport()
  }, [loadSalesReport])

  useEffect(() => {
    void loadSuppliers()
  }, [loadSuppliers])

  const salesSummary = sales?.summary ?? emptySummary
  const purchaseSummary = purchase?.summary ?? emptyPurchaseSummary
  const stockSummary = stock?.summary ?? emptyStockSummary
  const gstSummary = gst?.summary ?? emptyGstSummary
  const profitLossSummary = profitLoss?.summary ?? emptyProfitLossSummary
  const expiryWriteoffSummary = expiryWriteoff?.summary ?? emptyExpiryWriteoffSummary
  const customerOutstandingSummary = customerOutstanding?.summary ?? emptyCustomerOutstandingSummary
  const supplierOutstandingSummary = supplierOutstanding?.summary ?? emptySupplierOutstandingSummary
  const auditSummary = auditLog?.summary ?? emptyAuditSummary

  const getExportMatrix = useCallback(() => {
    if (activeReport === 'ca-package') {
      toast.error('CA package is generated as ZIP, not table export.')
      return null
    }

    if (activeReport === 'sales' && (!sales || sales.daily.length === 0)) {
      toast.error('No report rows to export.')
      return null
    }

    if (activeReport === 'purchase' && (!purchase || purchase.daily.length === 0)) {
      toast.error('No report rows to export.')
      return null
    }

    if (activeReport === 'stock' && (!stock || stock.items.length === 0)) {
      toast.error('No report rows to export.')
      return null
    }

    if (activeReport === 'gst' && (!gst || gst.daily.length === 0)) {
      toast.error('No report rows to export.')
      return null
    }

    if (
      activeReport === 'expiry-writeoff' &&
      (!expiryWriteoff || expiryWriteoff.items.length === 0)
    ) {
      toast.error('No report rows to export.')
      return null
    }

    if (
      activeReport === 'customer-outstanding' &&
      (!customerOutstanding || customerOutstanding.rows.length === 0)
    ) {
      toast.error('No report rows to export.')
      return null
    }

    if (
      activeReport === 'supplier-outstanding' &&
      (!supplierOutstanding || supplierOutstanding.rows.length === 0)
    ) {
      toast.error('No report rows to export.')
      return null
    }

    if (activeReport === 'profit-loss' && (!profitLoss || profitLoss.daily.length === 0)) {
      toast.error('No report rows to export.')
      return null
    }

    if (activeReport === 'audit' && (!auditLog || auditLog.rows.length === 0)) {
      toast.error('No report rows to export.')
      return null
    }

    const header =
      activeReport === 'sales'
        ? ['Date', 'Bills', 'Gross Sales', 'Discount', 'Net Sales']
        : activeReport === 'purchase'
          ? ['Date', 'Bills', 'Gross Purchase', 'Discount', 'Net Purchase']
          : activeReport === 'stock'
            ? ['Medicine', 'Qty On Hand', 'Purchase Value', 'Selling Value', 'Batches']
            : activeReport === 'gst'
              ? ['Date', 'Bills', 'Taxable', 'CGST', 'SGST', 'IGST', 'Invoice Value']
              : activeReport === 'expiry-writeoff'
                ? [
                    'Medicine',
                    'Batch',
                    'Expiry',
                    'Qty',
                    'Purchase Value',
                    'Days To Expiry',
                    'Status',
                  ]
                : activeReport === 'customer-outstanding'
                  ? ['Customer', 'Phone', 'Outstanding', 'Last Bill', 'Days', 'Age Bucket']
                  : activeReport === 'supplier-outstanding'
                    ? ['Supplier', 'Phone', 'Outstanding', 'Last Bill', 'Days', 'Age Bucket']
                    : activeReport === 'profit-loss'
                      ? [
                          'Date',
                          'Revenue',
                          'Discounts',
                          'Estimated COGS',
                          'Gross Profit',
                          'Gross Margin %',
                        ]
                      : ['Timestamp', 'User', 'Action', 'Module', 'Record ID', 'Notes']

    const rows =
      activeReport === 'sales'
        ? (sales?.daily ?? []).map((row) => [
            row.report_date,
            String(row.bill_count),
            row.gross_sales.toFixed(2),
            row.discount_amount.toFixed(2),
            row.net_sales.toFixed(2),
          ])
        : activeReport === 'purchase'
          ? (purchase?.daily ?? []).map((row) => [
              row.report_date,
              String(row.bill_count),
              row.gross_purchase.toFixed(2),
              row.discount_amount.toFixed(2),
              row.net_purchase.toFixed(2),
            ])
          : activeReport === 'stock'
            ? (stock?.items ?? []).map((row) => [
                row.medicine_name,
                String(row.quantity_on_hand),
                row.purchase_value.toFixed(2),
                row.selling_value.toFixed(2),
                String(row.batch_count),
              ])
            : activeReport === 'gst'
              ? (gst?.daily ?? []).map((row) => [
                  row.report_date,
                  String(row.bill_count),
                  row.taxable_amount.toFixed(2),
                  row.cgst_amount.toFixed(2),
                  row.sgst_amount.toFixed(2),
                  row.igst_amount.toFixed(2),
                  row.invoice_value.toFixed(2),
                ])
              : activeReport === 'expiry-writeoff'
                ? (expiryWriteoff?.items ?? []).map((row) => [
                    row.medicine_name,
                    row.batch_number,
                    row.expiry_date,
                    String(row.quantity_on_hand),
                    row.purchase_value.toFixed(2),
                    String(row.days_to_expiry),
                    row.status,
                  ])
                : activeReport === 'customer-outstanding'
                  ? (customerOutstanding?.rows ?? []).map((row) => [
                      row.customer_name,
                      row.phone,
                      row.outstanding_balance.toFixed(2),
                      row.last_bill_date,
                      String(row.days_since_last_bill),
                      row.age_bucket,
                    ])
                  : activeReport === 'supplier-outstanding'
                    ? (supplierOutstanding?.rows ?? []).map((row) => [
                        row.supplier_name,
                        row.phone,
                        row.outstanding_balance.toFixed(2),
                        row.last_bill_date,
                        String(row.days_since_last_bill),
                        row.age_bucket,
                      ])
                    : activeReport === 'profit-loss'
                      ? (profitLoss?.daily ?? []).map((row) => [
                          row.report_date,
                          row.revenue.toFixed(2),
                          row.discounts.toFixed(2),
                          row.estimated_cogs.toFixed(2),
                          row.gross_profit.toFixed(2),
                          row.gross_margin_pct.toFixed(2),
                        ])
                      : (auditLog?.rows ?? []).map((row) => [
                          row.created_at,
                          row.user_name,
                          row.action,
                          row.module,
                          row.record_id,
                          row.notes,
                        ])

    return {
      title:
        activeReport === 'sales'
          ? 'Sales Report'
          : activeReport === 'purchase'
            ? 'Purchase Report'
            : activeReport === 'stock'
              ? 'Stock Valuation Report'
              : activeReport === 'gst'
                ? 'GST Report'
                : activeReport === 'expiry-writeoff'
                  ? 'Expiry and Write-off Report'
                  : activeReport === 'customer-outstanding'
                    ? 'Customer Outstanding Report'
                    : activeReport === 'supplier-outstanding'
                      ? 'Supplier Outstanding Report'
                      : activeReport === 'profit-loss'
                        ? 'Profit and Loss Report'
                        : 'Audit Log Report',
      header,
      rows,
    }
  }, [
    activeReport,
    auditLog,
    customerOutstanding,
    expiryWriteoff,
    gst,
    profitLoss,
    purchase,
    sales,
    stock,
    supplierOutstanding,
  ])

  const generateCAPackage = useCallback(async () => {
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }

    try {
      setIsLoading(true)
      const filePath = await reportService.generateCAPackage(financialYear, user.id)
      setLastCAPackagePath(filePath)
      toast.success(`CA package generated: ${filePath}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not generate CA package right now.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [financialYear, user])

  const openCAPackageFolder = useCallback(async () => {
    if (!lastCAPackagePath) {
      toast.error('Generate a CA package first.')
      return
    }

    const normalized = lastCAPackagePath.replace(/\\/g, '/')
    const slashIndex = normalized.lastIndexOf('/')
    const folderPath = slashIndex > 0 ? normalized.slice(0, slashIndex) : normalized

    try {
      await open(folderPath)
    } catch {
      toast.error('Could not open package folder.')
    }
  }, [lastCAPackagePath])

  const exportExcel = useCallback(async () => {
    const matrix = getExportMatrix()
    if (!matrix) return

    const XLSX = await import('xlsx')

    const worksheet = XLSX.utils.aoa_to_sheet([matrix.header, ...matrix.rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, matrix.title)

    XLSX.writeFile(workbook, `${activeReport}_report_${fromDate}_to_${toDate}.xlsx`)
    toast.success(
      `${
        activeReport === 'sales'
          ? 'Sales'
          : activeReport === 'purchase'
            ? 'Purchase'
            : activeReport === 'stock'
              ? 'Stock'
              : activeReport === 'gst'
                ? 'GST'
                : activeReport === 'expiry-writeoff'
                  ? 'Expiry/Write-off'
                  : activeReport === 'customer-outstanding'
                    ? 'Customer Outstanding'
                    : activeReport === 'supplier-outstanding'
                      ? 'Supplier Outstanding'
                      : activeReport === 'profit-loss'
                        ? 'P&L'
                        : 'Audit'
      } report exported as Excel.`
    )
  }, [activeReport, fromDate, getExportMatrix, toDate])

  const exportPdf = useCallback(() => {
    const matrix = getExportMatrix()
    if (!matrix) return

    const popup = window.open('', '_blank', 'width=1024,height=768')
    if (!popup) {
      toast.error('Could not open print window. Please allow popups.')
      return
    }

    const escapeHtml = (value: string) =>
      value
        .split('&')
        .join('&amp;')
        .split('<')
        .join('&lt;')
        .split('>')
        .join('&gt;')
        .split('"')
        .join('&quot;')
        .split("'")
        .join('&#39;')

    const headerHtml = matrix.header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')
    const rowsHtml = matrix.rows
      .map((line) => `<tr>${line.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
      .join('')

    popup.document.write(`<!doctype html>
<html>
  <head>
    <title>${escapeHtml(matrix.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
      h1 { font-size: 20px; margin: 0 0 8px 0; }
      p { margin: 0 0 16px 0; color: #475569; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      th { background: #f1f5f9; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(matrix.title)}</h1>
    <p>${escapeHtml(`Range: ${fromDate} to ${toDate}`)}</p>
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`)
    popup.document.close()
    popup.focus()
    popup.print()
    toast.success(
      `${
        activeReport === 'sales'
          ? 'Sales'
          : activeReport === 'purchase'
            ? 'Purchase'
            : activeReport === 'stock'
              ? 'Stock'
              : activeReport === 'gst'
                ? 'GST'
                : activeReport === 'expiry-writeoff'
                  ? 'Expiry/Write-off'
                  : activeReport === 'customer-outstanding'
                    ? 'Customer Outstanding'
                    : activeReport === 'supplier-outstanding'
                      ? 'Supplier Outstanding'
                      : activeReport === 'profit-loss'
                        ? 'P&L'
                        : 'Audit'
      } report opened for PDF print.`
    )
  }, [activeReport, fromDate, getExportMatrix, toDate])

  const topMedicineRows =
    activeReport === 'sales'
      ? (sales?.top_medicines ?? [])
      : activeReport === 'purchase'
        ? (purchase?.top_medicines ?? [])
        : []

  const tableRows =
    activeReport === 'sales'
      ? (sales?.daily ?? []).map((row) => ({
          report_date: row.report_date,
          bill_count: row.bill_count,
          gross_amount: row.gross_sales,
          discount_amount: row.discount_amount,
          net_amount: row.net_sales,
        }))
      : activeReport === 'purchase'
        ? (purchase?.daily ?? []).map((row) => ({
            report_date: row.report_date,
            bill_count: row.bill_count,
            gross_amount: row.gross_purchase,
            discount_amount: row.discount_amount,
            net_amount: row.net_purchase,
          }))
        : []

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Reports"
        subtitle="Sales, purchase, stock and GST reports with date range and exports"
      />

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setActiveReport('sales')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'sales'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Sales
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('purchase')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'purchase'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Purchase
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('stock')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'stock'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Stock
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('gst')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'gst' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          GST
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('profit-loss')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'profit-loss'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          P&L
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('expiry-writeoff')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'expiry-writeoff'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Expiry/Write-off
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('customer-outstanding')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'customer-outstanding'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Customer Due
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('supplier-outstanding')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'supplier-outstanding'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Supplier Due
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('audit')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'audit'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Audit
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('ca-package')}
          className={`rounded-md px-4 py-2 text-sm font-semibold min-h-touch ${
            activeReport === 'ca-package'
              ? 'bg-slate-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          CA Package
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {activeReport !== 'ca-package' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">From date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">To date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
                />
              </div>
            </>
          )}
          {activeReport === 'ca-package' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Financial Year
              </label>
              <input
                type="text"
                value={financialYear}
                onChange={(event) => setFinancialYear(event.target.value)}
                placeholder="2025-26"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
              />
            </div>
          )}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                activeReport === 'ca-package' ? void generateCAPackage() : void loadSalesReport()
              }
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:bg-slate-400 min-h-touch"
            >
              {isLoading
                ? 'Loading...'
                : activeReport === 'ca-package'
                  ? 'Generate CA Package'
                  : `Run ${
                      activeReport === 'sales'
                        ? 'Sales'
                        : activeReport === 'purchase'
                          ? 'Purchase'
                          : activeReport === 'stock'
                            ? 'Stock'
                            : activeReport === 'gst'
                              ? 'GST'
                              : activeReport === 'expiry-writeoff'
                                ? 'Expiry/Write-off'
                                : activeReport === 'customer-outstanding'
                                  ? 'Customer Outstanding'
                                  : activeReport === 'supplier-outstanding'
                                    ? 'Supplier Outstanding'
                                    : activeReport === 'audit'
                                      ? 'Audit'
                                      : 'P&L'
                    } Report`}
            </button>
          </div>
          {activeReport === 'purchase' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Supplier</label>
              <select
                value={selectedSupplierId ?? ''}
                onChange={(event) =>
                  setSelectedSupplierId(event.target.value ? Number(event.target.value) : undefined)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
              >
                <option value="">All suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => {
                void exportExcel()
              }}
              disabled={activeReport === 'ca-package'}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 min-h-touch"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={activeReport === 'ca-package'}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 min-h-touch"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 mt-4">
          <LoadingSpinner text={`Generating ${activeReport} report...`} />
        </div>
      ) : (
        <>
          {activeReport === 'ca-package' ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">CA Package</p>
              <p className="mt-1 text-sm text-emerald-700">
                Generate a ZIP with annual JSON reports (Sales, Purchase, Stock, GST, P&L, Audit)
                for filing and audit workflows.
              </p>
              {lastCAPackagePath && (
                <p className="mt-2 text-xs text-emerald-900 break-all">
                  Last package: {lastCAPackagePath}
                </p>
              )}
              <button
                type="button"
                onClick={() => void openCAPackageFolder()}
                disabled={!lastCAPackagePath}
                className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 min-h-touch"
              >
                Open Package Folder
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label={
                  activeReport === 'sales'
                    ? 'Net Sales'
                    : activeReport === 'purchase'
                      ? 'Net Purchase'
                      : activeReport === 'stock'
                        ? 'Purchase Value'
                        : activeReport === 'gst'
                          ? 'Taxable Value'
                          : activeReport === 'expiry-writeoff'
                            ? 'Expired Value'
                            : activeReport === 'customer-outstanding'
                              ? 'Customer Outstanding'
                              : activeReport === 'supplier-outstanding'
                                ? 'Supplier Outstanding'
                                : activeReport === 'audit'
                                  ? 'Audit Events'
                                  : 'Revenue'
                }
                value={
                  activeReport === 'audit'
                    ? formatNumber(auditSummary.total_events)
                    : activeReport === 'customer-outstanding'
                      ? formatCurrency(customerOutstandingSummary.total_outstanding)
                      : activeReport === 'supplier-outstanding'
                        ? formatCurrency(supplierOutstandingSummary.total_outstanding)
                        : formatCurrency(
                            activeReport === 'sales'
                              ? salesSummary.net_sales
                              : activeReport === 'purchase'
                                ? purchaseSummary.net_purchase
                                : activeReport === 'stock'
                                  ? stockSummary.purchase_value
                                  : activeReport === 'gst'
                                    ? gstSummary.taxable_amount
                                    : activeReport === 'expiry-writeoff'
                                      ? expiryWriteoffSummary.expired_stock_value
                                      : profitLossSummary.revenue
                          )
                }
              />
              <SummaryCard
                label={
                  activeReport === 'sales'
                    ? 'Gross Sales'
                    : activeReport === 'purchase'
                      ? 'Gross Purchase'
                      : activeReport === 'stock'
                        ? 'Selling Value'
                        : activeReport === 'gst'
                          ? 'Total GST'
                          : activeReport === 'expiry-writeoff'
                            ? 'Near Expiry Value'
                            : activeReport === 'customer-outstanding'
                              ? 'Over 30 Days'
                              : activeReport === 'supplier-outstanding'
                                ? 'Over 30 Days'
                                : activeReport === 'audit'
                                  ? 'Unique Users'
                                  : 'Gross Profit'
                }
                value={
                  activeReport === 'audit'
                    ? formatNumber(auditSummary.unique_users)
                    : activeReport === 'customer-outstanding'
                      ? formatCurrency(customerOutstandingSummary.over_30_days)
                      : activeReport === 'supplier-outstanding'
                        ? formatCurrency(supplierOutstandingSummary.over_30_days)
                        : formatCurrency(
                            activeReport === 'sales'
                              ? salesSummary.gross_sales
                              : activeReport === 'purchase'
                                ? purchaseSummary.gross_purchase
                                : activeReport === 'stock'
                                  ? stockSummary.selling_value
                                  : activeReport === 'gst'
                                    ? gstSummary.total_gst
                                    : activeReport === 'expiry-writeoff'
                                      ? expiryWriteoffSummary.near_expiry_stock_value
                                      : profitLossSummary.gross_profit
                          )
                }
              />
              <SummaryCard
                label={
                  activeReport === 'stock'
                    ? 'Stock Lines'
                    : activeReport === 'gst'
                      ? 'CGST'
                      : activeReport === 'expiry-writeoff'
                        ? 'Expired Lines'
                        : activeReport === 'customer-outstanding'
                          ? 'Customers with Due'
                          : activeReport === 'supplier-outstanding'
                            ? 'Suppliers with Due'
                            : activeReport === 'profit-loss'
                              ? 'Estimated COGS'
                              : activeReport === 'audit'
                                ? 'Unique Modules'
                                : 'Total Bills'
                }
                value={
                  activeReport === 'gst'
                    ? formatCurrency(gstSummary.cgst_amount)
                    : activeReport === 'expiry-writeoff'
                      ? formatNumber(expiryWriteoffSummary.expired_lines)
                      : activeReport === 'customer-outstanding'
                        ? formatNumber(customerOutstandingSummary.total_customers)
                        : activeReport === 'supplier-outstanding'
                          ? formatNumber(supplierOutstandingSummary.total_suppliers)
                          : activeReport === 'profit-loss'
                            ? formatCurrency(profitLossSummary.estimated_cogs)
                            : activeReport === 'audit'
                              ? formatNumber(auditSummary.unique_modules)
                              : formatNumber(
                                  activeReport === 'sales'
                                    ? salesSummary.total_bills
                                    : activeReport === 'purchase'
                                      ? purchaseSummary.total_bills
                                      : stockSummary.total_lines
                                )
                }
              />
              <SummaryCard
                label={
                  activeReport === 'stock'
                    ? 'Estimated Margin'
                    : activeReport === 'gst'
                      ? 'Invoice Value'
                      : activeReport === 'expiry-writeoff'
                        ? 'Write-off Value'
                        : activeReport === 'customer-outstanding'
                          ? 'Over 90 Days'
                          : activeReport === 'supplier-outstanding'
                            ? 'Over 90 Days'
                            : activeReport === 'profit-loss'
                              ? 'Net Profit'
                              : activeReport === 'audit'
                                ? 'Date Range'
                                : 'Average Bill Value'
                }
                value={
                  activeReport === 'stock'
                    ? formatCurrency(stockSummary.estimated_margin)
                    : activeReport === 'gst'
                      ? formatCurrency(gstSummary.total_invoice_value)
                      : activeReport === 'expiry-writeoff'
                        ? formatCurrency(expiryWriteoffSummary.writeoff_value)
                        : activeReport === 'customer-outstanding'
                          ? formatCurrency(customerOutstandingSummary.over_90_days)
                          : activeReport === 'supplier-outstanding'
                            ? formatCurrency(supplierOutstandingSummary.over_90_days)
                            : activeReport === 'profit-loss'
                              ? formatCurrency(profitLossSummary.net_profit)
                              : activeReport === 'audit'
                                ? `${auditSummary.from_date || '--'} to ${auditSummary.to_date || '--'}`
                                : formatCurrency(
                                    activeReport === 'sales'
                                      ? salesSummary.avg_bill_value
                                      : purchaseSummary.avg_bill_value
                                  )
                }
              />
            </div>
          )}

          {(activeReport === 'sales' || activeReport === 'purchase') && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {activeReport === 'sales' ? 'Payment Mix' : 'Supplier Mix'}
                </h3>
                <div className="mt-3 space-y-2">
                  {activeReport === 'sales'
                    ? (sales?.payment_breakdown ?? []).map((row) => (
                        <div
                          key={row.payment_mode}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <span className="text-sm capitalize text-slate-700">
                            {row.payment_mode}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(row.total_amount)}
                          </span>
                        </div>
                      ))
                    : (purchase?.supplier_breakdown ?? []).map((row) => (
                        <div
                          key={row.supplier_id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">{row.supplier_name}</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(row.total_amount)}
                          </span>
                        </div>
                      ))}
                  {activeReport === 'sales' && (sales?.payment_breakdown ?? []).length === 0 && (
                    <p className="text-sm text-slate-500">
                      No payment rows found for selected dates.
                    </p>
                  )}
                  {activeReport === 'purchase' &&
                    (purchase?.supplier_breakdown ?? []).length === 0 && (
                      <p className="text-sm text-slate-500">
                        No supplier rows found for selected dates.
                      </p>
                    )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {activeReport === 'sales' ? 'Top Medicines' : 'Top Purchased Medicines'}
                </h3>
                <div className="mt-3 space-y-2">
                  {topMedicineRows.map((row) => (
                    <div
                      key={row.medicine_name}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-slate-900">{row.medicine_name}</p>
                      <p className="text-xs text-slate-600">
                        Qty: {formatNumber(row.total_quantity)} |{' '}
                        {activeReport === 'sales' ? 'Sales' : 'Purchase'}:{' '}
                        {formatCurrency(row.total_amount)}
                      </p>
                    </div>
                  ))}
                  {topMedicineRows.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No medicine rows found for selected dates.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeReport === 'gst' && (
            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">HSN Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">HSN</th>
                        <th className="px-4 py-3 text-right font-medium">Bills</th>
                        <th className="px-4 py-3 text-right font-medium">Taxable</th>
                        <th className="px-4 py-3 text-right font-medium">CGST</th>
                        <th className="px-4 py-3 text-right font-medium">SGST</th>
                        <th className="px-4 py-3 text-right font-medium">IGST</th>
                        <th className="px-4 py-3 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gst?.hsn_summary ?? []).map((row) => (
                        <tr key={row.hsn_code} className="border-t border-slate-100">
                          <td className="px-4 py-2.5 text-slate-700">{row.hsn_code}</td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatNumber(row.bill_count)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.taxable_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.cgst_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.sgst_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.igst_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-900 font-semibold">
                            {formatCurrency(row.total_amount)}
                          </td>
                        </tr>
                      ))}
                      {(gst?.hsn_summary ?? []).length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No HSN rows found for selected date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">Daily GST</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-right font-medium">Bills</th>
                        <th className="px-4 py-3 text-right font-medium">Taxable</th>
                        <th className="px-4 py-3 text-right font-medium">CGST</th>
                        <th className="px-4 py-3 text-right font-medium">SGST</th>
                        <th className="px-4 py-3 text-right font-medium">IGST</th>
                        <th className="px-4 py-3 text-right font-medium">Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gst?.daily ?? []).map((row) => (
                        <tr key={row.report_date} className="border-t border-slate-100">
                          <td className="px-4 py-2.5 text-slate-700">{row.report_date}</td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatNumber(row.bill_count)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.taxable_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.cgst_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.sgst_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {formatCurrency(row.igst_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-900 font-semibold">
                            {formatCurrency(row.invoice_value)}
                          </td>
                        </tr>
                      ))}
                      {(gst?.daily ?? []).length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No GST rows found for selected date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'profit-loss' && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Daily Profit and Loss</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-right font-medium">Revenue</th>
                      <th className="px-4 py-3 text-right font-medium">Discounts</th>
                      <th className="px-4 py-3 text-right font-medium">Estimated COGS</th>
                      <th className="px-4 py-3 text-right font-medium">Gross Profit</th>
                      <th className="px-4 py-3 text-right font-medium">Gross Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profitLoss?.daily ?? []).map((row) => (
                      <tr key={row.report_date} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 text-slate-700">{row.report_date}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(row.discounts)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(row.estimated_cogs)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-900 font-semibold">
                          {formatCurrency(row.gross_profit)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {row.gross_margin_pct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                    {(profitLoss?.daily ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No P&L rows found for selected date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'audit' && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Audit Events</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                      <th className="px-4 py-3 text-left font-medium">User</th>
                      <th className="px-4 py-3 text-left font-medium">Action</th>
                      <th className="px-4 py-3 text-left font-medium">Module</th>
                      <th className="px-4 py-3 text-left font-medium">Record</th>
                      <th className="px-4 py-3 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(auditLog?.rows ?? []).map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 text-slate-700">{row.created_at}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.user_name}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.action}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.module}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.record_id || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.notes || '-'}</td>
                      </tr>
                    ))}
                    {(auditLog?.rows ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No audit events found for selected date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'expiry-writeoff' && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Expiry and Write-off</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Medicine</th>
                      <th className="px-4 py-3 text-left font-medium">Batch</th>
                      <th className="px-4 py-3 text-left font-medium">Expiry</th>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Purchase Value</th>
                      <th className="px-4 py-3 text-right font-medium">Days</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(expiryWriteoff?.items ?? []).map((row) => (
                      <tr
                        key={`${row.medicine_name}-${row.batch_number}-${row.expiry_date}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-2.5 text-slate-700">{row.medicine_name}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.batch_number}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.expiry_date}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatNumber(row.quantity_on_hand)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(row.purchase_value)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatNumber(row.days_to_expiry)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 capitalize">
                          {row.status.replace('_', ' ')}
                        </td>
                      </tr>
                    ))}
                    {(expiryWriteoff?.items ?? []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No expiry/write-off rows found for selected date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'customer-outstanding' && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Customer Outstanding</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Customer</th>
                      <th className="px-4 py-3 text-left font-medium">Phone</th>
                      <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                      <th className="px-4 py-3 text-left font-medium">Last Bill</th>
                      <th className="px-4 py-3 text-right font-medium">Days</th>
                      <th className="px-4 py-3 text-left font-medium">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(customerOutstanding?.rows ?? []).map((row) => (
                      <tr key={row.customer_id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 text-slate-700">{row.customer_name}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.phone || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          {formatCurrency(row.outstanding_balance)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.last_bill_date || '-'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatNumber(row.days_since_last_bill)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.age_bucket}</td>
                      </tr>
                    ))}
                    {(customerOutstanding?.rows ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No customer outstanding rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'supplier-outstanding' && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Supplier Outstanding</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Supplier</th>
                      <th className="px-4 py-3 text-left font-medium">Phone</th>
                      <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                      <th className="px-4 py-3 text-left font-medium">Last Bill</th>
                      <th className="px-4 py-3 text-right font-medium">Days</th>
                      <th className="px-4 py-3 text-left font-medium">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(supplierOutstanding?.rows ?? []).map((row) => (
                      <tr key={row.supplier_id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 text-slate-700">{row.supplier_name}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.phone || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          {formatCurrency(row.outstanding_balance)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.last_bill_date || '-'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatNumber(row.days_since_last_bill)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.age_bucket}</td>
                      </tr>
                    ))}
                    {(supplierOutstanding?.rows ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No supplier outstanding rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'stock' && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Stock Valuation Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Medicine</th>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Purchase Value</th>
                      <th className="px-4 py-3 text-right font-medium">Selling Value</th>
                      <th className="px-4 py-3 text-right font-medium">Batches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stock?.items ?? []).map((row) => (
                      <tr key={row.medicine_id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 text-slate-700">{row.medicine_name}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatNumber(row.quantity_on_hand)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(row.purchase_value)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-900 font-semibold">
                          {formatCurrency(row.selling_value)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatNumber(row.batch_count)}
                        </td>
                      </tr>
                    ))}
                    {(stock?.items ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          No stock valuation rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(activeReport === 'sales' || activeReport === 'purchase') && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  {activeReport === 'sales' ? 'Daily Sales' : 'Daily Purchase'}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-right font-medium">Bills</th>
                      <th className="px-4 py-3 text-right font-medium">
                        {activeReport === 'sales' ? 'Gross' : 'Gross Purchase'}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">Discount</th>
                      <th className="px-4 py-3 text-right font-medium">
                        {activeReport === 'sales' ? 'Net' : 'Net Purchase'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.report_date} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 text-slate-700">{row.report_date}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatNumber(row.bill_count)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(row.gross_amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(row.discount_amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          {formatCurrency(row.net_amount)}
                        </td>
                      </tr>
                    ))}
                    {tableRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          No daily rows found for selected date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
