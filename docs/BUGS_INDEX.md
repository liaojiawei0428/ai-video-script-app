# docs/BUGS_INDEX.md — BUG 案例库 AI 快速查询索引 (S69 v1.0)

> **目的**: 让任何 AI 接活前 30 秒内定位 BUG 编号 + 修法 + 教训, **不再重复同样错误**
> **配套**:
> - [`apps/mobile/BUGS.md`](../apps/mobile/BUGS.md) — **完整 1240 行 / 76 BUG 详细案例** (项目状态/现象/根因/修法/教训/引用)
> - [`AGENTS.md`](../AGENTS.md) — 跨端总入口, 必读第 16 项 = 本 BUGS_INDEX
> - [`HANDOVER.md`](../HANDOVER.md) — 跨 session 交接, § 0 30 秒速览引用本索引
> - 维护者: 每次重要 session 收尾 (S70/S71/...) 必追加新 BUG + 更新本索引
> - 最后更新: 2026-06-27 (S72 batch 11 v3.0.43 Stage 1 收尾, v2.5, 新增 BUG-108 统一图片加载 UI 模块)

---

## § 1. 30 秒速览 (按编号倒序, 最近修的优先看)

| BUG | session | 状态 | 简述 | 修法 commit |
|---|---|---|---|---|
| **BUG-108** | S72 batch 11 v3.0.43 Stage 1 | ✓ 已修 | **统一图片加载 UI 模块 (跨端铁律 4++ web + mobile 1:1 镜像, Skeleton + ImageWithLoading 3 态组件)**: 服务器 5Mbps 带宽, 图片加载慢 (10-20 秒); LLM 生成图/视频需几分钟, 用户等待焦虑; web 端 17 page 全 Tailwind 手写没有骨架屏, mobile 端 SkeletonLoader 是基础 opacity pulse; shipin-APP 之前没有统一的"加载中"+"生成中" UI 模块, 用户体验割裂 | (Fix 1) `apps/web/src/components/ui/` 新建独立目录 (填平 [GAP] M-5 独立组件缺失): `skeleton.tsx` (shadcn 风格 opacity pulse) + `skeleton-presets.tsx` (SkeletonCard / SkeletonImage / SkeletonText 预制) + `image-with-loading.tsx` (3 态: loading→ready→error + LQIP 占位 + shimmer 动画 + 200ms 淡入 + onLoaded 回调 Stage 2 接入缓存); (Fix 2) web 集成: `CharacterDetailPage` (sheet image 3/4) + `AssetLibraryPage` (imageData data URL) + `EpisodeDetailPage` (comicImage 3 处) 全部用 ImageWithLoading 替换原生 `<img>`; (Fix 3) `apps/mobile/src/components/ui/` 新建独立目录 (跟 web 1:1 镜像, 跨端铁律 4++): `Skeleton.tsx` (Animated opacity 0.3~1 pulse + 3 预制组件) + `ImageWithLoading.tsx` (Animated.Image + retry key + fallback 重试 + onLoaded 回调); (Fix 4) mobile 集成: `CharacterDetailScreen` (sheetImage 100%) + `ImageAgentScreen` (refImage 80x80 + resultImage 320x320) 3 处用 ImageWithLoading 替换原生 `<Image>`; (Fix 5) 配套: `apps/web/src/lib/utils.ts` (cn 工具, clsx + tailwind-merge) + `tailwind.config.js` (shimmer keyframes + animation) + `index.css` (.skeleton-shimmer 工具类) + web AGENTS.md § 4 第 1 条微调 (允许 tailwind-merge + cn() + components/ui/, 不推翻 17 page Tailwind 手写传统); (Fix 6) 双端 build OK (web 4.10s 新 bundle index-SsjEDax8.js 510KB, mobile 57s 增量 APK 30083055 bytes SHA256 7DC4A218...31626) + BlueStacks 5 装 APK + MainActivity 启动 + 登录态保留 + BookshelfPage 渲染 OK; (Fix 7) 3 阶段交付节奏 (Stage 1 骨架屏 ✓ → Stage 2 本地缓存 RNFS+MMKV+hash+LRU+ETag → Stage 3 跨端 useMediaLoader hook + Lottie 生成中动画 + 端到端) |
| **BUG-107** | S72 batch 10 v3.0.42 | ✓ 已修 | **web + mobile characterUtils.ts objectToText 输出中英夹杂 (LLM 返回的 11 字段 JSON 对象含 raw 英文 key, 跟 user 中文 UI 不一致)**: BUG-105 (v3.0.40 server + v3.0.41 mobile sync) 移植 web utils 时漏配套 KEY_LABEL 中文 label 字典, mobile 显示 `role_type: 主角 / gender: 女 / hair_color: 黑色` 等中英夹杂. 跟 BUG-079 TS 编译过 ≠ runtime 正确 100% 同源, 跟 BUG-105 mobile sync 修法不彻底 100% 同源 | (Fix 1) `apps/web/src/lib/characterUtils.ts` 加 `KEY_LABEL: Record<string, string>` 字典 (37 字段英文 key → 中文 label, 跟 server `characterService.ts` line 391-404 v2.5.35 1:1 对齐), `objectToText()` 改用 `${KEY_LABEL[k] || k.replace(/_/g, ' ')}` 替换 raw 英文 key; (Fix 2) `apps/mobile/src/utils/characterUtils.ts` 同步加 KEY_LABEL 字典 (跟 web 端 1:1, 跨端铁律 4++ 配套), 3 个 screen 显示 description 100% 中文 label; (Fix 3) `tools/verify-bug107-key-label.js` 入仓 (6/6 PASS: 中文 label 完整替换 + 空格分隔 key 兼容 + fallback 走 `k.replace(/_/g, ' ')` + name 字段过滤 + 数组值拼接 + KEY_LABEL 字典 37 项 1:1 三端对齐); (Fix 4) 8 项版本号同步 3.0.41 → 3.0.42 (mobile version.ts + build.gradle versionCode 45→46 + server package.json + index.ts fallback + ecosystem 2 处 + web version.ts + APP_VERSION_CODE 45→46 + changelog.json + 远端 .env + 远端 systemd unit); (Fix 5) BlueStacks 5 端到端验证 v3.0.42 APK 装 + ScriptDetail 角色分析 0 raw 英文 key + 30+ 中文 label 全显示 (类型/性别/年龄/身高/发色/发型/上衣/下装/外套/显著特征/性格/关系 etc.) |
| **BUG-106** | S72 batch 9 v3.0.41 收口 | ✓ 已修 | **verify-deploy-24d.sh 跑不通, 24 维验证脚本自身 5 子 bug (跟 BUG-079 假报告 100% 同源: 脚本 100% 全过 ≠ 实际部署健康)**: 子 bug 1) `__import__('urllib.request', fromlist=['urlopen']).request.urlopen` AttributeError (python `urllib.request` 没有 `.request` 属性); 子 bug 2) bash f-string `f'...env={$APP_VERSION}...'` 被 python 解析为 `env=3.0.41` 表达式, SyntaxError (应避免 f-string 内嵌 bash 变量); 子 bug 3) bash 算术 `$((V24_NOTIFY + V24_PAID + V24_STAGE))` 在 `grep -c` 输出多行时 syntax error (应 `grep -ao ... \| wc -l` + 默认值 0); 子 bug 4) awk `-F: '{s+=$2}'` 处理 `grep -c` 单文件输出 (无 filename prefix, $2 是空字符串) 拆错, 应 `grep -hc ... \| awk '{s+=$1}'`; 子 bug 5) WEB_DIST_DIR 路径错: `/www/wwwroot/ab.maque.uno/dist/assets` 是 S72 batch 6 老位置, S72 batch 8 改 `/www/wwwroot/web-app/dist/assets` (index-B1XyyGhQ.js 当前) | (Fix 1) `apps/server/scripts/verify-deploy.sh` 入仓 33080 bytes (605 行 24 维全修复) + (Fix 2) `verify-deploy-24d.sh` 改 wrapper 引用 `$(dirname "$0")/verify-deploy.sh` 相对路径 (S72 batch 9 抛弃 /tmp/ 绝对路径, 跟 web dist 路径反转同源) + (Fix 3) 远端实测 27 PASS + 0 FAIL + 0 SKIP (维度 1-22 + 23a userNotifiedAt 修法 + 23b 反模式 0 命中 + 24 APK bundle 同步) + (Fix 4) BlueStacks 5 端到端验证 v3.0.41 APK 装 + navigate CharacterList → CharacterDetail 看 description 11 字段兼容显示 (无 [object Object] 乱码) |
| **BUG-105** | S72 batch 8 v3.0.40 server + v3.0.41 mobile sync | ✓ 已修 (server + mobile) | **角色分析 prompt 跟 user 需求不一致, 走老 37 字段固定格式 (固定所有角色身高体型等等信息), 跟 user 明确"根据剧情内容来提取角色形象, 不得乱写" 冲突**: 现状 2 个 prompt 文件: `novelAnalysis.ts` 老版 37 字段 (v2.5.14) + `characterDescription.ts` 新版 Markdown 5 section (v3.0.0.30 S50 v2); 但 `novelService.needsDescExtraction` 永远 false (老 prompt 必填 37 字段, parsedChars.description 永远 ≥ 2 字段) → 新版 characterDescription.ts 永远不被调用 → 角色分析 100% 走老 37 字段 → 逼 LLM 编造不存在的字段 (例: 路人甲根本没提身高, LLM 编"中等身材" 凑数) | (Fix 1) `novelAnalysis.ts` 简化 🎭 角色分析部分, 从 37 字段固定格式 → 极简 4 基础字段 (角色名 + 身份 + 角色类型 + 阵营), 详细描述完全交给后续 extractDescriptions; (Fix 2) `novelService.parseCharactersFromReport` 重写, 容错新格式 (只解析 4 基础字段, description 字段留空), 老 37 字段格式也兼容; (Fix 3) `novelService.parseAndSave` needsDescExtraction = true (永远调新版), 让 characterDescription.ts v3.0.0.30 新版 prompt 真正生效; (Fix 4) `characterSheetPrompt.ts` 重写, `CharacterSheetData` 删 37 字段, 保留 name/styleId/visualDescription/gender 4 字段, 不用 37 字段拼 visual prompt (跟 user "不要用字段限制" 100% 一致); (Fix 5) `characterService.ts generateImageVariants` 改用 visualDescription 字段 (替代 prompt_safe_description), 删 extractDistinctiveFeatures 函数 (dead code); (Fix 6) `novelService.backfillCharactersFromReport` 走新版 characterDescription.ts, 跟 /characters/extract 端点一致 (web + mobile 列表页 重新分析 按钮) |
| **BUG-104** | S72 batch 8 v3.0.39 收口 | ✓ 已修 | **server bump 3.0.39 漏 rebuild APK, user 升级弹窗 APK 404**: BUG-103 修法只 bump server 端, 漏 bump mobile build.gradle + rebuild APK + scp, 公网 `https://ab.maque.uno/app/DeepScript_v3.0.39.apk` HTTP/2 404. v3.0.38 user 启动 → /api/version 返 3.0.39 → compareVersions=-1 → needUpdate=true → 弹升级窗 → user 点下载 → 404. 跟 BUG-097 mobile 漏修 web 100% 同源, 跟 BUG-103 删 server 自动退款漏刷 APK 100% 同源 | (Fix 1) bump mobile `build.gradle` versionCode 43→44 + versionName 3.0.38→3.0.39 + `version.ts` APP_VERSION + APP_VERSION_CODE 同步; (Fix 2) bump web `version.ts` APP_VERSION + APP_VERSION_CODE 同步; (Fix 3) rebuild APK 44s (mobile 端没改 src 但 version 改了 → bundle 重 build → 新 SHA256 `3F188A109C055369E314542809C11AB53C8F368A1CE5FE3A59E5517CCA6CDEC5` 30,077,287 bytes); (Fix 4) scp APK 到公网 + web build 3.10s (新 hash `index-Bnh837h2.js` 480.43 kB) + scp dist + nginx reload; 4 件套 v3.0.39 100% 同步, 24 维全 PASS, 9 项版本号 grep 100% |
| **BUG-103** | S72 batch 8 v3.0.39 | ✓ 已修 | **refundStep 自动退款退多了 34.93 元 (h773052122 余额异常 35.07)**: novel "没钱修什么仙" analyze 失败 (2910536 字 task failed), `billingService.refundStep` 自动退 34.93 元, 但 user 没付款不该退 (跟 BUG-072 D 短期方案错同源); 实际根因: 自动退款机制没 review 环节, user 不付款也退 (跟 S72 batch 7 BUG-100 catch 漏补刀同源: 修法 1 不彻底) | (Fix 1) DB 撤销: `UPDATE billing_logs SET ref_label = CONCAT('[已撤销 BUG-103 admin manual 2026-06-26] ', ref_label) WHERE id='1c1aacef-...'` (audit trail) + `UPDATE users SET balance = balance - 34.93 WHERE id='3b3aa45d-...'` (35.07 → 0.14 = 0.03 初始 - 0.11 消费); (Fix 2) 删 `billingService.refundStep` 整方法 (line 405-445) + `novelService` catch 块删调用 (line 414-420), 失败只 notifyError 通知 user '请联系客服' (跟 BUG-072 D 长期方案 '接支付宝回调' 一致); (Fix 3) 4 项版本号 3.0.38→3.0.39 (server package.json + index.ts fallback + ecosystem 2 处 + changelog.json + .env + systemd unit), mobile/web/APK 保持 v3.0.38 (没改前端) |
| **BUG-101** | S72 batch 8 v3.0.38 | ✓ 已修 | **APP 上传小说分析失败 "Cannot read property 'bg' of undefined"**: mobile 端 5 个 `toast.show(msg, '<Ionicons-name>')` 错调用 (UploadScreen + OutlineReviewScreen x 3 + PlotGraphScreen), 误把 cloud-upload/sparkles/checkmark-circle 当 ToastVariant, runtime `VARIANT_COLORS['cloud-upload']` = undefined, `v.bg` 抛错 (TS 编译过, runtime 错, 跟 BUG-079 假报告 100% 同源) | (Fix 1) Toast.tsx line 152 加 `|| VARIANT_COLORS.default` 防御性 fallback (跟 BUG-082 catch 必归一 + BUG-098 SQL params 必归一 同源); (Fix 2) 5 个错调用全改 `'success'` 明确 variant; 9 项版本号 3.0.37→3.0.38 同步; 配套 verify-bug101.sh 5 维 (fallback 命中 + 0 错调用 + ≥ 5 'success' + /api/version 4 字段 + 公网 APK SHA256) |
| **BUG-100** | S72 batch 8 v3.0.37 | ✓ 已修 | **69 个 video_generations 卡 queued 累积 17 天 (2026-06-09 ~ 2026-06-26), 生视频永远没结果**: 远端 server log 6+ 次 `ffmpeg frame extraction failed` + `Agnes Video create timeout (60000ms)` + `fetch failed` + `状态 tool_completed 不可确认`, DB 实际 `failed=58 queued=11 image_completed=41` (生图能跑, 跟 v3.0.0 统一 key 无关 — Agnes key 本身统一, 老名 AGNES_IMAGE_API_KEY 是 v2.5.x 变量名) | 3 fix 一起发版: (Fix 1) ffmpegHelper 改用 `image2pipe` muxer 走 stdout (替代 image2 muxer + -update 1, 跨 ffmpeg 6.1.1/6.0/5.x 稳定); (Fix 2) videoAgentService.confirm() 允许 `tool_completed` 状态重 confirm (跟 BUG-081 状态机迁移必同步 4→5 处配套); (Fix 3) runCreateTaskInBackground 2 个 catch 块必更新 video_generations 标 failed (跟 BUG-098 catch 漏补刀附属表 100% 同源) |
| **BUG-099** | S72 batch 7 v3.0.37 | ✓ 已修 | **web dist index-*.js 被破坏成 2 bytes `0\n`**: 宝塔 nginx 缓存 + git push race, web dist 单文件被压, 部署后 SPA fallback 返 511B index.html (verify-deploy 维度 23 BUG-096 命中 0 暴露) | 重新 build (vite deterministic, 同样 source 同样 hash `BwxcAQbo.js` 493080 bytes) + scp 重解压 + 宝塔 nginx reload; 配套 verify-deploy 维度 22 容忍 set -e (修 line 393 backtick PS 5.1 嵌套引号) |
| **BUG-098** | S72 batch 7 v3.0.37 | ✓ 已修 | **admin approve 抛 500** (跟 BUG-079 假报告同源, 部署 ≠ 成功): `rechargeRequestModel.updateStatus` SQL 缺第 4 个参数 `id` (3 vs 4 placeholders, S70 PM2 时代 silent fail 错) + `billingService.topUp` SQL 多 1 个 `ref_label` 占位符 (6 vs 9 placeholders) | SQL placeholders 跟 params 数量必一致; catch 块加 `logger.error('approve failed', { err, orderId, params })` 调试改进; verify-deploy 必加维度 25 admin approve E2E (S72 待办) |
| **BUG-097** | S72 batch 7 v3.0.37 | ✓ 已修 | **mobile 端漏修 web 端 3 BUG (BUG-092/094/095/096)**: 之前原则 "主盯 web, 安卓暂不动" 导致 notifyRechargePaid 按钮缺 + admin 端点 default 'pending' + STAGE_TEXT 3 态机漏 user_notified, user 反转原则"Web 主导 APP 跟随" | mobile 端同步 3 文件: api/client.ts (加 notifyRechargePaid API) + RechargeScreen.tsx (加 5 state + 5s 轮询 + "我已付款"按钮) + AdminDashboard.tsx (5 tab + admin 默认 user_notified + 4 态机); verify-deploy 维度 24 强制 grep APK bundle 命中 |
| **BUG-096** | S72 batch 7 v3.0.37 | ✓ 已修 | **AdminDashboardPage "已通过" 历史订单后面渲染 "0" 字符串**: `{o.userNotifiedAt && o.userNotifiedAt > 0 && ...}` 当 userNotifiedAt=0 时短路返 0, React JSX `{0}` 渲染 "0" (跟 null/undefined/false 不渲染不同) | 删 `o.userNotifiedAt &&` 第一个短路 + 改 `&& (...)` 为 `? (...) : null` 显式三目; 跟 BUG-082 铁律 8 配套 (持久化 JSON 必 string 归一) |
| **BUG-095** | S72 batch 7 v3.0.37 | ✓ 已修 | **BUG-094 修法 markUserNotified 写 status='user_notified' 但 DB schema `status ENUM('pending','approved','rejected')` 不含 'user_notified'**: MySQL 静默截断 + server 抛 500 + web alert "通知失败" + admin 没订单 | ALTER TABLE MODIFY status enum 加 'user_notified' (立即 SQL + db.ts CREATE 同步 + ALTER 兼容老库 logger.warn + server restart pool reload) |
| **BUG-094** | S72 batch 7 v3.0.37 | ✓ 已修 | **admin 看板默认查 'pending' 状态订单, BUG-092 修法 markUserNotified 漏改 status, user 点 1 次"我已付款" 后台出 3 条待审核 (DB 实际 14 条 pending 累积)**: admin 端点 default 'pending' + markUserNotified 只改 user_notified_at 不改 status + BUG-092 漏同步 1 处 (admin 端点 4 态机迁移) | markUserNotified 同时 `status='user_notified'` (状态机迁移, 4 态 UI 1:1 对齐); admin GET /orders default 'user_notified' + 'all' 强制 IN 3 状态 + 'pending' 返空 (server 端硬过滤); approve/reject 校验 'user_notified'; web AdminDashboardPage 5 tab + default 'user_notified' + 4 状态显示/操作 |
| **BUG-093** | S72 batch 7 v3.0.37 | ✓ 沉淀 | **S72 batch 7 部署过程 commit `659025d` (web build TS2339 hotfix) + `7e823ac` (部署脚本 3 件套) 2 个 commit subject 缺 BUG 编号, 违反 AGENTS.md § 4 铁律 6**: 跟 BUG-091 同款违规, "hotfix / 部署 ops 都不算 BUG" 错误判断, BUG 范畴扩张 (hotfix / 部署 / 清理 / 文档 / 规范修订 都算 AI 行为变更) | 沉淀 BUG-093 进 apps/mobile/BUGS.md (永久记录); 升级 check-commit-message.py (N 5→10 + 加 git log origin/main..HEAD 未 push check); pre-commit hook 拦截无 BUG 编号 commit |
| **BUG-092** | S72 batch 7 v3.0.37 | ✓ 已修 | **扫码支付页面"我已付款"按钮从来没实现**: server message 承诺, web 端 0 按钮, API 端点不存在, admin 端不知道用户已付款 | db 加 user_notified_at 字段; model markUserNotified 方法; route 新增 POST /:id/notify-paid; web api client + RechargePage 4 态 UI + 5s 轮询; admin 端加 userNotifiedAt 标记 |
| **BUG-090** | S72 batch 6 v3.0.36 | ✓ 已修 | **deploy.sh 部署后 changelog.json 还是老版本 (5 条 highlights 全丢, 拿老版本或"优化性能"占位符)**: deploy.sh 第 6 步 `cp -f ${DIST_DIR}/changelog.json dist/changelog.json`, 源是**生产目录** (上次部署留下的老版本), 不是本机 scp 过来的新版本, **每次部署都被旧版本覆盖新版本** | deploy.sh 优先读 `/tmp/changelog.json` (本机 scp 源), fallback 到生产目录时显式 warn; 部署 SOP 必加 scp changelog.json 到 /tmp/; 12 维验证必查 /api/version 的 changelog/highlights/buildDate 字段 |
| **BUG-089** | S72 batch 6 v3.0.36 | ✓ 已修 | **生图/视频生成成功不立刻显示, 必须切走 Tab 再切回才显示**: polling 完成 setMessages(prev) 已更新 streaming→image, 但紧接 loadHistory() → loadConversation() 整体覆盖 messages (userInitiated race / server 写入 race), UI 回到 streaming 加载圈 | ImageAgentScreen + VideoAgentScreen 拆 loadHistory 为 loadHistory + refreshHistory (polling 完成用 refreshHistory 只刷列表不覆盖 messages); polling 完成 alert 后 setTimeout scrollToEnd 200ms |
| **BUG-088** | S72 batch 6 v3.0.36 | ✓ 已修 | **删除会话弹窗被历史侧栏 Modal 完全遮挡, 用户看不到 confirm → 无法删除历史会话**: Dialog.tsx 用普通 View + absoluteFillObject, 被 RN 原生 Modal (历史侧栏) 永远遮挡 (Android Dialog / iOS UIViewController 永远在 React 视图树最上层) | Dialog.tsx 改用 RN <Modal transparent animationType="none" statusBarTranslucent> 包装 (走 native 层); ImageAgentScreen + VideoAgentScreen 历史侧栏删除按钮先 setShowHistory(false) + setTimeout 300ms 再弹 confirm (防两个 RN Modal z-order race) |
| **BUG-087** | S72 batch 5 v3.0.35 | ✓ 已修 | **APP 内"无限发现新版本"**: mobile config/version.ts 1 行注释 tsc 报 `is not a module` → APP_VERSION=undefined → fetch /api/version?version=undefined → server compareVersions(3.0.34, 'undefined')=1 → needUpdate=true 每次冷启动弹窗 | version.ts 改多行 (Write 工具强制 LF); 新增 db/updateMemory.ts (RNFS 24h 抑制); updater.tsx showUpdateDialog 异步化 (取消按钮写 memory + 下载按钮不写); App.tsx useEffect 加日志; 删 web version-fixed.ts |
| **BUG-082** | S71 后置 | ✓ 已修 | **Web 端 React #31 错误**: 视频/图片 agent error part.message 被存为对象 {code, message} 而非 string (agnes API 返对象, server 原样存), web 渲染对象触发 #31, 整个会话 tab 不可用 | 新建 `utils/errorUtils.ts` extractErrorMessage 60 行; videoAgentService L527+L705 + imageAgentService L637 全部走归一; web AgentChatPanel case 'error' 防御性渲染; 历史 SQL 修 1 条 (aa88d219); verify-deploy 加 17-18 维 |
| **BUG-082 P3** | S71 后置 v3.0.33 | ✓ 已修 | **systemd unit 硬编码 APP_VERSION=3.0.29 漏改** (S70 BUG-077 写完未同步) — V3.0.33 升级时发现, process.env.APP_VERSION 实际生效是 .env 3.0.32 (systemd EnvironmentFile 优先级实测覆盖 [Service] Environment), VERSION_MANAGEMENT § 5.2/§ 7.2 6→8 处 + AGENTS.md 铁律 3 6→8 处 + deploy.sh 加 .env+systemd unit 同步 |
| **BUG-081** | S71 后置 | ✓ 已修 | **用户改方案"An unexpected error occurred"**: imageAgentService processTurn allowedStates 漏 plan_ready (S70 passthrough 改后没同步) + throw raw Error 走 errorHandler 兜底 500 | imageAgentService 加 plan_ready + 改 AppError 400; videoAgentService 加 busy 状态 409; web 提取 error.code 友好提示 |
| **BUG-080** | S71 后置 | ✓ 已修 | **web 端"消费记录"tab 没数据**: BillingPage.tsx push transactions 时只挑 4 字段, 漏 `type` → L137 filter `(r as any).type === 'consumption'` 永远 undefined | `...t` spread 整个 t (含 type/refType/refLabel) + web dist 重 build + E2E 模拟 3 tab filter 全 200 条 |
| **BUG-079** | S71 后置 | ✓ 已修 | **S71 报告"12 维验证全过" 100% 假**: server dist 没部署 + DB schema 没 ALTER + web dist 也没 build + routes/billing.ts 写错 `req.user.userId` (应 `req.userId`) | 重写损坏 src (PS 5.1 丢 newline) + 真 scp dist + 手动 ALTER + 改 `req.userId` + 14 维 + E2E JWT |
| **BUG-078** | S71 | ✓ 已修 | **Web 端账单明细缺消费记录 (基本消费数据缺失)**: 只显示充值, 消费和免费完全没记录 | billing_logs 加 4 字段 (is_free/ref_type/ref_id/ref_label) + recordConsumption 统一入口 + /api/billing/transactions API + BillingPage 重写 (4 卡 + 3 tab + ref_type icon) |
| **BUG-077** | S70 | ✓ 已修 | **宝塔 "项目" 找不到 shipin-APP 3 真相**: 内存 db + 错 db 路径 (default.db vs site.db) + 缺 NODE_PROJECT_NAME env | shipin-app.service 加 env + 修 site.db config + 杀 apt nginx + 启宝塔 nginx (12 维全过) |
| **BUG-076** | S69 | ✓ 解释 | **宝塔 shipin_APP "未启动" 误导**: 宝塔把 shipin-APP 注册为 nginx 站点, 实际 shipin-APP 走 PM2 node, 跟 nginx 无关 | 监控走 PM2 + 6 维验证, 忽略宝塔"未启动"显示 |
| **BUG-075** | S69 | ✓ 已修 | **BUG 案例库缺 AI 友好索引**: 74 BUG 散在 1146 行, 难快速定位 | `34a5714` (`docs/BUGS_INDEX.md` v1.0) |
| **BUG-074** | S69 | ⚠️ 临时修 | **APK 缺失 / 假下载**: server 报 v3.0.31 + forceUpdate, 实际 APK v3.0.29, 用户点 v3.0.31 → 404 | `53e61a1` (5 处版本回退 v3.0.29) |
| **BUG-073** | S69 | ✓ 永久方案 | **S54 1-行 minified src + tsc 5.9.3 + Node 22 静默忽略 ESM**: 部署踩 8h ReferenceError, server.listen 不 fire | S64 backup dist 恢复 (201 行) + 走"单文件 tsc + cp" |
| **BUG-072** | S69 | ✓ 已修 | **Web 端扣费审计 5 BUG 全不一致**: A(pricing 字段) + B(quota 不生效) + C(inline 扣费) + E(video 白送) | `4c25d2d` (16 文件 +170/-487) |
| **BUG-071** | S68 | ✓ 已修 | **跨端规范重复 GAP**: 3 个 AGENTS.md 重复, 改 1 处必同步 3 处 | `4553108` (根 AGENTS.md v2.0 + mobile/server 瘦身) |
| **BUG-070** | S67 | ✓ 已修 | **server 部署没查活跃任务**: 打断用户跑的小说分析/生图 | `4ac7ac3` (`apps/server/deploy.sh` 维护模式 6 步) |
| **BUG-069** | S66 | ✓ 已修 | **ecosystem.config.js APP_VERSION 没改**: env + env_production 2 处, 部署 6 处版本号漏 2 | `3b72a7b` (跨端版本号 6 处同步规范) |
| **BUG-068** | S64 | ⚠️ 反复出现 | **5 个 v3.0.0 同大小副本** (S58 之前), 历史 APK 命名 SOP 失效 | 反复出现, BUG-074 再次踩 |
| **BUG-067** | S64 | ✓ 已修 | **web 端硬编码版本号**: 3 处 v3.0.0 跟 server 不一致 | `abd20b6` (web version.ts 单一来源) |
| **BUG-066** | S64 | ✓ 已修 | web 端 ui 风格不统一 | `abd20b6` (shadcn/ui 引入) |
| BUG-001 ~ 065 | S58-S62 | ✓ 已修 | 历史 65 个 BUG (APK 签名 / 部署 / mobile UI / 跨端), 见 `apps/mobile/BUGS.md` 完整案例 |

