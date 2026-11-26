import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, FilmSlate, Fire, MapPin, Play } from '@phosphor-icons/react';
import { editorialRecords, featuredStops, stopUrl } from './editorial-catalog.js';
import { nationwidePicks, regionPicks } from './discovery-feed.js';
import { trafficDisabled } from './traffic.js';
import films from './data/discovery-films.json';
import './discovery-feed.css';

const places = new Map(editorialRecords.map(place => [place.id, place]));
const featured = new Map(featuredStops.map(place => [place.id, place]));
const provinces = [...new Set(editorialRecords.map(place => place.province))].sort((a, b) => a.localeCompare(b, 'zh'));
const tabs = [
  ['nearby', '地区推荐', MapPin],
  ['popular', '当下推荐', Fire],
  ['films', '实拍短片', FilmSlate],
];

function spotlight(event) {
  if (event.pointerType === 'touch') return;
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
}

function VideoFrame({ film }) {
  const viewport = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!film.portrait) return;
    const resize = () => setScale(viewport.current.clientWidth / 405);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [film.portrait]);
  return <div ref={viewport} className={film.portrait ? 'feed-video-portrait' : 'feed-video-wide'}>
    <iframe src={film.embed} title={film.title} allowFullScreen referrerPolicy="origin"
      style={film.portrait ? { transform: `scale(${scale})` } : undefined} />
  </div>;
}

function FilmShelf({ onEditionLink, initialFilm }) {
  const [active, setActive] = useState(Math.max(0, films.findIndex(film => film.id === initialFilm)));
  const [playing, setPlaying] = useState(false);
  const buttons = useRef([]);
  const film = films[active];
  const place = places.get(film.placeId);
  function select(index) {
    if (index === active) return;
    setActive(index);
    setPlaying(false);
  }
  function move(event, index) {
    const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + films.length) % films.length;
    select(next);
    buttons.current[next]?.focus();
  }
  return <div className="feed-film">
    <div className="feed-film-main" key={film.id}>
      <div className={`feed-screen ${playing && film.portrait ? 'feed-screen-portrait' : ''}`}>
        {playing ? <VideoFrame film={film} /> :
          <button onClick={() => setPlaying(true)} className="feed-film-cover" aria-label={`播放${film.title}`}>
            {place && <img src={place.media.src} alt={place.name} loading="lazy" decoding="async" />}
            <span className="feed-film-label">{film.platform} · {film.city}</span>
            {!place && <span className="feed-film-word">{film.city.split('·').at(-1)}</span>}
            <span className="feed-play"><Play weight="fill" size={20} /> 播放原片</span>
          </button>}
      </div>
      <div className="feed-film-caption">
        <h3>{film.title}</h3>
        <p>{film.description}</p>
        <div className="feed-film-links">
          <a href={film.original} target="_blank" rel="noopener noreferrer">原片出处 <ArrowUpRight size={14} /></a>
          {film.noteUrl && <a href={film.noteUrl} target="_blank" rel="noopener noreferrer">小红书原帖 <ArrowUpRight size={14} /></a>}
          {place && <a href={stopUrl(place)} onClick={event => onEditionLink(event, stopUrl(place))}>地点详情 <ArrowUpRight size={14} /></a>}
          {playing && <button onClick={() => setPlaying(false)}>关闭播放器</button>}
        </div>
        <small>视频：{film.publisher} · {film.date}{place?.media.author && ` · 地点照片：${place.media.author}`}</small>
      </div>
    </div>
    <ol className="feed-film-list" aria-label="短片选集">
      {films.map((item, index) => <li key={item.id}>
        <button ref={node => { buttons.current[index] = node; }} aria-pressed={active === index}
          onKeyDown={event => move(event, index)} onClick={() => select(index)}>
          <span className="feed-episode">{String(index + 1).padStart(2, '0')}</span>
          <span><small>{item.city} · {item.platform}</small><strong>{item.title}</strong></span>
          <Play weight={index === active ? 'fill' : 'regular'} size={17} />
        </button>
      </li>)}
    </ol>
  </div>;
}

