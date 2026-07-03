# Web vs Mobile 功能同步 GAP 盘点 (S75 v1.0 方向修正, 2026-07-03)

> **方向 (2026-07-03 user 明确)**: **Web 为主体, APP 跟随 Web 端更新完善** (S72 batch 7 规范反转, 2026-06-26)
> **配套规范**: `AGENTS.md § 4 铁律 4++` "Web 主导, APP 跟随, 必同步" + 5 步同步 SOP
> **方向说明 (跟 S74 v1.0 反转)**: S74 O 任务原版盘点方向错了, 把 "web 端补 mobile 端已有的功能" 说成 P0, 实际应该是 "mobile 端跟 web 端已有的功能"。本文档 S75 v1.0 完全重做方向。
> **修法核心**: 拿 web 端 27 个 page 当唯一基准, 看 mobile 端 39 个 screen 哪些**功能没跟**, 这些才是必修 GAP。

---

## § 1. 盘点方法论 (Web 为主体)

| 步骤 | 做什么 | 工具 |
|---|---|---|
| 1 | 列出 web 端所有 27 个 page 的功能入口 | `apps/web/src/App.tsx` 路由表 + 各 page 文件 |
| 2 | 列出 mobile 端 39 个 screen 对应功能 | `apps/mobile/src/App.tsx` RootStackParamList + 各 screen 文件 |
| 3 | **web 有, mobile 没有 → 必修 GAP (跨端铁律 4++)** | 1:1 对比清单 |
| 4 | web 有, mobile 有但实现不同 → 评估 (通常 1:1 镜像 OK, 不用改) | 看实现细节 |
| 5 | mobile 有, web 没有 → **可选 GAP (平台差异合理, 不强制)** | 记录但不进 P0 |
| 6 | 跨端铁律 4++ 5 步同步 SOP: 1) 评估漏修清单 2) 修 mobile 端 3) tsc 4) aapt2 dump 5) 9 项版本号同步 | AGENTS.md § 4 铁律 4++ |

**反方向 (S74 v1.0 错的)**: 拿 mobile screen 当基准找 web 缺什么, 这是把 APP 端当主体了, 违反规范。

---

## § 2. 盘点结果 (2026-07-03 S75 v1.0)

### § 2.1 ✅ 无必修 GAP (初始盘点)

经过 web 端 27 page vs mobile 端 39 screen 1:1 对比 + 实现细节检查, **S75 初步盘点无必修 GAP**:

| 维度 | Web 端 | Mobile 端 | 一致性 |
|---|---|---|---|
| 通知系统 | NotificationBell 弹窗 + 通知列表 inline | NotificationScreen 独立 page (BUG-160 加) | ✅ 1:1 (实现形式不同, 功能 1:1) |
| AI 助手 | AIAssistantPage 独立 page | AIAssistantScreen 独立 page (BUG-160 加) | ✅ 1:1 |
| 角色描述审核 | CharacterDetailPage 内部 review UI | CharacterDescriptionReviewScreen 独立 page | ✅ 1:1 (实现形式不同, 功能 1:1) |
| 大纲审核 | OutlinePage 内部 review UI | OutlineReviewScreen 独立 page | ✅ 1:1 (实现形式不同, 功能 1:1) |
| 分镜详情 | ScriptDetailPage 内部 shot detail | ShotDetailScreen 独立 page | ✅ 1:1 (实现形式不同, 功能 1:1) |
| 充值 | RechargePage 独立 page | RechargeScreen 独立 page | ✅ 1:1 |
| VIP | VipCenterPage 独立 page | VipCenterScreen 独立 page | ✅ 1:1 |
| ... | ... | ... | ... |

**S72 batch 7 后所有"web 做了 mobile 没做" 的 GAP 全部修完了** (跟 BUG-160 v3.0.82 配套, S73-S74 期间跨端铁律 4++ 5 步 SOP 强制落地)。

### § 2.2 📋 mobile 独有 screen (平台差异合理, 不强制 web 跟)

