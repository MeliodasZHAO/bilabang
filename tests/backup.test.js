import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createBackup,verifyBackup,restoreBackup} from '../scripts/backup.js';
test('consistent WAL backup restores referenced images and refuses overwrites or tampering',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bilabang-backup-'));const data=path.join(root,'data'),backup=path.join(root,'backup'),restored=path.join(root,'restored');fs.mkdirSync(path.join(data,'images'),{recursive:true});
 const db=new DatabaseSync(path.join(data,'bilabang.sqlite'));
 try{db.exec("PRAGMA journal_mode=WAL;CREATE TABLE photos(id TEXT PRIMARY KEY);INSERT INTO photos VALUES('image123')");fs.writeFileSync(path.join(data,'images/image123.webp'),'image-fixture');
 assert.equal(createBackup(data,backup).images,1);assert.equal(restoreBackup(backup,restored).restored,true);
 const check=new DatabaseSync(path.join(restored,'bilabang.sqlite'),{readOnly:true});try{assert.equal(check.prepare('SELECT id FROM photos').get().id,'image123');}finally{check.close();}
 assert.equal(fs.readFileSync(path.join(restored,'images/image123.webp'),'utf8'),'image-fixture');
 assert.throws(()=>restoreBackup(backup,data),/禁止覆盖/);assert.throws(()=>createBackup(data,backup),/拒绝覆盖/);
 fs.writeFileSync(path.join(backup,'images/image123.webp'),'tampered');assert.throws(()=>verifyBackup(backup),/校验失败/);
 const untouched=path.join(root,'must-not-create');assert.throws(()=>restoreBackup(backup,untouched));assert.equal(fs.existsSync(untouched),false);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
