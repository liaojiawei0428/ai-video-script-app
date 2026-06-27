// APP 版本统一管理
// 发布新版本时只需修改此处 (跨端铁律 3: 8 处版本号同步, 见 VERSION_MANAGEMENT.md § 5)
//
// 修改流程:
//   1. 改本文件 APP_VERSION = 'X.Y.Z'
//   2. 同步 8 处: mobile build.gradle (versionName + versionCode), server package.json,
//      server src/index.ts fallback, server ecosystem.config.js (env + env_production 2 处),
//      web src/config/version.ts (APP_VERSION + APP_VERSION_CODE),
//      apps/server/changelog.json (加新版本 entry),
//      apps/server/.env + /etc/systemd/system/shipin-app.service (deploy.sh 自动同步)
//   3. 跑 node tools/verify-version-8-points.js 本地 + 远程自检
//   4. commit message 必带版本号 (铁律 6): `vX.Y.Z: <改动> (BUG-NNN)`
//   5. 部署 + 12 维验证 (BAOTA_NODE_PROJECT_DEPLOY.md § 2.3)

export const APP_VERSION = '3.0.46';

// v3.0.41 (S72 batch 7 BUG-105 mobile sync): 移植 web characterUtils.ts 到 mobile utils, 3 个 screen 改用统一 utils, 兼容 server v3.0.40 Markdown 自由文本格式
//   - 修法: 跟 web apps/web/src/lib/characterUtils.ts v2.5.34 1:1 对齐 (除 getRoleLabel/getRoleColor — mobile 端用 theme/character.ts)
//   - 修法: 4 种 description 格式兼容 (自由文本字符串 / 11 字段 JSON 对象 / JSON 字符串 / 双层 JSON 字符串)
//   - 修法: summaryOf 跳 markdown 标题/列表项, 取第一段正文
//   - BUG-097 mobile 漏修 web 同源历史欠账 (mobile v3.0.29 UI redesign 时漏 web 端配套)
//   - 配套: 6 处版本号同步 3.0.39 → 3.0.41, rebuild APK, 端到端 mobile 实测

// v3.0.36 (S72 batch 6): BUG-088 + BUG-089 修法
//   - BUG-088: Dialog 组件改用 RN Modal 包装 (历史侧栏遮挡 + 删除不生效)
//   - BUG-089: 拆 loadHistory 为 refreshHistory (生成成功不立刻显示 race condition)
//   - polling 完成 alert 关闭后强制 scrollToEnd 200ms
// v3.0.35 (S72 batch 5 BUG-087): APP 内"无限发现新版本"修法
//   - 修 version.ts 多行 (之前 1 行 comment + exports on same line, tsc 报 'is not a module',
//     运行时 APP_VERSION = undefined, fetch 发 ?version=undefined, server compareVersions 返 1
//     → needUpdate=true → 每次冷启动都弹)
//   - 新增 db/updateMemory.ts (RNFS 24h 抑制, 老用户取消过的版本不再弹)
//   - showUpdateDialog 加 forceUpdate 优先级 + 取消按钮写 memory + 下载按钮不写
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
