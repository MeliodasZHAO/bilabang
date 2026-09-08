import React,{useState,useEffect,useRef,useCallback} from 'react';
import Select from './Select.jsx';
import {preparePhoto} from './upload-images.js';
import {photoKinds,today} from './place-schema.js';
const labels={scenery:'风景',cleanliness:'卫生',access:'容易到达',facilities:'设施'};
const conditions={unknown:'状态不确定',open:'正常开放',closed:'暂时关闭',maintenance:'维护 / 施工'};
export default function CommunityReviews({place,user,api,login,notify}){
 const [list,setList]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[kind,setKind]=useState('visit'),[reply,setReply]=useState(null),[photos,setPhotos]=useState([]),[filter,setFilter]=useState('all');
 const requestId=useRef(crypto.randomUUID()),formRef=useRef(null),photosRef=useRef([]);
 const [updated,setUpdated]=useState(null),[syncError,setSyncError]=useState('');
 const activeRequest=useRef(null);
 const load=useCallback(async(background=false)=>{
  if(activeRequest.current)return;
  const controller=new AbortController();activeRequest.current=controller;
  if(!background)setLoading(true);
  try{const next=await api(`/places/${place.id}/reviews`,{signal:controller.signal});if(!controller.signal.aborted){setList(next);setUpdated(new Date());setSyncError('');setError('');}}
  catch(e){if(!controller.signal.aborted){if(background)setSyncError('动态同步暂时中断，会自动重试');else setError(e.message);}}
  finally{if(activeRequest.current===controller)activeRequest.current=null;if(!controller.signal.aborted)setLoading(false);}
 },[place.id,user?.id,api]);
 useEffect(()=>{
  setList([]);load();
  const check=()=>{if(document.visibilityState==='visible')load(true);};
  const timer=setInterval(check,15000);document.addEventListener('visibilitychange',check);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);activeRequest.current?.abort();activeRequest.current=null;};
 },[load]);
 useEffect(()=>{photosRef.current=photos;},[photos]);
 useEffect(()=>()=>photosRef.current.forEach(p=>URL.revokeObjectURL(p.url)),[]);
 const root=list.filter(r=>!r.parentId),visible=root.filter(r=>filter==='all'||(filter==='photos'?r.photos?.length:r.kind===filter));
 async function submit(e){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   const data=Object.fromEntries(new FormData(e.currentTarget));
   const payload={...data,kind:reply?'reply':kind,parentId:reply?.id,requestId:requestId.current};
   for(const k of Object.keys(labels))payload[k]=Number(data[k]);
   const form=new FormData();form.set('payload',JSON.stringify(payload));
   form.set('photoMetadata',JSON.stringify(photos.map(p=>({kind:p.kind,caption:p.caption,rights:'own'}))));
   for(const p of photos)form.append('photos',await preparePhoto(p.file));
   await api(`/places/${place.id}/reviews`,{method:'POST',body:form});
   requestId.current=crypto.randomUUID();formRef.current.reset();photos.forEach(p=>URL.revokeObjectURL(p.url));setPhotos([]);setReply(null);
   notify('已提交审核，你可以在下方查看自己的待审记录');await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 function renderRecord(r,nested=false){return <article className={'community-record'+(nested?' is-reply':'')} key={r.id}>
  <div className="community-byline"><strong>{r.name}</strong><span>{r.kind==='reply'?'回复':r.kind==='update'?'现场信息':'到访评价'}</span>{r.status!=='approved'&&<span className="status">{r.status==='pending'?'审核中 · 仅你可见':'未公开 · 仅你可见'}</span>}</div>
  <p className="muted">{r.date?`${r.date} 到访 · `:''}{new Date(r.created).toLocaleString('zh-CN')} 发布</p>
  {r.kind==='visit'&&<div className="community-ratings">{Object.entries(labels).map(([k,t])=><span key={k}>{t} <strong>{r[k]}</strong><small>/5</small></span>)}</div>}
  {r.condition&&r.condition!=='unknown'&&<p className="community-condition">现场记录：{conditions[r.condition]} <small>以到访日期为准，当前情况可能变化</small></p>}
  <p className="community-text">{r.text}</p>
  {!!r.photos?.length&&<div className="community-photos">{r.photos.map(p=><figure key={p.id}><a href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer"><img src={`/api/photos/${p.id}`} loading="lazy" alt={p.caption}/></a><figcaption>{photoKinds[p.kind]} · {p.caption}</figcaption></figure>)}</div>}
  {!nested&&r.status==='approved'&&<button className="outline" onClick={()=>{if(!user){login();return;}setReply(r);setTimeout(()=>formRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),0);}}>回复</button>}
  {!nested&&list.filter(child=>child.parentId===r.id).map(child=>renderRecord(child,true))}
 </article>;}
 return <section className="community-section"><div className="community-heading"><div><h3>到访者的真实体验</h3><p className="muted">实拍、现场变化和不同角度的评价，一起补全这个地点。</p></div><button className="outline" disabled={loading} onClick={()=>load()}>{loading?'加载中…':'刷新动态'}</button></div>
  <p className="community-sync" role="status">{syncError||`每 15 秒同步已审核动态${updated?' · 最近更新 '+updated.toLocaleTimeString('zh-CN'): ''}`}<span>新评论先审核，不是发出即公开</span></p><div className="tabs" role="group" aria-label="筛选到访内容">{Object.entries({all:'全部',visit:'到访评价',update:'现场信息',photos:'有图片'}).map(([k,t])=><button key={k} aria-pressed={filter===k} className={filter===k?'selected':''} onClick={()=>setFilter(k)}>{t}</button>)}</div>
  {error&&<p className="error" role="alert">{error}</p>}
  {loading?<p role="status">正在加载到访记录…</p>:visible.length?visible.map(r=>renderRecord(r)):<p className="muted">{filter==='all'?'还没有到访记录，留下第一份真实体验吧。':'当前分类还没有记录，可切换查看全部。'}</p>}
  {user?<form ref={formRef} className="review-form community-form" onSubmit={submit}><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
   <h3>{reply?`回复 ${reply.name}`:'补充你的到访记录'}</h3>
   {reply?<div className="notice">{reply.text.slice(0,100)}<button type="button" onClick={()=>setReply(null)}>取消回复</button></div>:<label className="wizard-field">记录类型<Select value={kind} onChange={e=>setKind(e.target.value)}><option value="visit">到访评价 · 参与评分</option><option value="update">现场信息 · 不参与评分</option></Select></label>}
   {!reply&&<div className="form-grid"><label className="wizard-field">实际到访日期 · 必填<input name="date" type="date" required max={today()}/></label><label className="wizard-field">当时的开放状态<Select name="condition" defaultValue="unknown">{Object.entries(conditions).map(([k,t])=><option key={k} value={k}>{t}</option>)}</Select></label></div>}
   {!reply&&kind==='visit'&&<><div className="form-grid">{Object.entries(labels).map(([k,t])=><label className="wizard-field" key={k}>{t} · 必填<Select name={k} required defaultValue=""><option value="" disabled>请选择</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} 分 · {['很差','较差','一般','不错','非常好'][n-1]}</option>)}</Select></label>)}</div><p className="muted">每个地点取你最近一次已审核到访评分；历史记录仍保留，重复到访不增加评分人数。</p></>}
   <label className="wizard-field">{reply?'回复内容':'实际体验 / 变化说明'} · 必填<textarea name="text" required minLength={2} maxLength={2000} rows={4} placeholder="例如：今天入口在建筑背面，有纸，但洗手池暂时停水。"/></label>
   <label className="wizard-field">补充实拍 · 选填<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e=>{const files=[...e.target.files];e.target.value='';if(files.length+photos.length>6||files.some(f=>f.size>8*1024*1024)){setError('最多六张照片，每张不超过 8 MB');return;}setPhotos(old=>[...old,...files.map(file=>({file,url:URL.createObjectURL(file),kind:'exterior',caption:''}))]);}}/></label>
   {photos.map((p,i)=><div className="photo-editor" key={p.url}><img src={p.url} alt={`待提交实拍 ${i+1}`}/><div><label>照片用途<Select value={p.kind} onChange={e=>setPhotos(old=>old.map((x,n)=>n===i?{...x,kind:e.target.value}:x))}>{Object.entries(photoKinds).map(([k,t])=><option key={k} value={k}>{t}</option>)}</Select></label><input aria-label={`照片 ${i+1} 说明`} required maxLength={300} placeholder="说明照片里看到什么（必填）" value={p.caption} onChange={e=>setPhotos(old=>old.map((x,n)=>n===i?{...x,caption:e.target.value}:x))}/><button type="button" disabled={busy} onClick={()=>{URL.revokeObjectURL(p.url);setPhotos(old=>old.filter((_,n)=>n!==i));}}>移除</button></div></div>)}
   <label className="consent"><input type="checkbox" required/>我确认内容真实，附图为本人拍摄，未包含如厕者、隔间隐私或私人信息。</label>
   <p className="muted">图片会压缩并移除位置元数据，审核后公开。请勿把短期状态当作长期保证。</p>
   <button className="primary" disabled={busy}>{busy?'正在处理并提交…':'提交审核'}</button>
  </fieldset></form>:<button className="outline" onClick={login}>登录后补充图片、评分与留言</button>}
 </section>;
}
