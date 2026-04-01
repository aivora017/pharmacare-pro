import { invoke } from "@tauri-apps/api/core"

export const settingsService = {
  get:      async (key: string): Promise<string | null>          => invoke("settings_get",   { key }),
  set:      async (key: string, value: string, userId?: number): Promise<void> =>
    invoke("settings_set", { key, value, userId }),
  getAll:   async (): Promise<Record<string, string>>            => invoke("settings_get_all"),
  getRoles: async ()                                              => invoke("settings_get_roles"),
}
