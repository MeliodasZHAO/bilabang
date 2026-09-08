import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const digest=s=>createHash('sha256').update(s).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const cookieName='__Host-bilabang';
export function username(value) {
 if(typeof value!=='string')fail(400,'请输入用户名');
 const name=value.normalize('NFKC').trim();
 if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(name))fail(400,'用户名需为 2–24 位文字、数字、下划线或短横线');
 return {name,key:name.toLowerCase()};
}
export async function createAccount(db,{name,password},role='member') {
 const parsed=username(name);
 if(typeof password!=='string'||password.length<4||password.length>128)fail(400,'密码需为 4–128 位，建议使用较长且独立的密码');
 if(!['member','admin'].includes(role))throw Error('Invalid role');
 const salt=randomBytes(32).toString('hex');
 const hash=(await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex');
 const id=randomUUID();
 db.exec('BEGIN IMMEDIATE');
 try {
  db.prepare('INSERT INTO users(id,name,created) VALUES(?,?,?)').run(id,parsed.name,now());
  db.prepare('INSERT INTO auth_credentials(user_id,username,password_hash,salt,role,created) VALUES(?,?,?,?,?,?)').run(id,parsed.key,hash,salt,role,now());
  db.exec('COMMIT');
 } catch(e){db.exec('ROLLBACK');if(db.prepare('SELECT 1 FROM auth_credentials WHERE username=?').get(parsed.key))fail(409,'用户名已使用，请换一个');throw e;}
 return {id,name:parsed.name,role};
}

export function authService(db,salt) {
 const tokenOf=req=>{
  const value=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  return /^[a-f0-9]{64}$/.test(value||'')?value:null;
 };
 const getIdentity=async req=>{
  const token=tokenOf(req);if(!token)return null;
  return db.prepare('SELECT u.id,u.name,c.role FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN auth_credentials c ON c.user_id=u.id WHERE token_hash=? AND expires>?').get(digest(token),Date.now())||null;
 };
 function limit(key,max,period=3600000){
  const time=Date.now(),id=digest(salt+':auth:'+key+':'+Math.floor(time/period));
  db.prepare('DELETE FROM rate_limits WHERE expires<?').run(time);
  const row=db.prepare('INSERT INTO rate_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').get(id,time+period*2);
  if(row.count>max)fail(429,'操作较频繁，请稍后再试');
 }
 function session(user){
  const token=randomBytes(32).toString('hex'),time=Date.now();
  db.prepare('DELETE FROM auth_sessions WHERE expires<?').run(time);
  db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires) VALUES(?,?,?)').run(digest(token),user.id,time+7*86400000);
  return new Response(JSON.stringify(user),{headers:{'Content-Type':'application/json','Set-Cookie':`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,'Cache-Control':'no-store'}});
 }
 return {getIdentity,async handle(req,ip){
  const pathname=new URL(req.url).pathname;
  if(!['/api/register','/api/login','/api/logout'].includes(pathname))return null;
  if(req.method!=='POST')fail(405,'请使用 POST 请求');
  if(pathname==='/api/logout') {
   const token=tokenOf(req);if(token)db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(token));
   return new Response('{"ok":true}',{headers:{'Content-Type':'application/json','Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,'Cache-Control':'no-store'}});
  }
  limit('ip:'+ip,30,600000);
  let input;try{input=await req.json();}catch{fail(400,'无法读取登录信息');}
  const parsed=username(input?.name);
  if(pathname==='/api/register'){limit('register:'+ip,8);return session(await createAccount(db,input));}
  limit('login:'+parsed.key,20,600000);
  if(typeof input.password!=='string'||input.password.length>128)fail(400,'请输入有效密码');
  const row=db.prepare('SELECT c.*,u.name FROM auth_credentials c JOIN users u ON u.id=c.user_id WHERE username=?').get(parsed.key);
  const actual=await derive(input.password,row?.salt||'missing-account-constant-salt',64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  if(!row||!timingSafeEqual(actual,Buffer.from(row.password_hash,'hex')))fail(401,'用户名或密码不正确');
  return session({id:row.user_id,name:row.name,role:row.role});
 }};
}