---

## § 2. 按关键字快速索引 (AI 必查)

### 🔍 "APK" / "下载" / "签名"
- **BUG-006** keystore 不一致 → BUG-023 永久 keystore 备份
- **BUG-024** APK 死循环弹窗 (cp apk 当试纸)
- **BUG-068** 5 个 v3.0.0 同大小副本 (历史命名 SOP 失效)
- **BUG-074** APK 缺失 / 假下载 (server 报 v3.0.31 但 APK v3.0.29)

### 🔍 "部署" / "deploy" / "shipin-APP"
- **BUG-008** PM2 env reload 失败 (用 `delete + start`)
- **BUG-028** SSH 嵌套 PS 5.1 `-Command` quoting
- **BUG-029** shipin-APP port 6000 vs 3000
- **BUG-045** server API 响应路径不匹配
- **BUG-046** compileSdk = 34 (mobile 兼容)
- **BUG-047** PS 5.1 `&&` + `;` 嵌套 ssh
- **BUG-048** server APP_VERSION PM2 env reload
- **BUG-069** ecosystem.config.js APP_VERSION 没改
- **BUG-070** 部署没查活跃任务
- **BUG-073** S54 1-行 minified 部署踩 8h
- **BUG-074** APK 缺失 / 假下载

### 🔍 "扣费" / "billing" / "VIP" / "pricing"
- **BUG-005** 扣费实现重复 characterService
- **BUG-017** VideoAgent 时长选 5s/10s 缺省 (跟 BUG-055 重复)
- **BUG-055** VideoAgent 时长 UI 文案 2 端不一致
- **BUG-072** Web 端扣费审计 5 BUG 全不一致 (A/B/C/E)

