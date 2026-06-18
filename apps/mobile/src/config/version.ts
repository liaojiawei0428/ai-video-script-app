// APP版本统一管理
// 发布新版本时只需修改此处
// v3.0.22 (S58 P10 P2): 修 BUG-026 authorities=${applicationId}.provider 跟 blob-util 内部匹配
// 之前 .fileprovider 不匹配, FileProvider.getUriForFile 抛 IllegalArgumentException, actionViewIntent 静默失败
export const APP_VERSION = '3.0.24';
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
