export const categories = ['景区', '酒店', '山野', '城市'];

export function publicPost(input) {
  let url;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  // Strip tracking tokens, but keep the canonical platform identifier.
  if (['www.douyin.com', 'douyin.com', 'jingxuan.douyin.com'].includes(url.hostname)) {
    const id = url.pathname.match(/^\/(?:m\/)?video\/(\d{19})\/?$/)?.[1];
    if (id) return { platform: '抖音', key: `douyin:${id}`, url: `https://www.douyin.com/video/${id}`, id };
  }
  if (['www.xiaohongshu.com', 'xiaohongshu.com', 'www.rednote.com', 'rednote.com'].includes(url.hostname)) {
    const id = url.pathname.match(/^\/(?:zh\/)?(?:explore|discovery\/item)\/([0-9a-f]{24})\/?$/i)?.[1]?.toLowerCase();
    if (id) return { platform: '小红书', key: `xhs:${id}`, url: `https://www.rednote.com/zh/discovery/item/${id}`, id };
  }
  const newsrooms = {
    'cbgc.scol.com.cn': ['川观新闻', /^\/news\/\d+$/],
    'www.ctdsb.net': ['极目新闻', /^\/c\d+_\d{6}\/\d+\.html$/],
  };
  const newsroom = Object.hasOwn(newsrooms, url.hostname) && newsrooms[url.hostname];
  if (newsroom && newsroom[1].test(url.pathname)) {
    return { platform: newsroom[0], key: url.hostname + url.pathname, url: url.origin + url.pathname, sourceVideo: true };
  }
  return null;
}

export function findPublicPosts(html, feedUrl) {
  const found = new Map();
  function include(href, title) {
    let item;
    try { item = publicPost(new URL(href, feedUrl)); } catch { return; }
    if (item && (title || !found.has(item.key))) found.set(item.key, { ...item, ...(title && { title }) });
  }
  for (const [, href] of html.matchAll(/href=["']([^"']{1,400})["']/gi)) include(href);
  // The public Douyin topic page also serializes cards instead of using anchors.
  const fields = html.replace(/\\+(?=")/g, '');
  for (const [, title, href] of fields.matchAll(/"text":"([^"\r\n]{1,500})"[^{}]{0,700}?"videoUrl":"([^"]+)"/g)) include(href, title);
  return [...found.values()];
}

export function initialInterest(title) {
  if (!title) return '待人工看标题';
  if (/马桶帐篷|儿童便携|折叠马桶|管道疏通|宝宝外出|便携式户外|马桶清洁剂/.test(title)) return '排除：用品或广告';
  return /景区|民宿|酒店|洗手间|公厕|卫生间|景观厕所|最美厕所/.test(title) ? '优先核片' : '待人工看标题';
}
export function embeddedVideo(post) {
  return post.platform === '抖音' ? `https://open.douyin.com/player/video?vid=${post.id}&autoplay=0` : null;
}

export function validateCandidate(row) {
  if (row.status !== 'approved') return [row.reason || '尚未完成人工核片'];
  const errors = [];
  const post = publicPost(row.url);
  const film = row.film || {};
  const review = row.review || {};
  if (!post || (!embeddedVideo(post) && !post.sourceVideo)) errors.push('缺少可核对的原站播放器');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(film.id || '')) errors.push('缺少稳定片单 ID');
  if (!categories.includes(film.category)) errors.push('缺少分类');
  for (const field of ['city', 'venue', 'title', 'description', 'publisher', 'access']) {
    if (typeof film[field] !== 'string' || !film[field].trim()) errors.push('缺少 ' + field);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(film.date || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(review.checked || '')) errors.push('缺少发布日期或核对日期');
  if (!Number.isFinite(review.seconds) || review.seconds < 0 || !review.shot || !review.distinction) errors.push('缺少可回看实拍时间、画面和入选理由');
  if (review.privacy !== 'clear') errors.push('未通过画面隐私检查');
  try {
    const evidence = new URL(film.evidence);
    if (evidence.protocol !== 'https:' || evidence.username || evidence.password ||
        evidence.port || /(^|\.)(douyin\.com|rednote\.com|xiaohongshu\.com)$/.test(evidence.hostname) || !review.locationMatch) {
      errors.push('缺少独立地点依据');
    }
  } catch { errors.push('缺少独立地点依据'); }
  return errors;
}

export function reviewedFilm(row, player) {
  const post = publicPost(row.url);
  return {
    ...row.film,
    platform: post.platform,
    original: post.url,
    ...(post.sourceVideo ? {} : { embed: embeddedVideo(post), portrait: player.height > player.width }),
    cue: row.review.seconds,
  };
}
