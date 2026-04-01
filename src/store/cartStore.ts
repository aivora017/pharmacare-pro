import{create}from"zustand"
import{calcItemGST,calcBillTotals,EMPTY_TOTALS}from"@/utils/gst"
import type{ICartItem,IBillTotals,ICustomer}from"@/types"
type CC=Pick<ICustomer,"id"|"name"|"phone"|"outstanding_balance"|"loyalty_points">
interface S{items:ICartItem[];customer:CC|null;billDiscount:number;totals:IBillTotals;addItem:(i:ICartItem)=>void;removeItem:(idx:number)=>void;updateQty:(idx:number,qty:number)=>void;updateDiscount:(idx:number,pct:number)=>void;setBillDiscount:(a:number)=>void;setCustomer:(c:CC|null)=>void;clear:()=>void}
export const useCartStore=create<S>((set,get)=>({items:[],customer:null,billDiscount:0,totals:EMPTY_TOTALS,
  addItem:(raw)=>{const item=calcItemGST({...raw});const ex=get().items.findIndex(i=>i.batch_id===item.batch_id);const items=ex>=0?get().items.map((i,n)=>n===ex?calcItemGST({...i,quantity:i.quantity+item.quantity}):i):[...get().items,item];set({items,totals:calcBillTotals(items,get().billDiscount)})},
  removeItem:(idx)=>{const items=get().items.filter((_,i)=>i!==idx);set({items,totals:calcBillTotals(items,get().billDiscount)})},
  updateQty:(idx,qty)=>{if(qty<=0){get().removeItem(idx);return}const items=get().items.map((i,n)=>n===idx?calcItemGST({...i,quantity:qty}):i);set({items,totals:calcBillTotals(items,get().billDiscount)})},
  updateDiscount:(idx,pct)=>{const items=get().items.map((i,n)=>n===idx?calcItemGST({...i,discount_percent:pct}):i);set({items,totals:calcBillTotals(items,get().billDiscount)})},
  setBillDiscount:(a)=>set({billDiscount:a,totals:calcBillTotals(get().items,a)}),
  setCustomer:(customer)=>set({customer}),
  clear:()=>set({items:[],customer:null,billDiscount:0,totals:EMPTY_TOTALS}),
}))
