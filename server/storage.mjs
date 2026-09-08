import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const schemaVersion=2;
export const communityTables=['users','places','reviews','photos','reports','moderation_events','place_revisions','rate_limits'];
export const authSchema=`
CREATE TABLE IF NOT EXISTS auth_credentials (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 salt TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('member','admin')),
 created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_credentials(user_id),
 expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_session_expiry ON auth_sessions(expires);
`;

export function openDatabase(directory) {
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const db=new DatabaseSync(path.join(directory,'bilabang.sqlite'));
 try {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const columns=db.prepare('PRAGMA table_info(users)').all();
  if(columns.some(c=>c.name==='password')||columns.length&&!columns.some(c=>c.name==='created'))throw Error('Refusing the legacy demo database; import a Sites snapshot into a new directory.');
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>schemaVersion)throw Error('Database was upgraded by a newer release; automatic rollback is unsafe.');
  db.exec('BEGIN IMMEDIATE');
  try {
   if(!columns.length)db.exec(fs.readFileSync(path.join(root,'drizzle/0000_salty_sphinx.sql'),'utf8'));
   db.exec(authSchema);
   if(version<2)db.exec(fs.readFileSync(path.join(root,'server/migrations/0002_account_rules.sql'),'utf8'));
   db.exec('PRAGMA user_version=2; COMMIT;');
  } catch(e){db.exec('ROLLBACK');throw e;}
  return db;
 } catch(e){db.close();throw e;}
}

export function databaseBinding(db) {
 function prepared(sql,values=[]) {
  const stmt=db.prepare(sql);
  return {
   bind:(...args)=>prepared(sql,args),
   first:async()=>stmt.get(...values)||null,
   all:async()=>({results:stmt.all(...values)}),
   run:async()=>execute(),
   execute,
  };
  function execute(){const result=stmt.run(...values);return {success:true,meta:{changes:Number(result.changes)}};}
 }
 return {prepare:sql=>prepared(sql),batch:async statements=>{
  db.exec('BEGIN IMMEDIATE');
  try{const results=statements.map(s=>s.execute());db.exec('COMMIT');return results;}
  catch(e){db.exec('ROLLBACK');throw e;}
 }};
}

export function photoPath(directory,key) {
 if(!/^photos\/[a-zA-Z0-9-]+\.jpg$/.test(key))throw Error('Invalid photo storage key');
 const photos=path.join(directory,'photos');
 if(fs.existsSync(photos)&&fs.lstatSync(photos).isSymbolicLink())throw Error('Photo directory must not be a symlink');
 const file=path.join(directory,key);
 if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Photo must not be a symlink');
 return file;
}

export function fileBinding(directory) {
 return {
  async put(key,bytes){
   try{await sharp(bytes,{limitInputPixels:16000000,failOn:'warning'}).stats();}
   catch{throw Object.assign(Error('照片无法完整读取，请重新选择'),{status:400});}
   const target=photoPath(directory,key);await fsp.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fsp.writeFile(target,bytes,{flag:'wx',mode:0o600});
  },
  async get(key){try{return {body:await fsp.readFile(photoPath(directory,key))};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async delete(key){await fsp.rm(photoPath(directory,key),{force:true});},
 };
}

export function assetBinding() {
 let world;
 return {async fetch(req){
  const name=new URL(req.url).pathname;
  // Community validation needs country shards; never proxy arbitrary URLs or files.
  if(!/^\/region-paths\/[A-Z]{2}\.json$/.test(name))return new Response('Not found',{status:404});
  try{
   world??=JSON.parse(await fsp.readFile(path.join(root,'public/region-data/world.json'),'utf8'));
   const country=name.split('/').at(-1).slice(0,2);
   return Response.json(world.filter(r=>r.id===country||r.id.startsWith(country+'-')));
  }
  catch{return new Response('Not found',{status:404});}
 }};
}
