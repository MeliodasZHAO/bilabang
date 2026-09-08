import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPublicReader,waitForPublicData} from '../src/public-loader.js';

test('public downloads time out through body streaming and explain invalid or offline responses',async()=>{
 const read=createPublicReader({timeoutMs:10,fetchImpl:async(_,options)=>({ok:true,json:()=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))))})});
 await assert.rejects(read('/region-data/world.json'),e=>e.code==='timeout');
 await assert.rejects(createPublicReader({fetchImpl:async()=>new Response('<html>Unavailable</html>')})('/catalog/places.json'),e=>e.code==='network');
 await assert.rejects(createPublicReader({fetchImpl:async()=>new Response('{}')})('/catalog/places.json'),e=>e.code==='invalid_data');
 await assert.rejects(createPublicReader({fetchImpl:async()=>{throw new TypeError('Failed to fetch');}})('/catalog/places.json'),e=>e.code==='network');
});

test('cancelled picker settles immediately while another picker receives the shared download',async()=>{
 let finish;const shared=new Promise(resolve=>{finish=resolve;});
 const controller=new AbortController();
 const first=waitForPublicData(shared,controller.signal),second=waitForPublicData(shared);
 controller.abort();
 await assert.rejects(first,e=>e.code==='cancelled');
 finish([{name:'Paris'}]);
 assert.deepEqual(await second,[{name:'Paris'}]);
});
