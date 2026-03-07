// ============================================================
// PharmaCare Pro — Core TypeScript Types
// ============================================================
// All shared types used across the application.
// Import from here: import type { IMedicine } from '@/types/medicine'
// ============================================================

// ─── MEDICINE ────────────────────────────────────────────────

export interface IMedicine {
  id: number
  name: string                  // Brand name
  generic_name: string          // Generic/salt name
  manufacturer_id?: number
  manufacturer_name?: string    // Joined from manufacturers table
  category_id?: number
  category_name?: string        // Joined from categories table
  composition?: string
  hsn_code?: string
  schedule: 'OTC' | 'H' | 'H1' | 'X' | 'Narcotic'
  drug_form?: string
  strength?: string
  pack_size?: string
  default_gst_rate: number
  reorder_level: number
  reorder_quantity: number
  is_cold_chain: boolean
  is_active: boolean
  image_path?: string
  notes?: string
  // Computed fields (from joins)
  total_stock?: number          // Sum of all active batch quantities
  batches?: IBatch[]
  created_at: string
  updated_at: string
}

export interface IBatch {
  id: number
  medicine_id: number
  medicine_name?: string        // Joined for display
  batch_number: string
  barcode?: string
  expiry_date: string           // 'YYYY-MM-DD'
  manufacture_date?: string
  purchase_price: number
  selling_price: number         // MRP
  quantity_in: number
  quantity_sold: number
  quantity_adjusted: number
  quantity_on_hand: number      // Computed: in - sold - adjusted
  rack_location?: string        // 'A-2-3' format
  supplier_id?: number
  supplier_name?: string
  purchase_bill_id?: number
  is_active: boolean
  expiry_risk?: IExpiryRisk     // AI risk score (if loaded)
  created_at: string
}

export interface ICategory {
  id: number
  name: string
  description?: string
}

export interface IManufacturer {
  id: number
  name: string
  country: string
}

// ─── CUSTOMER & DOCTOR ────────────────────────────────────────

export interface ICustomer {
  id: number
  name: string
  phone?: string
  phone2?: string
  email?: string
  date_of_birth?: string
  age?: number                  // Computed from DOB
  gender?: 'M' | 'F' | 'Other'
  blood_group?: string
  address?: string
  pincode?: string
  doctor_id?: number
  doctor_name?: string
  allergies: string[]           // Parsed from JSON
  chronic_conditions: string[]  // Parsed from JSON
  outstanding_balance: number
  loyalty_points: number
  med_sync_date?: number
  preferred_language: string
  communication_pref: string
  notes?: string
  photo_path?: string
  is_active: boolean
  // AI fields
  segment?: string
  clv_score?: number
  last_purchase_days?: number
  created_at: string
}

export interface IDoctor {
  id: number
  name: string
  registration_no?: string
  specialisation?: string
  qualification?: string
  clinic_name?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active: boolean
  // Analytics
  total_bills?: number
  total_revenue?: number
  created_at: string
}

// ─── SUPPLIER ────────────────────────────────────────────────

export interface ISupplier {
  id: number
  name: string
  contact_person?: string
  phone?: string
  email?: string
  email_domain?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  drug_licence_no?: string
  drug_licence_expiry?: string
  pan_no?: string
  payment_terms: number
  credit_limit: number
  outstanding_balance: number
  reliability_score: number     // AI score 0-100
  notes?: string
  is_active: boolean
  created_at: string
}

// ─── BILLING ─────────────────────────────────────────────────

export interface ICartItem {
  // In-memory cart item (not saved to DB yet)
  medicine_id: number
  batch_id: number
  medicine_name: string
  batch_number: string
  expiry_date: string
  quantity: number
  unit_price: number
  mrp: number
  discount_percent: number
  discount_amount: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  // AI suggestions
  interaction_warnings?: IDrugInteraction[]
  is_near_expiry?: boolean
}

export interface IBill {
  id: number
  bill_number: string
  customer_id?: number
  customer_name?: string
  doctor_id?: number
  doctor_name?: string
  bill_date: string
  status: 'active' | 'cancelled' | 'returned'
  prescription_ref?: string
  prescription_image?: string
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  round_off: number
  net_amount: number
  amount_paid: number
  change_returned: number
  outstanding: number
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  notes?: string
  items?: IBillItem[]
  payments?: IPayment[]
  created_by: number
  created_by_name?: string
  created_at: string
}

