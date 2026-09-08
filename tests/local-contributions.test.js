import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReceipts,saveReceipt,forgetReceipts} from '../src/local-contributions.js';
test('local receipts deduplicate, limit history and tolerate invalid storage',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 for(let i=0;i<40;i++)saveReceipt({receipt:i.toString(16).padStart(36,'0')},'地点'+i,storage);
 assert.equal(readReceipts(storage).length,30);
 saveReceipt({receipt:(39).toString(16).padStart(36,'0')},'更新名称',storage);assert.equal(readReceipts(storage).length,30);assert.equal(readReceipts(storage)[0].name,'更新名称');
 forgetReceipts(storage);assert.deepEqual(readReceipts(storage),[]);
 storage.setItem('bilabang-receipts-v1','not json');assert.deepEqual(readReceipts(storage),[]);
 assert.deepEqual(readReceipts({getItem(){throw Error('blocked');}}),[]);
});
