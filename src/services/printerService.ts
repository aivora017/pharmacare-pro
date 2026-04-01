import { invoke } from "@tauri-apps/api/core"

export const printerService = {
  printBill: async (billId: number, printerName?: string): Promise<string> =>
    invoke("printer_print_bill", { billId, printerName }),
  test: async (printerName: string): Promise<void> =>
    invoke("printer_test", { printerName }),
}
