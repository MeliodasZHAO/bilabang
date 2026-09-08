import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withinRegion,regionPath,searchRegions} from '../src/regions.js';
import {normalizePlace,validatePlace} from '../src/place-schema.js';
import sources from '../src/data/source-places.js';
test('district precision, municipality path and unknown district isolation',()=>{
 assert.deepEqual(regionPath('CN-310109').map(r=>r.name),['中国','上海市','虹口区']);
 assert.equal(withinRegion({regionId:'CN-310109'},'CN-31'),true);
 assert.equal(withinRegion({regionId:'CN-31'},'CN-310109'),false);
 assert.equal(withinRegion({regionId:'CN-310107'},'CN-310109'),false);
 assert.equal(regionPath('CN-440305').at(-1).name,'南山区');
});
test('region abbreviations preserve names such as 市中区 and rank exact names first',()=>{
 assert.ok(searchRegions('上海虹口').some(r=>r.id==='CN-310109'));
 assert.ok(searchRegions('深圳南山').some(r=>r.id==='CN-440305'));
 assert.equal(searchRegions('市中区')[0].name,'市中区');
 assert.equal(searchRegions('不存在的地区').length,0);
});
test('malformed input never crashes validation and coordinates cannot coerce booleans or whitespace',()=>{
 for(const input of [null,[],false,42,'place'])assert.ok(Object.keys(validatePlace(input)).length);
 for(const value of [{},[],true,42])for(const key of ['publisher','landmark','directions','description'])assert.doesNotThrow(()=>validatePlace({...sources[0],[key]:value}));
 for(const lat of [true,false,[],{},'  '])assert.ok(validatePlace({...sources[0],locationMode:'precise',lat,lng:'120'}).lat);
 for(const p of [null,42,{kind:'toString',rights:'own',caption:'test'},{kind:'view',rights:'own',caption:{}}])assert.ok(validatePlace(sources[0],[p]).photos);
 assert.ok(validatePlace({...sources[0],sourceUrl:'https://user:password@example.com'}).sourceUrl);
});
test('all imports validate, never invent coordinates or visits; source and visited conditional requirements',()=>{
 for(const s of sources){const p=normalizePlace(s);assert.equal(p.date,null);if(p.locationMode==='text')assert.equal(p.lat,null);}
 const s=sources[0];assert.ok(validatePlace({...s,sourceUrl:'javascript:alert(1)'}).sourceUrl);
 assert.ok(validatePlace({...s,template:'visited'}).photos);
 assert.ok(validatePlace({...s,locationMode:'reference',lat:'',lng:''}).lat);
 assert.ok(validatePlace({...s,checkedAt:'2026-02-30'}).checkedAt);
});
