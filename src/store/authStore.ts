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

export interface IPermissions {
  all?: boolean
  billing?: boolean
  medicine?: boolean
  purchase?: boolean
  customers?: boolean
  reports?: boolean
  settings?: boolean
  expiry?: boolean
  barcodes?: boolean
  doctors?: boolean
  suppliers?: boolean
}

export interface IUser {
  id: number
  name: string
  email: string
  phone?: string | null
  role_id: number
  role_name: string
  permissions: IPermissions
  is_active: boolean
  last_login_at?: string | null
}

interface IAuthState {
  user: IUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthStore extends IAuthState {
  login: (email: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
  hasPermission: (key: keyof IPermissions) => boolean
}

function normalizeAuthError(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  const lowered = message.toLowerCase()

  if (lowered.includes('locked')) {
    return new Error('Account is locked. Please contact the admin.')
  }

  if (lowered.includes('disabled') || lowered.includes('inactive')) {
    return new Error('Account is disabled. Please contact the admin.')
  }

  if (
    lowered.includes('invalid credentials') ||
    lowered.includes('invalid email') ||
    lowered.includes('invalid password') ||
    lowered.includes('unauthorized')
  ) {
    return new Error('Email or password is incorrect. Please try again.')
  }

  if (lowered.includes('session') && (lowered.includes('expired') || lowered.includes('invalid'))) {
    return new Error('Your session expired. Please sign in again.')
  }

  return new Error(fallback)
}

const ROLE_PERMISSION_FALLBACK: Record<string, IPermissions> = {
  admin: { all: true },
  pharmacist: {
    billing: true,
    medicine: true,
    purchase: true,
    customers: true,
    reports: true,
    settings: true,
    expiry: true,
    barcodes: true,
    doctors: true,
    suppliers: true,
  },
  cashier: { billing: true, customers: true },
  accountant: { purchase: true, reports: true, suppliers: true },
  delivery: { customers: true },
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // ── Initial State ─────────────────────────────────────────────
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // True until restoreSession() completes

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
    try {
      const result = await invoke<{ user: IUser; token: string }>('auth_login', {
        email: email.toLowerCase().trim(),
        password,
      })

      set({
        user: result.user,
        token: result.token,
        isAuthenticated: true,
      })
    } catch (error: unknown) {
      set({ user: null, token: null, isAuthenticated: false })
      throw normalizeAuthError(error, 'Unable to sign in right now. Please try again.')
    }
  },

  // ── Register ─────────────────────────────────────────────────
  /**
   * Creates a new account using a username + password.
   * New users are created as staff role by default during bootstrap phase.
   */
  register: async (username: string, password: string) => {
    const safeUsername = username.trim().toLowerCase()
    try {
      await invoke<number>('auth_create_user', {
        name: safeUsername,
        email: safeUsername,
        password,
        role_id: 2,
        created_by: 1,
      })
    } catch (error: unknown) {
      throw normalizeAuthError(error, 'Unable to create user right now. Please try again.')
    }
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
    set({ isLoading: true })

    try {
      const result = await invoke<{ user: IUser; token: string } | null>('auth_restore_session')
      if (result) {
        set({ user: result.user, token: result.token, isAuthenticated: true })
      } else {
        set({ user: null, token: null, isAuthenticated: false })
      }
    } catch {
      // Any restore failure should leave auth state fully cleared.
      set({ user: null, token: null, isAuthenticated: false })
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
    if (!user) return false

    // Role-based hard fallback prevents a blank permissions JSON from locking UI tabs.
    if (user.role_id === 1 || user.role_name.toLowerCase() === 'admin') return true

    const directPermissions = user.permissions ?? {}
    if (directPermissions.all === true) return true
    if (directPermissions[key] === true) return true

    const fallback = ROLE_PERMISSION_FALLBACK[user.role_name.toLowerCase()] ?? {}
    if (fallback.all === true) return true
    return fallback[key] === true
  },
}))
