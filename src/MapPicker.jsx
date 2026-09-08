import React,{useEffect,useRef,useState,useId} from 'react';
import {MapPin,Crosshair,MagnifyingGlass,ArrowCounterClockwise} from '@phosphor-icons/react';
import {regionPath,regionLabel,registerRegions} from './regions.js';
import {api} from './api.js';
import 'leaflet/dist/leaflet.css';

const valid=(lat,lng)=>lat!=null&&lng!=null&&lat!==''&&lng!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Math.abs(Number(lat))<=85&&Math.abs(Number(lng))<=180;
export default function MapPicker({value,onChange,config={}}){
 const [open,setOpen]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState(''),[results,setResults]=useState([]),[searching,setSearching]=useState(false),[locating,setLocating]=useState(false),[searched,setSearched]=useState(false),[reload,setReload]=useState(0),[point,setPoint]=useState(null),[kind,setKind]=useState(value.locationMode==='reference'?'reference':'precise');
 const box=useRef(null),map=useRef(null),marker=useRef(null),leaflet=useRef(null),tileLayer=useRef(null),searchRequest=useRef(null),locationRequest=useRef(0);
 const radioName=useId();
 const region=regionPath(value.regionId).slice().reverse().find(r=>valid(r.lat,r.lng));
 const placePoint=(lat,lng)=>{const p={lat:Number(lat.toFixed(6)),lng:Number(lng.toFixed(6))};if(!valid(p.lat,p.lng))return;locationRequest.current++;setLocating(false);setPoint(p);const L=leaflet.current;if(!L||!map.current)return;if(marker.current)marker.current.setLatLng(p);else {marker.current=L.marker(p,{draggable:true,keyboard:true,title:'选中的位置，可拖动调整',icon:L.divIcon({className:'map-pin',html:'<span></span>',iconSize:[28,36],iconAnchor:[14,36]})}).addTo(map.current);marker.current.on('dragend',()=>{const ll=marker.current.getLatLng().wrap();placePoint(ll.lat,ll.lng);});}};
 useEffect(()=>{
  if(!open)return;let active=true;setReady(false);setError('');setPoint(null);setKind(value.locationMode==='reference'?'reference':'precise');setSearch('');setResults([]);setSearched(false);setSearching(false);setLocating(false);
  import('leaflet').then(({default:L})=>{
   if(!active)return;leaflet.current=L;
   const saved=valid(value.lat,value.lng)&&value.locationMode!=='text';
   const center=saved?[Number(value.lat),Number(value.lng)]:region?[region.lat,region.lng]:[25,15];
   const m=L.map(box.current,{scrollWheelZoom:false,worldCopyJump:true,maxBounds:[[-85,-540],[85,540]]}).setView(center,saved?17:region?(region.level==='country'?4:10):2);map.current=m;
   tileLayer.current=L.tileLayer(config.mapTileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'}).on('tileerror',()=>{if(active)setError('地图底图暂时无法加载。可重试，或保留文字路线与手动坐标。');}).addTo(m);
   m.on('click',e=>{const ll=e.latlng.wrap();placePoint(ll.lat,ll.lng);});
   if(saved)placePoint(Number(value.lat),Number(value.lng));else setPoint(null);
   setReady(true);requestAnimationFrame(()=>{if(active)m.invalidateSize();});
  }).catch(()=>{if(active)setError('地图组件加载失败，请关闭后重试。');});
  return()=>{active=false;searchRequest.current?.abort();searchRequest.current=null;map.current?.remove();map.current=null;marker.current=null;tileLayer.current=null;};
 },[open,reload]);
 function changeSearch(text){searchRequest.current?.abort();searchRequest.current=null;setSearch(text);setResults([]);setSearched(false);setSearching(false);}
 async function find(){
  if(!search.trim()||!map.current)return;
  searchRequest.current?.abort();const controller=new AbortController();searchRequest.current=controller;
  setSearching(true);setSearched(false);setResults([]);setError('');
  try{const r=await api('/regions?q='+encodeURIComponent(search),{signal:controller.signal});if(searchRequest.current!==controller)return;setResults(r.items.filter(r=>valid(r.lat,r.lng)).slice(0,8));setSearched(true);}
  catch(e){if(searchRequest.current===controller&&e.code!=='cancelled')setError(e.message);}
  finally{if(searchRequest.current===controller){setSearching(false);searchRequest.current=null;}}
 }
 function locate(){
  if(!navigator.geolocation){setError('浏览器不支持定位，可用城市搜索或拖动地图。');return;}
  const requestedMap=map.current;if(!requestedMap)return;const request=++locationRequest.current;setLocating(true);
  navigator.geolocation.getCurrentPosition(pos=>{
   if(map.current!==requestedMap||request!==locationRequest.current)return;setLocating(false);
   if(!valid(pos.coords.latitude,pos.coords.longitude)){setError('该位置超出当前底图支持范围，请使用文字描述。');return;}
   requestedMap.setView([pos.coords.latitude,pos.coords.longitude],17);placePoint(pos.coords.latitude,pos.coords.longitude);
   setError(`设备定位精度约 ${Math.round(pos.coords.accuracy)} 米，请核对厕所入口后确认。`);
  },()=>{if(map.current===requestedMap&&request===locationRequest.current){setLocating(false);setError('未能获取当前位置。请检查定位权限，或搜索城市后手动选点。');}},{enableHighAccuracy:true,timeout:10000,maximumAge:30000});
 }
 function retryMap(){setError('');if(tileLayer.current)tileLayer.current.redraw();else setReload(n=>n+1);}
 return <section className="location-picker"><div className="location-heading"><MapPin size={22}/><div><strong>把入口标在地图上</strong><p>没有现成地图标记也可以添加，点击地图或拖动标记即可。</p></div></div>
  {!open?<button type="button" className="outline" onClick={()=>setOpen(true)}>{value.locationMode!=='text'&&valid(value.lat,value.lng)?'查看 / 调整地图位置':'打开地图选点'}</button>:<>
   <div className="map-search"><input aria-label="地图城市搜索" placeholder="搜索城市移动地图，如 Paris、Tokyo" value={search} onChange={e=>changeSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();find();}}}/><button type="button" className="outline" onClick={find} disabled={!ready||searching||!search.trim()}><MagnifyingGlass size={18}/>{searching?'查找中':'查找城市'}</button></div>
   {results.length>0&&<div className="map-results">{results.map(r=><button type="button" key={r.id} onClick={()=>{registerRegions(r.path||[r]);map.current?.setView([r.lat,r.lng],r.level==='country'?4:13);setResults([]);setSearch(r.name);setSearched(false);}}><strong>{r.name}</strong><small>{r.path?.map(n=>n.name).join(' / ')}</small></button>)}</div>}
   {searched&&!searching&&results.length===0?<p className="map-message" role="status">目录中未找到可定位的城市，可尝试英文名、选择上级地区，或直接拖动地图。</p>:<small className="muted">搜索用于定位城市范围；请继续在地图上找到并点击实际入口。</small>}
   <div className="map-canvas" ref={box} aria-label="选点地图，用方向键移动地图，或输入下方经纬度"/>
   {error&&<p className="map-message" role="status">{error}</p>}
   <div className="map-tools"><button type="button" disabled={!ready||locating} onClick={locate}><Crosshair size={18}/>{locating?'正在定位…':'使用当前位置'}</button><button type="button" onClick={retryMap}><ArrowCounterClockwise size={17}/>重新加载</button></div>
   <div className="map-point-summary"><strong>{point?`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`:'尚未选择位置'}</strong><span>{point?'还未写入表单，请确认位置性质。':'点击地图放置标记，或使用下方手动坐标。'}</span></div>
   <div className="map-point-kind">{[['precise','厕所入口','已确认的实际入口'],['reference','附近地标','还需补充从这里走到厕所的路线']].map(([v,t,h])=><label key={v}><input type="radio" name={radioName} checked={kind===v} onChange={()=>setKind(v)}/><span><strong>{t}</strong><small>{h}</small></span></label>)}</div>
   <p className="muted">所属地区：{regionLabel(value.regionId)||'尚未选择'}。选点不会自动修改行政地区，请与上方地区核对。</p>
   <div className="map-actions"><button type="button" className="outline" onClick={()=>setOpen(false)}>取消选点</button><button type="button" className="primary" disabled={!ready||!point} onClick={()=>{onChange({...point,locationMode:kind});setOpen(false);}}>使用这个位置</button></div>
   <small className="map-privacy">底图由 OpenStreetMap 提供；设备定位仅在点击后获取。城市搜索在本站目录查询，未收录的入口请手动选点。</small>
  </>}
 </section>;
}