### 🔍 "server" / "Express" / "MySQL" / "PM2"
- BUG-008 / 028 / 029 / 045 / 046 / 048 / 069 / 070 / 073

### 🔍 "mobile" / "RN" / "Android" / "APK" / "Hermes"
- BUG-001 / 002 / 003 / 004 / 005 / 006 / 007 / 013 / 014 / 015 / 016 / 017 / 018 / 019 / 020 / 021 / 022 / 023 / 024 / 025 / 026 / 027 / 035 / 036 / 037 / 039 / 040 / 042 / 043 / 044 / 061 / 062 / 063 / 066 / 067 / 068 / 074 / 087 / 088 / 089

### 🔍 "弹窗" / "Modal" / "Dialog" / "Confirm" / "遮挡"
- **BUG-088** 删除会话弹窗被历史侧栏 RN Modal 遮挡 (Dialog 改用 RN Modal 包装 + 先关 Modal 再弹 confirm)

### 🔍 "polling" / "race condition" / "auto-load" / "覆盖"
- **BUG-089** 生成成功 race condition (拆 loadHistory 为 loadHistory + refreshHistory, polling 完成不 auto-load)
- **BUG-050** (S60 P3) historyModal 重设计引入 userInitiated, 当年只考虑用户主动操作没考虑 polling 完成路径

