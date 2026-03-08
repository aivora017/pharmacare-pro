import { invoke } from '@tauri-apps/api/core'

export const authService = {
  changePassword: async (payload: {
    user_id: number
    current_password: string
    new_password: string
  }): Promise<void> => invoke('auth_change_password', payload),
}
