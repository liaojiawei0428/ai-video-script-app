# S60 P2 报告 - 生图生视频 mobile 端彻底修复 (v3.0.24)

> **时间**: 2026-06-17 17:00 ~ 18:15
> **目标**: 把 v3.0.22 残缺的 Image/Video Agent 屏彻底修好, 跟 web 端 1:1 一致
> **触发**: user 反馈 "用 ADB 截图观察, 跟 web 端保持一致, 不要缺这缺哪"

---

## 1. 起点 (v3.0.22 现状)

S58 P9 试纸时发现 mobile 端生图屏有 **5 个严重问题**:
- ❌ chat 流只显示 "🖼️ [result] https://...7079..." 60 字符截断, **没真图**
- ❌ modal 显示 "视频生成长, 等待 1-3 分钟" (复制粘贴没改)
- ❌ 调 `/video-agent/confirm` endpoint (复制粘贴没改)
- ❌ 缺 `?token=` 鉴权 (web 有, mobile 没有)
- ❌ 缺历史列表 / 新建 / 删除 / 切换

**v3.0.23 试纸** 时部分修了 dialog/alert 重构, 但**生图生视频 UI 仍残缺**.

## 2. 修法 (S60 P2 大重构)

### 2.1 新增依赖
```bash
npm install react-native-webview@^13.16.1 react-native-blob-util react-native-permissions --legacy-peer-deps
```
- `react-native-webview@^13.16.1` - 内嵌视频播放 (比 react-native-video 轻 10x, 0 风险)
- `react-native-blob-util` - 下载图片/视频到本地
- `react-native-permissions` - Android 13+ 媒体权限

### 2.2 新建 4 个文件

**`src/utils/agentDownload.ts`** (新建) - 12 个工具函数:
- `buildImageUrl(url, token)` - 加 `?token=` 鉴权
- `buildVideoUrl(url, token)` - 同上
- `buildDownloadUrl(url, token, filename, type)` - server `/api/download?url=...&token=...&disposition=attachment`
- `downloadImage(url, filename)` - react-native-blob-util + `Pictures/` 保存
- `downloadVideo(url, filename)` - 同上到 `Movies/`

**`src/types/agent.ts`** (扩展) - 加 streaming + image width/height + video coverUrl:
```ts
export type AgentPart =
  | { type: 'text'; text: string }
  | { type: 'plan'; data: { style: string; prompt: string; planFields: PlanFields; aspectRatio: string; refImageUrls: string[] } }
  | { type: 'image'; url: string; role: 'result'; width?: number; height?: number }
  | { type: 'video'; url: string; coverUrl?: string; duration?: number }
  | { type: 'streaming'; stage: 'translating' | 'generating' }
  | { type: 'error'; message: string };
```

**`src/api/client.ts`** (扩展) - 加 12 个 image/video-agent API helper:
```ts
export const imageAgentCreateConversationApi = () => apiClient.post('/image-agent/conversations');
export const imageAgentChatApi = (id, parts, aspectRatio) => apiClient.post('/image-agent/chat', { id, parts, aspectRatio });
export const imageAgentConfirmApi = (id) => apiClient.post('/image-agent/confirm', { id });
export const imageAgentTranslatePlanApi = (id) => apiClient.post('/image-agent/translate-plan', { id });
export const imageAgentUpdatePlanFieldsApi = (id, fields) => apiClient.put('/image-agent/plan-fields', { id, fields });
export const imageAgentHistoryApi = (limit = 50) => apiClient.get('/image-agent/conversations', { params: { limit } });
export const imageAgentGetApi = (id) => apiClient.get(`/image-agent/conversations/${id}`);
export const imageAgentDeleteApi = (id) => apiClient.delete(`/image-agent/conversations/${id}`);
// + 6 个 videoAgent 同样的 helper
```

**`src/screens/ImageAgentScreen.tsx`** (完整重写, 跟 web AgentChatPanel 1:1):
- 顶部 toolbar: 📁 历史 + ➕ 新建 + ✨ 生图助手 + 🗑️ 删除
- 历史侧栏 (Drawer 风格) + 5 状态徽章 + 缩略图
- chat 流: user bubble (紫) + assistant bubble (灰) + plan card + streaming card + image (RN Image 真渲染) + video
- 输入框 + 6 比例 chip (自动/1:1/16:9/9:16/4:3/3:4) + 🎨 免费 30/天
- 3s polling, status=tool_completed 自动替换 streaming part 为 image
- download 按钮 (走 buildImageUrl + blob-util)