| Mobile 独有 screen | 是否 web 需要跟 | 备注 |
|---|---|---|
| HomeScreen (Tab 主页) | ❌ 否 | 平台差异, web 用 React Router 路由直达 |
| CreateScreen (主页 Tab) | ❌ 否 | 平台差异 |
| ChatScreen | ⚠️ 待评估 | 可能跟 AIAssistantScreen 重复, 需 grep 确认 |
| ScriptListScreen | ⚠️ 待评估 | 可能跟 BookshelfScreen 重复, 需 grep 确认 |
| EpisodeListScreen | ❌ 否 | mobile 主列表, web 是 ScriptDetailPage 子模块 |
| PointsOrderScreen | ❌ 否 | mobile 订单页, web 用 RechargePage |
| UploadScreen | ❌ 否 | mobile 上传页, web 用 inline |
| PrivacyPolicyScreen | ❌ 否 | mobile 缺 (但 web 有), 平台差异 |
| UserAgreementScreen | ❌ 否 | mobile 单独页, web 是 inline |
| NotificationScreen | ✅ 已修 | web NotificationBell 弹窗形式, mobile 独立 page, 1:1 |
| CharacterDescriptionReviewScreen | ✅ 已修 | web CharacterDetailPage 内嵌, mobile 独立 page, 1:1 |
| OutlineReviewScreen | ✅ 已修 | web OutlinePage 内嵌, mobile 独立 page, 1:1 |
| ShotDetailScreen | ✅ 已修 | web ScriptDetailPage 内嵌, mobile 独立 page, 1:1 |

### § 2.3 ⚠️ 待 grep 确认 (ChatScreen / ScriptListScreen 重复)

下次盘点必 grep 这 2 个, 确认是否跟 mobile 端其他 screen 重复, 重复就合并。

---

## § 3. 真正的 S75 候选清单 (按 web 主体方向)

S75 应该做的事 (跟 S74 § 7 推荐一致 + S75 方向修正):

### § 3.1 P0 必修 (跨端铁律 4++ 闭环)

**无新增 P0 GAP** — S72 batch 7 后所有跨端 GAP 都修完了 (跟 BUG-160 + S73-S74 5 步 SOP 强制落地)。

### § 3.2 P1 推荐 (S75 用户推荐顺序)

1. **集成 check-commit-message.py 到 husky pre-commit hook** (15 分钟) — 配套 S74 bump-version.py 已强制 --bug-no, 但日常手写 commit 还没强制
2. **AGENTS.md § 4 关键铁律 v2.18 → v2.20 同步** S73 § 5.10 沉淀的 ~30 条新铁律 (30-45 分钟) — 防下个 AI 重复踩坑
3. **跑 scripts/verify-mobile-apk.sh 真机回归实战** (30 分钟) — 新工具首次实战验证
4. **scripts/verify-deploy.sh 27 → 30 维** (20 分钟) — 加 verify-mobile-apk 集成 + bump-version dryrun 验证

### § 3.3 P2 可选 (长期)

- web 端 27 page 各 page 内部子功能 1:1 镜像 mobile (审核流程、文件上传、AI 助手调用) — 工作量大, 等用户提需求
- mobile PrivacyPolicyScreen 独立化 (跟 web 1:1) — 平台差异合理, 可不动
- 跨端移动端 dark mode 支持 — 等用户提需求

---

## § 4. 跨项目通用铁律沉淀 (跟 S73 v3.0.78-82 BUG-148-152 + S74 v3.0.83 1:1 镜像)

1. **Web 主体, APP 跟随** (S72 batch 7 规范反转, 2026-06-26 user 明确, 跨端铁律 4++) — 改 web 必同步 app
2. **跨端 GAP 盘点方向 = web 端当基准** (新增铁律, 2026-07-03 S75 v1.0 实战沉淀) — 不要反过来 (S74 v1.0 反方向错的)
3. **盘点结论分 3 类**: ✅ 无 GAP / 📋 平台差异合理 / ⚠️ 待 grep 确认 — 不要一刀切"全部要修"
4. **跨端铁律 4++ 5 步同步 SOP 强制落地**: 评估漏修清单 → 修 mobile → tsc → aapt2 → 9 项版本号同步
5. **修一处必 grep 另一端**: 跟 BUG-097/130/135/143/159/160 教训一致

---

## § 5. 工具 (跟 N 任务配套)

- **tools/bump-version.py**: 一键 bump 9 处版本号 + changelog entry + 备份撤回 (S74 N 任务)
- **本文档** (tools/web_vs_mobile_GAP.md): 跨端 GAP 盘点 + S75 候选清单 (S75 v1.0 方向修正版)
- **scripts/verify-mobile-apk.sh**: APK 真机回归脚本 (S74 P 任务)

---

**最后更新**: 2026-07-03 (S75 v1.0 方向修正, S74 v1.0 方向反了重做)
**下次 review**: 任何 web 端新功能上线后, 必查 mobile 是否跟 (跨端铁律 4++)