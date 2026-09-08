export const dimensions = ["scenery", "cleanliness", "access", "facilities"];
export function score(reviews, dimension = "overall") {
  const valid = reviews.filter((r) =>
    dimensions.every((k) => Number.isInteger(r[k]) && r[k] >= 1 && r[k] <= 5),
  );
  if (!valid.length) return { count: 0, average: null, rank: null };
  const value = (r) =>
    dimension === "overall"
      ? r.scenery * 0.4 +
        r.cleanliness * 0.3 +
        r.access * 0.2 +
        r.facilities * 0.1
      : r[dimension];
  const average = valid.reduce((s, r) => s + value(r), 0) / valid.length;
  return {
    count: valid.length,
    average: Math.round(average * 10) / 10,
    rank:
      valid.length >= 5
        ? (valid.length * average + 5 * 3.5) / (valid.length + 5)
        : null,
  };
}
