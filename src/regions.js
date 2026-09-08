import china from './data/china-regions.json' with { type: 'json' };
import worldCountries from './data/world-countries.json' with { type: 'json' };
export const regions = [{id:'CN',name:'中国',parentId:null,level:'country'}];
for(const p of china){
  regions.push({id:'CN-'+p.code,name:p.name,parentId:'CN',level:'province'});
  for(const c of p.children || []){
    const skip=['11','12','31','50'].includes(p.code)||c.name.includes('直辖县');
    if(!skip) regions.push({id:'CN-'+c.code,name:c.name,parentId:'CN-'+p.code,level:'city'});
    for(const d of c.children||[]) regions.push({id:'CN-'+d.code,name:d.name,parentId:'CN-'+(skip?p.code:c.code),level:'district'});
  }
}
regions.push(...[
 ['CN-71','台湾省','CN','province'],['CN-81','香港特别行政区','CN','province'],['CN-82','澳门特别行政区','CN','province'],
 ['JP','日本',null,'country'],['JP-13','东京都','JP','province'],['JP-13113','涩谷区','JP-13','district'],
 ['NO','挪威',null,'country'],['NO-18','Nordland','NO','province'],['NO-1838','Gildeskål','NO-18','city'],['NO-46','Vestland','NO','province'],['NO-4641','Aurland','NO-46','city']
].map(([id,name,parentId,level])=>({id,name,parentId,level})));
export const regionMap=new Map(regions.map(r=>[r.id,r]));
export function registerRegions(nodes){for(const node of nodes){if(!node?.id)continue;const existing=regionMap.get(node.id);if(existing){Object.assign(existing,{lat:node.lat??existing.lat,lng:node.lng??existing.lng,alias:node.alias||node.name});}else{regions.push(node);regionMap.set(node.id,node);}}}
registerRegions(worldCountries);
export function regionPath(id){const result=[];while(regionMap.has(id)){const r=regionMap.get(id);result.unshift(r);id=r.parentId;}return result;}
export const regionLabel=id=>regionPath(id).map(r=>r.name).join(' / ');
const compact=s=>s.toLowerCase().replace(/[\s/·]/g,'');
const shortName=s=>s.replace(/特别行政区$|自治区$|自治州$|省$|市$|区$|县$/,'');
export function searchRegions(query){
 const q=compact(query.trim());if(!q)return [];
 return regions.filter(r=>{
  const p=regionPath(r.id);
  const full=compact(p.map(n=>n.name).join(''));
  const abbreviated=compact(p.map(n=>shortName(n.name)).join(''));
  return full.includes(q)||abbreviated.includes(q)||compact(r.name).includes(q);
 }).sort((a,b)=>Number(compact(b.name)===q)-Number(compact(a.name)===q));
}
export const withinRegion=(place,id)=>!id||regionPath(place.regionId).some(r=>r.id===id);
export function regionFields(id){const p=regionPath(id);return {country:p[0]?.name||'',province:p.find(r=>r.level==='province')?.name||'',city:p.find(r=>r.level==='city')?.name||p.find(r=>r.level==='province')?.name||'',district:p.find(r=>r.level==='district')?.name||''};}
