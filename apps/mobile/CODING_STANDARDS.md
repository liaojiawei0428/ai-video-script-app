# Deep剧本 Mobile — 代码规范 + BUG 记录强制流程

> **本文件管两类事**:
> 1. **代码规范** — 写代码前/中/后, 必遵守的硬性规则 (避免犯历史 BUG)
> 2. **BUG 记录强制流程** — 修完 BUG (或用户明确指出修完) **必追加 BUGS.md 条目**, 不可遗漏
>
> 跟 [`BUGS.md`](./BUGS.md) 配套: BUGS.md 记**历史案例 + 根因**, 本文件记**当下要遵守的规则**。

---

# 第一部分: 代码规范 (硬性规则)

> 这些是从 S58 期间 8 个 BUG 提炼出来的硬性规则。**新 AI / 旧 AI 改 mobile 代码前, 必读 + 必遵守**。

## 1. ES6 import vs require

- ✅ Tab / Dynamic component 引用, **永远用 ES6 `import { X } from '...'`**
- ❌ **禁止** `require('./path').default` — 90% 情况是 named export, `.default` 返 `undefined`, React 渲染空白不报错 (BUG-004)
- ✅ 写之前 `grep -n "export function X" <file>` 确认导出形式 (named / default)

## 2. monorepo shared 包 import

- ✅ 从 `@ai-script/shared-types` / `@ai-script/shared-utils` **只 import type** (TS type only, runtime 删除 — 安全)
- ❌ **禁止** import value (常量/函数) — 该包当前**只放 type, 无数值导出** (BUG-005 真凶)
- ✅ 真源都在 `apps/server/src/shared/` 下, 移动端要 value 必:
  - 要么 inline local const (小数据)
  - 要么 `apiClient.get('/xxx')` 调 server 接口 (大数据, 跟 web 端一致)
- ✅ 写之前 `grep -n "export " packages/shared-types/src/index.ts` 确认**真有 export**

## 3. 字段定义 (不要臆造)

- ✅ 用 `obj.X` 字段前, **必查真源数据结构** (`apps/server/src/shared/`)
- ❌ 禁止臆造字段 (BUG-005: `STYLE_PRESETS` 用了 `p.emoji`, server 根本没这字段)
- ✅ 拿不准时, 用 `(obj as any).X` + 兜底 `|| defaultValue`

## 4. 外部函数引用 (必查 export) ⚠️ S58 期间已犯 3 次

- ✅ `import { X } from '../api/client'` 之前, 必 `grep -n "export.*X" client.ts` 确认
- ❌ 禁止"看名字觉得有就 import"
- ✅ 拿不准的函数, 写 inline 或调 server 接口 (`apiClient.get('/path')`)
- ⚠️ **历史命中 (同根因)**:
  - BUG-005: `estimateFee` 调了 TypeError 闪退
  - BUG-005: `STYLE_PRESETS` 从 monorepo 拿了 undefined 闪退
  - BUG-009: `listCharactersByNovel` 未导出 → undefined 报错 → 列表空白
- ✅ **预防**: 写 screen 之前, 必 `cat src/api/client.ts | grep "export"` 列所有可用函数, 跟 screen import 对一遍
- ✅ **预防 (升级版)**: 写完 screen 必跑 `npx tsc --noEmit` (或 IDE auto-import 提示) 验类型, TS 会报 "Module has no exported member 'X'"

## 5. Android namespace / MainApplication

- ✅ 改 `applicationId` / `namespace` 前, 必查 `AndroidManifest.xml` 引的 `.XxxXxx` 类是否在对应 `java/com/<namespace>/` 路径下
- ✅ 改完打 release APK, 必跑 `aapt2 dump badging app-release.apk | grep launchable-activity` — 必须返 `name='com.<namespace>.MainActivity'`, 不是空
- ✅ 看 build log `:app:compileReleaseKotlin` 是不是 `NO-SOURCE` — 是的话说明没 Kotlin 源, 必有 MainApplication 缺失问题 (BUG-001)

## 6. Hermes 引擎

- ✅ 永远保持 `hermesEnabled=true` (RN 0.71+ 默认, 别瞎改 false)
- ❌ 禁止碰 `android.disableCheckAarMetadata=true` (绕过 AAR 元数据检查会导致 runtime 崩)
- ✅ 改完打 APK, 必解压看 `assets/index.android.bundle` 前 16 字节:
  - `C6 1F BC 03 C1 03 19 1F ...` = Hermes bytecode ✓
  - 任何其他 = 走 JSC, 必挂 (BUG-002)

## 7. Android 依赖版本

- ✅ `androidx.core` 跟 `compileSdk` 配套 (当前: `compileSdk 33` + `androidx.core 1.10.1`, 不要混)
- ✅ 升 compileSdk 时, 同步检查 `androidx.core` 是否兼容, 不兼容就降 androidx.core

## 8. APK 部署 (shipin-APP)

- ✅ shipin-APP `public/` 上保留**所有历史 APK** 做回滚 (命名 `DeepScript_v<ver>_<label>.apk.bak`)
- ✅ nginx `location ^~ /app/ { alias /www/wwwroot/shipin-APP/public/; }` 自动同步公网
- ✅ 部署新版本:
  1. 上传到 `shipin-APP/public/DeepScript_v<newVer>.apk`
  2. **同时**覆盖 `DeepScript_v<oldVer>.apk` (公网 + 任何 web download 路径都拿到新版)
- ✅ 上传完必 `sha256sum` 验本地 == 远端

## 9. Server 升级 (PM2)

- ✅ 升级 server env 永远走 `pm2 delete 0` + `pm2 start ecosystem.config.js`, 不用 `pm2 restart` (BUG-008)
- ✅ `pm2 start` 必在 `cd /www/wwwroot/shipin-APP` 之后跑, 否则相对路径 `./dist/index.js` 找不到
- ✅ 改完必 `pm2 env 0 | grep <KEY>` 验证 env 真生效

## 10. SSH / 部署基础

- ✅ **永远从 `~/.ssh/known_hosts` 拿真实 IP**, 不信 handoff 转写的数字 (BUG-003)
- ✅ 部署前先 `Test-NetConnection <ip> -Port 22` 验连通
- ✅ 别用 `cd <dir> && cmd` PS 模式, 用 `workdir` 参数

## 11. version 同步 (改 3 处)

