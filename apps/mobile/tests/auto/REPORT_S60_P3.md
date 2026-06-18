# REPORT_S60_P3 — 视频/图片加载 + 对话 UI 完整修复

**时间**: 2026-06-18 10:36 ~ 14:05 (Asia/Shanghai)
**会话**: mvs_db213f1702fa49cdab0428494236b65e
**版本**: v3.0.24 → v3.0.24.4e, versionCode 26 → 31, APK 26.4MB → 30.0MB

---

## TL;DR

**5 个 BUG 全部修复**, APK v3.0.24.4e 装蓝叠验证:
- ✅ **视频正常播放** (5s 战士草地视频, 进度条 00:04/00:05, ⏸ 暂停按钮)
- ✅ **图片正常显示** (古风绿衣仙子 1024x1024)
- ✅ **对话 UI 重设计** (汉堡 + 状态徽章 + 大新建 + 单条删除, 跟 web 端 1:1)
- ✅ **race condition 修复** (新建/删除不再被 loadHistory 自动跳回旧 conv)
- ✅ **历史侧栏新建大按钮 + 单条删除 + 缩略图**

---

## 修复路径 (5 次迭代)

| 版本 | 改动 | 结果 |
|---|---|---|
| v3.0.24 (S60 P2) | buildVideoUrl local-first + VideoPlayer fallback 注入 | ❌ 视频仍空 poster |
| v3.0.24.4 (S60 P3 BUG-050) | toolbar 改版 + StatusBadge + 空状态 + race fix + 大卡片 | ❌ UI 完美, 视频仍空 |
| v3.0.24.4b (BUG-051) | buildImageUrl/buildVideoUrl 改走 inline proxy | ❌ server 端 200/1.76MB, mobile 仍空 |
| v3.0.24.4c (BUG-052) | muted + preload + injectedJavaScript console 桥接 | ❌ logcat 显示 ClassNotFoundException |
| v3.0.24.4d (BUG-052) | 禁用 javaScriptEnabled 跟 injectedJavaScript | ❌ 视频仍空 poster |
| **v3.0.24.4e (BUG-053 终态)** | **改用 react-native-video 6.7.0** (原生 MediaPlayer) | **✅ 视频播放 + 图片显示** |

---

## BUG 详细记录

### BUG-049: 视频 WebView 空 poster (用户首报)

**现象**: v3.0.24 装蓝叠, 视频 tab 显示视频卡片, 但卡片中央是空 video 山形图标

**根因**: buildVideoUrl 拼的 localUrl (`/api/agent/video-local/...`) 在视频刚 tool_completed 时 server 还没 cache → 404 → broken-video 图标

**修法**:
- 加 proxyUrl (`/api/download?url=...&disposition=inline&token=...`)
- VideoPlayer 接受 fallbackUrl 注入 video.onerror

**结果**: ❌ 实际根因不是 fallback, 是 BUG-053 WebView 不兼容

---

### BUG-050: 对话页 UI 看不到新建/删除按钮 (用户反馈)

**现象**: user 反馈 "没有新建会话的功能, 要和Web端一样有新建会话和删除会话"

**根因**:
1. 原 toolbar 4 个小按钮挤一起 (12-13px 字号), 不显眼
2. **race condition**: `loadHistory()` 拿到 lastResult 自动跳回旧 conv, 点了"新建"被覆盖回去

**修法**:
- toolbar 改版: 汉堡 + 当前标题 + 状态徽章 + 蓝色"新建" + 红色垃圾桶
- 12 种状态徽章 (跟 web 端 1:1)
- 空状态大引导 (120px 圆形 icon + 标题 + 提示 + 大按钮 + 3 建议 prompt)
- 历史侧栏顶部满宽"+ 新建"大按钮 + 单条缩略图 + 状态徽章 + 红色垃圾桶
- `userInitiated` flag 修 race condition

**文件**:
- `apps/mobile/src/screens/ImageAgentScreen.tsx` (v3.0.24.4 重设计)
- `apps/mobile/src/screens/VideoAgentScreen.tsx` (v3.0.24.4 重设计)

