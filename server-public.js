import {safeUrl} from './src/place-schema.js';
import {regionLabel} from './src/regions.js';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function siteOrigin(value){
 if(!value)return null;
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('SITE_URL 必须是无路径、无凭据的 HTTPS 网站地址');
 return u.origin;
}
export function placeUrl(id,origin=''){return `${origin}/?place=${encodeURIComponent(id)}`;}
export function renderPublicPage(template,{place,places=[],missing=false,origin=null,indexable=false}){
 const title=missing?'地点暂不可用 · 必拉榜':place?`${place.name} · 必拉榜`:'必拉榜 · 换个地方，看世界';
 const description=missing?'地点尚未公开、已下架或链接有误。':place?place.description:'发现旅途中的风景厕所，查看真实地点资料，分享实拍与到访体验。';
 const canonical=origin?(place?placeUrl(place.id,origin):origin+'/'):null;
 const image=place?.image||(place?.photos?.length?`/api/photos/${place.photos[0].id}`:null);
 const meta=`<meta name="robots" content="${indexable&&!missing?'index,follow':'noindex,nofollow'}"><meta property="og:type" content="website"><meta property="og:site_name" content="必拉榜"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description.slice(0,240))}">${canonical&&!missing?`<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:url" content="${escapeHtml(canonical)}">`:''}${image&&origin?`<meta property="og:image" content="${escapeHtml(origin+image)}">`:''}`;
 let body;
 if(missing)body='<h1>这个地点暂时无法查看</h1><p>链接可能有误，或地点尚未公开、已下架。</p><a href="/">返回发现页</a>';
 else if(place){
  const p=place;body=`<a href="/">必拉榜 · 发现更多地点</a><h1>${escapeHtml(p.name)}</h1><p>${escapeHtml(regionLabel(p.regionId))}</p><p>${escapeHtml(p.description)}</p>${image?`<img src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}" style="max-width:100%;max-height:500px;object-fit:contain">`:''}${p.imageCredit?`<p>摄影：${escapeHtml(p.imageCredit.author)} · <a href="${escapeHtml(p.imageCredit.url)}">原始来源</a> · <a href="${escapeHtml(p.imageCredit.licenseUrl)}">${escapeHtml(p.imageCredit.license)}</a></p>`:''}<h2>位置与找路</h2><p>${escapeHtml(p.address)}</p><p>${escapeHtml(p.locationMode==='reference'?'参考地标（非厕所入口）：'+p.landmark:p.locationMode==='precise'?'已提供厕所位置坐标':'暂无地图点位')}</p><p style="white-space:pre-line">${escapeHtml(p.directions||'入口路线待补充，请结合现场指示确认。')}</p><p>开放时间：${escapeHtml(p.hours||'待核实')} · 费用：${escapeHtml(p.fee||'待核实')}</p>${p.sourceUrl&&safeUrl(p.sourceUrl)?`<p>资料来源：<a href="${escapeHtml(p.sourceUrl)}" rel="noreferrer">${escapeHtml(p.publisher)}</a> · ${escapeHtml(p.checkedAt)} 核查</p>`:''}<p>历史资料不代表当前卫生或开放状态。请在到访前再次确认。</p>`;
 }else body=`<h1>必拉榜 · 发现风景厕所</h1><p>${escapeHtml(description)}</p><ul>${places.map(p=>`<li><a href="${escapeHtml(placeUrl(p.id))}">${escapeHtml(p.name)}</a> · ${escapeHtml(regionLabel(p.regionId))}</li>`).join('')}</ul>`;
 return template.replace(/<title>[\s\S]*?<\/title>/,`<title>${escapeHtml(title)}</title>`).replace(/<meta\s+name="description"[\s\S]*?\/>/,`<meta name="description" content="${escapeHtml(description.slice(0,240))}" />`).replace('</head>',meta+'</head>').replace('<div id="root"></div>',`<div id="root"><main>${body}<noscript><p>已为你显示公开资料。投稿、筛选、评论需要启用 JavaScript。</p></noscript></main></div>`);
}
export const sitemap=(places,origin)=>`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(origin+'/')}</loc></url>${places.map(p=>`<url><loc>${escapeHtml(placeUrl(p.id,origin))}</loc></url>`).join('')}</urlset>`;