- ✅ bump 版本必改 3 处:
  1. `mobile/src/config/version.ts` 的 `APP_VERSION`
  2. `mobile/android/app/build.gradle` 的 `versionCode` (++) + `versionName`
  3. `shipin-APP/ecosystem.config.js` 的 `env.APP_VERSION` + `env_production.APP_VERSION` (2 处) + PM2 reload
- ✅ 改完必验:
  - `pm2 env 0 | grep APP_VERSION` 返新值
  - 公网 `curl /api/version?version=<老版本>` 返 `needUpdate: true, forceUpdate: true`
  - APK `aapt2 dump badging` 返新 `versionCode` + `versionName`

## 12. 升级流程 (RNFS vs 浏览器)

- ✅ APP 内下载大文件, **优先 `Linking.openURL(url)` 走系统下载管理器** (Android Chrome 自带进度条 + 失败可重试)
- ❌ 不要光 `await RNFS.downloadFile().promise` 同步等 (BUG-007: 没 progress callback, 用户看不到进度, 体感"没反应")
- ✅ 用 `RNFS.downloadFile` 时, **必订阅 `progress` 事件** 给到 UI
- ✅ 升级弹窗 `cancelable: true`, 留"取消 / 换浏览器"路径

## 13. monorepo shared types 字段必查

- ✅ 任何 `import { X } from '@ai-script/shared-types'` 必先 `grep -n "export.*X" packages/shared-types/src/index.ts` 确认
- ✅ 字段对不上 server 真源时, 改用 `import type { X }` (type only) 或自己定义 local type

## 14. Native module 引用

- ✅ 用 `NativeModules.X` 前, 必 `grep "getName" X.java/X.kt` 确认 module 名字匹配
- ✅ MainApplication.kt 手动 register 老包名模块时 (autolink 不到的), 必 `packages.add(com.xxx.YyyPackage())`
- ✅ 装 APK 后用 logcat 看 `ReactNativeJS` 报 "Native module X is null" 来 debug

## 15. build.gradle / gradle.properties 修改

- ✅ 改 `gradle.properties` 关键值 (hermesEnabled, reactNativeArchitectures, newArchEnabled), **必在 BUGS.md 记录一行**
- ✅ 改 `build.gradle` 的 `versionCode` / `versionName` / 依赖版本, 必带 v.s 注释
- ✅ `compileSdk` 跟 `targetSdk` 跟 `minSdk` 改时, 必在 PR/commit message 列出影响

## 16. screen 跟 client.ts import/export 双向核对 (源自 BUG-009)

- ✅ 写完 `src/screens/XxxScreen.tsx` 必做:
  1. `cat src/api/client.ts | grep "export"` 列所有导出函数
  2. 跟 screen 里 `import { X } from '../api/client'` 双向核对
  3. 任何"screen 引了但 client.ts 没 export" 的函数 = 必修
- ✅ 不能"看 web 端 (`apps/web/src/hooks/`) 有这函数就 import" — mobile client.ts 是独立维护的
- ❌ 禁止 TypeScript 编译报 "Module has no exported member" 还 commit
- ✅ 写完跑 `npx tsc --noEmit` 验类型 (RN 项目配了 `tsconfig.json`, 0 配置即可跑)
- ⚠️ **S58 期间已犯 3 次** (BUG-005 estimateFee, BUG-005 STYLE_PRESETS, BUG-009 listCharactersByNovel) — 必须跑 TS check

## 17. server 返嵌套对象, mobile 必拿 `.字段` (源自 BUG-011)

- ✅ 写 screen 取 server 返数据, **必看 server controller 实际返的字段**:
  - `cat apps/server/src/controllers/XxxController.ts | grep "return success"` 找真源
  - 或 `curl -s -H "Authorization: Bearer X" http://server/api/path` 实测
- ❌ 禁止"按 web 端解构方式猜"或"想当然拿 data.data 当数组"
- ✅ server 返嵌套 (e.g. `{ characters, total }`) 必拿 `data.data?.characters`
- ⚠️ **S58 期间已犯 3 次** (BUG-005 / BUG-009 / BUG-011) — 写 screen 前**必看 server 真实结构**

## 18. APP 内下载大文件, 必用自定义 Modal 显进度 (源自 BUG-010)

- ✅ 大文件下载 (> 1MB) 用自定义 `<XxxProgressModal />` 组件 + RN `Modal` 始终可见
- ❌ 禁止只用 `Alert.alert` 弹窗 (弹窗一关, 进度 0 反馈)
- ✅ `RNFS.downloadFile` 的 `progress` callback **必接到 React state**, 不能只 console.log
- ✅ 大文件优先 `Linking.openURL(url)` 走系统下载管理器, 自带进度条 + 失败重试
- ⚠️ 弹窗内只能放文本 + 按钮, 不能嵌入自定义 UI (Alert 是 native dialog, 非 React 树)

## 19. React component 文件必用 .tsx 后缀 (源自 BUG-012)

- ✅ **任何包含 JSX 的文件, 必用 `.tsx` 后缀** (Babel 通过后缀判定 JSX 解析模式)
- ❌ 禁止在 `.ts` 文件里写 JSX — Babel 报 `<Xxx expected ","` (误导为类型错误, 实际是 JSX 解析失败)
- ✅ `import` 路径可不带后缀, RN 自动解析
- ⚠️ **排查时容易误导**: 错误信息 "expected ','" 不一定是语法错, **先检查文件后缀**
- ✅ 写新 screen / component 前, 先确认后缀是 `.tsx` (`src/screens/*.tsx`)

## 20. APP 内下载大文件, 必用系统级 DownloadManager (源自 BUG-021/022)

- ✅ **Android 下载大文件 (APK/视频/音频), 必用 `react-native-blob-util` 走系统 `DownloadManager`**
- ❌ 禁止用 `RNFS.downloadFile` 下载 APK 升级包 — RN 0.73 + RNFS 2.20 progress 回调不可靠, 应用被杀下载中断
- ✅ 标准写法:
  ```ts
  RNFetchBlob.config({
    addAndroidDownloads: {
      useDownloadManager: true,         // 关键: 系统 DownloadManager
      title: 'Deep剧本 v' + version,
      description: '下载完成后自动安装',
      mime: 'application/vnd.android.package-archive',
      mediaScannable: true,
      notification: true,               // 通知栏固定显示
      path: destPath,
    },
  }).fetch('GET', url);
  ```
