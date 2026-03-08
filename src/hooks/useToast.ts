import toast from "react-hot-toast"
/** Convenience wrappers around react-hot-toast */
export function useToast() {
  return {
    success: (msg: string) => toast.success(msg),
    error:   (msg: string) => toast.error(msg),
    info:    (msg: string) => toast(msg, { icon: "ℹ️" }),
    loading: (msg: string) => toast.loading(msg),
    dismiss: (id?: string) => toast.dismiss(id),
  }
}
