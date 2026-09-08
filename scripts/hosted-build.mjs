import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {regions,registerRegions,regionPath} from '../src/regions.js';
registerRegions(JSON.parse(await fs.readFile('public/region-data/world.json','utf8')));
await fs.mkdir('dist/client/region-paths',{recursive:true});
// Shard metadata by country so validating an overseas submission doesn't load the whole world in a Worker.
const shards=new Map();for(const r of regions){const country=regionPath(r.id)[0]?.id;if(!shards.has(country))shards.set(country,[]);shards.get(country).push(r);}
for(const [country,items]of shards)await fs.writeFile(`dist/client/region-paths/${country}.json`,JSON.stringify(items));
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
console.log('Hosted Worker and country directory shards built.');
