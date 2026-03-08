/**
 * Settings service — app configuration.
 */
import { invoke } from "@tauri-apps/api/core"

export const settingsService = {
  get:    async (key: string): Promise<string|null> =>
    invoke<string|null>("settings_get", { key }),
  set:    async (key: string, value: string, userId: number): Promise<void> =>
    invoke("settings_set", { key, value, userId }),
  getAll: async (): Promise<Record<string,string>> =>
    invoke<Record<string,string>>("settings_get_all"),
}
