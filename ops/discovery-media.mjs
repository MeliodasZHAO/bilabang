import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { findPublicPosts, initialInterest, probeBilibiliVideo, publicPost, reviewedFilm, validateCandidate } from './discovery-media-rules.mjs';

const queueFile = new URL('./discovery-media-queue.json', import.meta.url);
const libraryFile = new URL('../src/data/discovery-films.json', import.meta.url);
const queue = JSON.parse(await readFile(queueFile, 'utf8'));
const library = JSON.parse(await readFile(libraryFile, 'utf8'));
const command = process.argv[2] || 'scan';
if (!['scan', 'publish'].includes(command)) throw new Error('用法：node ops/discovery-media.mjs [scan|publish] [线索链接文件]');
const output = new URL('../output/discovery-media/', import.meta.url);
await mkdir(output, { recursive: true });
const deadline = () => AbortSignal.timeout(10000);

async function probePlayer(row) {
  const post = publicPost(row.url);
  if (post.platform === '哔哩哔哩') {
    return probeBilibiliVideo(post, row.review.seconds, deadline());
  }
  if (post.sourceVideo) {
    if (!/<video\b/i.test(await readPublicPage(post.url))) throw new Error('原文未发现播放器');
    return null;
  }
  const url = new URL('https://open.douyin.com/api/douyin/v1/video/get_iframe_by_video');
  url.searchParams.set('video_id', post.id);
  const response = await fetch(url, { signal: deadline() });
  const result = await response.json();
  const payload = result.data;
  if (!response.ok || result.err_no !== 0 || !payload?.iframe_code?.includes('vid=' + post.id) ||
    !Number.isFinite(payload.video_width) || !Number.isFinite(payload.video_height) ||
    payload.video_width <= 0 || payload.video_height <= 0) {
    throw new Error('原站播放器未通过');
  }
  return { width: payload.video_width, height: payload.video_height };
}

async function readPublicPage(url) {
  const response = await fetch(url, { redirect: 'manual', signal: deadline() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let size = 0;
  try {
    while (size < 1_500_000) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      html += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel(); }
  return html;
}

const discovered = new Map();
const known = new Set();
for (const url of [...queue.candidates.map(row => row.url), ...library.map(film => film.original)]) {
  const post = publicPost(url);
  if (post) known.add(post.key);
}
const feedResults = [];
if (command === 'scan') {
  for (const feed of queue.feeds) {
    try {
      const items = findPublicPosts(await readPublicPage(feed.url), feed.url);
      for (const item of items) if (!known.has(item.key)) {
        discovered.set(item.key, { ...item, from: feed.label, triage: initialInterest(item.title) });
      }
      feedResults.push({ source: feed.label, visibleLinks: items.length, status: items.length ? '线索待筛' : '公开页未暴露链接' });
    } catch (error) {
      feedResults.push({ source: feed.label, visibleLinks: 0, status: error.message });
    }
  }
  if (process.argv[3]) {
    const file = await readFile(process.argv[3], 'utf8');
    for (const link of file.match(/https:\/\/[^\s<>"'，。；、)]+/g) || []) {
      try {
        const item = publicPost(link);
        if (item && !known.has(item.key)) discovered.set(item.key, { ...item, from: '导入链接' });
      } catch { /* Invalid URL remains outside the queue. */ }
    }
  }
}

const checked = new Set();
const selected = new Map();
const examined = [];
for (const row of queue.candidates) {
  const errors = validateCandidate(row);
  const id = row.film?.id;
  const post = publicPost(row.url);
  const previous = library.find(film => film.id === id);
  // Fixed IDs keep existing bookmarks stable. Avoid accidental replacement by a different source.
  if (row.status === 'approved' && ((previous && previous.original !== post?.url) || checked.has(post?.key) ||
    library.some(film => film.id !== id && publicPost(film.original)?.key === post?.key))) errors.push('原帖重复或现有 ID 冲突');
  if (row.status === 'approved' && post) checked.add(post.key);
  if (!errors.length) {
    try {
      if (selected.has(id)) throw new Error('片单 ID 重复');
      selected.set(id, reviewedFilm(row, await probePlayer(row)));
    } catch (error) { errors.push(error.message); }
  }
  examined.push({ url: post?.url || row.url, id, status: errors.length ? '搁置' : '通过', notes: errors });
}

const result = {
  checkedAt: new Date().toISOString(), feeds: feedResults, candidates: examined,
  discovered: [...discovered.values()],
  searches: queue.searches.map(keyword => ({
    keyword,
    douyin: `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=video`,
    xiaohongshu: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`,
  })),
};
const reportName = command === 'scan' ? 'review.json' : 'release.json';
await writeFile(new URL(reportName, output), JSON.stringify(result, null, 2) + '\n');
console.log(`发现 ${discovered.size} 条待筛原帖；当前批次 ${selected.size}/${examined.length} 通过。报告 output/discovery-media/${reportName}`);
for (const row of examined) console.log(`${row.status} ${row.id || row.url} ${row.notes.join('；')}`);
if (command === 'publish') {
  if (selected.size !== queue.candidates.filter(row => row.status === 'approved').length) {
    throw new Error('有拟发布项未通过，本次没有写入公开片单');
  }
  const next = [...selected.values(), ...library.filter(film => !selected.has(film.id))];
  await writeFile(libraryFile, JSON.stringify(next, null, 2) + '\n');
  console.log(`已更新本地公开片单：${next.length} 条。构建和部署由现有发布流程处理。`);
}
