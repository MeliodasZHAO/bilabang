import fs from 'node:fs';
import {regions,registerRegions,regionPath,regionMap} from './src/regions.js';
registerRegions(JSON.parse(fs.readFileSync(new URL('./public/region-data/world.json',import.meta.url),'utf8')));
const fold=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[\s/·-]/g,'');
const indexed=regions.map(r=>({r,key:fold(regionPath(r.id).map(n=>[n.name,n.alias||''].join(' ')).join(' ')),short:r.id.startsWith('CN')?fold(regionPath(r.id).map(n=>n.name.replace(/特别行政区$|自治区$|自治州$|省$|市$|区$|县$/,'')).join('')):'',name:fold(r.name)}));
const children=new Map();for(const r of regions){const key=r.parentId||'';if(!children.has(key))children.set(key,[]);children.get(key).push(r);}
export function queryRegions({q='',parent='',id='',offset=0}={}){
 if(id)return {items:regionPath(id),total:regionMap.has(id)?1:0};
 const term=fold(q.trim().slice(0,100));
 let found;
 if(term){found=indexed.filter(x=>x.key.includes(term)||x.short.includes(term)).sort((a,b)=>Number(b.name===term)-Number(a.name===term)||(b.r.capital?1:0)-(a.r.capital?1:0)||a.r.name.localeCompare(b.r.name,'zh-CN')).map(x=>x.r);}
 else found=children.get(parent)||[];
 const start=Math.max(0,Math.min(Number(offset)||0,found.length));
 return {items:found.slice(start,start+60).map(r=>({...r,path:regionPath(r.id)})),total:found.length,offset:start};
}
