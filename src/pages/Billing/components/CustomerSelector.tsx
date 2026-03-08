/**
 * Customer search and select modal for POS.
 * Copilot:
 * - Search by name or phone number (customerService.search)
 * - Show: name, phone, outstanding balance, loyalty points
 * - Allow creating new customer inline
 * - On select: call cartStore.setCustomer()
 */
interface Props { onSelect: (c: {id:number;name:string;phone?:string;outstanding_balance:number;loyalty_points:number}) => void; onClose: () => void }
export function CustomerSelector(_props: Props) {
  return null // TODO (Copilot): implement customer selector modal
}