### 🔍 "deploy.sh" / "scp" / "changelog.json" / "源文件" / "/tmp/"
- **BUG-090** deploy.sh changelog.json cp 源是生产目录不是 /tmp/ (本机 scp 源才是新版本, 生产永远是上一版本)
- **BUG-083** dist/changelog.json 字符编码损坏 (跟 BUG-090 配套, 部署链文本文件要 cp + UTF-8 验证)

### 🔍 "/api/version" / "changelog 字段" / "验证" / "12 维"
- **BUG-090** 12 维验证只看 version 字段 = 假报告, changelog/highlights/buildDate 必查
- **BUG-083** verify-deploy.sh 加维度 20 (UTF-8 字符编码 + JSON parse 双重验证)

### 🔍 "commit message" / "铁律 6" / "subject" / "BUG 编号" / "AI 行为合规"
- **BUG-091** commit a5ae183 subject 缺 BUG 编号 (body 有但 body 不算, 违反 AGENTS.md § 4 铁律 6)
- 🆕 **永久自检工具**: `tools/check-commit-message.py` (commit 前必跑, 1 失败 exit 1)
- 跨项目通用: 任何 AI session 写 commit 必带 `vX.Y.Z: <改动> (BUG-NNN + 规范修订)` 格式

### 🔍 "支付" / "扫码" / "我已付款" / "notify-paid" / "recharge"
- **BUG-092** 扫码支付页面"我已付款"按钮从来没实现 (server message 承诺, web 端没渲染, API 端点不存在)
- 跨项目通用: 任何 "用户操作 → admin 审核" 异步流程必 4 态 UI (待操作 / 已操作等审核 / 已通过 / 已拒绝)
- 跨项目通用: server 端 message 文案 必跟 web 端 UI 1:1 对齐 (文案是契约, 不是装饰)
- 🆕 API: `POST /api/recharge/:id/notify-paid` (auth + 越权保护 + 状态校验, BUG-092 配套)
- 🆕 DB 字段: `recharge_requests.user_notified_at` (admin 看板优先处理标记)

### 🔍 "web" / "React" / "Vite" / "shadcn"
- BUG-066 / 067 / 072

### 🔍 "tsc compile" / "TypeScript" / "dist"
- BUG-046 (compileSdk) / BUG-073 (1-行 minified)

### 🔍 "AGENTS.md" / "规范" / "跨端"
- BUG-071 (跨端规范重复 GAP)

### 🔍 "SSH" / "key" / "Mavis 部署"
- BUG-028 (PS 5.1 quoting) / BUG-070 (维护模式)

### 🔍 "宝塔" / "panel" / "bt.cn" / "项目列表"
- **BUG-076** 宝塔 shipin_APP "未启动" 误导 (S69 解释, 监控走 PM2)
- **BUG-077** 宝塔 "项目" 找不到 shipin-APP 3 真相 (S70 已修, 12 维全过)

### 🔍 "账单" / "billing" / "扣费" / "明细" / "充值" / "消费"
- **BUG-005** 扣费实现重复 characterService
- **BUG-017** VideoAgent 时长选 5s/10s 缺省 (跟 BUG-055 重复)
- **BUG-055** VideoAgent 时长 UI 文案 2 端不一致
- **BUG-072** Web 端扣费审计 5 BUG 全不一致 (A/B/C/E)
- **BUG-078** Web 端账单明细缺消费记录 (基本消费数据缺失, S71 已修, 完整记录消费 + 免费)

---

## § 3. 按场景快速定位 (AI 干活 SOP)

### 🎬 S0. 新 session 开始 (30 秒必读)
1. 读 `AGENTS.md` 第 0 项 (根 AGENTS.md) → 跨端总入口
2. 读 `AGENTS.md` 第 1 项 (DEV_PROGRESS.md) → 当前进度
3. 读 `AGENTS.md` 第 16 项 (**本 BUGS_INDEX.md**) → 已知 BUG 速查
4. 读 `HANDOVER.md` § 0 30 秒速览
5. 看 `DEV_PROGRESS.md` "AI 会话追踪"表 → 上个 session 做到哪

