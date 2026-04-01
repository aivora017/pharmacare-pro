import { invoke } from '@tauri-apps/api/core';

export interface NarcoticEntry {
  id: number;
  entry_date: string;
  bill_id: number | null;
  bill_number: string;
  patient_name: string;
  patient_address: string;
  patient_age: string;
  doctor_name: string;
  doctor_reg_no: string;
  medicine_name: string;
  medicine_id: number | null;
  batch_number: string;
  quantity_dispensed: number;
  unit: string;
  opening_balance: number;
  quantity_received: number;
  closing_balance: number;
  supplier_name: string;
  purchase_invoice_no: string;
  remarks: string;
  created_at: string;
}

export type NarcoticEntryCreate = Omit<NarcoticEntry, 'id' | 'created_at'>;

export interface PrescriptionEntry {
  id: number;
  entry_date: string;
  bill_id: number | null;
  bill_number: string;
  patient_name: string;
  patient_age: string;
  patient_address: string;
  doctor_name: string;
  doctor_reg_no: string;
  medicine_name: string;
  medicine_id: number | null;
  schedule: string;
  batch_number: string;
  quantity: number;
  unit: string;
  remarks: string;
  created_at: string;
}

export type PrescriptionEntryCreate = Omit<PrescriptionEntry, 'id' | 'created_at'>;

export interface LicenceAlert {
  key: string;
  label: string;
  expiry_date: string;
  days_left: number;
  level: 'expired' | 'critical' | 'warning' | 'info';
}

export interface LicenceSettings {
  drug_licence_no: string;
  drug_licence_expiry: string;
  fssai_licence_no: string;
  fssai_licence_expiry: string;
  schedule_x_licence_no: string;
  schedule_x_licence_expiry: string;
  pharmacy_state_code: string;
  pharmacy_city: string;
  pharmacy_pincode: string;
  irp_username: string;
  irp_sandbox_mode: string;
  ewb_username: string;
  ewb_sandbox_mode: string;
}

export interface DrugInteractionRow {
  id: number;
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  management: string;
}

export interface InteractionStats {
  total: number;
  major: number;
  moderate: number;
  minor: number;
}

export const complianceService = {
  // Narcotic Register
  async listNarcotic(from: string, to: string): Promise<{ entries: NarcoticEntry[]; count: number }> {
    return invoke('compliance_list_narcotic', { from, to });
  },

  async createNarcoticEntry(entry: NarcoticEntryCreate, userId: number): Promise<number> {
    return invoke('compliance_create_narcotic', { entry, userId });
  },

  async updateNarcoticEntry(id: number, entry: NarcoticEntryCreate): Promise<void> {
    return invoke('compliance_update_narcotic', { id, entry });
  },

  async deleteNarcoticEntry(id: number): Promise<void> {
    return invoke('compliance_delete_narcotic', { id });
  },

  // Prescription Register
  async listPrescription(from: string, to: string): Promise<{ entries: PrescriptionEntry[]; count: number }> {
    return invoke('compliance_list_prescription', { from, to });
  },

  async createPrescriptionEntry(entry: PrescriptionEntryCreate, userId: number): Promise<number> {
    return invoke('compliance_create_prescription', { entry, userId });
  },

  async updatePrescriptionEntry(id: number, entry: PrescriptionEntryCreate): Promise<void> {
    return invoke('compliance_update_prescription', { id, entry });
  },

  async deletePrescriptionEntry(id: number): Promise<void> {
    return invoke('compliance_delete_prescription', { id });
  },

  // Licence Alerts
  async getLicenceAlerts(): Promise<{ alerts: LicenceAlert[]; count: number }> {
    return invoke('compliance_get_licence_alerts');
  },

  async getLicenceSettings(): Promise<LicenceSettings> {
    return invoke('compliance_get_licence_settings');
  },

  async saveLicenceSettings(settings: Partial<LicenceSettings>, userId: number): Promise<void> {
    return invoke('compliance_save_licence_settings', { settings, userId });
  },

  // Drug Interactions
  async getInteractionStats(): Promise<InteractionStats> {
    return invoke('compliance_get_interaction_stats');
  },

  async listInteractions(search = '', severity?: string): Promise<{ interactions: DrugInteractionRow[]; count: number }> {
    return invoke('compliance_list_interactions', { search, severity: severity ?? null });
  },

  async createInteraction(entry: Omit<DrugInteractionRow, 'id'>): Promise<number> {
    return invoke('compliance_create_interaction', { entry });
  },

  async deleteInteraction(id: number): Promise<void> {
    return invoke('compliance_delete_interaction', { id });
  },
};