- ✅ 装完调 `RNFetchBlob.android.actionViewIntent(path, mime)`, **不调** `Linking.openURL('file://...')` (走文件管理器)
- ✅ Android 13+ 升级按钮 click 时静默申请 `POST_NOTIFICATIONS` 权限, 不阻塞下载
- ✅ 升级链路测试**必卸老装新** — 老 APK 弹窗代码可能没 Modal
- ✅ **弹窗按钮数 = 弹窗代码版本指纹** (1 按钮=S58 P4 老, 3 按钮=S58 P6+ 新)
- ✅ 进度 UI **必用通知栏** (锁屏也能看到), 不能只靠应用内 Modal

## 21. release APK 必用永久 release.keystore, 禁止用 debug 签名 (源自 BUG-023)

- ✅ **release 打包必用 `signingConfigs.release`**, 永远不用 `signingConfig signingConfigs.debug`
- ✅ **release.keystore 永久保留**, 不允许重新生成 (重新生成 = 之前所有 APK 装不上)
- ✅ 当前 release.keystore 位置 (3 份备份):
  - `C:\Users\Administrator\.mavis\keystore\release.keystore` (跨项目永久备份)
  - `apps/mobile/android/app/release.keystore` (项目内, build.gradle 直接引用)
  - git 仓库 `.gitignore` 之外, **不进 git** (跟 Sentry / 微信开发者证书一样保护)
- ✅ 证书信息:
  - 别名 `release`, 密码 `deepscript2026`
  - DN `CN=DeepScript Release, O=shipin-APP, L=Shenzhen, ST=Guangdong, C=CN`
  - SHA1 `12:9B:10:88:97:A7:C2:E7:1C:6D:3B:8B:32:58:5C:F3:76:2B:CA:80`
  - SHA256 `E0:41:6C:83:79:A8:F4:60:8B:69:FC:41:24:A2:47:BC:9C:FA:49:4E:2D:FD:78:AC:95:E7:28:BF:B1:50:0F:8D`
  - 有效期 2026-06-16 → 2051-06-10 (25年)
- ✅ 验证 release APK 签名 (每版本必跑):
  ```bash
  apksigner verify -v app-release.apk
  apksigner verify --print-certs app-release.apk | grep "DN:"
  # 必须是 CN=DeepScript Release, O=shipin-APP, 不是 CN=Android Debug
  ```
- ❌ **禁止 `release { signingConfig signingConfigs.debug }`** (RN 0.73 默认模板的坑, 13 个版本用这个, 全部解析失败)
- ❌ **禁止用 `keytool -genkey` 重新生成 keystore** (新 keystore 跟老 APK 签名不匹配, 装不上)
- ✅ 升级测试**必卸老装新** (老 APK 签名 ≠ 新 APK 签名 = 装不上)

## 22. 试纸 / 新版本 APK 必重打包, 禁止 cp 旧包 (源自 BUG-024)

- ✅ **试纸 / 新版本 APK 必改 2 处 + 重打**:
  - `apps/mobile/src/config/version.ts` `APP_VERSION` 字串
  - `apps/mobile/android/app/build.gradle` `versionCode` + `versionName`
  - `cd apps/mobile/android && gradlew assembleRelease` (3-5 min 增量编译)
- ❌ **禁止用 `cp DeepScript_v3.0.12.apk DeepScript_v3.0.13.apk` 当试纸** — 试纸 APK 内部 versionName 仍是 3.0.12, 跟 server 3.0.13 不匹配 → 死循环弹窗
- ✅ 试纸 5 步流程 (5 min):
  1. 改 `version.ts` APP_VERSION (字串跟目标版本一致)
  2. 改 `build.gradle` versionCode (单调递增) + versionName (跟 APP_VERSION 一致)
  3. `gradlew assembleRelease` 重打 (3-5 min)
  4. `aapt2 dump badging app-release.apk` 看 versionName 跟 `version.ts` 一致
  5. scp 上传 + bump server APP_VERSION
- ✅ 死循环弹窗诊断 = `aapt2 dump badging apk versionName` ≠ server APP_VERSION → 100% 是 cp 旧包漏洞

## 23. actionViewIntent 装 APK 必用 _state.destPath, 不用 res.path() (源自 BUG-025)

- ✅ **`useDownloadManager: true` 时, `res.path()` 返回 blob-util 内部临时路径, 不是 DownloadManager 实际落地的真文件**
- ✅ **装 APK 必用 `_state.destPath` 拼 `file://` 协议**:
  ```ts
  const installPath = _state.destPath.startsWith('file://')
    ? _state.destPath
    : 'file://" + _state.destPath;
  RNFetchBlob.android.actionViewIntent(
    installPath,  // ← _state.destPath, 不是 res.path()
    'application/vnd.android.package-archive'
  );
  ```
- ❌ **禁止用 `RNFetchBlob.android.actionViewIntent(res.path(), mime)`** — `res.path()` 指错老文件
- ✅ `_state.destPath` = `${RNFS.DownloadDirectoryPath}/DeepScript_v${version}.apk` (跟 DownloadManager 实际落地一致)
- ✅ **统一**: 装 APK 函数 (download 完成回调 + Modal 立即安装按钮) 都用 `_state.destPath`
- ✅ 诊断: **自动装失败 + 手动通知栏点装成功 = 100% 是 `res.path()` 指错文件** (改 `destPath` 即修)

## 24. 永远只让 1 套升级 UI 代码存活 (源自 BUG-026)

- ✅ **永远只让 1 套升级 UI 代码存活** (弹窗 + Modal, 不要并存全屏页)
- ✅ **升级 UI 入口统一在 `updater.tsx`**: `showUpdateDialog` 弹 3 按钮 + `<UpdateProgressModal />` 渲染下载 Modal
- ❌ **禁止在 `App.tsx` 写"全屏升级页"** (黑底 + 立即更新按钮那种) — 抢先 return 吞了 `showUpdateDialog` 弹窗
- ❌ **禁止在 `App.tsx` import `Linking` 用作升级** (`Linking.openURL(updateUrl)` 走浏览器, 不能 APP 内下载) — 统一走 `Updater.start()` 调起 DownloadManager
- ✅ **App.tsx 升级相关 state** (`needUpdate / updateVersion / updateUrl`) 全部删, 只调 `showUpdateDialog(updateInfo)`
- ✅ 升级 UI 代码 review 时必查 `App.tsx` 跟 `updater.tsx` 两处, 看是否重复
- ✅ 诊断: 升级行为**真机跟 AVD 不一致** = 100% 是 `App.tsx` 有全屏升级页抢 return, 删 `App.tsx` 强制更新页 if 块

