# Deep剧本 版本管理规范 (v3.x 完整版)

> **本文件覆盖范围**: 从 v3.0.0 开始的所有版本 (3.0.0 → 3.0.29 → 3.x → 4.x)
> **替代关系**: S11 (2026-05-31) 写的 v2.0.0 冻结版已废弃, 改查本文件。
> **最后更新**: 2026-06-24 (S64 P3)
>
> **强制阅读**: 任何 AI 在 shipin-APP 项目改版本号前必读本文件。
> 跨文件交叉引用:
> - BUG 案例 → `apps/mobile/BUGS.md` (BUG-066/067/068 是本规范触发的源头)
> - 硬性规范 → `apps/mobile/CODING_STANDARDS.md` 第 30/31/32 条
> - Mobile 部署 → `apps/mobile/DEPLOY.md`
> - Server 部署 → `apps/server/deploy.sh` + `docs/DEPLOY.md`
> - Web 部署 → `apps/web/scripts/deploy.sh`
> - 会话记录 → `DEV_PROGRESS.md` 底部 AI 会话追踪表

---

## § 1. 版本号格式

```
X.Y.Z
│ │ └─ 1类更新 (小版本): 仅 UI 文案 / 样式 / icon / 文案 / 视觉微调, 不改功能逻辑
│ └─── 2类更新 (中版本): 1 类 + 小功能微调 (新增设置项 / 优化交互 / 加新字段), 改前端 + 小功能
└───── 3类更新 (大版本): 1+2 类 + 核心功能新增或重大改动 (AI 模型 / 架构 / 状态机 / 新业务)
```

### 三类更新定义

| 类型 | 位置 | 说明 | 示例 |
|------|------|------|------|
| **1 类 (patch)** | 末位 Z | UI 样式 / 排版 / 配色 / icon / 文案 | `3.0.29 → 3.0.30` |
| **2 类 (minor)** | 中位 Y | 1 类 + 小功能 (设置项 / 字段 / 交互优化) | `3.0.29 → 3.0.30` (看下方进位规则) |
| **3 类 (major)** | 首位 X | 1+2 类 + 核心架构变更 (AI 模型 / 状态机 / 新业务线) | `3.0.29 → 4.0.0` |

### 进位规则

- **1 类更新**: 末位 Z + 1 (`3.0.29 → 3.0.30`)
- **2 类更新**: 中位 Y + 1, 末位 Z 归零 (`3.0.29 → 3.1.0`)
- **3 类更新**: 首位 X + 1, 中位 Y 和末位 Z 归零 (`3.0.29 → 4.0.0`)

⚠️ **不允许**:
- 跨级跳 (如 `3.0.29 → 4.0.0` 走 1 类内容), 必须按真实变更判定
- 自降级 (如 `3.0.30 → 3.0.29`), 一旦发版不许回滚版本号

---

## § 2. 版本号在 4 个位置的统一管理

每个 app 都维护自己的 `src/config/version.ts` (或 `package.json` for server), 这是**唯一的版本号来源 (Single Source of Truth)**。

| # | 位置 | 文件 | 字段 |
|---|---|---|---|
| 1 | **Mobile 端 (构建时编进 APK)** | `apps/mobile/src/config/version.ts` | `APP_VERSION = '3.0.29'` |
| 2 | **Mobile Android** | `apps/mobile/android/app/build.gradle` | `versionCode 36` + `versionName "3.0.29"` |
| 3 | **Server 端** | `apps/server/package.json` | `"version": "3.0.29"` |
| 4 | **Server 运行时** | `ecosystem.config.js` (shipin-APP) | `env_production.APP_VERSION: "3.0.29"` |
| 5 | **Web 端 (展示)** | `apps/web/src/config/version.ts` | `APP_VERSION = '3.0.29'` |
| 6 | **Web 端 (备份)** | `apps/web/src/components/Layout.tsx` 注释 | `v3.0.29 (S64)` |

**不允许**:
- ❌ 在多个 .tsx / .ts 里写 `const APP_VERSION = '3.0.0'` 硬编码 (BUG-067)
- ❌ 改 version.ts 但不改 build.gradle / package.json / ecosystem.config.js (会导致升级死循环, BUG-024)
- ❌ 改一处但忘记同步所有 6 个位置

**为什么不全用一份共享包**:
- S58 BUG-005/009/011/013 教训: monorepo shared 包 import value 会触发 Metro 编译坑
- mobile / web / server 各自的打包工具链完全不同, 共享包反而脆弱
- 每个 app 维护自己的 `config/version.ts`, 编译时确定, 不会被运行时替换

---

## § 3. 单一来源原则 (Single Source of Truth)

### 3.1 Mobile 端 `src/config/version.ts`

```typescript
// apps/mobile/src/config/version.ts
// 修改本文件 = 触发版本号变更流程 (见 § 5)
export const APP_VERSION = '3.0.29';     // 跟 build.gradle versionName 一致
export const APP_VERSION_CODE = 36;      // 跟 build.gradle versionCode 一致
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
export const APP_BUILD_DATE = '2026-06-24';
```

**用法**: 6 个 screen 全部 `import { APP_VERSION }`:
- `ProfileScreen.tsx`, `SettingsScreen.tsx`, `AboutScreen.tsx`, `LoginScreen.tsx`, `RegisterScreen.tsx`, `AdminLoginScreen.tsx`

⚠️ **不允许** 在 screen 内 `const APP_VERSION = '3.0.29'`, 必须 import。

### 3.2 Web 端 `src/config/version.ts` (S64 新建)

```typescript
// apps/web/src/config/version.ts
// v3.0.29 (S64): web 端版本号单一来源 (跟 mobile 对齐)
export const APP_VERSION = '3.0.29';
export const APP_VERSION_CODE = 36;
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
export const APP_BUILD_DATE = '2026-06-24';
```

**用法**: 3 个地方必须 import:
- `components/Layout.tsx:44` (顶部 logo 旁版本号) — **修前是硬编码 v3.0.0 (BUG-067)**
- `pages/AboutPage.tsx:32` (关于页大标题下方) — **修前是硬编码 v3.0.0 (BUG-067)**
- `pages/DownloadPage.tsx:41-42` (下载页 fallback) — **修前是硬编码 v3.0.0 (BUG-067)**

