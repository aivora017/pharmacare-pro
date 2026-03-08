// PharmaCare Pro — All TypeScript types
// Import: import type { IMedicine, IBill } from "@/types"

export interface IMedicine {
  id: number; name: string; generic_name: string
  manufacturer_id?: number; manufacturer_name?: string
  category_id?: number; category_name?: string
  composition?: string; hsn_code?: string
  schedule: "OTC"|"H"|"H1"|"X"|"Narcotic"
  drug_form?: string; strength?: string; pack_size?: string
  default_gst_rate: number; reorder_level: number; reorder_quantity: number
  is_cold_chain: boolean; is_active: boolean; image_path?: string; notes?: string
  total_stock?: number; batches?: IBatch[]; created_at: string; updated_at: string
}

export interface IBatch {
  id: number; medicine_id: number; medicine_name?: string
  batch_number: string; barcode?: string; expiry_date: string; manufacture_date?: string
  purchase_price: number; selling_price: number
  quantity_in: number; quantity_sold: number; quantity_adjusted: number; quantity_on_hand: number
  rack_location?: string; supplier_id?: number; supplier_name?: string
  purchase_bill_id?: number; is_active: boolean
  expiry_risk?: IExpiryRisk; created_at: string
}

export interface ICartItem {
  medicine_id: number; batch_id: number; medicine_name: string
  batch_number: string; expiry_date: string; quantity: number
  unit_price: number; mrp: number; discount_percent: number; discount_amount: number
  gst_rate: number; cgst_amount: number; sgst_amount: number; igst_amount: number
  total_amount: number; is_near_expiry?: boolean
  interaction_warnings?: IDrugInteraction[]
}

export interface IBill {
  id: number; bill_number: string; customer_id?: number; customer_name?: string
  doctor_id?: number; doctor_name?: string; bill_date: string
  status: "active"|"cancelled"|"returned"
  subtotal: number; discount_amount: number; taxable_amount: number
  cgst_amount: number; sgst_amount: number; igst_amount: number
  total_amount: number; round_off: number; net_amount: number
  amount_paid: number; change_returned: number; outstanding: number
  loyalty_points_earned: number; loyalty_points_redeemed: number
  notes?: string; items?: IBillItem[]; payments?: IPayment[]
  created_by: number; created_by_name?: string; created_at: string
}

export interface IBillItem {
  id: number; bill_id: number; medicine_id: number; batch_id: number
  medicine_name: string; batch_number: string; expiry_date: string
  quantity: number; unit_price: number; mrp: number
  discount_percent: number; discount_amount: number; gst_rate: number
  cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number
}

export interface IPayment {
  id: number; bill_id?: number; purchase_bill_id?: number; amount: number
  payment_mode: "cash"|"upi"|"card"|"credit"|"cheque"
  reference_no?: string; payment_date: string; notes?: string
}

export interface ICustomer {
  id: number; name: string; phone?: string; phone2?: string; email?: string
  date_of_birth?: string; age?: number; gender?: "M"|"F"|"Other"; blood_group?: string
  address?: string; pincode?: string; doctor_id?: number; doctor_name?: string
  allergies: string[]; chronic_conditions: string[]
  outstanding_balance: number; loyalty_points: number
  med_sync_date?: number; is_active: boolean; notes?: string
  segment?: string; last_purchase_days?: number
  created_at: string; updated_at: string
}

export interface IDoctor {
  id: number; name: string; registration_no?: string; specialisation?: string
  qualification?: string; clinic_name?: string; phone?: string; email?: string
  is_active: boolean; created_at: string
}

export interface ISupplier {
  id: number; name: string; contact_person?: string; phone?: string; email?: string
  email_domain?: string; gstin?: string; drug_licence_no?: string
  drug_licence_expiry?: string; payment_terms: number
  credit_limit: number; outstanding_balance: number; reliability_score: number
  is_active: boolean; created_at: string
}

export interface IPurchaseBill {
  id: number; bill_number: string; supplier_id: number; supplier_name?: string
  bill_date: string; due_date?: string; total_amount: number; amount_paid: number
  payment_status: "unpaid"|"partial"|"paid"; source: "manual"|"email_import"
  items?: IPurchaseBillItem[]; created_at: string
}

export interface IPurchaseBillItem {
  id: number; purchase_bill_id: number; medicine_id: number; medicine_name?: string
  batch_number: string; expiry_date: string; quantity: number; free_quantity: number
  unit_price: number; discount_percent: number; gst_rate: number; total_amount: number
}

export interface IDrugInteraction {
  drug1: string; drug2: string; severity: "minor"|"moderate"|"severe"
  description: string; recommendation: string
}

export interface IExpiryRisk {
  batch_id: number; risk_score: number; risk_level: "low"|"medium"|"high"|"critical"
  sellable_days?: number; action_suggested: string
}

export interface IDemandForecast {
  medicine_id: number; medicine_name: string; current_stock: number
  forecast_30day: number; recommended_order: number
  confidence: number; trend: "up"|"down"|"stable"
}

export interface IAnomaly {
  id: number; anomaly_type: string; severity: "low"|"medium"|"high"
  description: string; record_type?: string; record_id?: number
  user_name?: string; is_reviewed: boolean; detected_at: string
}

export interface IBriefingAction {
  priority: "urgent"|"important"|"info"; icon: string; message: string; link?: string
}

export interface ITodaySummary {
  total_revenue: number; bill_count: number; avg_bill_value: number
  cash_amount: number; upi_amount: number; card_amount: number; credit_amount: number
}

export type LoadingState = "idle"|"loading"|"success"|"error"
export type PaymentMode = "cash"|"upi"|"card"|"credit"|"cheque"
export type ScheduleType = "OTC"|"H"|"H1"|"X"|"Narcotic"
