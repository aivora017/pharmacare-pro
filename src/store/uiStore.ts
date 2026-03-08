/**
 * UI Store - global UI state (sidebar, modals, notifications).
 */
import { create } from "zustand"

interface Notification { id: string; type: "success"|"warning"|"error"|"info"; message: string; link?: string }

interface UIStore {
  sidebarCollapsed: boolean
  notifications: Notification[]
  toggleSidebar: () => void
  addNotification: (n: Omit<Notification,"id">) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  notifications: [],
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  addNotification: (n) => set(s => ({
    notifications: [...s.notifications, { ...n, id: Date.now().toString() }]
  })),
  removeNotification: (id) => set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })),
  clearNotifications: () => set({ notifications: [] }),
}))
