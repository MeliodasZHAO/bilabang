// Read-only public deployment checks; no accounts, uploads or database mutations.
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function smoke(site,api,{fetchImpl=fetch}={}) {
  const results=[];
  async function check(name,url,inspect,options={}) {
    try {
      const r=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(15000),...options});
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      await inspect(r);results.push({name,ok:true});
    } catch(e) {results.push({name,ok:false,error:e.message});}
  }
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  let html='';
  await check('homepage',site+'/',async r=>{
    assert(r.headers.get('content-type')?.includes('text/html'),'Expected HTML');
    html=await r.text();assert(html.includes('id="root"'),'Missing React root');
  });
  await check('SPA fallback',site+'/deployment-route-check',async r=>{
    assert(r.headers.get('content-type')?.includes('text/html'),'Expected HTML fallback');
    assert((await r.text()).includes('id="root"'),'Missing SPA fallback');
  });
  const assets=new Set([...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map(m=>new URL(m[1],site).href));
  if(!assets.size)results.push({name:'bundled assets',ok:false,error:'No JS/CSS assets discovered'});
  for(const url of assets)await check('asset '+new URL(url).pathname,url,async r=>{
    assert(!r.headers.get('content-type')?.includes('text/html'),'Asset incorrectly served as HTML');
    const source=await r.text();
    assert(!/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(source),'Development origin in bundle');
    assert(!/signin-with-chatgpt|oai-authenticated-user|\.chatgpt\.site/.test(source),'Sites dependency in bundle');
  });
  await check('independent API config',api+'/api/config',async r=>{
    assert(r.headers.get('access-control-allow-origin')===site,'Wrong CORS origin');
    assert(r.headers.get('access-control-allow-credentials')==='true','Missing credential CORS');
    const config=await r.json();assert(config.demo===false&&config.writeEnabled===true&&config.community===true&&config.auth&&config.auth!=='chatgpt','Backend not ready for independent community');
  },{headers:{Origin:site}});
  await check('API preflight',api+'/api/login',async r=>{
    assert(r.headers.get('access-control-allow-origin')===site,'Wrong preflight origin');
    assert(r.headers.get('access-control-allow-credentials')==='true','Missing preflight credentials');
    assert(r.headers.get('access-control-allow-methods')?.includes('POST'),'POST not allowed');
    assert(r.headers.get('access-control-allow-headers')?.toLowerCase().includes('content-type'),'Content-Type not allowed');
  },{method:'OPTIONS',headers:{Origin:site,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  await check('public places',api+'/api/places',async r=>assert(Array.isArray(await r.json()),'Expected place list'));
  await check('anonymous identity',api+'/api/me',async r=>assert(await r.json()===null,'Anonymous request received an identity'));
  return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [site,api]=process.argv.slice(2);
  for(const value of [site,api]) {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.origin!==value||u.username||u.password)throw Error('Pass two HTTPS origins without trailing slashes');
  }
  const results=await smoke(site,api);console.log(JSON.stringify({results,limitations:'Read-only checks: real registration, upload, moderation, mobile devices and mainland carriers require separate verification.'},null,2));
  if(results.some(r=>!r.ok))process.exitCode=1;
}
