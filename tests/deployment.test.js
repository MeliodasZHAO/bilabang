import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../src/api.js';
import {apiUrl} from '../src/deployment.js';

test('independent API origin retains cookies and multipart uploads above function limits',async()=>{
 const original=new Uint8Array(2*1024*1024).fill(37);
 const form=new FormData();form.set('payload',JSON.stringify({text:'入口说明'}));form.append('photos',new Blob([original],{type:'image/jpeg'}),'temporary-upload');
 const api=createApi({baseOrigin:'https://api.example.test',fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.example.test/api/submissions');assert.equal(options.credentials,'include');
  assert.equal(options.headers['Content-Type'],undefined);
  const request=new Request(url,options);const received=await request.formData();
  assert.equal(received.get('photos').size,original.length);
  assert.equal(JSON.parse(received.get('payload')).text,'入口说明');
  return Response.json({id:'test-only'});
 }});
 assert.equal((await api('/submissions',{method:'POST',body:form})).id,'test-only');
 assert.equal(apiUrl('/api/photos/test','https://api.example.test'),'https://api.example.test/api/photos/test');
});
