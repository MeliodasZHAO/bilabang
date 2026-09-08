import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../worker/index.js';
import {openDatabase,databaseBinding,fileBinding,assetBinding,schemaVersion} from './storage.mjs';
import {authService} from './auth.mjs';
import {accountRules} from './account-rules.mjs';
import {validateConfig} from '../ops/preflight.mjs';

export function createApplication(config) {
 const errors=validateConfig(config);if(errors.length)throw Error(errors.join('\n'));
 const data=path.resolve(config.DATA_DIR),checkout=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 if(data===checkout||data.startsWith(checkout+path.sep)||data===path.parse(data).root)throw Error('DATA_DIR must be outside the code checkout and cannot be the filesystem root');
 const db=openDatabase(config.DATA_DIR),auth=authService(db,config.RATE_SALT);
 const rules=accountRules(db);
 const env={DB:databaseBinding(db),FILES:fileBinding(config.DATA_DIR),ASSETS:assetBinding(),RATE_SALT:config.RATE_SALT,SITE_ORIGIN:config.SITE_URL,AUTH_MODE:'password',getIdentity:auth.getIdentity,accountRules:rules};
 let activeWrites=0;
 const server=createServer(async(incoming,outgoing)=>{
  let counted=false;
  try {
   const url=new URL(incoming.url,config.API_ORIGIN),origin=incoming.headers.origin;
   outgoing.setHeader('X-Content-Type-Options','nosniff');outgoing.setHeader('Cache-Control','no-store');outgoing.setHeader('Vary','Origin');
   if(origin&&origin!==config.SITE_URL){outgoing.writeHead(403,{'Content-Type':'application/json'});outgoing.end('{"error":"请求来源不匹配"}');return;}
   if(origin===config.SITE_URL){outgoing.setHeader('Access-Control-Allow-Origin',origin);outgoing.setHeader('Access-Control-Allow-Credentials','true');outgoing.setHeader('Access-Control-Expose-Headers','Retry-After');}
   if(incoming.method==='OPTIONS'){
    if(origin!==config.SITE_URL)throw Object.assign(Error('请求来源不匹配'),{status:403});
    outgoing.writeHead(204,{'Access-Control-Allow-Methods':'GET, HEAD, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});outgoing.end();return;
   }
   if(!['GET','HEAD','POST'].includes(incoming.method))throw Object.assign(Error('请求方法不支持'),{status:405});
   if(incoming.method==='POST'&&origin!==config.SITE_URL)throw Object.assign(Error('请从本站页面提交'),{status:403});
   if(incoming.method==='POST'){
    if(activeWrites>=4)throw Object.assign(Error('服务繁忙，请稍后重试'),{status:429});
    activeWrites++;counted=true;
   }
   if(url.pathname==='/api/health'&&incoming.method==='GET'){
    db.prepare('SELECT 1').get();outgoing.writeHead(200,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({ok:true,runtime:'independent-node',schema:schemaVersion}));return;
   }
   const limit=/^\/api\/(?:register|login|logout|account\/|admin\/accounts)/.test(url.pathname)?16384:50*1024*1024;
   if(Number(incoming.headers['content-length']||0)>limit)throw Object.assign(Error('上传内容过大'),{status:413});
   const chunks=[];let length=0;
   for await(const chunk of incoming){length+=chunk.length;if(length>limit)throw Object.assign(Error('上传内容过大'),{status:413});chunks.push(chunk);}
   const headers=new Headers();
   for(const key of ['content-type','cookie','origin'])if(incoming.headers[key])headers.set(key,incoming.headers[key]);
   // Caddy must overwrite X-Forwarded-For. The Node listener is loopback-only.
   const ip=config.TRUST_PROXY==='1'?(String(incoming.headers['x-forwarded-for']||'').split(',').at(-1).trim()||incoming.socket.remoteAddress):incoming.socket.remoteAddress;
   headers.set('cf-connecting-ip',ip||'unknown');
   const req=new Request(url,{method:incoming.method,headers,...(incoming.method==='POST'?{body:Buffer.concat(chunks)}:{})});
   const response=await auth.handle(req,ip)||await worker.fetch(req,env);
   outgoing.statusCode=response.status;
   for(const [key,value] of response.headers)outgoing.setHeader(key,value);
   outgoing.end(incoming.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  } catch(e){
   if(!e.status)console.error('API failure:',e.name); // Never log request bodies, passwords, cookies, or SQL bindings.
   if(!outgoing.headersSent)outgoing.writeHead(e.status||500,{'Content-Type':'application/json'});
   outgoing.end(JSON.stringify({error:e.status?e.message:'服务暂时无法处理，请保留草稿后重试'}));
  } finally {if(counted)activeWrites--;}
 });
 server.requestTimeout=180000;server.headersTimeout=15000;server.maxRequestsPerSocket=100;
 return {server,db,async close(){await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));db.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const app=createApplication(process.env);
 app.server.once('error',e=>{console.error(`Server start failed: ${e.code}`);app.db.close();process.exitCode=1;});
 app.server.listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('Independent community API ready on loopback port '+process.env.PORT));
 let closing=false;
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await app.close();});
}
