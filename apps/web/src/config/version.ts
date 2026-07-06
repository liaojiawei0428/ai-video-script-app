// apps/web/src/config/version.ts
// v3.0.31 (S64): web 端版本号单一来源 (�?mobile �?src/config/version.ts 对齐)
// v3.0.29 hotfix: 重写干净�?(S71 部署发现旧文�?PS 5.1 写入丢失所有换行符, tsc �?TS2306 is not a module)
// 修法: Write 工具强制�?\n, 不用 PS 5.1 写入
// 配套规范:
// - VERSION_MANAGEMENT.md § 3 单一来源原则
// - BUGS.md BUG-067 (web 端硬编码版本�?
// - BUG-079 S71 后置: web version.ts PS 5.1 写入�?newline 导致 tsc -b 编译�?
// - CODING_STANDARDS.md § 31 �?(web/mobile/server 各自维护 version.ts, 不要跨端 shared)
export const APP_VERSION = '3.0.90';
export const APP_VERSION_CODE = 92; // 跟 mobile android/app/build.gradle versionCode 同步 (v3.0.90 BUG-167 web 视频点击播放: 修 key={proxyUrl} Date.now() 实战盲点 + djb2 stable filename 跟 BUG-143 1:1 镜像)
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
export const APP_BUILD_DATE = '2026-07-03';
