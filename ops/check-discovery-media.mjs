import { readFile } from 'node:fs/promises';

// Checks known editorial links. A working link is not a new publication decision.
const films = JSON.parse(await readFile(new URL('../src/data/discovery-films.json', import.meta.url)));
for (const film of films) {
  try {
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
