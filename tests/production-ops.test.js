import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {validateConfig,portOccupied} from '../ops/preflight.mjs';
import {smoke} from '../ops/smoke.mjs';

test('preflight rejects demo credentials, temporary hosts and public listener configuration',()=>{
 const valid={NODE_ENV:'production',HOST:'127.0.0.1',PORT:'5188',SITE_URL:'https://app.bilabang.com',API_ORIGIN:'https://api.bilabang.com',DATA_DIR:path.join(os.tmpdir(),'bilabang-ops-test'),RATE_SALT:'a'.repeat(64)};
 assert.deepEqual(validateConfig(valid),[]);
 for(const override of [{API_ORIGIN:'https://api.example.test'},{API_ORIGIN:'https://api.bilabang.cloud'},{SITE_URL:'https://demo.chatgpt.site'},{RATE_SALT:'REPLACE_WITH_RANDOM_SECRET'},{HOST:'0.0.0.0'},{PORT:'5188abc'},{NODE_ENV:'development'}])assert.ok(validateConfig({...valid,...override}).length);
 assert.deepEqual(validateConfig({...valid,SITE_URL:'https://bilabang.com'}),[]);
});

test('port probe detects an existing listener without terminating it',async()=>{
 const server=net.createServer(socket=>socket.end());
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 try {assert.equal(await portOccupied('127.0.0.1',port),true);assert.equal(server.listening,true);}
 finally {await new Promise(resolve=>server.close(resolve));}
 assert.equal(await portOccupied('127.0.0.1',port),false);
});

test('public smoke rejects a static shell masquerading as API and missing asset fallback',async()=>{
 const results=await smoke('https://app.bilabang.com','https://api.bilabang.com',{fetchImpl:async()=>new Response('<html><div id="root"></div><script src="/assets/app.js"></script></html>',{headers:{'Content-Type':'text/html'}})});
 assert.equal(results.find(r=>r.name==='homepage').ok,true);
 assert.equal(results.find(r=>r.name==='asset /assets/app.js').ok,false);
 assert.equal(results.find(r=>r.name==='independent API config').ok,false);
 assert.equal(results.find(r=>r.name==='public places').ok,false);
});
