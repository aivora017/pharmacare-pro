import{format,differenceInDays,parseISO}from"date-fns"
export const formatDate=(d:string)=>{try{return format(parseISO(d),"dd MMM yyyy")}catch{return d}}
export const formatDateTime=(d:string)=>{try{return format(parseISO(d),"dd MMM yyyy, hh:mm a")}catch{return d}}
export const formatForInput=(d:string)=>{try{return format(parseISO(d),"yyyy-MM-dd")}catch{return d}}
export const daysUntil=(d:string)=>{try{return differenceInDays(parseISO(d),new Date())}catch{return 0}}
export const isExpired=(d:string)=>daysUntil(d)<0
export const isNearExpiry=(d:string,days=30)=>{const n=daysUntil(d);return n>=0&&n<=days}
export function expiryBadgeClass(d:string):string{const n=daysUntil(d);if(n<0)return"badge-red";if(n<=30)return"badge-red";if(n<=90)return"badge-amber";return"badge-green"}
