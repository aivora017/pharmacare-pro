import { invoke } from "@tauri-apps/api/core"

export const backupService = {
  create:  async (destination?: string): Promise<string> => invoke("backup_create",  { destination }),
  list:    async ()                                        => invoke("backup_list"),
  restore: async (backupPath: string): Promise<void>      => invoke("backup_restore", { backupPath }),
}
