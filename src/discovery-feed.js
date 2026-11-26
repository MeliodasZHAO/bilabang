export function regionPicks(places, region, trending = [], limit = 4) {
  if (!region?.province) return [];
  const order = new Map(trending.map((id, index) => [id, index]));
  return places.filter(place => place.province === region.province).sort((a, b) =>
    Number(b.city === region.city) - Number(a.city === region.city) ||
    (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) ||
    b.editorial.score - a.editorial.score || a.name.localeCompare(b.name, 'zh')
  ).slice(0, limit);
}

export function nationwidePicks(places, featured, trending = [], limit = 4) {
  const byId = new Map(places.map(place => [place.id, place]));
  const seen = new Set();
  return [...trending.map(id => byId.get(id)), ...featured].filter(place => {
    if (!place || seen.has(place.city)) return false;
    seen.add(place.city);
    return true;
  }).slice(0, limit);
}
