import {regionMap,regionFields} from './regions.js';
export const photoKinds={view:'风景',exterior:'外观',entrance:'入口',route:'找路',interior:'设施',surroundings:'周边'};
export const today=()=>new Date().toISOString().slice(0,10);
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&s<=today();
export function safeUrl(s){try{if(typeof s!=='string'||s.length>2000)return false;const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
export function validatePlace(b,photos=[]){
 const e={};
 if(!b||typeof b!=='object'||Array.isArray(b))return {payload:'地点资料必须是一个对象'};
 if(!Array.isArray(photos))return {photos:'照片说明必须是列表'};
 const textKeys=['name','address','description','template','regionId','locationMode','landmark','directions','date','checkedAt','sourceUrl','publisher','customRegion','hours','fee','wheelchair','babycare','paper','water'];
 for(const k of textKeys)if(b[k]!=null&&typeof b[k]!=='string')e[k]='请使用文字填写资料';
 if(Object.keys(e).length)return e;
 for(const k of ['name','address','description'])if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>(k==='description'?2000:200))e[k]='请填写'+({name:'名称（最多200字）',address:'详细位置（最多200字）',description:'介绍（最多2000字）'}[k]);
 if(!['visited','source'].includes(b.template))e.template='请选择创建模板';
 if(!regionMap.has(b.regionId))e.regionId='请选择规范地区';
 if(!['precise','reference','text'].includes(b.locationMode))e.locationMode='请选择定位方式';
 if(b.locationMode!=='text')for(const [k,max]of [['lat',90],['lng',180]])if(!['string','number'].includes(typeof b[k])||String(b[k]).trim()===''||!Number.isFinite(Number(b[k]))||Math.abs(Number(b[k]))>max)e[k]='请填写有效'+(k==='lat'?'纬度':'经度');
 if(b.locationMode==='reference'&&!b.landmark?.trim())e.landmark='请填写参考地标名称';
 if(b.template==='visited'){
  if(!validDate(b.date))e.date='请填写有效到访日期，不能晚于今天';
  if(!photos.length)e.photos='实地分享至少上传一张授权实拍';
  if(b.locationMode!=='precise'&&!b.directions?.trim())e.directions='请说明从地标到厕所的找路步骤';
 }else{
  if(!safeUrl(b.sourceUrl))e.sourceUrl='请输入原文的 http 或 https 链接';
  if(!b.publisher?.trim()||b.publisher.length>200)e.publisher='请填写作者或发布者';
  if(!validDate(b.checkedAt))e.checkedAt='请填写有效资料核查日期';
 }
 if(photos.length>6)e.photos='最多上传6张照片';
 if(photos.some(p=>!p||typeof p!=='object'||!Object.hasOwn(photoKinds,p.kind)||!['own','authorized','licensed'].includes(p.rights)||typeof p.caption!=='string'||!p.caption.trim()||['caption','author','sourceUrl','license'].some(k=>p[k]!=null&&(typeof p[k]!=='string'||p[k].length>2000))||(p.rights!=='own'&&(typeof p.author!=='string'||!p.author.trim()||!safeUrl(p.sourceUrl)||typeof p.license!=='string'||!p.license.trim()))))e.photos='每张图需分类和说明；非自有图需作者、原图链接和授权说明';
 if(b.consent!==true&&b.consent!=='true')e.consent='请确认真实性与图片使用权';
 for(const k of ['landmark','directions','customRegion','hours','fee'])if((b[k]||'').length>2000)e[k]='内容过长';
 for(const k of ['wheelchair','babycare','paper','water'])if(b[k]&&!['yes','no','unknown'].includes(b[k]))e[k]='设施选项无效';
 return e;
}
export function normalizePlace(b,photos=[]){
 const errors=validatePlace(b,photos);if(Object.keys(errors).length){const error=new Error(Object.values(errors)[0]);error.fields=errors;throw error;}
 const fields=['name','address','description','template','regionId','locationMode','landmark','directions','customRegion','sourceUrl','publisher','checkedAt','hours','fee','wheelchair','babycare','paper','water'];
 const p=Object.fromEntries(fields.map(k=>[k,String(b[k]||'').trim()]));
 return {...p,...regionFields(b.regionId),schemaVersion:2,date:b.template==='visited'?b.date:null,lat:b.locationMode==='text'?null:Number(b.lat),lng:b.locationMode==='text'?null:Number(b.lng),coordinateSystem:'WGS84',hours:p.hours||'开放时间待核实',fee:p.fee||'收费待核实',photoMetadata:photos.map(p=>Object.fromEntries(['kind','caption','rights','author','sourceUrl','license'].map(k=>[k,String(p[k]||'').slice(0,2000)])))};
}
