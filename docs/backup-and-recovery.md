# 备份与恢复

使用 Node 内置 SQLite 生成一致快照，不直接复制仍有 WAL 写入的数据库文件。备份包含数据库及其中引用的用户上传图片，manifest.json 记录每个文件的大小和 SHA-256。校验会检查 SQLite 完整性、关联完整性及图片清单。没有 manifest 的目录视为未完成备份，不可用于恢复。

在项目根目录执行：

```powershell
node scripts/backup.js create data output/backups/my-new-backup
node scripts/backup.js verify output/backups/my-new-backup
node scripts/backup.js restore output/backups/my-new-backup output/my-new-restored-data
```

create 与 restore 都拒绝覆盖已有目录。verify 失败时不会开始恢复。不要将“删除原数据目录”作为恢复步骤；先恢复到新目录，验证后再安排服务切换。脚本不会切换正在运行服务的 DATA_DIR，也不会修改原库。切换生产数据需另行获批。

备份包含账号哈希、会话等私有数据，不能放入 public 或公开文件服务。output 已在 gitignore；上线后应把备份存到限制权限的独立存储，并按运营保留规则轮换。当前脚本不提供加密或自动异地复制，不代表已经具备灾备。

## 恢复验收

1. 保留与备份对应的应用版本、依赖锁文件、public/sourced 的授权资料图片及来源清单。资料图片是应用资产，不属于数据库上传图片；应随发布产物保存。
2. verify 校验备份；restore 到不存在的新目录。
3. 使用独立端口和该目录启动测试实例，验证地点数量、实际图片读取、身份模式、回执及审核记录。勿与现有服务共用数据目录。
4. 记录验收结果、备份时间及恢复耗时。只有经授权的维护窗口才切换正式服务目录。

## 2026-09-08 演练证据

- 运行中的主数据库备份到 output/backups/release-rehearsal-20260908，数据库校验通过。
- 恢复到 output/restore-rehearsal-20260908；以 PORT=0 启动独立正式只读实例，实际分配 21222。
- 从恢复实例 GET /api/places 读出七处原有地点；原 5186 服务未受影响。验收后只停止了演练实例。
- 自动测试另用 WAL 数据库与一张关联图片，验证恢复内容一致、拒绝覆盖、检测篡改、校验失败不创建目标目录。
- 当前主库没有用户上传图片，不能用主库演练声称验证了真实用户大文件恢复；关联图片路径由自动测试覆盖。
