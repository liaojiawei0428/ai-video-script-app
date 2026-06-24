# 规范自迭代 SOP (Standards Evolution)

> **本文件管**: shipin-APP 项目所有规范文档 (版本管理 / 部署 / 代码 / UI / 设计 / 测试 / 后端约束等)
> 怎么跟着版本迭代**自我更新**, 避免"规范落后于代码"。
>
> **最后更新**: 2026-06-24 (S65)
>
> **强制阅读**: 任何 AI 改 shipin-APP 项目**触发版本变更 / 架构变更 / 重大 BUG 修复**前必读本文件。

---

## § 1. 为什么需要"规范自迭代"

### 1.1 现状 (S65 自检发现)

shipin-APP 项目历经 S1-S64 64 个 AI 会话, 规范文档现状:

| 规范文档 | 最后更新 | 状态 |
|---|---|---|
| `docs/VERSION_POLICY.md` | 2026-05-31 (v1.1.0) | 🟡 冻结, 已被 VERSION_MANAGEMENT.md 替代 (S64) |
| `docs/APP_RELEASE_GUIDE.md` | 2026-05-31 (v1.1.0) | 🟡 冻结, 已被 VERSION_MANAGEMENT.md 替代 (S65) |
| `docs/DEPLOY.md` | 2026-06-09 (S14) | 🟡 SSH key 规则过时 (S58 P10 改持久化, 但 § 6 没同步) |
| `apps/mobile/DEPLOY.md` | 2026-06-16 (S58 P10) | ✅ APK 流程完整 |
| `apps/mobile/BUGS.md` | 2026-06-24 (S64 +66/67/68) | ✅ 持续追加 |
| `apps/mobile/CODING_STANDARDS.md` | 2026-06-24 (S64 32 条) | ✅ 持续追加 |
| `docs/VERSION_MANAGEMENT.md` | 2026-06-24 (S64) | ✅ 新建, 跨端入口 |
| **本次 S65** | 2026-06-24 | **新建本文件, 启动规范自迭代 SOP** |

### 1.2 核心问题

**8 份规范文档, 5 份有不同程度的落后/不一致**:

- ❌ **过时但未冻结**: `docs/DEPLOY.md` § 6 SSH key 规则跟 § 4 持久化要求自相矛盾 (S58 P10 改后没同步 § 6)
- ❌ **过时但未冻结**: `docs/APP_RELEASE_GUIDE.md` 内容写 `maque.uno/app/` 跟实际 `ab.maque.uno/app/` 不符
- ❌ **跨端文档重复**: VERSION_MANAGEMENT.md § 5 跟 docs/DEPLOY.md § 1-2 讲发版流程, 视角不同但都讲同一件事, AI 不知道读哪个
- ❌ **5 维 vs 6 维验证**: 4 份文档讲部署验证, 维度数量不一致 (VERSION_MANAGEMENT 5 维, docs/DEPLOY 6 维)
- ❌ **没规范自迭代机制**: AI 改代码时, 没人提醒"对应规范文档也要改", 规范自然落后

### 1.3 设计目标

**让规范文件**:
1. **跟代码同步演化** — 每次发版 / 重大调整, 同步修订对应规范
2. **可追溯决策** — 关键规范变更用 ADR (Architecture Decision Record) 记录决策背景
3. **避免重复** — 跨端文档明确分工, 不重复讲同一件事
4. **跨 AI 一致** — 任何 AI 接手 shipin-APP, 按本 SOP 读 + 写规范, 结果一致

---

## § 2. 触发条件 (满足任一, 必跑 § 3 SOP)

> 这些触发条件**写在 VERSION_MANAGEMENT.md § 7** (跨端统一入口), AI 必读。

