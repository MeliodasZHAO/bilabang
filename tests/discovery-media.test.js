import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findPublicPosts, initialInterest, publicPost, reviewedFilm, validateCandidate } from '../ops/discovery-media-rules.mjs';

test('public cards and sharing URLs deduplicate without keeping tracking tokens', () => {
  const id = '7635072537177415273';
  const feed = 'https://www.douyin.com/topic/7625397692553840681';
  const html = `<a href="/video/${id}?source=abc">线索</a>\\"text\\":\\"铜铃山景区公厕\\",\\"videoUrl\\":\\"https://www.douyin.com/video/${id}\\"`;
  const posts = findPublicPosts(html, feed);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, `https://www.douyin.com/video/${id}`);
  assert.equal(initialInterest(posts[0].title), '优先核片');
  assert.equal(initialInterest('便携式户外折叠马桶'), '排除：用品或广告');
  assert.equal(publicPost('https://www.douyin.com.example.org/video/' + id), null);
  assert.equal(publicPost('https://www.xiaohongshu.com/explore/69ec9171000000003601fd46?xsec_token=abc').key, 'xhs:69ec9171000000003601fd46');
  const bilibili = publicPost('https://www.bilibili.com/video/BV1aa411279j?t=85');
  assert.equal(bilibili.url, 'https://www.bilibili.com/video/BV1aa411279j/');
  assert.equal(bilibili.sourceVideo, true);
});

test('approval requires a verified location and reviewed footage', async () => {
  const { candidates } = JSON.parse(await readFile(new URL('../ops/discovery-media-queue.json', import.meta.url)));
  const accepted = candidates.filter(item => item.status === 'approved');
  assert.ok(accepted.length);
  for (const row of accepted) {
    assert.deepEqual(validateCandidate(row), []);
    assert.ok(validateCandidate({ ...row, review: { ...row.review, locationMatch: '' } }).length);
    assert.ok(validateCandidate({ ...row, review: { ...row.review, privacy: 'unknown' } }).length);
    const film = reviewedFilm(row, { width: 1080, height: 1920 });
    assert.equal(film.cue, row.review.seconds);
    if (publicPost(row.url).sourceVideo) assert.equal(film.embed, undefined);
  }
  assert.ok(candidates.filter(row => row.status !== 'approved').every(row => validateCandidate(row).length));
});
