# 必拉榜访问统计

统计仅对 bilabang.com 启用。事件通过同源 POST 写入 Caddy 专用访问日志，不接第三方统计，不使用业务 API 或数据库。日志每天轮转，共保留约 14 天。Caddy 的日志编码器会去掉请求、响应头和用户标识，只留下事件、入口、来源、随机访客和会话号，以及请求时间和状态。

| 事件 | 口径 |
|---|---|
| `entry` | 浏览会话开始，记录进入页面和来源。标签页 30 分钟没有新的统计行为就开始新会话。 |
| `home_view` | 首页渲染。用来验证首页加载正常。 |
| `rank_click` | 点击导航、首页 30 城入口、城市排名或全部地点。 |
| `rank_view` | 城市榜或用户评分榜渲染完成。直达城市榜也会记录。 |
| `detail_view` | 打开编辑精选详情或社区地点详情，含分享直达。 |

访客是浏览器估算，不等于真实人数。来源优先读取常见渠道的 `utm_source`，其次使用浏览器给出的域名。没有来源的访问统一计为「直接访问或来源未提供」。复制到群里时可使用 `https://bilabang.com/?utm_source=wechat`。小红书用 `xiaohongshu`、抖音用 `douyin`。转发前不标记且应用隐藏来源时，无法还原渠道。

访问统计尊重 DNT、GPC 和隐私说明页中的关闭选项。验收从 `https://bilabang.com/?traffic_test=1` 进入，在该标签页后续的事件均标记为 `qa`，在复盘中排除。已进入正式日志的验收会话可在受保护的 `/var/log/caddy/bilabang-traffic-qa-visits.txt` 中按行登记会话号，报表会排除对应事件。

## 查看报表

经现有 SSH 连接在服务器执行：

```sh
sudo -n /usr/local/bin/node /opt/bilabang/traffic/traffic-report.mjs /var/log/caddy 4
```

最后一个数字是最近 1–14 天，报表按北京时间列出每日浏览器数与活跃访问、来源、榜单入口及页面转化。它只输出汇总，不导出随机标识。在样本很少时优先报告绝对数。

## 部署与回退

将 `ops/Caddyfile.traffic` 安装到 `/etc/caddy/Caddyfile.traffic`。按 `ops/Caddyfile.hong-kong` 合并必拉榜站点配置，保留服务器上其他站点。用 `caddy validate --config /etc/caddy/Caddyfile` 校验，再 reload。将报表脚本安装到 `/opt/bilabang/traffic/traffic-report.mjs`，仅运营人员通过服务器读取。保留上一版 Caddyfile；回退时恢复并 reload。前端按原流程构建发布。
