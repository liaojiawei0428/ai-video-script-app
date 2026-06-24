# Deep剧本 Web 端部署规范 (S65 新建)

> **适用范围**: `apps/web/` (Vite + React 18 + TypeScript + Tailwind + shadcn/ui + Zustand)
> **版本**: v1.0 (2026-06-24 S65 新建)
>
> **强制阅读**: 任何 AI 执行 web 端部署 / build / nginx reload 前必读。
> **配套**: [`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md) § 5 (跨端发版) + [`../../docs/DEPLOY.md`](../../docs/DEPLOY.md) (server-only) + [`apps/web/scripts/deploy.sh`](../../apps/web/scripts/deploy.sh) (部署脚本)

---

## § 0. Web 端部署目标 & 环境

### 0.1 目标环境

| 项 | 值 |
|---|---|
| 服务器 | `159.75.16.110` (跟 server 同机) |
| 部署根 | `/www/wwwroot/ab.maque.uno/dist/` (注意是 `dist/` 子目录, 不是 `ab.maque.uno/` 根) |
| Nginx root | `/www/wwwroot/ab.maque.uno/dist` (从宝塔 `ab.maque.uno.conf` 读) |
| 公网 URL | `https://ab.maque.uno/` |
| 公网 SPA 路径 | `https://ab.maque.uno/download` (S58 P1 加的 APP 下载页) |
| 公网 APK 直链 | `https://ab.maque.uno/app/DeepScript_v{VERSION}.apk` |
| Bundle 输出 | `apps/web/dist/assets/index-{HASH}.js` + `index-{HASH}.css` + `index.html` |

### 0.2 本地源

- **路径**: `F:\QiTa\banmu\APP\ai-video-script-app\apps\web\`
- **构建工具**: Vite 5 + tsc -b (严格类型检查)
- **包管理**: npm workspaces (monorepo 共享 dependencies)

---

## § 1. 关键节点 (5 步)

```
[Pre-Build] → [Build] → [Package] → [Deploy] → [Verify]
1. 本地装依赖     2. tsc +  3. tar dist/  4. scp +    5. 健康
                  vite build                nginx reload  检查
```

---

## § 2. 完整流程 (Step-by-Step)

### 节点 1: 本地装依赖 (可选, 首次或加新包时)

```bash
# monorepo 根
cd F:\QiTa\banmu\APP\ai-video-script-app
npm install --no-audit --no-fund
```

### 节点 2: 本地 build (本机 Windows)

```bash
cd apps/web
npm run build
# 期望输出:
# > @ai-script/web@2.0.0 build
# > tsc -b && vite build
# ✓ 1672 modules transformed
# dist/index.html                   0.50 kB
# dist/assets/index-{HASH}.css      40.98 kB
# dist/assets/index-{HASH}.js      469.36 kB
# built in 8.19s
```

**关键检查**:
- ✅ `tsc -b` 必须 0 错 (类型严格, 跟 server 端的 tsc 不同, vite 不暴露 TS 错)
- ⚠️ Vite 报 `dynamic import will not move module into another chunk` 不算错, 是 lib/api.ts 既静态也动态导入, 不影响功能
- ✅ Bundle hash 必须跟旧版不同 (e.g. 从 `index-Dr4RV-Kp.js` 变成 `index-DoXhDwc-.js`), 证明新代码进了 dist

### 节点 3: 打包 dist (tar.gz)

```bash
# 本机 PowerShell
cd F:\QiTa\banmu\APP\ai-video-script-app\apps\web
& 'C:\windows\system32\tar.exe' -czf 'F:\QiTa\banmu\APP\ai-video-script-app\dist-web-{VERSION}.tar.gz' dist
# 期望: ~140KB
```

**为什么 tar 而不是 cp/rsync**:
- tar 保留目录结构 (`dist/`, `dist/assets/`)
- 跨平台一致 (Windows 本机 tar.exe 跟 Linux 远端 tar 互认)
- 一致性: 跟 server 端 `dist-server.tar.gz` 风格一致

### 节点 4: 上传 + 部署

```bash
# 4.1 scp 上传
scp -i 'C:\Users\Administrator\.ssh\id_ed25519' -o BatchMode=yes \
  'F:\QiTa\banmu\APP\ai-video-script-app\dist-web-{VERSION}.tar.gz' \
  'root@159.75.16.110:/tmp/dist-web-{VERSION}.tar.gz'

# 4.2 远端部署 (建议用脚本, 不直接打命令)
scp -i 'C:\Users\Administrator\.ssh\id_ed25519' -o BatchMode=yes \
  'F:\QiTa\banmu\APP\ai-video-script-app\scripts\s65_web_deploy.sh' \
  'root@159.75.16.110:/tmp/s65_web_deploy.sh'

ssh -i 'C:\Users\Administrator\.ssh\id_ed25519' -o BatchMode=yes \
  root@159.75.16.110 'bash /tmp/s65_web_deploy.sh'
```

**远端脚本内容** (`scripts/s65_web_deploy.sh`):

```bash
#!/bin/bash
set -e
cd /www/wwwroot/ab.maque.uno
TS=$(date +%Y%m%d_%H%M%S)
# 1. 备份旧 dist
cp -r dist dist.bak.s65-${TS}
# 2. 解压新 dist
tar -xzf /tmp/dist-web-{VERSION}.tar.gz
# 3. 验证
ls -la dist/ | head -10
head -3 dist/index.html
# 4. nginx test
nginx -t 2>&1 | tail -3
# 5. nginx reload (宝塔 master pid)
PID=$(cat /www/server/panel/vhost/nginx/nginx.pid 2>/dev/null)
[ -n "$PID" ] && kill -HUP "$PID" && echo "nginx reloaded (pid $PID)"
```

**为什么不用 `apps/web/scripts/deploy.sh`**:
- 那个脚本是 S58 P1 写的, 本地 build + 本地 scp (跟 S65 实践一致)
- 但**没备份** dist.bak.*, 升级失败无回滚
- 没 nginx reload (依赖 `nginx -s reload` 在某些宝塔配置失败)
- **S65 实战**: 用 `scripts/s65_web_deploy.sh` 替代 (含备份 + reload), 下次可改名 `scripts/web_deploy.sh`

### 节点 5: 健康检查 + Playwright 验证

```bash
# 5.1 公网首页 HTTP 200
curl -sI https://ab.maque.uno/ --max-time 10 | head -3
# 期望: HTTP/2 200, server: nginx/1.26.3

# 5.2 新 bundle 公网 200 (用上次 build 看到的 hash)
curl -sI https://ab.maque.uno/assets/index-DoXhDwc-.js --max-time 10 | head -3
# 期望: HTTP/2 200

# 5.3 /download 页 Playwright 验证 (S64 P8 起新增)
# 用 mavis mcp call playwright browser_navigate '{"url":"https://ab.maque.uno/download"}'
# 期望: heading 含 "v{VERSION} 更新内容({DATE})" + 真实 highlights + 下载按钮 href=DeepScript_v{VERSION}.apk
```

---

## § 3. 5 维验证 (跨端通用)

跟 [`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md) § 5.8 一致:

