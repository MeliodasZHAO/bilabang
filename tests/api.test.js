import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../src/api.js';
test('HTTP rate limits, validation errors and bad gateway bodies remain actionable',async()=>{
 await assert.rejects(createApi({fetchImpl:async()=>new Response('Too many requests',{status:429,headers:{'Retry-After':'60'}})})('/places'),e=>e.status===429&&e.message.includes('60 秒'));
 await assert.rejects(createApi({fetchImpl:async()=>new Response(JSON.stringify({error:'请填写名称',fields:{name:'必填'}}),{status:400})})('/submissions'),e=>e.fields.name==='必填');
 await assert.rejects(createApi({fetchImpl:async()=>new Response('<html>bad gateway</html>',{status:502})})('/places'),e=>e.status===502);
});
test('requests time out and multipart bodies keep browser-owned boundaries',async()=>{
 const slow=createApi({timeoutMs:10,fetchImpl:(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
 await assert.rejects(slow('/submissions'),e=>e.code==='timeout'&&e.message.includes('尚未确认'));
 const body=new FormData();body.set('test','value');let sent;
 const api=createApi({fetchImpl:async(url,options)=>{sent=options;return new Response('{"ok":true}');}});
 assert.deepEqual(await api('/submissions',{method:'POST',body}),{ok:true});assert.equal(sent.body,body);assert.equal(sent.headers['Content-Type'],undefined);
});
