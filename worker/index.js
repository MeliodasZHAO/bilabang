import {first,rows,run,statement} from './db.js';
import {validateJpeg} from './images.js';
import {normalizePlace,photoKinds,today,safeUrl} from '../src/place-schema.js';
import {regionMap,registerRegions,regionPath} from '../src/regions.js';
import {dimensions,score} from '../src/scoring.js';
import sourcePlaces from '../src/data/source-places.js';
import {sourceImages} from '../src/data/source-images.js';

const uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const clean=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,'0')).join('');
async function identity(req,env){
 const id=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');
 if(!id||!email)return null;
 // These headers are supplied and protected by the Sites dispatcher, never by form data.
 const role=env.ADMIN_EMAIL&&email.toLowerCase()===env.ADMIN_EMAIL.toLowerCase()?'admin':'member';
 const existing=await first(env,'SELECT id,name FROM users WHERE id=?',id);
 if(existing)return {...existing,role};
 const name=role==='admin'?'Meos':'旅人 '+(await hash(id)).slice(0,6);
 await run(env,'INSERT OR IGNORE INTO users(id,name,created) VALUES(?,?,?)',id,name,now());
 return {id,name,role};
}
async function rate(req,env,scope,user,max){
 if(!env.RATE_SALT)fail(503,'投稿服务正在配置，请稍后重试');
 const time=Date.now(),bucket=Math.floor(time/3600000),actor=user?.id||req.headers.get('cf-connecting-ip')||'anonymous';
 const id=await hash(env.RATE_SALT+scope+actor+bucket);
 const result=await first(env,'INSERT INTO rate_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',id,time+7200000);
 if(result.count>max)fail(429,'操作较频繁，请稍后再试');
 await run(env,'DELETE FROM rate_limits WHERE expires<?',time);
}
async function loadRegion(id,req,env){
 if(regionMap.has(id))return;
 if(!/^[A-Z]{2}-(?:S|C)\d+$/.test(id||''))fail(400,'请选择有效地区');
 const country=id.slice(0,2),response=await env.ASSETS.fetch(new Request(new URL('/region-paths/'+country+'.json',req.url)));
 if(!response.ok)fail(400,'地区资料暂不可用，请重试');
 const items=await response.json(),map=new Map(items.map(r=>[r.id,r]));let current=map.get(id);const path=[];
 while(current){path.unshift(current);current=map.get(current.parentId);}
 if(!path.length)fail(400,'请选择有效地区');registerRegions(path);
}
function currentRatings(reviews){
 const chosen=new Map();
 for(const r of reviews){const p=JSON.parse(r.payload);if(p.kind!=='visit'||!dimensions.every(k=>Number.isInteger(p[k])))continue;const old=chosen.get(r.user_id);if(!old||p.date>old.date||(p.date===old.date&&r.created>old.created))chosen.set(r.user_id,{...p,created:r.created});}
 return [...chosen.values()];
}
async function placeView(row,env,all=false){
 const payload=JSON.parse(row.payload);
 const reviewRows=await rows(env,"SELECT * FROM reviews WHERE place_id=? AND status='approved' AND parent_id IS NULL",row.id);
 const ratings=currentRatings(reviewRows),photos=await rows(env,'SELECT id,metadata FROM photos WHERE place_id=? AND review_id IS NULL',row.id);
 return {id:row.id,...payload,...sourceImages[row.id],regionPath:payload.regionPath||regionPath(payload.regionId),photos:photos.map(p=>({id:p.id,...JSON.parse(p.metadata)})),scores:Object.fromEntries(['overall',...dimensions].map(k=>[k,score(ratings,k)])),...(all?{status:row.status,version:row.version,created:row.created}:{})};
}
async function reviewView(row,env){
 const user=await first(env,'SELECT name FROM users WHERE id=?',row.user_id),photos=await rows(env,'SELECT id,metadata FROM photos WHERE review_id=?',row.id);
 return {id:row.id,place_id:row.place_id,userId:row.user_id,parentId:row.parent_id,...JSON.parse(row.payload),name:user?.name||'已注销用户',created:row.created,status:row.status,version:row.version,photos:photos.map(p=>({id:p.id,...JSON.parse(p.metadata)}))};
}
async function body(req){try{return await req.json();}catch{fail(400,'无法读取提交内容');}}
async function multipart(req){try{return await req.formData();}catch{fail(400,'无法读取上传内容，请重新选择照片');}}
const parse=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
async function storePhotos(files,metadata,placeId,reviewId,env){
 if(files.length>6||files.length!==metadata.length)fail(400,'最多六张照片，每张必须填写说明');
 const prepared=[];
 for(let i=0;i<files.length;i++){
  const file=files[i],m=metadata[i];
  if(!file||typeof file.arrayBuffer!=='function'||file.size>8*1024*1024)fail(400,'每张照片最多 8 MB');
  if(!m||!Object.hasOwn(photoKinds,m.kind)||!clean(m.caption)||!['own','authorized','licensed'].includes(m.rights))fail(400,'请补全每张照片的用途、说明与授权');
  if(m.rights!=='own'&&(!clean(m.author)||!safeUrl(m.sourceUrl)||!clean(m.license)))fail(400,'非自有照片需填写作者、来源和授权');
  const bytes=new Uint8Array(await file.arrayBuffer());try{validateJpeg(bytes);}catch(e){fail(400,e.message);}
  const id=uuid(),key='photos/'+id+'.jpg',safe=Object.fromEntries(['kind','caption','rights','author','sourceUrl','license'].map(k=>[k,clean(m[k])]));
  prepared.push({id,key,bytes,safe});
 }
 try{for(const p of prepared)await env.FILES.put(p.key,p.bytes,{httpMetadata:{contentType:'image/jpeg'}});}catch(e){await Promise.allSettled(prepared.map(p=>env.FILES.delete(p.key)));throw e;}
 return {statements:prepared.map(p=>statement(env,'INSERT INTO photos(id,place_id,review_id,storage_key,metadata,size,created) VALUES(?,?,?,?,?,?,?)',p.id,placeId,reviewId,p.key,JSON.stringify(p.safe),p.bytes.length,now())),cleanup:()=>Promise.allSettled(prepared.map(p=>env.FILES.delete(p.key)))};
}
export async function handle(req,env){
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(!env.DB||!env.FILES)fail(503,'社区存储正在连接，请稍后重试');
 if(method!=='GET'&&method!=='HEAD'){
  if(req.headers.get('origin')!==url.origin)fail(403,'请从本站页面提交');
  const length=Number(req.headers.get('content-length')||0);if(length>50*1024*1024)fail(413,'上传内容过大');
 }
 if(path==='/api/setup-sources'&&method==='POST'){
  if(!env.BOOTSTRAP_KEY||await hash(req.headers.get('x-setup-key')||'')!==await hash(env.BOOTSTRAP_KEY))fail(403,'没有初始化权限');
  const probe='setup-probe/'+uuid();
  try{await env.FILES.put(probe,'storage-ready');const stored=await env.FILES.get(probe);if(!stored||await stored.text()!=='storage-ready')fail(503,'图片存储验证未通过');}finally{await env.FILES.delete(probe);}
  await env.DB.batch(sourcePlaces.map(f=>{const p=normalizePlace(f);p.regionPath=regionPath(p.regionId);return statement(env,"INSERT OR IGNORE INTO places(id,payload,status,version,created) VALUES(?,?,'approved',1,?)",'source:'+f.importKey,JSON.stringify(p),now());}));
  return json({ok:true});
 }
 if(path==='/api/config')return json({demo:false,writeEnabled:true,auth:'chatgpt',guestSubmission:true,community:true});
 const user=await identity(req,env);
 const member=()=>{if(!user)fail(401,'请先使用 ChatGPT 登录后留言');};
 const admin=()=>{if(user?.role!=='admin')fail(403,'需要管理员权限');};
 if(path==='/api/me')return json(user);
 if(path==='/api/places'&&method==='GET')return json(await Promise.all((await rows(env,"SELECT * FROM places WHERE status='approved' ORDER BY created,id")).map(p=>placeView(p,env))));
 if(path==='/api/submissions'&&method==='POST'){
  await rate(req,env,'submission',user,user?.role==='admin'?100:8);
  const form=await multipart(req),b=parse(form.get('payload'),{}),metadata=parse(form.get('photoMetadata'),[]),files=form.getAll('photos');
  if(!/^[\da-f-]{36}$/i.test(b.requestId||''))fail(400,'缺少投稿标识，请刷新草稿后重试');
  const requestKey=await hash('place:'+b.requestId+':'+(user?.id||'guest'));
  const existing=await first(env,'SELECT id,status,receipt FROM places WHERE request_key=?',requestKey);if(existing)return json({id:existing.id,status:existing.status,receipt:existing.receipt});
  await loadRegion(b.regionId,req,env);let payload;try{payload=normalizePlace(b,metadata);}catch(e){fail(400,e.message);}
  const id=uuid(),receipt=token(),status=b.publish&&user?.role==='admin'&&!payload.customRegion?'approved':'pending';
  payload.regionPath=regionPath(payload.regionId);
  const photos=await storePhotos(files,metadata,id,null,env);
  try{await env.DB.batch([statement(env,'INSERT INTO places(id,payload,status,version,created,receipt,request_key,owner_id) VALUES(?,?,?,1,?,?,?,?)',id,JSON.stringify(payload),status,now(),receipt,requestKey,user?.id||null),...photos.statements]);}
  catch(e){await photos.cleanup();const retry=await first(env,'SELECT id,status,receipt FROM places WHERE request_key=?',requestKey);if(retry)return json({id:retry.id,status:retry.status,receipt:retry.receipt});throw e;}
  return json({id,status,receipt},201);
 }
 let match=path.match(/^\/api\/receipts\/([a-f0-9]{36})$/);
 if(match&&method==='GET'){
  const p=await first(env,'SELECT id,status,created FROM places WHERE receipt=?',match[1]);if(!p)fail(404,'回执不存在');
  const event=await first(env,"SELECT reason FROM moderation_events WHERE record_type='places' AND record_id=? ORDER BY created DESC LIMIT 1",p.id);return json({status:p.status,created:p.created,reason:event?.reason||''});
 }
 match=path.match(/^\/api\/places\/([^/]+)\/reviews$/);
 if(match){
  const placeId=decodeURIComponent(match[1]),p=await first(env,"SELECT id FROM places WHERE id=? AND status='approved'",placeId);if(!p)fail(404,'地点尚未公开');
  if(method==='GET'){
   const list=await rows(env,"SELECT * FROM reviews r WHERE place_id=? AND ((status='approved' AND (parent_id IS NULL OR EXISTS(SELECT 1 FROM reviews parent WHERE parent.id=r.parent_id AND parent.status='approved'))) OR user_id=?) ORDER BY created DESC LIMIT 500",placeId,user?.id||'');
   return json(await Promise.all(list.map(r=>reviewView(r,env))));
  }
  if(method==='POST'){
   member();await rate(req,env,'review',user,30);
   const form=await multipart(req),b=parse(form.get('payload'),{}),metadata=parse(form.get('photoMetadata'),[]),files=form.getAll('photos');
   if(!/^[\da-f-]{36}$/i.test(b.requestId||''))fail(400,'缺少评论标识');
   const key=await hash('review:'+user.id+':'+b.requestId),existing=await first(env,'SELECT id,status FROM reviews WHERE request_key=?',key);if(existing)return json(existing);
   const kind=['visit','update','reply'].includes(b.kind)?b.kind:'visit',text=clean(b.text);
   if(text.length<2)fail(400,'请填写至少两字的实际体验或信息');
   const date=clean(b.date,10);if(kind!=='reply'&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today()))fail(400,'请选择有效到访日期');
   if(kind==='visit'&&!dimensions.every(k=>Number.isInteger(b[k])&&b[k]>=1&&b[k]<=5))fail(400,'请为四个维度分别选择 1–5 分');
   let parent=null;if(kind==='reply'){parent=await first(env,"SELECT id FROM reviews WHERE id=? AND place_id=? AND status='approved' AND parent_id IS NULL",clean(b.parentId,100),placeId);if(!parent)fail(400,'只能回复已公开的到访记录或现场信息');}
   const payload={kind,text,date:kind==='reply'?null:date,condition:['open','closed','maintenance','unknown'].includes(b.condition)?b.condition:'unknown',...Object.fromEntries(dimensions.map(k=>[k,kind==='visit'?b[k]:null]))};
   const id=uuid(),photos=await storePhotos(files,metadata,placeId,id,env);
   try{await env.DB.batch([statement(env,"INSERT INTO reviews(id,place_id,user_id,parent_id,payload,status,version,request_key,created) VALUES(?,?,?,?,?,'pending',1,?,?)",id,placeId,user.id,parent?.id||null,JSON.stringify(payload),key,now()),...photos.statements]);}
   catch(e){await photos.cleanup();const retry=await first(env,'SELECT id,status FROM reviews WHERE request_key=?',key);if(retry)return json(retry);throw e;}
   return json({id,status:'pending'},201);
  }
 }
 match=path.match(/^\/api\/places\/([^/]+)\/reports$/);
 if(match&&method==='POST'){
  await rate(req,env,'report',user,10);const b=await body(req),reason=clean(b.reason,1000);if(reason.length<4)fail(400,'请详细说明问题');
  const id=decodeURIComponent(match[1]);if(!await first(env,"SELECT id FROM places WHERE id=? AND status='approved'",id))fail(404,'地点不存在');
  await run(env,"INSERT INTO reports(id,place_id,reason,status,created) VALUES(?,?,?,'pending',?)",uuid(),id,reason,now());return json({ok:true});
 }
 match=path.match(/^\/api\/photos\/([^/]+)$/);
 if(match&&method==='GET'){
  const p=await first(env,'SELECT ph.*,pl.status AS place_status,pl.owner_id,r.status AS review_status,r.parent_id,r.user_id,parent.status AS parent_status FROM photos ph JOIN places pl ON pl.id=ph.place_id LEFT JOIN reviews r ON r.id=ph.review_id LEFT JOIN reviews parent ON parent.id=r.parent_id WHERE ph.id=?',match[1]);
  if(!p||!(user?.role==='admin'||(user&&(user.id===p.user_id||(!p.review_id&&user.id===p.owner_id)))||(p.place_status==='approved'&&(!p.review_id||(p.review_status==='approved'&&(!p.parent_id||p.parent_status==='approved'))))))fail(404,'图片不可用');
  const object=await env.FILES.get(p.storage_key);if(!object)fail(404,'图片不可用');
  return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path.startsWith('/api/admin')){
  admin();
  if(path==='/api/admin'&&method==='GET')return json({places:await Promise.all((await rows(env,'SELECT * FROM places ORDER BY created DESC LIMIT 500')).map(p=>placeView(p,env,true))),reviews:await Promise.all((await rows(env,'SELECT * FROM reviews ORDER BY created DESC LIMIT 500')).map(r=>reviewView(r,env))),reports:await rows(env,'SELECT * FROM reports ORDER BY created DESC LIMIT 500')});
  if(path==='/api/admin/import-sources'&&method==='POST'){
   const statements=sourcePlaces.map(f=>{const p=normalizePlace(f);p.regionPath=regionPath(p.regionId);return statement(env,"INSERT OR IGNORE INTO places(id,payload,status,version,created) VALUES(?,?,'approved',1,?)",'source:'+f.importKey,JSON.stringify(p),now());});
   await env.DB.batch(statements);return json({ok:true});
  }
  match=path.match(/^\/api\/admin\/places\/([^/]+)\/history$/);
  if(match&&method==='GET')return json({revisions:await rows(env,'SELECT version,reason,created FROM place_revisions WHERE place_id=? ORDER BY version DESC',decodeURIComponent(match[1])),moderation:(await rows(env,"SELECT status,reason,internal_note,created FROM moderation_events WHERE record_type='places' AND record_id=? ORDER BY created DESC",decodeURIComponent(match[1]))).map(e=>({...e,new_status:e.status,public_reason:e.reason}))});
  match=path.match(/^\/api\/admin\/places\/([^/]+)\/edit$/);
  if(match&&method==='POST'){
   const id=decodeURIComponent(match[1]),old=await first(env,'SELECT * FROM places WHERE id=?',id),b=await body(req);if(!old)fail(404,'地点不存在');
   if(b.version!==old.version)fail(409,'资料已被更新，请刷新后重试');const reason=clean(b.reason,1200);if(reason.length<3)fail(400,'请填写修订原因');
   const original=JSON.parse(old.payload),input={...original,...b.place,consent:true};await loadRegion(input.regionId,req,env);const payload=normalizePlace(input,original.photoMetadata||[]);payload.regionPath=regionPath(payload.regionId);
   if(old.status==='approved'&&payload.customRegion)fail(400,'请先规范地区');
   const result=await env.DB.batch([statement(env,'UPDATE places SET payload=?,version=version+1 WHERE id=? AND version=?',JSON.stringify(payload),id,old.version),statement(env,'INSERT INTO place_revisions(id,place_id,version,before_payload,after_payload,actor,reason,created) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1',uuid(),id,old.version+1,old.payload,JSON.stringify(payload),user.id,reason,now())]);
   if(!result[0].meta.changes)fail(409,'资料已被更新，请刷新后重试');return json({version:old.version+1});
  }
  match=path.match(/^\/api\/admin\/(places|reviews|reports)\/([^/]+)$/);
  if(match&&method==='POST'){
   const table=match[1],id=decodeURIComponent(match[2]),b=await body(req),reason=clean(b.reason,1200),status=b.status;
   if(reason.length<3||!(table==='reports'?['resolved']:['approved','rejected']).includes(status))fail(400,'请填写处理原因并选择有效状态');
   const row=await first(env,`SELECT * FROM ${table} WHERE id=?`,id);if(!row)fail(404,'记录不存在');if(row.version!==b.version)fail(409,'记录已更新，请刷新后重试');
   if(table==='places'&&status==='approved'&&JSON.parse(row.payload).customRegion)fail(400,'请先规范地区');
   const result=await env.DB.batch([statement(env,`UPDATE ${table} SET status=?,version=version+1 WHERE id=? AND version=?`,status,id,row.version),statement(env,'INSERT INTO moderation_events(id,record_type,record_id,actor,status,reason,internal_note,created) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1',uuid(),table,id,user.id,status,reason,clean(b.internalNote),now())]);
   if(!result[0].meta.changes)fail(409,'记录已更新，请刷新后重试');return json({version:row.version+1});
  }
 }
 fail(404,'功能或记录不存在');
}
export default {async fetch(req,env){try{return await handle(req,env);}catch(e){if(!e.status)console.error('Community service failure',e.name,e.message);return json({error:e.status?e.message:'服务暂时无法处理，请保留草稿后重试'},e.status||500);}}};
