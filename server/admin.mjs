// Local server maintenance only. No HTTP route can select an administrator role.
import {openDatabase} from './storage.mjs';
import {createAccount,username} from './auth.mjs';
import {randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
const [command,name]=process.argv.slice(2);
if(!process.env.DATA_DIR||!['create','reset-password'].includes(command)||!name)throw Error('Usage: DATA_DIR=/var/lib/bilabang node server/admin.mjs create|reset-password <username>; supply password on stdin');
let password='';
for await(const chunk of process.stdin){password+=chunk;if(password.length>256)throw Error('Password input too long');}
password=password.replace(/\r?\n$/,'');
if(password.length<4||password.length>128)throw Error('Password must contain 4–128 characters');
const db=openDatabase(process.env.DATA_DIR);
try {
 if(command==='create'){
  if(db.prepare("SELECT 1 FROM auth_credentials WHERE role='admin'").get())throw Error('An administrator already exists; refusing another automatic bootstrap');
  await createAccount(db,{name,password},'admin');console.log('Administrator initialized. No credentials printed.');
 } else {
  const row=db.prepare('SELECT user_id FROM auth_credentials WHERE username=?').get(username(name).key);
  if(!row)throw Error('Account not found; old Sites accounts cannot be claimed by matching names');
  const salt=randomBytes(32).toString('hex'),hash=await promisify(scrypt)(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  db.exec('BEGIN IMMEDIATE');
  try{db.prepare('UPDATE auth_credentials SET password_hash=?,salt=? WHERE user_id=?').run(hash.toString('hex'),salt,row.user_id);db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(row.user_id);db.exec('COMMIT');}
  catch(e){db.exec('ROLLBACK');throw e;}
  console.log('Password reset and previous sessions revoked.');
 }
}finally{password='';db.close();}
