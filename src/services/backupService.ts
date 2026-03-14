/**
 * Backup and restore service.
 */
import { invoke } from '@tauri-apps/api/core'

export interface IBackupFileEntry {
  file_name: string
  file_path: string
  size_bytes: number
  modified_at: number
}

export const backupService = {
  create: async (userId: number, destination?: string): Promise<string> =>
    invoke<string>('backup_create', { destination, userId }),
  restore: async (backupPath: string, userId: number): Promise<void> =>
    invoke('backup_restore', { backupPath, userId }),
  list: async (userId: number): Promise<IBackupFileEntry[]> =>
    invoke<IBackupFileEntry[]>('backup_list', { userId }),
}
