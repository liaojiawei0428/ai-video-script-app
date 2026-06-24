# ADR-0000: ADR 模板 (Architecture Decision Record Template)

- **状态**: Template
- **日期**: 2026-06-24
- **决策者**: 通用模板

---

## 背景 (Context)

[描述当时面临的需求 / 技术约束 / 环境痛点。]
["为什么需要做这个决策?"]
[背景要包含: 当前状态 + 触发事件 + 决策窗口]

---

## 决策 (Decision)

[明确"是什么", 采用肯定句式, 减少模糊空间。]
["我们决定..."]

---

## 影响 (Consequences)

### 正面收益 (Positive)

- 解决了什么具体问题
- 给未来 AI / 用户带来什么好处
- 长期可持续性

### 负面代价 (必须忍受, Negative)

- 增加了什么复杂度
- 多出什么维护成本
- 需要哪些妥协

### 后续风险 (Future Risks)

- 潜在边界 case
- 依赖外部系统
- 回滚成本

---

## 一致性 (Compliance)

如何确保决策被执行, 不被后续 AI 遗忘:

- CI / 自动检查: 列出 grep 命令 / CI step
- Code Review checklist: PR review 时必查
- 手动自检: VERSION_MANAGEMENT.md § 7.2 6 处自检

---

## 替代方案 (Considered Alternatives)

### 方案 A: [名称]

- 优势: ...
- 劣势: ...
- 为什么没选: ...

### 方案 B: [名称]

- 优势: ...
- 劣势: ...
- 为什么没选: ...

---

## 配套变更 (Related Changes)

- BUG: BUG-NNN, BUG-NNN
- 规范修订: docs/VERSION_MANAGEMENT.md § N
- ADR 引用: 无 / 引用 ADR-NNNN
- 代码改动: file:line + file:line
- 部署验证: 5 维全通过 / 6 维全通过

---

> 模板来源: https://github.com/joelparkerhenderson/architecture_decision_record + S65 shipin-APP 实战适配
