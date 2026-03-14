/**
 * License validation and activation (LemonSqueezy).
 */
import { invoke } from "@tauri-apps/api/core"

export interface LicenseStatus { status: "trial"|"active"|"expired"; tier?: string; trial_days_left?: number; expires_at?: string }

export const licenseService = {
  getStatus:  async (): Promise<LicenseStatus> =>
    invoke<LicenseStatus>("license_get_status"),
  validate:   async (): Promise<LicenseStatus> =>
    invoke<LicenseStatus>("license_validate"),
  activate:   async (licenseKey: string, actorUserId: number): Promise<LicenseStatus> =>
    invoke<LicenseStatus>("license_activate", { licenseKey, actorUserId }),
}
