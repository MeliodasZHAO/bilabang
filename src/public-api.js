import {regions,registerRegions,regionPath,regionMap} from './regions.js';
import {ApiError} from './api.js';
import {createPublicReader,waitForPublicData} from './public-loader.js';
let directory,places;
const fold=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[\s/·-]/g,'');
const readJson=createPublicReader();
async function loadDirectory(){
 if(!directory)directory=readJson('/region-data/world.json').then(registerRegions).catch(e=>{directory=null;throw e;});
 await directory;
}
export async function publicApi(route,options={}){
 const check=()=>{if(options.signal?.aborted)throw new ApiError('请求已取消',{code:'cancelled'});};
 check();
 if(options.method&&options.method.toUpperCase()!=='GET')throw new ApiError('公开预览暂未开放投稿、登录和评论，草稿只保存在本机。',{status:503});
 const url=new URL(route,'https://public.invalid');
 if(url.pathname==='/config')return {demo:false,writeEnabled:false,publicPreview:true};
 if(url.pathname==='/me')return null;
 if(url.pathname==='/places'){
  places??=readJson('/catalog/places.json').catch(e=>{places=null;throw e;});
  const result=await waitForPublicData(places,options.signal);check();for(const p of result)registerRegions(p.regionPath);return result;
 }
 if(/^\/places\/[^/]+\/reviews$/.test(url.pathname))return [];
 if(url.pathname==='/regions'){
  const q=fold((url.searchParams.get('q')||'').trim().slice(0,100)),parent=url.searchParams.get('parent')||'',id=url.searchParams.get('id')||'';
  // Country browsing and the complete mainland directory work without downloading the overseas catalog.
  if(q||(parent&&!parent.startsWith('CN'))||(id&&!regionMap.has(id)))await waitForPublicData(loadDirectory(),options.signal);
  check();
  if(id)return {items:regionPath(id),total:regionMap.has(id)?1:0};
  let found;
  if(q){
   found=regions.filter(r=>{
    const path=regionPath(r.id);
    return fold(path.map(n=>n.name+' '+(n.alias||'')).join(' ')).includes(q)||(r.id.startsWith('CN')&&fold(path.map(n=>n.name.replace(/特别行政区$|自治区$|自治州$|省$|市$|区$|县$/,'')).join('')).includes(q));
   }).sort((a,b)=>Number(fold(b.name)===q)-Number(fold(a.name)===q)||Number(!!b.capital)-Number(!!a.capital)||a.name.localeCompare(b.name,'zh-CN'));
  }else found=regions.filter(r=>(r.parentId||'')===parent);
  const offset=Math.max(0,Math.min(Number(url.searchParams.get('offset'))||0,found.length));
  return {items:found.slice(offset,offset+60).map(r=>({...r,path:regionPath(r.id)})),total:found.length,offset};
 }
 throw new ApiError('该功能尚未在公开预览中开放',{status:404});
}