### 3.3 Server 端 `package.json` + `ecosystem.config.js` (运行时)

```json
// apps/server/package.json
{
  "name": "@ai-script/server",
  "version": "3.0.29",    // ← 修前是硬编码 3.0.0-alpha (BUG-066)
}
```

```javascript
// shipin-APP ecosystem.config.js (部署到 /www/wwwroot/shipin-APP/)
module.exports = {
  apps: [{
    name: 'ai-script-server',
    env: { APP_VERSION: '3.0.29' },                  // dev
    env_production: { APP_VERSION: '3.0.29' },       // prod 实际读这个
  }]
};
```

**server 端 `/api/version` 实现** (`apps/server/src/index.ts:67`):
```typescript
app.get('/api/version', (req, res) => {
  const currentVersion = process.env.APP_VERSION || '3.0.29';  // fallback 必须是当前版本
  // ...
});
```

⚠️ **fallback 必须跟当前版本一致**: 之前 `'3.0.0-alpha'` 是 S17 历史残留, 重启或 env 失效会回退到错误版本 (BUG-066)。

---

## § 4. changelog 维护流程 (S64 新增)

### 4.1 数据源 `apps/server/changelog.json`

每发一个版本必追加一条, 老版本不可删。

```json
{
  "_comment": "Deep剧本 APP 版本 changelog 数据源 (S64 规范: 真实条目, 严禁硬编码)",
  "_spec": "VERSION_MANAGEMENT.md § 4",
  "_format": "version/buildDate (YYYY-MM-DD)/summary (1 句话)/highlights (3-5 条要点)/type (major|minor|patch)",
  "_rule": "每次发版必追加本文件当前版本条目 + 老版本不可删",
  "entries": [
    {
      "version": "3.0.29",
      "buildDate": "2026-06-24",
      "type": "minor",
      "summary": "角色库 UI 商业化重设计 + 5 BUG 修复",
      "highlights": [
        "角色库三屏全面商业化重设计 (Notion/Linear dark theme 风格)",
        "新建 theme/character.ts (191 行) + 4 个商业化组件",
        "BUG-061 修 WCAG 11.6:1 对比度",
        "BUG-062 替换 emoji icon → Ionicons 矢量图标",
        "BUG-063 chip alpha 12.5% 隐形 → 改用不透明 bg"
      ]
    },
    { "version": "3.0.28", "...": "..." },
    { "version": "2.0.0", "...": "..." }
  ]
}
```

### 4.2 读取流程

1. server 启动时 `apps/server/src/shared/changelog.ts` 从多路径读 (`__dirname/../../changelog.json` / `__dirname/../changelog.json` / `process.cwd()/changelog.json`), 命中后缓存
2. `/api/version` 调 `readChangelog(currentVersion)` 拿真实条目
3. 返回前端:
```json
{
  "success": true,
  "data": {
    "version": "3.0.29",
    "downloadUrl": "https://ab.maque.uno/app/DeepScript_v3.0.29.apk",
    "changelog": "角色库 UI 商业化重设计 + 5 BUG 修复",
    "highlights": ["...", "...", "..."],
    "buildDate": "2026-06-24",
    "forceUpdate": true,
    "needUpdate": true
  }
}
```

### 4.3 部署时 changelog.json 同步

**关键问题**: tsc 默认不复制 .json 文件到 dist/。

**修法 (S64)**: server 部署脚本必须包含 `cp changelog.json dist/changelog.json`。
- 本地打包 dist.tar.gz: 在 tar 之前 `cp changelog.json dist/`
- shipin-APP 解压: `tar xzf dist.tar.gz -C /www/wwwroot/shipin-APP/dist/`

### 4.4 前端展示

- **Web DownloadPage**: 已改用 server 返回的 `highlights.map(...)` (修前是 5 条 hardcoded `<li>`)
- **Web AboutPage**: 显示 `v{APP_VERSION} · {APP_BUILD_DATE}` (从 src/config/version.ts 读)
- **Mobile AboutScreen**: 显示 `APP_DISPLAY_NAME` (从 src/config/version.ts 读)

---

## § 5. 发版流程 (8 步 SOP)

> **AI Agent 改版本号必跑**: § 5.1 → § 5.8, 8 步, 30 分钟。
> 详细命令模板在 § 6 + `apps/mobile/DEPLOY.md`。

### § 5.0 ⚠️ 分支判断 (S67 新增, BUG-070 教训)

**部署前必先判断**: 当前 server 有没有用户正在跑 AI 任务?

| 场景 | SOP |
|---|---|
| **无活跃任务** (`active-tasks` = 0) | 按下面 § 5.1 → § 5.8 标准 8 步跑 |
| **有活跃任务** (`active-tasks` > 0, 用户在分析小说 / 生图 / 生视频) | **必跑 § 5.A 活跃任务场景部署专项** (S67 新增, 维护模式流程) |

**核心原则**: **绝不能直接 `pm2 restart`** — 会打断用户正在跑的 LLM 任务, 浪费 token + 钱 + 用户体验崩。

**S67 新增 AI 行为规范**: 任何 AI 接到 server 部署任务, **第一步必跑**:

```bash
# 查活跃任务数
COUNT=$(curl -s "https://ab.maque.uno/api/admin/active-tasks" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
echo "活跃任务数: $COUNT"

# 决策:
[ "$COUNT" -gt 0 ] && echo "→ 必跑 § 5.A 维护模式流程" || echo "→ 标准 § 5.1-5.8"
```

**对应代码**:
- 端点: `apps/server/src/routes/admin.ts:136` (`GET /api/admin/active-tasks`)
- 维护开关: `apps/server/src/routes/admin.ts:144` (`PUT /api/admin/maintenance?enable=true`)
- 共享状态: `apps/server/src/shared/maintenance.ts` (全局变量)
- controller 检查: `apps/server/src/controllers/characterController.ts:14` + `novelController.ts:12` (import `getMaintenance`)

**详细规范**: [`apps/server/AGENTS.md`](../apps/server/AGENTS.md) § 部署前必跑 5 项 + [`apps/server/deploy.sh`](../apps/server/deploy.sh) (远端部署脚本, 67 行, 完整 6 步流程)

### § 5.A 活跃任务场景部署专项 (S67 新增, BUG-070 教训)

