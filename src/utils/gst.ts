import type{ICartItem,IBillTotals}from"@/types"
export function calcItemGST(item:ICartItem,interstate=false):ICartItem{
  const gross=item.unit_price*item.quantity,discAmt=gross*(item.discount_percent/100),taxable=gross-discAmt,gstAmt=r2(taxable*(item.gst_rate/100))
  const u={...item,discount_amount:r2(discAmt)}
  if(interstate){u.cgst_amount=0;u.sgst_amount=0;u.igst_amount=gstAmt}else{u.cgst_amount=r2(gstAmt/2);u.sgst_amount=r2(gstAmt/2);u.igst_amount=0}
  u.total_amount=r2(taxable+gstAmt);return u
}
export function calcBillTotals(items:ICartItem[],billDiscount=0):IBillTotals{
  let sub=0,cgst=0,sgst=0,igst=0,id=0
  for(const i of items){sub+=i.unit_price*i.quantity;id+=i.discount_amount;cgst+=i.cgst_amount;sgst+=i.sgst_amount;igst+=i.igst_amount}
  const tg=r2(cgst+sgst+igst),tx=r2(sub-id-billDiscount),tot=r2(tx+tg),ro=r2(Math.round(tot)-tot)
  return{subtotal:r2(sub),item_discount:r2(id),bill_discount:r2(billDiscount),taxable:tx,cgst:r2(cgst),sgst:r2(sgst),igst:r2(igst),total_gst:tg,round_off:ro,net_amount:r2(tot+ro)}
}
export const EMPTY_TOTALS:IBillTotals={subtotal:0,item_discount:0,bill_discount:0,taxable:0,cgst:0,sgst:0,igst:0,total_gst:0,round_off:0,net_amount:0}
const r2=(n:number)=>Math.round(n*100)/100
