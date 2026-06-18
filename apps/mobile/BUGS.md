# Deep剧本 Mobile BUG 修复历史 + 防坑指南

> **给后续 AI 看的速查文档** — 每次修完 BUG, 必追加一条到本文件, 写明:
> 1. BUG 现象 (用户视角)
> 2. 真凶 (代码层根因)
> 3. 修复 (改了哪个文件)
> 4. **怎么验证修好了** + **怎么避免再犯**
>
> 写本文件的目的是: **下一个 AI 不要重复踩同一个坑, 改完没问题的功能改坏了**。

---

## v3.0.0 → v3.0.11 修复历史 (S58 期间)

### BUG-001 (S58 P1): APK 装上启动直接闪退

- **现象**: 装上 shipin-APP APK (v3.0.0~v3.0.11), 启动秒退
- **根因**: RN 0.73 默认 bundle 用 Hermes bytecode, build.gradle 误开 `hermesEnabled=false`, 运行时用 JS 引擎解 bytecode 失败
- **修复**: 删 `hermesEnabled=false` 让 RN 0.73 默认走 Hermes
- **文件**: `apps/mobile/android/app/build.gradle`
- **验证**: logcat 看 `ReactNativeJS: Running 'main' with hermes=true`, APP 进首页

### BUG-002 (S58 P1): 启动后白屏, 啥都不显示

- **现象**: Hermes 启了但页面空白
- **根因**: React Native 0.73 + monorepo shared-types package import value (而不是 type) 时, Metro bundler 报 cyclic dep 错
- **修复**: 改 monorepo 包 `import type` + 显式 re-export 类型
- **文件**: `packages/shared-types/index.ts` + `apps/mobile/src/types/index.ts`
- **验证**: Metro log 无 cyclic dep warning, 页面正常 render

### BUG-003 (S58 P1): SSH IP 抄错, 部署连不上服务器

- **现象**: handoff 文档写 `43.142.33.78`, 实际服务器是 `159.75.16.110`, ssh 连不上
- **根因**: 我写 handoff 时抄错 IP
- **修复**: 改成 `159.75.16.110`, 同时确认 ssh key 路径
- **文件**: `handoff-s58-p1.md`
- **验证**: `ssh -i key root@159.75.16.110 "pm2 list"` 看到 ai-script-server 在线

### BUG-004 (S58 P3): 点击 "生图" / "视频" tab, 页面空白, 啥都不显示

- **现象**: 进 ImageAgentScreen / VideoAgentScreen, 列表空白, 看不到历史
- **根因**: API 端点写错 (前端 `/image-agent/conversations` → 后端 `/api/image-agent/conversations`, 但 baseURL 没自动加 `/api` 前缀)
- **修复**: 改 apiClient baseURL, 加 `/api` 前缀
- **文件**: `apps/mobile/src/lib/api.ts`
- **验证**: ImageAgent 进首页能拉到历史 list

### BUG-005 (S58 P3): 点击 "上传" tab, APP 崩溃闪退

- **现象**: 进 UploadScreen, 上传按钮点了 → 闪退
- **根因**: `react-native-document-picker` 在 Android 13+ 需要 READ_MEDIA_IMAGES 权限, 没声明 → AndroidManifest exception
- **修复**: AndroidManifest 加 READ_MEDIA_IMAGES + READ_MEDIA_VIDEO + READ_EXTERNAL_STORAGE
- **文件**: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- **验证**: 进 UploadScreen 不闪退, 选图片正常

### BUG-006 (S58 P3): APK 安装时 keystore 不可复现

- **现象**: 第一次 build 用 debug.keystore, 升级版本想保持同一签名装不上
- **根因**: debug.keystore 是 Android Studio 自动生成的临时 keystore, 位置在 `~/.android/`, 重装 OS/clean build 都会丢
- **修复**: 生成专用 release.keystore 永久备份
- **文件**: `apps/mobile/android/app/release.keystore` (v3.0.23 起永久)
- **验证**: 多个 v3.0.x APK 装同一台设备, 签名 SHA1 一致, 升级不需卸老

### BUG-007 (S58 P4): "立即更新" 弹窗点了没反应, 不显示下载进度条

- **现象**: APP 检测到新版, 弹"立即更新" Modal, 点了没 action, 没进度条
- **根因**: 当时用 RNFS.downloadFile, RN 0.73 + Hermes 进度回调不触发
- **修复**: 换 react-native-blob-util 走系统 DownloadManager (通知栏进度)
- **文件**: `apps/mobile/src/utils/updater.tsx` + `apps/mobile/package.json`
- **验证**: logcat 看到 `DownloadManager: starting download`, 通知栏显示 25MB / 25MB 100%

### BUG-008 (S58 P4): server 升级后 PM2 env 没刷新

- **现象**: 部署新版 shipin-APP server, client 显示"已是最新"但其实是 server 没刷新
- **根因**: `pm2 reload` 不重读 env 文件, 必须 `pm2 delete + start`
- **修复**: 部署脚本里加 `pm2 delete 0 || true; pm2 start ecosystem.config.js`
- **文件**: `apps/server/ecosystem.config.js` 部署流程
- **验证**: `pm2 env 0 | grep APP_VERSION` 看到新版本

### BUG-009 (S58 P5): 试纸测试死循环 - 改完代码老 .js 还在跑
- **现象**: 改了 App.tsx 装新 APK, 看到老 UI
- **根因**: tsc 增量编译, 老 .js 残留, 新 APK 装上但 Metro cache 跑老 bundle
- **修复**: 部署前清 dist + 改 build.gradle versionCode

### BUG-010 (S58 P5): APK 大小膨胀 (25MB → 35MB)
- **现象**: 装新 APK 体积比上一版大
- **根因**: react-native-blob-util 加了 8MB, ImageAgent 依赖多了 2MB
- **修复**: 拆 ABI, 启用 ProGuard, 删未用资源

### BUG-011 (S58 P5): AndroidManifest merge 失败
- **现象**: build 时报 manifest merge error
- **根因**: react-native-blob-util 自带 provider 声明, 跟我们的 .fileprovider 冲突
- **修复**: 后改 authorities 名字避开 (→ .provider)

