# Architecture Decision Records (ADR) — 索引

> **本目录**记录 shipin-APP 项目**关键架构 / 规范变更决策**的背景、方案、影响。
> 每个 ADR 是**不可变历史快照**, 一旦写入, 永远不改 (新决策开新 ADR, 老 ADR 标 Superseded)。
>
> **为什么需要 ADR**: GitHub 主流方案 ([joelparkerhenderson/architecture_decision_record](https://github.com/joelparkerhenderson/architecture_decision_record)), 让未来的 AI 能追溯"为什么这么改", 避免重复讨论。
>
> **触发场景**: [`../STANDARDS_EVOLUTION.md` § 6.4](../STANDARDS_EVOLUTION.md) — 架构变更 / 规范冲突决策 / 跨 AI 行为约定 / 技术选型 / 撤换核心依赖

---

## ADR 索引

| # | 标题 | 状态 | 日期 | 关联 BUG / 规范 |
|---|---|---|---|---|
| [0000](./0000-adr-template.md) | ADR 模板 (Template) | Template | 2026-06-24 | — |
| [0001](./0001-server-changelog-source-of-truth.md) | server changelog 单一来源决策 (从硬编码文案 → changelog.json + shared/changelog.ts) | Accepted | 2026-06-24 | BUG-066 / BUG-067 |

---

## ADR 生命周期

```
Proposed ──→ Reviewing ──→ Accepted ──→ Superseded by ADR-NNNN
   │              │              │
   │              │              └─→ 永不删, 留作历史
   │              └─→ Rejected (留 ADR 但标 Rejected)
   └─→ Withdrawn
```

详细 SOP: [`../STANDARDS_EVOLUTION.md` § 6](../STANDARDS_EVOLUTION.md)

---

## 命名约定

`<adr-number>-<short-title>.md`

- `adr-number`: 4 位递增, zero-padded (0001, 0002, ...)
- `short-title`: 全小写, 连字符分隔, 3-8 个单词, 描述决策
- 例: `0001-server-changelog-source-of-truth.md`

---

## 模板

新 ADR 复制 [`0000-adr-template.md`](./0000-adr-template.md) 6 个标准模块:
1. 状态 + 日期 + 决策者
2. 背景 (Context)
3. 决策 (Decision)
4. 影响 (Consequences) — 正面 + 负面 + 后续风险
5. 一致性 (Compliance) — 怎么确保执行
6. 替代方案 (Considered Alternatives)
7. 配套变更 (Related Changes)

---

> **最后更新**: 2026-06-24 (S65)
> **下次 review**: 架构变更时新建 ADR, 在本 README 索引表追加一行
