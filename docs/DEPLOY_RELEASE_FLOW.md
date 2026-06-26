# DeepScript 跨端部署 + 发布流程 (Deployment & Release Flow)

> **本文件**: shipin-APP 全栈 (server + web + mobile) 部署 + 发布的**主入口 SOP**。
> **目的**: 让任何 AI Agent 接手 shipin-APP 后, 读完本文档即可独立完成"改代码 → 部署 → 公网发布 → 触发用户端自动更新"完整流程。
> **版本**: v1.0 (2026-06-26, S72 batch 7 后建立, 整合 BUG-079/082/090/094/095/096/097/098/099 9 教训)
> **关联文档** (分层引用, 详情跳转):
> - **Server 部署细节**: [`docs/DEPLOY.md`](./DEPLOY.md) (11 节点 SOP, 6 维验证) + [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](./BAOTA_NODE_PROJECT_DEPLOY.md) (宝塔 5 步)
> - **Mobile 部署细节**: [`apps/mobile/DEPLOY.md`](../apps/mobile/DEPLOY.md) (mobile 升级 5 步 + 7 类失败诊断)
> - **版本号管理**: [`docs/VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) (X.Y.Z 规则 + 9 项同步)
> - **规范自迭代**: [`docs/STANDARDS_EVOLUTION.md`](./STANDARDS_EVOLUTION.md) (改规则必更文档)
> - **BUG 案例**: [`docs/BUGS_INDEX.md`](./BUGS_INDEX.md) (99 BUG 索引) + [`apps/mobile/BUGS.md`](../apps/mobile/BUGS.md) (mobile 完整案例)
>
> ⚠️ **强约束**: 任何部署前必读本文档 § 0-9, 缺一不可; 任何 BUG 必修后必更相关章节 + BUGS_INDEX.md + mavis memory。

---

## § 0. 部署架构一张图 (1 分钟理解 shipin-APP 全貌)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          本机 (Windows 11)                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                      │
│  │ Node 22.22.2 │ │ nodejs 20.x  │ │ JDK 17 +     │                      │
│  │ + npm + tsc  │ │ + vite 5     │ │ gradle 8.3   │                      │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                      │
│         │                │                │                              │
│    apps/server/      apps/web/        apps/mobile/android/                │
│    (Express+MySQL)   (React+Vite)     (RN 0.73+Hermes)                    │
│         │                │                │                              │
│         └──── tsc build ─┘                │ gradlew assembleRelease       │
│                  ↓                        ↓                              │
│         ┌────────────────┐        ┌─────────────────┐                    │
│         │ dist/ (≤100行?) │       │ app-release.apk │                    │
│         │  + changelog.json│       │ (~30 MB)        │                    │
│         │  + package.json │        │  + 永久签名      │                    │
│         └────────┬───────┘        └────────┬────────┘                    │
│                  │ scp                      │ scp                         │
└──────────────────┼──────────────────────────┼───────────────────────────┘
                   ↓                          ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                  远端 (Ubuntu 22.04, 159.75.16.110)                       │
│                                                                           │
│  /www/wwwroot/shipin-APP/              /www/wwwroot/ab.maque.uno/        │
│  ├── dist/index.js (server 进程)        └── dist/assets/index-*.js (web) │
│  ├── changelog.json                                              + index.html
│  ├── package.json                                                nginx 静态
│  └── public/DeepScript_v3.0.37.apk (公网 APK)                       │
│         ↑                                                              │
│         └── /www/server/nodejs/vhost/scripts/shipin_APP.sh             │
│             (宝塔 panel "项目" → 启停 + systemd Type=simple)              │
│             ↓                                                            │
│  /etc/systemd/system/shipin-app.service                                 │
│  (Environment=APP_VERSION=3.0.37 + WorkingDirectory=...)                │
│             ↓                                                            │
│  Node 进程 (PID 文件: /www/server/nodejs/vhost/pids/shipin_APP.pid)     │
│         ↓                                                              │
│  监听 http://127.0.0.1:6000                                              │
│         ↓                                                              │
│  宝塔 nginx (master pid 14921)                                           │
│  /www/server/panel/vhost/nginx/ab.maque.uno.conf                         │
│  ├── location /api/ → proxy_pass http://127.0.0.1:6000                  │
│  ├── location /app/ → alias /www/wwwroot/shipin-APP/public/             │
│  └── location /ws/  → proxy_pass http://127.0.0.1:6000                  │
│         ↓                                                              │
│  HTTPS (443, Let's Encrypt)                                              │
└──────────────────────────────────────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                       公网 (https://ab.maque.uno)                          │
│  ├── /  → web SPA (React, https://ab.maque.uno)                          │
│  ├── /api/ → server 6000 (JWT 鉴权, REST API)                            │
│  ├── /app/ → APK 下载 (https://ab.maque.uno/app/DeepScript_v3.0.37.apk)  │
│  └── /ws/  → WebSocket (实时消息)                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**关键事实**:
- **部署根** = `/www/wwwroot/shipin-APP` (flat 结构, **不是** monorepo 嵌套)
- **进程管理** = **systemd unit** `shipin-app.service` (S70 BUG-077 后, **不用** PM2)
- **宝塔 panel** 显示项目名 = `shipin_APP` (下划线, **不是** `shipin-APP`)
- **9 项版本号**: 9 个文件必须同步改, 漏一个 = 假报告 (BUG-090 教训)
- **跨端同步** = Web 主导 APP 跟随 (铁律 4++, 反 S70 之前"主盯 web, 安卓暂不动"旧原则)

---

## § 1. 跨端版本号管理 (9 项同步清单, BUG-090 防呆核心)

### 1.1 X.Y.Z 规则 (semver-like, 1/2/3 类更新)

```
X.Y.Z
│ │ └─── Z (patch) UI 文案/样式/icon/视觉微调, 不改功能
│ └───── Y (minor) 1+小功能 (设置项/字段/交互优化)
└─────── X (major) 1+2+核心架构变更 (AI 模型/状态机/新业务线)
```

**配套规则** (Bump 时必问):
- **Bump 1**: 只改文案/样式 → 1 位
- **Bump 2**: 加小功能/字段 → 2 位
- **Bump 3**: 改核心架构/状态机/AI 模型 → 1 位 + 1 reset 0
- **修 BUG**: 默认 bump 1 位 (patch), 重大 BUG 影响核心功能可 bump 2

### 1.2 9 项同步清单 (改一处必改 9 处, BUG-090 防呆)

| # | 文件 | 字段 | 例 (v3.0.37) | 检查方式 |
|---|---|---|---|---|
| 1 | `apps/mobile/src/config/version.ts` | `APP_VERSION` + `APP_VERSION_CODE` | `'3.0.37'` + `42` | `grep -A 2 'export const APP_VERSION' apps/mobile/src/config/version.ts` |
| 2 | `apps/mobile/android/app/build.gradle` | `versionCode` + `versionName` | `42` + `"3.0.37"` | `grep -E 'versionCode\|versionName' apps/mobile/android/app/build.gradle` |
| 3 | `apps/server/package.json` | `"version"` | `"3.0.37"` | `grep '"version"' apps/server/package.json` |
| 4 | `apps/server/src/index.ts` | fallback 字符串 | `'3.0.37'` | `grep 'APP_VERSION\|3\.0\.37' apps/server/src/index.ts` |
| 5 | `apps/server/ecosystem.config.js` | `APP_VERSION` 2 处 | `'3.0.37'` | `grep 'APP_VERSION' apps/server/ecosystem.config.js` (deprecated, S70 后) |
| 6 | `apps/web/src/config/version.ts` | `APP_VERSION` + `APP_VERSION_CODE` | `'3.0.37'` + `42` | `grep -A 2 'export const APP_VERSION' apps/web/src/config/version.ts` |
| 7 | `apps/server/.env` | `APP_VERSION` | `3.0.37` | `grep APP_VERSION apps/server/.env` |
| 8 | `/etc/systemd/system/shipin-app.service` (远端) | `Environment=APP_VERSION=...` | `3.0.37` | `ssh root@159.75.16.110 'grep APP_VERSION /etc/systemd/system/shipin-app.service'` |
| 9 | `apps/server/changelog.json` | `latest_version` + `versions[0]` | `"3.0.37"` | `grep latest_version apps/server/changelog.json` |

**🚨 必查**: 9 项改完必须**全 grep 一遍**, 跟 `app/scripts/check-version-sync.sh` (待补工具, S72 待办) 1:1 校验。

### 1.3 changelog.json 12 highlights 模板 (BUG-090 防呆)

```json
{
  "latest_version": "3.0.37",
  "buildDate": "2026-06-26",
  "highlights": [
    "BUG-092 修法: '我已付款'按钮 + 4 态机 (server db/model/route + web api/UI + mobile api/UI 5+1 端到端)",
    "BUG-093 修法 2+3: check-commit-message.py N 5→10 + pre-commit hook 安装",
    "BUG-094 修法: admin 默认查 user_notified (state 迁移同步 4 处)",
    "BUG-095 修法: DB schema enum 加 'user_notified' (state 迁移同步 5 处 = BUG-081 升级)",
    "BUG-096 修法: 删 React {0} 渲染陷阱 (o.userNotifiedAt && 第一个短路 → ? 三目)",
    "BUG-097 修法: mobile 端同步 web 端 3 BUG (notify-paid 按钮 + admin 默认查 user_notified + 5 tab)",
    "BUG-098 修法: admin approve 抛 500 修 2 处 SQL (updateStatus 缺 id + topUp 多 ref_label)",
    "BUG-099 修法: web dist 重新 build + scp + 宝塔 nginx reload",
    "铁律 4++: Web 主导 APP 跟随, 跨端同步 SOP",
    "维度 23-24: verify-deploy 升 23→24 维 (BUG-096 + 铁律 4++)",
    "verify-apk.py: APK 永久 verify 工具 (SHA256 + 签名 + BUG-097 命中)",
    "deploy-bug099.sh: web dist 破坏部署修复 (跟 BUG-096 同款)"
  ],
  "versions": [
    {
      "version": "3.0.37",
      "buildDate": "2026-06-26",
      "highlights": [...]  // 完整
    }
  ]
}
```

**必查 (维度 22)**: deploy 完跑 `verify-deploy.sh` 维度 22, 检查 `/api/version` 4 字段:
- `version == APP_VERSION` (强一致, 不符 FAIL)
- `changelog` 非空且非通用文案 (`'优化性能，修复已知问题'` = FAIL)
- `highlights.length >= 3`
- `buildDate` 匹配 `^\d{4}-\d{2}-\d{2}$`

---

## § 2. Server 部署 5 步 SOP (本机 → 远端 systemd, ~5 min)

> **适用**: 改完 `apps/server/src/**/*.ts` 后, 必跑。
> **脚本**: `apps/server/scripts/deploy.sh` (主流程) + `deploy-bugNNN.sh` (单 BUG 修复)

### 步骤 1: 本机 build (1 min)

```bash
Set-Location F:\QiTa\banmu\APP\ai-video-script-app
cd apps/server
npm install                    # 仅 package.json 改时才需要, 否则跳过
npm run build                  # tsc → dist/
```

**🚨 必查 (铁律 7)**:
- dist/index.js **行数 ≥ 50** (S54 BUG-073 教训: < 50 = tsc 编译坏, 跑老 .js)
- `grep -c '^\s*$\|^\s*//' dist/index.js` < 100 (空行 + 注释比例)
- `ls -la dist/*.js | wc -l` 跟 src/ 1:1 匹配

### 步骤 2: 打包 + scp (30 s)

```powershell
# PS 5.1 注意: tar 中文路径要 -Encoding UTF8, 排除 node_modules + .ts + .git
$tgt = Get-Date -Format 'yyyyMMdd-HHmmss'
cd F:\QiTa\banmu\APP\ai-video-script-app
tar -czf "apps\server\dist_$tgt.tar.gz" `
  --exclude='node_modules' --exclude='*.ts' --exclude='.git' `
  --exclude='dist_*.tar.gz' --exclude='deploy.sh.original' `
  --exclude='NUL' `
  apps/server/dist apps/server/package.json apps/server/changelog.json
```

```bash
# 远端 bash 解压 (优先 /tmp/, 跟 BUG-090 deploy.sh 原则一致)
scp -i C:\Users\Administrator\.ssh\test2 `
  "F:\QiTa\banmu\APP\ai-video-script-app\apps\server\dist_$tgt.tar.gz" `
  root@159.75.16.110:/tmp/

ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/shipin-APP &&
  cp -r dist dist.bak.$tgt &&
  tar -xzf /tmp/dist_$tgt.tar.gz --strip-components=2 &&
  cp -f /tmp/changelog.json dist/changelog.json 2>/dev/null || echo 'warn: no /tmp/changelog.json'
"
```

### 步骤 3: 宝塔 Node 项目 reload (10 s, 不用 PM2, S70 BUG-077 后)

```bash
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  # 1. env 同步 (如果有改)
  cp -f /tmp/.env /www/wwwroot/shipin-APP/.env 2>/dev/null || true

  # 2. 走宝塔 panel Node 项目脚本 (systemd Type=simple)
  /www/server/nodejs/vhost/scripts/shipin_APP.sh restart

  # 3. 验证 systemd unit 状态
  systemctl status shipin-app.service --no-pager -l | head -20
"
```

**🚨 关键**:
- **不要**用 `pm2 restart` (S70 BUG-077 教训, PM2 + systemd 双进程冲突)
- **不要**用 `systemctl restart shipin-app.service` 直接 (要用宝塔脚本, 它会更新 pid 文件)
- **不要**改 PID 文件路径 (宝塔 panel Node 项目绑定 `/www/server/nodejs/vhost/pids/shipin_APP.pid`)

### 步骤 4: 验证 24 维 (30 s, BUG-079/090/096/098 防呆)

```bash
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  bash /tmp/verify-deploy.sh
"
```

**24 维必看 (PASS=24/24)**:
- 维度 1-12: server 端 (进程 / 端口 / /health / /api/version 4 字段 / DB schema / 数据量 / HTTPS)
- 维度 13-14: 公开 HTTPS + web JS hash
- 维度 15-16: web dist 静态分析 (BUG-080 防呆)
- 维度 17-19: BUG-082 error part.message 归一 (server + web + provider 层)
- 维度 20: BUG-081 状态机迁移 (allowedStates grep)
- 维度 21: BUG-083 dist/changelog.json UTF-8 完整 (Chinese 损坏检测)
- 维度 22: BUG-090 /api/version 4 字段验证
- **维度 23 (🆕 S72 batch 7)**: BUG-096 web dist `userNotifiedAt>` 1 命中 (minifier 优化 `> 0` → `>`)
- **维度 24 (🆕 S72 batch 7)**: 铁律 4++ mobile 端同步 (APK bundle grep `notifyRechargePaid` + `user_notified`)

### 步骤 5: 收尾 (10 s)

```powershell
# 1. trash 本机 tarball (跟 BUG-079 教训, 不残留)
mavis-trash F:\QiTa\banmu\APP\ai-video-script-app\apps\server\dist_$tgt.tar.gz

# 2. 必跑铁律 6 自检
python3 F:\QiTa\banmu\APP\ai-video-script-app\tools\check-commit-message.py

# 3. commit + push (subject 必带 BUG-NNN 或 v3.X.Y 类型)
cd F:\QiTa\banmu\APP\ai-video-script-app
git add -A
git commit -m 'v3.0.37 BUG-XXX: <一句话描述>'
git push origin main
```

**回滚 (BUG 应急)**:
```bash
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/shipin-APP &&
  /www/server/nodejs/vhost/scripts/shipin_APP.sh stop &&
  rm -rf dist &&
  mv dist.bak.$tgt dist &&
  /www/server/nodejs/vhost/scripts/shipin_APP.sh start
"
```

---

## § 3. Web 部署 4 步 SOP (本机 → 远端 nginx, ~3 min)

> **适用**: 改完 `apps/web/src/**/*.{ts,tsx,css}` 后, 必跑。
> **脚本**: `apps/web/scripts/deploy.sh` (主流程)

### 步骤 1: 本机 build (1 min)

```bash
Set-Location F:\QiTa\banmu\APP\ai-video-script-app
cd apps/web
npm install                    # 仅 package.json 改时才需要
npm run build                  # vite → dist/
```

**🚨 必查 (BUG-099 防呆)**:
- dist/assets/index-*.js **单文件 ≥ 100 KB** (vite 正常)
- `ls -la dist/assets/ | wc -l` ≥ 10 (vite 自动 split chunks)
- `head -c 2 dist/assets/index-*.js` = `//` (vite minified 注释, **不能**是 `0\n`)

### 步骤 2: 打包 + scp (30 s)

```powershell
$tgt = Get-Date -Format 'yyyyMMdd-HHmmss'
cd F:\QiTa\banmu\APP\ai-video-script-app
tar -czf "apps\web\web-dist-$tgt.tgz" `
  --exclude='node_modules' --exclude='src' --exclude='.git' `
  --exclude='web-dist-*.tgz' `
  apps/web/dist

scp -i C:\Users\Administrator\.ssh\test2 `
  "F:\QiTa\banmu\APP\ai-video-script-app\apps\web\web-dist-$tgt.tgz" `
  root@159.75.16.110:/tmp/
```

### 步骤 3: 远端解压 + nginx reload (10 s, BUG-099 配套)

```bash
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  # 1. 备份 (跟 server 部署一致)
  cd /www/wwwroot/ab.maque.uno &&
  cp -r dist dist.bak.$tgt 2>/dev/null || true

  # 2. 解压 (strip-components=2: apps/web/dist → dist)
  tar -xzf /tmp/web-dist-$tgt.tgz --strip-components=2 -C /www/wwwroot/ab.maque.uno/

  # 3. 修权限 (宝塔 nginx user=www)
  chown -R www:www /www/wwwroot/ab.maque.uno/dist

  # 4. 宝塔 nginx reload (不 restart, 保持 master pid 14921)
  /etc/init.d/nginx reload
"
```

**🚨 必查 (BUG-099 防呆)**:
```bash
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  # 验 dist 真解压 + 关键 JS 存在
  ls -la /www/wwwroot/ab.maque.uno/dist/assets/index-*.js
  head -c 100 /www/wwwroot/ab.maque.uno/dist/assets/index-*.js | head -1
"
# 预期: 文件大小 ≥ 100 KB + 第一行 = `//` (vite minified)
# 异常: < 1 KB 或 `0\n` = BUG-099 同款 (重复步骤 1-2)
```

### 步骤 4: 公网验证 (10 s, BUG-080 防呆)

```powershell
# 1. HTTPS HEAD (验 nginx 200 + content-type)
curl -I https://ab.maque.uno/

# 2. 验实际加载 JS (chrome devtools network 抓 main JS)
# 预期: index-XXX.js, size ≥ 100 KB, hash 跟 dist 同步
```

**回滚 (BUG-099 应急)**:
```bash
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/ab.maque.uno &&
  rm -rf dist &&
  mv dist.bak.$tgt dist &&
  chown -R www:www dist &&
  /etc/init.d/nginx reload
"
```

---

## § 4. Mobile APK 发布 5 步 SOP (本机 → 远端公网, ~10 min)

> **适用**: 改完 `apps/mobile/src/**/*.tsx` + BUG 修完后, 必跑。
> **配套工具**: `apps/mobile/scripts/verify-apk.py` (永久 verify)
> **自动给更新机制**: 装老 APK 的 user 启动 → 自动检测 → 弹升级窗 (详 § 5)

### 步骤 1: 9 项版本号同步 (5 min, BUG-090 防呆)

```bash
Set-Location F:\QiTa\banmu\APP\ai-video-script-app
# 改前 4 项
1. apps/mobile/src/config/version.ts: APP_VERSION + APP_VERSION_CODE
2. apps/mobile/android/app/build.gradle: versionCode + versionName
3. apps/server/package.json: version
4. apps/server/src/index.ts: fallback 'X.Y.Z'
5. apps/server/ecosystem.config.js: APP_VERSION 2 处
6. apps/web/src/config/version.ts: APP_VERSION + APP_VERSION_CODE
7. apps/server/.env: APP_VERSION=X.Y.Z
# 改后 2 项 (远端)
8. ssh root@159.75.16.110 "sed -i 's/APP_VERSION=.*/APP_VERSION=X.Y.Z/' /etc/systemd/system/shipin-app.service && systemctl daemon-reload"
9. apps/server/changelog.json: latest_version + versions[0] (12 highlights)
```

**🚨 必跑**:
```bash
# 9 项 grep 校验 (FAIL = 漏同步)
for f in \
  "apps/mobile/src/config/version.ts:APP_VERSION" \
  "apps/mobile/android/app/build.gradle:versionName" \
  "apps/server/package.json:version" \
  "apps/server/src/index.ts:3.0.37" \
  "apps/server/ecosystem.config.js:APP_VERSION" \
  "apps/web/src/config/version.ts:APP_VERSION" \
  "apps/server/.env:APP_VERSION"; do
  echo "=== $f ==="
  grep -E "$f" F:/QiTa/banmu/APP/ai-video-script-app/${f%%:*} 2>/dev/null
done
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 \
  "grep APP_VERSION /etc/systemd/system/shipin-app.service /www/wwwroot/shipin-APP/.env 2>&1"
```

### 步骤 2: 重新 build APK (3-5 min, 5 步 build)

```bash
Set-Location F:\QiTa\banmu\APP\ai-video-script-app
cd apps/mobile/android

# 1. 清理 (改 native 依赖时才需要)
# gradlew clean

# 2. assembleRelease (RN bundle + Hermes compile + 签名)
.\gradlew assembleRelease

# 3. 产出
ls -la app\build\outputs\apk\release\app-release.apk
# 预期: ~30 MB, 跟上一版 ±1 MB 浮动
```

**🚨 必查 (BUG-023/097 防呆)**:
- BUILD SUCCESSFUL (有错立即修, 不允许 silent fail)
- 警告数 ≤ 5 (mobile 走 babel 不跑 tsc, 旧 TS 错不阻断, 但要 ≤ 5 警告)
- APK **永久签名** (`META-INF/CERT.RSA` 1364 bytes, 跟 BUG-023 一致)
- `assets/index.android.bundle` ≥ 1 MB (RN bundle, 含 mobile 端 BUG 修法)

### 步骤 3: verify-apk.py 永久验证 (10 s, BUG-023/097 防呆)

```bash
Set-Location F:\QiTa\banmu\APP\ai-video-script-app
python3 apps/mobile/scripts/verify-apk.py
```

**3 必查** (FAIL = 不许发布):
1. **SHA256** 跟本机 APK 1:1 匹配 (避免 0-byte/2-byte 破坏, BUG-099 同源)
2. **META-INF/CERT.RSA** 存在 (BUG-023 永久签名, 1376 bytes, 跟历史一致)
3. **assets/index.android.bundle** 含本批次 BUG 修法 (BUG-097: `notifyRechargePaid` + `user_notified` + `adminOrders` 各 ≥ 1 命中)

**例 (v3.0.37)**:
```
✅ SHA256: 20eff4b04cb4245fda0b680c497b49c1321b40d03a2d7d9cc9ed7b15152fb5dc
✅ META-INF/CERT.RSA: 1364 bytes (BUG-023 永久签名)
✅ bundle BUG-097 命中: notifyRechargePaid=1, user_notified=1, adminOrders=1
```

### 步骤 4: scp 上传公网 (10 s, BUG-023 配套)

```bash
Set-Location F:\QiTa\banmu\APP\ai-video-script-app
scp -i C:\Users\Administrator\.ssh\test2 `
  apps/mobile/android/app/build/outputs/apk/release/app-release.apk `
  root@159.75.16.110:/www/wwwroot/shipin-APP/public/DeepScript_v3.0.37.apk
```

**🚨 关键 (S58 P10 BUG-021/022 教训)**:
- 路径 = `/www/wwwroot/shipin-APP/public/` (nginx location /app/ 反代, **不是** web 根)
- 文件名 = `DeepScript_v3.0.37.apk` (带版本号, 跟 BUG-066 跨版本下载配套)
- 旧 APK 保留 (不删, 历史 APK 列表 `ls /www/wwwroot/shipin-APP/public/DeepScript_v*.apk`)

### 步骤 5: 公网验证 + 触发自动给更新 (10 s)

```powershell
# 1. 公网 HTTPS HEAD
curl -I https://ab.maque.uno/app/DeepScript_v3.0.37.apk
# 预期: HTTP/2 200 + content-type: application/vnd.android.package-archive + content-length: 30077208

# 2. 远端 SHA256 一致性
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v3.0.37.apk"
# 预期: 跟 verify-apk.py 输出的 SHA256 一致

# 3. server /api/version 4 字段 (BUG-090 维度 22 必跑)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "curl -s http://127.0.0.1:6000/api/version | python3 -m json.tool"
# 预期: version=3.0.37 buildDate=2026-06-26 highlights.length>=3
```

**回滚 (APK 错应急)**:
```bash
# 1. 公网撤回 (改 symlink 或 cp 老 APK)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/shipin-APP/public &&
  ls DeepScript_v*.apk  # 看历史版本
  cp DeepScript_v3.0.36.apk DeepScript_v3.0.37.apk  # 回退
"

# 2. server 9 项版本号回退 (避免用户升级到坏版)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  sed -i 's/APP_VERSION=3.0.37/APP_VERSION=3.0.36/' /etc/systemd/system/shipin-app.service &&
  systemctl daemon-reload && systemctl restart shipin-app.service
"
```

---

## § 5. 自动给更新机制 (4 件套触发链路)

### 5.1 完整链路 (装老 APK 的 user → 升级到新 APK)

```
1. 装 v3.0.36 APK 的 user 启动 mobile
2. App.tsx useEffect(checkUpdate) 触发 (S58 P10 BUG-021 修法, 异步化)
3. updater.tsx showUpdateDialog 异步检测
4. 调 /api/version?version=3.0.36 (Bearer JWT, 鉴权)
5. server 返 {version: '3.0.37', changelog, highlights, buildDate: '2026-06-26'}
6. compareVersions(3.0.36, 3.0.37) = -1 (老)
7. needUpdate = true
8. 弹升级窗 (Modal + Alert.alert, forceUpdate=true 时不可跳过, BUG-087 24h 抑制)
9. user 点"下载" → react-native-blob-util + useDownloadManager: true
10. 下载 https://ab.maque.uno/app/DeepScript_v3.0.37.apk
11. 跳 Android 系统下载管理器安装 (BUG-023 永久签名验证通过)
12. 安装后 v3.0.37 + 含 BUG-097 mobile 修法 (notifyRechargePaid 按钮 + user_notified 4 态机 + admin 默认查 user_notified)
```

### 5.2 4 件套触发链 (server 必对, web 必对, mobile 必对, 公网 200)

| 件套 | 内容 | 验证方式 | 失败影响 |
|---|---|---|---|
| **1. server /api/version** | 返新版本号 + 4 字段 | `curl /api/version` | 装老 APK user 收不到升级窗 |
| **2. web dist** | 9 项版本号同步 + index-*.js 含 BUG 修法 | `curl -I https://ab.maque.uno` + grep bundle | web user 看到老 BUG |
| **3. APK 公网** | SHA256 一致 + content-type apk | `curl -I https://ab.maque.uno/app/DeepScript_vX.Y.Z.apk` | mobile user 下载失败 |
| **4. mobile 9 项版本号** | version.ts + build.gradle 跟 server 一致 | `aapt2 dump badging` | APK 编译报 versionCode conflict |

### 5.3 必跑端到端 (deploy 完最后一步)

```powershell
# 1. 装老 APK 的 mobile 端实测 (跟 BUG-089 polling 防呆配套)
#   - 启动 → 弹升级窗 → 下载 → 安装 → 验证 BUG 修法
# 2. web 端实测 (用 chrome devtools)
#   - 打开 https://ab.maque.uno → 看 console (无 error) → 操作新 BUG 修法
# 3. server 端实测 (用 admin password admin123, 跟 S72 batch 7 验证)
#   - curl /api/version 4 字段 → admin approve user_notified 订单 → 看 status 变 approved
```

---

## § 6. 验证 24 维 (verify-deploy.sh 完整清单)

> **位置**: `scripts/verify-deploy.sh` (跟 docs/ 平级)
> **运行**: `ssh root@159.75.16.110 "bash /tmp/verify-deploy.sh"` (远端跑, 验证部署后状态)
> **PASS=24/24 = 必达**, 任何 FAIL 立即修, 不允许"大致通过"

### 24 维分组

| 维度 | 内容 | 关联 BUG |
|---|---|---|
| 1-6 | **server 端 6 维** (进程 / 端口 / /health / /api/version / 鉴权 / 日志) | S65 DEPLOY.md § 6 |
| 7-9 | **server dist 关键字符** (grep /api/billing + recordConsumption + ALTER TABLE) | BUG-079 |
| 10-12 | **DB schema + 数据** (billing_logs 4 字段 + 2 索引 + 1812 数据) | BUG-079 |
| 13-14 | **公开 HTTPS + web JS hash** | BUG-080 |
| E2E.1-2 | **JWT 鉴权** (/api/billing/transactions + /api/billing/summary) | BUG-080 |
| 15-16 | **web dist 静态分析** (.type === filter pattern + consumption tab 1171 数据) | BUG-080 |
| 17-18 | **BUG-082 error part.message 归一** (server extractErrorMessage + web JSON.stringify) | BUG-082 |
| 19 | **BUG-082 TODO P2 agnesVideoProvider** provider 层归一 | BUG-082 |
| 20 | **BUG-081 状态机迁移 4 处同步** (services allowedStates grep) | BUG-081 |
| 21 | **BUG-083 dist/changelog.json UTF-8 完整** (Chinese 损坏检测) | BUG-083 |
| 22 | **BUG-090 /api/version 4 字段验证** (version + changelog + highlights + buildDate) | BUG-090 |
| **23 (🆕)** | **BUG-096 web dist `userNotifiedAt>`** (minifier 优化 `> 0` → `>`) | BUG-096 |
| **24 (🆕)** | **铁律 4++ mobile 端同步** (APK bundle grep `notifyRechargePaid` + `user_notified` + `adminOrders`) | 铁律 4++ |

### 24 维新增 SOP (S72 batch 7)

**维度 23 修法** (web dist `userNotifiedAt>0` → `userNotifiedAt>`):
- 必查文件: `apps/web/dist/assets/index-*.js` (本机) + `/www/wwwroot/ab.maque.uno/dist/assets/index-*.js` (远端)
- 必查内容: `userNotifiedAt>` 1 命中 (不是 `userNotifiedAt> 0`)
- 失败影响: BUG-096 React 0 渲染陷阱 (老 approved 订单 userNotifiedAt=0 短路返 0)

**维度 24 修法** (铁律 4++ mobile 端同步):
- 必查文件: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (本机)
- 必查内容: `assets/index.android.bundle` 含 `notifyRechargePaid` + `user_notified` + `adminOrders` 各 ≥ 1 命中
- 失败影响: 铁律 4++ 反 S70 旧原则"主盯 web, 安卓暂不动", 必重打 APK

---

## § 7. 铁律 6 commit message 自检

> **工具**: `tools/check-commit-message.py` (永久自检, 必跑)
> **必跑时机**: 每次 `git commit` 之前, **不许跳过**

### 7.1 必带元素 (跟 S72 batch 5+6+7 BUG-091/093 教训)

```
v<X.Y.Z> [BUG-NNN|docs|feat|fix|chore]: <一句话描述>
```

**例 (本 session 14 commit)**:
```
v3.0.37 BUG-099: web dist 被破坏 (index-BwxcAQbo.js 2 bytes) 修复 + verify-deploy 维度 22 容忍 set -e (4 件套 24 维验证全过)
v3.0.37 BUG-098: 修 admin approve 抛 500 (updateStatus 缺 id + topUp 多 ref_label 占位符)
v3.0.37 BUG-097: mobile 端同步 web 端 BUG-092/094/095/096 (notify-paid 按钮 + user_notified 4 态机 + 5 tab)
v3.0.37 docs: 规范反转 Web 主导 APP 跟随 (铁律 4++ + 删 3 处主盯 web)
v3.0.37 BUG-094: 修 admin 默认查 pending (markUserNotified 同时改 status + findByStatuses + admin 端点 default 'user_notified')
```

### 7.2 违规类型 (FAIL 案例)

| 类型 | 例 | BUG |
|---|---|---|
| **缺 v<X.Y.Z>** | `feat: 加新功能` | BUG-091 |
| **缺 BUG-NNN** | `v3.0.37 fix: 修充值` | BUG-093 (a5ae183 + 7e823ac 历史违规) |
| **缺 v 和 BUG** | `update readme` | BUG-091 + BUG-093 同源 |
| **描述太短** | `v3.0.37 BUG-XXX: 修` | N 1 起步 |
| **超过 80 字符** | `v3.0.37 BUG-XXX: <200 字符描述>` | 强制 wrap |

### 7.3 自检命令

```powershell
Set-Location F:\QiTa\banmu\APP\ai-video-script-app
python3 tools/check-commit-message.py
# 预期: PASS=N/FAIL=0/TOTAL=N (N=10 默认, 改 N 跟 commit 数匹配)
```

**自检维度** (N 5→10 升, S72 BUG-093 修法 2):
- 0. commit message 必带 v<X.Y.Z> 或 BUG-NNN
- 1. 必带 BUG-NNN | docs | feat | fix | chore
- 2. 描述 ≥ 1 字符
- 3. 必带中文 (跨项目通用 UX 原则)
- 4. 必带 4 铁律元素 (部署 / 跨端 / 验证 / 沉淀)
- 5-9. 5 项 BUG 关联检查 (当前 batch 修法 + 旧 BUG 兼容)

### 7.4 pre-commit hook 安装 (S72 BUG-093 修法 3, 自动化)

```bash
# 1. 安装 hook (一次性)
bash F:/QiTa/banmu/APP/ai-video-script-app/tools/install-pre-commit-hook.sh

# 2. 验证 (改任意文件 + 违规 commit 必失败)
cd F:/QiTa/banmu/APP/ai-video-script-app
echo "test" >> test.txt
git add test.txt
git commit -m "test"  # 必失败, 提示 BUG-NNN 必带
git reset HEAD test.txt
rm test.txt
```

---

## § 8. 已知坑 (9 大 BUG 教训, 必读必记)

### 8.1 BUG-079: dist 假报告 (12 维验证 = 5 个查 dist 字符 + 1 个查 process.env)

- **根因**: tsc 编译坏时, 跑老 .js, 12 维验证全过 (因为 process.env 来自 .env, 跟 dist 无关)
- **修法**: 5 个 grep 关键字符 (维度 7-9) + dist 行数监控 (≥ 50 行)
- **教训**: 部署 ≠ 成功, 必跑端到端

### 8.2 BUG-082: 持久化 JSON 必 string 归一 (铁律 8)

- **根因**: 某字段 = `{}` (对象) 而非 `'{}'`, 持久化到 DB JSON 列失 type
- **修法**: 任何 `JSON.stringify` 必 `?? '{}'`, 任何 `JSON.parse` 必 typeof 校验
- **配套**: BUG-096 React `{0}` 渲染陷阱 (前端侧) + BUG-098 SQL params 必 string 归一 (配套)

### 8.3 BUG-090: deploy.sh changelog.json cp 源错 (12 维验证只查 version 字段)

- **根因**: deploy.sh 第 6 步 cp -f ${DIST_DIR}/changelog.json 源是**生产目录** (上次部署留下的老版本), 不是本机 scp 过来的新版本
- **修法**:
  1. deploy.sh 优先 /tmp/changelog.json (本机 scp 源, 新版本), fallback 到生产目录时显式 warn
  2. 部署 SOP 必加完整 scp 清单: dist.tar.gz + package.json + changelog.json 3 件套
  3. verify-deploy.sh 加维度 22 强制检查 /api/version 的 4 字段
- **防呆**: 任何未来部署后, 维度 22 失败 = changelog 同步链断了一环

### 8.4 BUG-094: admin 默认查 pending (状态机迁移 4 处同步漏 1)

- **根因**: 修 BUG-092 加 user_notified 状态, 只同步 3 处 (server + admin API + web admin UI), 漏 admin 端点 default 改 'user_notified'
- **修法**: 状态机迁移必同步 4 处: server 字段 + model method + response handler + 客户端 UI 渲染
- **教训**: BUG-081 升级版, BUG-092 改 5+1 处 (加 admin 配套标记) 误以为全

### 8.5 BUG-095: DB schema enum 漏同步 (状态机迁移 4→5 处)

- **根因**: BUG-094 修法漏第 5 处 DB schema enum 同步 (status ENUM 不含 'user_notified'), 改后 server 抛 `Data too long for column 'status'`
- **修法**:
  1. 立即 SQL `ALTER TABLE recharge_requests MODIFY COLUMN status ENUM('pending','user_notified','approved','rejected')`
  2. db.ts CREATE TABLE enum 同步 + ALTER 兼容老库 logger.warn
  3. server restart (mysql2 prepared statement cache 命中旧 enum)
- **教训**: 状态机迁移必同步 5 处 (BUG-081 升级, **加 DB schema**)

### 8.6 BUG-096: React `{0}` 渲染陷阱

- **根因**: `o.userNotifiedAt && o.userNotifiedAt > 0 && <Tag>...</Tag>` 老 approved 订单 userNotifiedAt=0 短路返 0, React JSX `{0}` 渲染 "0" 字符串 (跟 null/undefined/false 不渲染不同)
- **修法**: 删 `o.userNotifiedAt &&` 第一个短路 + 改 `&& (X)` 为 `? (X) : null` 显式三目
- **配套**: BUG-082 铁律 8 前端侧, 跨项目通用 UX 原则

### 8.7 BUG-097: mobile 端漏修 web 端 3 BUG (铁律 4++ 反 S70 旧原则)

- **根因**: 之前原则"主盯 web, 安卓暂不动"导致 BUG-092/094/095/096 修完没同步 mobile 端
- **修法** (2026-06-26 13:49 user 明确): 删旧原则 + 加铁律 4++ + 5 步同步 SOP + verify-deploy 维度 24 APK bundle grep
- **防呆**: 任何 web 端 BUG 修完必跑 5 步: 1) 评估 mobile 端漏修清单 (grep diff) 2) 修 mobile 端代码 3) tsc + APK rebuild 4) aapt2 dump badging 5) scp APK + bump server 9 项版本号

