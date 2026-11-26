#!/usr/bin/env node
import { readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

const logDir = process.argv[2] || '/var/log/caddy';
const days = Number(process.argv[3] || '4');
if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('Choose 1–14 days');
const now = Date.now() / 1000;
const since = now - days * 86400;
const zone = 'Asia/Shanghai';
const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, dateStyle: 'short' });
const dateTime = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' });
const id = /^[a-f0-9]{32}$/;
const sourcePattern = /^[a-z0-9.-]{1,80}$/;
const eventNames = new Set(['entry', 'home_view', 'rank_click', 'rank_view', 'detail_view']);
const sourceNames = {
  direct: '直接访问或来源未提供', wechat: '微信', xiaohongshu: '小红书', douyin: '抖音',
  weibo: '微博', bilibili: '哔哩哔哩', qq: 'QQ', baidu: '百度', google: 'Google', bing: 'Bing',
  zhihu: '知乎', newsletter: '邮件订阅', 'tagged-other': '其他带标签渠道', 'external-other': '其他外部来源',
};
const entryNames = {
  nav: '导航栏全国榜', 'home-announcement': '首页推荐公告', 'home-primary': '首页主按钮',
  'home-cities': '首页城市排名', 'home-library': '首页全部地点', 'community-rank': '用户评分榜',
};
const visitors = new Set();
const visits = new Map();
const byDay = new Map();
const clicks = new Map();
const count = (table, key) => table.set(key, (table.get(key) || 0) + 1);
let malformed = 0;
let qa = 0;

for (const name of await readdir(logDir)) {
  if (!/^bilabang-traffic(?:-[\w.-]+)?\.jsonl(?:\.gz)?$/.test(name)) continue;
  const path = join(logDir, name);
  let info;
  try { info = await stat(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  if (!info.isFile() || info.mtimeMs / 1000 < since) continue;
  const file = createReadStream(path);
  const input = name.endsWith('.gz') ? file.pipe(createGunzip()) : file;
  file.on('error', error => { if (input !== file) input.destroy(error); });
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      let event;
      try { event = JSON.parse(line); } catch { malformed++; continue; }
      if (!event || !Number.isFinite(event.ts) || event.ts < since || event.ts > now || event.status !== 204 ||
        !id.test(event.visitor) || !id.test(event.visit) || !sourcePattern.test(event.source) || !eventNames.has(event.event)) continue;
      if (event.mode === 'qa') { qa++; continue; }
      if (event.mode !== 'live') continue;
      visitors.add(event.visitor);
      const day = dateKey.format(event.ts * 1000);
      if (!byDay.has(day)) byDay.set(day, { visitors: new Set(), visits: new Set() });
      byDay.get(day).visitors.add(event.visitor);
      byDay.get(day).visits.add(event.visit);

      if (!visits.has(event.visit)) visits.set(event.visit, {
        source: event.source, enteredAt: Infinity, home: false, clicked: false, rank: Infinity, detail: -Infinity,
      });
      const visit = visits.get(event.visit);
      if (event.event === 'entry' && event.ts < visit.enteredAt) {
        visit.enteredAt = event.ts;
        visit.home = event.surface === 'home';
      } else if (event.event === 'rank_click') {
        visit.clicked = true;
        count(clicks, Object.hasOwn(entryNames, event.surface) ? entryNames[event.surface] : '其他榜单入口');
      } else if (event.event === 'rank_view' && event.surface === 'editorial') {
        visit.rank = Math.min(visit.rank, event.ts);
      } else if (event.event === 'detail_view') {
        visit.detail = Math.max(visit.detail, event.ts);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const values = [...visits.values()];
const homeVisits = values.filter(visit => visit.home);
const rankingVisits = values.filter(visit => Number.isFinite(visit.rank));
const detailVisits = values.filter(visit => Number.isFinite(visit.detail));
const clickVisits = values.filter(visit => visit.clicked);
const throughRanking = rankingVisits.filter(visit => visit.detail >= visit.rank);
const sources = new Map();
for (const visit of values) count(sources, Object.hasOwn(sourceNames, visit.source) ? sourceNames[visit.source] : visit.source);
const rate = (n, total) => total ? `${n}/${total}（${(n / total * 100).toFixed(1)}%）` : '暂无样本';
const sorted = entries => [...entries].sort((a, b) => b[1] - a[1]).slice(0, 15);

console.log(`# 必拉榜访问统计\n\n北京时间 ${dateTime.format(since * 1000)} 至 ${dateTime.format(now * 1000)}\n`);
console.log(`- 去重浏览器：${visitors.size}；访问会话：${visits.size}`);
console.log(`- 点过榜单：${clickVisits.length} 次会话；看到全国榜：${rankingVisits.length} 次会话；打开地点详情：${detailVisits.length} 次会话`);
console.log(`- 从首页进入后看到全国榜：${rate(homeVisits.filter(visit => Number.isFinite(visit.rank)).length, homeVisits.length)}`);
console.log(`- 看到全国榜后再打开详情：${rate(throughRanking.length, rankingVisits.length)}`);
console.log('\n| 日期 | 去重浏览器 | 活跃访问 |\n|---|---:|---:|');
for (let offset = days; offset >= 0; offset--) {
  const date = dateKey.format((now - offset * 86400) * 1000);
  const totals = byDay.get(date);
  console.log(`| ${date} | ${totals?.visitors.size ?? 0} | ${totals?.visits.size ?? 0} |`);
}
console.log('\n| 来源 | 访问会话 |\n|---|---:|');
for (const [source, number] of sorted(sources)) console.log(`| ${source} | ${number} |`);
if (!sources.size) console.log('| 暂无 | 0 |');
console.log('\n| 榜单入口 | 点击次数 |\n|---|---:|');
for (const [entry, number] of sorted(clicks)) console.log(`| ${entry} | ${number} |`);
if (!clicks.size) console.log('| 暂无 | 0 |');
console.log(`\n已排除 ${qa} 条测试事件，跳过 ${malformed} 条不完整记录。来源由链接标签或浏览器提供。访客以浏览器估算，会话以同一标签页 30 分钟无操作为界。\n`);