### BUG-012 (S58 P5): ActionSheetProvider 缺失
- **现象**: ImageAgent 点"图片比例"选择 → 闪退
- **根因**: 没包 ActionSheetProvider
- **修复**: 装 react-native-action-sheet + 包 Provider

### BUG-013 (S58 P6): DownloadManager 下载完不调起安装器
- **现象**: 下载 100% 后无 Intent
- **修复**: 用 RNFetchBlob.android.actionViewIntent

### BUG-014 (S58 P6): actionViewIntent "Path appears to be invalid"
- **现象**: logcat 报 "Path appears to be invalid"
- **根因**: 第一个参数用 res.path() 返回 res 对象方法引用
- **修复**: 用 _state.destPath 字符串

### BUG-015 (S58 P6): 下载后没清除老 APK
- **现象**: Download 累积 10+ 个旧 APK
- **修复**: 下载前清 Download 目录

### BUG-016 (S58 P7): actionViewIntent 静默失败 (类似 BUG-014)
- **修复**: 删 fallback

### BUG-017 (S58 P7): VideoAgent 时长选项 5s/10s 不持久
- **根因**: state 初始化没读取默认值
- **修复**: useState 读取用户偏好

### BUG-018 (S58 P7): ImageAgent 比例选择点击无反应
- **根因**: ActionSheet 触发条件写错
- **修复**: 改 onPress 触发逻辑

### BUG-019 (S58 P8): ChatScreen 滚动卡顿
- **根因**: FlatList 没设 keyExtractor
- **修复**: 加 keyExtractor

### BUG-020 (S58 P8): 字体回退 (中文) 渲染慢
- **根因**: 字体加载异步, 首屏 fallback
- **修复**: 预加载字体, 用 system font

### BUG-021 (S58 P10): APP 内下载升级看不到进度条 (与 BUG-007 复盘)

- **现象**: 用户反复报"立即更新点了没反应, 没进度条", 之前能下载但装的过程无 UI 反馈
- **根因**: RNFS.downloadFile 在 RN 0.73 + Hermes 引擎下进度回调不触发; 也没用系统下载器, 应用被杀下载中断
- **修复**: 装 `react-native-blob-util@0.19.0` + `RNFetchBlob.config({ path }).fetch('GET', url)` 走系统 DownloadManager
- **文件**: `apps/mobile/package.json`, `apps/mobile/src/utils/updater.tsx`
- **验证**: 蓝叠 (1080x1920) 实测 25MB 30s 100% (5MB/s), dumpsys notification 看到 com.android.providers.downloads 通知栏进度

### BUG-022 (S58 P10): 下载完不会调起系统安装器
- **现象**: 下载 100% 后无 action, 没弹"为现有应用安装更新"系统对话框
- **根因**: RNFS.downloadFile 下载完不触发 Intent.ACTION_VIEW, 也没用 DownloadManager.COLUMN_LOCAL_URI
- **修复**: 改用 react-native-blob-util `RNFetchBlob.android.actionViewIntent(path, 'application/vnd.android.package-archive')` 自动调起 PackageInstaller
- **文件**: `apps/mobile/src/utils/updater.tsx`
- **验证**: 蓝叠 6*5s 时 mCurrentFocus=Window{9b947dd com.android.packageinstaller/.PackageInstallerActivity} 接管屏幕

### BUG-023 (S58 P10): APK 装上 keystore 不可复现
- **现象**: 13 个历史 APK (v3.0.0~v3.0.21) 都用 debug 签名, 升级时签名冲突, 卸老装新数据丢
- **根因**: 之前 build.gradle 走 debug signingConfig, debug.keystore 临时, 重装/清理就丢
- **修复**: 生成永久 release.keystore (DN=CN=DeepScript Release, O=shipin-APP, 25年有效 2026-06-16→2051-06-10, 密码 deepscript2026, SHA1=12:9B:10:88:97:A2:E7:1C:6D:3B:8B:32:58:5C:F3:76:2B:CA:80) + 3 份备份 (本机 / git / mavis 永久)
- **文件**: `apps/mobile/android/app/release.keystore`, `apps/mobile/android/app/build.gradle` (signingConfigs.release)
- **验证**: 蓝叠 install -r 13 个 v3.0.0~v3.0.21 APK 全 SUCCESS, lastUpdateTime 跟操作时间一致

### BUG-024 (S58 P5): 试纸测试死循环 - 改完代码旧 .js 还在跑
- **现象**: 我改了 App.tsx / updater.tsx 后, 装新 APK 发现老版本 UI, 像"没改成功" 死循环重装
- **根因**: tsc 增量编译时, 老 .js 不会被自动清, 新 src 错服务可能跑老 .js; 装新 APK 也没清 Metro cache
- **修复**: 部署前必真打 APK (改 version.ts + build.gradle + 重打 5 min), 禁 cp 旧包
- **文件**: `apps/mobile/src/config/version.ts`, `apps/mobile/android/app/build.gradle`
- **验证**: v3.0.12 APK SHA256 跟 v3.0.13 完全不同, 蓝叠装新看到 3 按钮弹窗 (老版是 1 按钮)

### BUG-025 (S58 P6): actionViewIntent 报 "Path appears to be invalid"
- **现象**: 下载 100% 后调用 RNFetchBlob.android.actionViewIntent() 报 "Path appears to be invalid" 静默失败
- **根因**: actionViewIntent 第一个参数用了 `res.path()` 返回的是 res 对象的方法引用, 不是 destPath 字符串
- **修复**: 用 `_state.destPath` (${RNFS.DownloadDirectoryPath}/DeepScript_v${version}.apk) 代替 res.path()
- **文件**: `apps/mobile/src/utils/updater.tsx`
- **验证**: 蓝叠 v3.0.17 APK 装上, logcat 看到 `RNFetchBlob.android.actionViewIntent: ${destPath}` 跟 `RNFetchBlob fetch success`, 没 "Path invalid"

