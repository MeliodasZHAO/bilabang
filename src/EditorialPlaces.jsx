import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, GridFour, LinkSimple, ListBullets, MagnifyingGlass, X } from '@phosphor-icons/react';
import { cityRanking, editorialDate, editorialRecords, featuredStops, stopUrl } from './editorial-catalog.js';

const reviewMode = import.meta.env.MODE === 'editorial-review';
const dimensions = [
  ['design', '设计', 35],
  ['setting', '景观', 30],
  ['access', '到访', 20],
  ['evidence', '资料', 15],
];
const rankLabel = rank => rank ? String(rank).padStart(2, '0') : '—';
const readFilters = () => {
  const params = new URLSearchParams(location.search);
  return { scope: params.get('scope') === 'all' ? 'all' : 'top', city: params.get('city') || '' };
};
const readStop = () => new URLSearchParams(location.search).get('stop');

function Photo({ place, onError, eager }) {
  return <img src={place.media.src} alt={place.name} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => onError(place.id)} />;
}

function ScoreBar({ place, index, label, max, dimension, showLabel = true }) {
  const points = place.editorial.components[dimension];
  return <div className="ed-bar" data-axis={index}>
    {showLabel && <span>{label}</span>}
    <meter min="0" max={max} value={points} aria-label={`${label} ${points}/${max}`} />
    <b>{points}<small>/{max}</small></b>
  </div>;
}

function Credit({ place }) {
  return <a href={place.mediaSourceUrl || place.sourceUrl} target="_blank" rel="noopener noreferrer">
    摄影 {place.media.author || '见原文'} <ArrowUpRight size={12} />
  </a>;
}

function StopDetail({ place, close, onError }) {
  const dialog = useRef(null);
  const [copied, setCopied] = useState('');
  const permalink = new URL(stopUrl(place), location.origin).href;
  const story = featuredStops.find(item => item.id === place.id)?.story;
  useEffect(() => {
    const modal = dialog.current;
    modal.showModal();
    return () => modal.close();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied('地点链接已复制');
    } catch {
      setCopied('请复制下方链接');
    }
  }

  return <dialog ref={dialog} className="ed-dialog" aria-labelledby="ed-detail-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="ed-dialog-panel">
      <button className="ed-close" autoFocus aria-label="关闭地点详情" onClick={close}><X size={22} /></button>
      <div className="ed-detail-photo"><Photo place={place} onError={onError} eager /></div>
      <div className="ed-detail-body">
        <div className="ed-detail-kicker"><span>{place.province} · {place.displayCity} / {place.category}</span>{place.rank && <b>全国第 {place.rank} 名</b>}</div>
        <h2 id="ed-detail-title">{place.name}</h2>
        <p>{story || place.feature}</p>
        <div className="ed-visit">
          <div><h3>具体位置</h3><p>{place.address}</p></div>
          <div><h3>到访提示</h3><p>{place.access}</p></div>
        </div>
        <div className="ed-detail-score">
          <strong>{place.editorial.score}<small> / 100</small></strong>
          <span>编辑推荐分<small>依据公开资料评估，非到访者评分</small></span>
        </div>
        <div className="ed-bars">{dimensions.map(([dimension, label, max], index) =>
          <ScoreBar key={dimension} {...{ place, dimension, index, label, max }} />
        )}</div>
        <div className="ed-source-links">
          <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">项目原文 <ArrowUpRight size={14} /></a>
          <Credit place={place} />
          <button onClick={copyLink}><LinkSimple size={16} /> 复制地点链接</button>
        </div>
        <p className="ed-detail-source">{place.publisher} · 资料日期 {place.publishedAt || '原文未注明'}。现场开放情况请在出发前核对。</p>
        <p className="ed-detail-source">{place.media.licenseLabel}</p>
        {copied && <p role="status">{copied}{copied.startsWith('请') && <input aria-label="地点分享链接" readOnly value={permalink} onFocus={event => event.target.select()} />}</p>}
      </div>
    </div>
  </dialog>;
}

function RankingCard({ place, linkHandler, onError }) {
  const href = stopUrl(place);
  return <article className="ed-card">
    <a className="ed-card-photo" href={href} onClick={event => linkHandler(event, place)}>
      <Photo place={place} onError={onError} />
      {place.rank && <span className="ed-rank">{rankLabel(place.rank)}</span>}
      <span className="ed-city">{place.displayCity}</span>
      <span className="ed-photo-open"><ArrowUpRight size={18} /></span>
    </a>
    <div className="ed-card-body">
      <div className="ed-card-meta">{place.province} / {place.category}</div>
      <div className="ed-card-title">
        <h3><a href={href} onClick={event => linkHandler(event, place)}>{place.name}</a></h3>
        <div className="ed-total"><b>{place.editorial.score}</b><span>编辑分 / 100</span></div>
      </div>
      <p className="ed-feature">{place.feature}</p>
      <div className="ed-photo-credit"><Credit place={place} /></div>
    </div>
  </article>;
}