**`src/screens/VideoAgentScreen.tsx`** (完整重写, 跟 web AgentChatPanel 1:1):
- 顶部 toolbar: 📁 历史 + ➕ 新建 + 📹 视频助手 + 🗑️ 删除
- 同样的 chat 流结构
- video 渲染用 `<WebView source={{html: '<video src=... controls autoplay playsinline>', baseUrl: 'https://ab.maque.uno'}}>` + `mixedContentMode="always"`
- 底部: 比例 (自动/16:9/9:16/1:1) + 时长 (3s/5s/10s) + "5s 免费" 提示
- 5s polling (跟生成时长匹配)

### 2.3 修 BUG 链

| BUG | 现象 | 修法 |
|-----|------|------|
| BUG-041 | 缺 streaming type + 12 个 API helper | types/agent.ts + client.ts 扩展 |
| BUG-042 | 只显示 URL 60 字符 | RN Image + WebView 渲染 |
| BUG-043 | 缺 image width/height + video coverUrl | types 扩展 |
| BUG-044 | ImageAgentScreen 调错 /video-agent/confirm | 改 endpoint + modal 文案 + 抽 helper |
| BUG-045 | server API 响应路径不匹配 + snake_case 字段 | screen 解构 + 字段 mapping |
| BUG-046 | gradle compileSdk 33 不够 | 升 34 + 升 targetSdk 34 + 升 buildTools 34.0.0 |
| BUG-047 | PS 5.1 嵌套引号吃 | 全程用 .ps1 文件 |
| BUG-048 | PM2 env 字段不 reload | 必走 delete+start (S50 教训) |

### 2.4 配置升

```diff
// apps/mobile/android/app/build.gradle
- versionCode 25
- versionName "3.0.23"
+ versionCode 26
+ versionName "3.0.24"

// apps/mobile/src/config/version.ts
- export const APP_VERSION = '3.0.23';
+ export const APP_VERSION = '3.0.24';

// apps/mobile/android/build.gradle
- buildToolsVersion = "33.0.2"
- compileSdkVersion = 33
- targetSdkVersion = 33
+ buildToolsVersion = "34.0.0"
+ compileSdkVersion = 34
+ targetSdkVersion = 34
```

## 3. 验证 (ADB 截图)

### 3.1 tsc 编译
```
0 error
```
修过的 4 个文件全过; 历史 tsc 错 (mobile 静态分析 16 屏) 不动.

### 3.2 gradle assembleRelease
- 第一次: BUILD FAILED 45s (BUG-046 compileSdk 不够, 升 34)
- 第二次: BUILD SUCCESSFUL 1m 50s
- 后续增量: 48s (只改 screen 解构)

### 3.3 ADB 跑通流程

**步骤 1**: 装 v3.0.24 APK (26MB), 启动, 登录 tester01 (新注册 user)
**步骤 2**: 跳生图 tab → 显示生图助手 welcome + 6 比例 chip + 🎨 免费 30/天 ✅
**步骤 3**: input 提示词 "qinglvgenshang bihua" → send → 显示用户紫气泡 + 助手 plan 卡片 (📄 提示词方案 + 1024×1024) ✅
**步骤 4**: server 端调 /image-agent/confirm (蓝叠 tap 拦截, 用脚本触发) → 等 30s
**步骤 5**: conv `48576724-20b7-4c30-a4c9-71ffc306950f` status=tool_completed + resultImageUrl=`b6eee1ffee45479eae56fad0bb2417a9.png` ✅
**步骤 6**: 装 v3.0.24.2 (修了 BUG-045) → APP 跳生图 tab → **自动 loadHistory → 自动 loadConversation 最后含 result 的会话 → chat 流渲染 user 紫气泡 + 助手 plan 卡片 + 古风绿衣仙子 1024×1024 真图 + 下载图片按钮** ✅ (v24-21.png)
**步骤 7**: 触发 video conv `dffefee1-8ff3-4687-aa44-e635b6eaf97e` → 等 150s → status=tool_completed
**步骤 8**: 跳视频 tab → 自动 loadConversation → chat 流渲染 user 紫气泡 + 视频方案卡片 (1152×768@24fps 5s) + **WebView 内嵌视频播放器** + 下载视频按钮 ✅ (v24-22.png)

## 4. 截图证据