### 8.8 BUG-098: admin approve 抛 500 (2 处 SQL 错, 跟 BUG-079 同源)

- **根因**:
  1. `rechargeRequestModel.updateStatus` SQL 缺第 4 个参数 `id` (3 vs 4 placeholders, S70 PM2 时代 silent fail 错)
  2. `billingService.topUp` SQL 多 1 个 `ref_label` 占位符 (6 vs 9 placeholders)
- **修法**: SQL placeholders 跟 params 数量必一致 (跟 BUG-079 假报告同源, 部署 ≠ 成功)
- **调试改进**: catch 块加 `logger.error('approve failed', { err, orderId, params })` (跟 BUG-082 铁律 8 配套)
- **教训**: verify-deploy 必加维度 25 admin approve E2E (S72 待办)

### 8.9 BUG-099: web dist 被破坏 (index-*.js 2 bytes)

- **根因**: 待查 (可能是宝塔 nginx 缓存 + git push race), web dist 单文件被压成 2 bytes `0\n`
- **修法**:
  1. 重新 build (vite deterministic, 同样 source 同样 hash `BwxcAQbo.js` 493080 bytes)
  2. scp 重解压 (跟 BUG-096 嵌套 dist/dist 修复同款)
  3. 宝塔 nginx reload
- **防呆**: 部署后必跑 `head -c 100 dist/assets/index-*.js | head -1` (vite minified 必 = `//`, 异常 = 重 build)

