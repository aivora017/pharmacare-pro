import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"

interface BusinessProfile {
  pharmacy_name: string
  pharmacy_address: string
  pharmacy_phone: string
  pin_code: string
  drug_licence_no: string
  gstin: string
  legal_name: string
  trade_name: string
  state_code: string
  state_name: string
  reg_type: string
  gst_enabled: boolean
  onboarding_complete: boolean
}

interface SettingsState {
  gstEnabled: boolean
  onboardingComplete: boolean
  profile: BusinessProfile | null
  setGstEnabled: (v: boolean) => void
  setOnboardingComplete: (v: boolean) => void
  loadStatus: () => Promise<void>
  loadProfile: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gstEnabled: false,
  onboardingComplete: true, // default true to avoid flash redirect before load
  profile: null,

  setGstEnabled: (v) => set({ gstEnabled: v }),
  setOnboardingComplete: (v) => set({ onboardingComplete: v }),

  loadStatus: async () => {
    try {
      const res = await invoke<{ onboarding_complete: boolean; gst_enabled: boolean }>("onboarding_status")
      set({ gstEnabled: res.gst_enabled, onboardingComplete: res.onboarding_complete })
    } catch {
      // DB not ready yet — keep defaults
    }
  },

  loadProfile: async () => {
    try {
      const res = await invoke<BusinessProfile>("business_profile_get")
      set({ profile: res, gstEnabled: res.gst_enabled, onboardingComplete: res.onboarding_complete })
    } catch {}
  },
}))
