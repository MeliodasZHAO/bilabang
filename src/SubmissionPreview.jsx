import React from 'react';
import {regionLabel} from './regions.js';
import {photoKinds,safeUrl} from './place-schema.js';
export default function SubmissionPreview({place:p,photos,onEdit}){
 const facilities=[['wheelchair','无障碍设施'],['babycare','母婴 / 亲子空间'],['paper','卫生纸'],['water','洗手水源']];
 return <section className="submission-preview" aria-label="核对投稿内容">
  <div className="preview-heading"><h3>{p.name}</h3>{onEdit&&<button type="button" onClick={()=>onEdit(1)}>修改地点资料</button>}</div>
  <p>{regionLabel(p.regionId)}</p>{p.customRegion&&<p className="notice">待规范地名：{p.customRegion}，审核前不归入具体区县。</p>}
  <p>{p.description}</p>
  <dl><dt>详细位置 / 入口</dt><dd>{p.address}</dd><dt>定位方式</dt><dd>{{precise:'已确认厕所精确坐标',reference:'附近参考地标，不是厕所入口',text:'暂无地图点位'}[p.locationMode]}</dd>
  {p.locationMode!=='text'&&<><dt>WGS84 坐标</dt><dd>{p.lat}, {p.lng}</dd></>}
  {p.locationMode==='reference'&&<><dt>参考地标</dt><dd>{p.landmark}</dd></>}
  <dt>找路步骤</dt><dd style={{whiteSpace:'pre-line'}}>{p.directions||'入口路线待补充'}</dd>
  <dt>开放时间</dt><dd>{p.hours||'待核实'}</dd><dt>费用 / 门票</dt><dd>{p.fee||'待核实'}</dd>
  {facilities.map(([k,t])=><React.Fragment key={k}><dt>{t}</dt><dd>{{yes:'有',no:'没有'}[p[k]]||'不清楚'}</dd></React.Fragment>)}
  <dt>{p.template==='visited'?'到访日期':'资料核查日期'}</dt><dd>{p.template==='visited'?p.date:p.checkedAt}</dd></dl>
  <div className="preview-heading"><h3>照片与来源</h3>{onEdit&&<button type="button" onClick={()=>onEdit(2)}>修改照片与来源</button>}</div>
  {p.template==='source'&&<p>发布者：{p.publisher}<br/>{safeUrl(p.sourceUrl)&&<a href={p.sourceUrl} target="_blank" rel="noreferrer">查看原文 ↗</a>}</p>}
  {!photos.length&&!p.imageCredit&&<p className="notice">暂缺实拍，地点不会出现在公开列表中。补齐真实照片后再展示。</p>}
  <div className="preview-photos">{photos.map((photo,i)=><figure key={photo.url}><img src={photo.url} alt={photo.caption}/><figcaption><strong>{i===0?'封面 · ':''}{photoKinds[photo.kind]}</strong><p>{photo.caption}</p><small>{photo.rights==='own'?'本人拍摄':`摄影：${photo.author} · ${photo.license}`}</small>{photo.rights!=='own'&&safeUrl(photo.sourceUrl)&&<p><a href={photo.sourceUrl} target="_blank" rel="noreferrer">核对图片来源 ↗</a></p>}</figcaption></figure>)}</div>
 </section>;
}