### 8.10 BUG-100: 69 个 video_generations 卡 queued 累积 17 天 (S72 batch 8 后置)

- **根因** (3 个独立问题, 跟 BUG-098 同源: 单修法不彻底):
  1. **ffmpeg 6.1.1 image2 muxer 抽帧失败** (主因, 70%): `apps/server/src/utils/ffmpegHelper.ts` 旧修法 v3.0.0.23 加 `-update 1` 在 ffmpeg 6.1.1 image2 muxer 仍报 "Could not open file" (实测 6+ 次累积)
  2. **状态机迁移漏 tool_completed 进 allowedStates** (跟 BUG-081 同源, 20%): `videoAgentService.ts:403` 旧代码 `if (conv.status !== 'plan_ready') throw`, 用户已 tool_completed 点 confirm 必 throw
  3. **catch 块漏更新 video_generations 表** (跟 BUG-098 同源, 80% 卡死的根因): `runCreateTaskInBackground` 2 个 catch 块 (createTask + persist) 只回滚 video_conversations, video_generations 永远卡 queued
- **修法** (3 fix 一起发版, v3.0.37 S72 batch 8):
  1. **Fix 1**: `ffmpegHelper.ts` 改用 `image2pipe` muxer 走 stdout (替代 image2 muxer + 临时文件), 跨 ffmpeg 6.1.1/6.0/5.x 稳定
  2. **Fix 2**: `videoAgentService.confirm()` 改 `if (conv.status !== 'plan_ready' && conv.status !== 'tool_completed') throw`, 状态机迁移必同步 4→5 处 (跟 BUG-081/094/095 配套)
  3. **Fix 3**: `runCreateTaskInBackground` 2 个 catch 块各加 queryOne + videoGenerationModel.update(id, {status: 'failed'}) "补刀" 附属表 (跟 BUG-098 同源)
