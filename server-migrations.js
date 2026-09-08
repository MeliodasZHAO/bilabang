import path from 'node:path';
import {createBackup} from './scripts/backup.js';

// Called only for the locally authorized runtime. Production never auto-migrates.
export function migrateV3(db,data){
 const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
 if(exists&&db.prepare('SELECT version FROM schema_migrations WHERE version=3').get())return false;
 createBackup(data,path.join(data,'backups','before-v3-'+Date.now()));
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
   ALTER TABLE places ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
   ALTER TABLE verifications ADD COLUMN purpose TEXT NOT NULL DEFAULT 'legacy';
   ALTER TABLE verifications ADD COLUMN used_at TEXT;
   CREATE TABLE identities(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),provider TEXT NOT NULL,subject TEXT NOT NULL,environment TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(provider,subject,environment));
   CREATE TABLE place_revisions(id INTEGER PRIMARY KEY,place_id TEXT NOT NULL REFERENCES places(id),version INTEGER NOT NULL,before_payload TEXT NOT NULL,after_payload TEXT NOT NULL,actor TEXT NOT NULL,reason TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(place_id,version));
   CREATE TABLE moderation_events(id INTEGER PRIMARY KEY,target_type TEXT NOT NULL,target_id TEXT NOT NULL,old_status TEXT NOT NULL,new_status TEXT NOT NULL,public_reason TEXT NOT NULL,internal_note TEXT NOT NULL DEFAULT '',actor TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP);
   CREATE INDEX moderation_target ON moderation_events(target_type,target_id,id);
   UPDATE verifications SET code='legacy-invalidated',expires=0,verified=0;
   INSERT INTO schema_migrations(version) VALUES(3);`);
  db.exec('COMMIT');return true;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