> **触发条件**: `active-tasks > 0`, 用户在分析小说 / 生图 / 生视频。
>
> **目标**: 保护用户正在跑的任务, 不打断不浪费 token, 让旧任务跑完再部署。

**9 步流程**:

```bash
# ========== 1. 预检查活跃任务 ==========
COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
echo "活跃任务数: $COUNT"

# ========== 2. 发维护公告 (推送给所有用户) ==========
curl -s -X POST "${SERVER}/api/notifications/admin/announcement" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"title":"系统维护通知","content":"系统即将升级维护, 正在运行的任务将正常完成, 请稍候。"}'

# ========== 3. 开维护模式 (controller 拒绝新任务, 已在跑的不影响) ==========
curl -s -X PUT "${SERVER}/api/admin/maintenance?enable=true"
echo "维护模式已开启, 新任务将被拒绝"

# ========== 4. 等活跃任务跑完 (最多 15 分钟, 循环检查) ==========
WAITED=0
MAX_WAIT=900
while [ $WAITED -lt $MAX_WAIT ]; do
  COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
  echo "剩余任务: $COUNT  (已等 ${WAITED}s)"
  [ "$COUNT" -eq 0 ] && break
  sleep 10
  WAITED=$((WAITED + 10))
done

# ========== 5. 超时决策 ==========
if [ $WAITED -ge $MAX_WAIT ]; then
  echo "⚠️ 超时 15 分钟, 仍有 $COUNT 任务"
  echo "   强制部署 = 这些任务会被 kill, 用户已经扣的 token 钱白花"
  echo "   只能紧急情况 (安全补丁) 才能强制, 必先 PM admin 备案"
  read -p "强制部署? (yes/no): " FORCE
  [ "$FORCE" != "yes" ] && echo "取消部署, 等待任务完成" && exit 1
fi

# ========== 6. 执行部署 ==========
cd /www/wwwroot/shipin-APP
tar xzf /tmp/dist-server-{VER}.tar.gz
pm2 delete ai-script-server && pm2 start ecosystem.config.js --env production

# ========== 7. 关维护模式 ==========
curl -s -X PUT "${SERVER}/api/admin/maintenance?enable=false"

# ========== 8. 发完成公告 ==========
curl -s -X POST "${SERVER}/api/notifications/admin/announcement" \
  -d '{"title":"系统升级完成","content":"已恢复正常使用。"}'

# ========== 9. 6 维验证 ==========
pm2 env 0 | grep APP_VERSION          # 期望 = 新版本
curl /health                          # 期望 200
curl /api/version                     # 期望 新版本 + changelog + highlights
curl -X POST /api/novels              # 期望 401 (鉴权)
ss -tlnp | grep 6000                  # 期望 LISTEN
pm2 logs --lines 30 | grep ERROR      # 期望 0 ERROR
```

**一键脚本** (推荐):

```bash
# 服务器端跑 (ADMIN_TOKEN 必填)
ADMIN_TOKEN=xxx bash apps/server/deploy.sh
```

脚本里 6 步 (检查任务 → 公告 → 维护 → 等任务 → 部署 → 恢复) 全部自动。

**配套文档**:
- [`apps/server/AGENTS.md`](../apps/server/AGENTS.md) (S67 新建, server 端 AI 入口)
- [`apps/server/deploy.sh`](../apps/server/deploy.sh) (远端部署脚本, 67 行)
- [`docs/DEPLOY.md`](./DEPLOY.md) § 0 节点 0 + § 1 + § 5.3
- [`apps/mobile/CODING_STANDARDS.md`](../apps/mobile/CODING_STANDARDS.md) 第 38 条 (S67 新增)

### § 5.1 判定版本号类别 (1 类 / 2 类 / 3 类)

按 § 1 定义判定, 列本次变更项 → 取最高类别 → 按进位规则算新版本号。

### § 5.2 改 9 处版本号 (🆕 v3.0.36 扩: changelog scp + APP_VERSION_CODE 同步 web)

```bash
APP_VERSION='3.0.36'
APP_VERSION_CODE=41  # mobile versionCode = web APP_VERSION_CODE, 必同步

# 1. mobile src/config/version.ts (唯一来源)
# 改: export const APP_VERSION = '$APP_VERSION';

# 2. mobile build.gradle
# 改: versionCode N+1; versionName "$APP_VERSION"

# 3. server package.json
# 改: "version": "$APP_VERSION"

# 4. server src/index.ts fallback (L74 'X.Y.Z' 字符串)
# 改: const currentVersion = process.env.APP_VERSION || '$APP_VERSION';

# 5. server ecosystem.config.js (2 处: env + env_production, replaceAll)
# 改: APP_VERSION: '$APP_VERSION',  (S66 BUG-069 教训)

# 6. web src/config/version.ts (APP_VERSION + APP_VERSION_CODE)
# 改: export const APP_VERSION = '$APP_VERSION'; export const APP_VERSION_CODE = N+1;
# 🆕 v3.0.36 (S72 batch 6): web APP_VERSION_CODE 必跟 mobile build.gradle versionCode 同步 (S72 batch 5 漏改 38→39, BUG-087 教训)

# 7. 🆕 server .env APP_VERSION
# 改: APP_VERSION=$APP_VERSION
# S71 BUG-082 P3 教训: process.env.APP_VERSION 实际生效是 .env, 不改 systemd 启的服务读老版本

# 8. 🆕 systemd unit /etc/systemd/system/shipin-app.service (Environment=APP_VERSION)
# 改: sed -i "s/^Environment=APP_VERSION=.*/Environment=APP_VERSION=$APP_VERSION/" /etc/systemd/system/shipin-app.service
# S71 BUG-082 P3 教训: S70 BUG-077 写完未同步, systemd 硬编码 3.0.29, .env 是 3.0.32, 实际 process.env 拿 3.0.32 (systemd EnvironmentFile 优先于 [Service] Environment, 但实际 systemd 文档说相反 — 这是隐藏 P3, 必须 2 处都改)

# 9. 🆕 changelog.json 加一条新条目 (§ 4) + scp 到 /tmp/ (v3.0.36 BUG-090 教训)
# 本地: 加新版本 entry (5 条 highlights, buildDate 必填)
# 部署: scp -i <key> apps/server/changelog.json root@<host>:/tmp/changelog.json
#       deploy.sh 优先 /tmp/changelog.json, fallback 到生产目录时显式 warn
# S72 batch 6 BUG-090 教训: changelog 跟 8 处版本号必同步部署, 不然用户看不到 changelog
```

