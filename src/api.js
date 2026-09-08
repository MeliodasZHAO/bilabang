import {registerRegions} from './regions.js';
export class ApiError extends Error{
 constructor(message,{status=0,fields=null,code='request_failed'}={}){super(message);this.name='ApiError';this.status=status;this.fields=fields;this.code=code;}
}
export function createApi({fetchImpl=globalThis.fetch,timeoutMs=25000,uploadTimeoutMs=180000}={}){
 return async function api(url,options={}){
  const controller=new AbortController();let timedOut=false;
  const cancel=()=>controller.abort();
  if(options.signal?.aborted)cancel();else options.signal?.addEventListener('abort',cancel,{once:true});
  const multipart=options.body instanceof FormData;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},multipart?uploadTimeoutMs:timeoutMs);
  try{
   const res=await fetchImpl('/api'+url,{...options,signal:controller.signal,headers:{...(multipart?{}:{'Content-Type':'application/json'}),...options.headers},body:multipart?options.body:options.body===undefined?undefined:JSON.stringify(options.body)});
   if(res.status===429){const raw=Number(res.headers.get('retry-after'));throw new ApiError(`操作较频繁，请${Number.isFinite(raw)&&raw>0?`约 ${Math.min(Math.ceil(raw),3600)} 秒后`:'稍后'}再试`,{status:429,code:'rate_limited'});}
   if(res.status===413)throw new ApiError('上传内容过大，请减少照片数量或大小后重试',{status:413});
   let data;try{data=await res.json();}catch(e){if(controller.signal.aborted)throw e;throw new ApiError('服务返回了无法读取的内容，请稍后重试',{status:res.status});}
   if(!res.ok)throw new ApiError(typeof data?.error==='string'?data.error:'请求未成功，请稍后重试',{status:res.status,fields:data?.fields});
   if(url==='/places'&&Array.isArray(data))for(const place of data)registerRegions(place.regionPath||[]);
   if(url==='/admin'&&Array.isArray(data.places))for(const place of data.places)registerRegions(place.regionPath||[]);
   return data;
  }catch(e){
   if(e instanceof ApiError)throw e;
   if(controller.signal.aborted)throw new ApiError(timedOut?'请求超时，尚未确认是否成功。请保留草稿后重试。':'请求已取消',{code:timedOut?'timeout':'cancelled'});
   throw new ApiError('网络连接中断，尚未确认是否成功。请检查网络并保留草稿。',{code:'network'});
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
 };
}
const localApi=createApi();
export const api=import.meta.env?.MODE==='public'
 ? async (url,options={})=>(await import('./public-api.js')).publicApi(url,options)
 : localApi;