- **清卡死**: 部署后必跑 `UPDATE video_generations SET status='failed', error_msg='Pre BUG-100 累积' WHERE status='queued' AND created_at<24h`
- **防呆** (跨项目通用): 卡死任务必同时查 3 处 — `cat /proc/PID/environ` 进程 env + `SELECT status, COUNT(*) FROM task_table GROUP BY status` DB 状态分布 + `tail -50 logs/error.log | grep` server log stderr. 单一查 1 处看不出来 (跟 BUG-079 假报告 100% 同源)

### 8.11 BUG-101: APP 上传小说分析失败 "Cannot read property 'bg' of undefined" (v3.0.38, 2026-06-26)

- **根因**: mobile 端 5 个 `toast.show(msg, '<Ionicons-name>')` 错调用 (UploadScreen + OutlineReviewScreen x 3 + PlotGraphScreen), 误把 cloud-upload/sparkles/checkmark-circle 当 ToastVariant 传, runtime `VARIANT_COLORS['cloud-upload']` = undefined, `v.bg` 抛错. 配套: Toast.tsx 缺防御性 fallback, TS 编译过 (string 兼容) 但 runtime 必抛 (跟 BUG-079 假报告 100% 同源)
- **修法** (2 步):
  1. **Fix 1**: `Toast.tsx:152` 改 `VARIANT_COLORS[(config.variant || 'default') as ToastVariant] || VARIANT_COLORS.default` 防御性 fallback (跟 BUG-082 catch 必归一 + BUG-098 SQL params 必归一 同源)
  2. **Fix 2**: 5 个错调用全改 `'success'` 明确 variant (UploadScreen + 3 OutlineReview + 1 PlotGraph)
