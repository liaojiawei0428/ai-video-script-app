# Deep剧本 DB 迁移 SOP (S66)

> **适用范围**: shipin-APP server 数据库 schema 变更
>
> **版本**: v1.0 (2026-06-24 S66 新建)
>
> **强制阅读**: 任何 AI 改 schema / 跑迁移 / 改 initTables() 前必读本文件
>
> **配套**: [`./DEPLOY.md`](./DEPLOY.md) § 8 (initTables 自动迁移 简述) + [`./ENV_MANAGEMENT.md`](./ENV_MANAGEMENT.md) § 1.2 (MYSQL_* env)

---

## § 0. 现状 (S66 自检)

### 0.1 数据库信息

- **DB 类型**: MySQL 5.7+ (生产是 10.1.0.11 远程)
- **DB 名**: `ai_script`
- **当前表数**: 11 张表 (characters / novels / episodes / users / shots / notifications / billing_logs / feedbacks / assets / style_presets / points_orders) — S64 后
- **总数据量**: 78 characters / 12 novels / 20 users / 346 episodes / 98 shots / 17 notifications / 710 billing_logs (S11 摸底)
- **迁移工具**: server 启动时自动调 `initTables()` (apps/server/src/models/db.ts)

### 0.2 历史 GAP (S66 修复)

- ❌ DEPLOY.md § 8 只说 "initTables() 自动", 没详细 SOP
- ❌ `migrations/v1.2-to-v2.0.sql` 手动 SQL 模板存在, 没"何时手动 vs 自动"规则
- ❌ 没 schema 版本管理规范 (每次发布 changelog 加 schema 变更?)
- ❌ 没跨版本回滚兼容性规范

---

## § 1. 迁移方式选型 (3 种)

### 1.1 自动迁移 (initTables) — 99% 场景

**原理**: server 启动时调 `initTables()`, 自动跑所有 ALTER + CREATE, 用 try/catch 包裹。

```typescript
// apps/server/src/models/db.ts (简化)
export async function initTables() {
  // 1. CREATE TABLE IF NOT EXISTS (已存在不阻塞)
  await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (...)`);

  // 2. ALTER TABLE ADD COLUMN (已存在 catch 跳过)
  for (const col of newColumns) {
    try {
      await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // 已存在不报错, 继续下一个字段
    }
  }
}
```

**适用**:
- ✅ 加新字段 (ALTER TABLE ADD COLUMN)
- ✅ 加新索引 (CREATE INDEX, MySQL 8+ 支持 IF NOT EXISTS)
- ✅ 加新表 (CREATE TABLE IF NOT EXISTS)
- ✅ 字段类型小改 (VARCHAR(50) → VARCHAR(100), 兼容老数据)

**不适用**:
- ❌ 删字段 (DROP COLUMN, 老数据会丢)
- ❌ 删表 (DROP TABLE)
- ❌ 改字段名 (RENAME COLUMN, 老代码引用会崩)
- ❌ 大数据表 ALTER (锁表 5+ 分钟, 必须用 pt-online-schema-change)

### 1.2 手动 SQL 迁移 (复杂变更)

**位置**: `apps/server/migrations/v<N>-to-v<N+1>.sql` (S2.0.0 用过 v1.2-to-v2.0.sql)

**适用**:
- ❌ initTables 不支持的操作 (DROP / RENAME / 大表 ALTER)
- ✅ 数据迁移 (UPDATE 旧数据格式)
- ✅ 复杂索引变更
- ✅ 跨版本回滚支持

**部署流程**:
```bash
# 服务器
cd /www/wwwroot/shipin-APP
mysql -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE \
  < apps/server/migrations/v2.5-to-v3.0.sql