### § 5.3 git commit + push

```bash
git add -A
git commit -m "v3.0.30: <一句话描述> (BUG-NNN)"
git push origin main
```

### § 5.4 重打 APK (mobile)

```bash
cd apps/mobile/android && gradlew assembleRelease
# 产出: app/build/outputs/apk/release/app-release.apk
```

### § 5.5 验 APK 签名 + versionName + SHA256

```powershell
aapt2 dump badging app-release.apk | Select-String "package"
# 期望: versionName='3.0.30'
apksigner verify --print-certs app-release.apk | Select-String "DN:"
# 期望: CN=DeepScript Release, O=shipin-APP
Get-FileHash app-release.apk -Algorithm SHA256
```

### § 5.6 server rebuild

```bash
cd apps/server && npm run build  # tsc → dist/
cp changelog.json dist/changelog.json  # S64 加
tar czf /tmp/dist.tar.gz dist/ package.json
```

### § 5.7 部署 (🆕 v3.0.33 走 systemd + 改 .env + 改 systemd unit + 🆕 v3.0.36 scp changelog)

```bash
# 1. APK 上传 (历史 APK 不覆盖, BUG-017)
scp app-release.apk root@159.75.16.110:/www/wwwroot/shipin-APP/public/DeepScript_v3.0.33.apk

# 2. server dist + package.json + changelog.json 三件套 scp (🆕 v3.0.36 BUG-090 教训)
scp /tmp/dist.tar.gz root@159.75.16.110:/tmp/
scp -i <key> apps/server/package.json root@159.75.16.110:/tmp/package.json
scp -i <key> apps/server/changelog.json root@159.75.16.110:/tmp/changelog.json  # 🆕 v3.0.36
# deploy.sh 优先 /tmp/changelog.json (本机 scp 源, 新版本), fallback 到生产目录时显式 warn
# 原因: 生产目录永远是上一版本, deploy.sh 的所有 cp 源都从 /tmp/ 拿

# 3. 远端执行 deploy.sh (S70 v2.0 systemd 路径, 9 步走完)
#   deploy.sh 自动: 维护模式 9 步流程 + 部署前 6 维预检 + 改 .env + 改 systemd unit + 宝塔同步
#   详细: apps/server/deploy.sh + docs/BAOTA_NODE_PROJECT_DEPLOY.md § 2
ssh root@159.75.16.110 "cd /www/wwwroot/shipin-APP && bash deploy.sh"
# ⚠️ S70 BUG-077: 不要再用 'pm2 restart' / 'pm2 start', 走 systemd 路径

# 4. web build + 部署 (vite build)
cd apps/web && npm run build
scp -r dist/* root@159.75.16.110:/www/wwwroot/ab.maque.uno/
```

### § 5.8 5 维验证 (必跑, 缺一不可)

```bash
# 1) 公网 APK HTTP 200
curl -sI https://ab.maque.uno/app/DeepScript_v3.0.30.apk | head -3
# 期望: HTTP/2 200, content-type: application/vnd.android.package-archive

# 2) 远端 SHA256 = 本机 SHA256
LOCAL=$(sha256sum app-release.apk | cut -d' ' -f1)
REMOTE=$(ssh root@159.75.16.110 "sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v3.0.30.apk" | cut -d' ' -f1)
[ "$LOCAL" = "$REMOTE" ] && echo "MATCH" || echo "MISMATCH"

# 3) /api/version 触发升级
curl -s "https://ab.maque.uno/api/version?version=3.0.29"
# 期望: "version":"3.0.30","needUpdate":true,"forceUpdate":true,"changelog":"...","highlights":[...]

# 4) web /download 页 Playwright 验证 (无错误)
# 手动访问 https://ab.maque.uno/download 看版本号 + changelog 是否对齐

# 5) 历史 APK 文件未覆盖 (BUG-017)
ssh root@159.75.16.110 "ls -la /www/wwwroot/shipin-APP/public/DeepScript_v*.apk"
# 期望: 看到 5+ 个历史 APK, 时间戳分散, 大小不同
```

### § 5.9 (可选) 试纸 5 步

只改弹窗/下载/装 APK 相关代码, 不跑完整发版 → 看 `apps/mobile/DEPLOY.md` § 7。

---

## § 6. 失败诊断 (8 类)

### 6.1 客户端弹窗不显示

| 症状 | 排查 |
|---|---|
| server 说有新版本, 客户端启动不弹窗 | `curl /api/version?version=${currentVersion}` 看 needUpdate |
| APP_VERSION 没切 | `systemctl show shipin-app -p Environment` + `cat /www/wwwroot/shipin-APP/.env | grep APP_VERSION` (S70 BUG-077 走 systemd, **不再是 PM2**) |
| 客户端 network 错 | `adb logcat | grep "Updater"` |
| 弹窗代码老 (老 APK 跑老代码) | 让用户卸老装新 |

### 6.2 /api/version 显示老版本

| 症状 | 排查 |
|---|---|
| 已经 bump server 但 /api/version 还返老版本 | `systemctl show shipin-app -p Environment` + `cat .env` (S71 BUG-082 P3: systemd unit 和 .env 都可能没改) |
| 🆕 process.env.APP_VERSION 是老值 | `journalctl -u shipin-app | grep APP_VERSION` (systemd 启动时打的 env) — 看 systemd 实际喂的 env |
| 🆕 process.env.APP_VERSION 是 3.0.29 (S70 残留) | `grep APP_VERSION /etc/systemd/system/shipin-app.service` — systemd unit 硬编码 3.0.29 没改 (S71 BUG-082 P3, S70 BUG-077 写完未同步) |
| env 没刷 | `systemctl daemon-reload && systemctl restart shipin-app` (S70 BUG-077 systemd 路径) |

### 6.3 /download 页 changelog 是 "优化性能，修复已知问题" (通用文案)

| 症状 | 排查 |
|---|---|
| changelog.json 没复制到 dist | `ls /www/wwwroot/shipin-APP/dist/changelog.json` |
| changelog.json 路径不对 | `changelog.ts` 启动日志 `[changelog] loaded N entries from ...` |
| 版本号不在 changelog.json | 查 `apps/server/changelog.json` 当前版本条目 |

