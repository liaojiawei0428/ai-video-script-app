// apps/web/src/config/version.ts
// v3.0.31 (S64): web 端版本号单一来源 (跟 mobile 端 src/config/version.ts 对齐)
// v3.0.29 hotfix: 重写干净版 (S71 部署发现旧文件 PS 5.1 写入丢失所有换行符, tsc 报 TS2306 is not a module)
// 修法: Write 工具强制带 \n, 不用 PS 5.1 写入
// 配套规范:
// - VERSION_MANAGEMENT.md § 3 单一来源原则
// - BUGS.md BUG-067 (web 端硬编码版本号)
// - BUG-079 S71 后置: web version.ts PS 5.1 写入丢 newline 导致 tsc -b 编译挂
// - CODING_STANDARDS.md § 31 条 (web/mobile/server 各自维护 version.ts, 不要跨端 shared)
export const APP_VERSION = '3.0.46';
export const APP_VERSION_CODE = 50; // 跟 mobile android/app/build.gradle versionCode 同步 (3.0.44=48, 3.0.45=49, 3.0.46=50)
export const APP_NAME = 'Deep\u5267\u672c';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
export const APP_BUILD_DATE = '2026-06-26';
