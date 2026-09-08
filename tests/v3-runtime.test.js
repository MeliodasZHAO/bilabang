import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import sources from '../src/data/source-places.js';
import {queryRegions} from '../server-regions.js';
import {regionPath} from '../src/regions.js';
import {migrateV3} from '../server-migrations.js';
import {normalizePlace} from '../src/place-schema.js';
test('global directory supports all roots, paginated cities, Chinese district paths and coordinate anchors',()=>{
 assert.ok(queryRegions().total>200);
 const result=queryRegions({q:'Paris'});const paris=result.items.find(r=>r.id.startsWith('FR-')&&r.name==='Paris');assert.ok(paris);assert.equal(regionPath(paris.id)[0].id,'FR');assert.ok(paris.lat>48&&paris.lat<50);
 const place=normalizePlace({...sources[0],regionId:paris.id,locationMode:'precise',lat:paris.lat,lng:paris.lng},[]);assert.equal(place.country,'法国');assert.equal(place.city,'Paris');
 assert.equal(queryRegions({q:'上海虹口'}).items[0].id,'CN-310109');
 const root=queryRegions({parent:'CN'});assert.ok(root.items.some(r=>r.id==='CN-71'));assert.ok(!queryRegions().items.some(r=>r.id==='TW'));
 const page=queryRegions({offset:60});assert.ok(!queryRegions().items.some(r=>r.id===page.items[0].id));
});
test('local v3 revision CAS, audit reasons privacy, purpose-bound one-use verification and durable migration',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bilabang-v3-'));
 const child=spawn(process.execPath,['server.js','--preview'],{env:{...process.env,DATA_DIR:dir,PORT:'0'},stdio:['ignore','pipe','pipe']});
 try{
  const url=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127.0.0.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});child.on('exit',()=>{clearTimeout(t);reject(Error('server exited'));});});
  let cookie='';const req=(p,b)=>fetch(url+'/api'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:b?JSON.stringify(b):undefined});
  const login=await req('/login',{name:'Meos',password:'meos'});cookie=login.headers.get('set-cookie').split(';')[0];
  const db=new DatabaseSync(path.join(dir,'bilabang.sqlite'));db.prepare('INSERT INTO places(id,payload,status,receipt) VALUES(?,?,?,?)').run('test-v3',JSON.stringify(sources[0]),'pending','a'.repeat(36));
  const edit={version:1,place:{address:'修正后的入口地址'},reason:'核实并修正入口地址'};
  const writes=await Promise.all([req('/admin/places/test-v3/edit',edit),req('/admin/places/test-v3/edit',edit)]);assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
  assert.equal((await req('/admin/places/test-v3',{version:1,status:'approved',reason:'核实完毕'})).status,409);
  assert.equal((await req('/admin/places/test-v3',{version:2,status:'rejected',reason:'请补充入口照片',internalNote:'内部核查备注'})).status,200);
  const history=await (await req('/admin/places/test-v3/history')).json();assert.equal(history.revisions.length,1);assert.equal(history.moderation[0].internal_note,'内部核查备注');
  cookie='';assert.equal((await req('/admin/places/test-v3/history')).status,403);
  const receipt=await (await req('/receipts/'+'a'.repeat(36))).json();assert.equal(receipt.reason,'请补充入口照片');assert.ok(!JSON.stringify(receipt).includes('内部'));
  const challenge=await (await req('/verification/send',{phone:'13800000000',purpose:'submission'})).json();
  assert.notEqual(db.prepare('SELECT code FROM verifications WHERE id=?').get(challenge.challenge).code,challenge.demoCode);
  const checked=await (await req('/verification/check',{challenge:challenge.challenge,code:challenge.demoCode})).json();
  assert.equal((await req('/register',{name:'Meos',password:'meos',verification:checked.verification})).status,400);
  const submit=()=>{const f=new FormData();f.set('payload',JSON.stringify({...sources[0],requestId:'concurrent-v3-request-id'}));f.set('photoMetadata','[]');f.set('verification',checked.verification);return fetch(url+'/api/submissions',{method:'POST',body:f});};
  const first=await submit();assert.equal(first.status,201);const result=await first.json();const repeat=await submit();assert.equal(repeat.status,200);assert.equal((await repeat.json()).id,result.id);
  assert.ok(db.prepare('SELECT used_at FROM verifications WHERE id=?').get(checked.verification).used_at);
  assert.equal(db.prepare('SELECT version FROM schema_migrations').get().version,3);assert.equal(db.prepare("SELECT COUNT(*) n FROM place_revisions").get().n,1);
  assert.equal(migrateV3(db,dir),false);assert.equal(db.prepare("SELECT address FROM (SELECT json_extract(payload,'$.address') address FROM places WHERE id='test-v3')").get().address,'修正后的入口地址');
  assert.ok((await readdir(path.join(dir,'backups'))).some(s=>s.startsWith('before-v3-')));db.close();
 }finally{const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;await rm(dir,{recursive:true,force:true});}
});