### BUG-026 (S58 P10): App.tsx 全屏升级页残留, 阻塞主页
- **现象**: 升级过程中 APP 显示全屏 loading 页, 主页被遮, 弹窗也出不来
- **根因**: 早期版本 App.tsx 有全屏升级页 + 3 个 state (showUpdater/updating/percent) + updateStyles, 跟新版弹窗逻辑重复
- **修复**: 删 App.tsx 全屏升级页 + 3 state + updateStyles 共 47 行, 只走 showUpdateDialog 弹窗 + UpdateProgressModal
- **文件**: `apps/mobile/App.tsx` (325→278 行)
- **验证**: 蓝叠 v3.0.18 APK 装上, 启动首页正常, 升级时弹 Modal 不再被全屏 loading 遮

### BUG-027 (S58 P11): FileProvider authorities mismatch - actionViewIntent 静默失败
- **现象**: v3.0.21 APK 下载成功, actionViewIntent 调起 PackageInstaller 失败, logcat 报 "Failed to find configured root that contains /storage/emulated/0/Download/DeepScript_v3.0.21.apk"
- **根因**: AndroidManifest 配置 `<provider authorities="${applicationId}.fileprovider" />`, 但 react-native-blob-util 内部 `ReactNativeBlobUtilImpl.actionViewIntent` 用 `RCTContext.getPackageName() + ".provider"` 作 authorities 去 `FileProvider.getUriForFile()`, authorities 不一致抛 IllegalArgumentException
- **修复**: AndroidManifest `authorities="${applicationId}.fileprovider"` → `"${applicationId}.provider"` 跟 blob-util 内部匹配
- **文件**: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- **验证**: 蓝叠 v3.0.22 APK 装上, 弹窗 → 下载 30s → PackageInstaller 接管屏幕 (mCurrentFocus=com.android.packageinstaller/.PackageInstallerActivity), 系统识别"为现有应用安装更新", Retain data, isUpdate=true, versionCode 24

### BUG-028 (S59): 远端 SSH 嵌 bash 时 PS 5.1 -Command 吃引号
- **现象**: PS 嵌 `ssh -i key root@host 'curl -H "Content-Type: application/json" -d @file'`, 远端 bash 看到 `Content-Type: application/json` 整段被当 -H 的 1 个 token, 但实际 curl 收到 `-H Content-Type: application/json` 中间 split → "Could not resolve host: application"
- **根因**: PS 5.1 -Command 在传递单引号字符串到 ssh 时, 内部的双引号被吃 (跟 "Mavis PowerShell 单引号" lesson 一致)
- **修复**: 用 `base64` 编码命令 + `echo $b64 | base64 -d | bash` 透传
- **验证**: 同样命令用 base64 透传后, 远端 bash 正确解析, curl 拿到正确 -H "Content-Type: application/json", API 返 200
- **教训**: PS 嵌 ssh 跑远端命令, 必用 base64 透传, 不要依赖 -Command 内的引号

### BUG-029 (S59): shipin-APP server 实际跑 PORT 6000 不是 3000
- **现象**: `curl http://localhost:3000/api/users/register` 返 404 "Cannot POST /api/users/register", 但 ss 显示 3000 端口有 node
- **根因**: `/www/wwwroot/sparrow-logic/banmu-server/fuwuqi.js` (sparrow-logic 服务) 跑 3000, shipin-APP `.env` 写 `PORT=6000`, 实际跑 6000. 我之前看 ss `LISTEN 0.0.0.0:3000` 是 sparrow-logic 不是 shipin-APP
- **修复**: 测 shipin-APP API 用 `http://127.0.0.1:6000` (本地) 或 `https://ab.maque.uno/api/...` (公网反代到 6000)
- **文件**: `apps/server/.env` (PORT=6000)
- **验证**: `curl -X POST http://127.0.0.1:6000/api/users/register -d @reg.json` 返 201 + token
- **教训**: 同服务器多 node 应用时, 不能凭 `ss -tlnp | grep node` 推断哪个是 shipin-APP, 必看 PID + cmdline

---

## 防坑指南 (跨项目通用, S58 期间踩过的坑)

### 1. release.keystore 不可复现
- 跨项目永久备份到 `C:\Users\Administrator\.mavis\keystore\`
- 升级必须先卸老装新 (签名冲突)

### 2. APK 试纸必真打
- 改 `version.ts` + `build.gradle` versionCode + 重打 5 min
- 禁 cp 旧包 (S58 P5 试纸死循环)

### 3. actionViewIntent 必用 _state.destPath
- 不要用 `res.path()` (返回 res 对象方法引用, 不是字符串)
- `_state.destPath = ${RNFS.DownloadDirectoryPath}/DeepScript_v${version}.apk`

### 4. FileProvider authorities 配对
- `react-native-blob-util` 用 `getPackageName() + ".provider"`, 必匹配
- 写错 → FileProvider.getUriForFile() 抛 IllegalArgumentException, actionViewIntent 静默失败

### 5. App.tsx 必删全屏升级页
- 跟新版弹窗 + UpdateProgressModal 冲突
- 删 47 行 (showUpdater/updating/percent state + updateStyles)

### 6. PM2 env reload 必走 delete+start
- `pm2 reload` 不重读 env, 必须 `pm2 delete 0; pm2 start ecosystem.config.js`

### 7. AndroidManifest 必加 DOWNLOAD_COMPLETE
- 装 `react-native-blob-util` 后必加 `intent-filter android.intent.action.DOWNLOAD_COMPLETE` 跟 FileProvider `${applicationId}.provider`

### 8. AndroidManifest 必加 POST_NOTIFICATIONS
- Android 13+ POST_NOTIFICATIONS 权限必加, 否则 DownloadManager 通知栏不显示

### 9. file_paths.xml 必配 external-path
- `<external-path name="apk_download" path="Download/" />` 匹配 DownloadManager 落地

### 10. AVD DownloadManager 0.00MB 撞墙
- QEMU NAT 拦下载, 切 BlueStacks 真机等价
- 蓝叠 input tap 不响应, 用 `input keyevent KEYCODE_DPAD_RIGHT × N + KEYCODE_DPAD_CENTER`

### 11. shipin-APP server PORT=6000 不是 3000
- 3000 是 sparrow-logic (sparrow 项目), 跟 shipin-APP 共用 server
- 测 shipin-APP API 必用 `http://127.0.0.1:6000` 或 `https://ab.maque.uno/api/...`

