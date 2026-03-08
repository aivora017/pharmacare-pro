// Barcode utilities for POS scanning and generation
// Scanners send characters very quickly then press Enter - detect this pattern

/** Detect if input is from a barcode scanner (fast input > 8 chars) */
export function isBarcodeInput(value: string, inputDuration: number): boolean {
  return value.length >= 8 && inputDuration < 100 // ms
}

/** Generate barcode string for a batch */
export function generateBarcodeString(medicineId: number, batchNumber: string): string {
  return `MED${String(medicineId).padStart(5, '0')}-${batchNumber.replace(/[^A-Z0-9]/gi, '')}`
}
