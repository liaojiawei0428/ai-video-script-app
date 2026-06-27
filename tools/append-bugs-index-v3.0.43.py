# tools/append-bugs-index-v3.0.43.py
import json, sys, re

PATH = r"F:\QiTa\banmu\APP\ai-video-script-app\docs\BUGS_INDEX.md"

# Read file (UTF-8 with BOM)
with open(PATH, "r", encoding="utf-8-sig") as f:
    content = f.read()

# Append § 7 v3.0.43 section
APPEND = """

---

## § 7. v3.0.43 Stage 1/2/3 + BUG-108/109/110/111 沉淀 (S72 batch 11 + 12, 2026-06-27)

### § 7.1 BUG-108 Stage 1: 统一图片加载 UI 模块 (跨端铁律 4++ web + mobile 1:1)

**问题**: 服务器 5Mbps 带宽, 图片加载慢 (10-20s); web 17 page 全 Tailwind 手写无骨架屏; mobile 端 SkeletonLoader 基础 opacity pulse; shipin-APP 没统一"加载中"+"生成中" UI 模块, 用户体验割裂.

**修法**:
1. web `apps/web/src/components/ui/` 新建 (填平 [GAP] M-5): skeleton.tsx (shadcn 风格) + skeleton-presets.tsx (SkeletonCard/SkeletonImage/SkeletonText) + image-with-loading.tsx (3 态 loading→ready→error + LQIP + shimmer + 200ms 淡入)
2. mobile `apps/mobile/src/components/ui/` 新建 (跟 web 1:1): Skeleton.tsx (Animated opacity 0.3~1 pulse) + ImageWithLoading.tsx (Animated.Image + retry key + fallback)
3. 集成: CharacterDetailPage + AssetLibraryPage + EpisodeDetailPage (web) + CharacterDetailScreen + ImageAgentScreen (mobile)

**配套**: cn() 工具 + tailwind.config.js shimmer + index.css .skeleton-shimmer + web AGENTS.md § 4 第 1 条微调

**验证**: web build 4.10s 510KB + mobile build 57s APK 30083055 bytes SHA256 7DC4A218...31626 + BlueStacks 5 OK + tools/verify-bug108-image-loading.js 8/8 PASS

### § 7.2 BUG-109 Stage 2: 本地媒体缓存 (跨端铁律 4++ web + mobile 1:1)

**问题**: 5Mbps 带宽, 图片/视频首次加载 10-20s, LLM 生成图每次都要等; 没本地缓存, 重复看同一张图要等 N 次.

**修法**:
1. server ETag 中间件 apps/server/src/middleware/etag.ts: 响应 JSON SHA-256 hash 写 ETag + Cache-Control: private must-revalidate, 客户端 If-None-Match 命中返 304
2. mobile 端 apps/mobile/src/utils/mediaCache.ts + useCachedMedia.ts: RNFS 文件存储 + react-native-sqlite-storage v6.0.1 索引 + djb2+reverse hash (跟 web 1:1) + LRU 500MB/1000 文件
3. web 端 apps/web/src/hooks/useCachedMedia.ts: IndexedDB media-cache-v3 + 同样 hash + LRU + URL.createObjectURL blob URL
4. 集成 POC: web CharacterDetailPage + mobile CharacterDetailScreen 各 1 处 sheetImg 用 useCachedMedia wrap

**替代方案决策 (跨项目通用铁律)**:
- ❌ MMKV 4.x: 要 nitro + RN 0.85 (shipin-APP RN 0.73 不兼容)
- ❌ MMKV 2.12.2: 要 NDK build (shipin-APP NDK 没装, [CXX1101] 错)
- ✅ 改用 react-native-sqlite-storage v6.0.1 (项目已装, 无 NDK, 性能 < 5ms)

**跨端 1:1 镜像**: hook API 完全一致 (source/onLoaded/refresh), hash 算法一致 (djb2+reverse), LRU 阈值一致

**验证**: web build 3.14s 512KB + mobile build 48s APK 30087897 bytes SHA256 B1192268...F2A2A + tools/verify-bug109-media-cache.js 8/8 PASS

### § 7.3 BUG-110 Stage 3: GeneratingLoader + useMediaLoader 跨端 1:1

**问题**: 跨端不统一"AI 生成中"动画, web 用 lucide-react Loader + animate-spin, mobile 用 RN ActivityIndicator 硬编码颜色.

**修法**:
1. web `apps/web/src/components/ui/generating-loader.tsx` — CSS spinner 1s + border-t-blue-500
2. mobile `apps/mobile/src/components/ui/GeneratingLoader.tsx` — Animated spinner 1000ms + #3b82f6 (跨端 1:1 风格统一)
3. web + mobile `hooks/useMediaLoader.ts` — 4 态 (idle/loading/ready/error) + retry + MAX_RETRIES 3 + 封装 useCachedMedia
4. 集成 ScriptDetailScreen (mobile) + ScriptDetailPage (web) 替换 ActivityIndicator / 文本

**踩坑 (跨项目通用铁律, 跨端选型 5 步)**:
- ❌ lottie-react 不支持 `path`, 必须 `animationData` + fetch JSON
- ❌ lottie-react-native 要 NDK (shipin-APP 缺)
- ✅ 改走 fallback CSS/Animated spinner (Stage 3.5 接入 Lottie)

**验证**: tools/verify-bug110-media-loader.js 8/8 PASS

### § 7.4 BUG-111 ETag ERR_HTTP_HEADERS_SENT (S72 batch 12 hotfix)

**问题**: Stage 2 etag.ts middleware 在生产 server 启动后立即 crash:
```
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
    at ServerResponse.setHeader (node:_http_outgoing:700:11)
    at ServerResponse.<anonymous> (/www/wwwroot/shipin-APP/dist/middleware/etag.js:62:17)
```

**根因 (BUG-111, 跟 BUG-079/097 100% 同源: 没考虑下游约束)**:
etag.ts 用 `res.on('finish', () => { res.setHeader(...) })` 反模式 — Node.js 在 'finish' 事件触发时**已经把 header flush 到 socket**, 此时 setHeader 抛 ERR_HTTP_HEADERS_SENT, 整个 Node 进程 crash, systemd RestartSec=10 + StartLimitBurst=5 把 5 次 retry 用完, service 进入 failed 状态, nginx 502.

**修法 (S72 batch 12 v3.0.43 hotfix)**:
- 错误做法: 在 res.on('finish') 里 setHeader
- 正确做法: 改 res.json override, 在 body 发送前 setHeader + 比较 If-None-Match → res.status(304).end()

**修法 SOP (跨项目通用)**:
1. **优先用官方 API**: Express middleware 拦截 res.json/res.send, 在 body 发送前 setHeader
2. **永远不在 res.on('finish') 后 setHeader**: 'finish' 时 socket 已 flush, 抛 ERR_HTTP_HEADERS_SENT
3. **304 处理必须在 body 发送前**: res.status(304).end() 不能在 finish 后调

**配套 verify 脚本修复 (3 bug)**:
- 维度 22: urllib.request.urlopen 直接调用, 不用 `__import__('urllib.request', fromlist=['urlopen']).request.urlopen`
- 维度 23a: `grep -ho + wc -l` 替代 `grep -c + awk -F:` (单文件 grep -c 无 filename prefix)
- 维度 24: `grep -c 2>/dev/null; true` + 默认值 fallback 替代 `|| echo 0` (避免 `0\\n0` 拼字符串)

**验证**: tools/verify-bug111-etag-hotfix.js 8/8 PASS + scripts/verify-deploy.sh 27/27 PASS

### § 7.5 跨项目通用铁律新增 (S72 batch 11 + 12 实战)

**新增铁律 1: 缓存方案选型必 5 步验证 (跨项目通用)**
1. 查 peerDependencies (是否跟项目 RN/React/Node 版本兼容)
2. 查 engines (最低 Node/RN 版本)
3. 查 NDK 依赖 (Android native module 需要 NDK build)
4. npm install + build 验证 (实测编译通过)
5. fallback 兜底 (失败立即回退, 不阻塞主线)

适用: 任何 native module 选型 (MMKV / Lottie / Reanimated / Skia / SQLite / WatermelonDB / etc.)
真实案例 (BUG-109): MMKV 4.x 要 nitro+RN 0.85 → MMKV 2.12.2 要 NDK → ✅ SQLite (项目已装)

**新增铁律 2: middleware setHeader 必在 body 发送前 (跨项目通用)**
- Express middleware 拦截 res.json/res.send 必在 originalJson(body) 调用前 setHeader
- 永远不在 res.on('finish') 后 setHeader (Node.js 'finish' 时 header 已 flush)
- 304 处理必在 body 发送前 (res.status(304).end() 不能在 finish 后调)

真实案例 (BUG-111): etag.ts 用 res.on('finish') + setHeader 反模式 → Node 进程 crash → systemd 5 次 retry 后 failed → nginx 502

### § 7.6 验证脚本全套 (跨项目通用)

| 脚本 | 维度 | 状态 |
|---|---|---|
| tools/verify-bug108-image-loading.js | 8 维 | 8/8 PASS |
| tools/verify-bug109-media-cache.js | 8 维 | 8/8 PASS |
| tools/verify-bug110-media-loader.js | 8 维 | 8/8 PASS |
| tools/verify-bug111-etag-hotfix.js | 8 维 | 8/8 PASS |
| tools/verify-version-8-points.js | 6+2 维 | 6/6 本地 PASS |
| tools/check-commit-message.py | 7 维 | 7/7 PASS |
| scripts/verify-deploy.sh | 27 维 (24+3 修) | 27/27 PASS |

### § 7.7 规范自迭代更新 (按 STANDARDS_EVOLUTION.md § 3 5 步 SOP)

| 规范文档 | 改动 | 触发 BUG |
|---|---|---|
| apps/mobile/AGENTS.md | § 6.4 Stage 1 + § 6.5 Stage 2 + § 6.6 Stage 3 + § 6.7 BUG-111 + 改"最后更新" | BUG-108/109/110/111 |
| apps/web/AGENTS.md | § 5 Stage 3 + 改"最后更新" | BUG-108/109/110 |
| apps/mobile/CODING_STANDARDS.md | § 44 middleware setHeader + § 45 缓存 5 步验证 | BUG-109/111 |
| docs/BUGS_INDEX.md | § 7 沉淀 | BUG-108/109/110/111 |
| apps/mobile/BUGS.md | BUG-110 + BUG-111 完整段 | BUG-110/111 |
| HANDOVER.md | § 2.2 S72 batch 12 v3.0.43 hotfix | BUG-111 |
| mavis memory | 1 entry: Lottie NDK 失败 + 1 entry: ETag res.on('finish') 反模式 | BUG-110/111 |

### § 7.8 跨端铁律 4++ 实战配套 (S72 batch 11 + 12 完整跑通)

按 AGENTS.md § 4 铁律 4++ Web 主导 APP 跟随 5 步 SOP:
1. ✅ 评估 mobile 漏修清单: diff <(grep) <(grep) 列出 web 有 app 没的代码
2. ✅ 修 mobile 代码: 跟 web 1:1 同步 (useCachedMedia + useMediaLoader + GeneratingLoader)
3. ✅ 跑 mobile tsc + APK rebuild: npx tsc --noEmit + gradlew assembleRelease (48s 增量)
4. ✅ aapt2 验 versionName: versionName=3.0.43 跟 version.ts 一致
5. ✅ scp APK + bump server: 上传 DeepScript_v3.0.43.apk + 同步 9 项版本号 (deploy.sh 6.5/9 自动)

### § 7.9 配套 commit (8 个)

| commit | 标题 |
|---|---|
| 90bbccb | v3.0.43 Stage 1: 统一图片加载 UI 模块 (跨端铁律 4++) (BUG-108) |
| 8a2ed2c | v3.0.43 cleanup: BUG-108 沉淀 4 件套 |
| bdbc4fd | v3.0.43 Stage 2: 本地媒体缓存 + server ETag (跨端铁律 4++) (BUG-109) |
| 70831d4 | v3.0.43 cleanup: BUG-109 沉淀 4 件套 |
| 1b20432 | v3.0.43 BUG-109 沉淀 verify 脚本 + mobile AGENTS.md § 6.5 缓存规范 |
| d7cc6e4 | v3.0.43 BUG-110 GeneratingLoader + useMediaLoader 跨端 1:1 (BUG-110) |
| 19bbdec | v3.0.43 8 项版本号同步 (3.0.42→3.0.43) + changelog append + Lottie 依赖 (BUG-108+109+110) |
| a9f8cb2 | v3.0.43 BUG-111 hotfix ETag ERR_HTTP_HEADERS_SENT + verify-deploy 27/27 PASS (BUG-111) |
"""

# Update last update line
new_content = content + APPEND

# Update footer line
new_content = re.sub(
    r"\*\*最后更新\*\*: 2026-06-26 \(S72 batch 7 v2\.1.*?(?=\n\n|\n$)",
    "**最后更新**: 2026-06-27 (S72 batch 11+12 v2.7, 加 § 7 v3.0.43 Stage 1/2/3 + BUG-108/109/110/111 实战沉淀 + 跨项目通用铁律 缓存 5 步 + middleware setHeader 必在 body 发送前 + 7 个 verify 脚本)",
    new_content,
)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

# Verify
print("SUCCESS: BUGS_INDEX.md § 7 v3.0.43 段已追加")
print(f"  文件总行数: {new_content.count(chr(10))}")
print(f"  § 7 段位置: line {new_content.split(chr(10)).index('## § 7. v3.0.43 Stage 1/2/3 + BUG-108/109/110/111 沉淀 (S72 batch 11 + 12, 2026-06-27)') + 1 if '## § 7. v3.0.43' in new_content else 'NOT FOUND'}")

# Check footer updated
if "S72 batch 11+12 v2.7" in new_content:
    print("  最后更新日期: ✓ 已更新")
else:
    print("  最后更新日期: ✗ 未更新")