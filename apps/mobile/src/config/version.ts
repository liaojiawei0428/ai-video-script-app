// APP版本统一管理
// 发布新版本时只需修改此处
// v3.0.22 (S58 P10 P2): 修 BUG-026 authorities=${applicationId}.provider 让 blob-util 内部匹配
// v3.0.25 (S61 v2): bump version 配合 server 端 S61 v2 (LLM prompt 优化 + 分镜模式), 配套 APK rebuild
// v3.0.27 (S61 P1): BUG-055 修 mobile 时长 chip 按 isVip 动态显示 + Web VipCenterPage 文案补 15s + BUGS.md 补 BUG-054/055
// v3.0.28 (S62 P1-P2): 角色库跟 Web 端 1:1 对齐
//   - CharacterDetailScreen 加编辑模式 (角色类型/别名/主描述 textarea/补充描述 textarea) + 确认 + 生成三视图 单图
//   - CharacterListScreen 加"重新分析角色"按钮 + 描述摘要 + sheet 单图预览
//   - CharacterDescriptionReviewScreen 删 11 维字段编辑, 改 2 个 textarea 跟 web 对齐
//   - AssetLibraryScreen 单图 sheet 预览 (替代 3 张变体图网格)
//   - client.ts 补 backfillCharactersApi + updateCharacterFullApi (跟 web 1:1)
//   - BUG-056: 修 CharacterWithAssets 类型未导出问题 (改用 server 真源 Character 类型)
// v3.0.29 (S63): 角色库 UI 商业化重设计 (user 反馈"文字太黑/排版太丑")
//   - 新建 theme/character.ts (角色专用 theme: role 配色 / gradient / surface 层级)
//   - 新增 4 个商业化组件: CharacterAvatar / Chip (Role/Status/Style) / EmptyState / LinearGradient
//   - 3 个 screen 全重设计: hero banner + 大头像 + role color ring + 状态 dot + 软阴影
//   - 描述改 Markdown 渲染 (# / - / 段落), 文字层级用 11.6:1 对比度
//   - 替换 emoji (🏷/📖/✨) 改用 Ionicons 矢量图标
//   - 底部按钮改 gradient primary + sticky bg
//   - 修复 BUG-061 (text.tertiary 4.36:1 看不见) + BUG-062 (emoji 当 icon 不商业) + BUG-063 (chip alpha 12.5% 隐形)
export const APP_VERSION = '3.0.29';
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
