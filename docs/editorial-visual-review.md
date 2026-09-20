# 图片优先修复（2026-09-20，替代下方公开档案方案）

用户明确否定普通档案照片和无图表格：首页恢复原84处特色地点的实拍展示，全国30城以图片卡片为默认入口。5张档案照片和2支宣传片不再占据首页。评分表保留缩略图，详情显示大图、作者和原始来源。

本次按用户要求发布原有来源图片；转载授权没有因此获得确认，manifest的publicationApproved仍全部为false，详情如实标注。署名不被记录为授权。此项属于尚未解决的媒体授权问题。

验证：公开构建通过；HTTP获取84张匹配图片全部200并可解码，合计10,910,642字节。浏览器核实图片卡片、带图表格、TOP30三页和大图详情。没有数据库或用户评分变更。

---
# 公开版发布更新（2026-09-20）

公开构建已改为独立的 PublicEditorial 页面，不再使用研究预览媒体过滤整张榜单。下文“不能部署”描述的是此前研究改版，已由本节方案替代。

- 默认首页展示全国30城标题、真实照片、84处资料入口及30城分项评分表。
- 5张许可核验的 CC BY-SA 4.0 实拍随站发布，保留作者、原图、拍摄日期、修改说明及现状不确定性。
- 2支官方项目影片点击后使用原平台播放器；历史限时项目明确标记，不升格为当前开放推荐。
- 30城榜保留全部资料和原始实拍链接，尚不具备30处全部站内配图；不混配其他地点的照片。
- 无数据库、账号、用户评分或服务器存储语义变更。

验证：生产模式构建通过；84条资料、30个不同城市、5张图片解码及SHA256一致，研究图片未进入构建。浏览器首页有图，城市检索及清空检索、详情和Esc关闭正常，无控制台错误。

---
# 全国30城榜：有图改版审阅

2026-09-20：本次改版仅完成本地审阅，没有推送、合并或部署。生产站仍是之前的版本。

## 已实现

- `/` 默认进入全国30城榜；导航区分全国30城榜、旅人分享、用户评分榜。旧数据未从数据库删除。
- 照片卡片直接展示真实来源预览、城市、排名、综合分及四项评分条。
- 评分对比表含图片、城市、总分、分项分数及比例条，支持按分项排序。
- 大图详情含地址、进入限制、资料日期和摄影署名；原始来源链接保留。
- 搜索、城市筛选、每页12条、图片失败自动退出本次列表、原生对话框与Esc关闭。

## 媒体边界

84处的本地来源预览均已实际加载检查。`src/data/editorial-media.json` 的 `publicationApproved` 目前全部为 `false`，不是公开素材许可。

只有 `editorial-review` 构建会展示这些研究预览。生产模式只接受 `publicationApproved === true` 的媒体。当前没有满足该条件的媒体，因此**不能部署当前改版到公网**，否则会显示待核验空态。不能为完成UI擅自改成true。

主要来源版权声明：https://www.gooood.cn/copyright 。目前需要取得版权方授权或替换为许可明确且匹配同一地点的媒体。已经询问用户是否允许联系申请免费授权，尚未获得回复；未发送外部消息。

## 复现审阅

```powershell
node scripts/content-pipeline/prepare-editorial-review.mjs
$env:VITE_API_ORIGIN='https://api.bilabang.com'
node node_modules/vite/bin/vite.js build --config vite.edgeone.config.js --mode editorial-review --outDir output/editorial-review
node scripts/content-pipeline/prepare-editorial-review.mjs --copy
# 先确认5187空闲；不要停止其他项目服务
node node_modules/vite/bin/vite.js preview --outDir output/editorial-review --host 127.0.0.1 --port 5187 --strictPort
```

研究图片仅复制到被Git忽略的 `output/editorial-review/editorial-media`，不放入public或生产构建目录。审阅模式初次加载不请求生产API。

## 实际验证

- 审阅与生产构建成功；生产构建不能等同于已获发布许可。
- 84张来源预览逐页成功解码，上海筛选8处，前30为30条。
- 模拟首条图片请求失败后列表变29条，恢复请求并刷新后回到30条。
- 表格设计分排序递减，空搜索0结果；详情打开和Esc关闭正常。
- 1440px桌面、390px手机无页面横向溢出；表格使用独立横向滚动区域。
- 首页、/editorial直达、旅人分享切换及返回恢复正常；最后一轮无JavaScript运行错误。

截图：`output/collection-summary/redesign-desktop.png`、`redesign-cards.png`、`redesign-table.png`、`redesign-detail.png`、`redesign-mobile.png`。