| # | 触发条件 | 涉及规范文档 |
|---|---|---|
| 1 | **3 类 (大版本) 发版** (X.0.0) | 全部规范文档 (跨端架构变更) |
| 2 | **2 类 (中版本) 发版** (X.Y.0) | VERSION_MANAGEMENT / BUGS / CODING_STANDARDS / DEPLOY / CHANGELOG |
| 3 | **1 类 (小版本) 发版** (X.Y.Z) | BUGS (新增 BUG) + CODING_STANDARDS (新增规范) + CHANGELOG |
| 4 | **架构重大变更** (e.g. v3.0.0 Agent 矩阵新增) | ADR 新建 + VERSION_MANAGEMENT.md 更新 + 受影响端 DEPLOY.md |
| 5 | **重大 BUG 修复** (P0 BUG, 影响核心流程) | BUGS.md (强制) + CODING_STANDARDS.md (提炼新规范) |
| 6 | **新增/废弃文档** (新建 .md 或冻结 .md) | 本 STANDARDS_EVOLUTION.md § 6 (跨 AI 协作约定) |
| 7 | **修复规范 GAP** (用户明确反馈规范过时/矛盾) | 本文件触发, 一次性修订全套相关规范 |

---

## § 3. 修订流程 (5 步 SOP)

> **任何 AI 触发 § 2 任一条件时, 必跑**:

```
┌──────────────────────────────────────────────────────────────┐
│ 1. 列出本次所有变更                                            │
│    - 代码变更 (git diff)                                       │
│    - 规范变更 (查 § 4 时效性检查清单)                            │
│    - 新 BUG / 新决策 / 新 ADR                                    │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. 判定哪些规范文档需要更新 (按 § 5 责任矩阵)                    │
│    - VERSION_MANAGEMENT.md? (跨端入口, 必查)                    │
│    - BUGS.md? (新 BUG 必追加)                                   │
│    - CODING_STANDARDS.md? (新规范必追加)                        │
│    - DEPLOY.md 系列? (部署流程变必改)                           │
│    - ADR? (架构变更必写 ADR)                                    │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. 起草修订内容                                                 │
│    - 修改: 跟代码保持一致 (不能凭空臆造规范)                     │
│    - 新增: BUG-NNN / 规范 N+1 (编号递增, 不重用)                │
│    - 冻结: 头部加 ⚠️ 废弃说明 + 指向新规范                       │
│    - ADR: 用 § 6 ADR 模板写                                    │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. 自检 5 维                                                     │
│    □ 规范跟当前代码一致 (grep 验证)                             │
│    □ 不破坏其他 AI 已读规范 (backward compat)                   │
│    □ 新规范在 cross-ref 中引用 (如 VERSION_MANAGEMENT 引用 ADR) │
│    □ commit message 含 "vX.Y.Z + 规范修订 + BUG-NNN"           │
│    □ DEV_PROGRESS.md AI 会话追踪表加一行                        │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. commit + push                                                │
│    git add [规范文件] + git commit + git push origin/main       │
│    commit message 格式: "vX.Y.Z: [代码改动] (BUG-NNN + 规范修订)"│
└──────────────────────────────────────────────────────────────┘
```

---

## § 4. 规范时效性自检清单 (AI 必跑)

> **任何 AI 接手 shipin-APP 项目, 必跑本清单**, 找出过时规范, 一次性修订。

### 4.1 5 维过时检查

```bash
# 1. 版本号一致性: 实际跑版本跟规范写版本对得上吗?
curl -s https://ab.maque.uno/api/version
grep "APP_VERSION" apps/server/package.json apps/server/src/index.ts apps/mobile/src/config/version.ts apps/web/src/config/version.ts

# 2. 路径/URL 一致性: 规范里写的路径/URL 跟实际匹配吗?
grep -r "159.75.16.110\|maque.uno\|ab.maque.uno" docs/ apps/mobile/*.md apps/web/DEPLOY.md 2>/dev/null | head -20

# 3. 文件存在性: 规范里引用的文件还在吗?
grep -rE "\bapps/server/deploy\.sh\b|\bapps/web/scripts/deploy\.sh\b|\bapps/mobile/DEPLOY\.md\b" docs/ 2>/dev/null

# 4. 数字一致性: 验证维度 (5 维 vs 6 维) / 8 条铁律 / 32 条规范 数量跟实际一致吗?
grep -c "## " apps/mobile/CODING_STANDARDS.md
grep -c "BUG-" apps/mobile/BUGS.md

# 5. 决策可追溯: 重要规范变更都有 ADR 吗?
ls docs/standards/ADR/ 2>/dev/null | head -20
```

