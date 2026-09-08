const photo = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`;
export const demoPlaces = [
  {
    id: "demo-1",
    name: "山林之间，暂停一下",
    country: "挪威",
    city: "山林旅行灵感",
    scene: "山林",
    image: photo("photo-1511497584788-876760111969"),
    description:
      "如果旅途需要一个暂停键，希望窗外是山、是水，还有慢慢经过的云。",
    demo: true,
    preview: true,
  },
  {
    id: "demo-2",
    name: "雪山脚下的片刻宁静",
    country: "瑞士",
    city: "山岳旅行灵感",
    scene: "雪山",
    image: photo("photo-1464822759023-fed622ff2c3b"),
    description: "把赶路的节奏放慢一点，留一点时间给远处的山峰。",
    demo: true,
    preview: true,
  },
  {
    id: "demo-3",
    name: "海风经过的地方",
    country: "日本",
    city: "海岸旅行灵感",
    scene: "海岸",
    image: photo("photo-1473116763249-2faaef81ccda"),
    description: "沿着海岸走，寻找可以听见浪声的小小停靠点。",
    demo: true,
    preview: true,
  },
  {
    id: "demo-4",
    name: "走进森林的留白",
    country: "中国",
    city: "山野旅行灵感",
    scene: "森林",
    image: photo("photo-1441974231531-c6227db76b6e"),
    description: "树影、鸟鸣与清新的空气，构成旅途中意外的记忆。",
    demo: true,
    preview: true,
  },
];
