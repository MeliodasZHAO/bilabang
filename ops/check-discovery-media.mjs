import { readFile } from 'node:fs/promises';
import { probeBilibiliVideo, publicPost } from './discovery-media-rules.mjs';

// Checks known editorial links. A working link is not a new publication decision.
const films = JSON.parse(await readFile(new URL('../src/data/discovery-films.json', import.meta.url)));
for (const film of films) {
  try {
    if (!film.embed) {
      const post = publicPost(film.original);
      if (!post?.sourceVideo) throw new Error('缺少支持的公开原文播放器');
      if (post.platform === '哔哩哔哩') {
        await probeBilibiliVideo(post, film.cue, AbortSignal.timeout(8000));
        console.log(`通过  ${film.id} · 原帖及核片时间可核对`);
        continue;
      }
      const original = await fetch(post.url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
      if (!original.ok || !/<video\b/i.test(await original.text())) throw new Error('原文播放器未找到');
      console.log(`通过  ${film.id} · 原文包含视频`);
      continue;
    }
    const embed = new URL(film.embed);
    if (embed.hostname === 'open.douyin.com') {
      const id = embed.searchParams.get('vid');
      const url = 'https://open.douyin.com/api/douyin/v1/video/get_iframe_by_video?video_id=' + encodeURIComponent(id);
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await response.json();
      if (!response.ok || data.err_no !== 0 || !data.data?.iframe_code) throw new Error('官方接口未返回可用播放器');
      console.log(`通过  ${film.id} · 抖音官方播放器`);
    } else {
      const response = await fetch(embed, { signal: AbortSignal.timeout(8000) });
      await response.body?.cancel();
      if (!response.ok) throw new Error('播放器页面响应 ' + response.status);
      console.log(`通过  ${film.id} · 播放器页面可达，实际播放仍依赖平台`);
    }
  } catch (error) {
    process.exitCode = 1;
    console.log(`复核  ${film.id} · ${error.message}`);
  }
}