export default function DiscoveryFeed({ onEditionLink }) {
  const [initialFilm] = useState(() => new URLSearchParams(location.search).get('film'));
  const [tab, setTab] = useState(initialFilm ? 'films' : 'popular');
  const [region, setRegion] = useState(null);
  const [mode, setMode] = useState('auto');
  const [trending, setTrending] = useState([]);
  const [failed, setFailed] = useState([]);
  const [observed, setObserved] = useState(false);
  const panel = useRef(null);
  const interacted = useRef(false);
  const tabButtons = useRef([]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const auto = !trafficDisabled() && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl;
    fetch('/_discover', {
      headers: { 'X-Bilabang-Geo': auto ? '1' : '0' },
      credentials: 'omit', signal: controller.signal,
    }).then(response => response.ok ? response.json() : null).then(data => {
      if (controller.signal.aborted || !data) return;
      if (Array.isArray(data.trending)) setTrending(data.trending.filter(id => places.has(id)));
      if (data.region && provinces.includes(data.region.province)) {
        setRegion(data.region);
        if (!interacted.current && !initialFilm) setTab('nearby');
      }
    }).catch(() => {}).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    if (initialFilm) document.getElementById('discovery-feed')?.scrollIntoView();
  }, [initialFilm]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setObserved(true);
        observer.disconnect();
      }
    }, { threshold: .12 });
    if (panel.current) observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);

  const eligible = editorialRecords.filter(place => !failed.includes(place.id));
  const nationwide = nationwidePicks(eligible, featuredStops.slice(1).filter(place => !failed.includes(place.id)), trending);
  const setting = mode === 'auto' ? region : mode === 'all' ? null : { province: mode };
  const local = regionPicks(eligible, setting, trending);
  const entries = tab === 'nearby' && local.length ? local : nationwide;
  const listingText = tab === 'nearby'
    ? local.length ? `${setting.city ? setting.city + '优先，' : ''}${setting.province}实拍` : '请选择目的地区，或先看看全国精选。'
    : trending.length ? '按近七天真实详情浏览动态调整。' : '近期样本积累中，先看编辑精选。';

  function choose(id) {
    interacted.current = true;
    setTab(id);
  }
  function move(event, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + step + tabs.length) % tabs.length;
    choose(tabs[next][0]);
    tabButtons.current[next]?.focus();
  }
  return <section id="discovery-feed" className="edition-picks discovery-feed" aria-labelledby="edition-picks-title">
    <div className="edition-section-heading">
      <div><p>必拉榜精选</p><h2 id="edition-picks-title">发现下一站</h2></div>
      <a href="/editorial?scope=all#city-leaderboard" data-traffic="home-library" onClick={event => onEditionLink(event, '/editorial?scope=all#city-leaderboard')}>全部有图地点 <ArrowUpRight size={17} /></a>
    </div>
    <div className="feed-tabs" role="tablist" aria-label="发现方式">
      {tabs.map(([id, label, Icon], index) => <button key={id} ref={node => { tabButtons.current[index] = node; }}
        role="tab" id={`feed-tab-${id}`} aria-selected={tab === id} aria-controls="feed-content" tabIndex={tab === id ? 0 : -1}
        onClick={() => choose(id)} onKeyDown={event => move(event, index)}>
        <Icon size={18} weight={tab === id ? 'fill' : 'regular'} /> {label}
      </button>)}
    </div>
    <div id="feed-content" role="tabpanel" tabIndex={0} aria-labelledby={`feed-tab-${tab}`} ref={panel} className={observed ? 'feed-observed' : ''}>
      {tab === 'films' ? <FilmShelf onEditionLink={onEditionLink} initialFilm={initialFilm} /> : <>
        <div className="feed-list-heading">
          <p aria-live="polite">{listingText}</p>
          {tab === 'nearby' && <select aria-label="选择推荐省市" value={mode} onChange={event => { interacted.current = true; setMode(event.target.value); }}>
            <option value="auto">{region ? `网络地区 · ${region.province}` : '按网络地区'}</option>
            <option value="all">全国精选</option>
            {provinces.map(province => <option key={province}>{province}</option>)}
          </select>}
        </div>
        <div key={tab + mode} className="edition-stories feed-stories">
          {entries.map((place, index) => {
            const text = featured.get(place.id) || place;
            const clip = films.find(film => film.placeId === place.id);
            return <article className="edition-story feed-story" key={place.id} style={{ '--position': index }} onPointerMove={spotlight}>
              <a href={stopUrl(place)} onClick={event => onEditionLink(event, stopUrl(place))}>
                <div className="edition-story-photo">
                  <img src={place.media.src} alt={place.name} loading="lazy" decoding="async" onError={() => setFailed(items => items.includes(place.id) ? items : [...items, place.id])} />
                  <span className="edition-story-tag">{place.displayCity} · {text.theme || place.category}</span>
                  <span className="edition-photo-arrow"><ArrowUpRight size={19} /></span>
                  {clip && <span className="feed-story-film"><Play size={11} weight="fill" /> 有短片</span>}
                </div>
                <h3>{text.headline || place.name}</h3>
                <p>{text.story || place.feature}</p>
              </a>
              <a className="edition-credit" href={place.mediaSourceUrl || place.sourceUrl} target="_blank" rel="noopener noreferrer">摄影 {place.media.author || '见原文'} <ArrowUpRight size={12} /></a>
            </article>;
          })}
        </div>
      </>}
    </div>
  </section>;
}
