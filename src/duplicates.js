import {withinRegion} from './regions.js';
const compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s·,，.。/\-()（）]/g,'');
const coordinate=(v,max)=>(typeof v==='number'||typeof v==='string')&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<=max;
export function distanceMeters(a,b){
 if(![a,b].every(p=>p.locationMode==='precise'&&coordinate(p.lat,90)&&coordinate(p.lng,180)))return null;
 const rad=n=>Number(n)*Math.PI/180,dy=rad(b.lat)-rad(a.lat),dx=rad(b.lng)-rad(a.lng);
 const h=Math.sin(dy/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dx/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function similarPlaces(draft,places){
 return places.filter(p=>!p.preview&&p.id!==draft.id).map(place=>{
  const reasons=[];const sameArea=!!draft.regionId&&!!place.regionId&&(withinRegion(place,draft.regionId)||withinRegion(draft,place.regionId));
  if(sameArea&&compact(draft.name).length>=3&&compact(draft.name)===compact(place.name))reasons.push('同一地区、名称相同');
  if(sameArea&&compact(draft.address).length>=6&&compact(draft.address)===compact(place.address))reasons.push('详细地址相同，请核对楼层和入口');
  const distance=distanceMeters(draft,place);if(distance!==null&&distance<=60)reasons.push(`两个厕所坐标相距约 ${Math.round(distance)} 米`);
  return {place,reasons};
 }).filter(r=>r.reasons.length).sort((a,b)=>b.reasons.length-a.reasons.length).slice(0,3);
}