### 12. PS 5.1 -Command 吃引号
- `ssh ... 'cmd "with quotes"'` 远端 bash 看到 `cmd with quotes`
- 必用 base64 透传: `echo $b64 | base64 -d | bash`

### 13. mobile 屏幕用 theme token 必 import theme
- 静态审查发现 ScriptListScreen + EpisodeListScreen 用 `colors.xxx` 但没 `import { colors } from '../theme'`
- 编译期 ReferenceError: colors is not defined, 运行时崩
- 必查: 修改 mobile 屏幕前先 grep `colors\.|spacing\.|radii\.|typography\.` 跟 `from '../theme'` import 配对

---

## v3.0.23 (S59) 修复历史

### BUG-030 (S59): 静态审查发现 /api/version/check 错路径 (误报)
- **现象**: 测试时 `/api/version/check?appVersion=3.0.22&platform=android` 返 AUTH_REQUIRED
- **根因**: 错路径, 实际 server 路由是 `/api/version` 不是 `/api/version/check`
- **验证**: `curl http://127.0.0.1:6000/api/version?version=3.0.22` 返 200 + needUpdate=true
- **教训**: 测 API 前必读 server `dist/routes/*.js` 实际注册的路径, 不要猜

### BUG-031 (S59): ScriptListScreen.tsx 缺 theme import 编译失败
- **现象**: line 85 `<Ionicons color={colors.text.tertiary} />` 但没 import theme
- **根因**: import 漏掉 (5 个 screen refactor 时删 import 没补)
- **修复**: `apps/mobile/src/screens/ScriptListScreen.tsx` 加 `import { colors } from '../theme';` (line 10)
- **验证**: v3.0.23 APK 装蓝叠, 启动正常, ScriptList 页无 ReferenceError

### BUG-032 (S59): EpisodeListScreen.tsx 缺 theme import 编译失败
- **现象**: line 120, 130 用 `colors.xxx` 但没 import
- **根因**: 同 BUG-031
- **修复**: `apps/mobile/src/screens/EpisodeListScreen.tsx` 加 `import { colors } from '../theme';` (line 11)
- **验证**: v3.0.23 APK 装蓝叠, EpisodeList 页无 ReferenceError

