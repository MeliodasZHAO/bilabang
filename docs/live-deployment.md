# 实际上线状态 · 2026-09-09

正式主入口：https://bilabang.com/ 。bilabang.cn、www 和旧 .cloud 前端域统一跳转到 .com，保留路径和查询条件。API：https://api.bilabang.com/api/health 。

## 当前拓扑

浏览器 → 香港 124.156.183.146 / Caddy → 静态前端，API → Node 24.20.0 → SQLite WAL 与本地图片。用户凭据、会话和社区数据分表，暂共用同一个数据库文件。数据不在 GitHub 或 Codex 临时环境。

EdgeOne 尚未部署：腾讯 EO Makers 的 GitHub OAuth Authorize 按钮持续不可用，已请用户手动完成。为了当日可用，启用香港静态托管 fallback。不要将此状态报告成 EdgeOne 已上线。

## DNS 与 HTTPS

DNSPod 中 bilabang.com / bilabang.cn 的 @、www，以及 api.bilabang.com 均为 A → 124.156.183.146，TTL 600；旧 .cloud 记录保留用于跳转。Caddy 自动签发和续期 HTTPS；云防火墙 TCP 80/443 已放行。Caddy 配置见 ops/Caddyfile.hong-kong。

## GitHub 自动更新

仓库 MeliodasZHAO/bilabang，main push 触发 .github/workflows/hong-kong.yml。
部署 94dc2d1 已由实际 push 自动完成，Actions run 34262938639 成功，服务器当前静态版本与后端版本一致。

- Variables：HK_DEPLOY_ENABLED=true、HK_HOST_FRONTEND=true、FRONTEND_API_ORIGIN=https://api.bilabang.com。
- Secrets：HK_SSH_HOST、HK_SSH_PRIVATE_KEY、HK_SSH_KNOWN_HOSTS，均已配置，私钥不在仓库。
- npm ci；npm run build:edgeone；dist/edgeone；Node 24。
- VITE_API_ORIGIN 是唯一必要的公开构建变量；后端 RATE_SALT、SSH 私钥、数据库文件及会话绝不能打进前端。
- 后端环境在 /etc/bilabang/production.env；DATA_DIR=/var/lib/bilabang；HOST=127.0.0.1；PORT=5188；SITE_URL/API_ORIGIN 分别为正式 bilabang.com / api.bilabang.com HTTPS 域名。
- /usr/local/bin/bilabang-deploy 是 root 安装副本；修改 ops/deploy.sh 后需由运维显式更新此副本。
- 每次部署前备份；数据库与图片保留在版本目录外。备份在同机 /opt/bilabang/backups，尚未设置异地定时备份。

## 数据与验证

旧 Sites 的 7 个地点与 1 条历史用户资料已导入；导入时评论和图片记录为零。旧站没有删除。新管理员已初始化，凭据不写入文档。

Linux 实际发行包测试覆盖注册、登录、权限、无扩展名大图上传、游客投稿、评论审核与公开、评分、重启持久性、备份恢复。测试使用隔离数据库，不向真实景点发布虚假到访记录。

公网 Windows Chrome 已验证登录、会话保留、地点详情直达与评论表单。实际 HTTPS 检查首页、JS、CSS、本地图片、API 和 SPA fallback 均返回 200。构建 JS 未检出 localhost、127.0.0.1 或 ChatGPT Sites URL。

尚未实测 Android Chrome、iPhone Safari、微信真机或关闭 VPN 的各大陆运营商网络；不能承诺全国访问质量。地图底图仍使用 OpenStreetMap，境内可能加载不稳定，已有文字路线及手动坐标兜底。

评论和投稿人工审核后公开，页面每 15 秒同步；AI 审核、点赞收藏尚未实现，用户名密码也不等于实名验证。

## 后续切换 EdgeOne

完成 GitHub 授权后选择该仓库、main、全球可用区（不含中国大陆）；npm ci / npm run build:edgeone / dist/edgeone；设置 VITE_API_ORIGIN=https://api.bilabang.com。
绑定 bilabang.com，按控制台返回的实际 CNAME 替换主站 @ A 记录，完成可能要求的 TXT 验证和 HTTPS。CNAME 值目前尚未生成，不能预填。api A 保持不变，数据无需移动。确认 EdgeOne 成功后将 HK_HOST_FRONTEND=false。

## 本次界面与域名调整

- 投稿独立页面 /share，四步流程保留；回退/前进和直达均可恢复页面，切换步骤移动到当前标题。草稿按浏览器域名隔离，旧 .cloud 草稿不会自动移到 .com。
- 卡片增加实际正文容器，统一留白、标题、摘要与底部对齐；详情重新组织看点、路线、设施和评分区。
- 一个地点仍最多上传 6 张，每张 8 MB；评论也可补充最多 6 张。来源封面与上传照片统一展示，逐图切换说明与署名，支持缩略图、前后切换、原图链接。
- 用户凭据、会话表与社区表保持原样；域名 Cookie 隔离，切换后需重新登录，不需要重新注册。
- 构建与 36 个本地测试通过；包含来源封面 + 上传图的展示回归测试。隔离测试并非公众并发容量保证。