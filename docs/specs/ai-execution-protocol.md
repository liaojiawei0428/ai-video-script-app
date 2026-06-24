# AI执行规范与问题处理协议

> 文档版本: v1.0
> 创建日期: 2026-05-13
> 用途: 确保所有AI助手按统一标准执行项目开发

---

## 1. 执行前必读

### 1.1 强制检查清单

每个AI在开始工作前必须确认：

- [ ] 已阅读 `docs/specs/2026-05-13-ai-video-script-design.md`（系统设计）
- [ ] 已阅读 `docs/plans/2026-05-13-implementation-plan.md`（实施计划）
- [ ] 已阅读本文档（执行规范）
- [ ] 已检查当前项目文件状态（哪些已创建、哪些待实现）
- [ ] 已确认技术栈版本与文档一致

### 1.2 技术栈锁定

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20.0.0 | 后端运行时 |
| React Native | 0.73+ | 移动端框架 |
| TypeScript | ^5.4.0 | 开发语言 |
| Express | ^4.19.0 | Web框架 |
| SQLite | ^5.1.7 (sqlite3) | 本地数据库 |
| Redis | 7.x | 任务队列 |
| BullMQ | ^5.7.0 | 队列管理 |
| Deepseek API | V4 | AI模型 |

**禁止**未经讨论擅自更换技术栈。

---

## 2. 代码规范

### 2.1 文件组织

```
必须严格遵循以下目录结构：

ai-video-script-app/
├── apps/
│   ├── mobile/          # React Native App
│   └── server/          # Node.js后端
├── packages/
│   ├── shared-types/    # 共享类型
│   └── shared-utils/    # 共享工具
└── docs/                # 文档
```

### 2.2 命名规范

- **文件**: 驼峰式，如 `novelService.ts`
- **类名**: PascalCase，如 `NovelService`
- **函数**: camelCase，如 `analyzeNovel`
- **常量**: UPPER_SNAKE_CASE，如 `MAX_FILE_SIZE`
- **数据库字段**: snake_case，如 `created_at`
- **API路由**: kebab-case，如 `/api/novels/upload`

### 2.3 TypeScript严格规则

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### 2.4 错误处理规范

所有异步函数必须使用try-catch：

```typescript
// ✅ 正确
async function processNovel(novelId: string): Promise<Result> {
  try {
    const novel = await novelModel.findById(novelId);
    if (!novel) {
      throw new AppError('NOVEL_NOT_FOUND', `Novel ${novelId} not found`);
    }
    // ...
  } catch (error) {
    logger.error('Failed to process novel', { novelId, error });
    throw error;
  }
}

// ❌ 错误
async function processNovel(novelId: string) {
  const novel = await novelModel.findById(novelId);
  // 没有错误处理
}
```

---

## 3. 数据一致性规范

### 3.1 类型与数据库同步

**规则**: `shared-types`中的接口必须与数据库表结构严格对应。

检查方法：
1. 修改类型 → 必须同步修改数据库初始化SQL
2. 新增字段 → 必须在所有模型方法中处理
3. 删除字段 → 必须检查是否有代码引用

### 3.2 状态机规范

Novel状态流转：

```
pending → analyzing → analyzed → generating → completed
   ↓         ↓           ↓           ↓            ↓
 error ←──────←──────←──────←──────←──────←──────┘
```

**禁止**的状态跳转：
- `pending` → `completed`（必须经过分析和生成）
- `analyzing` → `generating`（必须先完成分析）

---

## 4. API开发规范

### 4.1 响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-05-13T10:00:00Z",
    "requestId": "uuid"
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读的错误信息",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-05-13T10:00:00Z",
    "requestId": "uuid"
  }
}
```

### 4.2 错误码规范

| 错误码 | HTTP状态 | 说明 |
|--------|---------|------|
| `NOVEL_NOT_FOUND` | 404 | 小说不存在 |
| `TASK_NOT_FOUND` | 404 | 任务不存在 |
| `INVALID_FILE_TYPE` | 400 | 不支持的文件类型 |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 |
| `DEEPSEEK_API_ERROR` | 502 | AI服务调用失败 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求过于频繁 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 5. AI协作问题处理流程

### 5.1 发现问题时的处理步骤

当AI在执行过程中发现方案问题，按以下流程处理：

```
Step 1: 暂停当前任务
        ↓
