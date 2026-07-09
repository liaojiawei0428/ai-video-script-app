// apps/mobile/src/config/version.ts
// APP 唯一版本号来源, 跟 server package.json + build.gradle (versionName + versionCode) + web src/config/version.ts
// 同步逻辑详见 docs/VERSION_MANAGEMENT.md § 5
//
// 发版规范 (跨端铁律 3, 必走):
//   1. 仅在此文件改 APP_VERSION = 'X.Y.Z'
//   2. 同步改 8 处: mobile build.gradle (versionName + versionCode), server package.json,
//      server src/index.ts fallback, server ecosystem.config.js (env + env_production 2 处),
//      web src/config/version.ts (APP_VERSION + APP_VERSION_CODE),
//      apps/server/changelog.json (顶层 latest_version 字段 + prepend 新 entry),
//      apps/server/.env + /etc/systemd/system/shipin-app.service (deploy.sh 同步)
//   3. 跑 node tools/verify-version-8-points.js 验证本地 6 + 远程 2
//   4. commit message 必带版本号 (跨端铁律 6): `vX.Y.Z: <description> (BUG-NNN)`
//   5. 部署后跑 12 维验证 (BAOTA_NODE_PROJECT_DEPLOY.md § 2.3)

export const APP_VERSION = '3.0.112';

// v3.0.62 (BUG-131 S72 batch 31): 解决 公网 APK 跟 server-side 进程版本错位问题.
//   - 修前: /api/version downloadUrl 用 `DeepScript_v${process.env.APP_VERSION}.apk`, server-only hotfix (3.0.61) 改了 server 版本
//     但没 rebuild APK (3.0.60), 公网 APK 404 HTML 返 Status Code 16.
//   - 修法: 引入 apkVersion.ts 服务, 扫 /www/wwwroot/shipin-APP/public/DeepScript_v*.apk 取 max version 当
//     mobileLatestApkVersion, /api/version 同时返 version + downloadUrl (二者一致, 跟 shipin-app 实战同步:
//     server bump 必 rebuild APK, BUG-117 实战修订: deploy.sh 必加 APK cp + 公网 HEAD 验证)
//   - 配套: server 端 services/apkVersion.ts + mobile updater catch 处理 Status Code 16/404 fallback,
//     8 处版本号同步 3.0.61 → 3.0.62 + 公网 APK 校验 (BUG-117 公网 APK 404 教训)

// v3.0.61 (BUG-130 hotfix 2): server 修 imageAgentService.ts plan.data 加 refImageCount 字段 (跟 videoAgentService 1:1, BUG-128 修法补漏).
//   - 修前: plan.refImageUrls=[1个 URL] 但 plan.refImageCount=0, 不一致 (BUG-079 假报告根因).
//   - 修法: refUrlsAccum.length 写入 plan.data + DB plan 2 处同步.
//   - 8 处版本号同步 3.0.60 → 3.0.61, server-only hotfix (mobile/web 0 业务变化, 但 APK 必重打配套 BUG-131).

// v3.0.60 (BUG-130 hotfix): mobile 把 react-native-image-picker 换回 react-native-document-picker.
//   - 修前: document-picker v9.3.1 Android 走 Intent.ACTION_GET_CONTENT, Android 9 模拟器 (无 Google Play Services) 显示弹错 dialog.
//   - 修法: 改用 react-native-image-picker v7.2.3 + 升级 pickAndUploadImages 走 launchImageLibrary (系统 photo picker).
//   - 教训: mobile 端选型不能光看文档, 0 加重 + API 兼容性实战 → 装包前必查国产 ROM 兼容 (跨项目通用铁律 #34).
//   - 8 处版本号同步 3.0.59 → 3.0.60 (跨端铁律 3).

// v3.0.59 (BUG-130): mobile 端生图/视频助手补"上传参考图"功能, 跟 web 1:1 镜像.
//   - 跟 web 端 AgentChatPanel 1:1 镜像, 修 S72 batch 7 web→mobile 同步漏修 (1+ 年).
//   - 加 uploadAgentReferenceApi (XHR + FormData 跟 web uploadAgentReferenceApi 1:1).
//   - 加 pickAndUploadImages (react-native-document-picker.types.images, 4 张上限 + 立即显示本地预览).
//   - pendingRefs state (4 张上限 + 缩略图预览 + spinner + 失败重试, 跟 web 1:1).
//   - send() 拼 image role='reference' parts + text 一起发 server chat API.
//   - ImageAgentScreen + VideoAgentScreen 1:1 镜像 (跨端铁律 4++).
//   - 8 处版本号同步 3.0.58 → 3.0.59, rebuild APK.

// v3.0.41 (S72 batch 7 BUG-105 mobile sync): 同步 web characterUtils.ts 到 mobile utils, 3 处 screen 改 import.
//   - 跟 web apps/web/src/lib/characterUtils.ts v2.5.34 1:1 同步 (getRoleLabel/getRoleColor 跟 mobile theme/character.ts).
//   - 修 4 处 description 字段不匹配问题 (跟 server v3.0.40 Markdown 修法配套).
//   - 修 summaryOf 跟 markdown 渲染问题.
//   - BUG-097 mobile 漏修 web 教训: 跨项目通用铁律 4++ web → mobile 同步必做 (跨项目通用铁律 #1).
//   - 6 处版本号同步 3.0.39 → 3.0.41, rebuild APK.

// v3.0.36 (S72 batch 6): BUG-088 + BUG-089 修法.
//   - BUG-088: Dialog 组件从 RN Modal 换 react-native 原生 Dialog, 兼容国产 ROM.
//   - BUG-089: 拆 loadHistory → refreshHistory (避免 race condition).
//   - polling 终态 alert 关闭后 scrollToEnd 200ms.
// v3.0.35 (S72 batch 5 BUG-087): APP 端强制升级铁律落地.
//   - 修 version.ts 注释格式 (原导出跟注释一行, tsc 报 'is not a module').
//   - 删 db/updateMemory.ts (RNFS 24h 抑制, BUG-165 实战删).
//   - showUpdateDialog 加 forceUpdate 字段 + 写 memory + 显示按钮.

// v3.0.92 BUG-171 修: APP_NAME 还原用户原始意图 'Deep剧本' (GB2312 一级字 U+5267 U+672C).
//   修前: APP_NAME 含 6 个生僻字, 不在 GB2312 一级字库 (2K 常用字), 蓝叠/国产 ROM 字体不支持 → 兜底成 emoji (🐠) 或豆腐块.
//   推测根因: 之前某次 PowerShell 写入工具 ANSI/UTF-8 编码错 (跟 BUG-131 PowerShell 写 BOM 教训同源).
//   修后: 2 个 GB2312 一级字, 100% 国产 ROM 兼容, 跨端铁律 4++ 1:1 镜像 web 端 version.ts:12 已有的正确字符.
//   跨项目通用铁律 #29 (跟 BUG-131/145 v3.0.76 部署踩坑 100% 同源).
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;