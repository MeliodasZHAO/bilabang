# EdgeOne 上线检查与执行配置

首次检查时间：2026-09-08。本文保留首次迁移审计。2026-09-09 已实现独立 Node 后端、密码登录和迁移工具，当前操作以 [香港生产部署手册](hong-kong-production.md) 为准。仍未部署真实香港服务器或验证正式域名，不能据此宣称正式上线。

## 架构结论

| 项目 | 当前结果 |
|---|---|
| 框架 | React 19.1.1 + Vite 8.2.2，非 Next.js |
| 包管理 | npm + package-lock.json，保持不变 |
| build | `vite build`，普通输出 dist |
| start | `node server.js --production`，是长期运行的 Express 5 服务 |
| dev / preview | `node server.js` / `node server.js --preview`，本地演示身份体系 |
| SSR | 前端是 SPA；本地 Express 另有手写 HTML/SEO 输出，不是 React SSR |
| Server Actions | 无 |
| API | Express `/api/*`；公网另用 Worker `/api/*`，两者数据结构和功能不完全相同 |
| WebSocket | 业务无；开发模式 Vite HMR 使用 WebSocket |
| SQLite / 文件 | 本地路径为 data/bilabang.sqlite 和 data/images；不能作为函数临时磁盘运行 |
| Python / Docker / Cron | 当前仓库无独立 Python 服务、Docker 配置或 Cron |
| 后台任务 | 无独立常驻业务任务；评论的 15 秒同步在浏览器执行 |
| Node 要求 | 根 package.json 未声明 engines；Vite 要求 ^20.19.0 或 >=22.12.0，Wrangler >=22；本地服务使用 node:sqlite |

A：React 页面、CSS、本地字体、已授权静态图片、行政区目录可直接部署 EdgeOne Pages。

B：完整注册/登录、投稿、评论、带图评价、审核及持久数据需要额外后端。目前 Sites Worker 依赖 `env.DB` 的 D1 API、`env.FILES` 的 R2 API、`env.ASSETS` 及受保护的 `oai-authenticated-user-*` 身份头，EdgeOne 不提供这些同名能力。不能信任浏览器自行发送的这组头。

原 Express 服务生产模式主动关闭模拟注册、登录和投稿，而且其评论结构与新版社区不同。不能把 `npm start` 或 `--preview` 直接开放到公网来实现“功能完整”。

## 今天优先的部署路径

前端：`app.真实域名` → EdgeOne Pages，区域选择“全球可用区（不含中国大陆）”。

后端：浏览器通过 HTTPS 请求同一主域名下的 `api.真实域名` → 香港 VPS → SQLite + 持久磁盘图片。

这是为保留多图上传采取的最小调整：Pages 边缘函数文档的请求体限制为 1 MB，云函数为 6 MB，当前应用最多六张图、每张源文件不超过 8 MB。不能未经验证就把完整上传链路转发进函数；浏览器压缩也不保证总包小于限制。若坚持 API 也穿过 EdgeOne，需单独配置支持上传尺寸的源站加速或改为对象存储直传，再做真实请求验证。

香港 VPS 适配方案：复用 worker 的社区业务和现有八表，通过存储适配器连接 SQLite 与本地持久目录；独立身份服务替代 Sites 注入身份。新增认证凭据/会话结构需要按 AGENTS.md 先明确范围。不能直接沿用演示管理员与模拟验证码作为生产身份服务。

VPS 运行 Node 24、HTTPS 反向代理、单实例 SQLite WAL；代码发布目录与数据目录分开，systemd 保持进程运行。图片使用受权限检查的 API 返回；仅上传公开通过的内容可被游客访问。每次更新前备份，部署失败保留上一版本。数据库后续可迁往 PostgreSQL，图片可迁往 COS。

当前尚无 VPS 地址、部署访问权限或已选定的独立登录服务，因此此方案尚未实施，不能声称香港后端已就绪。

## EdgeOne 构建和 GitHub 自动更新

- 仓库：`MeliodasZHAO/bilabang`，私有；仅授权此仓库给 EdgeOne。
- 生产分支：`main`。使用 EdgeOne 原生 GitHub 导入，push 自动触发构建；无需再并行建立重复的 Actions 部署流程。
- 根目录：仓库根目录。框架应自动识别为 Vite。
- 安装：`npm ci`，使用已有 lockfile。
- 构建：`npm run build:edgeone`。
- 输出：`dist/edgeone`。
- Node：`24.5.0`，与官方构建文档的预装版本匹配。
- 区域在控制台选“全球可用区（不含中国大陆）”，不要沿用默认区域。
- `edgeone.json` 已设置构建、输出、缓存和 SPA fallback；官方将 `/* → /index.html` 识别为资源/函数匹配后的 SPA 回退。
- `vite.edgeone.config.js` 不加载 Sites 插件。未配置独立 HTTPS API 地址时构建失败，不把缺少后端的页面冒充完整上线。
- VPS 后端自动更新尚需配置：GitHub Actions 在 main 更新后通过受限部署凭据部署香港服务，并执行健康检查和回滚；凭据只能放 GitHub Secrets，资源准备好后再启用。

## 环境变量清单