### 4.2 自检发现的常见 GAP (S65 实战)

| GAP | 怎么发现 | 怎么修 |
|---|---|---|
| 数字不一致 (5 维 vs 6 维) | grep 4 份文档发现数量不同 | 明确分工, 加 cross-ref |
| SSH key 矛盾 (mavis-trash vs 持久化) | 读 § 6 + § 4 发现自相矛盾 | 区分作用域 (永久 key 保留 vs 临时 key mavis-trash) |
| URL 过时 (maque.uno/app/ vs ab.maque.uno/app/) | grep 发现规范写老域名 | 修订 + 冻结老规范 |
| 跨端重复 | 对比 VERSION_MANAGEMENT § 5 跟 docs/DEPLOY § 1-2 | 明确分工 (跨端 vs server-only) |
| 缺失配套规范 | 查 web 端 deploy.sh 没 DEPLOY.md | 新建配套规范 |

---

## § 5. 规范文档责任矩阵

> **每个规范文档管什么, 谁负责维护, 跟谁 cross-ref**:

| 规范文档 | 管什么 | 维护触发 | 跨引用 |
|---|---|---|---|
| `docs/VERSION_MANAGEMENT.md` | 跨端版本管理 (mobile + server + web) | § 2 触发 1-3 | → docs/standards/ADR/ |
| `docs/STANDARDS_EVOLUTION.md` (本文件) | 规范自迭代 SOP | § 2 触发 6-7 | → 全部规范文档 |
| `docs/standards/ADR/*.md` | 关键架构决策记录 | § 2 触发 4 (架构变更) | ← VERSION_MANAGEMENT |
| `docs/DEPLOY.md` | server-only 部署 SOP (11 节点) | § 2 触发 4 (server 架构变更) | → VERSION_MANAGEMENT § 5 |
| `apps/mobile/DEPLOY.md` | mobile APK 升级 5 步 + 7 类失败 | § 2 触发 4 (mobile 变更) | → VERSION_MANAGEMENT § 5 |
| `apps/web/DEPLOY.md` | web 部署 (vite build + nginx) | § 2 触发 4 (web 变更) | → VERSION_MANAGEMENT § 5 |
| `apps/mobile/AGENTS.md` | mobile AI 入口 | § 2 触发 1-2 (mobile 改) | → VERSION_MANAGEMENT / DEPLOY / BUGS |
| `apps/mobile/BUGS.md` | mobile 历史 BUG 案例库 | § 2 触发 3 + 5 (mobile 改) | → CODING_STANDARDS |
| `apps/mobile/CODING_STANDARDS.md` | mobile 硬性规范 32 条 | § 2 触发 3 + 5 | ← BUGS |
| `apps/server/changelog.json` | server 版本 changelog 数据源 | § 2 触发 1-3 (server 改) | ← VERSION_MANAGEMENT § 4 |
| `docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md` | 后端 worker 9 条实战约束 | § 2 触发 4-5 (server bug) | → docs/DEPLOY |
| `DEPLOY_v2.0.0.md` | v2.0.0 一次性部署 (历史快照) | 🟡 冻结, 仅参考 | — |

---

## § 6. ADR (Architecture Decision Records) 实践

> **ADR** 是 GitHub 主流架构决策记录方案 (joelparkerhenderson/architecture_decision_record)。
> **shipin-APP 采用轻量级 ADR** 记录关键规范变更决策背景, 让未来的 AI 能追溯"为什么这么改"。

### 6.1 ADR 目录

