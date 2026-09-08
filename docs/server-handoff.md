# 香港服务器接入准备

更新：2026-09-09。这里是配置模板和检查工具，不是已经上线的证明。

## 购买参数

- 地域：中国香港。操作系统：Ubuntu 24.04 LTS，x86_64。
- 一台即可；初期数据库和图片放持久磁盘，代码另放发布目录。
- 需要公网 IPv4。对外 TCP 80/443；SSH 22 限制管理来源。
- 不必购买数据库或付费 SSL。带宽、月流量、续费价以实际订单为准。
- 不在聊天里发送 root 密码或私钥。服务器创建后提供公网 IP、系统版本，通过 SSH 公钥授权部署。

## 已准备与剩余工作

| 项目 | 状态 |
|---|---|
| EdgeOne Vite 构建、SPA fallback、独立 API 地址 | 已有 |
| HTTPS 代理 | ops/Caddyfile 模板，尚未在 Linux Caddy 校验和部署 |
| systemd 守护和持久目录隔离 | ops/bilabang.service 模板，尚未安装 |
| 环境变量与端口预检 | ops/preflight.mjs；只读，不创建数据库 |
| 正式地址只读验收 | ops/smoke.mjs；检查 HTML/静态资源/fallback/API/CORS/匿名身份 |
| 独立后端 | 未完成，server/production.mjs 尚不存在；预检会拒绝启动 |
| 独立注册、登录和管理员初始化 | 等待账户与数据库方案确认 |
| 数据导入、图片导出与恢复 | 旧版已有快照验证；新的生产备份还需匹配 Worker 图片结构 |
| 后端 GitHub 自动部署和回滚 | 待后端入口就绪后实现；不放一个调用不存在入口的自动部署流程 |
| DNS/证书/正式手机及大陆网络 | 服务器和 EdgeOne 资源就绪后验证 |

不能使用原来的 server.js --preview 替代生产后端。它包含演示账户和模拟验证码。
不能使用 scripts/backup.js 备份 Worker 迁移后的图片；该脚本目前对应旧版 images/*.webp，线上 Worker 使用 photos/*.jpg。

## 确认中的认证范围

首版拟使用用户名和密码；密码使用带独立随机盐的慢哈希，不保存明文。凭据和会话与社区资料分表；会话 Cookie 为 HttpOnly、Secure，严格校验 Origin 并限制登录尝试。
游客仍可投稿，注册用户才能评论和评分；公开前走现有审核。现有八张社区表保留，新增认证凭据与会话表。Sites 用户不按同名自动合并。管理员通过服务器本地初始化，不能由注册接口选择角色。
这是待确认方案，不代表已经新增表、已经完成实名验证或已经获得生产数据迁移授权。若采用手机验证还需要短信服务、签名/模板和费用配置。

## 服务器目录与代理

```text
/opt/bilabang/releases/<commit>/  不可混入数据的代码版本
/opt/bilabang/current            指向当前版本
/var/lib/bilabang/               专用服务用户可写的数据库和图片
/etc/bilabang/production.env     仅服务用户/root 可读的配置和密钥
```

Node API 只监听 127.0.0.1:5188；Caddy 处理 api.bilabang.com 的 TLS。若端口占用，更换应用 PORT 和 Caddy upstream 两处，不能停止其他项目。
模板使用 /usr/bin/node；安装后用 command -v node 核实实际路径并调整。安装 systemd 单元前运行 systemd-analyze verify；启用 Caddy 前运行 caddy validate。当前 Windows 环境未执行这两项 Linux 检查。
推荐前端 app.bilabang.com、API api.bilabang.com；需要先确认 .com 的域名命名审核已结束。更换为 .cloud 时必须同时修改前端/API 两端配置，不能混用跨站 Cookie。

## 上线检查

在服务器以服务用户加载正式环境后运行：

```sh
node ops/preflight.mjs
```

正式域名解析、证书和后端就绪后运行：

```sh
node ops/smoke.mjs https://app.bilabang.com https://api.bilabang.com
```

任一检查失败返回非零状态。该检查不写线上数据，也不证明注册、上传或手机实机可用。正式发布仍需单独验证：注册 → 登录 → 游客投稿 → 管理员审核 → 注册用户带图评论 → 审核 → 第二个用户看到结果；刷新和重启后数据仍存在。
必须使用扩展名缺失的临时上传文件验证真实 HTTP multipart，不只测浏览器表单。大陆运营商、Android Chrome、iPhone Safari、微信浏览器均需要真实环境结果，不能用桌面视口代替。

## 外部配置待填项

- EdgeOne 仅授权 GitHub 仓库 MeliodasZHAO/bilabang，生产分支 main。
- 区域：全球可用区（不含中国大陆）；安装 npm ci；构建 npm run build:edgeone；输出 dist/edgeone。
- VITE_API_ORIGIN=https://api.bilabang.com。此变量公开，不能包含密钥。
- app 的 CNAME：以 EdgeOne 实际生成值为准；api 的 A：服务器公网 IPv4。
- GitHub 后端部署密钥：后端方案完成后配置；限制服务器权限，固定主机指纹，不能 StrictHostKeyChecking=no。
- 所有生产密钥仅存服务器配置/GitHub Secrets；本文件和 .example 文件均不保存真实值。