### 6.4 APK 装不上 "解析包时出现问题"

| 症状 | 排查 |
|---|---|
| 远端 APK 损坏 | `sha256sum` 对比 |
| 签名不匹配 (BUG-023) | `apksigner verify` 看 DN |
| 浏览器下同一 URL 看能不能装 | ✅=APK OK, ❌=重新打包 |

### 6.5 装完还弹升级窗 (死循环, BUG-024)

| 症状 | 排查 |
|---|---|
| aapt2 远端验 versionName | `aapt2 dump badging ${APK} | head -1` |
| 跟 server APP_VERSION 不一致 | 试纸 cp 旧包, 内部 versionName 跟 filename 不一致 → **真打 APK** |

### 6.6 APP 内下载完, 自动装失败, 手动通知栏装成功 (BUG-025)

| 症状 | 排查 |
|---|---|
| `actionViewIntent(res.path())` 用错路径 | 改用 `_state.destPath` (mobile utils/updater.tsx:240) |

### 6.7 web 端版本号硬编码显示老版本 (BUG-067)

| 症状 | 排查 |
|---|---|
| Layout/AboutPage/DownloadPage 显示 v3.0.0 | `grep -r "v3\.0\.0" apps/web/src/components apps/web/src/pages` |
| 全部 import 改成 `import { APP_VERSION } from '../config/version'` | 重 build + 重 deploy |

### 6.8 server fallback 显示老版本 (BUG-066)

| 症状 | 排查 |
|---|---|
| env 没生效, /api/version 返 fallback | `apps/server/src/index.ts:68` fallback 改成当前版本 |
| package.json 还是 3.0.0-alpha | 改成当前版本 |

---

## § 7. AI Agent 必跑清单

> 任何 AI 改 shipin-APP 项目, **触发以下任一条件**必跑 § 7.1 - § 7.5:

- **条件 A**: 改了 `version.ts` / `build.gradle` / `package.json` / `ecosystem.config.js`
- **条件 B**: 加了新依赖 (npm i xxx)
- **条件 C**: 改了 server `/api/version` / `/api/notifications` / `/api/admin` 任一端点
- **条件 D**: 改了 mobile `utils/updater.tsx` (升级链路核心)
- **条件 E**: 改了 web `pages/DownloadPage.tsx` 或 `pages/AboutPage.tsx`

### § 7.1 读本规范 (§ 1 - § 6)

### § 7.2 跑 § 5.2 9 项版本号同步自检 (🆕 v3.0.33 8 处 + v3.0.36 加 2 项: web APP_VERSION_CODE + changelog scp)

```
□ mobile src/config/version.ts APP_VERSION
□ mobile build.gradle versionCode + versionName
□ server package.json version
□ server src/index.ts fallback 'X.Y.Z'
□ server ecosystem.config.js env + env_production (2 处, replaceAll) ← S66 BUG-069
□ web src/config/version.ts APP_VERSION + APP_VERSION_CODE (🆕 v3.0.36: APP_VERSION_CODE 必跟 mobile build.gradle versionCode 同步, S72 batch 5 BUG-087 漏改 38→39)
□ 🆕 server .env APP_VERSION ← S71 BUG-082 P3
□ 🆕 systemd unit /etc/systemd/system/shipin-app.service Environment=APP_VERSION ← S71 BUG-082 P3
□ changelog.json 追加当前版本条目 + 🆕 scp 到 /tmp/changelog.json (S72 batch 6 BUG-090 教训)
```

> 🆕 **S71 BUG-082 P3 教训**: S70 BUG-077 重构 shipin-APP 走 systemd 时, systemd unit 硬编码了 `Environment=APP_VERSION=3.0.29`, 但 `EnvironmentFile=-/www/wwwroot/shipin-APP/.env` 里的 `APP_VERSION=3.0.32` 实际生效 (systemd EnvironmentFile 优先级实测覆盖 [Service] Environment). 3 个月后才在 V3.0.33 升级时发现. **S71 后 8 处自检是底线, ecosystem.config.js 2 处 + .env + systemd unit 1 处都是隐藏 P3**
> 
> 🆕 **S72 batch 5 BUG-087 教训**: web `APP_VERSION_CODE` 必跟 mobile `build.gradle versionCode` 同步, S72 batch 5 v3.0.35 漏改 web 38→39, 落后 mobile 1 个版本. **9 项自检加 web APP_VERSION_CODE**
> 
> 🆕 **S72 batch 6 BUG-090 教训**: changelog.json 必须 scp 到 /tmp/, 部署 SOP 必加 `scp -i <key> apps/server/changelog.json root@<host>:/tmp/changelog.json`. deploy.sh 优先 /tmp/changelog.json (本机 scp 源, 新版本), fallback 到生产目录 (永远是上一版本) 时显式 warn
> 
> 🆕 **自检工具脚本**: `node tools/verify-version-8-points.js [NEW_VERSION]` — 自动跑 6 处本地 + 远程 .env + systemd unit (需 SSH key, 默认 C:\Users\Administrator\AppData\Local\Temp\shipin_app_key). 失败 exit 1. 后续 S73 必加 9 项: web APP_VERSION_CODE 同步 + changelog scp 验证

### § 7.3 跑 § 5.8 5 维验证

### § 7.4 改完代码 → 必跑 `apps/mobile/DEPLOY.md` § 5 升级部署流程

### § 7.5 commit message 必带版本号

```
git commit -m "v3.0.30: <一句话描述> (BUG-NNN)"
```

---

## § 8. 历史版本演进 (3.0.0+)

| 版本 | 日期 | 类别 | 主要内容 |
|---|---|---|---|
| 3.0.29 | 2026-06-24 | minor | 角色库 UI 商业化重设计 + 5 BUG 修复 (S63) |
| 3.0.28 | 2026-06-22 | minor | 角色库跟 Web 端 1:1 对齐 (S62) |
| 3.0.25 | 2026-06-19 | minor | LLM prompt 优化 + 分镜模式 (S61) |
| 3.0.22 | 2026-06-15 | patch | BUG-026 authorities 修复 |
| 3.0.21 | 2026-06-14 | patch | BUG-025 actionViewIntent 修复 |
| 3.0.13 | 2026-06-13 | major | 生图 Agent 极简 passthrough 模式 (S30) |
| 3.0.0 | 2026-06-09 | major | v3.0.0 整体升级 - Agent 矩阵 + 状态机重构 (S17) |
| 2.5.36 | 2026-06-09 | major | BUG 集中修复 + web deploy 脚本 + 版本号同步 (S13) |
| 2.5.0 | 2026-05-31 | major | v2.5.x 五大新功能落地 |
| 2.0.0 | 2026-06-04 | major | 角色一致性 + Web 端全新上线 |
| 1.0.0 | 2026-05-21 | major | 初始发布 |