```

### 1.3 数据迁移 + 自动迁移组合 (新增字段)

```sql
-- apps/server/migrations/v2.5.36-to-v2.5.37.sql
-- 1. 加新字段 (initTables() 自动)
ALTER TABLE characters ADD COLUMN new_field VARCHAR(50);
-- 2. 数据回填 (老数据补 default 值)
UPDATE characters SET new_field = 'default_value' WHERE new_field IS NULL;
-- 3. 加索引
CREATE INDEX idx_new_field ON characters(new_field);
```

**适用**: 加新字段 + 老数据必须立即可用的场景 (比纯 initTables 立即 ALTER 更可控)。

---

## § 2. 增量迁移规范 (S66 实战总结)

### 2.1 加字段 (99% 场景)

```typescript
// 1. server/src/models/db.ts 加 initTables() 调用
export async function initTables() {
  // 已有: characters, novels, ...
  await db.exec(`CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,                              -- v2.5.x 加
    style_id INT,                                   -- v3.0.0 加
    confirmed TINYINT DEFAULT 0,                    -- v3.0.0 加
    extra_description TEXT,                         -- v3.0.0 加
    ...
  )`);

  // 2. ALTER 兼容老库 (try/catch 跳过已存在)
  for (const col of [
    { name: 'description', type: 'TEXT' },
    { name: 'style_id', type: 'INT' },
    { name: 'confirmed', type: 'TINYINT DEFAULT 0' },
  ]) {
    try {
      await db.exec(`ALTER TABLE characters ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // 已存在不报错
    }
  }
}
```

**原则**:
- ✅ **永不用 DROP COLUMN** (老数据 / 老代码会崩)
- ✅ **默认值必填** (`DEFAULT 0` / `DEFAULT NULL` / `DEFAULT ''`)
- ✅ **NOT NULL 字段必带 DEFAULT** (老数据补默认值)
- ✅ **TEXT 字段不限长** (MySQL TEXT 最大 64KB, 够用)

### 2.2 加表

```typescript
// CREATE TABLE IF NOT EXISTS
await db.exec(`CREATE TABLE IF NOT EXISTS style_presets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// 初始化数据 (S2.0.0 5 画风 seed)
await db.exec(`INSERT IGNORE INTO style_presets (id, name, display_name) VALUES
  (1, 'realistic', '写实电影风'),
  (2, 'ink_painting', '古风水墨'),
  ...
`);
```

### 2.3 加索引

```sql
-- MySQL 8.0+ 支持 CREATE INDEX IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_characters_style_id ON characters(style_id);

-- MySQL 5.7 不支持, 用 stored procedure 兜底
-- 或 initTables() 里 try/catch + INFORMATION_SCHEMA 查重
```

### 2.4 改字段类型 (VARCHAR 加长, INT → BIGINT)

```sql
-- 兼容老数据 (VARCHAR(50) → VARCHAR(100))
ALTER TABLE characters MODIFY COLUMN description VARCHAR(500);
-- 老数据自动截断 / 补 null, 不会丢

-- ⚠️ 反向缩短 (VARCHAR(500) → VARCHAR(50)) 会截断数据, 必先备份 + 手动 SQL
```

### 2.5 删字段 / 删表 (禁止, 用 deprecated 标记)

```sql
-- ❌ 禁止
ALTER TABLE characters DROP COLUMN old_field;
DROP TABLE deprecated_table;

-- ✅ 推荐: 加 _deprecated 后缀 + 加注释
ALTER TABLE characters RENAME COLUMN old_field TO _deprecated_old_field;
-- 6 个月后真删 + 删 .ts 代码引用
```

---

## § 3. schema 版本管理

### 3.1 changelog.md schema 变更段

每次发版**必加** schema 变更到 `apps/server/changelog.json` 当前版本条目 + DEPLOY.md § 8 schema 注释:

```json
{
  "version": "3.0.30",
  "highlights": [
    "...",
    "新增 characters.style_id 字段 (int, default 0)",
    "新增 style_presets 表 (5 画风)",
    "ALTER characters.description TEXT (兼容老数据)"
  ]
}
```

### 3.2 schema 版本号 (可选, S66 暂不强制)

**未来扩展**: 数据库加 `schema_version` 表, 记录当前 schema 版本号 + 升级历史。

```sql
CREATE TABLE schema_version (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);
INSERT INTO schema_version (version, description) VALUES
  ('1.2.0', 'Initial schema'),
  ('2.0.0', 'v2.0.0 schema: characters add description, novel add full_summary'),
  ('2.5.36', 'v2.5.36 schema: assets/style_presets/points_orders 3 new tables');
```

**适用**: 跨大版本升级 (v1.2 → v2.0 → v3.0) 时, 检查 schema_version 决定跑哪个迁移脚本。

---

## § 4. 跨版本回滚兼容性

### 4.1 字段加 ADD (向下兼容)

```sql
-- v2.5 加字段
ALTER TABLE characters ADD COLUMN style_id INT DEFAULT 0;

-- 回滚 v2.4 老代码: 仍能跑 (新字段被忽略)
-- ✅ 兼容
```

### 4.2 字段删 DROP (破坏老代码)

```sql
-- v3.0 删字段
ALTER TABLE characters DROP COLUMN style_id;

-- 老 v2.5 代码: SELECT * 报错 (字段不存在)
-- ❌ 不兼容
```

**S66 规范**: **永远不 DROP COLUMN**, 用 `_deprecated_` 前缀 + 6 个月观察期后真删。

### 4.3 字段类型改 (兼容老数据)

```sql
-- VARCHAR(50) → VARCHAR(500) ✅ 兼容
-- INT → BIGINT ✅ 兼容 (MySQL 自动转)
-- VARCHAR(500) → VARCHAR(50) ❌ 数据截断
-- TEXT → VARCHAR ❌ 数据截断 (TEXT → VARCHAR 必须先备份 + 手动)
```

### 4.4 索引加 / 删 (性能影响, 不影响功能)

```sql
CREATE INDEX idx_style_id ON characters(style_id);  -- 加索引 ✅
DROP INDEX idx_style_id ON characters;             -- 删索引 ⚠️ (性能退化但功能正常)
```

---

## § 5. 部署时迁移流程

### 5.1 标准流程 (99% 场景: 自动迁移)

```bash
# 1. 部署 server dist (含新 initTables 代码)
cd /www/wwwroot/shipin-APP
cp -r dist/* ./dist.new/
cp dist.new/index.js ./dist/index.js
rm -rf dist.new

# 2. pm2 restart, 自动跑 initTables()
pm2 delete ai-script-server && pm2 start ecosystem.config.js --env production

# 3. 验证 schema 生效
mysql -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE -e "
  SHOW COLUMNS FROM characters LIKE 'style_id';
  SHOW TABLES LIKE 'style_presets';
  SELECT COUNT(*) FROM style_presets;
"
# 期望: style_id 字段存在, style_presets 表存在, 5 行
```

### 5.2 大表 ALTER 流程 (5+ 分钟锁表)

```bash
# 用 pt-online-schema-change (Percona 工具)
# 1. 安装 (生产已装)
pt-online-schema-change --alter "ADD COLUMN new_field INT" D=ai_script,t=characters \
  --execute --charset=utf8mb4 --no-drop-old-table

# 2. shipin-APP 当前不需要 (表小), 但写进 SOP 备用
```

### 5.3 手动 SQL 迁移流程 (DROP / RENAME / 大数据)

```bash
# 1. 先备份
mysqldump -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD \
  --single-transaction --quick --routines --triggers \
  $MYSQL_DATABASE > /www/backup/release/vX.Y.Z/backup-$(date +%Y%m%d_%H%M%S).sql

# 2. 关 server, 防止并发写
pm2 delete ai-script-server

# 3. 跑迁移
mysql -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE \
  < apps/server/migrations/v2.5-to-v3.0.sql

# 4. 验证
mysql ... -e "SHOW COLUMNS FROM characters"

# 5. 启动 server (新代码读新 schema)
pm2 start ecosystem.config.js --env production
```

⚠️ **S66 规范**: 手动 SQL 迁移期间 server 必停, **不能 0 downtime** (除非用 pt-osc, shipin-APP 数据量小不需要)。

---

## § 6. 实战案例库 (shipin-APP 历次迁移)

| 版本 | 迁移内容 | 方式 |
|---|---|---|
| v1.2 → v2.0 | 4 新表 + 17 字段 (assets / style_presets / characters.description / etc.) | `migrations/v1.2-to-v2.0.sql` 手动 + 后续 initTables() 自动 |
| v2.0 → v2.5 | characters 加 11 字段 (v2.5.13 重构) | initTables() 自动 |
| v2.5.36 | 加 assets / style_presets / points_orders 3 张新表 | initTables() 自动 |
| v3.0.0 | 加 style_id / confirmed / extra_description (character) + Agent 矩阵 4 张表 | initTables() 自动 |

**经验**: shipin-APP schema 变更**从未用过 DROP**, 都是 ADD + deprecated 标记。手动 SQL 只在 v1.2 → v2.0 大跨版本用过一次。

---

## § 7. 常见问题

### 7.1 ALTER TABLE 报 "Duplicate column name 'xxx'"

**根因**: initTables() 跑了 ALTER 但字段已存在 (没 try/catch 包裹)
**解决**: 加 try/catch (见 § 2.1)

### 7.2 server 启动报 "Table 'xxx' doesn't exist"

**根因**: initTables() 没跑 (可能 server 启动时 DB 还没就绪) 或 CREATE 失败
**解决**:
```bash
# 手动跑 initTables()
mysql -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE \
  -e "SHOW TABLES"
# 看哪些表缺失
# 检查 server 启动日志: pm2 logs ai-script-server | grep "initTables"
```

### 7.3 数据迁移后老数据丢失

**根因**: ALTER 加字段但没设 DEFAULT, 老数据新字段 = NULL, 业务代码没处理 NULL
**解决**:
- ALTER 必带 DEFAULT (`ALTER TABLE ... ADD COLUMN x INT DEFAULT 0`)
- 业务代码处理 NULL (`if (x === null) x = default`)

### 7.4 跨版本回滚时老代码读新字段

**现象**: shipin-APP v2.5 老代码 SELECT * FROM characters, 但 DB 已经是 v3.0 加了 5 个新字段
**结果**: ✅ 老代码能跑 (新字段被忽略, SELECT * 不过滤)
**回滚**: v3.0 → v2.5 删 server dist, initTables 不会跑 (S66 § 4.1 兼容)

### 7.5 生产 DB 满了 ALTER 失败

**根因**: shipin-APP DB 在远程 10.1.0.11, 磁盘满导致 ALTER 失败
**解决**:
1. `df -h` 看磁盘
2. 清理 `pm2 flush` (清日志) + 清理 uploads/ (用户数据不动)
3. ALTER 重试

---

## § 8. AI Agent 必跑清单

**任何 AI 改 schema / 跑迁移 / 改 initTables() 必跑**:

```
[ ] 1. 读本文件 + DEPLOY.md § 8 (initTables 简述)
[ ] 2. 确认是 ADD (兼容) / DROP (不兼容) / RENAME (不兼容)
[ ] 3. ADD 字段必带 DEFAULT (防老数据 NULL)
[ ] 4. 改 initTables() 用 try/catch 包裹 ALTER (防字段重复)
[ ] 5. 更新 apps/server/changelog.json 当前版本条目
[ ] 6. 部署后 mysql SHOW COLUMNS 验证字段生效
[ ] 7. 不删字段 (用 _deprecated 后缀 + 6 个月观察)
[ ] 8. 写 DEV_PROGRESS.md AI 会话追踪行
```

---

## § 9. 配套文档

| 文件 | 关系 |
|---|---|
| `apps/server/src/models/db.ts` | initTables() 实现 (S66 实战验证) |
| `apps/server/migrations/v1.2-to-v2.0.sql` | 手动 SQL 模板 (140 行) |
| [`docs/DEPLOY.md`](./DEPLOY.md) | server 部署 (含 § 8 initTables 简述) |
| [`docs/ENV_MANAGEMENT.md`](./ENV_MANAGEMENT.md) | env 变量 (含 MYSQL_* 配置) |
| [`apps/server/changelog.json`](../../apps/server/changelog.json) | changelog 数据源 (含 schema 变更) |

---

> **最后更新**: 2026-06-24 (S66)
> **下次 review**: schema 大改 / 加新表 / DROP 字段 / 跨大版本升级时
