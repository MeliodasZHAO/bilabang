import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import sources from '../src/data/source-places.js';
import {normalizePlace} from '../src/place-schema.js';
const dir=path.resolve(process.env.DATA_DIR||'data');
const db=new DatabaseSync(path.join(dir,'bilabang.sqlite'));
const backupDir=path.join(dir,'backups');fs.mkdirSync(backupDir,{recursive:true});
const backup=path.join(backupDir,`before-sources-${Date.now()}.sqlite`);
db.exec(`VACUUM INTO '${backup.replaceAll("'","''")}'`);
db.exec('BEGIN IMMEDIATE');let added=0;
try{
 for(const source of sources){
  const key='source:'+source.importKey;
  if(db.prepare('SELECT id FROM places WHERE id=?').get(key))continue;
  const payload=normalizePlace(source,[]);
  db.prepare('INSERT INTO places(id,payload,status,receipt) VALUES(?,?,?,?)').run(key,JSON.stringify({...payload,importKey:source.importKey,demo:false}),'approved',randomBytes(18).toString('hex'));
  db.prepare('INSERT INTO audit(actor,action,target) VALUES(?,?,?)').run('source-import','source-reviewed',key);added++;
 }
 db.exec('COMMIT');console.log(JSON.stringify({added,backup}));
}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
