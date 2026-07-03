# Web vs Mobile 功能同步 GAP 盘点 (S74, 2026-07-03)

> **目的**: 跨端铁律 4++ 加固 (S72 batch 7 "web 主导 mobile 跟随") — 修 BUG-160 后盘点还有哪些 GAP.
> **跟 BUG-160 关系**: BUG-160 修了 mobile ProfileScreen 0 个通知 + AI 助手入口 (2 个), 还有 11 个 mobile 独有 screen + 1 个 web 独有 page 没盘点.
> **跨项目通用铁律 (跟 BUG-097 mobile 漏修 web + BUG-160 web 漏修 mobile 100% 同源)**: 跨端功能必 1:1 镜像, 修一处必 grep 另一端.

---

## § 1. 一览对比 (27 web page vs 39 mobile screen)

| # | Web page | Mobile screen | 一致性 | GAP 说明 |
|---|---|---|---|---|
| 1 | AboutPage.tsx | AboutScreen.tsx | ✅ | 1:1 |
| 2 | AccountPage.tsx | AccountScreen.tsx | ✅ | 1:1 |
| 3 | AdminDashboardPage.tsx | AdminDashboard.tsx | ✅ | 1:1 |
| 4 | AdminLoginPage.tsx | AdminLoginScreen.tsx | ✅ | 1:1 |
| 5 | AIAssistantPage.tsx | AIAssistantScreen.tsx | ✅ | BUG-160 加 mobile 入口, 1:1 |
| 6 | AssetLibraryPage.tsx | AssetLibraryScreen.tsx | ✅ | 1:1 |
| 7 | BillingPage.tsx | BillingScreen.tsx | ✅ | 1:1 |
| 8 | BookshelfPage.tsx | BookshelfScreen.tsx | ✅ | 1:1 |
| 9 | - | CharacterDescriptionReviewScreen.tsx | ❌ | **mobile 独有**: 角色描述 review UI, web 是 inline 在 CharacterDetailPage |
| 10 | CharacterDetailPage.tsx | CharacterDetailScreen.tsx | ✅ | 1:1 |
| 11 | CharacterListPage.tsx | CharacterListScreen.tsx | ✅ | 1:1 |
| 12 | - | ChatScreen.tsx | ❌ | **mobile 独有**: 跟 AIAssistantScreen 重复? 待确认 |
| 13 | - | CreateScreen.tsx | ❌ | **mobile 独有**: 主页 Tab, web 是路由直达 |
| 14 | EpisodeDetailPage.tsx | EpisodeDetailScreen.tsx | ✅ | 1:1 |
| 15 | - | EpisodeListScreen.tsx | ❌ | **mobile 独有**: 列表页, web 是 inline 在 ScriptDetailPage |
| 16 | FeedbackPage.tsx | FeedbackScreen.tsx | ✅ | 1:1 |
| 17 | - | HomeScreen.tsx | ❌ | **mobile 独有**: Tab 主页, web 是路由直达 |
| 18 | ImageAgentPage.tsx | ImageAgentScreen.tsx | ✅ | 1:1 |
| 19 | LoginPage.tsx | LoginScreen.tsx | ✅ | 1:1 |
| 20 | - | NotificationScreen.tsx | ⚠️ | BUG-160 修了 mobile 入口, 但 web 没独立 page (web 用 NotificationBell 弹窗) |
| 21 | OutlinePage.tsx | OutlineScreen.tsx | ✅ | 1:1 |
| 22 | - | OutlineReviewScreen.tsx | ❌ | **mobile 独有**: outline review UI, web 是 inline 在 OutlinePage |
| 23 | PlotGraphPage.tsx | PlotGraphScreen.tsx | ✅ | 1:1 |
| 24 | PricingPage.tsx | PricingScreen.tsx | ✅ | 1:1 |
| 25 | - | PointsOrderScreen.tsx | ❌ | **mobile 独有**: 积分订单, web 是 RechargePage 1:1 |
| 26 | - | PrivacyPolicyScreen.tsx | ❌ | **web 独有**: web 单独页, mobile 缺 (mobile 有 UserAgreementScreen) |
| 27 | ProfilePage.tsx | ProfileScreen.tsx | ✅ | 1:1 |
| 28 | RechargePage.tsx | RechargeScreen.tsx | ✅ | 1:1 |
| 29 | RegisterPage.tsx | RegisterScreen.tsx | ✅ | 1:1 |
| 30 | ScriptDetailPage.tsx | ScriptDetailScreen.tsx | ✅ | 1:1 |
| 31 | - | ScriptListScreen.tsx | ❌ | **mobile 独有**: 跟 BookshelfScreen 重复? 待确认 |
| 32 | SettingsPage.tsx | SettingsScreen.tsx | ✅ | 1:1 |
| 33 | - | ShotDetailScreen.tsx | ❌ | **mobile 独有**: 单独页面, web 是 inline 在 ScriptDetailPage |
| 34 | TaskProgressPage.tsx | TaskProgressScreen.tsx | ✅ | 1:1 |
| 35 | TasksPage.tsx | TasksScreen.tsx | ✅ | 1:1 |
| 36 | - | UploadScreen.tsx | ⚠️ | web 缺独立 page (用 inline 在 ScriptDetailPage) |
| 37 | - | UserAgreementScreen.tsx | ❌ | **mobile 独有**: 用户协议, web 是 inline 在 RegisterPage |
| 38 | VideoAgentPage.tsx | VideoAgentScreen.tsx | ✅ | 1:1 |
| 39 | VipCenterPage.tsx | VipCenterScreen.tsx | ✅ | 1:1 |
| 40 | DownloadPage.tsx | - | ⚠️ | **web 独有**: mobile 用 DownloadManager inline |

