# ADR-0002: 小说上传 → 剧本生成流程的 8 个已知问题 (S72 P0/P1/P2 收口)

状态: Accepted (部分). 日期: 2026-06-25. 决策者: S72 + User.

## 背景 (Context)

S72 阶段扫描 Web 端小说上传 → 剧本生成完整流程 (routes/novels.ts 58 行 + novelService.ts 629 行), 发现 11 个潜在问题, 按严重度分类:

- **P0 (影响业务, 立即修)**: 4 个 (并发重复任务 / 扣费无回滚 / outline/plotGraph 失败被吞 / billing_logs 删除孤儿)
- **P1 (影响稳定性, 下次 session 修)**: 4 个 (取消状态内存 Set / 角色解析 LLM 格式依赖 / upload 临时文件未清理 / extractDescriptions 部分失败被吞)
- **P2 (改进项, 可选)**: 3 个 (自动触发剧本生成 / userId 一致性 / chunkService 失败记录)

S72 决策: **修 2 个最危险的 P0 (#1 并发重复任务 + #4 billing_logs 孤儿), 其余 8 个留 ADR 待下次 session**.

主链路关键点 (novelService.ts:425-572):
- parseAndSave 是私有方法, 一口气干 5 件事 (解析报告 / 保存 DB / 补角色描述 / 自动生成 outline/plotGraph / 自动生成剧本)
- 任何一步失败都被 try/catch 吞掉只 warn 不 fail
- 用户看到 "完成" 实际可能啥都没成, 但钱已经被扣 (line 256 guardBalance + chargeStep)

## 决策 (Decision)

我们决定:

### S72 已修 (P0 #1 + #4)

1. **#1 修法 (应用层, DB 权威)**: `analyzeNovel` 入口把 `taskQueue.isQueuedOrRunning` 内存检查 (line 218-224) 替换成 raw DB query 直接查 `task_jobs` 表 (status IN 'queued','running'), 有 active 任务直接返回 + log, 不创建新 taskJob + 不扣费
2. **#4 修法 (级联删除)**: `deleteNovel` 级联删除 (line 614-618) 加 `DELETE FROM billing_logs WHERE novel_id = ?`, 在 DELETE novels 之前, 避免孤儿扣费记录

### S72+ 待修 (8 个问题留 ADR)

| 严重度 | # | 问题 | 在哪 | 建议修法 | 预估 |
|---|---|---|---|---|---|
| P0 | #2 | 扣费无回滚 | novelService.ts:254-571 | 整个主链路包 try/catch, catch 里 `billingService.refundStep` | 1-2 小时 |
| P0 | #3 | outline/plotGraph 自动生成失败被吞 | novelService.ts:532-562 | 拆 2 个状态字段 `outline_status` / `plot_graph_status`, 失败标 `failed` | 1 小时 |
| P1 | #5 | 取消状态内存 Set, 重启清空 | novelService.ts:23 | 持久化到 DB (加 `novels.cancelled_at`) 或 Redis | 30 分钟 |
| P1 | #6 | 角色解析正则 LLM 格式依赖 | novelService.ts:50-53 | 加 fallback: 正则失败时 UI 显式提示"角色描述未生成" | 20 分钟 |
| P1 | #7 | upload 临时文件未清理 | routes/novels.ts:11-19 + novelService.ts:172-178 | `parseFile` 完成后 `fs.unlink(originalPath)` | 10 分钟 |
| P1 | #8 | extractDescriptions 部分失败被吞 | novelService.ts:485-507 | 失败标 `character.description_status='failed'`, UI 单独提示 | 20 分钟 |
| P2 | #9 | 分析完成立即触发剧本生成, 用户无机会先看 | novelService.ts:565-571 | 加配置项 `auto_generate_episodes=false` (默认), 用户手动触发 | 30 分钟 |
| P2 | #10 | analyze 路由不校验 novel 归属, A 用户能分析 B 用户小说 | routes/novels.ts:41 | controller 加 `if (novel.userId !== req.userId) throw 403` | 10 分钟 |
| P2 | #11 | chunkService 失败仅 warn 不影响整体, 没记录哪些块失败 | novelService.ts:303-309 | 返回结果加 `failedChunks: [{index, error}]`, UI 显示 | 20 分钟 |

## 影响 (Consequences)

### 正面收益 (Positive, S72 已修的)

- 修了 2 个最危险的并发 + 数据孤儿, 30 分钟止血
- DB 权威检查替代 taskQueue 内存检查, 进程重启不丢并发保护
- billing_logs 跟 novels 一起删, 审计干净 (符合 GDPR)
- ADR 把 8 个问题沉淀, 下次 session 接手明确知道待修

### 负面代价 (Negative, 必须忍受)

- P0 #2 #3 留到下次 session, 用户仍可能看到"完成"实际啥都没成 (但钱扣了)
- P1 #5-8 留到下次 session, 进程重启取消状态仍会丢
- P2 #9-11 留到下次 session, 产品细节改进延后

### 后续风险 (Future Risks)

- 下次 session 接手可能忽略 ADR, 8 个问题永久遗留 (修法: HANDOVER.md 必读 ADR 清单)
- 8 个问题中 P0 #2 #3 优先级最高, 必须下次 session 第一个修

## 一致性 (Compliance)

### 部署前自检 (本 ADR 引用的代码改动)

```bash
# novelService.ts analyzeNovel 入口必须有 DB 检查
grep -A 5 "P0 #1 修复" apps/server/src/services/novelService.ts

# deleteNovel 级联删除必须含 billing_logs
grep -B 1 -A 1 "billing_logs" apps/server/src/services/novelService.ts
```

### 部署后验证 (5 维, VERSION_MANAGEMENT.md § 5.8)

```bash
# 1. tsc 编译 0 错
cd apps/server && npx tsc --noEmit

# 2. 并发测试: 同 novelId 2 个并发请求, 期望只 1 个 taskJob 创建
curl -X POST https://ab.maque.uno/api/novels/<id>/analyze &
curl -X POST https://ab.maque.uno/api/novels/<id>/analyze &
sleep 5
mysql -e "SELECT COUNT(*) FROM task_jobs WHERE novel_id='<id>' AND status IN ('queued','running')"
# 期望: 1

# 3. 删除测试: 删除 novel 后, billing_logs 应一并清空
curl -X DELETE https://ab.maque.uno/api/novels/<id>
mysql -e "SELECT COUNT(*) FROM billing_logs WHERE novel_id='<id>'"
# 期望: 0
```

### Code Review checklist

- analyzeNovel 入口有 DB query 替代 taskQueue 内存检查?
- deleteNovel 有 billing_logs 删除?
- ADR 0002 列的 8 个问题有后续 plan?

## 替代方案 (Considered Alternatives)

### 方案 0: 不修, 等用户撞了再修 (REJECTED)

- 优势: 0 工作量
- 劣势: 并发扣费双倍 + billing_logs 永久孤儿
- 为什么没选: S72 主动扫描发现, 不修违反 § 0.5 第 4 条目标导向

### 方案 A: 全修 4 个 P0 (PARTIAL)

- 优势: P0 全清
- 劣势: 1-2 小时改动大, 可能引入新 BUG (扣费回滚涉及财务, 改错代价高)
- 为什么没选: 违反 § 0.5 第 3 条外科手术 (改动最小化), 30 分钟止血更稳

### 方案 B: 只修 #1, #4 留 ADR (本次采用)

- 优势: 30 分钟止血, 修最危险的 2 个, 8 个问题留 ADR 沉淀下次 session
- 劣势: P0 #2 #3 仍可能让用户被扣钱 + 看到"完成"实际失败
- 为什么选: 跟 § 0.5 第 2 条简单优先 + 第 3 条外科手术对齐, ADR 沉淀避免丢上下文

## 配套变更 (Related Changes)

### BUG

- 无 (S72 是新发现, 还没建 BUG 编号, 下次 session 可建 BUG-083/084/085)

### 规范修订

- 本 ADR (docs/standards/ADR/0002-novel-flow-pitfalls.md) - 新建

### 代码改动 (S72)

| 文件 | 类型 | 改动 |
|---|---|---|
| apps/server/src/services/novelService.ts | M | analyzeNovel 入口加 DB 检查 (P0 #1) + deleteNovel 加 billing_logs 删除 (P0 #4) |
| docs/standards/ADR/0002-novel-flow-pitfalls.md | New | 本 ADR (8 个问题沉淀) |

### 部署验证

- 部署前: `npx tsc --noEmit` 0 错
- 部署后: 并发测试 + 删除测试 (见一致性 § 部署后验证)
- HANDOVER.md § 7 下一步候选加 1 项 "修 ADR-0002 列的 8 个问题"

### Git commits

- (S72 pending) - v3.0.33: 修小说流程 P0 #1+#4 (并发扣费 + billing_logs 孤儿) + ADR-0002 8 问题沉淀
- HANDOVER.md § 7 选项 G: 修 ADR-0002 8 个问题 (下次 session 必做)

---

> 决策来源: 借鉴 ADR-0001 模板 + shipin-APP S72 实战, S72 主动扫描发现 11 潜在问题, 留 ADR 防丢上下文
