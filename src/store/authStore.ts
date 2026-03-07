/**
 * PharmaCare Pro — Authentication Store
 *
 * Manages login state, session persistence, and permission checking.
 *
 * Security features:
 * - Passwords are NEVER stored — only bcrypt hashes in SQLite
 * - Session tokens are JWT with 8-hour expiry
 * - Failed login attempts are tracked — account locks after 5 failures
 * - Sessions can be remotely revoked (admin function)
 * - All auth events are written to audit_log
 *
 * Copilot Instructions:
 * - restoreSession() checks for a saved token in OS secure storage on startup
 * - login() validates credentials, creates a JWT, saves to OS keychain
 * - logout() revokes the session token and clears all local state
 * - hasPermission() checks the user's role permissions object
 */

import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { IAuthState, IUser, IPermissions } from '@/types'

interface AuthStore extends IAuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
  hasPermission: (key: keyof IPermissions) => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // ── Initial State ─────────────────────────────────────────────
  user:            null,
  token:           null,
  isAuthenticated: false,
  isLoading:       true,    // True until restoreSession() completes

  // ── Login ─────────────────────────────────────────────────────
  /**
   * Validates email + password against the local database.
   * On success: creates a JWT session, saves to OS keychain, updates state.
   * On failure: increments failed attempt counter. Throws user-friendly error.
   *
   * Copilot: call Tauri command 'auth_login' with { email, password }
   * The Rust command does: fetch user → verify bcrypt → create JWT → save session → return user + token
   */
  login: async (email: string, password: string) => {
    const result = await invoke<{ user: IUser; token: string }>('auth_login', {
      email: email.toLowerCase().trim(),
      password,
    })
    set({
      user: result.user,
      token: result.token,
      isAuthenticated: true,
    })
  },

  // ── Logout ────────────────────────────────────────────────────
  /**
   * Revokes the current session and clears all state.
   * Copilot: call Tauri command 'auth_logout' with the current token
   * Then clear keychain storage and reset state
   */
  logout: async () => {
    const { token } = get()
    if (token) {
      try {
        await invoke('auth_logout', { token })
      } catch {
        // Even if server-side revoke fails, clear local state
      }
    }
    set({ user: null, token: null, isAuthenticated: false })
  },

  // ── Restore Session on App Start ──────────────────────────────
  /**
   * Called once when the app starts.
   * Checks OS keychain for a saved session token.
   * If found and not expired, restores the session.
   * If expired or not found, sets isLoading=false (user sees login screen).
   *
   * Copilot: call Tauri command 'auth_restore_session'
   * Rust checks keychain → validates JWT expiry → returns user if valid
   */
  restoreSession: async () => {
    try {
      const result = await invoke<{ user: IUser; token: string } | null>('auth_restore_session')
      if (result) {
        set({ user: result.user, token: result.token, isAuthenticated: true })
      }
    } catch {
      // No session found — user needs to log in
    } finally {
      set({ isLoading: false })
    }
  },

  // ── Permission Check ──────────────────────────────────────────
  /**
   * Returns true if the current user has the given permission.
   * Admin role has all permissions.
   * Usage: hasPermission('billing') → true/false
   */
  hasPermission: (key: keyof IPermissions): boolean => {
    const { user } = get()
    if (!user?.permissions) return false
    if (user.permissions.all === true) return true
    return user.permissions[key] === true
  },
}))
