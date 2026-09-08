import {test} from 'node:test';
import assert from 'node:assert/strict';
import {similarPlaces,distanceMeters} from '../src/duplicates.js';
const p={id:'one',regionId:'CN-310109',name:'一滴水公厕',address:'上海市东大名路588号',locationMode:'text'};
test('duplicate hints preserve distinct districts and never use reference point proximity',()=>{
 assert.equal(similarPlaces({...p,id:undefined},[p]).length,1);
 assert.equal(similarPlaces({...p,id:undefined,regionId:'CN-310107'},[p]).length,0);
 assert.equal(similarPlaces({...p,id:undefined,regionId:'CN-31'},[p]).length,1);
 const precise={locationMode:'precise',lat:30,lng:120};
 assert.equal(distanceMeters(precise,{...precise,locationMode:'reference'}),null);
 assert.equal(distanceMeters(precise,{...precise,lat:''}),null);
 assert.equal(distanceMeters(precise,precise),0);
 assert.equal(similarPlaces(precise,[{...precise,id:'two'}]).length,1);
 assert.equal(similarPlaces(precise,[{...precise,id:'two',lat:31}]).length,0);
});
