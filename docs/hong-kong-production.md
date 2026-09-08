# 香港服务器生产部署

更新：2026-09-09。独立后端已实现，尚未部署到真实香港服务器。

## 运行方式

- Node 24，Ubuntu 24.04 LTS，单实例 SQLite WAL。npm 和 package-lock.json 保持不变。
- 后端：`npm run start:production` → `server/production.mjs`。不要使用旧 `npm start` 或 `--preview`。
- 复用 Worker 社区业务，通过 SQLite/持久文件适配器运行；不需要 Sites D1/R2 或 ChatGPT 身份头。
- `app.bilabang.com` → EdgeOne；`api.bilabang.com` → 香港服务器 Caddy → 127.0.0.1:5188。
- EdgeOne 安装 `npm ci`、构建 `npm run build:edgeone`、输出 `dist/edgeone`；生产分支 `main`，区域不含中国大陆。
- `VITE_API_ORIGIN=https://api.bilabang.com` 是公开构建变量，其他后端密钥不能使用 VITE_ 前缀。

## 已确认并实施的账户方案

用户名＋密码登录；凭据与会话单独存储于 `auth_credentials`、`auth_sessions`，不修改原八张社区表的语义。密码为随机盐＋scrypt，Cookie 是 HttpOnly/Secure/SameSite=Lax，数据库只存会话 token 的哈希。用户名大小写与全角差异归一化；注册请求不能选择管理员角色。用户名公开可见，当前无自助密码找回，管理员可在服务器核验用户后重置并撤销旧会话。

游客可投稿，注册后可评论、补图和评分；审核通过后公开，浏览器每 15 秒更新评论。没有新增短信服务或 AI 审核；用户名密码登录不等于手机号或实名核验。点赞、收藏不属于本次认证表迁移，仍未实现。

旧 Sites 用户资料保留，不能通过同名注册认领。旧生产数据库不会被本地开发自动修改。首版默认不创建任何管理员，也不自动导入示例数据。

## 服务器创建后需要的信息

公网 IPv4、操作系统版本和 SSH 公钥授权。不要在聊天中粘贴 root 密码或私钥。
安全组放行 TCP 80/443，SSH 22 限制来源；只需一台香港 Linux 服务器，不必另购数据库或付费证书。
安装前检查全部监听端口；若 5188、80 或 443 已由其他业务使用，先调整配置，不能停止其他服务腾端口。