(老版本演进看 v2.0.0 冻结版 docs/VERSION_POLICY.md, 仅作历史参考)

---

## § 9. 配套文档索引

### 9.1 跨端统一入口 (AI Agent 必读优先级排序, S68 收口后)

> **任何 AI 接手 shipin-APP, 必按以下顺序读**:
>
> **S68 收口核心变化**: 根 `AGENTS.md` 升级为跨端统一总入口 (§ 1-8: 中文/Persistence/跨端必读/跨端 6 铁律/工作流/Worker 9 条/代码 4 原则/禁新旧版). 各 app 端 `AGENTS.md` 瘦身只保留各 app 独有 (mobile 90→~70 行, server 236→~150 行). 设计理由: 跨端规范不重复 + 各 app 架构/任务 SOP 不混淆, 跟 GitHub Copilot/Codex/Cursor 标准一致.

0. **[`AGENTS.md`](../AGENTS.md)** (S68 升级) — 跨端统一总入口 (中文/Persistence/铁律/工作流), **必先读**
1. **[`docs/STANDARDS_EVOLUTION.md`](./STANDARDS_EVOLUTION.md)** — 规范自迭代 SOP (S65 新建, 347 行)
2. **[`docs/VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md)** — 跨端版本管理 (本文件)
3. **[`docs/standards/ADR/`](./standards/ADR/)** — 架构决策记录 (S65 新建)
4. **[`apps/mobile/AGENTS.md`](../apps/mobile/AGENTS.md)** (S68 瘦身) — mobile 端独有 (RN 栈 + 升级 7 铁律 + 改 mobile 代码前后 5 步)
5. **[`apps/server/AGENTS.md`](../apps/server/AGENTS.md)** (S67 新建 + S68 瘦身) — server 端独有 (部署 5 项 + 8 铁律 + 5 类任务 SOP + 代码架构)
6. **[`apps/mobile/BUGS.md`](../apps/mobile/BUGS.md)** — 跨端共用 BUG 案例库 (21 个 BUG, 含 BUG-066~070 S64-S67 + BUG-071 S68)
7. **[`apps/mobile/CODING_STANDARDS.md`](../apps/mobile/CODING_STANDARDS.md)** — 跨端共用硬性规范 (38 条)
8. **[`apps/mobile/DEPLOY.md`](../apps/mobile/DEPLOY.md)** — mobile 部署
9. **[`apps/web/DEPLOY.md`](../apps/web/DEPLOY.md)** — web 部署 (S65 新建)
10. **[`docs/DEPLOY.md`](./DEPLOY.md)** — server 部署 (server-only)
11. **[`docs/ENV_MANAGEMENT.md`](./ENV_MANAGEMENT.md)** (S66) — env 变量管理
12. **[`docs/PM2_GUIDE.md`](./PM2_GUIDE.md)** (S66) — PM2 + ecosystem 规范
13. **[`docs/DB_MIGRATION.md`](./DB_MIGRATION.md)** (S66) — DB schema 迁移 SOP
14. **[`docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](./notes/DEPLOYMENT_AND_BACKEND_RULES.md)** — 后端 worker 9 条实战约束
15. **`DEV_PROGRESS.md`** — AI 会话追踪表 (开始工作前必读, 根 AGENTS.md § 5)

### 9.2 完整索引

| 文件 | 关注点 |
|---|---|
| `docs/STANDARDS_EVOLUTION.md` (S65 新建) | 规范自迭代 SOP, 5 步修订流程, ADR 实践 |
| `docs/standards/ADR/0000-adr-template.md` (S65 新建) | ADR 模板 |
| `docs/standards/ADR/0001-server-changelog-source-of-truth.md` (S65 新建) | server changelog 单一来源决策 |
| `docs/ENV_MANAGEMENT.md` (S66 新建) | server env 变量管理 (强密钥 + 6 类轮换 + 防泄露 + 8 项 AI checklist) |
| `docs/PM2_GUIDE.md` (S66 新建) | PM2 + ecosystem.config.js 完整规范 (fork vs cluster + 10 条命令 + BUG-069 自检) |
| `docs/DB_MIGRATION.md` (S66 新建) | server DB 迁移 SOP (initTables 自动 vs 手动 SQL + 不删字段 + 跨版本回滚兼容性) |
| `apps/server/AGENTS.md` (S67 新建 + S68 瘦身) | **server 端 AI 入口** (跟 mobile AGENTS.md 对称, 含部署 5 项 + 8 条铁律 + 5 类任务 SOP; 跨端规范收口到根 AGENTS.md) |
| `apps/mobile/AGENTS.md` (S68 瘦身) | Mobile AI Agent 入口 (RN 栈 + 升级 7 铁律 + 改 mobile 代码前后 5 步; 跨端规范收口到根 AGENTS.md) |
| `AGENTS.md` (S68 升级 v2.0) | **跨端统一总入口** (中文/Persistence/跨端必读 15 项/跨端 6 铁律/工作流/Worker 9 条/代码 4 原则/禁新旧版/子项目 AGENTS.md 入口) |
| `apps/mobile/BUGS.md` | 历史 BUG (BUG-066/067/068/069/070 S64-S67 + BUG-071 S68 收口) |
| `apps/mobile/CODING_STANDARDS.md` | 硬性规范 (第 30/31/32 条 S64, 第 33 条 S65, 第 34-37 条 S66) |
| `apps/mobile/DEPLOY.md` | Mobile 端完整部署 SOP |
| `apps/server/deploy.sh` | Server 远端部署脚本 (公告 + 维护 + 重启) |
| `apps/server/.env.example` (S66 补全) | env 变量模板 (4 类必填/可选) |
| `apps/web/scripts/deploy.sh` | Web 端部署脚本 (本地 build + scp + nginx reload) |
| `apps/web/DEPLOY.md` (S65 新建) | Web 端配套规范 (5 步 + 5 维验证) |
| `docs/DEPLOY.md` | Server-only 部署 SOP (11 节点 + 6 维验证 + § 4.5 日志管理 S66) |
| `docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md` | 后端 worker 9 条实战约束 |
| `DEV_PROGRESS.md` | AI 会话追踪表 |
| `docs/APP_RELEASE_GUIDE.md` (S65 冻结) | v1.1.0 时代发布指南, 已废弃, 指向本文件 |