Step 2: 记录问题详情（位置、影响、建议）
        ↓
Step 3: 判断问题级别
        ├── P0-阻塞性（无法继续开发）
        │   └── 立即报告用户，等待决策
        ├── P1-严重性（影响功能正确性）
        │   └── 记录到 issues.md，继续开发其他部分
        └── P2-优化性（建议改进）
            └── 记录到 improvements.md，按原计划继续
        ↓
Step 4: 更新相关文档
        ↓
Step 5: 继续执行（P0需等待用户确认）
```

### 5.2 问题记录格式

在 `docs/issues.md` 中记录：

```markdown
## Issue-[编号]: [标题]

**发现时间**: 2026-05-13
**发现AI**: [AI标识]
**问题级别**: P0/P1/P2
**影响范围**: [模块/功能]
**问题描述**: 
[详细描述]

**建议方案**:
[如何修复]

**状态**: 待处理/处理中/已解决
**解决方案**: [解决后的记录]
```

### 5.3 允许AI自主决策的范围

**无需请示，可自主决定**：
- 代码风格微调（命名、格式）
- 简单的错误处理补充
- 日志输出优化
- 注释补充

**必须请示用户**：
- 技术栈变更
- 架构调整
- 新增/删除功能模块
- 数据库结构变更
- API接口变更
- 第三方库替换

---

## 6. 代码审查检查点

### 6.1 提交前自检清单

- [ ] 代码能通过 TypeScript 编译（`tsc --noEmit`）
- [ ] 没有 `any` 类型（除非有明确注释说明原因）
- [ ] 所有异步操作有错误处理
- [ ] 数据库操作有事务保护（多表操作时）
- [ ] 没有硬编码的密钥/密码
- [ ] 日志中没有敏感信息输出
- [ ] 新增代码有对应测试（单元测试或集成测试）

### 6.2 常见错误防范

| 错误类型 | 防范措施 |
|---------|---------|
| SQL注入 | 使用参数化查询，禁止字符串拼接SQL |
| JSON解析失败 | 使用try-catch包裹JSON.parse，提供默认值 |
| 内存泄漏 | 大文本使用流式处理，及时释放引用 |
| 竞态条件 | 数据库操作使用事务，队列任务使用原子操作 |
| 超时挂起 | 所有外部API调用设置超时 |

---

## 7. 文档同步规范

### 7.1 文档更新触发条件

以下情况必须更新文档：
- 新增API接口 → 更新API设计章节
- 修改数据库表结构 → 更新数据模型章节
- 变更技术栈 → 更新技术栈选型表
- 发现设计缺陷 → 更新风险与应对表

### 7.2 文档版本管理

```
文档更新时必须：
1. 更新 "更新日期"
2. 在变更日志中添加条目
3. 如为重大变更，递增版本号（v1.0 → v1.1）
```

---

## 7.3 AI 思考语言规范

**强制要求**：所有 AI 在分析本项目代码、排查问题、设计方案、审查代码时，思考过程必须使用**中文**，禁止使用英文。

> 📌 **规范维护说明**: 本节内容跟项目根 `AGENTS.md` § "Thinking & Response Language Constraint" 1:1 同步。
> 改本节时必同步 `AGENTS.md`, 反之亦然。以 `AGENTS.md` 为权威源。

---

## 8. 测试规范

### 8.1 测试覆盖要求

| 模块 | 最低覆盖率 |
|------|-----------|
| Services | 80% |
| Models | 70% |
| Utils | 90% |
| API Routes | 60% |

### 8.2 必须测试的场景

- 文件上传（空文件、大文件、错误格式）
- Deepseek API调用（成功、失败、超时、限流）
- 数据库操作（并发、边界值、空值）
- 状态流转（正常流程、异常流程）

---

*本文档为强制执行规范，所有AI在开发前必须阅读并遵守。*
