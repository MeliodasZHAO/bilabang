import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApplication} from '../server/production.mjs';
import {createAccount} from '../server/auth.mjs';
import {authSchema,openDatabase,databaseBinding} from '../server/storage.mjs';
import {accountRules} from '../server/account-rules.mjs';
import {backup,restore} from '../server/transfer.mjs';
import {accountPolicyVersion,registrationPasswordError} from '../src/account-policy.js';
const agreement={agreements:true,hkStorageConsent:true,policyVersion:accountPolicyVersion};

test('schema 1 migration, legacy login, agreements, concurrent cooldown, immediate mute and full restore through HTTP',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bilabang-account-rules-')),data=path.join(temp,'data');fs.mkdirSync(data);
 const old=new DatabaseSync(path.join(data,'bilabang.sqlite'));
 old.exec(fs.readFileSync('drizzle/0000_salty_sphinx.sql','utf8')+authSchema+'PRAGMA user_version=1;');
 const legacy=await createAccount(old,{name:'Meos',password:'meos'});
 // An isolated administrator fixture, never a public account or production write.
 old.prepare("INSERT INTO users VALUES('fixture-admin','Meos','2026-09-09')").run();
 old.prepare("INSERT INTO auth_credentials SELECT 'fixture-admin','fixture-admin',password_hash,salt,'admin',created FROM auth_credentials WHERE user_id=?").run(legacy.id);
 old.prepare("INSERT INTO places(id,payload,status,created) VALUES('fixture-place','{}','approved','2026-09-09')").run();old.close();
 let app,base,memberCookie,adminCookie;
 const config={NODE_ENV:'production',HOST:'127.0.0.1',PORT:'5188',SITE_URL:'https://bilabang.com',API_ORIGIN:'https://api.bilabang.com',DATA_DIR:data,RATE_SALT:'account-rules-fixture-'.repeat(4)};
 const start=async directory=>{app=createApplication({...config,DATA_DIR:directory});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;};
 async function request(route,{body,form,session=memberCookie}={}) {
  const response=await fetch(base+'/api'+route,{method:body||form?'POST':'GET',headers:{Origin:config.SITE_URL,...(session?{Cookie:session}:{}),...(body?{'Content-Type':'application/json'}:{})},body:form||(body?JSON.stringify(body):undefined)});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],retry:response.headers.get('retry-after'),exposed:response.headers.get('access-control-expose-headers')};
 }
 const form=(overrides={})=>{const f=new FormData();f.set('payload',JSON.stringify({requestId:crypto.randomUUID(),kind:'update',date:'2026-09-07',text:'现场入口已找到',contentConsent:true,...overrides}));f.set('photoMetadata','[]');return f;};
 try {
  await start(data);
  assert.equal(app.db.prepare('PRAGMA user_version').get().user_version,2);
  const logged=await request('/login',{body:{name:'Meos',password:'meos'}});assert.equal(logged.status,200);memberCookie=logged.cookie;
  assert.equal(logged.body.account.policyAccepted,false);
  adminCookie=(await request('/login',{body:{name:'fixture-admin',password:'meos'},session:''})).cookie;
  assert.equal((await request('/places/fixture-place/reviews',{form:form()})).status,403);
  assert.equal((await request('/account/agreements',{body:{...agreement,policyVersion:'old'}})).status,409);
  assert.equal((await request('/account/agreements',{body:{...agreement,hkStorageConsent:false}})).status,400);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM account_consents').get().n,0);
  const accepted=await request('/account/agreements',{body:{...agreement,acceptedAt:'1900-01-01',userId:'fixture-admin'}});
  assert.equal(accepted.body.account.policyAccepted,true);assert.notEqual(accepted.body.account.acceptedAt,'1900-01-01');
  const acceptedAt=accepted.body.account.acceptedAt;
  assert.equal((await request('/account/agreements',{body:agreement})).body.account.acceptedAt,acceptedAt);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM account_consents').get().n,1);
  assert.equal((await request('/places/fixture-place/reviews',{form:form({contentConsent:false})})).status,400);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n,0);
  const firstForm=form(),first=await request('/places/fixture-place/reviews',{form:firstForm});assert.equal(first.status,201,JSON.stringify(first.body));
  const duplicate=await request('/places/fixture-place/reviews',{form:firstForm});assert.equal(duplicate.status,200);assert.equal(duplicate.body.id,first.body.id);
  const cooldown=await request('/places/fixture-place/reviews',{form:form()});assert.equal(cooldown.status,429);assert.ok(Number(cooldown.retry)>0&&Number(cooldown.retry)<=30);
  assert.match(cooldown.exposed,/Retry-After/);
  assert.deepEqual((await request('/places/fixture-place/reviews',{session:''})).body,[]);
  assert.equal((await request('/places/fixture-place/reviews')).body.length,1);
  // Advancing only the isolated fixture avoids a 30-second wait while preserving runtime request shape.
  app.db.prepare("UPDATE reviews SET created='2026-01-01T00:00:00.000Z'").run();
  const concurrent=await Promise.all([request('/places/fixture-place/reviews',{form:form()}),request('/places/fixture-place/reviews',{form:form()})]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,429]);
  assert.equal((await request('/admin/accounts')).status,403);
  const controlBody={status:'muted',version:0,reason:'重复发布无关内容'};
  assert.equal((await request('/admin/accounts/'+legacy.id,{body:controlBody})).status,403);
  assert.equal((await request('/admin/accounts/fixture-admin',{body:controlBody,session:adminCookie})).status,400);
  assert.equal((await request('/admin/accounts/'+legacy.id,{body:controlBody,session:adminCookie})).status,200);
  assert.equal((await request('/me')).body.account.status,'muted');
  assert.equal((await request('/places/fixture-place/reviews',{form:form()})).status,403);
  assert.equal((await request('/submissions',{form:form()})).status,403);
  // An upload prepared before the mute carries stale identity. Its final write
  // transaction must still reject the now-muted account and preserve the table.
  await assert.rejects(accountRules(app.db).publishSubmission(logged.body,[databaseBinding(app.db).prepare("INSERT INTO places(id,payload,status,created) VALUES('stale-upload','{}','pending','now')")]),e=>e.status===403);
  assert.equal(app.db.prepare("SELECT id FROM places WHERE id='stale-upload'").get(),undefined);
  assert.equal((await request('/admin/accounts/'+legacy.id,{body:controlBody,session:adminCookie})).status,409);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM account_control_events').get().n,1);
  const saved=path.join(temp,'backup');assert.equal(backup(data,saved).verified,true);await app.close();
  const restored=path.join(temp,'restored');restore(saved,restored);await start(restored);
  const me=(await request('/me')).body;assert.equal(me.account.status,'muted');assert.equal(me.account.acceptedAt,acceptedAt);
  assert.deepEqual(Object.keys(me).sort(),['account','id','name','role']);
  assert.equal((await request('/admin/accounts/'+legacy.id,{body:{status:'active',version:1,reason:'已核查申诉并恢复'},session:adminCookie})).status,200);
  app.db.prepare("UPDATE reviews SET created='2026-01-01T00:00:00.000Z'").run();
  assert.equal((await request('/places/fixture-place/reviews',{form:form()})).status,201);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM account_control_events').get().n,2);
  assert.equal((await request('/me')).body.account.status,'active');
  const reopened=openDatabase(restored);assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM account_consents').get().n,1);reopened.close();
 } finally {if(app?.server.listening)await app.close();fs.rmSync(temp,{recursive:true,force:true});}
});

test('registration rejects weak passwords and missing agreement without creating a user',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bilabang-registration-'));
 const app=createApplication({NODE_ENV:'production',HOST:'127.0.0.1',PORT:'5188',SITE_URL:'https://bilabang.com',API_ORIGIN:'https://api.bilabang.com',DATA_DIR:dir,RATE_SALT:'registration-fixture-'.repeat(4)});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const register=async data=>{const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/register',{method:'POST',headers:{Origin:'https://bilabang.com','Content-Type':'application/json'},body:JSON.stringify({name:'Meos',...data})});return {status:r.status,body:await r.json()};};
 try {
  for(const password of ['meos','12345678','password','Meos123456'])assert.equal((await register({password,...agreement})).status,400);
  assert.equal((await register({password:'meos-community-fixture'})).status,400);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,0);
  assert.equal((await register({password:'meos-community-fixture',...agreement})).status,200);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM account_consents').get().n,1);
  for(const password of ['abcdefgh','山海之间慢慢走走','with spaces is fine'])assert.equal(registrationPasswordError(password,'Meos'),'');
  assert.ok(registrationPasswordError('a'.repeat(129),'Meos'));
 } finally {await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
