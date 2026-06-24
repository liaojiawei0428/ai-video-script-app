# Deep剧本 Server 环境变量管理规范 (S66)

> **适用范围**: `apps/server/.env` / `.env.production` / `ecosystem.config.js` env 块 / PM2 env 注入
>
> **版本**: v1.0 (2026-06-24 S66 新建)
>
> **强制阅读**: 任何 AI 修改 server 部署前必读本文件 + 配套 [`apps/server/.env.example`](../../apps/server/.env.example)
>
> **配套**: [`./DEPLOY.md`](./DEPLOY.md) § 7 (env 修复 4 条) + [`./PM2_GUIDE.md`](./PM2_GUIDE.md) § 4 (env 注入) + [`./VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) § 2.3 (APP_VERSION 同步)

---

## § 0. 现状 (S66 自检)

### 0.1 现有文件

| 文件 | 作用 |
|---|---|
| `apps/server/.env.example` | env 变量模板 (S66 补全, 32 → 110 行) |
| `apps/server/.env.production` | 生产环境配置 (实际部署后由 ops 维护, 不入 git) |
| `apps/server/ecosystem.config.js` | PM2 配置, 含 env / env_production 两块 |

### 0.2 历史 GAP (S66 修复)

- ❌ `.env.example` 32 行, 缺 JWT_SECRET / MYSQL_* / PAY_KEY / AGNES_IMAGE_API_KEY 8 个关键变量
- ❌ ecosystem.config.js APP_VERSION 写 `3.0.26`, 跟实际生产 `3.0.29` 不一致 (S64 BUG-066 修了 package.json + index.ts fallback, **漏了 ecosystem.config.js**)
- ❌ 没强密钥生成 / 轮换 SOP
- ❌ 没 .env 防泄露规范
- ❌ 没必填 vs 可选 区分

---

## § 1. env 分类 (4 类)

### 1.1 [REQUIRED] 基础 (3 个)

| Key | 默认值 | 说明 |
|---|---|---|
| `PORT` | `6000` | server 监听端口 (宝塔 nginx 反代 6000) |
| `NODE_ENV` | `production` | development / production, 生产必须 production |
| `APP_VERSION` | `3.0.29` | **跟 ecosystem.config.js 同步** (6 处自检之一) |

### 1.2 [REQUIRED] 鉴权 + 数据库 (6 个)

| Key | 默认值 | 说明 |
|---|---|---|
| `JWT_SECRET` | (无) | **强密钥 256-bit**, `openssl rand -hex 32` 生成, 改后所有 token 失效 |
| `MYSQL_HOST` | `10.1.0.11` | 远程 MySQL 服务器 |
| `MYSQL_PORT` | `3306` | MySQL 端口 |
| `MYSQL_USER` | `root` | DB 用户 |
| `MYSQL_PASSWORD` | (无) | DB 密码, 不要 commit |
| `MYSQL_DATABASE` | `ai_script` | DB 名 |
| `MYSQL_POOL_SIZE` | `10` | 连接池, 默认 10 够用 |

### 1.3 [REQUIRED] 第三方 API Key (8 个)

| Key | 默认值 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEYS` | (无) | **多个 key 用逗号分隔**, server 启动随机选一个 |
| `DEEPSEEK_API_URL` | `https://api.deepseek.com/v1` | DeepSeek V4 Flash |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名 |
| `AGNES_API_KEY` | (无) | **统一 key, 3 个模型通用** (Image/Text/Video) |
| `PAY_KEY` | (无) | 充值签名 key |
| `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY` | (无) | 支付宝 4 件套 |
| `ALIPAY_NOTIFY_URL` | `https://ab.maque.uno/api/recharge/alipay/notify` | 异步回调 |

### 1.4 [OPTIONAL] 调试 / 限流 / 代理

| Key | 默认值 | 说明 |
|---|---|---|
| `UPLOAD_DIR` | `./uploads` | 用户上传, 部署后永不动 |
| `MAX_FILE_SIZE` | `52428800` (50MB) | 单文件最大 |
| `CORS_ORIGIN` | `*` | 生产改具体域名 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 1 分钟窗口 |
| `RATE_LIMIT_MAX_REQUESTS` | `10` | 每 IP 限流 |
| `HTTP(S)_PROXY` 等 | (空) | 中国大陆部署时填, 海外直连不填 |
| `DEBUG` | `false` | true 时输出 SQL + 详细堆栈 |
| `LOG_LEVEL` | `info` | error / warn / info / debug |

---

## § 2. 强密钥生成 SOP

### 2.1 JWT_SECRET (256-bit)

```bash
# 必跑 (一次性, 256-bit 强密钥)
NEW=$(openssl rand -hex 32)
echo "JWT_SECRET=$NEW"

# 写到 .env (追加, 不覆盖已有)
if ! grep -qE "^JWT_SECRET=.{64,}" .env; then
  echo "JWT_SECRET=$NEW" >> .env
  echo "  → 已生成新 JWT_SECRET (256-bit)"
fi
```

⚠️ **改了 JWT_SECRET, 所有用户 token 失效**, 必通知重新登录。

### 2.2 DEEPSEEK_API_KEYS (多 Key 池)

```bash
# 多个 key 用英文逗号分隔, server 启动随机选一个 (轮换 + 限流分摊)
DEEPSEEK_API_KEYS=sk-key1xxx,sk-key2yyy,sk-key3zzz

# 加新 key (追加, 不动现有 key)
sed -i 's/^DEEPSEEK_API_KEYS=.*/&,sk-newkey/' .env
```

### 2.3 MYSQL_PASSWORD

- MySQL root 密码, **每 90 天轮换一次** (用户偏好 + 安全规范)
- 轮换流程: 新密码 → MySQL `ALTER USER` → 更新 .env → pm2 restart

---

## § 3. 密钥轮换 SOP (6 类)

| 密钥 | 轮换频率 | 怎么轮换 |
|---|---|---|
| **SSH key** (`~/.ssh/id_ed25519`) | 半年 (用户偏好 2026-06-13 起) | ssh-keygen 生成新 key → 更新服务器 `~/.ssh/authorized_keys` → 本机验证 |
| **JWT_SECRET** | 半年 / 用户报泄露时 | `openssl rand -hex 32` → sed 写 .env → 通知用户重新登录 |
| **DEEPSEEK_API_KEYS** | 90 天 / DeepSeek 公告时 | DeepSeek 控制台新生成 → sed 追加 .env → pm2 restart |
| **MYSQL_PASSWORD** | 90 天 | MySQL `ALTER USER 'root'@'%' IDENTIFIED BY 'new'` → 更新 .env → pm2 restart |
| **PAY_KEY** | 180 天 / 商家公告时 | 支付宝控制台新生成 → 更新 .env → pm2 restart |
| **AGNES_API_KEY** | 180 天 / 泄露时 | Agnes 控制台新生成 → 更新 .env → pm2 restart |

**强制规则**:
- 轮换后**所有现役 token 必失效** (除了 SSH key), 用户需重新登录 / 重新支付验证
- 旧密钥不删, 在 .env 加注释 `# OLD: <旧值> (rotated YYYY-MM-DD)` 保留 30 天 (回滚缓冲)

---

## § 4. 部署时 env 操作规范 (4 条)

### 4.1 必跑: 检查必填项

```bash
# 在 /www/wwwroot/shipin-APP
cd /www/wwwroot/shipin-APP
for k in PORT NODE_ENV APP_VERSION JWT_SECRET MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE DEEPSEEK_API_KEYS AGNES_API_KEY PAY_KEY; do
  grep -qE "^$k=" .env || echo "  ⚠️ 缺失: $k"
done
```

### 4.2 强规则: `>> .env` 追加, **不**用 `> .env` 重写

```bash
# ✅ 正确: 追加 (保留现有配置)
echo "JWT_SECRET=newvalue" >> .env

# ❌ 错误: 重写 (覆盖整个 .env, 丢失其他变量)
echo "JWT_SECRET=newvalue" > .env  # 绝对禁止
```

### 4.3 强规则: 不覆盖 `uploads/` / `exports/` / `logs/` (用户数据)

```bash
# 部署时只 cp 源码, 不碰数据
cp -r dist/* /www/wwwroot/shipin-APP/dist/
cp package.json /www/wwwroot/shipin-APP/
# uploads/ exports/ logs/ 永远不删不覆盖
```

### 4.4 PM2 env 注入 (跟 ecosystem.config.js 关系)

PM2 启动优先级: `ecosystem.config.js` env_production > `process.env` shell > `.env`

```bash
# 方式 A: ecosystem.config.js env_production 块 (推荐, 配置可见)
# 编辑 apps/server/ecosystem.config.js, 修改 APP_VERSION 等

# 方式 B: PM2 start 时覆盖
APP_VERSION=3.0.30 pm2 start ecosystem.config.js --env production --update-env
# ⚠️ --update-env 会刷 PM2 持久 env, 部署时禁用 (跟 ecosystem.config.js 冲突)
```

---

## § 5. .env 防泄露规范

### 5.1 永不入 git

```bash
# .gitignore (项目根, 已配置)
.env
.env.production
.env.local
.env.development
```

### 5.2 部署传输: 必走加密通道

```bash
# ✅ 正确: scp 走 SSH 加密
scp .env root@159.75.16.110:/www/wwwroot/shipin-APP/.env

# ⚠️ 不推荐: curl POST 到 webhook (可能被截获)
curl -X POST https://webhook.site/... -d @.env  # 禁止
```

### 5.3 检测 .env 是否被 commit

```bash
# 检查 git log 是否有 .env 文件历史
git log --all --full-history -- .env .env.production
# 输出: 必为空 (否则泄露了, 必轮换所有 key + 用 git-filter-repo 删历史)

# 检查 working tree 是否有 .env (应该被 .gitignore 排除)
git ls-files | grep -E "^\.env"  # 应该返回空
```

### 5.4 事故响应 (env 泄露)

如果发现 .env 误 commit 或泄露:

1. **立即轮换所有 6 类密钥** (SSH / JWT / DEEPSEEK / MYSQL / PAY / AGNES)
2. **用 `git filter-repo` 删历史**: `pip install git-filter-repo && git filter-repo --path .env --invert-paths`
3. **强制 push**: `git push --force` (需所有协作者 reset)
4. **审计日志**: 查 `pm2 logs` 看是否有异常 API 调用
5. **通知用户**: 强制重新登录 / 重新支付验证

---

## § 6. APP_VERSION 6 处同步 (VERSION_MANAGEMENT § 2)

**S66 自检发现**: S64 BUG-066 修了 package.json + index.ts fallback, **漏了 ecosystem.config.js**, 导致 `APP_VERSION: '3.0.26'` 跟实际 `3.0.29` 不一致。

**现在 6 处 (S66 修订)**:

```
□ apps/mobile/src/config/version.ts APP_VERSION
□ apps/mobile/android/app/build.gradle versionCode + versionName
□ apps/server/package.json version
□ apps/server/src/index.ts fallback
□ apps/server/ecosystem.config.js env.APP_VERSION + env_production.APP_VERSION  ← S66 新增
□ apps/web/src/config/version.ts APP_VERSION
□ apps/server/changelog.json 当前版本条目
```

⚠️ **ecosystem.config.js 有 2 个 APP_VERSION** (env + env_production), 必同时改。

---

## § 7. 常见问题

### 7.1 server 启动报 `JWT_SECRET is required in production`

**根因**: `.env` 缺 JWT_SECRET 或跟 dev default 同值
**解决**: 见 § 2.1 生成 + sed 追加 .env + pm2 restart

### 7.2 server 报 `MySQL connect failed`

**根因**: MYSQL_* 配置错 / 网络不通 / 密码过期
**解决**:
```bash
grep -E "^MYSQL_" .env
mysql -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD -e "SELECT 1"
nc -zv 10.1.0.11 3306
```

### 7.3 DeepSeek API 报 401 / 429

**401**: DEEPSEEK_API_KEYS 全失效 → 检查 key 有效性 (DeepSeek 控制台)
**429**: 限流 → 加 key (见 § 2.2 追加) 或降并发

### 7.4 AGNES_API_KEY 报 `Download image failed 500`

**根因**: Agnes 服务拉不到鉴权 URL → 改用 inlineIfLocal() 转 base64 (BUG 旧)
**解决**: 见 `apps/server/src/services/agnesImageProvider.ts` `inlineIfLocal()` (S19 加)

### 7.5 ALIPAY_NOTIFY_URL 收不到回调

**根因**: 宝塔 nginx 没配 `/api/recharge/alipay/notify` location, 或公网 URL 不通
**解决**:
```bash
# 1. 宝塔 → 网站 ab.maque.uno → 配置文件 检查
location /api/recharge/alipay/notify {
  proxy_pass http://127.0.0.1:6000/api/recharge/alipay/notify;
}

# 2. 测公网可达
curl -X POST https://ab.maque.uno/api/recharge/alipay/notify -d "test=true"
```

---

## § 8. AI Agent 必跑清单

**任何 AI 修改 server env 必跑**:

```
[ ] 1. 读本文件 + apps/server/.env.example 确认必填项清单
[ ] 2. 必填项是否都齐? 用 § 4.1 grep 检查
[ ] 3. 强密钥是否够强? JWT_SECRET 必 ≥ 64 字符
[ ] 4. APP_VERSION 跟 ecosystem.config.js 同步? § 6 自检
[ ] 5. .env 没 commit 到 git? § 5.3 grep
[ ] 6. 部署后 /health + /api/version 验证 env 生效
[ ] 7. 旧密钥轮换时 .env 加注释保留 30 天
[ ] 8. 写 DEV_PROGRESS.md AI 会话追踪行
```

---

## § 9. 配套文档

| 文件 | 关系 |
|---|---|
| [`apps/server/.env.example`](../../apps/server/.env.example) | env 模板 (S66 补全) |
| [`apps/server/ecosystem.config.js`](../../apps/server/ecosystem.config.js) | PM2 env 块 (S66 修 APP_VERSION) |
| [`docs/DEPLOY.md`](./DEPLOY.md) | server 部署 (含 § 7 env 修复 4 条) |
| [`docs/PM2_GUIDE.md`](./PM2_GUIDE.md) | PM2 操作手册 (含 env 注入) |
| [`docs/DB_MIGRATION.md`](./DB_MIGRATION.md) | DB 迁移 SOP (env 缺 MYSQL_* 会卡启动) |
| [`docs/VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) | 跨端版本管理 (含 6 处 APP_VERSION 自检) |
| [`docs/STANDARDS_EVOLUTION.md`](./STANDARDS_EVOLUTION.md) | 规范自迭代 SOP |

---

> **最后更新**: 2026-06-24 (S66)
> **下次 review**: 密钥轮换时 + 新增必填 env 时 + BUG-066 类问题再发现时