**验证**: 截图 v244-video-tab.png, v244-image-tab.png, v244-history-panel.png ✅

---

### BUG-051: 主图加载空白, 历史缩略图能显示

**现象**: v3.0.24 装蓝叠, 生图 tab 历史缩略图显示真图 (古风绿衣仙子 ✅), 但点开 conv 主图区是空白

**根因**: buildImageUrl 看到外网 URL (platform-outputs.agnes-ai.space) 直接 return 原 URL, 蓝叠 Nougat64 Android 7 SSL 握手老旧失败

**修法**: buildImageUrl 一律走 server `/api/download?url=...&disposition=inline&token=...` proxy

**验证**:
- curl 测: `HTTP=200, size=1762160, type=image/png` ✅
- 装 v3.0.24.4e APK, 主图显示真图 ✅

**文件**: `apps/mobile/src/utils/agentDownload.ts:buildImageUrl`

---

### BUG-052: autoplay muted + RN WebView 13.x 与 Android 7 不兼容

**现象**: v3.0.24.4 APK 装蓝叠, 视频 tab 仍空 poster. 这次扬声器 icon 从无声变有划线 (muted 生效), 但视频 first frame 不显示

**根因 (查 logcat 真相)**:
```
java.lang.ClassNotFoundException: androidx.window.extensions.core.util.function.Consumer
at RNCWebView.evaluateJavascriptWithFallback (RNCWebView.java:299)
```
**RN WebView 13.x 用 androidx.window.extensions (Android 12+ 新 API), 蓝叠 Nougat64 Android 7 没这个包**, JS 注入抛 ClassNotFoundException, WebView 整个 content 渲染异常

**修法**: 不用 WebView, 改用 `react-native-video@6.7.0` 原生播放器

**教训**:
- HTML5 video muted 是必须的
- 调试 WebView 加载问题**必须看 logcat**, 不能从 console.log 推断
- **Android 7 不兼容 androidx.window.***, 任何用这个 API 的 RN 包都不行

---

### BUG-053 (终态): react-native-video 6.7.0 替代 WebView

**现象**: BUG-049/051/052 反复修 WebView 后仍不工作

**根因**: RN WebView 13.x 的 androidx.window.extensions 依赖在 Android 7 上不可用

**修法**:
- `npm install react-native-video@6.7.0 --legacy-peer-deps`
- VideoPlayer 重写: `<Video source={{uri}} controls paused={false} resizeMode="contain" poster={poster} onError={fallback} onLoad={log}/>`
- 移除 react-native-webview 引用

**文件**:
- `apps/mobile/src/screens/VideoAgentScreen.tsx:VideoPlayer` 整个重写
- `apps/mobile/package.json` 加 react-native-video@6.7.0

**验证**:
- 装 v3.0.24.4e APK (versionCode 31, 30MB 含 native lib)
- 视频 tab: 5s 战士草地视频自动播放, 进度条 00:04/00:05, ⏸ 暂停按钮 ✅
- 生图 tab: 古风绿衣仙子 1024x1024 真图 ✅

---

## 截图证据

| 文件 | 内容 |
|---|---|
| `v244-video-tab.png` | v3.0.24.4 视频 tab 新 UI (汉堡+状态徽章+大新建+垃圾桶) - 视频仍空 |
| `v244-image-tab.png` | v3.0.24.4 生图 tab 新 UI - 主图仍空 |
| `v244-history-panel.png` | v3.0.24.4 历史侧栏 (7 条 + 缩略图 + 新建大按钮 + 单条删除) ✅ |
| `v244b-video-tab.png` | v3.0.24.4b inline proxy 后 - 视频仍空 |
| `v244c-video-tab.png` | v3.0.24.4c muted + console 桥接 - 视频仍空 |
| `v244d-video-tab.png` | v3.0.24.4d 禁 JS 注入 - 视频仍空 (但扬声器带划线) |
| **v244e-video-tab.png** | **v3.0.24.4e react-native-video ✅ 5s 战士草地视频播放** |
| **v244e-image-tab.png** | **v3.0.24.4e ✅ 古风绿衣仙子真图** |

---

## 部署清单

