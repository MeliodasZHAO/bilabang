import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasPublicPhoto,publicPhoto} from '../src/public-place-media.js';
test('public listings exclude empty, placeholder and demo photos',()=>{
  for(const p of [{},{photos:[]},{image:'/no-photo.svg'},{image:'https://example.com/placeholder.jpg'},{photos:[{}]},{image:'/photo.webp',demo:true},{image:'/photo.webp',preview:true}])assert.equal(hasPublicPhoto(p),false);
});
test('uploaded photo survives a placeholder cover; genuine covers remain visible',()=>{
  assert.equal(hasPublicPhoto({image:'/photo.webp'}),true);
  assert.equal(publicPhoto({image:'/no-photo.svg',photos:[{}, {id:'photo-1'}]}),'/api/photos/photo-1');
  assert.equal(hasPublicPhoto({photos:[{id:'photo-1'}]}),true);
});
