// apps/web/src/config/version.ts
//
// v3.0.29 (S64): web 端版本号单一来源 (跟 mobile 端 src/config/version.ts 对齐)
//
// 之前 web 端 Layout.tsx:44 / AboutPage.tsx:7-8 / DownloadPage.tsx:41-42 三处硬编码 v3.0.0,
// 跟 server /api/version 实际返回的 3.0.29 不一致, 用户看到 "v3.0.0" 但 APK 已经是 3.0.29
// (BUG-067)。
//
// 修法: 单一来源 + 默认 fallback 写当前实际版本, 真实运行时优先用 server /api/version 返回值
// (DownloadPage.tsx 已经 fetch 后 setState)
//
// 配套规范:
// - VERSION_MANAGEMENT.md § 3 单一来源原则
// - BUGS.md BUG-067 (web 端硬编码版本号)
// - CODING_STANDARDS.md 第 31 条 (web/mobile/server 各自维护 version.ts, 不要跨端 shared)

export const APP_VERSION = '3.0.29';
export const APP_VERSION_CODE = 36; // 跟 mobile android/app/build.gradle versionCode 同步
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
export const APP_BUILD_DATE = '2026-06-24';