### 🎬 S1. 改 src 代码 (ts/tsx)
- 看 `AGENTS.md` § 5 任务 A 流程 (mobile/server/web 各自 5 步)
- 跑 `tsc --noEmit` 0 错
- 跑 `npm run build`
- **防踩**: BUG-046 (compileSdk) + BUG-073 (1-行 minified) + BUG-071 (跨端规范)

### 🎬 S2. 部署 server (shipin-APP)
- 跑 `apps/server/deploy.sh` 维护模式 (BUG-070)
- 6 维验证 (铁律 5, BUG-008)
- 6 处版本号同步 (BUG-069: server ecosystem env+env_production 2 处 + mobile version.ts + build.gradle + web version.ts + changelog.json)
- **防踩**: BUG-046/073/074

### 🎬 S3. 部署 mobile APK
- `cd apps/mobile/android && ./gradlew assembleRelease`
- `aapt2 dump badging app-release.apk | head -1` 验证 versionCode/versionName (BUG-074 教训)
- `cp app-release.apk /www/wwwroot/shipin-APP/public/DeepScript_v<ver>.apk`
- nginx `extension/ab.maque.uno/app-download.conf` 自动代理 `/app/` → shipin-APP/public/
- **防踩**: BUG-024 (cp apk 当试纸) + BUG-068/074 (命名错位 + 没 build apk 改 version)

### 🎬 S4. 改扣费
- 三处一致: 业务代码 (characterService 等) + `/api/pricing` + VipCenterPage UI (BUG-005/072)
- `grep -r "updateBalance\|consumption" src/` 找遗漏点 (BUG-005)
- **防踩**: BUG-005/072

### 🎬 S5. 改 AGENTS.md / 规范
- 必查 § 1 AGENTS.md 总入口 (跨端), 改 1 处必同步 3 处 (BUG-071)
- 写新铁律必查 `STANDARDS_EVOLUTION.md` § 3 5 步 SOP
- 必查 `docs/standards/ADR/` 是否新加 ADR

### 🎬 S6. 紧急生产故障 (5xx 爆发 / 进程死)
- `pm2 logs ai-script-server --lines 100 --nostream`
- `curl /health` + `/api/version`
- **有活跃任务**: 先跑 `apps/server/deploy.sh` 维护模式 (BUG-070)
- 修复 + 部署
- 写 BUG-NNN 进 `apps/mobile/BUGS.md` (跨端共用)
- 写本索引 § 1 速览行 (30 秒后 AI 能看到)

### 🎬 S7. shipin-APP 部署到宝塔 panel "项目" 列表 (S70 BUG-077 新增 SOP)
- **必读**: [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](BAOTA_NODE_PROJECT_DEPLOY.md) (S70 v1.0 完整 SOP)
- **5 步标准流程**:
  1. 本机编译 + 打包 (`tsc --noEmit` + `npm run build` + `cp changelog.json dist/` + `tar czf`)
  2. 上传到服务器 (`ssh-agent` 加载 + scp 或 Matrix CDN URL)
  3. 服务器 systemd 部署 (`bash apps/server/deploy.sh` 自动 9 步: 查任务→公告→维护→等→预检→备份→systemd restart + 宝塔同步→12 维验证→恢复)
  4. **12 维验证** (6 维自身 + 3 维宝塔/nginx/反代/APK + **3 维宝塔 Node 项目 shipin_APP run=True**)
  5. 文档更新 + commit + push (BUGS.md + BUGS_INDEX + changelog.json)
- **9 个常见坑** (任何 AI 必看, 见 `docs/BAOTA_NODE_PROJECT_DEPLOY.md` § 4):
  1. ❌ 用 PM2 部署 (S70 起 shipin-APP **唯一**路径走 systemd)
  2. ❌ 改 `db/default.db` (真实 db 是 `db/site.db`)
  3. ❌ 缺 `NODE_PROJECT_NAME=shipin_APP` env (systemd unit 必须有)
  4. ❌ apt nginx 没 mask (systemctl mask nginx + pkill -9)
  5. ❌ 启 shipin_APP.conf (server_name 写项目内部名错, 用 ab.maque.uno 已配反代)
  6. ❌ 写宝塔自定义 nodejsModel.py (免费版自带完整 112KB, 不用)
  7. ❌ 写 `shipin_app.pid` (大小写错, 必须是 `shipin_APP.pid` 跟 sites 表项目名一致)
  8. ❌ SQL 改 site.db 没生效 (宝塔 Sql 是内存只读 db, 短期不影响, 长期会丢)
  9. ❌ **systemd unit 启 node 失败 `Cannot find module dist/index.js`** (BUG-078 S71 教训) — `ProtectSystem=full` + `ProtectHome=true` 在 systemd 211+ 创建 read-only namespace, 把 `/www/wwwroot/shipin-APP/dist` 设为**不可读** (不是写!). 修法: 删 `ProtectSystem` + `ProtectHome` 两行 (S70 shipin-app.service 复制时漏改), 或改成 `ProtectSystem=strict` (只保护 `/usr` `/boot` 不动 `/www`). **写入 `docs/deploy/shipin-app.service` 模板 + `BAOTA_NODE_PROJECT_DEPLOY.md` § 4 坑 10**

