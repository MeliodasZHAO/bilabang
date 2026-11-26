const productionOrigin = 'https://bilabang.com';
const visitorKey = 'bilabang.traffic.visitor';
const visitKey = 'bilabang.traffic.visit';
const optOutKey = 'bilabang.traffic.opt-out';
const visitorAge = 14 * 24 * 60 * 60 * 1000;
const visitIdle = 30 * 60 * 1000;
const validId = /^[a-f0-9]{32}$/;
let visitor;
let visit;
let locallyDisabled = false;

const sourceAliases = new Map([
  ['wechat', 'wechat'], ['weixin', 'wechat'], ['微信', 'wechat'],
  ['xiaohongshu', 'xiaohongshu'], ['xhs', 'xiaohongshu'], ['rednote', 'xiaohongshu'], ['小红书', 'xiaohongshu'],
  ['douyin', 'douyin'], ['抖音', 'douyin'], ['weibo', 'weibo'], ['微博', 'weibo'],
  ['bilibili', 'bilibili'], ['b站', 'bilibili'], ['qq', 'qq'], ['baidu', 'baidu'],
  ['google', 'google'], ['bing', 'bing'], ['zhihu', 'zhihu'], ['newsletter', 'newsletter'],
]);
const knownSites = [
  ['wechat', ['weixin.qq.com', 'wechat.com']], ['xiaohongshu', ['xiaohongshu.com', 'xhslink.com']],
  ['douyin', ['douyin.com']], ['weibo', ['weibo.com', 'weibo.cn']], ['qq', ['qq.com']],
  ['bilibili', ['bilibili.com', 'b23.tv']], ['baidu', ['baidu.com']],
  ['google', ['google.com', 'google.com.hk']], ['bing', ['bing.com']],
  ['zhihu', ['zhihu.com']],
];
const belongsTo = (host, domain) => host === domain || host.endsWith('.' + domain);

export function trafficSource(search, referrer) {
  const tagged = new URLSearchParams(search).get('utm_source')?.trim().toLowerCase();
  if (tagged) return sourceAliases.get(tagged) || 'tagged-other';
  if (!referrer) return 'direct';
  try {
    const { protocol, hostname } = new URL(referrer);
    if (!['https:', 'http:'].includes(protocol) || belongsTo(hostname, 'bilabang.com')) return 'direct';
    const match = knownSites.find(([, domains]) => domains.some(domain => belongsTo(hostname, domain)));
    if (match) return match[0];
    const host = hostname.replace(/^www\./, '');
    return /^(?:[a-z0-9-]+\.)+[a-z]{2,24}$/.test(host) && host.length <= 80 ? host : 'external-other';
  } catch {
    return 'direct';
  }
}

function readStorage(kind, key) {
  try { return window[kind].getItem(key); } catch { return null; }
}

function writeStorage(kind, key, value) {
  try {
    if (value === null) window[kind].removeItem(key);
    else window[kind].setItem(key, value);
  } catch { /* Storage may be unavailable. Keep only an in-memory identifier. */ }
}

function readRecord(kind, key) {
  try { return JSON.parse(readStorage(kind, key)); } catch { return null; }
}

export function trafficDisabled() {
  return locallyDisabled || readStorage('localStorage', optOutKey) === '1';
}

export function setTrafficDisabled(disabled) {
  locallyDisabled = disabled;
  writeStorage('localStorage', optOutKey, disabled ? '1' : null);
  if (disabled) {
    visitor = undefined;
    visit = undefined;
    writeStorage('localStorage', visitorKey, null);
    writeStorage('sessionStorage', visitKey, null);
  }
}

const randomId = () => crypto.randomUUID().replaceAll('-', '');

function sendEvent(event, surface, session, test) {
  const path = `/_traffic/v1/${event}/${surface}/${session.source}/${session.visitor}/${session.id}/${test ? 'qa' : 'live'}`;
  fetch(path, { method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'origin' }).catch(() => {});
}

export function recordTraffic(event, surface, entry = surface) {
  if (location.origin !== productionOrigin || trafficDisabled() || navigator.doNotTrack === '1' || navigator.globalPrivacyControl || !crypto.randomUUID) return;
  const now = Date.now();
  const test = navigator.webdriver === true;
  visitor = readRecord('localStorage', visitorKey) || visitor;
  if (!validId.test(visitor?.id || '') || !(visitor.expires > now)) {
    visitor = { id: randomId(), expires: now + visitorAge };
    writeStorage('localStorage', visitorKey, JSON.stringify(visitor));
  }
  visit ??= readRecord('sessionStorage', visitKey);
  const start = !validId.test(visit?.id || '') || visit.visitor !== visitor.id ||
    !(visit.lastSeen > now - visitIdle) || !/^[a-z0-9.-]{1,80}$/.test(visit.source);
  if (start) {
    visit = { id: randomId(), visitor: visitor.id, source: trafficSource(location.search, document.referrer) };
    sendEvent('entry', entry, visit, test);
  }
  visit.lastSeen = now;
  writeStorage('sessionStorage', visitKey, JSON.stringify(visit));
  if (event !== 'entry') sendEvent(event, surface, visit, test);
}
