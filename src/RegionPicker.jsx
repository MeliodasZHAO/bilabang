import React,{useState,useEffect,useRef,useMemo} from 'react';
import {GlobeHemisphereWest,MagnifyingGlass,CaretRight,CaretDown,Check,X,ArrowLeft} from '@phosphor-icons/react';
import {registerRegions,regionMap,regionPath,regionLabel} from './regions.js';
import {api} from './api.js';
export default function RegionPicker({value='',onChange,places=[],creation=false}){
 const [open,setOpen]=useState(false),[pending,setPending]=useState(value),[search,setSearch]=useState(''),[rows,setRows]=useState([]),[total,setTotal]=useState(0),[offset,setOffset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const root=useRef(null),trigger=useRef(null),input=useRef(null);
 const [side,setSide]=useState('bottom');
 const counts=useMemo(()=>{const map=new Map();for(const p of places)for(const r of regionPath(p.regionId))map.set(r.id,(map.get(r.id)||0)+1);return map;},[places,version]);
 const dismiss=()=>{setOpen(false);trigger.current?.focus();};
 useEffect(()=>{if(!value||regionMap.has(value))return;let active=true;api('/regions?id='+encodeURIComponent(value)).then(r=>{if(active){registerRegions(r.items);setVersion(v=>v+1);}}).catch(()=>{});return()=>{active=false;};},[value]);
 useEffect(()=>{if(!open)return;input.current?.focus();const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 useEffect(()=>{
  if(!open)return;let active=true;setBusy(true);setError('');
  const timer=setTimeout(()=>{api(`/regions?parent=${encodeURIComponent(pending)}&q=${encodeURIComponent(search)}&offset=${offset}`).then(result=>{if(!active)return;for(const r of result.items)registerRegions(r.path||[r]);setRows(result.items);setTotal(result.total);setVersion(v=>v+1);}).catch(e=>{if(active){setRows([]);setError(e.message);}}).finally(()=>{if(active)setBusy(false);});},search?250:0);
  return()=>{active=false;clearTimeout(timer);};
 },[open,pending,search,offset]);
 const browse=id=>{setPending(id);setSearch('');setOffset(0);};
 const selectedPath=regionPath(value),last=selectedPath.at(-1),context=selectedPath[0]?.id==='CN'?selectedPath.find(r=>r.level==='city')||selectedPath[1]:selectedPath[0];
 const selectedLabel=last?[last.name,...(context&&context.id!==last.id?[context.name]:[])].join(' · '):'全球 · 选择地区';
 return <div className={'region-control '+(open?'is-open ':'')+(creation?'is-creation':'')} ref={root} onBlur={e=>{if(open&&e.relatedTarget&&!root.current?.contains(e.relatedTarget))setOpen(false);}}>
  <button type="button" className="region-trigger" ref={trigger} title={regionLabel(value)||'全球地区'} aria-expanded={open} aria-haspopup="dialog" onClick={()=>{browse(value);const rect=trigger.current.getBoundingClientRect();setSide(innerHeight-rect.bottom<500&&rect.top>innerHeight-rect.bottom?'top':'bottom');setOpen(!open);}}><GlobeHemisphereWest size={19}/><span>{selectedLabel}</span><CaretDown size={16}/></button>
  {open&&<section className="region-panel" data-side={side} role="dialog" aria-label="地区选择" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();dismiss();}}}>
   <div className="region-heading"><div><strong>你想去哪里？</strong><p>国家 / 地区 → 省州 → 城市 / 区县</p></div><button type="button" onClick={dismiss} aria-label="关闭地区选择"><X size={20}/></button></div>
   <div className="region-search"><MagnifyingGlass size={18}/><input ref={input} aria-label="搜索全球地区" placeholder="搜索国家或城市，如 Paris、上海虹口" value={search} onChange={e=>{setSearch(e.target.value);setOffset(0);}}/>{search&&<button type="button" aria-label="清除地区搜索" onClick={()=>{setSearch('');setOffset(0);input.current?.focus();}}><X size={16}/></button>}</div>
   <div className="region-breadcrumb"><button type="button" onClick={()=>browse('')}>全球</button>{regionPath(pending).map(r=><React.Fragment key={r.id}><CaretRight size={12}/><button type="button" onClick={()=>browse(r.id)}>{r.name}</button></React.Fragment>)}</div>
   {!search&&pending&&<button type="button" className="region-back" onClick={()=>browse(regionMap.get(pending)?.parentId||'')}><ArrowLeft size={15}/>返回上一级</button>}
   <div className="region-options" aria-busy={busy}>{busy?<p role="status">正在加载地区…</p>:error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>{setOpen(false);setTimeout(()=>setOpen(true),0);}}>重试</button></div>:rows.length?rows.map(r=><button type="button" key={r.id} className={r.id===value?'is-selected':''} onClick={()=>browse(r.id)}><span><strong>{r.name}</strong>{search&&<small>{regionLabel(r.id)}</small>}{!search&&r.alias&&r.alias!==r.name&&<small>{r.alias}</small>}</span>{r.id===value?<Check size={16}/>:!creation&&counts.get(r.id)?<small className="region-count">{counts.get(r.id)} 处</small>:<CaretRight size={14}/>}</button>):<div className="region-empty"><GlobeHemisphereWest size={28}/><p>{search?'没有找到匹配地区':'已到当前目录的最细一级'}</p><small>{search?'海外城市可尝试当地名称或英文；未覆盖的区县可在投稿中补充。':'点击下方按钮确认；更详细的入口可在地图标记。'}</small></div>}</div>
   {!busy&&total>60&&<div className="region-pagination"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-60))}>上一页</button><small>{offset+1}–{Math.min(offset+60,total)} / {total}</small><button disabled={offset+60>=total} onClick={()=>setOffset(offset+60)}>下一页</button></div>}
   <div className="region-selection"><small>将选择</small><strong>{regionLabel(pending)||'全球所有地区'}</strong></div>
   <div className="region-footer"><button type="button" className="outline" onClick={dismiss}>取消</button><button type="button" className="primary" disabled={creation&&!pending} onClick={()=>{onChange(pending);dismiss();}}>确认选择</button></div>
   <p className="region-credit">海外目录 <a href="https://github.com/dr5hn/countries-states-cities-database" target="_blank" rel="noreferrer">CSC</a> · <a href="/region-data/LICENSE.txt" target="_blank" rel="noreferrer">ODbL</a> · <a href="/region-data/world.json" download>目录下载</a></p>
  </section>}
 </div>;
}