- **位置**: `docs/standards/ADR/`
- **命名**: `<adr-number>-<short-title>.md` (e.g. `0001-server-changelog-source-of-truth.md`)
- **索引**: `docs/standards/ADR/README.md` (维护编号 + 标题 + 状态)

### 6.2 ADR 模板

每份 ADR 必含 6 个标准模块:

```markdown
# ADR-NNNN: <一句话标题>

- **状态**: Proposed / Reviewing / Accepted / Superseded by ADR-NNNN
- **日期**: YYYY-MM-DD
- **决策者**: Sxx (AI 会话号) / User

## 背景 (Context)

描述当时面临的需求 / 技术约束 / 环境痛点。
"为什么需要做这个决策?"

## 决策 (Decision)

明确"是什么", 采用肯定句式, 减少模糊空间。
"我们决定..."

## 影响 (Consequences)

**正面收益**:
- ...

**负面代价 (必须忍受)**:
- ...

**后续风险**:
- ...

## 一致性 (Compliance)

如何确保决策被执行:
- CI 检查?
- Code Review checklist?
- grep 关键字自检?

## 替代方案 (Considered Alternatives)

考虑过但没选的方案 + 理由。
- 方案 A: ... (为什么没选)
- 方案 B: ... (为什么没选)

## 配套变更 (Related Changes)

- BUG-NNN
- 规范修订
- ADR 引用
```

### 6.3 ADR 状态机

```
Proposed ──→ Reviewing ──→ Accepted ──→ Superseded (被新 ADR 取代)
   │              │              │
   │              │              └─→ 永不删, 留作历史
   │              └─→ 拒绝 (Rejected) ──→ 留 ADR 但标 Rejected
   └─→ 撤回 (Withdrawn)
```

### 6.4 必写 ADR 的场景

满足任一, 必新建 ADR:

1. **架构重大变更** (e.g. 引入 monorepo, 引入 Agent 矩阵, 引入新部署平台)
2. **规范冲突决策** (e.g. 5 维 vs 6 维验证分工, SSH key 持久化 vs mavis-trash)
3. **跨 AI 行为约定** (e.g. 规范自迭代 SOP, AGENTS.md 强制阅读列表)
4. **技术选型** (e.g. Vite vs Next.js, 字符化 vs 二维化 SDK, monorepo 包)
5. **撤换核心依赖** (e.g. Redis 替代品, MySQL → PostgreSQL)

---

## § 7. 跨 AI 协作约定

> **任何 AI 接手 shipin-APP 项目, 必读本节**:

### 7.1 读规范优先级 (从高到低)

1. **`docs/STANDARDS_EVOLUTION.md`** (本文件) — 怎么读 + 写规范
2. **`docs/VERSION_MANAGEMENT.md`** — 跨端版本管理
3. **`apps/mobile/AGENTS.md`** (mobile 改时) — mobile AI 入口
4. **`docs/DEPLOY.md`** (server 部署时) — server-only SOP
5. **`apps/mobile/DEPLOY.md`** (mobile 升级时) — APK 流程
6. **`apps/web/DEPLOY.md`** (web 部署时) — web 部署
7. **`apps/mobile/BUGS.md`** (mobile 改时) — 历史 BUG 防踩坑
8. **`apps/mobile/CODING_STANDARDS.md`** (mobile 改时) — 硬性规范
9. **`docs/standards/ADR/`** (架构变更时) — 决策记录

### 7.2 写规范约定

1. **统一格式**: markdown, 用 # ## ### 三级标题
2. **统一编号**: BUG-NNN / 规范 N+1 / ADR-NNNN 递增, 不重用
3. **统一 cross-ref**: 文档间用相对路径 `../../docs/VERSION_MANAGEMENT.md`, 不用绝对路径
4. **统一 commit message**: `vX.Y.Z: <一句话> (BUG-NNN + 规范修订)`
5. **统一时间戳**: 文档最后更新用 `YYYY-MM-DD` (ISO 8601)
6. **统一 emoji**: 状态用 ✅ / ⚠️ / ❌ / 🔴 / 🟡 / 🟢, 不用 🚀 🎉 (跟 BUG-062 一致)
7. **统一语言**: 中文为主, 代码 / 路径 / 命令保持英文