- **教训** (跨项目通用, 跟 BUG-082/098/100/097 同源):
  1. **Record<Union, T> 索引必带 fallback** (跟 BUG-082 catch 必归一 + BUG-098 SQL params 必归一 同源, 任何严格 union 索引都必带 fallback, 不然传错字面量必抛)
  2. **TS 编译过 ≠ 运行时正确** (跟 BUG-079 假报告 100% 同源, 必跑端到端验证)
  3. **mobile 端 5 错调用 1 次修完** (跟 BUG-100 跨项目通用 3 修法 1 批次同源)
  4. **Ionicons name 跟 enum/union 不通用, 调用前必对齐** (跟 BUG-097 mobile 端漏修小错教训一致, 任何字符串当枚举用都必加 TS 严格 union)
- **配套工具** (永久化): `apps/server/scripts/verify-bug101.sh` (5 维: fallback 命中 + 0 错调用 + ≥ 5 'success' + /api/version 4 字段 + 公网 APK SHA256)

---

### 8.12 BUG-103: refundStep 自动退款退多了 34.93 元 (v3.0.39, 2026-06-26)

- **根因**: novel "没钱修什么仙" analyze 失败 (2910536 字 task failed), `billingService.refundStep` 自动退 34.93 元, 但 user 没付款不该退. 根因: 自动退款机制没 review 环节 (跟 BUG-072 D 短期方案错同源, 跟 S72 batch 7 BUG-100 catch 漏补刀 100% 同源: 修法 1 不彻底)
- **修法** (3 fix 一起发版, v3.0.39):
  1. **DB 撤销 h773052122 错误退款** (audit trail 留 trace):
     - `UPDATE billing_logs SET ref_label = CONCAT('[已撤销 BUG-103 admin manual 2026-06-26] ', ref_label) WHERE id='1c1aacef-...'`
     - `UPDATE users SET balance = balance - 34.93 WHERE id='3b3aa45d-...'` (35.07 → 0.14 正确 = 0.03 初始 - 0.11 消费)
  2. **删 `billingService.refundStep` 整方法** (line 405-445, 跟 BUG-072 D 长期方案 '接支付宝回调' 一致)
  3. **`novelService` catch 块删 refundStep 调用** (line 414-420), 失败只 notifyError 通知 user '请联系客服'
- **人工复核流程** (跟 BUG-072 D 一致):
  1. user 联系 admin 微信/钉钉
  2. admin 查 `billing_logs` + `task_jobs` 确认失败
  3. 手动 SQL: `UPDATE users SET balance = balance + X WHERE id = ?`
  4. 手动加 `billing_logs`: `INSERT ... type='charge'` (refund 改 charge, 区分自动)
  5. 长期方案: 接支付宝回调 (BUG-072 D, 等)
- **教训** (跨项目通用, 跟 BUG-072/082/098/100 同源):
  1. **自动退款必配套审核机制** (跟 BUG-072 D 短期方案错同源, 跟 BUG-100 catch 漏补刀 100% 同源)
  2. **任何自动化必有人 review** (跟 S54 BUG-073 silent fail 跑老 .js 同源: 自动化没人 review 必出错)
  3. **短期方案 ≠ 长期方案** (跟 S72 batch 7 BUG-090 deploy.sh 教训一致, 短期方案必加 TODO 转长期)
- **配套工具** (永久化): `apps/server/scripts/db-bug103-revert.sql` (撤销 + audit) + `apps/server/scripts/verify-bug103.sh` (7 维: refundStep 0 命中 + novelService 0 实际调用 + balance 0.14 + audit trail + /api/version 3.0.39 + systemd + .env)

---

### 8.13 BUG-104: server bump 3.0.39 漏 rebuild APK, user 升级弹窗 APK 404 (v3.0.39 mobile 同步, 2026-06-26)

- **根因**: BUG-103 修法只 bump server 端 (package.json + index.ts + ecosystem + .env + systemd + changelog), **漏 rebuild APK + scp**, 公网 `https://ab.maque.uno/app/DeepScript_v3.0.39.apk` HTTP/2 404. user 装 v3.0.38 APK → App.tsx useEffect(checkUpdate) → updater.tsx 调 /api/version?version=3.0.38 → server 返 3.0.39 → compareVersions=-1 → needUpdate=true → 弹升级窗 → user 点下载 → 404 → user 卡住. 跟 BUG-097 mobile 端漏修 web 3 BUG 100% 同源, 跟 BUG-103 删 server 自动退款漏刷 APK 100% 同源
- **修法** (4 步走完, v3.0.39 mobile 端跟上, commit `ecd297f`):
  1. **bump mobile build.gradle + version.ts**:
     - `apps/mobile/android/app/build.gradle`: `versionCode 43→44` + `versionName "3.0.38"→"3.0.39"`
     - `apps/mobile/src/config/version.ts`: `APP_VERSION '3.0.38'→'3.0.39'` + `APP_VERSION_CODE 43→44`
  2. **bump web version.ts** (跨端 UX 一致):
     - `apps/web/src/config/version.ts`: `APP_VERSION '3.0.38'→'3.0.39'` + `APP_VERSION_CODE 43→44`
  3. **rebuild APK + scp** (44s, mobile 端没改 src 但 version 改了 → bundle 重 build → 新 SHA256):
     - `cd apps/mobile/android && ./gradlew assembleRelease` → app-release.apk 30,077,287 bytes, SHA256 `3F188A109C055369E314542809C11AB53C8F368A1CE5FE3A59E5517CCA6CDEC5`
     - `scp -i test2 app-release.apk root@159.75.16.110:/www/wwwroot/shipin-APP/public/DeepScript_v3.0.39.apk`
     - 公网 SHA256 跟本机一致 (vite/RN deterministic)
  4. **web build + scp** (3.10s, version.ts 改了 → vite inline 重 build → 新 hash):
     - `cd apps/web && npm run build` → dist/assets/index-Bnh837h2.js 480.43 kB (新 hash, 跟 v3.0.37 `BwxcAQbo.js` 不同)
     - `scp -i test2 -r dist root@159.75.16.110:/www/wwwroot/ab.maque.uno/dist` + nginx reload
- **9 项版本号同步** (跟铁律 3 + 4++ 配套, BUG-104 扩 8→9 项):
  1. mobile `version.ts` APP_VERSION (3.0.38→3.0.39) + APP_VERSION_CODE (43→44)
  2. mobile `build.gradle` versionCode (43→44) + versionName (3.0.38→3.0.39)
  3. web `version.ts` APP_VERSION (3.0.38→3.0.39) + APP_VERSION_CODE (43→44)
  4. server `package.json` (已是 3.0.39, BUG-103 修过)
  5. server `index.ts` fallback (已是 3.0.39, BUG-103 修过)
  6. server `ecosystem.config.js` 2 处 (已是 3.0.39, BUG-103 修过)
  7. 远端 `.env` APP_VERSION (已是 3.0.39, BUG-103 修过)
  8. 远端 systemd unit `Environment=APP_VERSION=3.0.39` (BUG-103 修过)
  9. server `changelog.json` v3.0.39 entry (已是 7 highlights BUG-103 修法, 不变)
- **教训** (跨项目通用, 跟 BUG-097/103/090/099 100% 同源):
  1. **server bump 必 rebuild APK + scp** (跟 BUG-097 mobile 漏修 web 100% 同源, 跟 BUG-103 删自动退款漏刷 APK 100% 同源)
  2. **9 项版本号同步必加 mobile build.gradle versionCode** (跟铁律 3 扩 6→9 项, 跟铁律 4++ 跨端同步配套)
  3. **部署 SOP 必加"模拟 user 升级链路"端到端验证** (跟 BUG-100 修法 1 必加端到端验证 100% 同源)
  4. **任何公网下载链接必须在 deploy 阶段实测 HTTP 200** (跟 S54 BUG-073 silent fail 跑老 .js 同源)
  5. **APK SHA256 vite/RN deterministic** (跟 BUG-099 web dist hash deterministic 同源: 同样 source 同样 SHA256)