先安装/复用 Node 24 与 Caddy：
- Node：[官方下载](https://nodejs.org/en/download)，使用仍维护的 Node 24 补丁版本并验证发行校验和。
- Caddy：[官方 Ubuntu 安装说明](https://caddyserver.com/docs/install#debian-ubuntu-raspbian)。包安装可能启动服务，必须先检查 80/443。

在源码目录，以 root 运行一次性准备（部署公钥文件先放到服务器）：

```sh
bash ops/setup.sh https://app.bilabang.com https://api.bilabang.com /root/bilabang-deploy.pub
```

该脚本拒绝覆盖已存在的专用配置/账户，不安装软件包，不覆盖 Caddy 配置，不启动网站。它生成随机 RATE_SALT、解析 Node 路径、建立专用用户/目录和有限 sudo 规则。
服务目录：

```text
/opt/bilabang/incoming/           GitHub 上传源码包
/opt/bilabang/releases/<commit>/  各版本源代码及生产依赖
/opt/bilabang/current             当前版本链接
/opt/bilabang/backups/            每次部署前备份，需再复制到独立存储
/var/lib/bilabang/                数据库和 photos/*.jpg
/etc/bilabang/production.env      仅 root/服务用户可读的变量和密钥
```

## 首次迁移和管理员

正式切换前重新导出 Sites，或先停写再导出。已有快照不是跨表原子快照；不应作为日后切换时的最新数据。非空 photos 必须先导出全部对应 JPEG，再执行导入。
以服务用户执行，下方目标必须不存在：

```sh
node server/transfer.mjs import /secure/source-snapshot.json /var/lib/bilabang-imported /secure/exported-files
```

目标父目录需赋予服务用户权限；也可先导入其有权限的暂存路径。检查输出和数量后，在服务停止状态下由管理员把验证后的目录指定为 DATA_DIR 或替换空的初始数据目录，并同步 systemd 的 ReadWritePaths 和部署脚本的路径检查。导入程序自身绝不覆盖现有数据库。空 photos 表可以省略最后一个参数。

在配置前端正式公开之前，初始化管理员。密码由终端静默读取，不写命令历史：

```sh
read -r -s -p 'Admin password: ' admin_password
printf '%s\n' "$admin_password" | DATA_DIR=/var/lib/bilabang node server/admin.mjs create Meos
unset admin_password
```

已存在管理员时再次初始化会失败。重置账户密码使用同样的 stdin 方法，把 `create` 换成 `reset-password`；需要先通过可靠方式确认申请者身份。账户名相同并不是旧 Sites 账户所有权证明。

## GitHub 自动部署

`.github/workflows/hong-kong.yml` 已准备，默认跳过，不消耗部署作业分钟。服务器就绪后配置：

| 配置 | 位置 | 含义 |
|---|---|---|
| HK_SSH_HOST | GitHub Secrets | 香港服务器地址 |
| HK_SSH_PRIVATE_KEY | GitHub Secrets | 仅用于 bilabang 用户的 SSH 私钥 |
| HK_SSH_KNOWN_HOSTS | GitHub Secrets | 已通过服务器控制台核验的 SSH host key，不能盲信网络扫描结果 |
| HK_DEPLOY_ENABLED=true | GitHub Variables | 最后开启；此后 main push 自动部署 |

首次也可手动触发 workflow_dispatch。发布在服务器上使用 `npm ci --omit=dev`，运行独立 HTTP 和迁移测试，然后停止专用服务、备份当前数据、切换代码链接并检查健康状态。失败恢复上一版本代码，不覆盖数据库；首发失败保持停服。
当前数据库版本 1，未来不兼容迁移不得依赖自动代码回滚。备份和旧版本不会自动删除，需要根据实际磁盘占用制定保留策略。SSH 端口默认 22；改端口需同步 workflow。服务器无需保存 GitHub 仓库 token。

## DNS、HTTPS 和验收

app CNAME 使用 EdgeOne 实际分配值；api A 使用服务器 IPv4。首次检查域名审核状态，不能把已购买等同于已可解析。
`ops/Caddyfile` 使用 API_DOMAIN 环境变量；配置 Caddy systemd 的对应环境或将模板替换为确切域名，先 `caddy validate`，检查现有站点后再合并启用。TLS 自动签发仍需要 DNS 正确、80/443 可达，最后验证证书链。

```sh
node ops/preflight.mjs
node ops/smoke.mjs https://app.bilabang.com https://api.bilabang.com
```

预检需先加载 production.env；只读 smoke 检查首页、静态资源、SPA fallback、API/CORS 和匿名身份，不创建线上账户或数据。

备份/恢复（恢复目标必须不存在）：

```sh
node server/transfer.mjs backup /var/lib/bilabang /secure/new-backup
node server/transfer.mjs verify /secure/new-backup
node server/transfer.mjs restore /secure/new-backup /secure/restored-data
```

新备份工具支持 Worker 的 photos/*.jpg 与账户凭据，不能使用旧 scripts/backup.js 的 WebP 备份格式。数据快照和备份包含私密信息，只保存在受控目录，不进 GitHub。

## 验证边界

已在本地 Node 24 通过真实 HTTP 测试：注册/登录、伪造身份头拒绝、跨源请求拒绝、超过 1MB 的无扩展名 JPEG multipart、评论审核前后权限、重复请求、评分、游客投稿/审核、退出、重启持久化、事务失败回滚、管理员 CLI、包含 JPEG 与凭据的备份恢复。
旧 Sites 快照在独立本地目录导入、备份、恢复成功；没有改生产数据。
本轮完整回归 34 项通过；另在仅 `npm ci --omit=dev` 的干净目录使用 Node 24.19.0 重跑独立 HTTP、生产入口、备份和管理员测试，确认无需 Vite/Sites 开发依赖。部署 shell 脚本通过 Bash 语法检查；这不等于 Linux systemd/Caddy 已实测。
尚待实际服务器：Ubuntu/systemd/Caddy 安装运行、GitHub SSH 自动部署和失败回滚、正式 DNS/HTTPS、Windows/Android/iPhone/微信实机、国内运营商网络与地图资源。不能将本地测试标成公网或移动端已验收。
