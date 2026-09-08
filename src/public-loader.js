import {ApiError} from './api.js';

export function createPublicReader({fetchImpl=(...args)=>fetch(...args),timeoutMs=45000}={}){
 return async path=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(path,{signal:controller.signal});
   if(!response.ok)throw new ApiError('公开资料暂时无法加载，请稍后重试',{status:response.status});
   const data=await response.json();
   if(!Array.isArray(data))throw new ApiError('公开资料格式异常，请刷新后重试',{code:'invalid_data'});
   return data;
  }catch(error){
   if(controller.signal.aborted)throw new ApiError('地区或地点资料加载超时，请检查网络后重试',{code:'timeout'});
   if(error instanceof ApiError)throw error;
   throw new ApiError('公开资料加载失败，请检查网络后重试',{code:'network'});
  }finally{clearTimeout(timer);}
 };
}

// Cancel the caller's wait, not the shared download used by another open picker.
export function waitForPublicData(promise,signal){
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const cancel=()=>reject(new ApiError('请求已取消',{code:'cancelled'}));
  const clean=()=>signal.removeEventListener('abort',cancel);
  promise.then(value=>{clean();resolve(value);},error=>{clean();reject(error);});
  if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
 });
}