### 🎬 S8. 加新扣费 / 改 billing 字段 (S71 BUG-078 新增 SOP)
- **必读**: [`apps/mobile/BUGS.md` § BUG-078](../apps/mobile/BUGS.md#bug-078-s71-v3029-web-端账单明细-缺消费记录--只显示充值-消费和免费完全没记录-基础消费数据缺失)
- **统一入口**: 所有扣费 (充值 / 消费 / 退费) 都走 `billingService.recordConsumption(userId, opts)` (S71) 或 `billingService.topUp(userId, amount, description)` (S69), **不要**直接 `INSERT INTO billing_logs`
- **必填字段**:
  - `refType`: `novel_analyze` / `episode` / `shot` / `comic` / `character_variant` / `image` / `video` / `prompt_optimize` / `recharge` / `refund`
  - `refId`: 关联 entity id (novel_id / character_id / image_generation_id / video_generation_id / conversation_id)
  - `refLabel`: 人类可读 ("小说分析《XXX》(N字)" / "角色三视图 4 张" / "图片生成 1:1")
  - `amount`: 0 = 免费 (普通用户 30 张/天 / VIP 无限 / 活动赠送), >0 = 实际扣费
- **免费也记 log** — `amount=0 + isFree=true`, 跟收费一样 INSERT billing_logs (统计日活 / 转化率才准)
- **schema 加字段**: 改 `db.ts` 加 `ALTER TABLE billing_logs ADD COLUMN ...` (用 `try {} catch {}` 兼容老库), 加 `INDEX` (ref_type / user_id+created_at)
- **前端必更新**:
  - web `BillingPage.tsx`: 4 卡 summary + 3 tab (全部 / 消费 / 充值) + ref_type icon + 免费黄色 badge
  - web `api.ts`: `getBillingTransactionsApi()` + `getBillingSummaryApi()`
  - mobile: `BillingScreen` 同步显示 (跟 web 一致, TODO S72)
- **新增 route**: `routes/billing.ts` + `app.use('/api/billing', billingRoutes)` (S71 模板, 复用)
- **关联 BUG**: BUG-072 (前置, S69 扣费审计) + **BUG-078 (S71 修法)** + BUG-005 (扣费实现重复)
  9. ❌ git push schannel 失败 (CRL 检查阻塞, `-c http.schannelCheckRevocation=false` 跳过)
- **紧急回滚 5 min**: `bash apps/server/deploy.sh --rollback` (自动恢复 `dist.bak.s<timestamp>` + systemd restart)
- **关联 BUG**: BUG-076 (S69 解释) + **BUG-077 (S70 修法) + BUG-046/049 (双 nginx 实例) + BUG-008 (PM2 env reload, 历史教训) + BUG-070 (维护模式)**

---

## § 4. 高频踩坑 Top 13 (必读铁律, 任何 AI 必看)

1. **PM2 改 env 必 `delete + start`** (BUG-008) — `restart` 不重读 .env
2. **APP_VERSION 8 处同步** (BUG-069/082 P3) — server ecosystem env + env_production 2 处 + mobile version.ts + build.gradle + web version.ts + APP_VERSION_CODE + changelog.json + 🆕 **.env** + 🆕 **systemd unit Environment=APP_VERSION**
3. **活跃任务必跑维护模式** (BUG-070) — 跑 `apps/server/deploy.sh`, 6 步流程
4. **APK 部署必 aapt2 验证** (BUG-068/074) — `aapt2 dump badging` 确认 versionName 跟文件名一致
5. **APK 命名 `DeepScript_v<ver>.apk` 跟 versionName 必一致** (BUG-024) — 禁止 `cp v3.0.12.apk v3.0.13.apk` 当试纸
6. **server + mobile src + APK 三方版本必同步** (BUG-074) — 改 mobile version.ts 必跑 `verify-apk-version.sh`
7. **1-行 minified src 禁 tsc 重 build** (BUG-073) — 走"单文件 tsc + cp"模式, 避免 S54 编译坏
8. **跨端规范必收口到根 AGENTS.md** (BUG-071) — 改 1 处必同步 3 处
9. **扣费三处一致** (业务/API/UI) (BUG-005/072) — `grep -r "updateBalance|consumption"`
10. **永久 SSH key + ssh-agent 加载** (S69 部署踩坑) — Windows OpenSSH 9.5p2 + MinGit 9.9p1 都 cache fingerprint, 必须 `ssh-agent` 加载才走对
11. **🆕 deploy.sh cp 源必用 /tmp/ 而非生产目录** (BUG-090) — 生产目录永远是上一版本, 部署 SOP 必加完整 scp 清单 (dist.tar.gz + package.json + changelog.json)
12. **🆕 12 维验证必查 /api/version 的 changelog 字段** (BUG-090) — 不只查 version, 还要看 changelog/highlights/buildDate 是不是新版本, 老版本残留 = 假报告. **verify-deploy.sh 维度 22 强制查 4 字段** (version == APP_VERSION + changelog 非通用文案 + highlights ≥ 3 条 + buildDate YYYY-MM-DD)
13. **🆕 commit message subject 必带 BUG 编号 (BUG-091, 跨项目通用)** — 跟 AGENTS.md § 4 铁律 6 冲突, body 有 Refs 不算. 修法: `tools/check-commit-message.py` (永久自检, commit 前必跑, 1 失败 exit 1) + 格式 `vX.Y.Z: <改动> (BUG-NNN + 规范修订)` 5 段缺一不可
14. **🆕 UI 文案必跟代码 1:1 对齐 (BUG-092, 跨项目通用)** — server message "点击'我已付款'提交审核" 是契约, web 端必实现对应按钮. 修法: 写 server message 时必 grep web 端对应 UI 元素存在, 不能 message 承诺一套, 端点做另一套. 配套 4 态 UI (待操作 / 已操作等审核 / 已通过 / 已拒绝)
15. **🆕 状态机迁移必同步 4 处 (BUG-081/094, 跨项目通用)** — server 字段 + model method + response handler (server route) + 客户端 UI 渲染, **任何一处漏整套状态机废**. 修法: 状态机迁移前必 grep 4 处一致; DB 状态机设计 sub-status 是反模式, 应该单字段迁移 (markUserNotified 改 status='user_notified', 跟 4 态 UI 1:1 对齐); 部署后必跑 `mysql SELECT status, COUNT(*) FROM recharge_requests GROUP BY status` 自检
16. **🆕 admin 端点 default 必是"待审核"不是"全部未付款" (BUG-094, 跨项目通用)** — admin 默认查 'pending' 看起来直观但是反模式 (用户充值后没点已付款的订单全进后台 = noise). 修法: admin 看板 default 查 'user_notified' (用户已通知的待审核), 'pending' 只 audit 看不默认; server 端硬过滤 (跟 BUG-080 跨 user 数据泄漏教训一致), 防前端 query 绕过
17. **🆕 状态机迁移必同步 5 处 (BUG-081→095 升级 4→5, 加 DB schema, 跨项目通用)** — server 字段 + model method + response handler + 客户端 UI 渲染 + **DB schema (enum/type 必同步)**. 修法: 状态机迁移前必 grep 5 处一致; DB schema 改必立即 SQL ALTER + db.ts CREATE 同步 + ALTER 兼容老库 logger.warn + server restart (pool reload). 部署 ALTER 必立即跑, 不依赖 initTables. 配套: server pool enum 跟 DB schema 强一致, schema 改必 `systemctl restart service` (mysql2 prepared statement cache)
18. **🆕 JSX `{0}` 渲染陷阱 (BUG-082/096 配套前端侧, 跨项目通用)** — `{x && y}` 当 x=0 时短路返 0, React JSX `{0}` 渲染 "0" 字符串 (跟 null/undefined/false 不渲染不同). 修法: 删 `x &&` 第一个短路条件 + 改 `&& (X)` 为 `? (X) : null` 显式三目; 配套 BUG-082 (server 持久化 JSON 必 string 归一, 后端侧). 任何 0 数值字段渲染前必显式 boolean cast (>0 / Boolean / !==0) 包裹. lint 工具加 `@typescript-eslint/no-unnecessary-condition`
19. **🆕 Web 主导, APP 跟随, 必同步 (铁律 4++, 跨项目通用 UX 原则)** — 改 web 端任意功能/UI/状态机/接口后, 必同步 app 端, 跑 5 步 SOP: 1) 评估 mobile 端漏修清单 (grep diff) 2) 修 mobile 端代码 3) tsc + APK rebuild 4) aapt2 dump badging 5) scp APK + bump server 9 项版本号. 真实案例: S72 batch 7 BUG-092/094/095/096 全部 web 端修, mobile 端漏 3 BUG. 配套: AGENTS.md § 4 铁律 4++ + verify-deploy.sh 维度 24 mobile 端同步自检 (grep "我已付款" / "notifyRechargePaidApi" / "user_notified" 必 ≥1 命中). 反 shipin-APP 之前 "主盯 web, 安卓暂不动" 旧原则 (S72 batch 7 2026-06-26 规范反转)
20. **🆕 卡死任务必查 3 处 + 部署后必查 DB 状态分布 (BUG-100, 跨项目通用)** — 任何 "任务卡死" 类 BUG 必同时查 3 处 (跟 BUG-079/098 同源: 假报告心态让 17 天累积 69 卡死): 1) `cat /proc/PID/environ` 进程 env + 2) `SELECT status, COUNT(*) FROM task_table GROUP BY status` DB 状态分布 + 3) `tail -50 logs/error.log | grep` server log stderr. 任何一项缺都是 "盲查". 配套: 部署后必跑 `verify-bugNNN.sh` 第 4 维度 (DB 状态分布必查) + 部署脚本必加 `UPDATE task_table SET status='failed' WHERE status='queued' AND created_at<24h` 清卡死 (跟 BUG-095 ALTER 立即跑同源). 真实案例: S72 batch 8 BUG-100 `video_generations` 69 queued 累积 17 天, 单一查 1 处看不出来 (image_generations 41 completed 看起来 OK, 进程 env 看起来 OK, server log 偶发 timeout 看起来 OK), 3 处一起查才暴露 "image OK video 全部卡死" 真相. 反 shipin-APP 之前 "凭 1 个维度 PASS 就完事" 假报告心态 (BUG-079 教训 100% 同源, 部署 ≠ 成功)
21. **🆕 Record<Union, T> 索引必带 fallback (BUG-101, 跨项目通用 UX 原则)** — 任何 `Record<StrictUnion, T>` 索引 (如 `VARIANT_COLORS[variant]` / `STATUS_COLORS[status]` / `ROLE_COLORS[role]`) 必加 `|| {default}` fallback, 防调用方传错字面量 (Ionicons name / 字符串 / 任意) 时 runtime 抛 "Cannot read property X of undefined". 修法: `VARIANT_COLORS[(config.variant || 'default') as ToastVariant] || VARIANT_COLORS.default` (跟 BUG-082 catch 必归一 + BUG-098 SQL params 必归一 同源, 任何"严格 union 索引"都必带 fallback). TS 编译过 ≠ 运行时正确 (跟 BUG-079 假报告 100% 同源, 必跑端到端验证). 真实案例: S72 batch 8 BUG-101 mobile 端 5 个 `toast.show(msg, '<Ionicons-name>')` 错调用, 误把 cloud-upload/sparkles/checkmark-circle 当 ToastVariant, runtime VARIANT_COLORS['cloud-upload'] = undefined, v.bg 抛错. 反 shipin-APP 之前 "TS 编译过 = 完事" 假报告心态
22. **🆕 自动退款必配套审核机制 (BUG-103, 跨项目通用 UX 原则)** — 任何自动退款 (billing refund / payment reversal / wallet refund) 必配套人工审核 + 金额上限 + audit trail, 防 user 没付款 / 任务未完成 / 重复退款 误退 (跟 BUG-072 D 短期方案错同源, 跟 S72 batch 7 BUG-100 catch 漏补刀 100% 同源: 修法 1 不彻底). 修法: 1) refundStep 整方法删, 失败只 notifyError 通知 user '请联系客服' 2) 改人工复核流程 (user 微信联系 admin → admin 查 billing_logs + task_jobs 确认失败 → 手动 SQL 加余额 + 手动加 billing_logs type='charge' 区分自动) 3) 长期方案: 接支付宝回调 (BUG-072 D). 真实案例: S72 batch 8 BUG-103 h773052122 novel "没钱修什么仙" analyze 失败, billingService.refundStep 自动退 34.93 元 (2910536 字 × 0.012/1000), user 没付款不该退, 实际余额异常 35.07 元. 反 shipin-APP 之前 "自动退款 = 0 摩擦" 心态 (跟 S54 BUG-073 silent fail 跑老 .js 同源: 自动化没人 review 必出错)
23. **🆕 server bump 必 rebuild APK + scp (BUG-104, 跨项目通用部署原则)** — server 端 `changelog.json` 加新 version entry + systemd + .env sed 改完, `/api/version` 立刻返新版本, user 端立刻需要新 APK. 任何 server bump (修 BUG / 加 API / 改状态机 / 删功能) 必同步 4 件套 + 9 项版本号 (跟铁律 3 + 4++ 配套): 1) mobile `build.gradle` versionCode + versionName 必跟 server version 1:1 2) `gradlew assembleRelease` rebuild APK 3) `scp` APK 到公网目录 `DeepScript_v${version}.apk` + 公网 APK SHA256 跟本机一致 (vite/RN deterministic) 4) web build + scp dist + nginx reload (vite inline version.ts) 5) 模拟 user 升级链路 10 步端到端 (compareVersions=-1 → needUpdate=true → APK 200 → SHA256 一致 → install 后 compareVersions=0 → needUpdate=false). 跟 BUG-097 mobile 漏修 web 100% 同源, 跟 BUG-103 删 server 自动退款漏刷 APK 100% 同源, 跟 BUG-090 deploy.sh changelog.json cp 源错同源, 跟 BUG-099 web dist hash 破坏同源. 真实案例: S72 batch 8 收口 BUG-103 修法只 bump server 端, 没 rebuild APK, 模拟 v3.0.38 user 升级时发现 `https://ab.maque.uno/app/DeepScript_v3.0.39.apk` HTTP/2 404, user 触发升级弹窗但下载链接全挂. 教训: 9 项版本号同步必加 mobile build.gradle versionCode (跟铁律 3 扩 6→9 项), 部署 SOP 必加 "模拟 user 升级链路" 端到端验证 (跟 BUG-100 修法 1 必加端到端 100% 同源). 配套: `apps/server/scripts/simulate-v3038-to-v3039-upgrade.sh` 10 步模拟 + `scripts/verify-deploy.sh` 维度 24 强制 grep APK bundle 命中
24. **🆕 角色分析 prompt 必基于剧情内容不限制字段 (BUG-105, 跨项目通用 UX 原则)** — 任何 LLM 提取角色信息/角色分析 prompt 必基于小说原文/剧情内容, **严禁强制固定字段** (例: 身高/体型/脸型/.../关系 37 字段), 跟 user 明确"必须基于剧情内容来描述, 不得乱写" 一致. 核心: 1) prompt 必先打**角色标签分类** (主角/重要配角/次要配角/跑龙套/路人), 丰度梯度按标签 (主角 800-2000 字 5 section Markdown, 配角 300-800 字 4 section, 路人 10-30 字 1 句话) 2) **严禁编造** 不存在的剧情素材 (丰度上限不强制, 小说没提某角色外形就少写, 允许 description < 模板下限) 3) 引用原文时用"例: 第X章" 标注 4) 详细描述完全交给单独 LLM 步骤, 不跟"类型/主题/风格/基调" 等结构化字段混在一起. 反 shipin-APP 之前"固定 37 字段" 老 prompt 设计 (跟 BUG-079 假报告 100% 同源, TS 编译过 ≠ 运行时正确, 跟"prompt 写得详细 = LLM 输出正确" 同源, 实际逼 LLM 编造). 真实案例: S72 batch 8 收尾 BUG-105, 2 个 prompt 文件并存: `novelAnalysis.ts` 老 37 字段 (v2.5.14, 走老 parseCharactersFromReport 永远 ≥ 2 字段) + `characterDescription.ts` 新版 Markdown 5 section (v3.0.0.30 S50 v2, 永远不被调用). 修法: 简化 novelAnalysis.ts 4 基础字段 + parseCharactersFromReport 重写容错 + needsDescExtraction = true 永远调 + characterSheetPrompt.ts 重写不拼 37 字段 + characterService.ts 改用 visualDescription 自由文本 + backfillCharactersFromReport 走新版 prompt. 端到端验证: q378685504 / wuliao login → POST /api/novels/d6449c45-.../backfill-characters → descriptionsGenerated=9/9, 主角 独孤琰 完整 5 section Markdown, 配角 秋霞 5 section 含引用原文 (第3章/第5章), 跑龙套 兰烟 2 句 60 字, **100% 不再硬凑 37 字段, 跟 user "根据剧情内容来提取角色形象" 100% 一致**

