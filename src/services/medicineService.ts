import{invoke}from"@tauri-apps/api/core"
import type{IMedicine,IBatch}from"@/types"
export const medicineService={
  search:async(query:string,inStockOnly=false,categoryId?:number):Promise<IMedicine[]>=>invoke("medicine_search",{query,inStockOnly,categoryId}),
  get:async(id:number):Promise<IMedicine>=>invoke("medicine_get",{id}),
  create:async(data:Partial<IMedicine>,userId:number):Promise<number>=>invoke("medicine_create",{data,userId}),
  update:async(id:number,data:Partial<IMedicine>,userId:number):Promise<void>=>invoke("medicine_update",{id,data,userId}),
  delete:async(id:number,userId:number):Promise<void>=>invoke("medicine_delete",{id,userId}),
  listBatches:async(medicineId:number):Promise<IBatch[]>=>invoke("medicine_list_batches",{medicineId}),
  createBatch:async(data:Partial<IBatch>,userId:number):Promise<number>=>invoke("medicine_create_batch",{data,userId}),
  updateBatch:async(id:number,data:Partial<IBatch>,userId:number):Promise<void>=>invoke("medicine_update_batch",{id,data,userId}),
  getByBarcode:async(barcode:string):Promise<IBatch>=>invoke("medicine_get_by_barcode",{barcode}),
  listCategories:async()=>invoke("medicine_list_categories"),
}