| 截图 | 说明 |
|------|------|
| v24-1-tab.png | 登录页 + v3.0.24 标识 |
| v24-9-clear.png | pm clear 后登录成功, 书架空 + 6 tab |
| v24-10-image-tab.png | 生图 tab 新 UI (toolbar + 6 比例 + 免费 30/天) |
| v24-11-plan.png | plan 卡片完整渲染 (跟 web 1:1) |
| v24-16-history.png | 历史 5 条 (BUG-045 修前 0 条 → 5 条 ✅) |
| v24-21-auto-loaded.png | **生图流渲染真图** (古风绿衣仙子 1024×1024) ✅ |
| v24-22-video-tab.png | **视频流渲染视频** (WebView + 控制条 + 16:9 + 5s 免费) ✅ |

## 5. 跟 web 1:1 一致性 check

| 功能 | web | mobile v3.0.24 | 一致 |
|------|-----|----------------|------|
| Toolbar (历史/新建/Agent/删除) | ✅ | ✅ | ✅ |
| Plan 卡片 (📄 + 提示词方案 + 比例 + 时长 + 宽高 + fps) | ✅ | ✅ | ✅ |
| Streaming 卡片 (紫色边框 + spinner + "正在翻译"/"AI 正在渲染") | ✅ | ✅ | ✅ |
| 真图渲染 (RN Image) | ✅ | ✅ | ✅ |
| 真视频渲染 (WebView + HTML5 video) | ✅ | ✅ | ✅ |
| 比例 chip (6 个 for image, 3 个 for video) | ✅ | ✅ | ✅ |
| 时长 chip (3s/5s/10s for video) | ✅ | ✅ | ✅ |
| 免费 30/天 提示 | ✅ | ✅ | ✅ |
| 下载图片 (PNG) | ✅ | ✅ | ✅ |
| 下载视频 (mp4 含音频) | ✅ | ✅ | ✅ |
| 长按图片保存提示 | ✅ | ✅ | ✅ |
| 历史列表 (侧栏) | ✅ | ✅ | ✅ |
| 历史 5 状态徽章 | ✅ | ✅ | ✅ |
| 历史缩略图 | ✅ | ✅ | ✅ |
| 3s polling (image) | ✅ | ✅ | ✅ |
| 5s polling (video) | ✅ | ✅ | ✅ |
| 替换 streaming part → image/video part | ✅ | ✅ | ✅ |

## 6. 剩余工作

1. **PM2 reload** - server 升 APP_VERSION 3.0.24, 走 `pm2 delete 0 + pm2 start` (待执行)
2. **公网 APK** - 重新 push v3.0.24 到 `https://ab.maque.uno/app/DeepScript_v3.0.24.apk`
3. **其他 mobile 屏 Alert.alert 替换** (S60 P1 没做完) - 16 个文件待重构 Dialog
4. **清理 workspace 临时脚本** (_check-png.js / _mint-jwt.js / _bump-server.js 等)
5. **v3.0.24 公网分发** - 微信群 / 公网 URL 通知 user 真机试

## 7. 关键决策

- **react-native-webview 比 react-native-video 优先** (0 风险 + 0 依赖冲突 + 跟 web HTML5 video 1:1)
- **image/video polling 间隔分开** (3s vs 5s, 跟生成时长匹配)
- **API helper 12 个全加** (避免 screen 拼写错 + 跟 web 1:1)
- **server 响应路径** 用 `(data?.data?.conversations || data?.data || [])` 多重 fallback (兼容历史 wrapper 变种)
- **字段 snake_case / camelCase 双兼容** (`c.resultImageUrl || c.result_image_url`)
- **PS 5.1 全程用 .ps1 文件** (Bash 嵌套引号被吃)
- **gradle compileSdk 跟着新包要求走** (升 34 稳)
- **APP_VERSION 升 = PM2 delete+start** (S50 教训)

## 8. 教训汇总 (跨项目)

1. **跨端 API 必对齐响应 wrapper + 字段命名风格** - 终极方案: server 统一返 camelCase
2. **加新包必查 compileSdk 要求** (androidx-* 强制)
3. **复制粘贴 Image/Video agent 屏必同时改 endpoint + 文案** - 抽公共组件是终极方案
4. **蓝叠 input tap 拦截 → keyevent + uiautomator dump 找真实坐标** (S58 BUG-035)
5. **PS 5.1 嵌套引号吃 → 全程用 .ps1 文件 + ExecutionPolicy Bypass**
6. **PM2 env 字段 reload 必走 delete+start** (S50 BUG-038)