25. **web utils 必同步移植 mobile 端 (BUG-105 mobile sync, 跨项目通用铁律 4++)** — web 端抽出 characterUtils.ts 等共享工具函数时, mobile 端必同步移植一份 (不是 import monorepo 包, 是 mobile/src/utils/ 下单独复制). 跨端铁律 4++ Web→APP 同步 5 步 SOP (详 DEPLOY_RELEASE_FLOW.md § 10.4): 1) 比对 web utils 函数清单 2) mobile/src/utils/ 下复制完整源码 (除 web 专属的 getRoleLabel/getRoleColor — mobile 用 theme/character.ts) 3) 改 3+ screen import 走统一 utils 4) 删各 screen 本地硬编码重复实现 (height/build/face/... 等字段) 5) tsc + rebuild APK + 端到端验证. 真实案例: S72 batch 8 v3.0.41 mobile sync, web characterUtils.ts v2.5.34 已有 4 种 description 格式兼容 (自由文本字符串 / 11 字段 JSON 对象 / JSON 字符串 / 双层 JSON 字符串), mobile v3.0.29 漏同步移植, 3 个 screen (CharacterDetail/List/DescriptionReview) 各有本地 11 字段硬编码 extractDescriptionText, server v3.0.40 改 description 为 Markdown 自由文本后, mobile 端 GET 返回 JSON 字符串 (models/character.ts JSON.stringify 产物), 直接原样显示给用户 (包含 \n 转义符). 修法: 移植 web characterUtils.ts → mobile/src/utils/characterUtils.ts (95 行 4 种格式兼容 + summaryOf markdown 跳过) + 3 个 screen 改 import. 端到端: 装 v3.0.41 APK → 打开角色详情 → description 显示主角 5 section Markdown / 配角 引用原文 / 跑龙套 60 字, 100% 不再显示 JSON 转义字符串. 跟 BUG-097 mobile 漏修 web 3 BUG 100% 同源 (跨端 utils 没同步移植 = 历史欠账), 跟 BUG-104 server bump 漏 rebuild APK 100% 同源 (跨端配套 SOP 缺一环就崩). 防呆: 改 web utils 时必 grep mobile/src 0 个本地 extractDescriptionText 残留 + verify-mobile-characterUtils.js 5/5 PASS + 装 APK 端到端验证. 配套: DEPLOY_RELEASE_FLOW.md § 8.14.1 实战 + § 10.4 同步 SOP + apps/mobile/src/utils/characterUtils.ts (跟 web v2.5.34 1:1) + 1 mavis memory: web→mobile utils 同步必须移植, 不能 import monorepo 包 (mobile bundle constraints)

26. **🆕 verify 脚本自身 5 子 bug pattern (BUG-106, 跨项目通用铁律)** — 任何"自动验证/部署后自检"脚本 (`verify-deploy.sh` / `check-status.sh` / `linter.sh` / `e2e.sh`) 跑前必先跑一遍脚本自身, **"100% PASS" ≠ 实际有效** (跟 BUG-079 假报告 100% 同源: verify 脚本自身 silent fail 让你 100% PASS 但实际是 0 行真验证). 5 子 bug pattern (S72 batch 9 v3.0.41 实战): 1) **urllib/requests API 错误**: `__import__('urllib.request', fromlist=['urlopen']).request.urlopen` AttributeError (urllib.request 没有 .request 属性, 应 .urlopen). 修法: 写 python import 后用 `urllib.request.urlopen(...)`, 或 `from urllib.request import urlopen; urlopen(...)` 2) **f-string 内嵌 bash 变量**: bash f-string `f"...env={$APP_VERSION}..."` 被 python 解析为 `env=3.0.41` 表达式, SyntaxError. 修法: bash 不用 f-string 传变量, 用字符串拼接 `'...env=' + '$APP_VERSION' + '...'` 或先 `APP_VERSION_PY=$APP_VERSION` 提取再 f-string, 或直接走 bash 命令外传 (避免 python f-string + bash 变量混用) 3) **bash 算术多行 grep 输出**: `$((V24_NOTIFY + V24_PAID + V24_STAGE))` 在 `grep -c` 输出多行时 syntax error (bash 期望单个数字, 多行 = 算术失败). 修法: 改 `grep -ao pattern | wc -l` (强制单行数字) + `${VAR:-0}` 默认值 fallback 4) **awk -F: 处理单文件 grep -c**: `grep -c` 单文件输出无 filename prefix (只有数字), awk `-F: '{s+=$2}'` 拆错 (空字符串). 修法: 单文件用 `grep -hc ... | awk '{s+=$1}'` (h flag 抑制 filename, $1 是数字) 或多文件保留 filename + `awk -F: '{s+=$2}'` 5) **web dist 路径错 (跟 BUG-090 deploy.sh cp 源错同源)**: 脚本写死老路径 `/www/wwwroot/ab.maque.uno/dist/assets`, 但实际部署后路径是 `/www/wwwroot/web-app/dist/assets` (S72 batch 8 改). 修法: web dist 路径必从 `DEPLOY_DIR` 或 `nginx config` 自动 derive, 不写死, 或部署后 `ls /www/wwwroot/*/dist/assets` 自检. 真实案例: S72 batch 9 verify-deploy-24d.sh 跑 53 行就 fail, 修了 5 子 bug 后 27 PASS + 0 FAIL + 0 SKIP (24 维全过). 修法 SOP: 写完 verify 脚本必先单独跑一遍确认绿, 再集成到 deploy.sh / CI. 防呆: `apps/server/scripts/verify-deploy.sh` 入仓 33080 bytes 605 行 (含 BUG-106 修法), `verify-deploy-24d.sh` 改 wrapper 引用 `$(dirname "$0")/verify-deploy.sh` 相对路径. 配套: DEPLOY_RELEASE_FLOW.md § 8.14.2 实战 + 1 mavis memory: verify 脚本 5 子 bug pattern (跨项目通用)

