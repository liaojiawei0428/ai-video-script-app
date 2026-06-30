// APP 版本统一管理
// 发布新版本时只需修改此处 (跨端铁律 3: 8 处版本号同步, �?VERSION_MANAGEMENT.md § 5)
//
// 修改流程:
//   1. 改本文件 APP_VERSION = 'X.Y.Z'
//   2. 同步 8 �? mobile build.gradle (versionName + versionCode), server package.json,
//      server src/index.ts fallback, server ecosystem.config.js (env + env_production 2 �?,
//      web src/config/version.ts (APP_VERSION + APP_VERSION_CODE),
//      apps/server/changelog.json (加新版本 entry),
//      apps/server/.env + /etc/systemd/system/shipin-app.service (deploy.sh 自动同步)
//   3. �?node tools/verify-version-8-points.js 本地 + 远程自检
//   4. commit message 必带版本�?(铁律 6): `vX.Y.Z: <改动> (BUG-NNN)`
//   5. 部署 + 12 维验�?(BAOTA_NODE_PROJECT_DEPLOY.md § 2.3)

export const APP_VERSION = '3.0.61';

// v3.0.61 (BUG-130 hotfix 2): server 端 imageAgentService.ts plan.data 补 refImageCount 字段 (跟 videoAgentService 1:1, BUG-128 文档跟代码不一致 假修)
//   - 修前: plan.refImageUrls=[1个URL] 但 plan.refImageCount=0, 跨端 1:1 镜像不一致, 跟 BUG-079 假报告同源
//   - 修法: refUrlsAccum.length 自动算, plan.data 跟 DB plan 2 处同步设
//   - 配套: 8 处版本号同步 3.0.60 → 3.0.61, server 端代码改动 (mobile/web 无业务变化, APK 不用重打)

// v3.0.60 (BUG-130 hotfix): mobile 端改用 react-native-image-picker 替代 document-picker
//   - 修前: document-picker v9.3.1 Android 端用 Intent.ACTION_GET_CONTENT, Android 9 模拟器(没 Google Play Services) 弹空 dialog
//   - 修法: 装 react-native-image-picker v7.2.3 + 改 pickAndUploadImages 调用 launchImageLibrary (走系统 photo picker)
//   - 影响: mobile 端代码 0 业务逻辑变化, 仅 picker 库替换, 行为完全一致
//   - 配套: 8 处版本号同步 3.0.59 → 3.0.60 (跨端铁律 3)

// v3.0.59 (BUG-130): mobile 端生图/视频助手补"上传参考图"功能
//   - 跟 web 端 AgentChatPanel 1:1 镜像, 补 S72 batch 7 web→mobile 同步漏修
//   - 新加 uploadAgentReferenceApi (XHR + FormData 跟 web uploadAgentReferenceApi 1:1)
//   - 新加 pickAndUploadImages (react-native-document-picker.types.images, 不用装新包不用新权限)
//   - pendingRefs state (4 张上限, 缩略图 + 上传中 spinner + 删除按钮, 跟 web 1:1)
//   - send() 把 image role='reference' parts 跟 text 一起发给 server chat API
//   - ImageAgentScreen + VideoAgentScreen 1:1 镜像 (跨端铁律 4++)
//   - 8 处版本号同步 3.0.58 → 3.0.59, rebuild APK, 端到端实测

// v3.0.41 (S72 batch 7 BUG-105 mobile sync): 移植 web characterUtils.ts �?mobile utils, 3 �?screen 改用统一 utils, 兼容 server v3.0.40 Markdown 自由文本格式
//   - 修法: �?web apps/web/src/lib/characterUtils.ts v2.5.34 1:1 对齐 (�?getRoleLabel/getRoleColor �?mobile 端用 theme/character.ts)
//   - 修法: 4 �?description 格式兼容 (自由文本字符�?/ 11 字段 JSON 对象 / JSON 字符�?/ 双层 JSON 字符�?
//   - 修法: summaryOf �?markdown 标题/列表�? 取第一段正�?
//   - BUG-097 mobile 漏修 web 同源历史欠账 (mobile v3.0.29 UI redesign 时漏 web 端配�?
//   - 配套: 6 处版本号同步 3.0.39 �?3.0.41, rebuild APK, 端到�?mobile 实测

// v3.0.36 (S72 batch 6): BUG-088 + BUG-089 修法
//   - BUG-088: Dialog 组件改用 RN Modal 包装 (历史侧栏遮挡 + 删除不生�?
//   - BUG-089: �?loadHistory �?refreshHistory (生成成功不立刻显�?race condition)
//   - polling 完成 alert 关闭后强�?scrollToEnd 200ms
// v3.0.35 (S72 batch 5 BUG-087): APP �?无限发现新版�?修法
//   - �?version.ts 多行 (之前 1 �?comment + exports on same line, tsc �?'is not a module',
//     运行�?APP_VERSION = undefined, fetch �??version=undefined, server compareVersions �?1
//     �?needUpdate=true �?每次冷启动都�?
//   - 新增 db/updateMemory.ts (RNFS 24h 抑制, 老用户取消过的版本不再弹)
//   - showUpdateDialog �?forceUpdate 优先�?+ 取消按钮�?memory + 下载按钮不写
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