| 变量/绑定 | 当前用途 | 去向和保密要求 |
|---|---|---|
| VITE_API_ORIGIN | 新增，香港后端 HTTPS 源站，如 https://api.真实域名 | EdgeOne 构建变量；公开值，会进客户端 bundle，不包含路径、凭据或查询参数 |
| ADMIN_EMAIL | 当前 Sites 管理员身份比对 | 现有 Sites 服务端；不是前端变量，也不能单靠该值在香港后端授予权限 |
| RATE_SALT | 当前 Sites 频率限制哈希盐 | 服务端 secret，迁移后需安全配置；禁止 VITE_ 前缀 |
| DB / FILES / ASSETS | Sites 平台绑定 | 不是普通字符串环境变量，不能复制到 EdgeOne 当作数据库连接 |
| NODE_ENV | 本地 Node 运行模式 | 后端设 production，但原 server.js 会关闭未接入的身份服务 |
| DATA_DIR | 本地持久数据目录 | 香港后端持久路径，不放发布目录或临时目录 |
| PORT | Node 监听端口 | 后端变量，先检查占用；对外经 HTTPS 代理 |
| SITE_URL | 本地 SEO/canonical 正式源站 | 公开配置，填写真正的前端 HTTPS 域名 |
| 未来会话、短信、数据库或存储密钥 | 独立身份与后端配置，尚未引入 | 后端/部署 Secrets，绝不写入 GitHub 源码或客户端 bundle |

无 Google Fonts 外链，字体使用系统字体。地图底图仍请求 OpenStreetMap；该服务在大陆的速度和可达性待实测。不要以文字坐标可用代替地图验收。更换国内地图供应商涉及密钥、授权、底图和坐标系，不能只替换 URL。

前端跨源 API 使用 `credentials: include`。香港服务需严格匹配正式前端 Origin，允许必要方法与 Content-Type，开启 Allow-Credentials，并返回 Vary: Origin；不可使用 `*`。Cookie 用 Secure/HttpOnly/Path=/；app 与 api 采用同一注册域名，避免 Safari 对跨站 Cookie 的额外限制。预览域名登录能力需要单独验证，不能扩大生产 CORS 白名单来省事。

## 数据可导出与迁移证据

线上数据目前位于 Sites 托管 D1/R2，不在 Codex 进程内存。它们依赖平台托管权限，不能假定拥有自己的 Cloudflare API 凭据或任意 SQL 导出接口。

已通过只读接口逐表保存当前八表完整快照到本地忽略目录 `output/migration/edgeone-source-snapshot.json`；每页无截断且无下一页。当前有 7 条地点、1 个用户档案，其他六表为空。快照未进入 Git。

已使用仓库原始 SQL schema 将快照恢复到独立临时 SQLite：integrity_check=ok、foreign_key_check=0，八表数量一致。表结构与 JSON 文本均可迁移，不是不可导出的专有数据结构。此快照不是跨表原子快照，正式切换需停写或再次同步校验。

当前 photos 表为空，因此暂无已登记用户图片需要迁移；R2 全桶枚举与未来非空图片批量导出尚未完成。不能把当前空图片场景的恢复验证说成通用 R2 全量备份。随源码提供的三张来源图片已在 public/sourced。

旧用户 ID 与 Sites 身份关联，切换独立登录必须设计绑定或认领流程，不能把同名账号自动视为同一人。

## DNS 和 HTTPS

真实域名尚未提供，以下记录值必须在控制台生成后填写，不能猜测。

| 用途 | 添加位置 | 类型 | 主机记录 | 值 |
|---|---|---|---|---|
| 前端 | EdgeOne 添加 app.真实域名并关联生产环境；DNS 添加解析 | CNAME | app | EdgeOne 分配的 CNAME，待生成 |
| 域名所有权/证书校验 | DNS | 按控制台要求的 TXT 或 CNAME | 待生成，不能预设 | 待生成 |
| 香港后端 | DNS | A | api | 香港服务器公网 IPv4，待提供 |

如使用根域名，则主机记录为 @，先核对 DNS 服务商对根 CNAME 的支持以及已有 MX/TXT/A 冲突，优先使用 app 子域名节约上线时间。不要把默认项目域名作为正式访问入口。

EdgeOne 支持免费 SSL，完成域名验证后按控制台配置并等待证书状态成功，实测证书链和有效期；不是添加 DNS 就可以直接宣布 HTTPS 正常。香港 api 域名也需单独取得有效证书。

## 验收状态

- 已通过：EdgeOne 模式本地构建；API 错误/超时测试；独立 API Origin、Cookie 与大于 1 MB multipart 内容保留测试；当前数据库恢复验证。
- 编译产物已扫描，无 Sites 登录路由、oai 身份头、localhost 或 chatgpt.site 字符串；此轮构建用 api.example.test 做隔离配置验证，绝不能当作正式部署产物。
- 未完成：EdgeOne 真实构建/自动部署回调、正式域名 DNS/HTTPS、香港后端 API/上传/身份/审核、正式路由刷新以及大陆三网加载。
- Windows Chrome、Android Chrome、iPhone Safari、微信内置浏览器的正式站点验收均待上线资源就绪；桌面缩小视口不等于手机或微信实机测试。
- 官方允许不含大陆区域绑定未备案自定义域名，但不保证每条大陆网络都可用。跨境网络、DNS、地图和身份链路都需实测；不把“免备案区域”解释为全部运营义务已满足。

## 官方依据

- 区域与默认域名：https://edgeone.cloud.tencent.com/pages/document/175191784523485184
- GitHub 集成：https://pages.edgeone.ai/document/importing-a-git-repository
- 配置与 SPA fallback：https://pages.edgeone.ai/document/edgeone-json
- 构建：https://pages.edgeone.ai/document/build-guide
- 请求体与函数限制：https://pages.edgeone.ai/document/limits-and-quotas
- Cloud Functions 香港地域：https://pages.edgeone.ai/document/cloud-functions
- 域名与证书：https://pages.edgeone.ai/document/custom-domain
