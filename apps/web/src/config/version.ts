// apps/web/src/config/version.ts
// v3.0.31 (S64): web 端版本号单一来源 (�?mobile �?src/config/version.ts 对齐)
// v3.0.29 hotfix: 重写干净�?(S71 部署发现旧文�?PS 5.1 写入丢失所有换行符, tsc �?TS2306 is not a module)
// 修法: Write 工具强制�?\n, 不用 PS 5.1 写入
// 配套规范:
// - VERSION_MANAGEMENT.md § 3 单一来源原则
// - BUGS.md BUG-067 (web 端硬编码版本�?
// - BUG-079 S71 后置: web version.ts PS 5.1 写入�?newline 导致 tsc -b 编译�?
// - CODING_STANDARDS.md § 31 �?(web/mobile/server 各自维护 version.ts, 不要跨端 shared)
export const APP_VERSION = '3.0.105';
export const APP_VERSION_CODE = 106; // 跟 mobile android/app/build.gradle versionCode 同步 (v3.0.89 BUG-166 强制升级 modal 逃逸 + 公网下架老 APK), v3.0.96 BUG-172 实战盲点 3 修法: 加 console.log + 加 ForceUpdateModal 加 useState 替代 module-level state (跟 v3.0.88 实战盲点 加 module-level state + module-level 组件实例 + RN 0.73 Hermes 新架构兼容性问题)
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
export const APP_BUILD_DATE = '2026-07-08';
