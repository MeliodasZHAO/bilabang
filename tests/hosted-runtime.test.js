import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import sharp from 'sharp';

test('compiled Worker persists reviews and photos; guests, moderation, scoring and CAS enforce boundaries',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bilabang-hosted-'));
 const options={modules:true,scriptPath:path.resolve('dist/server/index.js'),compatibilityDate:'2026-09-01',d1Databases:{DB:'test-bilabang'},resourcePersistencePath:dir,r2Buckets:['FILES'],bindings:{ADMIN_EMAIL:'meos@example.test',RATE_SALT:'test-only-salt'},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}};
 let mf=new Miniflare(convertV4MiniflareOptions(options));
 const admin={'oai-authenticated-user-id':'Meos','oai-authenticated-user-email':'meos@example.test'},member={'oai-authenticated-user-id':'member','oai-authenticated-user-email':'member@example.test'};
 const request=async(route,{method='GET',data,form,headers={}}={})=>{
  const wire=new Request('https://example.test/api'+route,{method,headers:{...(method==='GET'?{}:{Origin:'https://example.test'}),...(data?{'Content-Type':'application/json'}:{}),...headers},body:form|| (data?JSON.stringify(data):undefined)});
  const response=await mf.dispatchFetch(wire.url,{method,headers:Object.fromEntries(wire.headers),body:method==='GET'?undefined:await wire.arrayBuffer()});
  return {status:response.status,body:response.headers.get('Content-Type')?.includes('json')?await response.json():new Uint8Array(await response.arrayBuffer())};
 };
 try{
  const db=await mf.getD1Database('DB'),sql=await fs.readFile('drizzle/0000_salty_sphinx.sql','utf8');
  for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
  assert.equal((await request('/config')).body.writeEnabled,true);
  assert.equal((await request('/admin')).status,403);
  assert.equal((await request('/admin/import-sources',{method:'POST',headers:admin,data:{}})).status,200);
  const catalog=(await request('/places')).body;assert.equal(catalog.length,7);const place=catalog[0];
  assert.equal((await request('/admin/import-sources',{method:'POST',headers:admin,data:{}})).status,200);assert.equal((await request('/places')).body.length,7);
  const jpeg=await sharp({create:{width:64,height:48,channels:3,background:'#e8e8e8'}}).jpeg().toBuffer();
  const form=(kind='visit',extra={})=>{const f=new FormData();f.set('payload',JSON.stringify({requestId:crypto.randomUUID(),kind,date:'2026-09-08',text:'Meos 测试：现场开放，入口明确。',condition:'open',scenery:5,cleanliness:4,access:3,facilities:2,...extra}));f.set('photoMetadata',JSON.stringify([{kind:'entrance',caption:'Meos 测试入口实拍',rights:'own'}]));f.append('photos',new Blob([jpeg],{type:'application/octet-stream'}),'temporary-upload');return f;};
  assert.equal((await request(`/places/${place.id}/reviews`,{method:'POST',form:form()})).status,401);
  const submission=form(),created=await request(`/places/${place.id}/reviews`,{method:'POST',form:submission,headers:member});assert.equal(created.status,201,JSON.stringify(created.body));
  const retry=await request(`/places/${place.id}/reviews`,{method:'POST',form:submission,headers:member});assert.equal(retry.body.id,created.body.id);
  assert.deepEqual((await request(`/places/${place.id}/reviews`)).body,[]);
  const mine=(await request(`/places/${place.id}/reviews`,{headers:member})).body;assert.equal(mine.length,1);const photo=mine[0].photos[0];
  assert.equal((await request('/photos/'+photo.id)).status,404);assert.equal((await request('/photos/'+photo.id,{headers:member})).status,200);assert.equal((await request('/photos/'+photo.id,{headers:admin})).status,200);
  const approve=async(id,version=1,status='approved')=>request('/admin/reviews/'+id,{method:'POST',headers:admin,data:{version,status,reason:'核对照片与到访信息',internalNote:'私密审核备注'}});
  assert.equal((await approve(created.body.id)).status,200);assert.equal((await request('/photos/'+photo.id)).status,200);
  assert.equal((await approve(created.body.id)).status,409);
  let scored=(await request('/places')).body.find(p=>p.id===place.id);assert.equal(scored.scores.overall.count,1);assert.equal(scored.scores.overall.average,4);assert.equal(scored.scores.overall.rank,null);
  const newer=await request(`/places/${place.id}/reviews`,{method:'POST',headers:member,form:form('visit',{scenery:1,cleanliness:1,access:1,facilities:1})});assert.equal(newer.status,201);await approve(newer.body.id);
  scored=(await request('/places')).body.find(p=>p.id===place.id);assert.equal(scored.scores.overall.count,1);assert.equal(scored.scores.overall.average,1);
  const reply=await request(`/places/${place.id}/reviews`,{method:'POST',headers:member,form:form('reply',{parentId:created.body.id})});assert.equal(reply.status,201);await approve(reply.body.id);
  const guestForm=new FormData();guestForm.set('payload',JSON.stringify({...place,template:'source',consent:true,requestId:crypto.randomUUID(),publish:true}));guestForm.set('photoMetadata','[]');
  const guest=await request('/submissions',{method:'POST',form:guestForm});assert.equal(guest.status,201,JSON.stringify(guest.body));assert.equal(guest.body.status,'pending');assert.match(guest.body.receipt,/^[a-f0-9]{36}$/);
  const receipt=await request('/receipts/'+guest.body.receipt);assert.equal(receipt.body.status,'pending');assert.equal(receipt.body.id,undefined);
  const denied=await request('/admin/places/'+place.id+'/edit',{method:'POST',headers:admin,data:{version:1,place:{...place,name:'Meos 修订测试'},reason:'核查名称修改'}});assert.equal(denied.status,200,JSON.stringify(denied.body));
  assert.equal((await request('/admin/places/'+place.id+'/edit',{method:'POST',headers:admin,data:{version:1,place,reason:'再次修改'}})).status,409);
  assert.equal((await request('/admin/import-sources',{method:'POST',headers:{...admin,Origin:'https://elsewhere.test'},data:{}})).status,403);
  await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(options));
  const persisted=(await request(`/places/${place.id}/reviews`)).body;assert.equal(persisted.length,3,JSON.stringify(persisted));assert.equal((await request('/photos/'+photo.id)).status,200);
  await approve(created.body.id,2,'rejected');assert.equal((await request('/photos/'+photo.id)).status,404);
  assert.equal((await request(`/places/${place.id}/reviews`)).body.length,1);
 }finally{await mf.dispose();await fs.rm(dir,{recursive:true,force:true});}
});