### 7.3 commit 规范

```bash
git add apps/server/changelog.json \
        docs/VERSION_MANAGEMENT.md \
        docs/standards/ADR/0001-xxx.md \
        apps/mobile/BUGS.md
git commit -m "v3.0.30: 跨端版本管理统一规范 (BUG-066/067/068 + ADR-0001)"
git push origin main
```

### 7.4 写 BUG 必触发规范修订

**修完 BUG 后** (触发 § 2 #5):
- 追加 `BUGS.md` BUG-NNN (强制)
- 提炼新规范追加 `CODING_STANDARDS.md` 第 N+1 条
- (可选) 新建 `docs/standards/ADR/NNNN-xxx.md` 记录决策背景

---

## § 8. 实战案例 (S65, 2026-06-24)

### § 8.1 触发原因

User 反馈: "部署流程是否有相关规范?" + "需要 AI 自我更新迭代规范文件"。

### § 8.2 自检发现 (5 个 GAP)

1. **GAP #1**: 5 维 vs 6 维验证标准不一致 (4 处文档冲突)
2. **GAP #2**: SSH key 持久化 vs mavis-trash 自相矛盾
3. **GAP #3**: `docs/APP_RELEASE_GUIDE.md` 严重过时 (v1.1.0 时代)
4. **GAP #4**: 缺乏跨端统一入口 (5 个文档讲部署)
5. **GAP #5**: web 端无配套规范文档

### § 8.3 修订动作 (10 个文件)

- 修订 2: `docs/DEPLOY.md` (5/6 维分工 + SSH key 区分), `docs/APP_RELEASE_GUIDE.md` (冻结)
- 新建 6: `docs/STANDARDS_EVOLUTION.md` (本文件), `apps/web/DEPLOY.md`, `docs/standards/ADR/{README, 0000-template, 0001-changelog-source}.md`
- 修订 1: `VERSION_MANAGEMENT.md` § 9 (跨端入口 + STANDARDS_EVOLUTION 引用)
- 修订 1: `apps/mobile/AGENTS.md` + `CODING_STANDARDS.md` (引用 STANDARDS_EVOLUTION)

### § 8.4 验证

- ✅ `git diff --stat` 看改动范围
- ✅ 文档间 cross-ref 全部链接可点
- ✅ ADR-0001 决策背景清晰, 未来 AI 可追溯

---

## § 9. 配套文档索引

| 文档 | 关系 |
|---|---|
| [`VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) | 跨端版本管理 (本文件的 § 7 触发条件来自 VERSION_MANAGEMENT § 7) |
| [`docs/standards/ADR/`](./standards/ADR/) | ADR 实践 (本文件 § 6 规范 ADR 怎么写) |
| [`docs/DEPLOY.md`](./DEPLOY.md) | server 部署 (本文件 § 5 责任矩阵) |
| [`apps/mobile/DEPLOY.md`](../apps/mobile/DEPLOY.md) | mobile 部署 |
| [`apps/web/DEPLOY.md`](../apps/web/DEPLOY.md) | web 部署 (S65 新建) |
| [`apps/mobile/AGENTS.md`](../apps/mobile/AGENTS.md) | mobile AI 入口 (引用本文件 § 7) |
| [`apps/mobile/CODING_STANDARDS.md`](../apps/mobile/CODING_STANDARDS.md) | mobile 硬性规范 |
| [`apps/mobile/BUGS.md`](../apps/mobile/BUGS.md) | mobile BUG 案例库 |
| [`DEV_PROGRESS.md`](../DEV_PROGRESS.md) | AI 会话追踪表 (本文件修订必加新行) |

---

> **最后更新**: 2026-06-24 (S65)
> **下次 review**: 每个 3 类发版后必更新本文件 + 加新 ADR