---

## § 2. GAP 分类 (按修复优先级)

### § 2.1 [P0] 必修 — 跨端铁律 4++ 漏修方向 (跟 BUG-097 反方向同源)

| GAP | 现状 | 风险 | 修法 |
|---|---|---|---|
| **NotificationScreen mobile 有 web 缺独立 page** | web 用 NotificationBell 弹窗, mobile 是独立 page (BUG-160 加 ProfileScreen 菜单入口) | 用户进 mobile 看到 "通知" 菜单 → 跳转独立 page, web 端 user 看不到 page URL | web 端加独立 page (跟 mobile 1:1 镜像), 保留 Bell 弹窗兼容 |
| **CharacterDescriptionReviewScreen mobile 独有** | mobile 单独 review UI, web 是 inline 在 CharacterDetailPage | mobile 用户体验更好, web 用户看不到 review 流程 | web 端抽 review 组件, 在 CharacterDetailPage 加 "去 review" 按钮 |
| **OutlineReviewScreen mobile 独有** | 同上, mobile 单独 review UI | 同上 | web 端抽 review 组件, 在 OutlinePage 加 "去 review" 按钮 |
| **ShotDetailScreen mobile 独有** | mobile 单独页面, web 是 inline 在 ScriptDetailPage | mobile UX 更专业, web 简化 | web 抽 ShotDetail 组件, 路由可跳转 |

### § 2.2 [P1] 推荐修 — 跨端一致但用户体验差异

| GAP | 现状 | 风险 | 修法 |
|---|---|---|---|
| **EpisodeListScreen mobile 独有** | mobile 列表页, web 是 inline | web 用户操作 episodes 嵌套层级深 | web 抽 EpisodeList 组件, 跟 mobile 1:1 镜像 |
| **ScriptListScreen mobile 独有** | 跟 BookshelfScreen 重复? 待 grep 看 | 内部功能重复 | grep 看实现, 如重复合并 |
| **ChatScreen mobile 独有** | 跟 AIAssistantScreen 重复? 待 grep 看 | 内部功能重复 | grep 看实现, 如重复合并 |

### § 2.3 [P2] 可选修 — 平台差异合理

| GAP | 现状 | 风险 | 修法 |
|---|---|---|---|
| **HomeScreen mobile 独有** | mobile 是 Tab 主页, web 是路由直达 | 平台差异, web 用 React Router 不需要 Home | 接受差异 |
| **CreateScreen mobile 独有** | 同上, 平台差异 | 同上 | 接受差异 |
| **PointsOrderScreen mobile 独有** | mobile 积分订单, web 是 RechargePage | mobile 用户查订单更方便 | web 端抽积分订单 page |
| **UserAgreementScreen mobile 独有** | mobile 单独页面, web 是 inline 在 RegisterPage | web 用户需要翻协议体验差 | web 抽组件独立路由 |
| **DownloadPage web 独有** | web 独立 APK 下载 page, mobile 用 DownloadManager inline | 平台差异, web 需下载, mobile 已装 APP | 接受差异 |
| **PrivacyPolicyScreen web 独有** | web 单独隐私政策 page, mobile 缺 | mobile 用户查隐私政策不方便 | mobile 加 PrivacyPolicyScreen |

---

## § 3. 关键发现 (跟跨项目通用铁律 100% 同源)

### § 3.1 BUG-160 教训 (web 漏修 mobile)

