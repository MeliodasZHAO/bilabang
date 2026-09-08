import React,{useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Camera,ImageSquare} from '@phosphor-icons/react';
import {placeGallery} from './place-gallery.js';
import {photoKinds} from './place-schema.js';
import './gallery.css';

function GalleryPhoto({photo,alt,thumbnail=false}) {
  const [failed,setFailed]=useState(false);
  if(failed) return <span className={`gallery-image-failure${thumbnail?' is-thumbnail':''}`} role={thumbnail?undefined:'img'} aria-label={thumbnail?undefined:'图片暂时无法显示'} aria-hidden={thumbnail||undefined}>
    <ImageSquare size={thumbnail?24:32} aria-hidden="true"/>
    {!thumbnail&&<span>图片暂时无法显示</span>}
  </span>;
  return <img className="gallery-photo-image" src={photo.src} alt={alt} loading={thumbnail?'lazy':undefined} onError={()=>setFailed(true)}/>;
}

export default function PlaceGallery({place}) {
  const photos=placeGallery(place),[index,setIndex]=useState(0);
  useEffect(()=>setIndex(0),[place.id]);
  const currentIndex=Math.min(index,Math.max(0,photos.length-1));
  const active=photos[currentIndex];
  const secondary=photos.map((photo,photoIndex)=>({photo,photoIndex})).filter(({photoIndex})=>photoIndex!==currentIndex).slice(0,2);
  const layout=photos.length>2?'collage':photos.length===2?'pair':'single';

  return <section id="place-photos" className="place-gallery" aria-label="地点照片">
    {active?<figure className="gallery-main">
      <div className={`gallery-grid gallery-grid--${layout}`}>
        <div className="gallery-featured">
          <GalleryPhoto key={active.src} photo={active} alt={active.caption||place.name}/>
        </div>
        {secondary.length>0&&<div className="gallery-secondary">{secondary.map(({photo,photoIndex})=><button className="gallery-preview" key={photo.id} type="button" aria-label={`查看第 ${photoIndex+1} 张照片：${photo.caption||place.name}`} onClick={()=>setIndex(photoIndex)}>
          <GalleryPhoto key={photo.src} photo={photo} alt=""/>
          <span className="gallery-photo-number" aria-hidden="true">{photoIndex+1}</span>
        </button>)}</div>}
      </div>
      <figcaption>
        <div className="gallery-caption-details">
          <div className="gallery-caption-title"><span className="gallery-category">{photoKinds[active.kind]||'地点照片'}</span><strong>{active.caption||place.name}</strong></div>
          <div className="gallery-source">{active.author&&<span>摄影：{active.author}</span>}{active.url&&<a href={active.url} target="_blank" rel="noreferrer">原始来源 <ArrowUpRight size={14} aria-hidden="true"/></a>}{active.license&&(active.licenseUrl?<a href={active.licenseUrl} target="_blank" rel="noreferrer">{active.license}</a>:<span>{active.license}</span>)}</div>
          {active.changes&&<small>{active.changes}</small>}
        </div>
        <a className="gallery-original-link" href={active.src} target="_blank" rel="noreferrer">查看原图 <ArrowUpRight size={16} aria-hidden="true"/></a>
      </figcaption>
    </figure>:<div className="gallery-empty"><Camera size={32} aria-hidden="true"/><strong>这里还没有地点照片</strong><p>地点资料已收录，等待第一张真实照片。</p><a href="#place-community">补充地点照片 <ArrowUpRight size={16} aria-hidden="true"/></a></div>}
    {photos.length>1&&<div className="gallery-selector">
      <div className="gallery-thumbs" role="group" aria-label="选择照片">{photos.map((photo,i)=><button key={photo.id} type="button" aria-label={`查看第 ${i+1} 张照片：${photo.caption||place.name}`} aria-pressed={i===currentIndex} onClick={()=>setIndex(i)}>
        <GalleryPhoto key={photo.src} photo={photo} alt="" thumbnail/>
        <span className="gallery-photo-number" aria-hidden="true">{i+1}</span>
      </button>)}</div>
      <div className="gallery-pager"><button type="button" aria-label="上一张照片" disabled={currentIndex===0} onClick={()=>setIndex(currentIndex-1)}><ArrowLeft size={20} aria-hidden="true"/></button><span aria-live="polite" aria-atomic="true">{currentIndex+1} / {photos.length}</span><button type="button" aria-label="下一张照片" disabled={currentIndex===photos.length-1} onClick={()=>setIndex(currentIndex+1)}><ArrowRight size={20} aria-hidden="true"/></button></div>
    </div>}
  </section>;
}
