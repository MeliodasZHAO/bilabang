import catalog from './data/editorial-places.json';
import media from './data/editorial-media.json';

export const editorialDate = catalog.asOf;
export const editorialRecords = catalog.records.flatMap(record => {
  const photo = media[record.id];
  if (!photo?.src) return [];
  return [{
    ...record,
    media: {
      ...photo,
      author: photo.author?.split(/\s*(?:联系邮箱|Project Name:)\s*/)[0]?.trim(),
    },
  }];
});

export const cityRanking = editorialRecords.filter(record => record.rank)
  .sort((a, b) => a.rank - b.rank);

export const stopUrl = record => `/editorial?stop=${encodeURIComponent(record.id)}`;
export const cityUrl = city => `/editorial?city=${encodeURIComponent(city)}#city-leaderboard`;

const picks = [
  [11, '隔着一面镜子，看见整片湖', '湖畔', '沿着嘉兴银杏天鹅湖走，远处几座白塔映在水面上。走近才知道，里面用潜望镜的原理把湖景带入室内。'],
  [6, '海岸边，捡到一只巨型海螺', '滨海', '在万宁神州半岛，海螺一样的曲墙围出休息区，走到沙滩边就能看到。'],
  [2, '松林里，给自己留一扇窗', '山林', '南京四方艺术湖区的洗手间藏在停车场旁的松林里。这里用玻璃把树林框进了室内。'],
  [23, '顺着红色栈道，走进河谷', '村落', '在秦皇岛石城子村，一条弯折的栈道沿河伸入树林，接上山脚下的红顶公厕。'],
  [16, '老街拐角，藏着一间红砖房', '老街', '从留坝县游客服务中心望过去，红砖和木屋架组成了这座现代公厕。'],
];

export const featuredStops = picks.flatMap(([rank, headline, theme, story]) => {
  const record = cityRanking.find(place => place.rank === rank);
  return record ? [{ ...record, headline, theme, story }] : [];
});