### 9.3 文档分工 (避免重复)

| 主题 | 哪份负责 |
|---|---|
| 跨端发版 SOP | `docs/VERSION_MANAGEMENT.md` § 5 (本文件) |
| Server-only 部署 | `docs/DEPLOY.md` |
| Mobile APK 升级 | `apps/mobile/DEPLOY.md` |
| Web 部署 | `apps/web/DEPLOY.md` (S65 新建) |
| 规范怎么跟版本迭代 | `docs/STANDARDS_EVOLUTION.md` (S65 新建) |
| **后端 env 变量管理** | `docs/ENV_MANAGEMENT.md` (S66 新建, 含强密钥生成 + 6 类轮换 + 防泄露) |
| **PM2 + ecosystem 完整规范** | `docs/PM2_GUIDE.md` (S66 新建, 含 fork vs cluster + 10 条命令 + BUG-069 自检) |
| **DB 迁移 SOP** | `docs/DB_MIGRATION.md` (S66 新建, 含 initTables 自动 vs 手动 SQL + 不删字段) |
| 后端 worker 实战约束 | `docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md` |
| 架构决策追溯 | `docs/standards/ADR/` (S65 新建) |
| 历史 BUG | `apps/mobile/BUGS.md` |
| 硬性规范 | `apps/mobile/CODING_STANDARDS.md` |
| 5 维 vs 6 维验证分工 | `VERSION_MANAGEMENT.md` § 5.8 (5 维跨端) + `docs/DEPLOY.md` § 6 (6 维 server-only) |
| server 后端日志查询 | `docs/DEPLOY.md` § 4.5 (S66 新增) |

---

### § 5.B 完整发版 SOP (S72 batch 6 v3.0.36 实战, 8 步完整流程)

> **🆕 v3.0.36 (S72 batch 6) 新建**: 本节是 S72 batch 6 完整跑通的发版流程总结, 跟 § 5 标准 8 步 + § 5.A 活跃任务部署配套.
> **目的**: 让任何 AI 接 shipin-APP 发版任务时, 走完整 8 步流程, **不再撞 BUG-087/090 这类"漏改一处"的坑**.

#### 步骤 1: 改 9 项版本号 (本地, 必跑 § 5.2 自检)

```bash
APP_VERSION='3.0.36'
APP_VERSION_CODE=41  # mobile versionCode = web APP_VERSION_CODE, 必同步 (S72 batch 5 漏改 教训)

# 1. mobile src/config/version.ts
# 2. mobile build.gradle (versionCode N+1; versionName "$APP_VERSION")
# 3. server package.json
# 4. server src/index.ts fallback
# 5. server ecosystem.config.js (env + env_production 2 处, replaceAll)
# 6. web src/config/version.ts (APP_VERSION + APP_VERSION_CODE, 必跟 mobile build.gradle versionCode 同步)
# 7. server .env APP_VERSION (本地 + 部署时)
# 8. systemd unit /etc/systemd/system/shipin-app.service (Environment=APP_VERSION, 部署时)
# 9. changelog.json 加新版本 entry (5 条 highlights + buildDate 必填)
```

**自检** (9 项必全过):
```bash
grep "APP_VERSION = '$APP_VERSION'" apps/mobile/src/config/version.ts
grep "versionName \"$APP_VERSION\"" apps/mobile/android/app/build.gradle
grep "\"version\": \"$APP_VERSION\"" apps/server/package.json
grep "process.env.APP_VERSION || '$APP_VERSION'" apps/server/src/index.ts
grep "APP_VERSION: '$APP_VERSION'" apps/server/ecosystem.config.js  # 2 处
grep "APP_VERSION = '$APP_VERSION'" apps/web/src/config/version.ts
grep "APP_VERSION_CODE = $APP_VERSION_CODE" apps/web/src/config/version.ts  # 🆕 同步 mobile
grep "$APP_VERSION" apps/server/changelog.json
```

#### 步骤 2: 本地编译 + 打包 (5 min)

```bash
# 2.1 跑 tsc 编译 + tsc --noEmit
cd F:\QiTa\banmu\APP\ai-video-script-app\apps\server
npm run build
# 期望: tsc 0 错, dist/index.js 200+ 行完整 (BUG-073 教训)

# 2.2 cp changelog.json dist/ (tsc 不复制 json)
cp changelog.json dist/changelog.json

# 2.3 打包 (排除 backup + dev 依赖)
cd ..
tar czf dist-server-v3.0.36-20260626_1000.tar.gz \
  --exclude='dist.bak*' \
  server/dist server/changelog.json server/ecosystem.config.js server/.env.example
```

#### 步骤 3: 打 mobile APK (3-5 min, 跟 server 并行)

```bash
cd F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android
./gradlew assembleRelease
# 产出: app/build/outputs/apk/release/app-release.apk
```

**APK metadata 验证** (必跑, BUG-074 教训):
```bash
aapt2 dump badging app-release.apk | head -1
# 期望: versionName='3.0.36' versionCode='41'

apksigner verify --print-certs app-release.apk | grep "DN:"
# 期望: CN=DeepScript Release, O=shipin-APP, L=Shenzhen, ST=Guangdong, C=CN
```

#### 步骤 4: scp 上传 4 件套 (3 min, 🆕 v3.0.36 BUG-090 必加 changelog.json)

```bash
# 4.1 ssh-agent 加载
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add C:\Users\Administrator\.ssh\shipin_user_key

# 4.2 scp 4 件套 (必加 changelog.json, BUG-090 教训)
scp -i <key> apps/server/dist-server-v3.0.36-20260626_1000.tar.gz  root@<host>:/tmp/dist.tar.gz
scp -i <key> apps/server/package.json                              root@<host>:/tmp/package.json
scp -i <key> apps/server/changelog.json                            root@<host>:/tmp/changelog.json  # 🆕 BUG-090
scp -i <key> apps/mobile/android/app/build/outputs/apk/release/app-release.apk  root@<host>:/www/wwwroot/shipin-APP/public/DeepScript_v3.0.36.apk
```

