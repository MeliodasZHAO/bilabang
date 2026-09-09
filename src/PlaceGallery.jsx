import React,{useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Camera} from '@phosphor-icons/react';
import {placeGallery} from './place-gallery.js';
import {photoKinds} from './place-schema.js';

export default function PlaceGallery({place}) {
  const photos=placeGallery(place),[index,setIndex]=useState(0);
  const active=photos[Math.min(index,Math.max(0,photos.length-1))];
  return <section id="place-photos" className="place-gallery" aria-label="地点照片">
    <figure className="gallery-main">
      {active?<img className="detail-image" src={active.src} alt={active.caption||place.name}/>:<div className="gallery-empty"><Camera size={38}/><strong>这里，还差你的视角</strong><p>地点资料已收录，等待第一张真实照片。</p><a href="#place-community">到访过？来补一张 <ArrowUpRight size={16}/></a></div>}
      {active&&<figcaption><div><span className="gallery-category">{photoKinds[active.kind]||'地点照片'}</span><strong>{active.caption||place.name}</strong>{active.author&&<span>摄影：{active.author}</span>}<span className="gallery-source">{active.url&&<a href={active.url} target="_blank" rel="noreferrer">原始来源 ↗</a>}{active.license&&(active.licenseUrl?<a href={active.licenseUrl} target="_blank" rel="noreferrer">{active.license}</a>:<span>{active.license}</span>)}</span>{active.changes&&<small>{active.changes}</small>}</div><a className="text-action" href={active.src} target="_blank" rel="noreferrer">查看原图 <ArrowUpRight size={16}/></a></figcaption>}
    </figure>
    {photos.length>1&&<div className="gallery-selector"><div className="gallery-thumbs" aria-label="选择照片">{photos.map((photo,i)=><button key={photo.id} type="button" aria-label={`查看第 ${i+1} 张照片：${photo.caption||place.name}`} aria-pressed={i===index} onClick={()=>setIndex(i)}><img src={photo.src} alt="" loading="lazy"/><span>{i+1}</span></button>)}</div><div className="gallery-pager"><button className="icon-button" aria-label="上一张照片" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ArrowLeft size={20}/></button><span aria-live="polite">{index+1} / {photos.length}</span><button className="icon-button" aria-label="下一张照片" disabled={index===photos.length-1} onClick={()=>setIndex(i=>i+1)}><ArrowRight size={20}/></button></div></div>}
  </section>;
}
