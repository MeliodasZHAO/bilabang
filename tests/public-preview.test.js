import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {publicApi} from '../src/public-api.js';
test('public preview is read-only and retains global, city and district discovery',async()=>{
 const original=globalThis.fetch;let downloads=0;
 globalThis.fetch=async path=>{assert.equal(path,'/region-data/world.json');downloads++;return new Response(await fs.readFile(new URL('../public'+path,import.meta.url)));};
 try{
  assert.deepEqual(await publicApi('/config'),{demo:false,writeEnabled:false,publicPreview:true});
  assert.equal(await publicApi('/me'),null);
  assert.ok((await publicApi('/regions')).total>200);
  assert.ok((await publicApi('/regions?parent=CN-31')).items.some(r=>r.id==='CN-310109'));
  assert.equal(downloads,0);
  assert.ok((await publicApi('/regions?q=Paris')).items.some(r=>r.name==='Paris'));
  assert.ok((await publicApi('/regions?q=上海虹口')).items.some(r=>r.id==='CN-310109'));
  assert.equal(downloads,1);
  for(const path of ['/login','/register','/submissions','/places/a/reviews'])await assert.rejects(publicApi(path,{method:'POST',body:{name:'Meos',password:'meos'}}),e=>e.status===503);
  await assert.rejects(publicApi('/admin'),e=>e.status===404);
  const controller=new AbortController();controller.abort();
  await assert.rejects(publicApi('/regions?q=Sydney',{signal:controller.signal}),e=>e.code==='cancelled');
 }finally{globalThis.fetch=original;}
});