**原因** (跨项目通用): deploy.sh 的所有 `cp` 源必须用 `/tmp/` (本机 scp 源 = 新版本), **不能从生产目录拿 (永远是上一版本)**. 12 维验证必查 `/api/version` 的 `changelog` + `highlights` + `buildDate` 字段 (BUG-090 教训).

#### 步骤 5: 服务器端部署 (8 min, 走 systemd, 不是 PM2)

```bash
# 5.1 ssh 到服务器
ssh root@<host>

# 5.2 检查活跃任务 (S67 BUG-070 教训)
COUNT=$(curl -s http://127.0.0.1:6000/api/admin/active-tasks | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
if [ "$COUNT" -gt 0 ]; then
  bash /www/wwwroot/shipin-APP/deploy.sh   # 跑维护模式 9 步
else
  bash /www/wwwroot/shipin-APP/deploy.sh --skip-maintenance
fi
# deploy.sh 自动: 维护模式 + 6 维预检 + 备份 + 解压 + 同步 9 项版本号 + 重启 systemd + 宝塔同步 + 12 维验证
# 详细: apps/server/deploy.sh + docs/BAOTA_NODE_PROJECT_DEPLOY.md § 2
```

#### 步骤 6: web build + 部署 (跟 server 并行)

```bash
cd F:\QiTa\banmu\APP\ai-video-script-app\apps\web
npm run build
scp -r dist/* root@<host>:/www/wwwroot/ab.maque.uno/
```

#### 步骤 7: 12 维验证 (铁律 5, 必跑)

```bash
# 7.1 服务自身 6 维
echo "1.  systemctl shipin-app: $(systemctl is-active shipin-app)"
echo "2.  ss 6000:             $(ss -tln | grep ':6000' | head -1 | awk '{print $4}')"
echo "3.  /health:             $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d \\r)"
echo "4.  /api/version:        $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "5.  characterVariant:    $(curl -sm 3 http://127.0.0.1:6000/api/pricing | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["image"]["standard"]["characterVariant"]["amount"])')"
echo "6.  /api/novels:         $(curl -sI -m 3 http://127.0.0.1:6000/api/novels | head -1 | tr -d \\r)"

# 7.2 宝塔 + 反代 4 维
echo "7.  宝塔 nginx 80:       $(ss -tln | grep ':80 ' | head -1 | awk '{print $4}')"
echo "8.  宝塔 panel 888:      $(ss -tln | grep ':888 ' | head -1 | awk '{print $4}')"
echo "9.  ab.maque.uno HTTPS:  $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "10. APK HTTP/2 200:      $(curl -sIk -m 5 https://ab.maque.uno/app/DeepScript_v3.0.36.apk | head -1 | tr -d \\r)"

# 7.3 宝塔 Node 项目 shipin_APP 2 维 (BUG-077 验收)
echo "11. 宝塔 shipin_APP run: $(python3 -c '...')"  # 详见 BAOTA_NODE_PROJECT_DEPLOY.md § 2.4
echo "12. 宝塔 shipin_APP cfg: run_user=root is_power_on=1"

# 7.4 🆕 v3.0.36 (BUG-090) 必加 changelog 4 字段验证
echo "13. /api/version changelog 4 字段:"
curl -sm 3 https://ab.maque.uno/api/version | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'   version:   {d[\"version\"]}')
print(f'   changelog: {d.get(\"changelog\", \"MISSING\")}')
print(f'   highlights: {len(d.get(\"highlights\", []))} 条')
print(f'   buildDate: {d.get(\"buildDate\", \"MISSING\")}')
# 期望: version='3.0.36' + changelog 是 1 句话 (非通用文案) + highlights 5 条 + buildDate='2026-06-26'
"
```

**期望所有 12+ 维全过** (跟 S72 batch 6 v3.0.36 部署一致).

#### 步骤 8: 文档更新 + commit + push (5 min)

```bash
# 8.1 改 apps/mobile/BUGS.md (新 BUG 加段, BUG-NNN)
# 8.2 改 docs/BUGS_INDEX.md (新 BUG 加 § 1/2/4)
# 8.3 改 HANDOVER.md (新 session 段 + § 5 坑点)
# 8.4 改 apps/server/changelog.json (v3.0.36 entry)
# 8.5 commit 3 个 (代码 / 版本号 / 文档)
git add -A
git commit -m "v3.0.36: BUG-088 + BUG-089 + BUG-090 修法 (代码修复)"
git commit -m "v3.0.36: 9 项版本号同步 (S72 batch 6)"
git commit -m "v3.0.36: BUG-090 修 deploy.sh /tmp/changelog.json 优先"
git push origin main
```

**完整发版 SOP 配套文档**:
- `docs/BAOTA_NODE_PROJECT_DEPLOY.md` (S70 v1.0, shipin-APP 宝塔部署详细 5 步 + 12 维 + 9 坑 + 紧急回滚)
- `apps/server/deploy.sh` (S70 v2.0, 9 步 systemd 路径)
- `scripts/verify-deploy.sh` (S71 后置, 14→20 维 strict 验证脚本)

**🆕 v3.0.36 (S72 batch 6) 新增的 3 个硬要求**:
1. **scp 必加 changelog.json** (步骤 4) — BUG-090 教训
2. **12 维验证必加 changelog 4 字段** (步骤 7) — BUG-090 教训
3. **web APP_VERSION_CODE 必跟 mobile build.gradle versionCode 同步** (步骤 1 第 6 项) — S72 batch 5 BUG-087 教训

---

> **最后更新**: 2026-06-26 (S72 batch 6 收口 v2.1, 加 § 5.B 完整发版 SOP, 含 BUG-090 修法: scp changelog.json + 12 维验证查 changelog + APP_VERSION_CODE 同步)
> **下次 review**: 每个 3 类发版后必更新本文件 + 触发 [`STANDARDS_EVOLUTION.md` § 3 5 步修订流程](./STANDARDS_EVOLUTION.md)
