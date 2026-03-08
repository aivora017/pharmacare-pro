import { useEffect } from "react"
/**
 * Global keyboard shortcut hook.
 * Usage: useKeyboard("F2", () => navigate("/billing"))
 */
export function useKeyboard(key: string, handler: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === key) { e.preventDefault(); handler(e) } }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [key, handler])
}
