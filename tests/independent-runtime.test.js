import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {createApplication} from '../server/production.mjs';
import {databaseBinding} from '../server/storage.mjs';

test('independent HTTP runtime: password auth, spoof rejection, multipart, moderation, CORS and durable restart',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bilabang-independent-'));
 const config={NODE_ENV:'production',HOST:'127.0.0.1',PORT:'5188',SITE_URL:'https://app.bilabang.com',API_ORIGIN:'https://api.bilabang.com',DATA_DIR:dir,RATE_SALT:'independent-runtime-test-'.repeat(3)};
 let app,base,cookie;
 const start=async()=>{app=createApplication(config);await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+app.server.address().port;};
 const request=async(route,{method='GET',data,form,session=cookie,headers={}}={})=>{
  const r=await fetch(base+'/api'+route,{method,headers:{Origin:config.SITE_URL,...(session?{Cookie:session}:{}),...(data?{'Content-Type':'application/json'}:{}),...headers},body:form||(data?JSON.stringify(data):undefined)});
  return {status:r.status,headers:r.headers,body:r.headers.get('content-type')?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())};
 };
 try {
  await start();
  assert.equal((await request('/config')).body.auth,'password');
  assert.equal((await request('/me',{session:'',headers:{'oai-authenticated-user-id':'Meos','oai-authenticated-user-email':'admin@example.test'}})).body,null);
  assert.equal((await request('/admin',{session:''})).status,403);
  assert.equal((await request('/login',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST'}})).headers.get('access-control-allow-credentials'),'true');
  assert.equal((await request('/register',{method:'POST',data:{name:'Meos',password:'meos'},headers:{Origin:'https://evil.test'}})).status,403);
  const registered=await request('/register',{method:'POST',data:{name:'Meos',password:'meos',role:'admin'}});
  assert.equal(registered.status,200,JSON.stringify(registered.body));assert.equal(registered.body.role,'member');
  cookie=registered.headers.get('set-cookie').split(';')[0];
  assert.match(registered.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await request('/me')).body.name,'Meos');
  assert.equal((await request('/admin')).status,403);
  assert.equal((await request('/register',{method:'POST',data:{name:'meos',password:'meos'}})).status,409);
  assert.equal((await request('/login',{method:'POST',data:{name:'Meos',password:'wrong'}})).status,401);
  assert.equal((await request('/login',{method:'POST',data:{name:'Meos',password:'x'.repeat(18000)}})).status,413);
  assert.equal((await request('/register',{method:'POST',data:{name:'Other',password:'meos'},headers:{Origin:''}})).status,403);
  const credential=app.db.prepare('SELECT * FROM auth_credentials').get();assert.notEqual(credential.password_hash,'meos');
  assert.notEqual(app.db.prepare('SELECT token_hash FROM auth_sessions').get().token_hash,cookie.split('=')[1]);
  // Explicit isolated fixture role transition; no production HTTP promotion route exists.
  app.db.prepare("UPDATE auth_credentials SET role='admin' WHERE user_id=?").run(registered.body.id);
  assert.equal((await request('/admin/import-sources',{method:'POST',data:{}})).status,200);
  const places=(await request('/places',{session:''})).body;assert.equal(places.length,7);const place=places[0];
  app.db.prepare("UPDATE auth_credentials SET role='member' WHERE user_id=?").run(registered.body.id);
  const photo=await sharp(randomBytes(1800*1200*3),{raw:{width:1800,height:1200,channels:3}}).jpeg({quality:100}).toBuffer();
  assert.ok(photo.length>1024*1024);
  const form=()=>{const f=new FormData();f.set('payload',JSON.stringify({requestId:crypto.randomUUID(),kind:'visit',date:'2026-09-07',text:'Meos：入口清楚，现场开放。',condition:'open',scenery:5,cleanliness:4,access:3,facilities:2}));f.set('photoMetadata',JSON.stringify([{kind:'entrance',caption:'现场入口',rights:'own'}]));f.append('photos',new Blob([photo],{type:'application/octet-stream'}),'temporary-upload');return f;};
  assert.equal((await request(`/places/${place.id}/reviews`,{method:'POST',session:'',form:form()})).status,401);
  const submission=form();const created=await request(`/places/${place.id}/reviews`,{method:'POST',form:submission});
  assert.equal(created.status,201,JSON.stringify(created.body));
  assert.equal((await request(`/places/${place.id}/reviews`,{method:'POST',form:submission})).body.id,created.body.id);
  assert.deepEqual((await request(`/places/${place.id}/reviews`,{session:''})).body,[]);
  const own=(await request(`/places/${place.id}/reviews`)).body;const photoId=own[0].photos[0].id;
  assert.equal((await request('/photos/'+photoId,{session:''})).status,404);
  assert.equal((await request('/photos/'+photoId)).body.length,photo.length);
  app.db.prepare("UPDATE auth_credentials SET role='admin' WHERE user_id=?").run(registered.body.id);
  const approve=()=>request('/admin/reviews/'+created.body.id,{method:'POST',data:{version:1,status:'approved',reason:'核对照片与信息'}});
  assert.equal((await approve()).status,200);assert.equal((await approve()).status,409);
  assert.equal((await request(`/places/${place.id}/reviews`,{session:''})).body.length,1);
  assert.equal((await request('/photos/'+photoId,{session:''})).status,200);
  const broken=form();broken.set('photos',new Blob([photo.subarray(0,1500)],{type:'image/jpeg'}),'temporary-upload');
  assert.equal((await request(`/places/${place.id}/reviews`,{method:'POST',form:broken})).status,400);
  assert.equal((await request('/places',{session:''})).body.find(p=>p.id===place.id).scores.overall.count,1);
  const guest=new FormData();guest.set('payload',JSON.stringify({...place,template:'source',consent:true,requestId:crypto.randomUUID(),publish:true}));guest.set('photoMetadata','[]');
  const pending=await request('/submissions',{method:'POST',session:'',form:guest});assert.equal(pending.status,201,JSON.stringify(pending.body));assert.equal(pending.body.status,'pending');
  assert.equal((await request('/receipts/'+pending.body.receipt,{session:''})).body.status,'pending');
  assert.equal((await request('/admin/places/'+pending.body.id,{method:'POST',data:{version:1,status:'approved',reason:'核查地点来源'}})).status,200);
  assert.ok((await request('/places',{session:''})).body.some(p=>p.id===pending.body.id));
  const binding=databaseBinding(app.db);
  await assert.rejects(binding.batch([binding.prepare('INSERT INTO users VALUES(?,?,?)').bind('rollback','Meos','now'),binding.prepare('INSERT INTO users VALUES(?,?,?)').bind(registered.body.id,'Meos','now')]));
  assert.equal(app.db.prepare("SELECT * FROM users WHERE id='rollback'").get(),undefined);
  await app.close();await start();
  assert.equal((await request('/me')).body.name,'Meos');
  assert.equal((await request(`/places/${place.id}/reviews`,{session:''})).body.length,1);
  assert.equal((await request('/photos/'+photoId,{session:''})).body.length,photo.length);
  assert.equal((await request('/logout',{method:'POST',data:{}})).status,200);
  assert.equal((await request('/me')).body,null);
  const login=await request('/login',{method:'POST',data:{name:'Meos',password:'meos'}});assert.equal(login.status,200);
  assert.equal((await request('/health')).body.runtime,'independent-node');
 } finally {if(app?.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('production CLI starts the independent entry point without Sites bindings',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bilabang-entrypoint-'));
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['server/production.mjs'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,SITE_URL:'https://app.bilabang.com',API_ORIGIN:'https://api.bilabang.com',RATE_SALT:'entrypoint-test-'.repeat(4)},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const exited=new Promise(resolve=>child.once('exit',resolve));
 try {
  let health;
  for(let attempt=0;attempt<60;attempt++){
   try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);health=await r.json();break;}catch{}
   if(child.exitCode!==null)throw Error(logs);
   await new Promise(r=>setTimeout(r,50));
  }
  assert.equal(health?.runtime,'independent-node',logs);
  const r=await fetch(`http://127.0.0.1:${port}/api/config`,{headers:{Origin:'https://app.bilabang.com'}});assert.equal((await r.json()).auth,'password');
 } finally {if(child.exitCode===null)child.kill('SIGTERM');await exited;await fs.rm(dir,{recursive:true,force:true});}
});
