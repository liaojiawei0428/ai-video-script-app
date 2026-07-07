# 📜 shipin-APP Release Checklist (项目宪法, 任何发布必走)

> **🆕 创建 2026-07-07** (v3.0.100 BUG-177 后续, S84)
> **背景**: v3.0.99 BUG-176 (server-only hotfix) 实战违反 `apps/server/AGENTS.md § 3 铁律 9`
> + 实战违反"必走 deploy.sh"纪律, 触发 v3.0.100 BUG-177 (强制升级 modal 永远弹死锁)
> **目的**: 把"发布流程"从"AI 自觉"升级到"机制强制" - 本文是项目宪法

---

## § 0. AI 必读 4 件套 (顺序不可颠倒, 任何发布版本前必读)

1. **`AGENTS.md` § 0 必读顺序** (跨端统一总入口, 中文/Persistence/铁律/工作流)
2. **`AGENTS.md` § 4 铁律 4+++++§ 6.31 BUG-177 实战** (强制升级体系, 跨项目通用铁律 #35)
3. **`apps/server/AGENTS.md` § 3 铁律 9** (server-only hotfix 必 rebuild APK, 配 v3.0.99 BUG-176 实战反思)
4. **`apps/mobile/AGENTS.md` § 4 升级链路 7 条铁律** (mobile 端独有强制升级铁律)

> **🚫 不允许跳步 / 不允许"我知道但省略" / 不允许"我以为"**
> 任何 release 任务的 AI, 必先读以上 4 件套, 再读本文 § 1-12。

---

## § 1. 查询版本号基线 (改前必查 4 件事)

```bash
# 1) 当前生产 server version
curl -sk https://ab.maque.uno/api/version | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('version=',d['version'],' mobileLatestApkVersion=',d['mobileLatestApkVersion'])"

# 2) 当前公网 APK
curl -I https://ab.maque.uno/app/DeepScript_v$(curl -sk https://ab.maque.uno/api/version | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['mobileLatestApkVersion'])").apk

# 3) 远端 systemd unit APP_VERSION (跟 .env 同步)
ssh -i <key> root@119.91.155.46 "grep ^APP_VERSION= /www/wwwroot/shipin-APP/.env && grep ^Environment=APP_VERSION= /etc/systemd/system/shipin-app.service"

# 4) 当前 8 处本地版本号状态
node tools/verify-version-8-points.js
```

---

## § 2. 跨项目通用铁律 #36 (v3.0.99 实战违反, 必背)

> **🆕 2026-07-07 S84 沉淀: 纸上铁律 + 执行纪律缺一不可**

```
纸上铁律 (已写在 apps/server/AGENTS.md § 3 铁律 9):
"server-only hotfix 必 rebuild APK + 必走 deploy.sh" (v3.0.62 BUG-131 加的)
```

```
v3.0.99 BUG-176 实战违反:
- ❌ BUG-176 (DeepSeek reasoning_content 污染) 只改 server src/ 一文件
- ❌ 没 bump mobile version.ts
- ❌ 没 rebuild mobile APK
- ❌ 没 scp 公网
- ❌ 没跑完整 deploy.sh (只手动 ssh + sed + systemctl restart)
- 触发 v3.0.100 BUG-177 强制升级 modal 永远弹死锁
```

```
执行铁律 (必做):
1. 任何 server 端代码改动 → 必跑完整 bash apps/server/deploy.sh
2. 必走 deploy.sh § 0-9 步 (8 步预检 + 12 维验证 + 1:1 abort)
3. 任何 server-only hotfix → 必 bump mobile version.ts + rebuild APK + scp 公网 (即使 mobile 0 业务变化)
4. 任何手动 ssh + sed + systemctl restart → 严禁 (deploy.sh 是唯一入口)
5. 任何 commit message → 必带 vX.Y.Z: <改动> (BUG-NNN + 规范修订) (跨端铁律 6)
```

---

## § 3. 改代码前 5 步 (任何 release 任务必跑)

1. **Read AGENTS.md** (跨端统一规范) - 5 min
2. **Read apps/mobile/BUGS.md 或 apps/server/BUGS.md** (跨端共用 BUG 库, 防重蹈覆辙)
3. **Read AGENTS.md § 4 铁律** (跨项目通用铁律 4+++, BUG-097/131/165/166/177 同源系列必读)
4. **Read 本文件 § 0-12** (项目宪法, RELEASE_CHECKLIST.md)
5. **Grep 关键 import / 函数** 是否引用真源 (不要臆造字段, 不要从 monorepo 拿 value)

---

## § 4. **强制: 同步 8 处版本号** (跨项目铁律 3, v3.0.33 强化)

**8 处版本号清单** (1 个数字必同时出现在这 8 处, 否则 deploy.sh 会 abort):

| # | 位置 | 文件路径 |
|---|---|---|
| 1 | mobile APP_VERSION | `apps/mobile/src/config/version.ts` (line 15 `export const APP_VERSION = 'X.Y.Z'`) |
| 2 | mobile build.gradle versionName | `apps/mobile/android/app/build.gradle` (`versionName "X.Y.Z"`) |
| 3 | mobile build.gradle versionCode | `apps/mobile/android/app/build.gradle` (`versionCode N+1`, 整数递增) |
| 4 | server package.json | `apps/server/package.json` (`"version": "X.Y.Z"`) |
| 5 | server src/index.ts fallback | `apps/server/src/index.ts` (line 170 `'X.Y.Z'`) |
| 6 | server ecosystem.config.js | `apps/server/ecosystem.config.js` (env + env_production 2 处 `APP_VERSION: 'X.Y.Z'`) |
| 7 | web version.ts | `apps/web/src/config/version.ts` (`APP_VERSION = 'X.Y.Z'`) |
| 8 | changelog.json | `apps/server/changelog.json` (prepend 新 entry + 顶部 `latest_version: "X.Y.Z"`) |

**额外 2 处远端 (deploy.sh 自动同步, 不需要手改)**:
| 9 | 远端 .env | `root@119.91.155.46:/www/wwwroot/shipin-APP/.env` (`APP_VERSION=X.Y.Z`) |
| 10 | 远端 systemd unit | `/etc/systemd/system/shipin-app.service` (`Environment=APP_VERSION=X.Y.Z`) |

```bash
# 必跑 (必 0 错)
node tools/verify-version-8-points.js X.Y.Z   # X.Y.Z = 新版本号
# 期望输出: PASS: 8 / FAIL: 0
# 如果 FAIL → 修对应文件, 再跑直到全部 PASS
```

---

## § 5. **强制: 本地构建 0 错** (必跑 5 步)

```bash
# 1. server 静态检查
cd apps/server
npx tsc --noEmit                                  # 期望 0 错 (pre-existing 错不动)

# 2. server 出 dist
npm run build
cp changelog.json dist/changelog.json             # S64 起必加 (tsc 不复制 json)

# 3. mobile 静态检查 (本机)
cd ../../apps/mobile
npx tsc --noEmit                                  # 期望 0 错 (跟 server baseline 对齐, 0 新错)

# 4. mobile build APK (3-5 min)
cd android
./gradlew assembleRelease                         # 出 app-release.apk

# 5. APK 验证 (必跑, 防 BUG-024 试纸错包 / BUG-023 签名错)
aapt2 dump badging app/build/outputs/apk/release/app-release.apk | grep versionName   # 期望 = X.Y.Z
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk         # 期望 = "CN=DeepScript Release"
```

---

## § 6. **强制: git pre-commit + pre-push hooks 安装** (一次性, 永久生效)

```bash
# 一次性安装 (项目根目录跑)
bash tools/install-all-hooks.sh

# 验证已装
ls -la .git/hooks/commit-msg .git/hooks/pre-push
# 期望 2 个文件都是 -rwxr-xr-x (可执行)

# 卸载 (如需要)
rm .git/hooks/commit-msg .git/hooks/pre-push
```

**hooks 作用**:

| Hook | 何时跑 | 拦截什么 |
|---|---|---|
| `commit-msg` | `git commit` 时 | commit message **必带 `vX.Y.Z:` 前缀 + 必含 `BUG-NNN` 或 "规范修订"** |
| `pre-push` | `git push` 时 | **自动跑 `tools/verify-version-8-points.js`**, 8 处版本号不一致必 reject |

```bash
# 写 commit message 标准格式 (AGENTS.md § 4 铁律 6 + BUG-093 沉淀)
git commit -m "vX.Y.Z: <改动描述> (BUG-NNN + 规范修订)"
# 例: git commit -m "v3.0.101: 修强制升级 modal 死锁 (BUG-177 + 跨项目铁律 #36 沉淀)"
```

---

## § 7. **强制: push 后跑 verify-version-8-points.js** (push 前会自动跑, push 后再跑 1 次校验)

```bash
# push 时自动跑 (pre-push hook):
git push origin main                              # 期望 hook 自动跑 verify-version-8-points.js + PASS

# push 后再跑 1 次确认:
node tools/verify-version-8-points.js X.Y.Z       # 期望 PASS
```

---

## § 8. **强制: 远端部署必走 deploy.sh** (唯一入口, 严禁手动)

```bash
# 推荐用 tools/deploy_v3.py 一键自动跑 (跨平台兼容, Windows/Mac/Linux)
#   Step 1-6:
#   1. 读版本号 (从 changelog.json + package.json)
#   2. 打包 dist.tar.gz
#   3. scp 4 件套 (dist + package.json + changelog.json + APK)
#   4. ssh + 跑 bash /www/wwwroot/shipin-APP/deploy.sh --skip-maintenance
#   5. cp APK → /www/wwwroot/shipin-APP/public/ + sha256 + nginx reload
#   6. 公网 HTTPS HEAD 验证 (BUG-117 防呆)

# 本机直接 ssh 跑 (老路, 强烈建议改成上面的脚本一键):
ssh -i <key> root@119.91.155.46 "bash /www/wwwroot/shipin-APP/deploy.sh --skip-maintenance 2>&1 | tee /tmp/deploy.log"

# 🚫 严禁手动部署路径:
#   ❌ ssh + sed .env + systemctl restart shipin-app
#   ❌ ssh + cp dist/index.js (rc=0 但 sha256 可能不变, BUG-144 教训)
#   ❌ ssh + cp changelog.json (缺 tar.gz 同步, BUG-090 教训)
#   ❌ ssh + 跑部分手动命令组合 (v3.0.99 BUG-176 实战违反这种)
```

**deploy.sh 会自动跑的硬卡**:
- ✅ systemd restart + reset-failed (防 BUG-168 卡死)
- ✅ APP_VERSION 同步到 .env + systemd unit (防 BUG-082 P3)
- ✅ **§ 6.6/9 维: `mobileLatestApkVersion == currentVersion` 1:1 abort** (BUG-165 加, 防 v3.0.99 ghost version)
- ✅ PID 文件同步 (宝塔 panel 读 PID 判启停)
- ✅ site.db shipin_APP config (run_user=root + is_power_on=true)
- ✅ 12 维验证 (systemd active + 6000 LISTEN + /health + /api/version + APK HTTP/2 200 + 宝塔 shipin_APP run=True)

---

## § 9. **强制: deploy 完必跑验证 (公网 + APK + 版本号 1:1)**

```bash
# 1) 公网 HTTPS HEAD APK 验证 (BUG-117 防呆)
curl -sIk https://ab.maque.uno/app/DeepScript_v{X.Y.Z}.apk 2>&1 | head -10
# 期望: HTTP/2 200 + content-type: application/vnd.android.package-archive + content-length: <跟本机一致>

# 2) 公网 /api/version 1:1 验证
curl -sk https://ab.maque.uno/api/version | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('version=',d['version'],' mobileLatestApkVersion=',d['mobileLatestApkVersion'])"
# 期望: version + mobileLatestApkVersion 都 = X.Y.Z

# 3) 12 维服务器端验证 (apps/server/deploy.sh 已自动跑, 可手动重跑)
ssh root@119.91.155.46 "bash /www/wwwroot/shipin-APP/deploy.sh --rollback 2>&1 | tail -30"
# 注: 实际不要跑 rollback, 仅作为触发 12 维 + 6 维验证的参考

# 4) systemctl 状态 + 6000 端口
ssh root@119.91.155.46 "systemctl is-active shipin-app && ss -tln | grep :6000"
# 期望: active + 0.0.0.0:6000 LISTEN
```

---

## § 10. **强制: server-only hotfix 检查** (v3.0.99 实战违反教训)

> **🆕 2026-07-07 S84 BUG-177 沉淀: 任何 server 改动必走这个清单**

```
情况 A: server-only hotfix (只改 apps/server/src/, mobile 没改业务逻辑)
✅ 必做 (即使是 server-only):
   □ bump mobile version.ts (即使 mobile 0 业务变化, versionCode 也必 +1)
   □ rebuild mobile APK (./gradlew assembleRelease)
   □ scp APK 到公网 /www/wwwroot/shipin-APP/public/DeepScript_v{新}.apk
   □ 跟 deploy.sh § 6.6 1:1 abort 配套 (mobileLatestApkVersion == currentVersion)
   □ 客户端启动会触发强制 modal, 用户点升级下到新 APK
   
   理由: deploy.sh 1:1 abort 不会放行"server bump 但 APK 没 push" (这正是 v3.0.99 BUG-176 的反例)

情况 B: mobile-only hotfix (只改 apps/mobile/, server 没改业务逻辑)
✅ 必做:
   □ bump server package.json + index.ts fallback + ecosystem.config.js (8 处同步, 即使 server 0 业务变化, 也必 bump)
   □ changelog.json bump entry (跟 8 处同步清单一致)
   □ rebuild APK + scp 公网

情况 C: 跨端 + BUG 修复 (server + mobile 都有改)
✅ 必做: 8 处版本号同步 + 跨端 1:1 镜像同步 (跨端铁律 4++)
```

**实战工具** (新加, BUG-177 沉淀):

```bash
# 自动检测: 改了 server 但没 bump mobile?
node tools/check-server-only-hotfix.js
# 期望: NO (刚改了 server/, mobile version.ts 也 bump 了)
# 如果输出 YES (⚠️ 高危, v3.0.99 BUG-176 反例) → 自动 abort 提示
```

---

## § 11. 历次实战踩坑 (任何 release 必读, 防重蹈覆辙)

| BUG 编号 | 实战违反点 | 修法 | 当前防线 |
|---|---|---|---|
| **BUG-177 (v3.0.100)** | client 跟 server 对比用 `info.version` 不用 `info.mobileLatestApkVersion` | App.tsx line 309 `mobileLatestApkVersion \|\| version` 兜底 | § 10 情况 A server-only hotfix 必 bump mobile + rebuild APK |
| **BUG-176 (v3.0.99)** | 改了 server src/ 一文件, 没 bump mobile + 没 rebuild APK | deploy.sh § 6.6 1:1 abort 强拦截 | § 10 + 本文 § 8 强制走 deploy.sh |
| **BUG-165 (v3.0.88)** | server-only hotfix 漏改 .env APP_VERSION | server 启动时 console.warn + deploy.sh 同步 | § 4 8 处版本号同步 + § 10 |
| **BUG-145 (v3.0.77)** | apkVersion.ts module-scope cache 5 min TTL 撞 deploy 时序坑 | 部署后 systemctl restart shipin-app 清缓存 (mavis memory 沉淀) | deploy.sh 已走流程 |
| **BUG-144 (v3.0.75)** | scp dist 期间 server 进程占用文件 (rc=0 但 sha256 不变) | 部署前 systemctl stop → scp → start | § 8 deploy.sh 是唯一入口 |
| **BUG-131 (v3.0.62)** | server bump 没 rebuild APK → APK 404 HTML → Status Code 16 | server 启动扫 `getMobileLatestApk()` 扫公网目录 + `mobileLatestApkVersion` 字段 | § 10 + § 8 deploy.sh |
| **BUG-117 (v3.0.46)** | deploy.py 漏推 APK → 公网 v3.0.45 APK 不存在 | tools/deploy_v3.py 必 scp 4 件套 + 公网 HEAD 5 维验证 | § 9 必跑 |
| **BUG-073 (v3.0.33)** | tsc 输出不完整 (只有 201 行) 部署后线上错 | deploy.sh 验证 head 必须 = "const appConfig" + 行数检查 | deploy.sh § 3 已自动验证 |
| **BUG-090 (v3.0.36)** | 部署漏 cp changelog.json → /api/version 返老 changelog | deploy.sh 双覆盖 (root + dist 两份) | § 4 + § 9 |

---

## § 12. 跨端 8 处版本号同步自检命令模板

```bash
# 一次性查 8 处本地版本号 (开发机跑)
node tools/verify-version-8-points.js X.Y.Z

# 期望输出 (成功):
# ✓ mobile version.ts
# ✓ mobile build.gradle name
# ✓ mobile build.gradle code
# ✓ server package.json
# ✓ server src/index.ts
# ✓ server ecosystem config
# ✓ web version.ts
# ✓ changelog.json latest_version
# ✓ 7-8 处远程版本号同步: .env=X.Y.Z systemd unit=X.Y.Z
# PASS: 8 / FAIL: 0
```

如果 FAIL, 修对应文件 (按 § 4 清单位置) 再跑。

---

## § 13. 紧急回滚 (最坏情况)

```bash
# 服务器端跑 (会自动找最新备份回滚):
ssh root@119.91.155.46 "bash /www/wwwroot/shipin-APP/deploy.sh --rollback"
# 自动找最新 dist.bak.* 备份 → 回滚 → 重新跑 12 维验证

# 手动回滚 (deploy.sh 失效时):
ssh root@119.91.155.46 "ls -td /www/wwwroot/shipin-APP/dist.bak.* | head -1"  # 找最新备份
ssh root@119.91.155.46 "rm -rf /www/wwwroot/shipin-APP/dist && cp -r <最新备份> /www/wwwroot/shipin-APP/dist && systemctl restart shipin-app"
```

---

## § 14. 跟其他文档的关系 (避免重复维护)

| 文档 | 长度 | 角色 | 什么时候读 |
|---|---|---|---|
| **本文 RELEASE_CHECKLIST.md** | ~400 行 | **项目宪法 + 强制清单** (AI 必读) | 任何 release 任务前 § 0 必读 |
| `docs/DEPLOY_RELEASE_FLOW.md` | 1097 行 | **完整 SOP** (14 段 + 24 维验证 + 9 已知坑 + 11 工具脚本) | 出问题时 debug 翻看 |
| `docs/VERSION_MANAGEMENT.md` | - | 跨端版本管理 + § 5 发版 SOP | 改 1 处版本号时翻看 |
| `docs/BAOTA_NODE_PROJECT_DEPLOY.md` | - | 宝塔 Node 项目部署 SOP (S70) | 涉及宝塔 panel 配置时翻看 |
| `apps/server/deploy.sh` | 379 行 | 远端部署脚本 (强制入口) | 远端服务器上跑 |
| `tools/verify-version-8-points.js` | 86 行 | **8 处版本号同步自检** | 本地 + pre-push 自动 |
| `tools/deploy_v3.py` | 189 行 | **一键自动部署** (Windows 兼容) | 本机跨平台部署 |

---

## 历次更新

| 日期 | 版本 | 改动 | 沉淀 |
|---|---|---|---|
| 2026-07-07 | v3.0.100 BUG-177 后续 | 🆕 项目宪法, 14 段强制清单 | v3.0.99 BUG-176 违反铁律实战 |
| 下次更新 | - | 加 § 10 server-only hotfix 检查脚本自动化 (从手动清单升级到脚本检查) | v3.0.101+ 验证 |

> **最后更新**: 2026-07-07 (v3.0.100 BUG-177 后续, S84)
> **下次 review**: shipin-APP release 流程变更 / 新 BUG 跟 release 相关时
