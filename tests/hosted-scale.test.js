import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import sharp from 'sharp';

test('100 identities: concurrent first login, comment writes, retries and public reads',{timeout:120000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bilabang-scale-'));
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:path.resolve('dist/server/index.js'),compatibilityDate:'2026-09-01',d1Databases:{DB:'scale'},resourcePersistencePath:dir,r2Buckets:['FILES'],bindings:{ADMIN_EMAIL:'meos@example.test',RATE_SALT:'scale-only'},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}}));
 const timings=[];
 async function call(route,user,method='GET',body){const start=performance.now();const wire=new Request('https://example.test/api'+route,{method,headers:{Origin:'https://example.test',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user==='Meos'?'meos@example.test':user+'@example.test'}:{})},body});const res=await mf.dispatchFetch(wire.url,{method,headers:Object.fromEntries(wire.headers),body:method==='GET'?undefined:await wire.arrayBuffer()});const data=await res.json();timings.push(performance.now()-start);assert.ok(res.status<400,JSON.stringify({route,status:res.status,data}));return data;}
 async function pool(count,fn,width=20){let next=0;return Promise.all(Array.from({length:width},async()=>{while(next<count){const i=next++;await fn(i);}}));}
 try{
  const db=await mf.getD1Database('DB');for(const sql of (await fs.readFile('drizzle/0000_salty_sphinx.sql','utf8')).split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run();
  await call('/admin/import-sources','Meos','POST','{}');
  await pool(100,async i=>{const user='Meos-'+i;const [a,b]=await Promise.all([call('/me',user),call('/me',user)]);assert.equal(a.id,b.id);});
  assert.equal((await db.prepare('SELECT count(*) n FROM users').first()).n,101);
  const place=(await call('/places'))[0];const ids=[];
  await pool(100,async i=>{const f=new FormData();f.set('payload',JSON.stringify({requestId:crypto.randomUUID(),kind:'visit',date:'2026-09-08',text:'并发测试，Meos：现场可达。',scenery:5,cleanliness:4,access:3,facilities:2}));f.set('photoMetadata','[]');const [a,b]=await Promise.all([call('/places/'+place.id+'/reviews','Meos-'+i,'POST',f),call('/places/'+place.id+'/reviews','Meos-'+i,'POST',f)]);assert.equal(a.id,b.id);ids.push(a.id);});
  assert.equal((await db.prepare('SELECT count(*) n FROM reviews').first()).n,100);
  assert.equal((await call('/places/'+place.id+'/reviews')).length,0);
  for(const id of ids)await db.prepare("UPDATE reviews SET status='approved' WHERE id=?").bind(id).run();
  assert.equal((await call('/places/'+place.id+'/reviews')).length,100);
  await pool(100,async()=>{const list=await call('/places');assert.equal(list.find(p=>p.id===place.id).scores.overall.count,100);});
  timings.sort((a,b)=>a-b);const report={environment:'local workerd D1/R2; verified-identity simulation, not real OAuth or Internet capacity',identities:100,requests:timings.length,concurrentWorkers:20,duplicateRecords:0,p50Ms:Math.round(timings[Math.floor(timings.length*.5)]),p95Ms:Math.round(timings[Math.floor(timings.length*.95)])};
  await fs.mkdir('output',{recursive:true});await fs.writeFile('output/community-scale.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await mf.dispose();await fs.rm(dir,{recursive:true,force:true});}
});
