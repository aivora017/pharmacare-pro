import { invoke } from '@tauri-apps/api/core';

export interface Gstr1Invoice {
  bill_number: string;
  bill_date: string;
  gstin: string;
  customer_name: string;
  medicine_name: string;
  hsn_code: string;
  gst_rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export interface Gstr1Result {
  period: string;
  invoices: Gstr1Invoice[];
  count: number;
}

export interface Gstr3bResult {
  period: string;
  outward_supplies: {
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
  itc_available: {
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
  };
  net_gst_payable: {
    cgst: number;
    sgst: number;
    igst: number;
  };
}

export interface PurchaseBill {
  invoice_number: string;
  purchase_date: string;
  supplier_name: string;
  supplier_gstin: string;
  total_amount: number;
}

export interface ReconResult {
  period: string;
  matched_count: number;
  unmatched_ours: PurchaseBill[];
  unmatched_portal: unknown[];
  matched: PurchaseBill[];
}

export const gstService = {
  async getGstr1(month: string, year: string): Promise<Gstr1Result> {
    return invoke('gst_get_gstr1', { month, year });
  },

  async exportGstr1Json(month: string, year: string): Promise<{ path: string; invoice_count: number; data: unknown }> {
    return invoke('gst_export_gstr1_json', { month, year });
  },

  async getGstr3b(month: string, year: string): Promise<Gstr3bResult> {
    return invoke('gst_get_gstr3b', { month, year });
  },

  async getPurchaseBillsForRecon(month: string, year: string): Promise<{ period: string; purchases: PurchaseBill[]; count: number }> {
    return invoke('gst_get_purchase_bills_for_recon', { month, year });
  },

  async reconcileGstr2b(month: string, year: string, portalData: unknown): Promise<ReconResult> {
    return invoke('gst_reconcile_gstr2b', { month, year, portalData });
  },

  async generateEinvoice(billId: number): Promise<{ status: string; message: string; bill_number: string; irn: string | null; qr_code: string | null }> {
    return invoke('gst_generate_einvoice', { billId });
  },

  async generateEwaybill(billId: number): Promise<{ status: string; message: string; bill_number: string; ewb_no: string | null }> {
    return invoke('gst_generate_ewaybill', { billId });
  },
};
