import React from 'react';
import {similarPlaces} from './duplicates.js';
import {regionLabel} from './regions.js';
export default function DuplicateNotice({draft,places}){
 const similar=similarPlaces(draft,places);if(!similar.length)return null;
 return <aside className="duplicate-notice" aria-label="可能重复的地点"><h3>这处厕所，可能已经有人收录</h3><p>请核对名称、楼层和入口。附近可能有多间厕所，提醒不会阻止你继续投稿。</p>{similar.map(({place,reasons})=><div key={place.id}><a href={`/?place=${encodeURIComponent(place.id)}`} target="_blank" rel="noreferrer">{place.name} · 新窗口查看 ↗</a><small>{regionLabel(place.regionId)} · {place.address}</small><p>{reasons.join('；')}</p></div>)}<p className="muted">如果是同一处，可在原地点留言或纠错。新窗口查看不会关闭当前草稿。</p></aside>;
}
