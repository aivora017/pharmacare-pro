/**
 * Payment collection panel — slides in from right.
 * Modes: Cash (show change calculator), UPI (show QR), Card, Credit, Split.
 * Copilot:
 * - Cash mode: input amount → auto-calculate change
 * - UPI mode: show QR code using jsbarcode or qrcode library
 * - Split: allow multiple payment modes summing to net_amount
 * - Validate: total payments must equal net_amount before enabling Save button
 * - On Save: call onConfirm(payments)
 */
interface Props { netAmount: number; onConfirm: (payments: {amount:number;payment_mode:string;reference_no?:string}[]) => void; onClose: () => void; isSaving?: boolean }
export function PaymentPanel(_props: Props) {
  return null // TODO (Copilot): implement payment collection UI
}
