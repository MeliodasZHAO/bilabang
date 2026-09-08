import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {openDatabase,communityTables,photoPath} from './storage.mjs';

const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function freshStage(target){
 const destination=path.resolve(target);
 if(fs.existsSync(destination))throw Error('Destination already exists; refusing to overwrite data');
 fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
 return {destination,stage:fs.mkdtempSync(path.join(path.dirname(destination),'.bilabang-transfer-'))};
}
function inspect(db){
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database integrity check failed');
 return db.prepare('SELECT storage_key,size FROM photos ORDER BY id').all();
}
function copyPhotos(rows,source,target){
 for(const row of rows){
  if(!source)throw Error('Snapshot contains photos; supply the exported photo directory before importing');
  const from=photoPath(source,row.storage_key),to=photoPath(target,row.storage_key);
  const stat=fs.statSync(from);if(!stat.isFile()||stat.size!==row.size)throw Error('Photo missing or size mismatch: '+row.storage_key);
  fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);fs.chmodSync(to,0o600);
 }
}
export function importSnapshot(snapshotPath,target,photosDirectory){
 const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
 if(!snapshot.tables)throw Error('Invalid Sites snapshot');
 const {destination,stage}=freshStage(target),db=openDatabase(stage);
 try {
  db.exec('BEGIN IMMEDIATE');
  for(const name of communityTables){
   const source=snapshot.tables[name],columns=db.prepare(`PRAGMA table_info(${name})`).all().map(c=>c.name);
   if(!source||!Array.isArray(source.rows)||!Array.isArray(source.columns)||source.columns.length!==columns.length||columns.some(c=>!source.columns.includes(c)))throw Error('Snapshot schema mismatch: '+name);
   const insert=db.prepare(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
   for(const row of source.rows){if(columns.some(c=>!Object.hasOwn(row,c)))throw Error('Incomplete snapshot row: '+name);insert.run(...columns.map(c=>row[c]));}
  }
  const photos=inspect(db);copyPhotos(photos,photosDirectory,stage);
  db.exec('COMMIT');db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
 fs.writeFileSync(path.join(stage,'import-info.json'),JSON.stringify({sourceCapturedAt:snapshot.capturedAt,sourceAtomic:snapshot.atomic===true,importedAt:new Date().toISOString(),note:'Old Sites profiles have no independent login credentials; no automatic identity claim.'},null,2),{mode:0o600});
 fs.renameSync(stage,destination);
 return {directory:destination,imported:true,atomicSource:snapshot.atomic===true};
}
export function backup(source,target){
 const file=path.join(path.resolve(source),'bilabang.sqlite');
 if(!fs.existsSync(file))throw Error('Source database does not exist');
 const {destination,stage}=freshStage(target),db=new DatabaseSync(file,{readOnly:true});
 try{db.exec('VACUUM INTO '+quote(path.join(stage,'bilabang.sqlite')));}finally{db.close();}
 const saved=new DatabaseSync(path.join(stage,'bilabang.sqlite'),{readOnly:true});
 let photos;
 try{photos=inspect(saved);}finally{saved.close();}
 copyPhotos(photos,source,stage);
 const files=['bilabang.sqlite',...photos.map(p=>p.storage_key)].map(name=>({name,size:fs.statSync(path.join(stage,name)).size,sha256:hash(path.join(stage,name))}));
 for(const entry of files)fs.chmodSync(path.join(stage,entry.name),0o600);
 fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),files},null,2),{mode:0o600});
 verifyBackup(stage);fs.renameSync(stage,destination);return {directory:destination,files:files.length,verified:true};
}
export function verifyBackup(directory){
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 if(manifest.version!==1||!Array.isArray(manifest.files))throw Error('Invalid backup manifest');
 const seen=new Set();
 for(const row of manifest.files){
  if(typeof row.name!=='string'||seen.has(row.name))throw Error('Invalid or duplicate backup path');
  seen.add(row.name);const file=row.name==='bilabang.sqlite'?path.join(directory,row.name):photoPath(directory,row.name);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==row.size||hash(file)!==row.sha256)throw Error('Backup checksum mismatch: '+row.name);
 }
 if(!seen.has('bilabang.sqlite'))throw Error('Backup is missing database');
 const db=new DatabaseSync(path.join(directory,'bilabang.sqlite'),{readOnly:true});
 try{const rows=inspect(db);if(seen.size!==rows.length+1||rows.some(r=>!seen.has(r.storage_key)||fs.statSync(photoPath(directory,r.storage_key)).size!==r.size))throw Error('Backup photo manifest does not match database');}finally{db.close();}
 return {verified:true,files:manifest.files.length};
}
export function restore(directory,target){
 verifyBackup(directory);const {destination,stage}=freshStage(target);
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 for(const row of manifest.files){const to=path.join(stage,row.name);fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});fs.copyFileSync(path.join(directory,row.name),to,fs.constants.COPYFILE_EXCL);fs.chmodSync(to,0o600);}
 fs.renameSync(stage,destination);return {directory:destination,restored:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [command,source,target,photos]=process.argv.slice(2);let result;
 if(command==='import'&&source&&target)result=importSnapshot(source,target,photos);
 else if(command==='backup'&&source&&target)result=backup(source,target);
 else if(command==='restore'&&source&&target)result=restore(source,target);
 else if(command==='verify'&&source)result=verifyBackup(source);
 else throw Error('Usage: node server/transfer.mjs import snapshot.json NEW_DIR [EXPORTED_PHOTOS] | backup DATA_DIR NEW_BACKUP | verify BACKUP | restore BACKUP NEW_DIR');
 console.log(JSON.stringify(result));
}
