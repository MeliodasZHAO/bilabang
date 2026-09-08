const sh='https://lhsr.sh.gov.cn/ywdt/20250915/f55be891-8ead-4cb9-9846-9e18c07f9751.html';
const tokyo='https://tokyotoilet.jp/en/';
export default [
 ['sh-waterdrop','一滴水公厕','CN-310109','上海市虹口区东大名路588号','蓝白水滴主题的公共厕所，位于北外滩附近。2025年官方报道介绍了外观与内部主题改造，适合作为滨江漫步中的一站。',sh,'上海市绿化和市容管理局'],
 ['sh-zhapu','乍浦路258号公厕','CN-310109','上海市虹口区乍浦路258号','红砖立面呼应周边历史建筑。官方改造报道收录了这处街区公厕；目前入口细节与营业时间仍待到访者补充。',sh,'上海市绿化和市容管理局'],
 ['sh-daduhe','大渡河路1576号公厕','CN-310107','上海市普陀区大渡河路1576号','2025年上海最美公厕获奖地点之一，以白色拱门与竹意象结合真如街区环境。奖项属于历史记录，不代表当前卫生评分。','https://www.shanghai.gov.cn/nw17239/20251118/99be95942177460abb887e36fb26c8d8.html','普陀区人民政府 / 上海市政府'],
 ['tokyo-shoto','锅岛松涛公园厕所','JP-13113','2-10-7 Shoto, Shibuya, Tokyo','THE TOKYO TOILET 项目收录，设计者为隈研吾。位于锅岛松涛公园，适合关注公共建筑与城市绿地的旅行者。',tokyo,'THE TOKYO TOILET'],
 ['tokyo-jingu','神宫通公园厕所','JP-13113','6-22-8 Jingumae, Shibuya, Tokyo','THE TOKYO TOILET 项目收录的安藤忠雄设计作品，位于神宫通公园。地址由项目官网提供，具体入口有待实地补充。',tokyo,'THE TOKYO TOILET'],
 ['no-uredd','Ureddplassen 海岸休息区厕所','NO-1838','Ureddplassen, Helgelandskysten, Norway','休息区面向峡湾与海岸，官方资料确认设有全年开放的厕所，并标注轮椅可达。下方坐标是休息区参考点，不是已确认的厕所入口。','https://www.nasjonaleturistveger.no/en/routes/helgelandskysten/ureddplassen/','挪威国家旅游公路 / Statens vegvesen',66.950328,13.631716,'Ureddplassen 休息区','全年开放，具体时段待核实'],
 ['no-stegastein','Stegastein 观景台厕所','NO-4641','Stegastein, Aurland, Norway','厕所建筑临崖设置，面向峡湾景观。官方资料区分了全年可达的观景台与季节开放的厕所；出发前请再次确认。','https://www.nasjonaleturistveger.no/no/turistvegene/aurlandsfjellet/stegastein/','挪威国家旅游公路 / Statens vegvesen',60.90836182,7.21279388,'Stegastein 观景台','五月初至十月底（以现场为准）'],
].map(([importKey,name,regionId,address,description,sourceUrl,publisher,lat,lng,landmark,hours])=>({importKey,name,regionId,address,description,sourceUrl,publisher,lat:lat??null,lng:lng??null,landmark:landmark||'',hours:hours||'',locationMode:lat==null?'text':'reference',template:'source',checkedAt:'2026-09-08',consent:true}));