27. **🆕 web + mobile objectToText KEY_LABEL 必配套中文 label 字典 (BUG-107, 跨项目通用铁律 4++)** — 任何 utils 跨端移植必**配套中英 label 翻译**, 严禁只移植 utils 函数逻辑不配套 label 字典 (修一半留中英夹杂 = 假修, 跟 BUG-079 假报告 100% 同源: TS 编译过 ≠ 运行时正确). 修法 SOP (5 步): 1) 比对 server 返回字段 key 清单 (例: `role_type` `gender` `hair_color` `clothing_top` `distinctive_features`) 2) web `lib/<name>Utils.ts` 加 `KEY_LABEL: Record<string, string>` 字典 (37 字段英文 key → 中文 label), 跟 server prompt 输出字段 1:1 对齐 3) 改 `objectToText` 用 `${KEY_LABEL[k] || k.replace(/_/g, ' ')}` 替换 raw 英文 key (fallback 兼容新增字段) 4) mobile `utils/<name>Utils.ts` 同步复制完整字典 (跟 web 1:1, 跨端铁律 4++ 配套) 5) 写 `tools/verify-bug107-key-label.js` 自动化验证 (6 个 case: 中文 label 完整替换 + 空格分隔 key 兼容 + fallback + name 过滤 + 数组值拼接 + 字典 37 项 1:1 三端对齐). 真实案例: S72 batch 10 v3.0.42 BUG-107, BUG-105 (S72 batch 8) 移植 web characterUtils.ts 到 mobile 时漏配套 KEY_LABEL 字典, 修了描述兼容但留中英夹杂 — mobile 显示 `role_type: 主角 / gender: 女 / hair_color: 黑色`. 修法 1: web + mobile characterUtils.ts 加 KEY_LABEL 字典 (37 字段 + 5 空格分隔兼容) 2: objectToText 替换 raw 英文 key 为中文 label 3: 8 项版本号同步 3.0.41→3.0.42 4: BlueStacks 5 端到端验证 v3.0.42 APK 装 + ScriptDetail 角色分析 0 raw 英文 key + 30+ 中文 label 全显示. 跟 BUG-079 假报告 100% 同源 (TS 编译过 ≠ 运行时正确, 移植了 utils 函数但漏 label 字典也是假修), 跟 BUG-105 mobile sync 修法不彻底 100% 同源 (移植 utils 必 100% 移植含 label 翻译). 端到端验证: tools/verify-bug107-key-label.js 6/6 PASS + BlueStacks 5 ScriptDetail 6 角色 (苏蓉儿/独孤琰/万公公/秋霞/金枝/陆婕妤) 全 30+ 字段中文 label. 防呆: 任何 utils 跨端移植 SOP 必加 "label 翻译配套" 检查项 (用 grep `grep -E 'role_type:|hair_color:|clothing_top:' dist/` 验 0 命中), 跟 BUG-104 server bump 必 rebuild APK + BUG-105 web utils 必同步移植 mobile 同源. 配套: tools/verify-bug107-key-label.js (6/6 PASS) + apps/web/src/lib/characterUtils.ts + apps/mobile/src/utils/characterUtils.ts + DEPLOY_RELEASE_FLOW.md § 8.14.1 BUG-107 实战 + 1 mavis memory: web→mobile utils 同步必配套 label 翻译 (跨项目通用, 跟 BUG-079 假报告 + BUG-105 修法不彻底 100% 同源)

## § 4.5 宝塔部署踩坑 Top 5 (S70 BUG-077 总结, 任何 AI 必看)

1. **宝塔 db 真实路径是 `/www/server/panel/data/db/site.db`**, 不是 `data/db/default.db`!  (BUG-077)
2. **宝塔 Sql 类是内存只读 db 副本** (`__memory_user_db` 写到 `/dev/shm/<md5>.db`), 改硬盘 db 不影响 panel 运行时, 必须改 site.db  (BUG-077)
3. **systemd unit 加 `Environment=NODE_PROJECT_NAME=<project_name>`** 是宝塔 `get_project_state_by_cwd` 找进程的必要 env  (BUG-077)
4. **apt nginx + 宝塔 nginx 双实例冲突**: 同一台机 2 个 nginx 抢 80/443, 宝塔 nginx 永远 bind 失败. 修法: `systemctl mask nginx` + `pkill -9 nginx`  (BUG-046/049/077)
5. **disable 项目 server_name 不要写项目内部名**: `server_name shipin_APP` 是错的, 应该是用户访问的实际域名 (ab.maque.uno 已有反代, 不需要 shipin_APP.conf)  (BUG-077)

---

## § 5. 完整 BUG 列表 (按编号 → apps/mobile/BUGS.md 锚点)

> **完整 1240 行 / 76 BUG 案例** 在 `apps/mobile/BUGS.md`, 按编号搜索定位.

### S69 (4 个 P0 BUG, 最近修完)
- BUG-071 → apps/mobile/BUGS.md `## BUG-071 (S68 收口) ...`
- BUG-072 → apps/mobile/BUGS.md `## BUG-072 (S69 扣费审计) ...` 含 A/B/C/D/E 5 子 BUG
- BUG-073 → apps/mobile/BUGS.md `## BUG-073 (S69 部署踩 8h) ...`
- BUG-074 → apps/mobile/BUGS.md `## BUG-074 (S69 APK 下载审计) ...`

### S64-S68 (16 个 P0-P2 BUG)
- BUG-055/056/061/062/063/066/067/068/069/070/071 + S66 BUG-069 + S67 BUG-070 + S68 BUG-071

### S58-S62 (60+ 历史 BUG)
- BUG-001 ~ BUG-053 (S58 P1-P10) + BUG-054/055 (S61 P1)

### S58 之前 (老 BUG, 简化)
- 6 个 v2.0 BUG 段 (S58 之前, 跨端通用 BUG 库, 已并入 BUG-024/025/026/027)

---

## § 6. 维护 SOP (新 BUG 必加索引)

### 新发现 BUG 时必做 (5 步)

1. **修代码 + commit** (按 § 3 S1 SOP)
2. **写 `apps/mobile/BUGS.md`** 完整 BUG-NNN 段 (按现有格式: 现象/根因/修法/教训/引用)
3. **更新本 `docs/BUGS_INDEX.md`**:
   - § 1 30 秒速览表加新 BUG-NNN 行
   - § 2 按关键字索引补充 (如适用)
   - § 4 高频踩坑 (如果进 Top 10)
4. **更新 `HANDOVER.md` § 0** 5 教训 (如新增 Top 10)
5. **更新 `AGENTS.md` 必读 15 项** (如新加铁律)

### 关闭 BUG (已修) 时必做
1. `apps/mobile/BUGS.md` 段加 ✓ 已修 (commit 引用)
2. 本索引 § 1 速览表 status 改 ✓
3. 跑 6 维验证 (server) 或 Playwright (web/mobile)

---

## § 7. 引用文档

- **完整 BUG 库**: `apps/mobile/BUGS.md` (1538 行 / 75 BUG 含 BUG-077)
- **跨端总入口**: `AGENTS.md` (必读 17 项 = 16 项 S69 + 第 17 项 `docs/BAOTA_NODE_PROJECT_DEPLOY.md` S70 新加)
- **跨 session 交接**: `HANDOVER.md` (S68 新建, § 0 速览 + § 5 坑点, S70 v1.2 加 BUG-077 引用)
- **🆕 宝塔 panel Node 项目部署 SOP**: `docs/BAOTA_NODE_PROJECT_DEPLOY.md` (S70 v1.0, 5 步流程 + 12 维验证 + 9 坑 + 紧急回滚)
- **部署 SOP**: `apps/server/deploy.sh` v2.0 (S70 重写: 走 systemd + 宝塔同步 9 步) + `docs/DEPLOY.md` (11 节点)
- **规范自迭代**: `docs/STANDARDS_EVOLUTION.md` (5 步 SOP)
- **版本管理**: `docs/VERSION_MANAGEMENT.md` (跨端 6 处版本号同步)
- **环境变量**: `docs/ENV_MANAGEMENT.md` + `apps/server/.env.example`
- **PM2 + ecosystem** (历史, S70 deprecated): `docs/PM2_GUIDE.md`
- **DB 迁移**: `docs/DB_MIGRATION.md`
- **后端 worker 9 条**: `docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`
- **API 跨端响应**: `HANDOVER.md` § 4.5 (S65 集成笔记)
- **宝塔部署踩坑**: `apps/mobile/BUGS.md` BUG-077 (S70 v1.1) + 本索引 § 4.5 宝塔部署踩坑 Top 5

---

**最后更新**: 2026-06-26 (S72 batch 7 v2.1, 加铁律 4++ Web 主导 APP 跟随 (规范反转 2026-06-26, 删 3 处 "主盯 web, 安卓暂不动" 旧原则), § 4 Top 18 扩 19, § 2 关键字加 Web 主导/APP 跟随/同步)
**下次 review**: S72 收尾时, 必查 Top 12 + 速览表是否需更新
**维护者**: 任何 session 收尾 AI (不限于 S70/S71/...)