- **方向反转 (跟 BUG-097 mobile 漏修 web 反方向同源)**: S72 batch 7 规范反转 "web 主导 mobile 跟随" 后, web 早就有的功能 (NotificationBell / AI Assistant) mobile 1+ 年漏修
- **修法 1: 入口必查 RootStackParamList**: mobile 加菜单入口前必 grep RootStackParamList (避免 "Argument of type X is not assignable" 错) — BUG-160 实战沉淀
- **修法 2: 跨端 web+mobile 1:1 镜像菜单**: 跨端铁律 4++ 必 web + mobile 同步
- **修法 3: 路由已注册但无入口 (跟 BUG-079 假能力 100% 同源)**: 必 grep App.tsx 排查, 路由注册了但没菜单入口 = 假能力

### § 3.2 § 2.1 P0 GAP 是 BUG-160 教训的延伸

- NotificationScreen / CharacterDescriptionReviewScreen / OutlineReviewScreen / ShotDetailScreen 都是 **mobile 独立 screen 但 web 端缺独立 page**
- 这是 mobile 端用户体验更好 (有独立 page = 可分享 URL / 加到收藏 / 浏览器历史记录), web 端是 inline (简化但缺功能)
- 修法: web 端加独立 page 跟 mobile 1:1, 保留 inline 入口兼容

### § 3.3 § 2.2 P1 GAP 是 mobile 端内部重复

- ScriptListScreen vs BookshelfScreen: 可能是 mobile 端历史包袱, 重复功能
- ChatScreen vs AIAssistantScreen: 可能是 mobile 端老代码, 跟 AIAssistant 重复
- 修法: grep 实际功能, 如重复合并 (不要拍脑袋删)

### § 3.4 § 2.3 P2 GAP 是平台差异合理

- HomeScreen / CreateScreen / PointsOrderScreen / UserAgreementScreen / DownloadPage / PrivacyPolicyScreen: 都是平台差异, 不用硬同步
- 但 mobile 缺 PrivacyPolicyScreen 是体验 GAP, 推荐加 (跟 web 1:1)

---

## § 4. 修复路线图 (建议 S75-S76)

### § 4.1 S75 P0 第一批: 4 个核心 GAP

1. **web NotificationPage.tsx** (跟 mobile NotificationScreen 1:1 镜像)
2. **web CharacterDescriptionReview 组件** (mobile CharacterDescriptionReviewScreen 抽组件化)
3. **web OutlineReview 组件** (mobile OutlineReviewScreen 抽组件化)
4. **web ShotDetail 组件** (mobile ShotDetailScreen 抽组件化)

预计: 4 个 BUG, 每个 +1 跨项目通用铁律, web typecheck 0 错, mobile tsc 0 新错, 27 维验证全过.

### § 4.2 S75 P1 第二批: 3 个内部重复

1. **grep ScriptListScreen vs BookshelfScreen**: 看实现, 重复合并
2. **grep ChatScreen vs AIAssistantScreen**: 看实现, 重复合并
3. **mobile 加 PrivacyPolicyScreen** (跟 web 1:1 镜像)

预计: 2 个内部清理 + 1 个跨端补做, BUG-NNN 标记.

### § 4.3 S76 P2 第三批: 平台差异

- HomeScreen / CreateScreen / PointsOrderScreen / UserAgreementScreen / DownloadPage / PrivacyPolicyScreen 不动 (平台差异)
- 但补 1 个 mobile PrivacyPolicyScreen (跟 web 1:1)

---

## § 5. 跨项目通用铁律沉淀 (跟 BUG-097/130/135/160 100% 同源)

1. **跨端功能必 1:1 镜像, 修一处必 grep 另一端**: 跨端铁律 4++ 强化 (S72 batch 7 后)
2. **入口必查 RootStackParamList**: mobile 加菜单入口前必 grep (避免 TS 编译错)
3. **路由已注册但无入口 = 假能力**: 必 grep App.tsx 排查 (跟 BUG-079 假能力同源)
4. **盘点跨端 GAP 必扫所有 page/screen 文件名 + 路由表**: 不要凭印象盘点, 必扫文件名 + 路由表 1:1 对比
5. **web 缺独立 page (inline) 跟 mobile 独立 screen 是不一致**: 体验差异 = 跨端铁律 4++ 漏修方向

---

## § 6. 工具 (跟 N 任务配套)

- **tools/bump-version.py**: 一键 bump 9 处版本号 + changelog entry + 备份撤回 (S74 N 任务)
- **本文档** (tools/web_vs_mobile_GAP.md): 跨端 GAP 盘点 + 修复路线图 (S74 O 任务)
- **scripts/verify-mobile-apk.sh**: APK 真机回归脚本 (S74 P 任务, 待做)

---

**最后更新**: 2026-07-03 (S74 O 任务 v1.0, 盘点 web 27 page vs mobile 39 screen, 4 P0 GAP + 3 P1 GAP + 6 P2 平台差异)
**下次 review**: 修完 S75 第一批后, 更新本文档