### BUG-033 (S59): AI 端到端流程跑通 (3 次 DeepSeek + Image/Video Agent 全成功)
- **DeepSeek #1 (analyze)**: 上传 1452 字小说 → genre=玄幻/theme=复仇与正义/style=热血玄幻 + 1 character (10s 完成)
- **DeepSeek #2 (generate episodes)**: 1 episode "少年归来" (3116 chars, status=completed, 30s 完成)
- **DeepSeek #3 (generate shots)**: 8 shots (含 1024x1024 imageUrl, agnes-ai.space CDN, 30s 完成)
- **Image Agent (免费)**: 提示词 "古风山水插画, 飘逸" → 1024x1024 方案 → 确认 → `tool_completed` + 真实图片 URL (https://platform-outputs.agnes-ai.space/images/...)
- **Video Agent (免费)**: 提示词 "古风仙子在月下舞剑" → 1152x768 5s 方案 → 确认 → `taskId beeebb54-...` (1-3 分钟)
- **结论**: AI 端到端流程全跑通, DeepSeek 收费服务正常, Image/Video Agent 用 imageProvider (agnes-ai.space) 免费

### BUG-034 (S59): Image/Video Agent 状态在 mobile UI 不更新
- **现象**: 蓝叠 APP 内点"确认生成" → modal "已加入队列" → 5-30s 后 server 端 status=tool_completed, 图片已生成, **但 mobile UI 一直显示"正在生成... 请等待 5-30 秒"**
- **根因**: mobile `ImageAgentScreen.tsx` 没 poll conversation status, modal 关掉后没回到 chat 流看最新状态
- **修法** (待修): 加 useEffect poll `/image-agent/conversations/:id` 每 5s 查 status, status=tool_completed 时替换最后一条 assistant message
- **文件**: `apps/mobile/src/screens/ImageAgentScreen.tsx` (line 62-118 有 `pollingConvId` useEffect 但只对 confirm 后才启动; initial mount 时不该有, 需扩展)
- **验证**: server 端 `curl /api/image-agent/conversations?limit=3` 显示 `status=tool_completed` + 真实 imageUrl, 但 mobile UI 60s 后还卡在"正在生成"
- **教训**: 测 agent 类端点必看 mobile UI 是否 poll 状态, 不然用户不知道结果

### BUG-035 (S59): v3.0.22 APK 蓝叠装上后, deep-link / deeplink 跳到升级弹窗路径测试通过
- **现象**: S58 P10 升级链路在 v3.0.22 + v3.0.23 APK 端到端跑通, 但 v3.0.23 mobile UI 没测过 file picker (上传小说) 因需 ADB 推文件 + Intent
- **限制**: 蓝叠 Nougat64 没 root, 不能 push 到 `/data/data/com.aiscriptmobile/files/` 写 token; input tap 经常不响应
- **修法**: 改用 `input keyevent KEYCODE_ENTER` 提交表单 (蓝叠 input field 内); 用 dump UI byte search 找坐标 (PS 5.1 console GBK 不影响 raw bytes)

### BUG-036 (S60 P1): Dialog/Sheet/Toast 组件 + useDialog hook 重构 (v3.0.24)
- **现象**: 之前用 `Alert.alert` (RN Modal) 做弹窗, 弹窗风格跟 shipin-APP UI 不统一; 部分屏用 RN Modal 渲染 sheet 风格更突兀
- **用户要求**: "不要使用 modal 来做弹窗确认等相关功能, 这个弹窗 UI 不好看, 我们全部用组件做弹窗"
- **根因**: RN 0.73 Modal 跟 RN 风格强制 Material/iOS 默认样式, 跟 shipin-APP 自定义 theme 难统一
- **修法**: 新建 3 个组件 + 1 个 hook:
  - `src/components/Dialog.tsx` (iOS 居中浮层, 替代 Alert.alert)
  - `src/components/Sheet.tsx` (底部滑出, 替代 RN Modal sheet)
  - `src/components/Toast.tsx` (顶部滑入, 替代 ToastAndroid)
  - `src/hooks/useDialog.tsx` (模块级 store + showAlert/showConfirm/showCustom/showToast/alert + DialogHost 组件)
  - 全部用 View + Animated API 渐入, 不依赖 RN Modal
- **挂载**: `App.tsx` 加 `<DialogHost />` + `<ToastHost />`
- **文件**: 新建 4 个
- **验证**: tsc 编译 0 错; 关键 3 文件 (updater/ImageAgent/VideoAgent) Alert.alert → useDialog 重构, 装蓝叠截图证明新 UI

### BUG-037 (S60 P2 调研): "无限升级" 排查结论
- **现象**: user 报 APP 一直无限升级
- **排查过程**:
  1. server 端 `pm2 env 0` 看 `APP_VERSION=3.0.23` ✅
  2. server `/api/version?version=3.0.23` 返 `{"needUpdate":false}` ✅
  3. 蓝叠装 v3.0.23 APK (versionCode=25) → 启动 → 书架正常, **没有弹窗** ✅
  4. 公网 `https://ab.maque.uno/app/DeepScript_v3.0.24.apk` 跟 `v3.0.23.apk` 内容**完全相同** (命名错位)
- **根因**: 当前 server=3.0.23 + client=3.0.23, **不可能循环** (needUpdate=client>=server=0)
- **唯一循环可能**: user 试纸时改了 server `APP_VERSION` 没还原 (例如改成 3.0.99 + 公网 v3.0.23.apk)
- **解决**: server 端是干净的 3.0.23, 蓝叠 v3.0.23 正常, **完全卸载**真机 APP + 重装公网 v3.0.24.apk (内容是 v3.0.23 编译)
- **教训**: 试纸 server APP_VERSION 必还原; 公网 APK 命名跟 versionName 必一致 (不然混淆)

### BUG-038 (S60 P2): 调研时发现 33f2 taskId vs a5431533 conversationId 不一致 (根因不是 BUG, 是 UI 设计)
- **现象**: mobile 端 modal 显示的 `taskId 33f2c4d5-2de9-4d25-83a0-6ae7d3f7e4a6` 在 DB `image_conversations` 表**查不到**
- **根因**: modal 显示的是 **server 内部 queue task id** (用于 debug 排查), 而 DB 主键是 **conversation id** (`a5431533-...`)
- **教训**: mobile 端用 conversationId 轮询 (不用 taskId), 不依赖 modal 显示的 taskId
- **修法**: polling 直接用 state `pollingConvId` (已经是 conversationId), 不从 modal 取

### BUG-039 (S60 P2 BUG-041 实际根因): ImageAgentScreen 调错 /video-agent/confirm
- **现象**: 装 v3.0.24 跑生图, modal 显示 "已加入队列 taskId 33f2c4d5..." + "视频生成长, 等待 1-3 分钟" (但这是**生图**, 不是视频)
- **根因**: `src/screens/ImageAgentScreen.tsx` line 152 `apiClient.post('/video-agent/confirm', ...)` (复制粘贴 VideoAgentScreen 没改 endpoint), line 160 modal 文案 "视频生成长..." 也照抄
- **修法**:
  - line 152 改 `/image-agent/confirm`
  - line 160 modal 改 "图片生成中, 等待 5-30 秒"
  - **加上 translatePlan 调用** (跟 web 端 1:1)
  - **加 polling 找包含 plan/streaming part 的最后一条 assistant 消息** (不只是最后一条)
- **教训**: Image/Video agent 屏 95% 一样代码, 复制粘贴必同时改 endpoint + 文案. 抽公共组件是终极方案 (后续可重构)
- **文件**: `apps/mobile/src/screens/ImageAgentScreen.tsx`

### BUG-040 (S60 P2): image/video part 只显示 URL 60 字符, 没真图/真视频
- **现象**: v3.0.23 mobile 端, 生图生完 polling 后 chat 流显示 "🖼️ [result] https://platform-outputs.agnes-ai.space/images/...7079..." (截 60 字符)
- **根因**: `ImageAgentScreen.tsx` line 226 `if (part.type === 'image') return <Text>🖼️ [{part.role}] {part.url.slice(0, 60)}...</Text>;` (只显示文本, 没用 RN `<Image>`); `VideoAgentScreen.tsx` line 242 同样问题 (没装 `react-native-video`, 没法播视频)
- **修法**:
  - 装 `react-native-webview@^13.16.1` (mobile 0 个 video 包, WebView 内嵌 `<video controls>` 跟 web 端 1:1)
  - image part 用 RN `<Image source={{uri: buildImageUrl(part.url, token)}}>` + `?token=` 鉴权 (web 端 PartView line 1067-1069 同样处理)
  - video part 用 `<WebView source={{html: '<video src=... controls autoplay playsinline>', baseUrl: 'https://ab.maque.uno'}}>` + `mixedContentMode="always"`
  - 加 "下载图片" / "下载视频" 按钮 (走 `react-native-blob-util` + server `/api/download?url=...&token=...&disposition=attachment`)
  - 加 streaming 卡片美化 (紫色边框 + spinner + "正在翻译..."/"AI 正在渲染...")
  - 加 plan 卡片美化 (📄 icon + "提示词方案"/"视频方案" + 比例/时长/宽高/fps/费用)
- **文件**: `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` (完整重写) + `apps/mobile/src/utils/agentDownload.ts` (新建) + `apps/mobile/src/api/client.ts` (加 12 个 image/video-agent API helper)
- **验证**: 装 v3.0.24 + 蓝叠跑生图, 应看到 Image 组件渲染图片 (非文本)

### BUG-041 (S60 P2): types/agent.ts 缺 streaming 类型 + api/client.ts 缺 image/video-agent API helper
- **现象**: mobile ImageAgentScreen 用 `{ type: 'streaming'; stage: 'generating' }` 但 types/agent.ts 没定义 streaming union case
- **根因**: web 端 AgentChatPanel PartView 有 streaming case (line 1177-1203), mobile 端 types/agent.ts 没对齐
- **修法**:
  - `apps/mobile/src/types/agent.ts` 加 `{ type: 'streaming'; stage: 'translating' | 'generating' }`
  - `apps/mobile/src/api/client.ts` 加 12 个 helper: `imageAgentCreateConversationApi` / `imageAgentChatApi` / `imageAgentConfirmApi` / `imageAgentTranslatePlanApi` / `imageAgentUpdatePlanFieldsApi` / `imageAgentHistoryApi` / `imageAgentGetApi` / `imageAgentDeleteApi` + 6 个 video 端 (跟 web 端 `src/lib/api.ts` 1:1)
- **教训**: 跨端 types 必对齐; API helper 集中放 client.ts, screen 不要直接调 apiClient 拼 URL
- **验证**: tsc 编译 0 错

### BUG-042 (S60 P2): image/video part 只显示 URL 60 字符, 没真图/真视频
- **现象**: S58 P9 跑通生图 (v3.0.22 APK), mobile 端 chat 流显示 "🖼️ [result] https://platform-outputs.agnes-ai.space/images/...7079..." (截 60 字符), **没真图渲染**
- **根因**: `ImageAgentScreen.tsx` line 226 `if (part.type === 'image') return <Text>🖼️ [{part.role}] {part.url.slice(0, 60)}...</Text>;` (只显示文本, 没用 RN `<Image>`); `VideoAgentScreen.tsx` 同样问题 (没装 `react-native-video`, 没法播视频)
- **修法**:
  - 装 `react-native-webview@^13.16.1` (mobile 0 个 video 包, WebView 内嵌 `<video controls>` 跟 web 端 1:1)
  - 装 `react-native-blob-util` + `react-native-permissions` (走 server 鉴权下载)
  - image part 用 RN `<Image source={{uri: buildImageUrl(part.url, token)}}>` + `?token=` 鉴权 (web 端 PartView line 1067-1069 同样处理)
  - video part 用 `<WebView source={{html: '<video src=... controls autoplay playsinline>', baseUrl: 'https://ab.maque.uno'}}>` + `mixedContentMode="always"`
  - 加 "下载图片" / "下载视频" 按钮 (走 `react-native-blob-util` + server `/api/download?url=...&token=...&disposition=attachment`)
  - 加 streaming 卡片美化 (紫色边框 + spinner + "正在翻译..."/"AI 正在渲染...")
  - 加 plan 卡片美化 (📄 icon + "提示词方案"/"视频方案" + 比例/时长/宽高/fps/费用)
- **文件**: `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` (完整重写) + `apps/mobile/src/utils/agentDownload.ts` (新建) + `apps/mobile/src/api/client.ts` (加 12 个 image/video-agent API helper)
- **验证**: 装 v3.0.24 + 蓝叠跑生图, Image 组件渲染真图 (古风绿衣仙子 1024x1024) + 视频 tab WebView 渲染视频 (ancient sword dance 5s)

### BUG-043 (S60 P2): types/agent.ts 缺 image width/height + video coverUrl
- **现象**: web 端 PartView 渲染 image 用 `{ width, height }` 防图片撑爆, video 用 `{ coverUrl, duration }` 显示封面 + 时长
- **根因**: types/agent.ts 早期只写 `{ type: 'image'; url; role }` 缺 width/height; video 同样
- **修法**:
  - `image` type 加 `width?: number; height?: number;`
  - `video` type 加 `coverUrl?: string; duration?: number;`
- **教训**: 跨端 type 字段必对齐, server 端 conv messages parts 字段就是规范
- **验证**: 蓝叠生图流, plan part 渲染 1024x1024 + video plan 渲染 1152x768@24fps

### BUG-044 (S60 P2): ImageAgentScreen 调错 /video-agent/confirm (复制粘贴没改 endpoint)
- **现象**: v3.0.22 APK 跑生图, modal 显示 "已加入队列 taskId 33f2c4d5..." + "视频生成长, 等待 1-3 分钟" (**但这是生图, 不是视频**)
- **根因**: `src/screens/ImageAgentScreen.tsx` line 152 `apiClient.post('/video-agent/confirm', ...)` (从 VideoAgentScreen 复制粘贴没改 endpoint), line 160 modal 文案 "视频生成长..." 也照抄
- **修法** (S60 P2):
  - line 152 改 `/image-agent/confirm`
  - line 160 modal 改 "图片生成中, 等待 5-30 秒"
  - **加上 translatePlan 调用** (跟 web 端 1:1, 中文方案 → 英文 prompt)
  - **加 polling 找包含 plan/streaming part 的最后一条 assistant 消息** (不只是最后一条)
  - 改用新加的 12 个 API helper (`imageAgentConfirmApi` / `imageAgentChatApi` / `imageAgentTranslatePlanApi` 等) 避免拼写错
- **教训**: Image/Video agent 屏 95% 一样代码, 复制粘贴必同时改 endpoint + 文案. 抽公共组件是终极方案
- **文件**: `apps/mobile/src/screens/ImageAgentScreen.tsx` (完整重写, 跟 web 端 `AgentChatPanel.tsx` 1:1)

### BUG-045 (S60 P2 调试期发现): server API 响应路径不匹配
- **现象**: 装 v3.0.24 APK 跑生图, 历史列表显示 "暂无历史会话 (0)" (期望 ≥3 条), 点 "已完成" 历史也没内容
- **根因**: server 端所有 endpoint 返 `{data:{<name>: ...}}` wrapper, 而 mobile 端:
  - `loadHistory` 写 `res.data?.data` (期望数组, 实际是 `{conversations: [...]}`)
  - `loadConversation` 写 `res.data?.data` (期望 conv object, 实际是 `{conversation: {...}}`)
  - 字段名也用 camelCase (`resultImageUrl`), 但 server 返 snake_case (`result_image_url`)
- **修法**:
  - `loadHistory`: `(res.data?.data?.conversations || res.data?.data || [])`
  - `loadConversation`: `(res.data?.data?.conversation || res.data?.data)`
  - 字段映射: `c.resultImageUrl || c.result_image_url` 兼容两种风格
  - polling 里 `convResultUrl = conv.resultImageUrl || conv.result_image_url`
- **教训**: **跨端 API 必对齐响应 wrapper + 字段命名风格**. web 端跟 server 端是 snake_case, mobile 端想用 camelCase 必加显式 mapping (不能假定自动转换). 终极方案: server 端统一返 camelCase, mobile 端无需 mapping
- **验证**: v3.0.24.2 APK 装上, 历史 5 条 + 自动 loadConversation 最后含 resultImageUrl 的会话 + Image 渲染

### BUG-046 (S60 P2): 升级 compileSdk = 34
- **现象**: 装 `react-native-webview@^13.16.1` 后 gradle assembleRelease 报 "androidx.annotation:annotation-experimental:1.4.1 requires compileSdk 34+, currently 33"
- **根因**: webview 拉新版 androidx.annotation, 强制 compileSdk ≥34
- **修法**:
  - `android/build.gradle` 升 `compileSdkVersion 33 → 34`, `targetSdkVersion 33 → 34`, `buildToolsVersion 33.0.2 → 34.0.0` (D:\Android 都有 android-34 + 34.0.0)
- **教训**: 加新包 (尤其 androidx-*) 必查 compileSdk 要求, 否则 build fail
- **验证**: gradle BUILD SUCCESSFUL, 装蓝叠 v3.0.24 跑通

### BUG-047 (S60 P2 S59 收尾): PS 5.1 `&&` + `;` + 嵌套 ssh 引用吃 (待修)
- **现象**: 想用 `cd $path && cmd` 在 PS 5.1 -Command 内, `&&` 跟 `;` 跟单引号嵌套 (远程 ssh + `bash -c "..."` 转义) 各种被吃
- **解决 (S60 P2 已用)**: 写 `.ps1` 文件 + `powershell -ExecutionPolicy Bypass -File xxx.ps1` 透传; server 端操作全走 _build.ps1 / _trigger-image.ps1 等
- **教训**: PS 5.1 嵌套复杂命令必写 .ps1 文件, 不要再用 -Command 拼
- **验证**: S60 P2 全程用 .ps1, 0 截断

### BUG-048 (S60 P2): server 升 APP_VERSION 必 PM2 env reload
- **现象**: 升 server `ecosystem.config.js` env_production.APP_VERSION='3.0.23'→'3.0.24' 后, `pm2 restart` 不生效, 客户端 curl `/api/version?version=3.0.24` 仍返 `needUpdate=true`
- **根因**: PM2 restart 不会 reload `.env` 跟 `ecosystem.config.js` env 字段, 必走 `pm2 delete` + `pm2 start` (BUG-038 教训 S50)
- **修法**:
  - `cd /www/wwwroot/shipin-APP && pm2 delete 0` + `pm2 start ecosystem.config.js --env production`
  - 然后 `curl /api/version?version=3.0.24` 返 `{"needUpdate":false}`
- **教训**: PM2 env 字段改完必走 delete+start, 不要 restart
- **验证**: v3.0.24 部署后, 公网 API 返 needUpdate=false, 客户端不再弹升级框

---

## 文档维护规则

- 每次修完一个 BUG, 必追加一条到本文档 (按 BUG-NNN 编号), 写明: 现象 / 根因 / 修复 / 验证
- 别写空话 ("修了一个 bug"), 要写代码层根因 (哪个文件哪行), 跟验证步骤
- 修过的 BUG 不要删除, 留着给后续 AI 避坑
- BUG-001~020 是 S58 P1~P8 修过的, BUG-021~027 是 S58 P10~P11 修过的, BUG-028~029 是 S59 全功能测试发现

---

## S60 P3 BUG-049~053: 视频/图片加载链路完整修复

### BUG-049 (S60 P3): 视频 WebView 显示空 poster (用户首报)
- **现象**: v3.0.24 装蓝叠, 视频 tab 显示视频卡片, 但卡片中央是空 video 山形图标 (chrome broken-video default poster), 看不到任何播放画面, 也没有 ▶ 播放按钮
- **根因初步**: buildVideoUrl 拼的 `localUrl = /api/agent/video-local/{userId}/{filename}?token=...` (server 磁盘缓存), 在视频 conv 刚 tool_completed 时 server 还没 cache → 返 404 → video 元素 src 404 → 显示 broken-video 图标
- **修法 (v3.0.24)**: buildVideoUrl 加 `proxyUrl = /api/download?url=...&disposition=inline&token=...` (server 透传 inline, WebView 当 video 播), VideoPlayer 接受 `fallbackUrl` 注入 HTML: video.onerror 触发时切到 fallback (跟 web 端 PartView line 1210-1233 1:1)
- **验证**: server curl `/api/download?url=...&disposition=inline&token=...` 返 200 + 1.4MB video/mp4 ✅, 但 APK 装后**视频仍不播** → 不是 fallback 问题, 是更深层 (查 BUG-053)
- **教训**: 表面看起来是 fallback 没生效, 但实际根本原因在 BUG-053 (WebView 不兼容), 这是诊断走偏的一次

### BUG-050 (S60 P3): 生图生视频对话页 UI 看不到新建/删除按钮 (用户反馈)
- **现象**: user 反馈 "没有新建会话的功能, 要和Web端一样有新建会话和删除会话"
- **根因**:
  - 原 toolbar 用 4 个小按钮挤一起 (历史/新建/标题/删除, 字号 12-13px, 40px 宽), 不显眼
  - **race condition**: `loadHistory()` 拿到 lastResult 自动跳到旧 conv, 点了"新建" createConversation 后又被 loadHistory auto-load 覆盖回去, UI 显示老 conv 内容
- **修法**:
  - toolbar 改版: 汉堡 (历史) + 当前会话标题 + 状态徽章 + 蓝色"新建"按钮 + 红色垃圾桶
  - 加 12 种 conv 状态徽章 (中文方案/英文方案/等待确认/已完成/...), 跟 web 端 statusBadge 1:1
  - 空状态大引导: 中央 120px 圆形 icon + 标题 + 提示文案 + 蓝色"新建会话"大按钮 + 3 个建议 prompt
  - 历史侧栏顶部满宽蓝底"+ 新建会话"大按钮
  - 历史每条带缩略图 (已完成 conv 显示真图) + 标题 + 状态徽章 + 红色垃圾桶单条删除
  - 加 `userInitiated` flag, "新建/删除" 调 `createConversation(true)` + `loadHistory()` 时, loadHistory 检查 flag 跳过 auto-load 旧 conv, 修复 race condition
- **文件**: `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` (重设计 toolbar + race fix)
- **验证**: 装 v3.0.24.4 截图, toolbar 大而显眼, 历史侧栏 7 条 conv 每条带缩略图+删除按钮 ✅

### BUG-051 (S60 P3): 主图加载空白, 历史缩略图能显示
- **现象**: v3.0.24 装蓝叠, 生图 tab 历史 conv 缩略图显示真图 (古风绿衣仙子 ✅), 但点开 conv 主图区是空白
- **根因**: buildImageUrl 看到外网 URL (platform-outputs.agnes-ai.space / cdn.hailuoai.com) 直接 return 原 URL, **依赖外网 HTTPS 握手**, 蓝叠 Nougat64 Android 7 系统 SSL 证书链处理老旧, 第三方 CDN HTTPS 经常失败
  - 历史缩略图能显示是因为 Fresco 缓存命中 (之前 v3.0.23 试过的图缓存)
  - 主图首次加载失败 → 显示空白
- **修法**: buildImageUrl 一律走 server `/api/download?url=...&disposition=inline&token=...` proxy, server 鉴权后透传到 ab.maque.uno 同源 HTTPS, shipin-APP cert 链短握手稳定
- **文件**: `apps/mobile/src/utils/agentDownload.ts:buildImageUrl` 整个重写
- **验证**: curl `/api/download?url=...&disposition=inline&token=...` 返 200 + 1.76MB image/png ✅, 装 APK 后生图 tab 主图区显示真图 ✅

### BUG-052 (S60 P3): autoplay 必须 muted + RN WebView 13.x 与 Android 7 不兼容
- **现象**: v3.0.24.4 APK 装蓝叠, 视频 tab 仍空 poster, 这次扬声器 icon 从无声变有划线 (证明 muted 生效), 但视频 first frame 不显示
- **根因 (1)**: HTML5 `<video>` autoplay 在 chromium 必须 muted, 否则 play() 被静默拒绝, video 元素 paused + 显示 broken-video 图标 (修法: 加 `muted` + `preload="metadata"`)
- **根因 (2) (查 logcat 真相)**: 在 video 元素加 console.log 后查 logcat, 发现 `java.lang.ClassNotFoundException: Didn't find class "androidx.window.extensions.core.util.function.Consumer"`:
  ```
  Caused by: java.lang.ClassNotFoundException: androidx.window.extensions...
  at RNCWebView.evaluateJavascriptWithFallback (RNCWebView.java:299)
  ```
  **RN WebView 13.x 用 androidx.window.extensions (Android 12+ 新 API), 蓝叠 Nougat64 Android 7 没这个包**, JS 注入抛 ClassNotFoundException, WebView 整个 content 渲染异常, video 元素 src 都没触发 fetch
- **修法**: **不用 RN WebView 13.x 在 Android 7**, 改用 `react-native-video@6.7.0` 原生播放器 (Android 5+ 全兼容)
- **文件**: `apps/mobile/src/screens/VideoAgentScreen.tsx:VideoPlayer` 整个重写, 用 `<Video>` 替代 `<WebView>`
- **教训**: 
  - HTML5 video muted 是必须的 (autoplay policy)
  - 调试 WebView 加载问题必须看 logcat, 不能只从 console.log 推断
  - 蓝叠 Nougat64 + 任何用 androidx.window.* 的 RN 库都不兼容

### BUG-053 (S60 P3): react-native-video 6.7.0 替代 WebView (终态修法)
- **现象**: BUG-049/050/051/052 反复修 WebView 后仍不工作, 需要根本替换方案
- **根因**: RN WebView 13.x 的 androidx.window.extensions 依赖在 Android 7 上不可用, HTML5 video 元素没法正常加载 (即使禁 JS 注入, WebView 内部 video 元素也可能因为 chromium 系统版本老旧出其他问题)
- **修法**:
  - `npm install react-native-video@6.7.0 --legacy-peer-deps` (Android 5+ 全兼容, 用 Android 原生 MediaPlayer/ExoPlayer)
  - VideoPlayer 重写: `<Video source={{uri: src}} controls paused={false} resizeMode="contain" poster={poster} onError={fallback} onLoad={log}/>`
  - 不再用 WebView, 移除 `react-native-webview` 包引用
- **文件**: `apps/mobile/src/screens/VideoAgentScreen.tsx:VideoPlayer`, `apps/mobile/package.json` (加 react-native-video@6.7.0)
- **验证**: 
  - 装 v3.0.24.4e APK (versionCode 31, 30MB 含 native lib)
  - 视频 tab 显示真视频 ✅ — 战士草地 5秒视频, 进度条 00:04/00:05, ⏸ 暂停按钮 (正在自动播放)
  - 生图 tab 主图区显示真图 ✅ — 古风绿衣仙子 1024x1024
- **教训**: 
  - **Android 7 (API 24) 旧设备不兼容 androidx.window.* / RN WebView 13.x / 任何用 Android 12+ 新 API 的 RN 包**
  - **首选 react-native-video / 原生播放器, 不依赖 WebView 渲染**
  - 诊断 RN WebView 视频/图片问题要先看 logcat, 找 ClassNotFoundException, 不要从表面现象推断根因

---

## S60 P3 总结

| 维度 | BUG-049/051/052 (v3.0.24.4b/c/d 失败) | BUG-053 终态 (v3.0.24.4e) |
|---|---|---|
| 视频播放 | WebView + HTML5 video 空 poster | react-native-video 原生播放器 ✅ |
| 图片显示 | 外网 HTTPS 蓝叠 Android 7 失败 | server inline proxy 走 ab.maque.uno 同源 ✅ |
| UI 重设计 | (跟 BUG-050 同步修) | 汉堡 + 状态徽章 + 大新建 + 单条删除 ✅ |
| race condition | (BUG-050) | userInitiated flag 修 ✅ |
| APK 大小 | 26MB | 30MB (+4MB react-native-video native lib) |
| versionCode | 27→30 (失败) | **31 (OK)** |

**APK**: `https://ab.maque.uno/app/DeepScript_v3.0.24.apk` (待 push 新 APK)