export interface IBillItem {
  id: number
  bill_id: number
  medicine_id: number
  batch_id: number
  medicine_name: string
  batch_number: string
  expiry_date: string
  quantity: number
  unit_price: number
  mrp: number
  discount_percent: number
  discount_amount: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
}

export interface IPayment {
  id: number
  bill_id?: number
  purchase_bill_id?: number
  amount: number
  payment_mode: 'cash' | 'upi' | 'card' | 'credit' | 'cheque'
  reference_no?: string
  payment_date: string
  notes?: string
}

// ─── PURCHASE ────────────────────────────────────────────────

export interface IPurchaseBill {
  id: number
  bill_number: string
  supplier_id: number
  supplier_name?: string
  purchase_order_id?: number
  bill_date: string
  due_date?: string
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  amount_paid: number
  payment_status: 'unpaid' | 'partial' | 'paid'
  source: 'manual' | 'email_import'
  notes?: string
  items?: IPurchaseBillItem[]
  created_at: string
}

export interface IPurchaseBillItem {
  id: number
  purchase_bill_id: number
  medicine_id: number
  medicine_name?: string
  batch_number: string
  expiry_date: string
  quantity: number
  free_quantity: number
  unit_price: number
  discount_percent: number
  gst_rate: number
  total_amount: number
}

// ─── USER & AUTH ─────────────────────────────────────────────

export interface IUser {
  id: number
  name: string
  email: string
  phone?: string
  role_id: number
  role_name?: string
  permissions?: IPermissions
  is_active: boolean
  last_login_at?: string
}

export interface IPermissions {
  all?: boolean
  billing?: boolean
  medicine?: boolean
  purchase?: boolean
  customers?: boolean
  reports?: boolean
  expiry?: boolean
  barcodes?: boolean
  settings?: boolean
  ai?: boolean
}

export interface IAuthState {
  user: IUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// ─── AI TYPES ────────────────────────────────────────────────

export interface IDemandForecast {
  medicine_id: number
  medicine_name: string
  current_stock: number
  forecast_7day: number
  forecast_14day: number
  forecast_30day: number
  recommended_order: number
  confidence: number            // 0.0 - 1.0
  trend: 'up' | 'down' | 'stable'
}

export interface IExpiryRisk {
  batch_id: number
  risk_score: number            // 1.0 (low) to 10.0 (critical)
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  sellable_days?: number
  action_suggested: string
}

export interface ICustomerSegment {
  customer_id: number
  customer_name?: string
  segment: 'champion' | 'chronic' | 'at_risk' | 'dormant' | 'new' | 'high_value'
  clv_score?: number
  last_purchase_days?: number
  avg_monthly_spend?: number
  action?: string               // Recommended action text
}

export interface IDrugInteraction {
  drug1: string
  drug2: string
  severity: 'minor' | 'moderate' | 'severe'
  description: string
  recommendation: string
}

export interface IAnomaly {
  id: number
  anomaly_type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  record_type?: string
  record_id?: number
  user_id?: number
  user_name?: string
  is_reviewed: boolean
  detected_at: string
}

export interface IMorningBriefing {
  date: string
  sales_today: number
  sales_change_percent: number
  low_stock_count: number
  expiry_risk_count: number
  at_risk_customers: number
  anomaly_count: number
  top_actions: IBriefingAction[]
}

export interface IBriefingAction {
  priority: 'urgent' | 'important' | 'info'
  icon: string
  message: string
  link?: string                 // Route to navigate to
}

// ─── REPORTS ─────────────────────────────────────────────────

export interface IReportFilter {
  from_date: string
  to_date: string
  supplier_id?: number
  customer_id?: number
  doctor_id?: number
  category_id?: number
  payment_mode?: string
}

export interface ISalesReport {
  period: string
  total_bills: number
  total_revenue: number
  total_discount: number
  total_gst: number
  net_revenue: number
  cash_amount: number
  upi_amount: number
  card_amount: number
  credit_amount: number
}

// ─── COMMON UTILS ────────────────────────────────────────────

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface IApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

export interface IPagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface ITableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  width?: string
  render?: (value: unknown, row: T) => React.ReactNode
}
