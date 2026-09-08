// Isolated browser QA: never connects to the production database or bucket.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bilabang-browser-'));
const root=path.resolve('dist/client');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:5187,modules:true,scriptPath:path.resolve('dist/server/index.js'),compatibilityDate:'2026-09-01',resourcePersistencePath:dir,d1Databases:{DB:'browser-test'},r2Buckets:['FILES'],bindings:{ADMIN_EMAIL:'meos@example.test',RATE_SALT:'local-only'},serviceBindings:{ASSETS:async req=>{
 const pathname=decodeURIComponent(new URL(req.url).pathname),file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)&&file!==root)return new Response('',{status:403});
 try{const target=pathname==='/'?path.join(root,'index.html'):file;return new Response(await fs.readFile(target),{headers:{'Content-Type':types[path.extname(target)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}}}));
const db=await mf.getD1Database('DB');
for(const sql of (await fs.readFile('drizzle/0000_salty_sphinx.sql','utf8')).split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run();
await mf.dispatchFetch('http://127.0.0.1:5187/api/admin/import-sources',{method:'POST',headers:{Origin:'http://127.0.0.1:5187','oai-authenticated-user-id':'Meos','oai-authenticated-user-email':'meos@example.test'}});
console.log('Isolated hosted QA ready:',String(await mf.ready));
process.on('SIGINT',async()=>{await mf.dispose();await fs.rm(dir,{recursive:true,force:true});process.exit(0);});
