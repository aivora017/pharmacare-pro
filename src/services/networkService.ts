import { invoke } from "@tauri-apps/api/core"

export const networkService = {
  getLocalIp:          async (): Promise<string>              => invoke("network_get_local_ip"),
  startServer:         async (): Promise<string>              => invoke("network_start_server"),
  stopServer:          async (): Promise<void>                => invoke("network_stop_server"),
  getStatus:           async ()                               => invoke("network_get_status"),
  checkInteractions:   async (medicineNames: string[])        => invoke("network_check_interactions",{ medicineNames }),
  getLicenseStatus:    async ()                               => invoke("license_get_status"),
  activateLicense:     async (licenseKey: string)             => invoke("license_activate",         { licenseKey }),
  getSyncQueue:        async ()                               => invoke("sync_get_queue"),
  syncToSupabase:      async ()                               => invoke("sync_push_to_supabase"),
}
