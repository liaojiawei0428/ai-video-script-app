# shipin-APP 部署后端约束 (worker 必读)

> 来源: S49–S53 实战经验 + 2026-06-13 全项目 audit 报告。
> 写给所有 team plan worker (coder/tester/verifier), 不读这份可能重蹈覆辙。

## 1. 禁止引入新 npm 依赖

**严禁 `npm install <新包>`**。生产环境 `node_modules` 装包极慢，且容易触发
package-lock.json 不一致 → deploy 卡 5+ 分钟。

- 不要用 `zod`（生产没装）, 改用 manual schema 校验 (`typeof` + 类型守卫)
- 不要用 `axios`（已有 fetch + 自封装）, 改用项目内 `httpClient`
- 不要用 `lodash`（没装）, 改用 ES 原生方法
- 必须新依赖时 → 先报告用户, 用户同意后才装

## 2. tsc 增量编译陷阱

项目用 `tsc` 增量编译, **`.js` 不会被自动清掉**。新 src 编译失败时, 服务
可能仍跑老 .js → 看到的是"代码改了但行为没变"的诡异 bug。

**部署后必须 6 维验证**:
1. 进程: `pm2 list` 看 `shipin-APP-server` 在线
2. 端口: `netstat -tlnp | grep 3000` (或实际 port)
3. `/health`: `curl http://127.0.0.1:3000/health` → `success: true`
4. `/api/version`: `curl .../api/version` → 返版本号
5. 鉴权: 拿真实 user token 调一个受保护 API
6. 日志: `tail -50 /www/wwwroot/shipin-APP/server/logs/error.log` 0 错

**强制看 TS 编译错**: 编译后立刻 `cd server && npx tsc --noEmit 2>&1 | head -50`,
有红字先修完再部署。**不要相信"tsc 退出码 0 = 一切 OK"** — 看 error 列表。

## 3. shipin-APP 文件结构 (跟 git 仓库不一样)

