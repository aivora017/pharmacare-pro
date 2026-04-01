import{create}from"zustand"
import{authService}from"@/services/authService"
import type{IUser}from"@/types"
interface S{user:IUser|null;token:string|null;isAuthenticated:boolean;isLoading:boolean;login:(e:string,p:string)=>Promise<void>;logout:()=>Promise<void>;restoreSession:()=>Promise<void>;hasPermission:(k:string)=>boolean}
export const useAuthStore=create<S>((set,get)=>({user:null,token:null,isAuthenticated:false,isLoading:true,
  login:async(email,password)=>{const r=await authService.login(email,password);set({user:r.user,token:r.token,isAuthenticated:true})},
  logout:async()=>{const{token}=get();if(token){try{await authService.logout(token)}catch{}}; set({user:null,token:null,isAuthenticated:false})},
  restoreSession:async()=>{try{const r=await authService.restoreSession();if(r)set({user:r.user,token:r.token,isAuthenticated:true})}catch{}finally{set({isLoading:false})}},
  hasPermission:(key)=>{const{user}=get();if(!user?.permissions)return false;if(user.permissions["all"]===true)return true;return user.permissions[key]===true},
}))
