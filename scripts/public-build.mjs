import fs from 'node:fs/promises';
import facts from '../src/data/source-places.js';
import {sourceImages} from '../src/data/source-images.js';
import {normalizePlace} from '../src/place-schema.js';
import {regionPath} from '../src/regions.js';
import {dimensions,score} from '../src/scoring.js';
import {renderPublicPage} from '../server-public.js';
// Publish curated source files only. Never open or copy the local SQLite database.
const places=facts.map(f=>{const id='source:'+f.importKey;return {id,...normalizePlace(f),regionPath:regionPath(f.regionId),...sourceImages[id],photos:[],scores:Object.fromEntries(['overall',...dimensions].map(k=>[k,score([],k)]))};});
await fs.mkdir('out/catalog',{recursive:true});
await fs.writeFile('out/catalog/places.json',JSON.stringify(places));
const template=await fs.readFile('out/index.html','utf8');
await fs.writeFile('out/index.html',renderPublicPage(template,{places,indexable:false}));
await fs.writeFile('out/robots.txt','User-agent: *\nDisallow: /\n');
console.log(`Public preview: ${places.length} curated places; no database, accounts or uploads included.`);
