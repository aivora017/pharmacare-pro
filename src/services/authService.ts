import { invoke } from "@tauri-apps/api/core"
import type { IUser } from "@/types"

export interface AuthResult { user: IUser; token: string }

export const authService = {
  login:          async (email: string, password: string): Promise<AuthResult> => invoke("auth_login",           { email, password }),
  logout:         async (token: string): Promise<void>                          => invoke("auth_logout",          { token }),
  restoreSession: async (): Promise<AuthResult | null>                          => invoke("auth_restore_session"),
  changePassword: async (userId: number, currentPassword: string, newPassword: string): Promise<void> =>
    invoke("auth_change_password", { userId, currentPassword, newPassword }),
  createUser:     async (name: string, email: string, password: string, roleId: number): Promise<number> =>
    invoke("auth_create_user", { name, email, password, roleId }),
  listUsers:      async ()                                                       => invoke("auth_list_users"),
  updateUser:     async (userId: number, name: string, roleId: number, isActive: boolean): Promise<void> =>
    invoke("auth_update_user", { userId, name, roleId, isActive }),
  resetPassword:  async (userId: number, newPassword: string, adminId: number): Promise<void> =>
    invoke("auth_reset_password", { userId, newPassword, adminId }),
}