| 项 | 状态 |
|---|---|
| 代码改动 | ✅ apps/mobile/src/screens/{Image,Video}AgentScreen.tsx 重写 |
| | ✅ apps/mobile/src/utils/agentDownload.ts 重写 buildImageUrl/buildVideoUrl |
| | ✅ apps/mobile/src/screens/VideoAgentScreen.tsx:VideoPlayer 改用 react-native-video |
| | ✅ apps/mobile/package.json 加 react-native-video@6.7.0 |
| | ✅ apps/mobile/android/app/build.gradle versionCode=31, versionName="3.0.24" |
| tsc 检查 | ✅ VideoAgentScreen + ImageAgentScreen + agentDownload 0 错 |
| Gradle build | ✅ BUILD SUCCESSFUL in 5m 11s (含 native link), APK 30MB |
| 蓝叠安装 | ✅ adb install -r app-release.apk (Success) |
| 功能验证 | ✅ 视频 tab 播放真视频, 生图 tab 显示真图 |
| 公网 push | ⏳ 待 push 到 https://ab.maque.uno/app/DeepScript_v3.0.24.apk |
| Git dev 同步 | ⏳ 待 git add + commit + push 到 dev 分支 |

---

## 后续建议

1. **公网 APK push**: 用 SCP 上传 app-release.apk 到 159.75.16.110:/www/wwwroot/shipin-APP/public/app/DeepScript_v3.0.24.apk
2. **Git dev 分支同步**: 含 react-native-video@6.7.0 新依赖 + BUGS.md 更新
3. **Alert.alert/Modal 替换**: S60 P1 未做完, 还有 16 个文件 (招行) Alert.alert 没替换成 v3.0.24 Dialog/Sheet/Toast
4. **其他 mobile Alert.alert**: 招行继续做下一轮
5. **Android 7 兼容性**: 任何未来加的 RN 包都要查 androidx.window.* / Android 12+ API 依赖

---

## 经验教训 (写给后续 AI)

1. **Android 7 (API 24) 蓝叠 Nougat64 兼容性硬约束**:
   - ❌ 任何用 `androidx.window.*` 的 RN 包 (RN WebView 13.x, react-native-screens 4.x 等)
   - ❌ 任何用 Android 12+ 新 API 的 RN 包
   - ✅ react-native-video 6.x (MediaPlayer/ExoPlayer, Android 5+)
   - ✅ react-native-webview 11.x/12.x (WebView 13.x 之前, 不用 androidx.window.*)

2. **诊断 RN WebView 视频/图片问题顺序**:
   - 先看 logcat `ClassNotFoundException` (root cause)
   - 再看 server log 有没有收到 mobile 的请求 (mobile 端有没有发起)
   - 最后看 console.log / injectedJavaScript

3. **跨网 HTTPS 在 Android 7 老系统**:
   - 走 server proxy 鉴权转发到同源 HTTPS, 比直连第三方 CDN 稳定
   - shipin-APP cert 链短握手稳定, 第三方 CDN (platform-outputs.agnes-ai.space) SSL 握手老旧失败

4. **HTML5 video autoplay 必须 muted** (chromium autoplay policy)

5. **UI 改版必走 race condition check**: toolbar 加"新建"按钮, 必须检查 loadHistory 是否会自动跳回旧 conv (修法: 加 userInitiated flag)

6. **PS 5.1 + 嵌套 ssh/bash 转义**: 写 .ps1 文件 + `powershell -ExecutionPolicy Bypass -File xxx.ps1` 透传, 不要 `powershell -Command "..."` 拼

7. **gradle build 后 java 进程残留**: java 进程跑着但 BUILD SUCCESSFUL (daemon 残留), 后续轮询不要被误导, 看 log 末 BUILD SUCCESSFUL

8. **APK bundle 关键字搜**: `[System.IO.Compression.ZipFile]` 读 APK 内 `assets/index.android.bundle`, 搜关键字确认 TS 代码真进了 bundle (避免 UP-TO-DATE 用 cache 漏 bundle 重生)

9. **incremental compile 用 `--rerun-tasks`**: 强制 task 重新跑, 包括 createBundleReleaseJsAndAssets