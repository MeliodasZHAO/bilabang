import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sources from '../src/data/source-places.js';
import {DatabaseSync} from 'node:sqlite';
test('production discovery only exposes approved non-demo places and configured canonical domain',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bilabang-production-public-'));
 const child=spawn(process.execPath,['server.js','--production'],{env:{...process.env,DATA_DIR:dir,PORT:'0',SITE_URL:'https://example.test'},stdio:['ignore','pipe','pipe']});
 try{
 const url=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127.0.0.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});});
 const db=new DatabaseSync(path.join(dir,'bilabang.sqlite'));
 for(const [id,status,demo] of [['public-entry','approved',false],['draft-entry','pending',false],['demo-entry','approved',true]])db.prepare('INSERT INTO places(id,payload,status,receipt) VALUES(?,?,?,?)').run(id,JSON.stringify({...sources[0],name:id,demo}),status,id);db.close();
 const response=await fetch(url+'/?place=public-entry');assert.equal(response.status,200);const html=await response.text();assert.match(html,/<h1>public-entry<\/h1>/);assert.ok(html.includes('https://example.test/?place=public-entry'));assert.equal(response.headers.get('x-robots-tag'),'index, follow');
 for(const id of ['draft-entry','demo-entry'])assert.equal((await fetch(url+'/?place='+id)).status,404);
 const map=await fetch(url+'/sitemap.xml');assert.equal(map.status,200);const xml=await map.text();assert.ok(xml.includes('public-entry'));assert.ok(!xml.includes('draft-entry'));assert.ok(!xml.includes('demo-entry'));
 assert.match(await (await fetch(url+'/robots.txt')).text(),/Sitemap: https:\/\/example.test\/sitemap.xml/);
 }finally{const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;await rm(dir,{recursive:true,force:true});}
});
test('shared source flow: admin publication, guest gate, no-photo record and retry idempotency',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bilabang-source-'));
 const child=spawn(process.execPath,['server.js','--preview'],{env:{...process.env,DATA_DIR:dir,PORT:'0'},stdio:['ignore','pipe','pipe']});
 try{
 const url=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),15000);child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127.0.0.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});});
 const login=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Meos',password:'meos'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(url+'/assets/nonexistent-build.js')).status,404);
 const body=(extra={})=>{const f=new FormData();f.set('payload',JSON.stringify({...sources[0],requestId:'source-test-request-123',publish:true,...extra}));f.set('photoMetadata','[]');return f;};
 assert.equal((await fetch(url+'/api/submissions',{method:'POST',body:body()})).status,400);
 const post=extra=>fetch(url+'/api/submissions',{method:'POST',headers:{Cookie:cookie},body:body(extra)});
 const first=await post();assert.equal(first.status,201);const p=await first.json();assert.equal(p.status,'approved');
 const retry=await post();assert.equal(retry.status,200);assert.equal((await retry.json()).id,p.id);
 const list=await (await fetch(url+'/api/places')).json();assert.equal(list.length,1);assert.equal(list[0].lat,null);assert.equal(list[0].date,null);assert.deepEqual(list[0].photos,[]);assert.equal(list[0].requestActor,undefined);assert.equal(list[0].scores.overall.count,0);
 assert.equal((await post({requestId:'source-test-request-456',customRegion:'新地区'})).status,403);
 assert.equal((await post({requestId:'source-test-request-789',sourceUrl:'javascript:alert(1)'})).status,400);
 const db=new DatabaseSync(path.join(dir,'bilabang.sqlite'));
 db.prepare('INSERT INTO places(id,payload,status,receipt) VALUES(?,?,?,?)').run('source:tokyo-shoto',JSON.stringify({...sources[3],demo:false}),'approved','source-photo-fixture');db.close();
 const asset=await fetch(url+'/sourced/shoto.jpg');assert.equal(asset.status,200);assert.equal(asset.headers.get('content-type'),'image/jpeg');assert.equal(asset.headers.get('cache-control'),'private, no-store');await asset.arrayBuffer();
 const html=await fetch(url+'/?place=source%3Atokyo-shoto');assert.equal(html.status,200);assert.match(await html.text(),/<h1>锅岛松涛公园厕所<\/h1>/);assert.equal(html.headers.get('x-robots-tag'),'noindex, nofollow');
 assert.match(await (await fetch(url+'/robots.txt')).text(),/Disallow: \//);
 assert.equal((await fetch(url+'/sitemap.xml')).status,503);
 const removed=await fetch(url+'/api/admin/places/source%3Atokyo-shoto',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({status:'rejected',version:1,reason:'资料需重新核查'})});assert.equal(removed.status,200);
 assert.equal((await fetch(url+'/sourced/shoto.jpg')).status,404);
 const hidden=await fetch(url+'/?place=source%3Atokyo-shoto');assert.equal(hidden.status,404);assert.ok(!(await hidden.text()).includes('锅岛松涛公园厕所'));
 assert.equal((await fetch(url+'/sourced//shoto.jpg')).status,404);
 assert.equal((await fetch(url+'/sourced%2fshoto.jpg')).status,404);
 assert.equal((await fetch(url+'/SOURCED/shoto.jpg')).status,404);
 assert.equal((await fetch(url+'/sourced/shoto.jpg',{headers:{Cookie:cookie}})).status,200);
 }finally{const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;await rm(dir,{recursive:true,force:true});}
});
