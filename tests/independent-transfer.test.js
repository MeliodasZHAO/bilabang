import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import sharp from 'sharp';
import {openDatabase,communityTables} from '../server/storage.mjs';
import {createAccount} from '../server/auth.mjs';
import {backup,restore,verifyBackup,importSnapshot} from '../server/transfer.mjs';

test('independent backup restores credentials and JPEG files; snapshot refuses missing images and existing destinations',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bilabang-transfer-test-')),source=path.join(temp,'source');
 let db=openDatabase(source);
 try {
  const user=await createAccount(db,{name:'Meos',password:'meos'},'admin');
  db.prepare("INSERT INTO places(id,payload,status,created) VALUES('place','{}','approved','now')").run();
  const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#244ad1'}}).jpeg().toBuffer();
  fs.mkdirSync(path.join(source,'photos'));fs.writeFileSync(path.join(source,'photos/test.jpg'),bytes);
  db.prepare("INSERT INTO photos VALUES('photo','place',NULL,'photos/test.jpg','{}',?,'now')").run(bytes.length);
  const snapshot={capturedAt:new Date().toISOString(),atomic:false,tables:Object.fromEntries(communityTables.map(name=>[name,{columns:db.prepare(`PRAGMA table_info(${name})`).all().map(c=>c.name),rows:db.prepare(`SELECT * FROM ${name}`).all()}]))};
  const file=path.join(temp,'snapshot.json');fs.writeFileSync(file,JSON.stringify(snapshot));
  assert.throws(()=>importSnapshot(file,path.join(temp,'missing-images')),/supply the exported photo/);
  assert.equal(importSnapshot(file,path.join(temp,'imported'),source).imported,true);
  const imported=openDatabase(path.join(temp,'imported'));
  assert.equal(imported.prepare('SELECT count(*) AS n FROM auth_credentials').get().n,0);
  assert.equal(imported.prepare('SELECT id FROM users').get().id,user.id);imported.close();
  const saved=path.join(temp,'backup');assert.equal(backup(source,saved).files,2);
  assert.throws(()=>backup(source,saved),/already exists/);
  assert.equal(restore(saved,path.join(temp,'restored')).restored,true);
  const restored=openDatabase(path.join(temp,'restored'));
  assert.equal(restored.prepare('SELECT username FROM auth_credentials').get().username,'meos');restored.close();
  fs.appendFileSync(path.join(saved,'photos/test.jpg'),'corruption');assert.throws(()=>verifyBackup(saved),/checksum mismatch/);
 } finally {db.close();fs.rmSync(temp,{recursive:true,force:true});}
});

test('local administrator CLI bootstraps once and resets password without exposing it',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bilabang-admin-test-'));
 const command=args=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['server/admin.mjs',...args],{cwd:process.cwd(),env:{...process.env,DATA_DIR:temp},stdio:['pipe','pipe','pipe'],windowsHide:true});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('exit',code=>resolve({code,output}));child.stdin.end('meos\n');
 });
 try {
  const first=await command(['create','Meos']);assert.equal(first.code,0,first.output);assert.ok(!first.output.includes('meos'));
  assert.notEqual((await command(['create','Meos'])).code,0);
  assert.equal((await command(['reset-password','Meos'])).code,0);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