- **配套工具** (永久化): `apps/server/scripts/simulate-v3038-to-v3039-upgrade.sh` (10 步模拟升级链路: compareVersions=-1, needUpdate=true, APK 200, SHA256 一致, install 后 compareVersions=0, needUpdate=false) + `scripts/verify-deploy.sh` 维度 24 强制 grep APK bundle 命中 + 4 件套 v3.0.39 验证 (server `/api/version` + 公网 APK SHA256 + web dist hash + 9 项版本号 grep 100%)

---

### 8.14 BUG-105: 角色分析 prompt 跟 user 需求不一致, 走老 37 字段固定格式 (v3.0.40, 2026-06-26)

- **根因**: 现状 2 个 prompt 文件并存: `apps/server/src/prompts/novelAnalysis.ts` 老版 37 字段 (v2.5.14) + `apps/server/src/prompts/characterDescription.ts` 新版 Markdown 5 section (v3.0.0.30 S50 v2). 但 `apps/server/src/services/novelService.ts` 的 `parseAndSave` 里 `needsDescExtraction = parsedChars.some(c => !c.description || Object.keys(c.description).length <= 2)` 永远 false (老 prompt 必填 37 字段, parsedChars.description 永远 ≥ 2 字段) → 新版 characterDescription.ts 永远不被调用 → 角色分析 100% 走老 37 字段 → 逼 LLM 编造不存在的字段 (例: 路人甲根本没提身高, LLM 编"中等身材" 凑数). 跟 user 明确"现在的新版本的角色分析是根据剧情内容来提取角色形象的, 而不是现在的固定所有角色身高体型等等信息" 冲突
- **修法** (6 fix 一起发版, v3.0.40):
  1. **`novelAnalysis.ts` 简化 🎭 角色分析部分**: 从 37 字段固定格式 → 极简 4 基础字段 (角色名 + 身份 + 角色类型 + 阵营), 详细描述完全交给后续 extractDescriptions
  2. **`novelService.ts parseCharactersFromReport` 重写**: 容错新格式 (只解析 4 基础字段, description 字段留空), 老 37 字段格式也兼容 (探测下一行是不是 "字段名:值" 老格式 → 走老逻辑)
  3. **`novelService.ts parseAndSave` `needsDescExtraction = true`**: 永远调 extractDescriptions, 让 characterDescription.ts v3.0.0.30 新版 prompt 真正生效 (之前永远不调)
  4. **`characterSheetPrompt.ts` 重写**: `CharacterSheetData` 删 37 字段 (face/eyes/eyebrows/nose/lips/hair_*/clothing_*/...), 保留 4 字段: name/styleId/visualDescription/gender, `buildEnglishVisualDescription`/`buildChineseVisualDescription` 删 (不用 37 字段拼 visual), `buildPrimaryVisualBlock` 简化用 visualDescription 自由文本
  5. **`characterService.ts generateImageVariants` 改用 `visualDescription` 字段**: 替代 `prompt_safe_description` (表达更准), 删 `extractDistinctiveFeatures` 函数 (dead code, 之前从 description 文本中找"特征/标志/胎记"段落的逻辑)
  6. **`novelService.ts backfillCharactersFromReport` 走新版 characterDescription.ts**: 跟 `/api/novels/:novelId/characters/extract` 端点一致 (web `CharacterListPage.tsx` 列表页"重新分析"按钮 + mobile `CharacterListScreen.tsx` 列表页"重新分析"按钮, 已调 `backfillCharactersApi`)
- **端到端验证** (q378685504 / wuliao login + POST /api/novels/d6449c45-45fc-4ce6-9dad-9036e45701e8/backfill-characters):
  - ✅ login OK, JWT len 211, balance 247.18 (跟之前 S72 batch 7 E2E 一致)
  - ✅ backfill 返 200 + `data.descriptionsGenerated: 9` (9 角色全成功, 跟 novel 实际角色数一致)
  - ✅ 主角 独孤琰 完整 Markdown 5 section: 基本信息/外貌与服装 (含原文引用)/性格与行为/语言风格/标志性特征
  - ✅ 配角 秋霞 5 section 含原文标注 (第3章/第5章): 善良单纯 + 勇敢护主 + 天真无邪 (例: 陆婕妤寻衅时主动挡在苏蓉蓉面前被兰烟掌掴 第5章)
  - ✅ 跑龙套 兰烟 60 字 2 句: 陆婕妤的贴身宫女, 约20岁, 虎背熊腰, 方脸黝黑, 铜铃眼凶光, 粗眉厚唇 + 狗仗人势听从陆婕妤命令掌掴秋霞 (第5章), 被苏蓉蓉言语震慑后退缩
  - ✅ 100% 不再硬凑 37 字段, 跟 user "根据剧情内容来提取角色形象" 100% 一致
- **教训** (跨项目通用, 跟 BUG-079 假报告 100% 同源):
  1. **角色分析 prompt 必基于剧情内容, 不限制死字段** (跟 user 明确"必须基于剧情内容来描述, 不得乱写" 一致, 跟 BUG-079 TS 编译过 ≠ 运行时正确 100% 同源: prompt 写得详细 ≠ LLM 输出正确, 实际逼 LLM 编造)
  2. **角色标签分类 + 丰度梯度**: 主角 800-2000 字 5 section, 重要配角 300-800 字 4 section, 次要配角 80-200 字 1-2 section, 跑龙套 30-60 字 1-2 句, 路人 10-30 字 1 句话 (上限不强制, 小说没提就少写)
  3. **丰度上限不强制, 宁可少写, 严禁编造** (允许 description < 模板下限, 跟 BUG-103 删自动退款"失败不重试" 同源: 安全优先, 不编造不存在的剧情素材)
  4. **2 个 prompt 文件并存时, 必查流程判断条件** (跟 BUG-104 server bump 漏 rebuild APK 100% 同源: 部署 SOP 缺一环就崩, `needsDescExtraction` 判断永远 false 让新版 prompt 永远不跑)
  5. **端到端验证必跑真实 user login + 真实 novel id** (跟 BUG-100 修法 1 必加端到端 100% 同源, 跟 BUG-098 catch 必加二次验证 100% 同源, 跟 BUG-079 假报告 100% 同源)
- **配套工具** (永久化): `apps/mobile/BUGS.md` BUG-105 完整段 + `docs/BUGS_INDEX.md` 速览表 + Top 24 + `docs/DEPLOY_RELEASE_FLOW.md` § 8.14 (本段) + 1 mavis memory

### 8.14.1 BUG-105 后续 mobile 端 sync (v3.0.41, 2026-06-26 S72 batch 8 后置)

> 必读: server 端 BUG-105 修法 (v3.0.40, § 8.14) 完成后, mobile 端必同步移植 web 端 utils, 这是 § 10.4 的具体实战案例.

- 根因: web 端 v2.5.34 早已抽出 apps/web/src/lib/characterUtils.ts (95 行, 4 种 description 格式兼容 — 自由文本字符串 / 11 字段 JSON 对象 / JSON 字符串 / 双层 JSON 字符串). 但 mobile 端 v3.0.29 UI redesign 时漏同步移植, 3 个 screen (CharacterDetailScreen / CharacterListScreen / CharacterDescriptionReviewScreen) 各有本地硬编码 11 字段 (height/build/face/features/hair/signature/clothes/personality/aliases). server v3.0.40 改 description 为 Markdown 自由文本后, models/character.ts 把 JSON 对象 JSON.stringify 成字符串返回 mobile, mobile extractDescriptionText 第 1 行 if (typeof desc === 'string') return desc 直接原样显示, 用户看到一堆 JSON 转义字符串 + \n 转义符, 完全不可读
- 修法 (v3.0.41): 1) 新增 apps/mobile/src/utils/characterUtils.ts (跟 web v2.5.34 1:1, 95 行, 4 种格式兼容 + recursive parseStringToText + summaryOf markdown 跳过) 2) 改 3 个 screen import: import { extractDescriptionText, summaryOf } from '../utils/characterUtils'; (CharacterListScreen 还 import summaryOf) 3) 删 3 个 screen 本地硬编码 extractDescriptionText 函数 (11 字段 if 判断) + CharacterListScreen 本地 summaryOf 简单截断 4) 8 项版本号同步 3.0.40 → 3.0.41 (mobile version.ts + build.gradle versionCode 44→45 + server package.json + index.ts fallback + ecosystem 2 处 + web version.ts + APP_VERSION_CODE 44→45 + changelog.json + 远端 .env + 远端 systemd unit) 5) 本机 gradlew assembleRelease 重打 APK 37s (增量编译 21/394 任务执行) 6) aapt2 dump badging 验 versionName='3.0.41' versionCode=45 + apksigner verify --print-certs 验证书 DN = CN=DeepScript Release (BUG-023 永久签名) 7) scp APK 到 /www/wwwroot/shipin-APP/public/DeepScript_v3.0.41.apk + 远端 sed bump 3 处 APP_VERSION (.env + systemd unit + ecosystem) + systemctl daemon-reload && systemctl restart shipin-app 8) web 端 npm run build (3.57s, 新 bundle index-B1XyyGhQ.js) + tar 打包 + scp 到 /www/wwwroot/web-app/ + nginx reload
- 端到端验证: 1) tools/verify-mobile-characterUtils.js 5/5 PASS (4 种格式 + summaryOf 跳 markdown) 2) aapt2 dump badging + apksigner verify 本机全过 (versionName=3.0.41 + 证书 DN = CN=DeepScript Release) 3) 5 维验证: 公网 APK HTTP 200 (content-type: application/vnd.android.package-archive, 30078127 bytes) + 远端 SHA256 = 本机 SHA256 982342F74ADC22AF6B2CE3BB1645CCC31871C8A4D6CDBD4B6331806FF90CA74D + 公网 /api/version version=3.0.41 forceUpdate=true needUpdate=true (8 条 highlights 全对, changelog 最新 entry) + 历史 APK 11 个未覆盖 (v3.0.3 ~ v3.0.9 + v3.0.37/38/39/41)
- 教训 (跨项目通用铁律 4++ 实战): 1) web utils 必同步移植 mobile 端 — 不能 import monorepo 包 (mobile bundle constraints + metro cyclic dep 风险 BUG-002), 走 apps/mobile/src/utils/<name>.ts 单独复制 2) 跨端铁律 4++ Web→APP 同步 5 步 SOP (详 § 10.4): 比对 web utils 清单 → mobile 移植 → 改 screen import → 删本地硬编码 → tsc + rebuild APK + 端到端 3) server 改 description / 任何字段格式必同步三端 — server + web + mobile, 三端 utils 配套不齐必崩 4) mobile BUGS.md 沉淀同步 — server 修法 commit 必加 mobile 端 mobile BUGS 段 (跨端 BUG 必同时 cover mobile, 否则 mobile 永远漏修) 5) commit message 必带 BUG 编号 (铁律 6) — v3.0.41: <改动> (BUG-105 + mobile sync), pre-commit hook 拦截无 BUG 编号
- 配套工具: tools/verify-mobile-characterUtils.js (5/5 PASS 脚本, 跨端改 utils 时必跑) + apps/server/scripts/deploy-bug105-mobile-sync.sh (远端部署脚本, 6 步 bump + restart) + docs/BUGS_INDEX.md § 1 BUG-105 行 + Top 25 + 1 mavis memory: web→mobile utils 同步必须移植 (跟 BUG-097 mobile 漏修 web 100% 同源)
: "角色分析 prompt 必基于剧情内容, 不限制死字段, 严禁编造 (跨项目通用, 跟 BUG-079 TS 编译过 ≠ 运行时正确 100% 同源)"

