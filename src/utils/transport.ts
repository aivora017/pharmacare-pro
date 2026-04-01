/**
 * Transport layer — routes invoke() calls to either local Tauri backend
 * or to the LAN Server PC via HTTP, based on network_mode setting.
 */
import { invoke as tauriInvoke } from "@tauri-apps/api/core"

export type NetworkMode = "standalone" | "server" | "client"

let _mode: NetworkMode = "standalone"
let _serverUrl = ""

export function setTransportMode(mode: NetworkMode, serverUrl = "") {
  _mode = mode
  _serverUrl = serverUrl
}

export function getTransportMode(): NetworkMode { return _mode }
export function getServerUrl(): string { return _serverUrl }

/** Map Tauri command names → LAN server endpoint paths */
const COMMAND_TO_PATH: Record<string, string> = {
  medicine_search:          "/api/medicine/search",
  medicine_get:             "/api/medicine/get",
  medicine_list_batches:    "/api/medicine/batches",
  medicine_get_by_barcode:  "/api/medicine/barcode",
  billing_create_bill:      "/api/billing/create",
  billing_list_bills:       "/api/billing/list",
  billing_get_bill:         "/api/billing/get",
  billing_hold_bill:        "/api/billing/hold",
  billing_get_held_bills:   "/api/billing/held",
  billing_get_today_summary:"/api/billing/today",
  customer_search:          "/api/customer/search",
  dashboard_summary:        "/api/dashboard/summary",
}

export async function invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (_mode === "client" && _serverUrl && COMMAND_TO_PATH[command]) {
    const url = `${_serverUrl}${COMMAND_TO_PATH[command]}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args ?? {}),
    })
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || "Server error")
    return data.data as T
  }
  // Default: local Tauri invoke
  return tauriInvoke<T>(command, args)
}