| # | 验证项 | 命令 |
|---|---|---|
| 1 | 公网 APK HTTP 200 | `curl -sI https://ab.maque.uno/app/DeepScript_v{VERSION}.apk \| head -3` |
| 2 | 远端 SHA256 = 本机 | `Get-FileHash app-release.apk -Algorithm SHA256` 对比 |
| 3 | `/api/version` 触发升级 | `curl /api/version?version={OLD}` 返 `needUpdate:true, forceUpdate:true` |
| 4 | **/download 页 Playwright 验证** | 验证版本号 + changelog + APK 直链 |
| 5 | 历史 APK + bundle 未覆盖 | `ls /www/wwwroot/ab.maque.uno/dist.bak.*` 看备份 |

**新增第 4 项是 web 端特有**: 跟 server 端的 5 维不完全相同, server-only 6 维 (进程/端口/health/版本/鉴权/日志) 是另一个角度。

---

## § 4. 常见问题 (Web 端特有)

### 4.1 curl 拿到 SPA index.html 不是 DownloadPage

**症状**: `curl https://ab.maque.uno/download` 拿到 web SPA 的 `index.html` (title "Deep剧本 · Web 端"), 不是 DownloadPage 内容。

**真相**: **这是 SPA 正常行为**! curl 不执行 JS, 拿的是 nginx 返回的静态 `index.html`。
**用户实际在浏览器访问时**: React Router 启动 → 识别 `/download` 路径 → 渲染 DownloadPage。