### 8.14.2 BUG-106: verify-deploy-24d.sh 自身 5 子 bug (v3.0.41 收口, 2026-06-26 S72 batch 9)

> 必读: 任何"自动验证/部署后自检"脚本跑前必先跑一遍脚本自身, **"100% PASS" ≠ 实际有效** (跟 BUG-079 假报告 100% 同源). 这是 § 9 工具脚本清单的实战案例 + Top 26 BUG-106 通用铁律的具体应用.

- 根因 (5 子 bug 同时存在): S72 batch 8 加 verify-deploy-24d.sh wrapper (引用 /tmp/verify-deploy.sh) + 维度 23a/23b/24 mobile 端同步自检, 但底层 verify-deploy.sh (B73 24 维全过承诺) 自身存在 5 个 silent bug, 跑 53 行就 fail, **B73 S72 batch 7 报"24 维全过" 100% 假**:
  1. **urllib API 错误 (维度 22)**: `__import__('urllib.request', fromlist=['urlopen']).request.urlopen` AttributeError. urllib.request 没有 .request 子属性, 应直接 `urllib.request.urlopen(url)`. 实测: `AttributeError: module 'urllib.request' has no attribute 'request'`
  2. **f-string 内嵌 bash 变量 (维度 22 changelog 字段)**: bash 单行 python `python3 -c "import json...f'...env={$APP_VERSION}...'"` 被 python 解析为 `env=3.0.41` 表达式, SyntaxError. 实测: `SyntaxError: invalid syntax: 'env=' + 3.0.41`
  3. **bash 算术多行 grep 输出 (维度 24 APK bundle)**: `$((V24_NOTIFY + V24_PAID + V24_STAGE))` 在 `grep -c` 输出多行时 syntax error. 实测: `syntax error in expression (error token is "11\n3\n...")` (grep -c 多文件输出每行一个数字)
  4. **awk -F: 处理单文件 grep -c (维度 23a/23b)**: `grep -c 'userNotifiedAt>' file.js` 单文件输出无 filename prefix (只有 `0` 数字), awk `-F: '{s+=$2}'` 拆错 (空字符串). 实测: PASS 错误变 FAIL (永远 s=0)
  5. **web dist 路径错 (维度 23 a/b)**: 脚本写死老路径 `/www/wwwroot/ab.maque.uno/dist/assets` (S72 batch 6 老位置), 但 S72 batch 8 改 `/www/wwwroot/web-app/dist/assets` (index-B1XyyGhQ.js 当前). 实测: WEB_DIST_DIR 不存在 → skip 跳过 (但 23a/23b 应该 FAIL, 错失 BUG-096 拦截机会)
- 修法 (v3.0.41 收口): 1) `apps/server/scripts/verify-deploy.sh` 入仓 33080 bytes 605 行 (24 维全修复) — urllib.request.urlopen 替代 .request.urlopen / f-string 改字符串拼接避免 bash 变量 / grep -c 改 grep -ao + wc -l / awk -F: 改 awk '{s+=$1}' / WEB_DIST_DIR 改 /www/wwwroot/web-app/dist/assets 2) `verify-deploy-24d.sh` 改 wrapper 引用 `$(dirname "$0")/verify-deploy.sh` 相对路径 (S72 batch 9 抛弃 /tmp/ 绝对路径, 跟 web dist 路径反转同源) 3) 远端实测 27 PASS + 0 FAIL + 0 SKIP (维度 1-22 + 23a userNotifiedAt 修法 + 23b 反模式 0 命中 + 24 APK bundle 同步 3 关键 API/UI 元素)
- 端到端验证: 1) 远端 ssh bash scripts/verify-deploy-24d.sh 跑出 "PASS: 27 / FAIL: 0 / SKIP: 0" + "全部通过, shipin-APP 部署健康" 2) BlueStacks 5 装 v3.0.41 APK + 启动 MainActivity + 登录态保留 (q378685504/wuliao) + 走 书架 → ScriptDetail → CharacterList → CharacterDetail 截图, 看到 11 字段 objectToText 兼容显示 (无 [object Object] 乱码, 100% 跟 web 端显示一致) 3) 4 步自检: 维度 22 /api/version 4 字段 OK (version=3.0.41 changelog=8 highlights 14 字 buildDate=2026-06-26) + 维度 23a userNotifiedAt> 修法命中 + 维度 23b userNotifiedAt&& 反模式 0 命中 (BUG-096 已清) + 维度 24 APK bundle 同步 3 元素 ≥1
- 教训 (跨项目通用铁律, 跟 BUG-079 假报告 100% 同源, 跟 BUG-090 deploy.sh cp 源错 100% 同源): 1) **verify 脚本跑前必先跑一遍脚本自身** — "100% PASS" ≠ 实际有效, verify 脚本自身 silent fail 让你 100% PASS 但实际是 0 行真验证 2) **python f-string 禁止内嵌 bash 变量** — 必用字符串拼接 `'...env=' + '$APP_VERSION' + '...'` 避免 SyntaxError, 或先 `APP_VERSION_PY=$APP_VERSION` 提取再 f-string, 或直接走 bash 命令外传 3) **bash 算术必强制单行数字** — 改 `grep -ao pattern | wc -l` (强制单行数字) + `${VAR:-0}` 默认值 fallback 4) **awk 处理 grep -c 必带 -h flag** — 单文件用 `grep -hc ... | awk '{s+=$1}'` (h 抑制 filename) 或多文件保留 filename + `awk -F: '{s+=$2}'` 5) **写死的路径必从 `DEPLOY_DIR` 自动 derive** — 不写死 `/www/wwwroot/ab.maque.uno/dist/assets`, 走 `ls /www/wwwroot/*/dist/assets` 自检或 nginx config 读
- 防呆 SOP: 1) 写完 verify 脚本必先单独跑一遍确认绿, 再集成到 deploy.sh / CI 2) commit verify-deploy.sh 必跑 `bash scripts/verify-deploy-24d.sh --strict` 端到端验证, 任何 FAIL 必修 3) wrapper 引用必用 `$(dirname "$0")/verify-deploy.sh` 相对路径, 兼容本地 / 远端 4) BUG-106 沉淀到 docs/BUGS_INDEX.md § 1 速览 + Top 26 + docs/DEPLOY_RELEASE_FLOW.md § 8.14.2 (本段) + 1 mavis memory (跨项目通用)
- 配套工具: `apps/server/scripts/verify-deploy.sh` (33080 bytes 605 行 24 维全过) + `apps/server/scripts/verify-deploy-24d.sh` (wrapper 引用相对路径) + `docs/BUGS_INDEX.md` § 1 BUG-106 速览行 + Top 26 + § 4.5 + 1 mavis memory: verify 脚本 5 子 bug pattern (跨项目通用) + BlueStacks 5 端到端截图 (BookshelfScreen → ScriptDetailScreen → CharacterListScreen → CharacterDetailScreen)
: "verify 脚本自身 5 子 bug pattern, 跑前必先跑一遍脚本自身, 100% PASS ≠ 实际有效 (跨项目通用, 跟 BUG-079 假报告 100% 同源)"

---

## § 9. 工具脚本清单 (永久工具, 跨项目通用)

| 路径 | 用途 | 触发时机 |
|---|---|---|
| `tools/check-commit-message.py` | 铁律 6 commit 自检 | 每次 `git commit` 前 |
| `tools/install-pre-commit-hook.sh` | pre-commit hook 安装 | 一次性 |
| `scripts/verify-deploy.sh` | 24 维部署验证 | 每次 server 部署后 |
| `apps/mobile/scripts/verify-apk.py` | APK 永久 verify (SHA256 + 签名 + BUG-097 命中) | 每次 mobile 发布前 |
| `apps/server/scripts/deploy.sh` | server 部署主流程 | 每次 server 改代码后 |
| `apps/server/scripts/deploy-bugNNN.sh` | 单 BUG 修复部署 | 修完 BUG 后 |
| `apps/web/scripts/deploy.sh` | web 部署主流程 | 每次 web 改代码后 |
| `apps/mobile/android/gradlew` | gradle build APK | 每次 mobile 改代码后 |

---

## § 10. 跨端同步流程 (铁律 4++ Web→APP)

> **2026-06-26 user 明确**: "现在 Web 端所有功能调整和修复工作都要同步到 APP 里, 以 Web 端为主导, APP 跟随 Web 端调整, 列入项目规范"

### 10.1 5 步同步 SOP (web 端 BUG 修完必跑)

```
1. 评估 mobile 端漏修清单 (grep diff)
   - 比对 web 端修的 API/UI/状态机, mobile 端是否同步
   - 关键: notifyRechargePaid / user_notified / adminOrders / admin 默认值
2. 修 mobile 端代码
   - 必同步 3 处: api/client.ts (API) + screens/RechargeScreen.tsx (UI) + screens/AdminDashboard.tsx (admin)
3. tsc + APK rebuild
   - cd apps/mobile/android && gradlew assembleRelease
   - 验证 BUILD SUCCESSFUL + ≤ 5 警告
4. aapt2 dump badging
   - 验 versionName=3.0.37 + versionCode=42 + application-label
5. scp APK + bump server 9 项版本号
   - scp app-release.apk root@159.75.16.110:/www/wwwroot/shipin-APP/public/DeepScript_v3.0.37.apk
   - 9 项同步: mobile version.ts + build.gradle + server package.json + index.ts + ecosystem + web version.ts + .env + systemd + changelog.json
```