- 本地 git: `F:\文档\其它\banmu\APP\ai-video-script-app\apps\server\` 是 monorepo 子目录
- 生产 deploy: shipin-APP server 根是 **flat 结构**, 不是 monorepo 嵌套
- `apps/server/dist/` 是 tsc 输出 (生产直接跑 dist)
- `apps/server/.env.production` 是生产配置, **不能覆盖**
- `apps/server/uploads/` 跟 `exports/` 是用户数据, **不能动**

**改动 server 代码后**:
1. 本地 `tsc` 通过
2. 同步 dist (`rm -rf dist/* && tsc` 或 `tsc --build`)
3. **dist + ts 改动一起 rsync 到生产**（不传 dist 老 .js 还在)
4. `pm2 delete shipin-APP-server && pm2 start ecosystem.config.js`
   (必须 delete + start, 不用 restart — restart 不会重载新 dist)

## 4. 团队禁止新旧版并存规则 (强约束)

AGENTS.md 已有规则, 但 shipin-APP 团队一直在违反 — 2026-06-13 audit 发现
`imageAgentService.ts` 留了 v3.0.0.13 删 LLM 后的死代码 (300+ 行):

- `extractFirstBalancedJson / tryParseBalanced / findMatchingClose` (死)
- `translatePlan` 方法 (死)
- `updatePlanFields` 方法 (死)
- `MAX_CLARIFY_ROUNDS` 常量 (死)
- 多个 `// import { agnesTextProvider }` 注释 import (死)

**worker 改代码时必做自检**:
- 搜 `(旧版|legacy|fallback|deprecated|旧)` 关键字
- 看 git log 上一版 major bump (v3.0.0.13 / v3.0.0.16 / v3.0.0.18 / S45/S47/S48)
  前后大改动的文件, 重点检查残留
- 删的 LLM 路径 / 多轮问答 / 旧版字段 — 必须整段删, 不留注释 import

## 5. CharacterDescription 11 维结构 (v2.5.34 教训)

`shared/types.ts` `CharacterDescription` 必须 11 维:
`name / age / height / build / face / features / hair / signature / clothes /
personality / aliases`

**`CharacterExtraDescription` 是 4 维 (不是 11 维的子集)**:
`relationshipsText / emotionRange / actionHabits / signatureLines`

v2.5.34 曾把 `CharacterExtraDescription` 简化成 `CharacterDescription` 类型 → 编译失败 +
运行时字段错。**types.ts L308 `extraDescription?: CharacterDescription` 注释
说"v2.5.34 简化, 跟 description 同样类型"是错误的** — 实际是 4 维。

改 character 字段前必读 `services/characterService.ts` 实际用法, 不要信 types 注释。

## 6. v3.0.0 状态机 (12 态)

`shared/types.ts` `AgentConversationStatus`:
`idle → ai_clarifying → awaiting_clarification → ai_planning → plan_cn_ready
→ plan_translating → plan_ready → awaiting_confirmation → tool_queued
→ tool_executing → tool_completed / tool_throttled / tool_failed`

**v3.0.0.13 极简模式后实际走**:
`idle → awaiting_clarification → plan_ready (跳过 cn_ready + translating) → tool_queued
→ tool_executing → tool_completed`

→ `plan_cn_ready / plan_translating / awaiting_confirmation` 三个状态在极简模式
下**永远走不到**, 写新代码不要进这些状态。

## 7. 异步任务无锁 (P0 bug)

`videoAgentService.ts` `confirm()` 跟 `imageAgentService.ts` `confirm()` 用了
`setImmediate(() => runXxxBackground(...).catch(...))` — **fire-and-forget
没有 in-memory lock**。如果用户重复点确认按钮, 会触发多条 background 链并发
写同一个 conversation → billing 多次扣 / agens 拒接 / DB 写覆盖。

**改 confirm 路径必加 lock**:
- 用 `Map<conversationId, Promise>` 跟踪进行中的 background
- 新 confirm 看到有进行中 → 复用或拒绝
- background 完成时清掉

## 8. ASPECT_DIMENSIONS 表 (P0 修复)

`videoAgentService.ts` L37-51 `ASPECT_DIMENSIONS` 只存 `WxH` 格式 key。
`imageAgentService.ts` `processTurn` 接受 `'9:16'` 等文字比例。

`parseAspectToDims()` (在 `prompts/imageAspectRatio.ts`) 转文字比例 → WxH。
**两个 service 的 aspect ratio 入口都要走 `parseAspectToDims` 兜底**,
不能假设 client 一定传 WxH。

完整兜底链 (v3.0.0.18 起统一, 跟 §8 同源):
1. `aspectRatioFromClient` (client param) → `parseAspectRatioFromText(userText)` → `(conv.plan as any)?.aspectRatio` → `'1024x1024'`
2. 拿到后**再**走 `parseAspectToDims()` 一次, 文字比例 (9:16/4K/8K) 统一转 WxH
3. 兜底失败保留原值, 下游 `processTurn` 的 `parseAspectToDims(plan.aspectRatio) || DEFAULT_IMG_DIM` 再兜一次

## 8.5 VIDEO_HEAVY_RATIOS 降级监控语义 (S55 audit #14)

`videoAgentService.ts` L189 `VIDEO_HEAVY_RATIOS = new Set(['2K','4K','8K','2048x2048','1280x1280'])`。
原日志 `'heavy aspectRatio downgraded'` 笼统, 会把 9:16→768x1152 这种**正常格式归一化**
也报成"降级", 污染监控告警。

正确日志 (v3.0.0.18 起):
- `reason: 'heavy-ratio-downgrade'` — 命中 VIDEO_HEAVY_RATIOS, 真降级
- `reason: 'text-ratio-resolved'` — 文字比例解析成 WxH, 不是降级

**imageAgentService.ts L468** `angle: 'comic'` 是 v3.0.0 硬编码。
v3.1.0 待办: 跟前端确认 `plan.style` 取值范围后, 改成
`(plan as any).style || 'comic'`, 当前已加注释标注 TODO。

## 9. 沟通/汇报

- 主端 (Mavis root) 看 `mavis communication send` 报告
- 大文件 (≥1KB) 走 Matrix CDN: `mavis mcp call matrix matrix_upload_to_cdn --file args.json`
- 小段 ASCII 直接 `mavis communication send --content "..."`
- 中文 reply, 别英文 — 见 AGENTS.md L1-30

## 10. tsc 验证硬卡点 (本地无 node, 必须远端)

shipin-APP 本地开发机 (`F:\文档\其它\banmu\APP\ai-video-script-app\`) **无 node/npm/npx/tsc**:
- `where node`: 仅 Adobe node.exe (无 npx)
- `where npm/npx/tsc`: 未找到
- WSL Ubuntu-26.04 裸装, 无 node

`C:\Users\Administrator\.ssh\deploy_key_shipin_app_ed25519` 在 **Windows OpenSSH 9.5p2** 下
解析 "invalid format" (字节级检查无 BOM/CRLF, 是 Windows OpenSSH 解析 bug, 重生成或升级才能修)。

**结论**: 任何 audit 修复 / coder 改动, 改完必跑 tsc 验 0 错——但**本地跑不了**, 必须:
1. 用户在 159.75.16.110 部署机手动: `cd /www/wwwroot/shipin-APP-build/apps/server && npx tsc --noEmit 2>&1 | head -50`
2. 或在 WSL Ubuntu 装 node: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`
3. 或重新生成 SSH key 在 Linux 端

**部署前 tsc 红线**: 不见 0 错不部署。**team plan verifier** 默认 8/9 静态 PASS + 1 BLOCKED 是常态,
BLOCKED 步骤 = 远端 tsc 验证。**不能因为 BLOCKED 而放过**——必须在部署机补跑确认 0 错。
