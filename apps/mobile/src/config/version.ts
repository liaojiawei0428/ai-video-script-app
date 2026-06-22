// APP版本统一管理
// 发布新版本时只需修改此处
// v3.0.22 (S58 P10 P2): 修 BUG-026 authorities=${applicationId}.provider 让 blob-util 内部匹配
// v3.0.25 (S61 v2): bump version 配合 server 端 S61 v2 (LLM prompt 优化 + 分镜模式), 配套 APK rebuild
export const APP_VERSION = '3.0.25';
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
