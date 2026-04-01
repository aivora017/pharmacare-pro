import{invoke}from"@tauri-apps/api/core"
import type{ISupplier}from"@/types"
export const supplierService={
  list:async():Promise<ISupplier[]>=>invoke("supplier_list"),
  create:async(data:Partial<ISupplier>,userId:number):Promise<number>=>invoke("supplier_create",{data,userId}),
}