### 10.2 必查项 (verify-deploy 维度 24 自动校验)

```bash
# APK bundle 必含 3 关键 API/UI 元素 (BUMP 同步标志)
unzip -p app-release.apk assets/index.android.bundle | grep -c 'notifyRechargePaid'  # ≥ 1
unzip -p app-release.apk assets/index.android.bundle | grep -c 'user_notified'      # ≥ 1
unzip -p app-release.apk assets/index.android.bundle | grep -c 'adminOrders'         # ≥ 1
```

### 10.3 跟 BUG-094/095/096 关系

- **BUG-094**: 状态机迁移漏 admin 端点 default (跟 S70 旧原则"主盯 web" 间接相关, web 端改了 admin 端点, mobile 端没动)
- **BUG-095**: DB schema enum 漏同步 (web 端用了 user_notified 状态, mobile 端没改 schema 同步)
- **BUG-096**: React 0 渲染陷阱 (web 端修了, mobile 端没修 admin 状态文案)

**3 BUG 共同教训**: web 端改 admin/user 状态机时, 必同步 mobile 端 3 文件 (api + UI + admin), 必跑 grep diff 评估

---

## § 11. 回滚 SOP (3 端独立 + 4 件套)

### 11.1 Server 回滚 (2 min)

```bash
# 1. 列出 dist 备份
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "ls -dt /www/wwwroot/shipin-APP/dist.bak.* | head -5"

# 2. 选备份回滚 (例: dist.bak.20260626-140000)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/shipin-APP &&
  /www/server/nodejs/vhost/scripts/shipin_APP.sh stop &&
  rm -rf dist &&
  mv dist.bak.20260626-140000 dist &&
  /www/server/nodejs/vhost/scripts/shipin_APP.sh start
"

# 3. 验证 24 维
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "bash /tmp/verify-deploy.sh"
```

### 11.2 Web 回滚 (1 min)

```bash
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/ab.maque.uno &&
  rm -rf dist &&
  mv dist.bak.20260626-140000 dist &&
  chown -R www:www dist &&
  /etc/init.d/nginx reload
"
```

### 11.3 Mobile 回滚 (1 min)

```bash
# 1. 公网撤回 (改 cp 老 APK)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/shipin-APP/public &&
  ls DeepScript_v*.apk  # 看历史版本
  cp DeepScript_v3.0.36.apk DeepScript_v3.0.37.apk  # 回退
"

# 2. server 9 项版本号回退
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  sed -i 's/APP_VERSION=3.0.37/APP_VERSION=3.0.36/' /etc/systemd/system/shipin-app.service &&
  sed -i 's/APP_VERSION=3.0.37/APP_VERSION=3.0.36/' /www/wwwroot/shipin-APP/.env &&
  systemctl daemon-reload && systemctl restart shipin-app.service
"
```

### 11.4 4 件套回滚检查清单

- [ ] server dist 备份存在 (`ls /www/wwwroot/shipin-APP/dist.bak.*`)
- [ ] web dist 备份存在 (`ls /www/wwwroot/ab.maque.uno/dist.bak.*`)
- [ ] 历史 APK 备份存在 (`ls /www/wwwroot/shipin-APP/public/DeepScript_v*.apk`)
- [ ] systemd unit env 已回退 (`grep APP_VERSION /etc/systemd/system/shipin-app.service`)
- [ ] 24 维验证 PASS (`bash /tmp/verify-deploy.sh`)

---

## § 12. 应急处理 (3 大常见故障)

### 12.1 web dist 被破坏 (BUG-099 同款, 2 bytes)

**症状**: `curl -I https://ab.maque.uno` 返 511B index.html (SPA fallback) / `head -c 100 dist/assets/index-*.js` 返 `0\n` 而非 `//`

**修法**:
```bash
# 1. 重新 build (vite deterministic)
cd F:/QiTa/banmu/APP/ai-video-script-app/apps/web
npm run build

# 2. 重打包 + scp
$tgt = Get-Date -Format 'yyyyMMdd-HHmmss'
cd F:\QiTa\banmu\APP\ai-video-script-app
tar -czf "apps\web\web-dist-$tgt.tgz" --exclude='node_modules' --exclude='src' --exclude='.git' apps/web/dist
scp -i C:\Users\Administrator\.ssh\test2 "apps\web\web-dist-$tgt.tgz" root@159.75.16.110:/tmp/

# 3. 远端解压 + nginx reload
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  cd /www/wwwroot/ab.maque.uno &&
  rm -rf dist &&
  tar -xzf /tmp/web-dist-$tgt.tgz --strip-components=2 -C /www/wwwroot/ab.maque.uno/ &&
  chown -R www:www dist &&
  /etc/init.d/nginx reload
"

# 4. 验证 (vite minified 必 = `//`)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "head -c 100 /www/wwwroot/ab.maque.uno/dist/assets/index-*.js | head -1"
```

### 12.2 DB schema enum 错 (BUG-095 同款)

**症状**: server 抛 `Data too long for column 'status'` / `Incorrect enum value`

**修法**:
```bash
# 1. 立即 SQL ALTER
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  mysql -h 10.1.0.11 -u root -p ai_script -e \"
    ALTER TABLE recharge_requests MODIFY COLUMN status ENUM('pending','user_notified','approved','rejected') NOT NULL DEFAULT 'pending';
  \"
"

# 2. server restart (mysql2 pool 刷新)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "
  /www/server/nodejs/vhost/scripts/shipin_APP.sh restart
"

# 3. db.ts 同步 (避免下次部署 ALTER 失效)
# 修 apps/server/src/models/db.ts: CREATE TABLE enum + ALTER 兼容老库 logger.warn

# 4. verify-deploy 维度 20 状态机迁移 4 处同步 grep
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "bash /tmp/verify-deploy.sh"
```

### 12.3 APK 签名错 (BUG-023 同款)

**症状**: 安装时 Android 报 "应用未安装" / `apksigner verify` 失败

**修法**:
```bash
# 1. 检查 release.keystore 存在
ls -la F:/QiTa/banmu/APP/ai-video-script-app/apps/mobile/android/app/release.keystore
# 预期: 2730 bytes (S59 BUG-023 永久签名)

# 2. 检查 build.gradle 签名配置
grep -A 5 'signingConfigs' F:/QiTa/banmu/APP/ai-video-script-app/apps/mobile/android/app/build.gradle
# 预期: storeFile release.keystore + keyAlias release + storePassword/keyPassword deepscript2026

# 3. 重新 build (clean + assembleRelease)
cd F:/QiTa/banmu/APP/ai-video-script-app/apps/mobile/android
gradlew clean
gradlew assembleRelease

# 4. verify-apk.py 验签名
python3 F:/QiTa/banmu/APP/ai-video-script-app/apps/mobile/scripts/verify-apk.py
# 预期: META-INF/CERT.RSA 1364 bytes (跟历史一致)
```

---

## § 13. 文档维护 SOP (规范随版本迭代自更新)

### 13.1 何时必更本文档 (跟 STANDARDS_EVOLUTION.md 一致)

- [ ] 新增 BUG-NNN 时 (BUMP 到 BUGS_INDEX.md + 必加 § 8 教训)
- [ ] 部署流程变更时 (本机 build 步骤 / 远端 reload 步骤 / verify 维度)
- [ ] 工具脚本变更时 (新增/废弃/改名)
- [ ] 9 项版本号清单变更时 (新增/废弃某项)
- [ ] verify-deploy 维度变更时 (新增维度/修改维度)

### 13.2 必跑 (commit 前)

```bash
# 1. 跑铁律 6 自检
python3 tools/check-commit-message.py

# 2. 跑 24 维验证 (部署后)
ssh -i C:\Users\Administrator\.ssh\test2 root@159.75.16.110 "bash /tmp/verify-deploy.sh"
```

### 13.3 文档关联矩阵

| 文档 | 关联本文档 | 同步时机 |
|---|---|---|
| `AGENTS.md` § 跨端 10 铁律 | § 7 铁律 6 + § 8 BUG 教训 + § 10 铁律 4++ | 铁律变更时 |
| `apps/mobile/AGENTS.md` | § 4 mobile 5 步 + § 5 自动给更新 + § 10 铁律 4++ | mobile 流程变更时 |
| `apps/web/AGENTS.md` | § 3 web 4 步 + § 10 铁律 4++ | web 流程变更时 |
| `apps/server/AGENTS.md` | § 2 server 5 步 + § 6 24 维 + § 7 铁律 6 | server 流程变更时 |
| `HANDOVER.md` | § 8 已知坑 + § 0 部署架构 | session 收尾时 |
| `docs/BUGS_INDEX.md` | § 8 已知坑 | 新 BUG 时 |
| `apps/mobile/BUGS.md` | § 8 已知坑 | mobile BUG 时 |
| `docs/VERSION_MANAGEMENT.md` | § 1 跨端版本号 | 版本规则变更时 |
| `docs/STANDARDS_EVOLUTION.md` | § 13 文档维护 | 规范变更时 |

---

## § 14. 文档变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-06-26 | S72 batch 7 后建立, 整合 BUG-079/082/090/094/095/096/097/098/099 9 教训, 14 段 SOP + 24 维验证 + 5 步同步 + 9 工具脚本 |

---

> **🚨 强约束总结 (跨项目通用 UX 原则)**:
> 1. **任何部署前必读 § 0-9** (缺一不可)
> 2. **任何 BUG 必修后必更 § 8 + BUGS_INDEX.md + mavis memory**
> 3. **任何工具变更必更 § 9 + 跑 pre-commit hook**
> 4. **任何 web 端 BUG 修完必跑 § 10 5 步同步 SOP** (铁律 4++ 反 S70 旧原则)
> 5. **任何 commit 必跑铁律 6 自检** (N 10 PASS)
> 6. **任何部署必跑 24 维验证** (PASS=24/24, 不允许"大致通过")
> 7. **文档随版本迭代自更新** (跟 STANDARDS_EVOLUTION.md 一致)
