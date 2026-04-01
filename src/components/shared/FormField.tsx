export function FormField({label,required,error,children}:{label:string;required?:boolean;error?:string;children:React.ReactNode}){
  return(<div><label className="label">{label}{required&&<span className="text-red-500 ml-1">*</span>}</label>{children}{error&&<p className="text-red-500 text-xs mt-1">{error}</p>}</div>)
}
