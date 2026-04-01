export interface IUser{id:number;name:string;email:string;role_id:number;role_name:string;permissions:Record<string,boolean>}
export interface IMedicine{id:number;name:string;generic_name:string;composition?:string;hsn_code?:string;schedule:'OTC'|'H'|'H1'|'X'|'Narcotic';drug_form?:string;strength?:string;pack_size?:string;default_gst_rate:number;reorder_level:number;reorder_quantity:number;is_cold_chain:boolean;is_active:boolean;category_id?:number;category_name?:string;notes?:string;total_stock?:number;created_at:string;updated_at:string}
export interface IBatch{id:number;medicine_id:number;batch_number:string;barcode?:string;expiry_date:string;purchase_price:number;selling_price:number;quantity_in:number;quantity_sold:number;quantity_adjusted:number;quantity_on_hand:number;rack_location?:string;is_active:boolean}
export interface ICartItem{medicine_id:number;batch_id:number;medicine_name:string;batch_number:string;expiry_date:string;quantity:number;unit_price:number;mrp:number;discount_percent:number;discount_amount:number;gst_rate:number;cgst_amount:number;sgst_amount:number;igst_amount:number;total_amount:number;is_near_expiry?:boolean;is_schedule_h?:boolean}
export interface IBillTotals{subtotal:number;item_discount:number;bill_discount:number;taxable:number;cgst:number;sgst:number;igst:number;total_gst:number;round_off:number;net_amount:number}
export interface IBill{id:number;bill_number:string;customer_id?:number;customer_name?:string;bill_date:string;status:'active'|'cancelled'|'returned';net_amount:number;amount_paid:number;outstanding:number;subtotal?:number;discount_amount?:number;taxable_amount?:number;cgst_amount?:number;sgst_amount?:number;igst_amount?:number;total_amount?:number;round_off?:number;created_at:string;items?:IBillItem[];payments?:IPayment[]}
export interface IBillItem{id:number;bill_id:number;medicine_id:number;batch_id:number;medicine_name:string;batch_number:string;expiry_date:string;quantity:number;unit_price:number;mrp:number;discount_percent:number;discount_amount:number;gst_rate:number;cgst_amount:number;sgst_amount:number;igst_amount:number;total_amount:number}
export interface IPayment{id:number;amount:number;payment_mode:'cash'|'upi'|'card'|'credit'|'cheque';reference_no?:string;payment_date:string}
export interface ICustomer{id:number;name:string;phone?:string;email?:string;outstanding_balance:number;loyalty_points:number;is_active:boolean;created_at:string}
export interface ISupplier{id:number;name:string;contact_person?:string;phone?:string;email?:string;gstin?:string;drug_licence_no?:string;drug_licence_expiry?:string;payment_terms:number;credit_limit:number;outstanding_balance:number;is_active:boolean}
export interface IBriefingAction{priority:'urgent'|'important'|'info';icon:string;message:string;link?:string}
export type PaymentMode='cash'|'upi'|'card'|'credit'|'cheque'

export interface IStockItem {
  id: number
  name: string
  generic_name: string
  schedule: string
  reorder_level: number
  category_name: string
  total_stock: number
}

export interface ISaleReturn {
  id: number
  return_number: string
  original_bill_id: number
  original_bill_number?: string
  return_date: string
  reason?: string
  total_amount: number
  created_at: string
}

export interface IDoctor {
  id: number; name: string; registration_no?: string; specialisation?: string
  qualification?: string; clinic_name?: string; phone?: string; email?: string
  notes?: string; is_active: boolean; created_at: string
}
