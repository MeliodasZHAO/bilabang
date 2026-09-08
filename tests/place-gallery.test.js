import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeGallery} from '../src/place-gallery.js';

test('source cover plus one upload both remain selectable with separate attribution',()=>{
 const photos=placeGallery({name:'地点',image:'/source.jpg',imageCredit:{author:'Source',caption:'建筑外观',license:'CC BY-SA'},photos:[{id:'entrance',caption:'入口在后面',author:'Visitor',sourceUrl:'https://example.com/photo'}]});
 assert.equal(photos.length,2);assert.equal(photos[0].author,'Source');assert.equal(photos[1].author,'Visitor');assert.equal(photos[1].caption,'入口在后面');assert.equal(photos[1].license,undefined);assert.equal(photos[1].src,'/api/photos/entrance');
});
test('all six uploaded photos retain cover order, and missing photos stay empty',()=>{
 assert.deepEqual(placeGallery({}),[]);
 const photos=Array.from({length:6},(_,i)=>({id:String(i),caption:`视角 ${i}`}));
 assert.deepEqual(placeGallery({photos}).map(p=>p.id),photos.map(p=>p.id));
});
