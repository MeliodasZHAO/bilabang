import React, { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, MapPin, MagnifyingGlass } from '@phosphor-icons/react';
import { cityRanking, cityUrl, editorialRecords, featuredStops, stopUrl } from './editorial-catalog.js';
import DiscoveryFeed from './DiscoveryFeed.jsx';
import './discovery-edition.css';

const lead = featuredStops[0];
const cityCount = new Set(editorialRecords.map(place => place.city)).size;

function PhotoCredit({ place }) {
  return <a className="edition-credit" href={place.mediaSourceUrl || place.sourceUrl} target="_blank" rel="noopener noreferrer">
    摄影 {place.media.author || '见原文'} <ArrowUpRight size={12} />
  </a>;
}

export default function DiscoveryEdition({ onEditionLink }) {
  const [city, setCity] = useState('');
  const [broken, setBroken] = useState([]);
  const hidePhoto = id => setBroken(current => current.includes(id) ? current : [...current, id]);
  const leadVisible = lead && !broken.includes(lead.id);
  const go = (event, href) => onEditionLink(event, href);
  const cityMatches = city.trim() ? cityRanking.filter(place =>
    `${place.displayCity} ${place.province}`.includes(city.trim())
  ) : cityRanking.slice(0, 5);

  return <section className="edition-home" aria-label="必拉榜编辑精选">
    <div className="edition-strip">
      <a href="/editorial" data-traffic="home-announcement" onClick={event => go(event, '/editorial')}>
        <span className="edition-indicator" /> 本期推荐 <b>一城一厕 · 全国 {cityRanking.length} 城</b><ArrowUpRight size={15} />
      </a>
      <a className="edition-community-jump" href="#explore">旅人分享 <ArrowDown size={14} /></a>
    </div>
    <section className="edition-cover">
      <div className="edition-intro">
        <p className="edition-masthead">THE SCENIC STOP <span>旅行与公共空间</span></p>
        <h1>这也能是<br />厕所<span>？</span></h1>
        <p className="edition-deck">湖边的白塔、海边的海螺、树林里的一扇窗。来看看哪些厕所，值得你在路上多停一站。</p>
        <div className="edition-cover-actions">
          <a className="edition-primary" href="/editorial#city-leaderboard" data-traffic="home-primary" onClick={event => go(event, '/editorial#city-leaderboard')}>
            查看全国 {cityRanking.length} 城榜 <ArrowUpRight size={20} weight="bold" />
          </a>
          <a className="edition-cover-films" href="/?film=jiaying-stone-channel#discovery-feed">看实拍短片 <ArrowDown size={15} /></a>
        </div>
        <div className="edition-index">
          <span><strong>{cityRanking.length}</strong> 城上榜</span>
          <span><strong>{editorialRecords.length}</strong> 处实拍</span>
          <span><strong>{cityCount}</strong> 城收录</span>
        </div>
      </div>
      {leadVisible && <figure className="edition-hero">
        <a className="edition-hero-photo" href={stopUrl(lead)} onClick={event => go(event, stopUrl(lead))}>
          <img src={lead.media.src} alt="嘉兴银杏天鹅湖边的白色潜望镜厕所，建筑倒映在湖面" fetchPriority="high" onError={() => hidePhoto(lead.id)} />
          <span className="edition-cover-label"><MapPin size={15} weight="fill" /> 浙江 · 嘉兴</span>
          <span className="edition-photo-arrow" aria-label="查看地点"><ArrowUpRight size={25} /></span>
        </a>
        <figcaption>
          <a className="edition-hero-title" href={stopUrl(lead)} onClick={event => go(event, stopUrl(lead))}>
            <strong>{lead.headline}</strong><span>{lead.name}</span>
          </a>
          <PhotoCredit place={lead} />
        </figcaption>
      </figure>}
    </section>
    <DiscoveryFeed onEditionLink={onEditionLink} />
    <section className="edition-cities" aria-labelledby="edition-cities-title">
      <div className="edition-city-intro">
        <p>一城一厕</p>
        <h2 id="edition-cities-title">你的城市<br />排第几？</h2>
        <label className="edition-city-search">
          <MagnifyingGlass size={20} />
          <input aria-label="查城市排名" placeholder="输入城市或省份" value={city} onChange={event => setCity(event.target.value)} />
        </label>
        <a href="/editorial#city-leaderboard" data-traffic="home-cities" onClick={event => go(event, '/editorial#city-leaderboard')}>完整榜单与评分对比 <ArrowRight size={17} /></a>
      </div>
      <div className="edition-city-results">
        <div className="edition-city-columns"><span>排名 / 城市</span><span>上榜地点</span><span>编辑分</span></div>
        {cityMatches.length ? cityMatches.map(place => <a key={place.id} href={cityUrl(place.city)} data-traffic="home-cities" onClick={event => go(event, cityUrl(place.city))}>
          <span><b>{String(place.rank).padStart(2, '0')}</b> {place.displayCity}</span>
          <strong>{place.name}</strong>
          <span>{place.editorial.score}<ArrowUpRight size={16} /></span>
        </a>) : <p role="status">本期榜单没有这个城市。<a href="/share">推荐一处你知道的地点 ↗</a></p>}
      </div>
    </section>
  </section>;
}
