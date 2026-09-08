import React, {useEffect, useState} from 'react';
import {Camera, LinkSimple, Star} from '@phosphor-icons/react';
import {regionLabel} from './regions.js';

export default function PlaceCard({place:p, image, sort, rank, onOpen, notify}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[image]);
  const hasPhoto=Boolean(p.image||p.photos?.length);
  const score=p.scores?.[sort]?.average;
  const count=p.scores?.[sort]?.count||0;
  const placeLocation=p.regionId?regionLabel(p.regionId):[p.country,p.city].filter(Boolean).join(' / ');
  const url=`/?place=${encodeURIComponent(p.id)}`;
  return <article className="place-card">
    <a className="place-open" aria-label={`查看${p.name}`} href={url} onClick={e=>{
      if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(p);}
    }}>
      <div className="card-image">
        {hasPhoto&&!failed?<img src={image} alt={p.name} loading="lazy" onError={()=>setFailed(true)}/>:<div className="card-photo-empty"><Camera size={32}/><span>{failed?'图片暂时无法显示':'等待第一张实拍'}</span></div>}
        {rank!=null&&<span className="rank-number" aria-label={`当前榜单第 ${rank} 名`}>{rank}</span>}
      </div>
      <div className="card-body">
        <h3>{p.name}</h3>
        {placeLocation&&<p className="card-location">{placeLocation}</p>}
        {p.description&&<p className="card-description">{p.description}</p>}
        <div className="card-rating">
          {score!=null&&count>0?<><strong><Star size={16}/>{score.toFixed(1)}<small>/ 5</small></strong><span>{count} 位评价</span></>:<span>暂无评分</span>}
          {p.scene&&<span className="place-tag">{p.scene}</span>}
        </div>
      </div>
    </a>
    <button type="button" className="card-share" aria-label={`复制${p.name}的链接`} onClick={async()=>{
      try{await navigator.clipboard.writeText(new URL(url,location.origin).href);notify('地点链接已复制');}
      catch{notify('复制不可用，请打开地点后复制地址栏链接');}
    }}><LinkSimple size={18}/><span>复制链接</span></button>
  </article>;
}