**验证**: 必须用 Playwright 真实访问才能看到渲染结果, 不能信 curl 输出。

### 4.2 bundle hash 没更新

**症状**: build 后 `dist/assets/index-{HASH}.js` hash 跟上次一样, 部署后用户还是看老版。

**诊断**:
1. `npm run clean` (如果有) 或 `rm -rf dist/ node_modules/.vite`
2. 重新 `npm run build`
3. 看 dist 实际 hash 是不是新的

**预防**: 部署前必查 hash 跟 server 端 `/api/version` 同步

### 4.3 nginx reload 失败

**症状**: `nginx -s reload` 报 "command not found" 或没生效

**原因**: 宝塔面板的 nginx 不是标准 `/etc/init.d/nginx`, 用的是 master pid 文件
**解决**: `kill -HUP $(cat /www/server/panel/vhost/nginx/nginx.pid)` (master 进程会自动重启 worker)

### 4.4 tsc 报错但 vite 没暴露

**症状**: `npm run build` 通过, 但运行时浏览器 console 报 "X is undefined" / 类型错。

**根因**: `vite build` 只跑 vite 不跑 tsc, TS 错误被 vite 容忍 (跟 RN Metro cache 类似, BUG-056 教训)

**解决**: 显式跑 `npx tsc -b` 验证, 必须 0 错再部署

---

## § 5. AI 助手必须遵守的 5 条规则

1. **本地 build, 不在远端 build**: 跟 server 端 "服务器 build" 不同, web 端 vite build 必须本地 (避免本地无 node 风险, 跟 § 0.2 对齐)
2. **build 完必看 hash 是不是新的**: hash 相同 = 没新代码进 dist, 部署无效
3. **scp 上传前必 `tar -czf`**: 单 cp 目录保留不了 owner/permission, 跟 server 部署不一致
4. **远端部署用脚本, 不直接 ssh 命令**: 直接 ssh 多命令 quoting 容易挂 (PS 5.1 + 中文), 脚本化稳
5. **部署完必跑 Playwright 验证 /download 页**: 单纯 curl 不够, 必须看真实渲染

---

## § 6. 部署检查清单

```
[ ] 1. 本地 build 完, dist/index.html + dist/assets/index-{HASH}.js 存在
[ ] 2. tsc -b 0 错 (显式验证, 不信 vite)
[ ] 3. 打包 dist-web-{VERSION}.tar.gz
[ ] 4. scp 上传到 /tmp/, 本机 SSH key 锁 600
[ ] 5. 远端脚本: 备份 dist → dist.bak.{TS}
[ ] 6. 远端脚本: 解压新 tar → dist/
[ ] 7. 远端脚本: nginx -t 通过 + nginx reload
[ ] 8. 公网首页 HTTP 200 (curl)
[ ] 9. 新 bundle 公网 200 (curl)
[ ] 10. Playwright 真实访问 /download, 验证版本号 + changelog + APK 直链
[ ] 11. DEV_PROGRESS.md 加 AI 会话追踪行
[ ] 12. (可选) mavis-trash 临时 tar + 脚本
```

---

## § 7. 跨文档引用

| 场景 | 看哪份 |
|---|---|
| 跨端发版 (mobile + server + web 一起) | [`docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md) § 5 |
| Server 部署 | [`docs/DEPLOY.md`](../../docs/DEPLOY.md) |
| Mobile APK 升级 | [`apps/mobile/DEPLOY.md`](../../apps/mobile/DEPLOY.md) |
| 规范怎么跟版本迭代 | [`docs/STANDARDS_EVOLUTION.md`](../../docs/STANDARDS_EVOLUTION.md) |
| 部署脚本 (`apps/web/scripts/deploy.sh`) | 看脚本头部注释 (建议 S66 升级成 `scripts/web_deploy.sh`) |
| 后端 worker 实战约束 | [`docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md) |

---

> **最后更新**: 2026-06-24 (S65)
> **下次 review**: web 端架构变更 (新依赖 / 新部署平台) 时必更新