export default function EditorialPlaces() {
  const [filters, setFilters] = useState(readFilters);
  const [layout, setLayout] = useState('cards');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('score');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(readStop);
  const [failed, setFailed] = useState([]);
  const board = useRef(null);

  useEffect(() => {
    const handlePop = () => {
      setOpenId(readStop());
      setFilters(readFilters());
    };
    window.addEventListener('popstate', handlePop);
    if (location.hash === '#city-leaderboard') requestAnimationFrame(() => board.current?.scrollIntoView());
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const records = editorialRecords.filter(place => !failed.includes(place.id));
  const ranked = records.filter(place => place.rank);
  const pool = filters.scope === 'all' ? records : ranked;
  const cityCounts = new Map();
  for (const place of pool) cityCounts.set(place.city, (cityCounts.get(place.city) || 0) + 1);
  const cities = [...cityCounts.keys()].sort((a, b) => a.localeCompare(b, 'zh'));
  const scoreOf = place => sort === 'score' ? place.editorial.score : place.editorial.components[sort];
  const filtered = pool.filter(place => (!filters.city || place.city === filters.city) &&
    `${place.name} ${place.displayCity} ${place.province} ${place.category} ${place.address}`.includes(query.trim()))
    .sort((a, b) => scoreOf(b) - scoreOf(a) || (a.rank || Infinity) - (b.rank || Infinity) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 12, current * 12);
  const cover = featuredStops.slice(1).find(place => !failed.includes(place.id));
  const selected = records.find(place => place.id === openId);
  const onError = id => setFailed(previous => previous.includes(id) ? previous : [...previous, id]);

  function updateFilters(next) {
    setFilters(next);
    setPage(1);
    const url = new URL(location.href);
    if (next.scope === 'all') url.searchParams.set('scope', 'all');
    else url.searchParams.delete('scope');
    if (next.city) url.searchParams.set('city', next.city);
    else url.searchParams.delete('city');
    history.replaceState(history.state, '', url);
  }
  function openStop(event, place) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set('stop', place.id);
    history.replaceState({ ...history.state, scrollY: window.scrollY }, '', location.href);
    history.pushState({ ...history.state, editorialDialog: true }, '', url);
    setOpenId(place.id);
  }
  function closeStop() {
    if (history.state?.editorialDialog) {
      history.back();
      return;
    }
    const url = new URL(location.href);
    url.searchParams.delete('stop');
    history.replaceState(history.state, '', url);
    setOpenId(null);
  }
  function changePage(next) {
    setPage(next);
    board.current?.scrollIntoView();
  }
  const changeSort = value => { setSort(value); setPage(1); };

  return <main className="ed-page">
    {reviewMode && <p className="ed-review-note">本地审阅版</p>}
    <section className="ed-hero" aria-labelledby="ed-title">
      <div>
        <p className="ed-eyebrow">一城一厕 / 编辑推荐</p>
        <h1 id="ed-title">全国 <em>{cityRanking.length}</em> 城<br />厕所推荐榜</h1>
        <p className="ed-lead">每城选一处。看建筑实拍、查到访位置，<br />再看看你的城市排在哪里。</p>
        <a className="edition-primary" href="#city-leaderboard">看城市榜单 <ArrowDown size={18} /></a>
        <div className="ed-hero-stats"><span><b>{ranked.length}</b> 城上榜</span><span><b>{records.length}</b> 处有图地点</span></div>
      </div>
      {cover && <figure className="ed-cover">
        <a href={stopUrl(cover)} onClick={event => openStop(event, cover)} className="ed-hero-photo">
          <Photo place={cover} onError={onError} eager />
          <span className="ed-hero-caption"><span><small>{cover.province} · {cover.displayCity} / 全国第 {cover.rank} 名</small><strong>{cover.name}</strong></span><ArrowUpRight size={26} /></span>
        </a>
        <figcaption><Credit place={cover} /></figcaption>
      </figure>}
    </section>

    <section className="ed-board" ref={board} id="city-leaderboard" aria-labelledby="ed-board-title">
      <div className="ed-board-heading">
        <div><h2 id="ed-board-title">{filters.scope === 'all' ? '全部有图地点' : '城市榜单'}</h2><p>编辑推荐分 / 100 · 资料整理于 {editorialDate}</p></div>
        <div className="ed-view-switch" role="group" aria-label="榜单视图">
          <button aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}><GridFour size={17} /> 实拍卡片</button>
          <button aria-pressed={layout === 'table'} onClick={() => setLayout('table')}><ListBullets size={17} /> 评分对比</button>
        </div>
      </div>

      <div className="ed-filters">
        <div className="ed-scope" role="group" aria-label="推荐范围">
          <button aria-pressed={filters.scope === 'top'} onClick={() => updateFilters({ scope: 'top', city: '' })}>{cityRanking.length} 城榜</button>
          <button aria-pressed={filters.scope === 'all'} onClick={() => updateFilters({ scope: 'all', city: '' })}>全部 {records.length} 处</button>
        </div>
        <label className="ed-search"><MagnifyingGlass size={16} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} aria-label="搜索地点" placeholder="搜索城市、地点或场景" /></label>
        <select value={filters.city} onChange={event => updateFilters({ ...filters, city: event.target.value })} aria-label="筛选城市">
          <option value="">全部城市</option>
          {filters.city && !cities.includes(filters.city) && <option value={filters.city}>{filters.city}</option>}
          {cities.map(city => <option key={city} value={city}>{city} · {cityCounts.get(city)} 处</option>)}
        </select>
        <select value={sort} onChange={event => changeSort(event.target.value)} aria-label="排序维度">
          <option value="score">综合分优先</option>
          {dimensions.map(([key, label]) => <option key={key} value={key}>{label}分优先</option>)}
        </select>
      </div>
      <div className="ed-results">
        <span aria-live="polite">找到 <b>{filtered.length}</b> 处 · {new Set(filtered.map(place => place.city)).size} 城{pages > 1 && ` · 第 ${current} / ${pages} 页`}</span>
        <details className="ed-method">
          <summary>分数怎么算？</summary>
          <p>根据公开资料，按设计 35、景观 30、到访 20、资料 15 分评估。每城最多一处。卫生、气味与排队留给实际到访者评价。</p>
        </details>
      </div>
      {!visible.length ? <div className="ed-empty" role="status"><h3>没有符合条件的地点</h3>
        <button onClick={() => { setQuery(''); updateFilters({ ...filters, city: '' }); }}>清除筛选</button>
      </div> : layout === 'cards' ? <div className="ed-cards">
        {visible.map(place => <RankingCard key={place.id} place={place} linkHandler={openStop} onError={onError} />)}
      </div> : <div className="ed-table-scroll" tabIndex={0} role="region" aria-label="带实拍的评分对比表">
        <table className="ed-table">
          <caption>城市排名与分项评分</caption>
          <thead><tr>
            <th scope="col">排名</th><th scope="col">实拍 / 地点</th>
            <th scope="col" aria-sort={sort === 'score' ? 'descending' : 'none'}><button onClick={() => changeSort('score')}>综合分 <small>/ 100</small></button></th>
            {dimensions.map(([key, label, max]) => <th scope="col" key={key} aria-sort={sort === key ? 'descending' : 'none'}><button onClick={() => changeSort(key)}>{label}<small>/ {max}</small></button></th>)}
          </tr></thead>
          <tbody>{visible.map(place => <tr key={place.id}>
            <td className="ed-table-rank">{rankLabel(place.rank)}</td>
            <td><a className="ed-table-place" href={stopUrl(place)} onClick={event => openStop(event, place)}><Photo place={place} onError={onError} /><span><b>{place.name}</b><small>{place.displayCity} · {place.category}</small></span></a></td>
            <td><strong className="ed-table-total">{place.editorial.score}</strong></td>
            {dimensions.map(([dimension, label, max], index) => <td key={dimension}><ScoreBar {...{ place, dimension, index, label, max }} showLabel={false} /></td>)}
          </tr>)}</tbody>
        </table>
      </div>}
      {pages > 1 && <div className="ed-pagination">
        <button disabled={current === 1} onClick={() => changePage(current - 1)}>← 上一页</button>
        <span>{current} / {pages}</span>
        <button disabled={current === pages} onClick={() => changePage(current + 1)}>下一页 →</button>
      </div>}
      {failed.length > 0 && <p className="ed-load-note" role="status">{failed.length} 处照片暂未加载，已从本次展示中隐藏。</p>}
    </section>
    {selected && <StopDetail key={selected.id} place={selected} close={closeStop} onError={onError} />}
    {openId && !selected && <p className="ed-load-note" role="status">这处地点或照片暂不可用。 <button onClick={closeStop}>返回榜单</button></p>}
  </main>;
}
