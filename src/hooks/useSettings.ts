import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
/** Fetch a single setting value from the DB */
export function useSetting(key: string) {
  const [value, setValue] = useState<string | null>(null)
  useEffect(() => {
    invoke<string|null>("settings_get", { key })
      .then(v => setValue(v))
      .catch(() => setValue(null))
  }, [key])
  return value
}