## 25. 主题对比度硬性 ≥ 4.5:1 (WCAG AA, 源自 BUG-061)

- ✅ **所有文字颜色在背景上的对比度必须 ≥ 4.5:1** (WCAG AA 最低线)
  - 文字 (≥ 18pt 正常) 用 `#F8FAFC` (12.6:1) 配 `#151525` bg, 没问题
  - 辅助文字 (12-13pt) 用 `#CBD5E1` (7.4:1) 配 bg, 没问题
  - placeholder 用 `#94A3B8` (4.5:1) 配 bg, 临界但合规
- ❌ **禁止用 `colors.text.tertiary` (#94A3B8) 配 `colors.bg.tertiary` (#1E1E35)** — 实测 4.36:1, **WCAG fail**
- ❌ **禁止 chip 文字用 `bg = color + '20'` (12.5% alpha) 凑** — 视觉上隐形, 必加 `border: color + '40'` (1px, 25% alpha) 辅助
- ✅ **写新 screen 前先列对比度表**, 跟背景色对一遍:
  ```
  bg.primary #0A0A14 → text.primary #F8FAFC (15.5:1) ✅
  bg.primary #0A0A14 → text.muted #CBD5E1 (10.5:1) ✅
  bg.secondary #151525 → text.body #E2E8F0 (12.0:1) ✅ (替代原 text.tertiary)
  bg.secondary #151525 → text.muted #CBD5E1 (8.0:1) ✅
  bg.tertiary #1E1E35 → text.subtle #94A3B8 (5.5:1) ✅
  ```
- ✅ **场景化 theme**: 角色库用 `src/theme/character.ts` (含 5 级文字 + 3 层 surface + role 配色), 不跟全局共用
- ✅ 商业化 UI 第一个验证项: **跑 WebAIM Contrast Checker** (https://webaim.org/resources/contrastchecker/) 对比度 ≥ 4.5:1

## 26. 禁止 emoji 当 UI icon, 用 react-native-vector-icons/Ionicons (源自 BUG-062)

- ❌ **禁止用 emoji 当 UI icon** (🏷/📛/📝/📖/✨/⏰/✅/❌ 等)
  - emoji 渲染依赖系统字体, 跨 Android 7/14, iOS 不一致
  - emoji 风格跟 shipin-APP 其他用 Ionicons 的 screen 不统一
  - 商业化 APP 看 emoji 像 "草稿原型", 跟 Notion/Linear 风格差几个档次
- ✅ **统一用 `react-native-vector-icons/Ionicons`** (package.json 已装, RN 0.73 默认支持)
  ```ts
  import Ionicons from 'react-native-vector-icons/Ionicons';
  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
  ```
- ✅ **跨 screen 一致**: shipin-APP 所有 icon 都用 Ionicons, 包括:
  - 角色类型: `flame/skull/shield/person` (主角/反派/配角/次要)
  - 状态: `hourglass-outline/create-outline/sync/image-outline/checkmark-circle`
  - 画风: `videocam-outline/flower-outline/rocket-outline/heart-outline/cube-outline`
  - 通用: `arrow-back/chevron-down/close/save/sparkles/sync/refresh/...`
- ⚠️ **允许保留字符 icon** (✓ ✕ ⚠) — Toast / Alert 内部 native 弹窗用, 跟 RN 自带风格一致
- ✅ 跟 BUG-050 (历史 chip emoji) 同根因, 写新 chip/badge/card 必先 grep `(🏷|📛|📝|📖|✨|⏰|✅|❌|🔍|💡)` 排查

## 27. mobile 改完必跑 tsc --noEmit 验证 (源自 BUG-063/064, S62 BUG-056 重申)

- ✅ **mobile 改完任何代码, 必跑 `tsc --noEmit` 验证** (RN 项目配了 `tsconfig.json`, 0 配置即可)
  ```bash
  cd apps/mobile
  node ../../node_modules/typescript/bin/tsc --noEmit 2>&1 | head -20
  ```
- ❌ **禁止只跑 `gradlew assembleRelease` 验证** — RN 0.73 + Metro 0.80 老 cache 兼容老 JSX 调用, **会隐藏 TS 类型错** (BUG-056 实证)
- ⚠️ **历史 BUG 同根因 (S58~S62 期间累积 76 个 tsc errors)**:
  - BUG-031/032 (S59): 缺 theme import 编译失败
  - BUG-056 (S62): `CharacterWithAssets` 类型未导出 silent fail
  - BUG-063 (S63): 9 个 `showToast('msg', 'error')` 老 2 参 API
  - BUG-064 (S63): 17 个 state `styles` 跟 StyleSheet 冲突
- ✅ **写新 screen / 重写旧 screen, 必跑 tsc 验自己改的部分 0 错** (老错不归本次, 记录在 BUGS.md)
- ✅ 跨端 API 重构 (Toast/Dialog/Sheet) 后, 必 audit 老调用点, 改完跑 tsc 验

## 28. 禁止 state 变量名用 `styles` (跟 StyleSheet 冲突, 源自 BUG-064)

- ❌ **禁止用 `styles` 当 state 变量名** (跟本地 `const styles = StyleSheet.create({...})` 冲突)
  ```ts
  // ❌ 错: styles 既当 state 又当 StyleSheet
  const [styles, setStyles] = useState<StylePreset[]>([]);
  // ...
  const styles = StyleSheet.create({...})  // TS 报错: 重复声明

  // ✅ 对: state 用语义化名字
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const styles = StyleSheet.create({...})
  ```
- ✅ **StyleSheet 变量名** 统一用 `styles` (RN 惯例, 跟 react-native 文档一致)
- ✅ **state 变量命名规范**:
  - 数据列表: `characters` / `episodes` / `novels` (跟 server 字段名一致)
  - 配置类: `stylePresets` / `userInfo` / `novelConfig`
  - 状态类: `loading` / `refreshing` / `extracting` / `backfilling`
  - 消息类: `errorMsg` / `backfillMsg` / `successMsg`
- ✅ 跟 BUG-031/032 (S59 缺 theme import 编译失败) 同根因 — 都是 "写完没 tsc 验证"

## 29. 写新依赖前必 grep package.json 验证 (源自 BUG-005/009/065)

- ✅ **写新组件用第三方包, 必先 `cat apps/mobile/package.json | grep "<package>"` 验证**
  - shipin-APP mobile 跟 web 栈不同, web 端有**不代表** mobile 有
  - web 端 Vite 项目用 `react-native-linear-gradient` 替代品 (web 用 CSS), 跟 mobile 完全不同
- ❌ **禁止"看 web 端有就以为 mobile 也有"** (跟 BUG-005 S58 mobile `STYLE_PRESETS` 从 monorepo 拿 undefined 同根因)
- ✅ **mobile 软依赖标准做法**: try-require 模式
  ```ts
  let RNLinearGradient: any = null;
  try {
    const mod = require('react-native-linear-gradient');
    RNLinearGradient = mod?.default || mod;
  } catch {
    RNLinearGradient = null;
  }
  // fallback: View 叠 3 段半透明色
  if (!RNLinearGradient) {
    return <View style={[styles.fallback, style]}>{children}</View>;
  }
  return <RNLinearGradient ...>{children}</RNLinearGradient>;
  ```
- ✅ **fallback 必"功能等价"**, 视觉上接近, 不能 throw 阻塞渲染
- ✅ shipin-APP mobile 当前**没装**的包 (S63 摸底):
  - `react-native-linear-gradient` — 角色库 hero 用 fallback View 渐变模拟
  - `react-native-svg` — 角色类型 icon 当前用 Ionicons (RN 0.73 自带), 后续若需复杂 SVG 再装
  - `lottie-react-native` — 状态生图动画当前用 ActivityIndicator, 后续若需骨架屏再装
  - 装新包前必 `cat package.json` + `cat android/app/build.gradle` 看是否需 Android 配置

## 30. server `package.json` version 跟 fallback 必同步当前版本 (源自 BUG-066)

- ✅ **改 server 版本必同步 2 处源码**:
  - `apps/server/package.json` `"version"` 字段 (给运维/包管理器看的"门面")
  - `apps/server/src/index.ts:68` fallback `process.env.APP_VERSION || '<当前版本>'`
- ❌ **禁止 fallback 写历史残留版本** (如 `'3.0.0-alpha'`), 即使生产 PM2 env 看起来对, 源码 fallback 是**最后防线**
- ⚠️ **隐藏风险**: env 不生效 (e.g. ecosystem.config.js 被覆盖 / 误删) → server /api/version 返 fallback → 客户端收到强制升级弹窗, 但 APK 实际没那个版本 → 死循环
- ✅ 改完后**双验证**:
  ```bash
  grep '"version"' apps/server/package.json          # 当前版本
  grep "process.env.APP_VERSION ||" apps/server/src/index.ts  # 当前版本
  curl /api/version                                   # 实际返当前版本
  ```
- ✅ 跨文件交叉引用: `docs/VERSION_MANAGEMENT.md` § 2.3

## 31. 跨端版本号必从单一来源读取, 禁止硬编码 (源自 BUG-067)

- ✅ **每个 app 必有自己的 `src/config/version.ts` 单一来源**:
  - `apps/mobile/src/config/version.ts` (S58 起就有)
  - `apps/web/src/config/version.ts` (S64 新建, 跟 mobile 同结构)
  - `apps/server/package.json` (server 端用 package.json version 字段)
- ❌ **禁止在 .tsx / .ts 里硬编码 `const APP_VERSION = '3.0.0'`**:
  - `apps/web/src/components/Layout.tsx:44` (修前硬编码 v3.0.0)
  - `apps/web/src/pages/AboutPage.tsx:7-8` (修前硬编码 v3.0.0 + 2026-06-13)
  - `apps/web/src/pages/DownloadPage.tsx:41-42` (修前硬编码 v3.0.0 fallback)
- ✅ 必用 import:
  ```tsx
  import { APP_VERSION, APP_BUILD_DATE } from '../config/version';
  // ...
  <span>v{APP_VERSION}</span>
  <p>v{APP_VERSION} · {APP_BUILD_DATE}</p>
  ```
- ✅ **fallback 默认值必跟当前版本一致**, 跟第 30 条同根因
- ❌ **禁止用 monorepo shared 包 import version** (跟 BUG-005/009 同根因: shared 包 import value 触发 Metro 编译坑)
- ✅ **changelog 严禁硬编码通用文案**, 必读 server `apps/server/changelog.json` 真实条目
- ✅ 跨文件交叉引用: `docs/VERSION_MANAGEMENT.md` § 3 单一来源原则

## 32. 跨 AI 协作必读 `docs/VERSION_MANAGEMENT.md` 规范文档 (源自 BUG-068)

- ✅ **任何 AI 改 shipin-APP 项目前必读 `docs/VERSION_MANAGEMENT.md`**:
  - § 1 版本号格式 (1/2/3 类 + 进位规则)
  - § 2 6 处版本号位置统一管理
  - § 3 单一来源原则
  - § 4 changelog 维护流程
  - § 5 发版 8 步 SOP + 5 维验证
  - § 6 失败诊断 (8 类)
  - § 7 AI Agent 必跑清单
- ✅ **触发条件 (满足任一, 必跑 § 7.1 - § 7.5)**:
  - 改了 `version.ts` / `build.gradle` / `package.json` / `ecosystem.config.js`
  - 加了新依赖 (npm i xxx)
  - 改了 server `/api/version` / `/api/notifications` / `/api/admin` 任一端点
  - 改了 mobile `utils/updater.tsx` (升级链路核心)
  - 改了 web `pages/DownloadPage.tsx` 或 `pages/AboutPage.tsx`
- ✅ **改完代码必跑 § 5.2 6 处版本号同步自检**:
  ```
  □ mobile src/config/version.ts APP_VERSION
  □ mobile build.gradle versionCode + versionName
  □ server package.json version
  □ server src/index.ts fallback
  □ web src/config/version.ts APP_VERSION
  □ changelog.json 追加当前版本条目
  ```
- ✅ **改完代码必跑 § 5.8 5 维验证** (公网 APK 200 / SHA256 一致 / /api/version 触发升级 / /download 页 Playwright / 历史 APK 未覆盖)
- ✅ **commit message 必带版本号**: `git commit -m "v3.0.30: <一句话描述> (BUG-NNN)"`
- ❌ **禁止依赖 PR 描述或聊天记录** — 必须有显式规范文档, 跨 AI 协作统一入口
- 配套: `apps/mobile/AGENTS.md` 引用本规范, AI 入口必读

## 33. 规范随版本迭代自更新 (源自 S65 STANDARDS_EVOLUTION.md)

- ✅ **任何 AI 触发版本变更 / 架构变更 / 重大 BUG 修复**前必读 [`../../docs/STANDARDS_EVOLUTION.md`](../../docs/STANDARDS_EVOLUTION.md):
  - § 1 现状盘点 (5 份规范有过时不一致问题)
  - § 2 触发条件 (7 类, 满足任一必跑 § 3 SOP)
  - § 3 修订流程 (5 步: 列出变更 → 判定 → 起草 → 自检 → commit)
  - § 4 规范时效性自检清单 (5 维 grep 检查)
  - § 5 规范文档责任矩阵
  - § 6 ADR (Architecture Decision Records) 实践
  - § 7 跨 AI 协作约定
- ✅ **关键架构 / 规范决策必写 ADR**, 路径 `docs/standards/ADR/<number>-<title>.md`:
  - 架构重大变更 (新 monorepo / 新部署平台)
  - 规范冲突决策 (5/6 维分工 / SSH key 持久化 vs mavis-trash)
  - 跨 AI 行为约定 (规范自迭代 SOP / 必读列表)
  - 技术选型 (Vite vs Next.js / monorepo 包)
  - 撤换核心依赖
- ✅ **ADR 6 个标准模块**: 状态/日期/决策者 + 背景 + 决策 + 影响(正/负/风险) + 一致性 + 替代方案 + 配套变更
- ✅ **规范修订后必做**:
  - 更新 `docs/VERSION_MANAGEMENT.md` § 9 索引表 (如适用)
  - 更新 `apps/mobile/AGENTS.md` 必读列表 (如适用)
  - commit message: `vX.Y.Z: <代码改动> (BUG-NNN + 规范修订)`
  - 加 DEV_PROGRESS.md AI 会话追踪行
- ❌ **禁止"代码改了规范没改"** — S65 自检发现 5 份规范有不同程度落后 (SSH key 矛盾 / URL 过时 / 跨端重复 / 5/6 维冲突 / 缺失 web DEPLOY.md)
- 配套文档: `docs/VERSION_MANAGEMENT.md` § 9.1 (跨端统一入口排序)

## 34. server APP_VERSION 6 处同步 (含 ecosystem.config.js, S66)

- ✅ **改 server 版本号必同步 6 处** (VERSION_MANAGEMENT § 2 + § 3.4):
  ```
  □ apps/mobile/src/config/version.ts APP_VERSION
  □ apps/mobile/android/app/build.gradle versionCode + versionName
  □ apps/server/package.json version
  □ apps/server/src/index.ts fallback
  □ apps/server/ecosystem.config.js env.APP_VERSION + env_production.APP_VERSION  ← S66 新增
  □ apps/web/src/config/version.ts APP_VERSION
  □ apps/server/changelog.json 当前版本条目
  ```
- ❌ **禁止漏 ecosystem.config.js** — S64 BUG-066 修了 5 处 (漏这第 6 处), 导致 APP_VERSION=3.0.26 跟实际 v3.0.29 不一致 (BUG-069, S66 修)
- ⚠️ **ecosystem.config.js 有 2 处 APP_VERSION** (env + env_production), 必同时改, 不能漏
- ✅ **部署后必跑**:
  ```bash
  pm2 env 0 | grep APP_VERSION         # 期望 = 当前发版版本
  curl /api/version | jq .data.version  # 期望 = 当前发版版本
  grep APP_VERSION apps/server/ecosystem.config.js  # 期望 = 2 处都同步
  ```
- 配套: `docs/PM2_GUIDE.md` § 4.3 (PM2 env 注入 + BUG-069 自检命令)

## 35. server env 变量管理 (强密钥 + 轮换, S66)

- ✅ **任何 AI 修改 `apps/server/.env` 前必读** [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md):
  - § 1 env 4 类分类 (基础 / 鉴权+DB / 第三方 Key / 可选)
  - § 2 强密钥生成 SOP (JWT_SECRET 256-bit / DEEPSEEK_API_KEYS 多 Key 池)
  - § 3 密钥轮换 SOP (SSH/JWT/DEEPSEEK/MYSQL/PAY/AGNES 6 类, 频率不同)
  - § 4 部署 env 4 条操作 (检查 / `>>` 追加 / 不覆盖 uploads / PM2 优先级)
  - § 5 .env 防泄露 (.gitignore / scp 加密 / git ls-files 检查 / 泄露事故响应)
  - § 6 APP_VERSION 6 处同步 (含 ecosystem.config.js)
  - § 7 常见问题 (JWT_SECRET 缺失 / MySQL 连不上 / DeepSeek 401/429 / Agnes 500 / 支付宝回调)
  - § 8 AI Agent 必跑 8 项 checklist
- ❌ **禁止 `> .env` 重写** — 只用 `>> .env` 追加, 永远保留其他变量
- ❌ **禁止 .env / .env.production 入 git** — `.gitignore` 必含
- ❌ **禁止明文传输 .env** — 必走 SSH 加密 (scp / rsync over ssh)
- ✅ **JWT_SECRET 必 ≥ 64 字符 (256-bit)** — 用 `openssl rand -hex 32` 生成
- ✅ **改了 JWT_SECRET 通知所有用户重新登录** — 所有 token 失效

## 36. server DB 迁移 SOP (兼容 + 不删字段, S66)

- ✅ **改 schema / 跑迁移前必读** [`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md):
  - § 1 迁移方式选型 (initTables() 自动 99% / 手动 SQL 1%)
  - § 2 增量迁移规范 (ADD 字段带 DEFAULT / 加表 / 加索引 / 改类型)
  - § 3 schema 版本管理 (changelog.json 加 schema 变更段)
  - § 4 跨版本回滚兼容性 (ADD 兼容 / DROP 不兼容)
  - § 5 部署时迁移流程 (initTables 自动 / 大表 pt-osc / 手动 SQL 关 server)
  - § 6 实战案例 (v1.2 → v2.0 / v2.0 → v2.5 / v3.0 schema 演进)
  - § 7 常见问题 (Duplicate column / Table 不存在 / 老数据 NULL / 跨版本回滚)
- ❌ **禁止 DROP COLUMN** — 用 `_deprecated_` 前缀 + 6 个月观察期后真删
- ❌ **禁止 ADD 字段不带 DEFAULT** — 老数据补默认值, 防业务代码 NULL 崩
- ❌ **禁止手工改生产 DB** — 必通过 initTables() 自动 / 手动 SQL 脚本
- ✅ **ALTER 必 try/catch** (initTables() 防字段重复添加)
- ✅ **不删表 / 不改字段名** (老代码引用会崩)
- ✅ **手动 SQL 迁移期间 server 必停** (shipin-APP 数据量小, 不需要 0 downtime)

## 37. PM2 + ecosystem.config.js 完整规范 (S66)

- ✅ **改 PM2 配置 / 进程操作前必读** [`../../docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md):
  - § 1 ecosystem.config.js 完整字段规范 (7 块: 基础 / 多实例 / env / 日志 / 重启 / 监控 / 高级)
  - § 2 fork vs cluster 模式选型 (shipin-APP 用 fork + instances: 1)
  - § 3 PM2 命令速查 10 条 (start / list / env / logs / reload / restart / delete / save)
  - § 4 env 注入优先级 (env_production > shell env > .env)
  - § 5 高级配置 (V8 内存 / graceful shutdown / Keymetrics)
  - § 6 常见问题 (一直重启 / 内存涨 / restart vs delete+start / 宝塔看不到 / status=errored)
  - § 7 AI Agent 必跑 8 项 checklist
- ❌ **禁止 `pm2 restart`** — 用 `pm2 delete + pm2 start` (BUG-008, restart 不重读 .env)
- ❌ **禁止 `pm2 restart --update-env`** — 部署时禁用, 会刷 PM2 持久 env
- ❌ **禁止 `watch: true`** — shipin-APP 是 dist/, 不是源代码, watch 无意义
- ✅ **`max_memory_restart: '1G'`** 防内存泄漏
- ✅ **部署后必 `pm2 env 0 | grep APP_VERSION`** 验证 env 生效
- ✅ **宝塔面板手动添加 `ai-script-server` 进程** — PM2 进程列表跟宝塔 PM2 管理器是两个独立服务

## 38. server 部署必先检查活跃任务 + 跑维护模式 (源自 BUG-070, S67)

- ✅ **任何 AI 接到 server 部署任务, 第一步必查活跃任务** (有用户在分析小说 / 生图 / 生视频时):
  ```bash
  COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
  ```
- ✅ **有活跃任务时必跑维护模式流程** (按 [`apps/server/AGENTS.md`](../../apps/server/AGENTS.md) § 部署前必跑 5 项):
  1. 查活跃任务 → 2. 发维护公告 → 3. 开维护模式 (`PUT /api/admin/maintenance?enable=true`) → 4. 等任务跑完 (最多 15 分钟) → 5. 部署 → 6. 关维护 + 发完成公告
- ❌ **禁止直接 `pm2 restart` 或 `pm2 delete + start` 而不跑维护模式** — 会打断用户正在跑的 LLM / Agnes 任务, **浪费 token 钱 + 用户体验崩 + 用户投诉**
- ✅ **维护模式只拒新任务, 不 kill 在跑任务** — controller (`characterController.ts:14` + `novelController.ts:12` 检查 `getMaintenance()`) 拒绝新任务, 但 setImmediate 跑着的 background 任务继续
- ❌ **禁止强制部署除非紧急** (安全补丁) — 强制部署 = 正在跑的任务被 kill, 用户已经扣的 token 钱白花, 必须先 PM admin 备案
- ✅ **AI 必读 [`apps/server/AGENTS.md`](../../apps/server/AGENTS.md) § 部署前必跑 5 项 + 5 类任务必做** — 这是 server 端 AI 入口, 跟 mobile AGENTS.md 对称
- ✅ **AI 必跑 [`apps/server/deploy.sh`](../../apps/server/deploy.sh)** — 远端部署脚本, 含完整 6 步维护模式流程
- ✅ **部署后必跑 6 维验证** (跟第 35 条 § 4 配套)
- 配套文档: `docs/VERSION_MANAGEMENT.md § 5.0 / § 5.A` (S67 新增), `docs/DEPLOY.md § 0 节点 0`

---

# 第二部分: BUG 记录强制流程 (硬性流程)

> **本节是你 (用户) 明确要求**: 每修复完成一个 BUG, 或是明确指出修复完成的 BUG, 都要严格执行记录。

## 触发条件 (满足任一, 必记录)

1. **AI 修完一个 BUG** (自己发现 + 自己修)
2. **用户明确指出"修好了"** 一个 BUG (用户测过, 确认 OK)
3. **AI 发现问题但留作"已知问题"** 暂时不修 — 也要记录 (在 BUGS.md 加一条 "未修, 原因: ...")
4. **AI 改了某个功能, 引入新 BUG** — 必记录 (这是为了警示"这地方改过, 别再瞎动")

## 记录位置

**全部 BUG 进 [`BUGS.md`](./BUGS.md)**, 用 `BUG-NNN` 编号 (NNN = 3 位数字, 递增)。

## 必填字段 (不可缺)

每个 BUG 条目必写:

```markdown
### BUG-NNN (Sxx Py): <一句话标题>

- **现象**: <用户视角看到什么>
- **真凶**: <代码层根因, 必给文件 + 行号>
- **修复**: <改了哪个文件, 改了什么>
- **怎么验证修好**: <具体步骤, 跑什么命令 / 装 APK 怎么测>
- **怎么避免再犯**: <硬性规则, 写进本文件第一部分对应编号>
```

## 记录时机 (不可延后)

- ✅ **修完代码, 验完能跑, 立刻追加 BUGS.md** — 不等用户说
- ✅ **不能"先记 TODO, 后面补"** — 必同 PR / 同 commit 一起提交
- ✅ **用户说"修好了" 也要追加** — 哪怕 AI 自己没意识到这是 BUG, 用户指出来了就必记

## 编号规范

- `BUG-001` `BUG-002` ... 顺序递增, 不重用, 不跳过
- commit message: `docs(mobile): BUGS.md 新增 BUG-NNN <一句话标题>`
- 写到 `BUGS.md` 的 "vX.Y.Z 修复历史" 段落下, 按时间倒序 (最新在最上)

## 自查清单 (AI 每次改完代码必跑)

- [ ] 我改的代码, 有没有触发已知的 15 条规范? (看第一部分)
- [ ] 改完跑 `gradlew assembleRelease` + `aapt2 dump badging` 验过 APK 吗?
- [ ] 如果修了一个 BUG, 必追加 BUGS.md 条目了吗?
- [ ] 如果**新引入**一个问题, 必追加 BUGS.md 条目了吗? (警示未来 AI)
- [ ] commit message 带 BUGS.md 变更了吗?

---

# 第三部分: 文档索引 (跟 BUGS.md 的边界)

| 文件 | 管什么 |
|---|---|
| **`BUGS.md`** | 历史 BUG 案例库 (8 条 + 防坑 8 类), 长期积累 |
| **`CODING_STANDARDS.md`** (本文件) | 当下硬性规范 + BUG 记录强制流程 |
| **`AGENTS.md`** | AI Agent 入口, 项目速览 |
| **`CLAUDE.md`** | Claude Code 入口, 跟 AGENTS.md 同内容 |
| `README.md` | 项目 README (在 mobile 仓根, 业务向, 跟代码规范无关) |

**关系**:
- AI 改代码前: **先读 AGENTS.md / CLAUDE.md** → 知道要读本文件
- AI 改代码中: **遵守本文件第一部分** (15 条规范)
- AI 改完代码: **触发本文件第二部分** (BUG 记录强制流程) → 追加 BUGS.md

---

# 第四部分: 文档维护规则

1. **本文件不可删, 不可改结构** — 改结构会让 AI 读不到
2. **第一部分规范条目只增不减** — 删条目 = 删防坑, 必留下 BUGS.md 历史
3. **新增规范条目流程**:
   - BUG 修完 → 提炼规则 → 加到第一部分对应类别
   - 用户口头提规范 → AI 立刻加, 不需要等 BUG
4. **本文件跟 BUGS.md 同步原则**:
   - BUGS.md 新增 BUG-NNN → 本文件**视情况**提炼新规范
   - 本文件新增规范 → BUGS.md **不需要** 新增 BUG, 但要在规范旁注 "源自 BUG-NNN"
5. **commit 节奏**:
   - 文档改动单独一个 commit: `docs(mobile): CODING_STANDARDS.md 新增第 N 条规范`
   - 跟代码改动一起时: `fix(mobile): 修 BUG-NNN (顺手更新规范)`

---

# 当前生效规则 (2026-06-24 v3.0.30)

| 类别 | 规范数 | 触发 BUG |
|---|---|---|
| ES6 import | 1 条 | BUG-004 |
| monorepo import | 2 条 | BUG-005 |
| 字段定义 | 1 条 | BUG-005 |
| 外部函数引用 | 1 条 (强化) | BUG-005, BUG-009 |
| Android namespace | 1 条 | BUG-001 |
| Hermes 引擎 | 1 条 | BUG-002 |
| Android 依赖版本 | 1 条 | BUG-002 |
| APK 部署 | 1 条 | (历史) |
| Server 升级 (PM2) | 1 条 | BUG-008 |
| SSH / 部署基础 | 1 条 | BUG-003 |
| version 同步 | 1 条 | (历史) |
| 升级流程 | 1 条 | BUG-007 |
| monorepo shared types 字段 | 1 条 | BUG-005 |
| Native module 引用 | 1 条 | (历史) |
| build.gradle / gradle.properties | 1 条 | (历史) |
| screen 跟 client.ts 双向核对 | 1 条 | BUG-009 |
| server 返嵌套对象必拿 .字段 | 1 条 | BUG-005, BUG-009, BUG-011 |
| APP 内下载必用自定义 Modal 进度 | 1 条 | BUG-010 |
| React component 必用 .tsx 后缀 | 1 条 | BUG-012 |
| release APK 必用永久 keystore | 1 条 | BUG-023 |
| 试纸 / 新版本 APK 必重打包 | 1 条 | BUG-024 |
| actionViewIntent 必用 _state.destPath | 1 条 | BUG-025 |
| 永远只让 1 套升级 UI 代码存活 | 1 条 | BUG-026 |
| 主题对比度硬性 ≥ 4.5:1 (WCAG AA) | 1 条 (新) | BUG-061 |
| 禁止 emoji 当 UI icon, 用 Ionicons | 1 条 (新) | BUG-062 |
| mobile 改完必跑 tsc --noEmit 验证 | 1 条 (新) | BUG-056, BUG-063, BUG-064 |
| 禁止 state 变量名用 `styles` (跟 StyleSheet 冲突) | 1 条 (新) | BUG-064 |
| 写新依赖前必 grep package.json 验证 | 1 条 (新) | BUG-005, BUG-009, BUG-065 |
| **server package.json version 跟 fallback 同步** | 1 条 (新, S64) | BUG-066 |
| **跨端版本号必单一来源 (禁硬编码)** | 1 条 (新, S64) | BUG-067 |
| **跨 AI 协作必读 VERSION_MANAGEMENT.md** | 1 条 (新, S64) | BUG-068 |
| **规范随版本迭代自更新 (STANDARDS_EVOLUTION.md)** | 1 条 (新, S65) | (S65 GAP 修复) |
| **server APP_VERSION 6 处同步 (含 ecosystem.config.js)** | 1 条 (新, S66) | BUG-069 |
| **server env 变量管理 (强密钥 + 轮换)** | 1 条 (新, S66) | (S66 GAP 修复) |
| **server DB 迁移 SOP (兼容 + 不删字段)** | 1 条 (新, S66) | (S66 GAP 修复) |
| **PM2 + ecosystem.config.js 完整规范** | 1 条 (新, S66) | (S66 GAP 修复) |
| **server 部署必先检查活跃任务 + 跑维护模式** | 1 条 (新, S67) | BUG-070 |
| **合计** | **38 条** | **21 个 BUG** |

下次新 BUG 修完, 必:
1. 追加 BUGS.md BUG-NNN 条目
2. **提炼新规范**加到本文件第一部分, 编号递增
3. commit message: `docs(mobile): CODING_STANDARDS.md 新增第 N 条 (源自 BUG-NNN)`
