/**
 * Auth Store - login state, session, permissions.
 * SECURITY: passwords never stored here. Bcrypt in Rust. Session JWT in OS keychain.
 */
import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"

export interface IUser {
  id: number; name: string; email: string
  role_id: number; role_name: string
  permissions: Record<string, boolean>; is_active: boolean
}

interface AuthStore {
  user: IUser | null; token: string | null
  isAuthenticated: boolean; isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
  hasPermission: (key: string) => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null, token: null, isAuthenticated: false, isLoading: true,

  login: async (email, password) => {
    const r = await invoke<{ user: IUser; token: string }>("auth_login", {
      email: email.toLowerCase().trim(), password
    })
    set({ user: r.user, token: r.token, isAuthenticated: true })
  },

  logout: async () => {
    const { token } = get()
    if (token) { try { await invoke("auth_logout", { token }) } catch { /* silent */ } }
    set({ user: null, token: null, isAuthenticated: false })
  },

  restoreSession: async () => {
    try {
      const r = await invoke<{ user: IUser; token: string } | null>("auth_restore_session")
      if (r) set({ user: r.user, token: r.token, isAuthenticated: true })
    } catch { /* no session */ } finally { set({ isLoading: false }) }
  },

  hasPermission: (key) => {
    const { user } = get()
    if (!user?.permissions) return false
    if (user.permissions["all"] === true) return true
    return user.permissions[key] === true
  },
}))
