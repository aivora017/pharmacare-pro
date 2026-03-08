/**
 * Backup and restore service.
 */
import { invoke } from "@tauri-apps/api/core"

export const backupService = {
  create:  async (destination?: string): Promise<string> =>
    invoke<string>("backup_create", { destination }),
  restore: async (backupPath: string, userId: number): Promise<void> =>
    invoke("backup_restore", { backupPath, userId }),
  list:    async () =>
    invoke("backup_list"),
}
