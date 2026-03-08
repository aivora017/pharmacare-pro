import { useAuthStore } from "@/store/authStore"
/** Returns hasPermission function from auth store */
export function usePermission() {
  return { hasPermission: useAuthStore(s => s.hasPermission) }
}
