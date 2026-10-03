import fs from 'node:fs';
const pool=JSON.parse(fs.readFileSync('output/city-top30/research-audit.json','utf8'));
const ranked=JSON.parse(fs.readFileSync('output/city-top30/ranking.json','utf8')).records;
const ranks=new Map(ranked.map(r=>[r.id,r.rank]));
const records=pool.records.filter(r=>r.rankingEligible).map(r=>({
 id:r.id,name:r.name,city:r.city,displayCity:r.displayCity||r.city,province:r.province,
 address:r.address,feature:r.feature,category:r.category,rank:ranks.get(r.id)||null,
 editorial:r.editorial,sourceUrl:r.sourceUrl,publisher:r.publisher||'原始项目资料',publishedAt:r.publishedAt,
 mediaSourceUrl:r.media?.sourceUrl||r.sourceUrl,mediaType:r.media?.type||'image',
 access:r.access||r.editorial.rationale.access,sourceAgeDays:r.sourceAgeDays,
 experienceScore:null,label:'公开资料整理',
}));
if(records.length!==84||records.filter(r=>r.rank).length!==30)throw Error('Unexpected collection scope');
for(const r of records)for(const key of ['sourceUrl','mediaSourceUrl'])if(new URL(r[key]).protocol!=='https:')throw Error('HTTPS source required');
fs.writeFileSync('src/data/editorial-places.json',JSON.stringify({asOf:'2026-09-18',records}));
console.log(`Exported ${records.length} public factual records, without unlicensed media or research-only records.`);
