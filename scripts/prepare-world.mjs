import fs from 'node:fs';
// Source is pinned in docs/world-regions.md. Adapted directory remains ODbL.
const revision='b3b49250ff3906f6119e16c088c0053a2c972926';
fs.mkdirSync('output/world-source',{recursive:true});
for(const [file,remote]of [['world.json','json/countries%2Bstates%2Bcities.json'],['LICENSE','LICENSE']])if(!fs.existsSync('output/world-source/'+file)){
 const response=await fetch(`https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/${revision}/${remote}`);
 if(!response.ok)throw Error(`Directory download failed: ${response.status}`);
 fs.writeFileSync('output/world-source/'+file,Buffer.from(await response.arrayBuffer()));
}
const world=JSON.parse(fs.readFileSync('output/world-source/world.json','utf8'));
const countries=[],nodes=[];
const aliases=JSON.parse(fs.readFileSync('src/data/world-city-aliases.json','utf8'));
const china=JSON.parse(fs.readFileSync('src/data/china-regions.json','utf8'));
const point=o=>o.latitude!=null&&o.longitude!=null&&o.latitude!==''&&o.longitude!==''&&Number.isFinite(Number(o.latitude))&&Number.isFinite(Number(o.longitude))?{lat:Number(o.latitude),lng:Number(o.longitude)}:{};
const chineseRoots={TW:'CN-71',HK:'CN-81',MO:'CN-82'};
for(const c of world){
 const root=chineseRoots[c.iso2]||c.iso2;
 if(!chineseRoots[c.iso2])countries.push({id:root,name:c.translations?.['zh-CN']||c.name,alias:c.name,parentId:null,level:'country',...point(c)});
 if(c.iso2==='CN'){for(const s of c.states){const p=china.find(p=>p.name===s.native);if(p)nodes.push({id:'CN-'+p.code,name:p.name,parentId:'CN',level:'province',...point(s)});}continue;}
 for(const s of c.states){
  const sid=c.iso2==='JP'&&s.iso2==='13'?'JP-13':c.iso2==='NO'&&['18','46'].includes(s.iso2)?'NO-'+s.iso2:`${root}-S${s.id}`;
  nodes.push({id:sid,name:s.native||s.name,alias:s.name,parentId:root,level:chineseRoots[c.iso2]?'city':'province',...point(s)});
  for(const t of s.cities){
   const known={'JP:Shibuya':'JP-13113','JP:Shibuya-ku':'JP-13113','NO:Gildeskål':'NO-1838','NO:Aurland':'NO-4641'}[c.iso2+':'+t.name];
   nodes.push({id:known||`${root}-C${t.id}`,name:t.name,...(aliases[c.iso2+':'+t.name]?{alias:aliases[c.iso2+':'+t.name]}:{}),parentId:sid,level:chineseRoots[c.iso2]?'district':'city',...(t.name===c.capital?{capital:true}:{}),...point(t)});
  }
 }
}
fs.mkdirSync('public/region-data',{recursive:true});
fs.writeFileSync('src/data/world-countries.json',JSON.stringify(countries));
fs.writeFileSync('public/region-data/countries.json',JSON.stringify(countries));
fs.writeFileSync('public/region-data/world.json',JSON.stringify(nodes));
fs.copyFileSync('output/world-source/LICENSE','public/region-data/LICENSE.txt');
console.log(`${countries.length} country/territory roots, ${nodes.length} subdivisions`);
