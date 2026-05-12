# AI视频剧本生成应用 - 系统设计文档

> 文档版本: v1.2  
> 创建日期: 2026-05-13  
> 更新日期: 2026-05-13  
> 技术栈: React Native + Node.js + Deepseek V4 API  
> 部署目标: 腾讯云服务器
>
> **关联文档**:
> - [AI执行规范](../specs/ai-execution-protocol.md) - 所有AI必须遵守
> - [问题追踪](../issues.md) - 已知问题和修复状态
> - [实施计划](../plans/2026-05-13-implementation-plan.md) - 详细开发步骤

---

## 1. 项目概述

### 1.1 应用定位

开发一款移动端应用（Android + iOS），能够将长篇小说（最高支持50万字）智能转换为符合AI视频生成网站要求的标准剧本。生成的剧本可直接用于AI视频制作，同时支持后续人工剪辑合成。

### 1.2 核心功能

- 支持上传50万字规模的小说文本文件（TXT/EPUB/DOCX）
- 通过调用Deepseek API执行文本分析，获取小说关键信息
- 实现剧本结构化生成，包括剧集划分和单集剧本创作
- 确保每集剧本时长控制在120秒左右（±10秒）
- 为每集剧本生成详细的镜头画面描述
- 实现剧本内容的信息分拣与结构化存储

### 1.3 差异化定位

| 维度 | 现有方案 | 本应用 |
|------|---------|--------|
| 平台 | 多为桌面端/Web | **React Native移动端**，随时随地操作 |
| 后端 | 部分无后端或重型后端 | **轻量Node.js代理**，部署在腾讯云 |
| LLM | 多支持OpenAI/Claude | **专注Deepseek**，深度优化提示词 |
| 输出 | 直接生成视频 | **专注剧本+分镜**，不绑定视频平台，更通用 |
| 时长控制 | 较少精确控制 | **120秒±10秒精确控制**，适配短视频平台 |
| 存储 | 云端为主 | **本地SQLite + 后端缓存**，兼顾离线 |

---

## 2. 系统架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户层 (移动端)                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    React Native App (iOS/Android)                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │    │
│  │  │   上传模块    │  │  任务管理模块  │  │    剧本展示/编辑模块   │  │    │
│  │  │ (文件选择    │  │ (进度跟踪    │  │  (剧本阅读器、        │  │    │
│  │  │  分块上传)   │  │  状态管理)   │  │   镜头列表、导出)     │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │              SQLite 本地数据库 (剧本缓存)                  │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────────────┐
│                              服务层 (腾讯云)                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              Node.js + Express 后端服务                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │    │
│  │  │   文件服务    │  │  任务调度器   │  │    Deepseek API代理   │  │    │
│  │  │ (接收上传    │  │ (分析流水线   │  │  (流式请求、          │  │    │
│  │  │  临时存储)   │  │  队列管理)   │  │   响应解析、重试)     │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │              Redis (任务队列 + 缓存)                       │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ API
┌─────────────────────────────────────────────────────────────────────────┐
│                           Deepseek API (云端)                            │
│              (小说分析 / 剧集划分 / 剧本生成 / 镜头描述)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心数据流

1. **上传阶段**：App将小说文件分块上传 → 后端合并存储 → 返回任务ID
2. **分析阶段**：后端读取文件 → 按策略分块 → 调用Deepseek API → 聚合分析结果
3. **生成阶段**：基于分析结果，后端编排多轮API调用 → 生成剧集划分 → 逐集生成剧本
4. **同步阶段**：后端通过WebSocket推送进度 → App接收并存储到本地SQLite
5. **使用阶段**：用户在App中浏览、编辑、导出剧本

### 2.3 技术栈选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 移动端 | React Native 0.73+ | 跨平台框架 |
| 移动端状态管理 | Zustand | 轻量状态管理 |
| 移动端存储 | SQLite (react-native-sqlite-storage) | 结构化剧本数据 |
| 移动端网络 | Axios + Socket.io-client | HTTP + 实时推送 |
| 后端 | Node.js 20 + Express | API服务 |
| 后端任务队列 | BullMQ (Redis) | 可靠的任务调度 |
| 后端存储 | 本地文件系统 + Redis | 临时文件+缓存 |
| 通信 | REST API + WebSocket | 双通道保障 |

---

## 3. 数据模型设计

### 3.1 实体关系图

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Novel       │───────│   Episode       │───────│     Shot        │
│  (小说/项目)     │ 1:N   │   (剧集/分集)    │ 1:N   │   (镜头画面)     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ title           │       │ novel_id        │       │ episode_id      │
│ author          │       │ episode_number  │       │ shot_number     │
│ content_text    │       │ title           │       │ description     │
│ total_chars     │       │ summary         │       │ camera_angle    │
│ genre           │       │ duration_sec    │       │ camera_move     │
│ theme           │       │ scene_location  │       │ lighting        │
│ style           │       │ characters      │       │ duration_sec    │
│ status          │       │ script_content  │       │ audio_note      │
│ created_at      │       │ status          │       │ status          │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                         │
         │                ┌────────┘
         │                │
         ▼                ▼
┌─────────────────┐       ┌─────────────────┐
│   Character     │       │   TaskJob       │
│   (角色设定)     │       │   (任务作业)     │
├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │
│ novel_id        │       │ novel_id        │
│ name            │       │ type            │
│ aliases         │       │ status          │
│ appearance      │       │ progress        │
│ personality     │       │ result_data     │
│ role_type       │       │ error_msg       │
│ relationships   │       │ created_at      │
│ reference_image │       │ completed_at    │
└─────────────────┘       └─────────────────┘
```

### 3.2 数据表结构

#### novels 表（小说项目）

```sql
CREATE TABLE novels (
    id TEXT PRIMARY KEY,           -- UUID
    title TEXT NOT NULL,
    author TEXT,
    content_text TEXT,             -- 原文（已废弃，改为文件存储，见Issue-001）
    file_path TEXT,                -- 小说原文文件路径（uploads/novels/{id}.txt）
    total_chars INTEGER,
    total_words INTEGER,
    genre TEXT,                    -- 类型：玄幻/都市/言情...
    theme TEXT,                    -- 主题
    style TEXT,                    -- 风格定位
    tone TEXT,                     -- 情感基调
    status TEXT DEFAULT 'pending', -- pending/analyzing/analyzed/generating/completed/error
    created_at INTEGER,            -- Unix timestamp
    updated_at INTEGER
);
```

#### episodes 表（剧集）

```sql
CREATE TABLE episodes (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT,
    summary TEXT,                  -- 本集摘要
    duration_sec INTEGER DEFAULT 120, -- 目标时长
    scene_location TEXT,           -- 主要场景
    characters TEXT,               -- JSON数组：出场角色
    script_content TEXT,           -- 完整剧本内容
    script_format TEXT,            -- 剧本格式版本
    status TEXT DEFAULT 'pending',
    created_at INTEGER,
    FOREIGN KEY (novel_id) REFERENCES novels(id)
);
```

#### shots 表（镜头画面）

```sql
CREATE TABLE shots (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    shot_number INTEGER NOT NULL,
    scene_type TEXT,               -- INT/EXT
    location TEXT,
    time_of_day TEXT,              -- 日/夜/晨/昏
    description TEXT,              -- 画面描述（给AI视频生成用）
    camera_angle TEXT,             -- 景别：特写/近景/中景/全景/远景
    camera_move TEXT,              -- 运镜：推/拉/摇/移/跟/升/降/固定
    lighting TEXT,                 -- 灯光：自然光/侧光/逆光/顶光...
    duration_sec REAL,             -- 镜头时长
    audio_note TEXT,               -- 音效/配乐提示
    dialogue TEXT,                 -- 对白内容
    action TEXT,                   -- 动作描述
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (episode_id) REFERENCES episodes(id)
);
```

#### characters 表（角色设定）

```sql
CREATE TABLE characters (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT,                  -- JSON数组：别名
    appearance TEXT,               -- 外貌特征
    personality TEXT,              -- 性格特点
    role_type TEXT,                -- protagonist/antagonist/supporting
    relationships TEXT,            -- JSON：人物关系图谱
    reference_image TEXT,          -- 参考图URL（可选）
    created_at INTEGER,
    FOREIGN KEY (novel_id) REFERENCES novels(id)
);
```

#### task_jobs 表（任务追踪）

```sql
CREATE TABLE task_jobs (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    type TEXT NOT NULL,            -- upload/analyze/episode_generate/shot_generate
    status TEXT DEFAULT 'queued',  -- queued/running/completed/failed
    progress INTEGER DEFAULT 0,    -- 0-100
    total_steps INTEGER,
    current_step INTEGER,
    result_data TEXT,              -- JSON：结果摘要
    error_msg TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    completed_at INTEGER
);
```

---

## 4. API交互设计

### 4.1 Deepseek API 调用策略

**重要更新**：使用 **Deepseek V4**（支持100万上下文 ≈ 150万字），50万字小说可以**一次性输入**，大幅简化处理流程。

#### 优化后的处理策略

```
┌─────────────────────────────────────────────────────────────────┐
│              Deepseek V4 长上下文处理流程（50万字）                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  策略：全文一次性分析 + 分批次生成                                │
│                                                                  │
│  Step 1: 全文分析（1次API调用）                                  │
│  ├── 输入：完整50万字小说 + 结构化分析Prompt                     │
│  ├── 输出：类型、角色、场景、主题、剧情节点（JSON）               │
│  └── 利用V4的100万上下文能力，避免分块聚合的复杂度                │
│                                                                  │
│  Step 2: 剧集划分（1次API调用）                                  │
│  ├── 输入：分析结果 + 时长约束Prompt                             │
│  ├── 输出：剧集划分方案（每集起止位置、标题、摘要）               │
│  └── 由AI基于全局理解做最优划分                                   │
│                                                                  │
│  Step 3: 逐集生成（并行调用）                                    │
│  ├── 每集独立调用：对应原文片段 + 角色设定 + 生成Prompt           │
│  ├── 输出：标准剧本 + 镜头描述                                    │
│  └── 可并行处理（受API并发限制）                                  │
│                                                                  │
│  对比旧方案：                                                    │
│  ├── 旧方案（64K上下文）：约 30+ 次API调用                       │
│  └── 新方案（100万上下文）：约 1 + 1 + N集 次调用                │
│      （50集小说约52次，减少80%调用次数）                          │
└─────────────────────────────────────────────────────────────────┘
```

#### API调用流水线（V4优化版）

| 阶段 | API调用目的 | 输入 | 输出 | 调用次数 |
|------|------------|------|------|----------|
| **P1-全文分析** | 一次性提取所有关键信息 | 完整50万字小说 + 分析Prompt | genre, characters[], scenes[], plot_points[] | **1次** |
| **P2-剧集划分** | 基于全局理解划分剧集 | 分析结果 + 时长约束 | episodes[]（每集起止位置） | **1次** |
| **P3-剧本生成** | 逐集生成标准剧本 | 每集原文 + 角色设定 | script_content | 集数 × 1次 |
| **P4-镜头生成** | 逐集生成镜头描述 | 剧本 + 场景设定 | shots[] | 集数 × 1次 |

> **50万字小说预估**：1次全文分析 + 1次剧集划分 + 约40集剧本/镜头生成 = **约42次API调用**（比旧方案减少86%）

#### 降级策略

若V4暂时不可用，自动降级为分块处理模式：
- 检测上下文限制 → 自动切换分块策略
- 保持输出格式一致，对上层透明

### 4.2 Deepseek Prompt 设计规范

#### Prompt 模板结构（以角色提取为例）

```typescript
// prompts/characterExtraction.ts
export const characterExtractionPrompt = (chunk: string, context: string) => `
你是一位专业的小说分析专家。请从以下小说文本中提取所有角色信息。

## 分析要求
1. 识别所有出场角色，包括主要角色和次要角色
2. 提取角色的外貌特征、性格特点、身份背景
3. 分析角色之间的关系
4. 标记角色的重要性级别（主角/配角/龙套）

## 输出格式（严格JSON）
{
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名1", "别名2"],
      "appearance": "外貌描述（50字内）",
      "personality": "性格特点（50字内）",
      "identity": "身份/职业",
      "role_type": "protagonist|antagonist|supporting|minor",
      "importance": 1-10,
      "relationships": [
        {"target": "相关角色名", "relation": "关系类型"}
      ],
      "first_appearance": "首次出场章节"
    }
  ]
}

## 上下文信息
${context}

## 待分析文本
${chunk}

请只输出JSON，不要有任何其他说明文字。
`;
```

#### 关键Prompt设计原则

1. **输出格式严格约束**：强制JSON输出，便于后端解析
2. **上下文注入**：每次调用携带已分析结果的摘要，保持连贯性
3. **Token预估**：输入文本 + Prompt ≈ 80% 上下文窗口，预留输出空间
4. **温度控制**：分析阶段 temperature=0.3（确定性），生成阶段 temperature=0.7（创造性）

### 4.3 后端API代理设计

#### 核心接口定义

```typescript
// 1. 小说上传
POST /api/novels/upload
  body: multipart/form-data (file)
  response: { novelId: string, status: 'uploaded' }

// 2. 启动分析任务
POST /api/novels/:novelId/analyze
  response: { taskId: string, status: 'queued' }

// 3. 查询任务进度（WebSocket优先，HTTP轮询兜底）
GET /api/tasks/:taskId/progress
  response: { progress: number, status: string, currentStep: string }

// WebSocket: ws://server/tasks/:taskId
// 实时推送: { type: 'progress', data: { progress, status, detail } }

// 4. 获取分析结果
GET /api/novels/:novelId/analysis
  response: { genre, theme, style, tone, characters[], scenes[], plotPoints[] }

// 5. 生成剧集
POST /api/novels/:novelId/episodes/generate
  body: { targetDuration: 120, tolerance: 10 }
  response: { taskId: string, episodeCount: number }

// 6. 获取剧集列表
GET /api/novels/:novelId/episodes
  response: { episodes: [{ id, number, title, duration, status }] }

// 7. 获取单集剧本
GET /api/episodes/:episodeId/script
  response: { scriptContent, shots: [] }

// 8. 重新生成单集
POST /api/episodes/:episodeId/regenerate
  body: { customPrompt?: string }

// 9. 导出剧本
GET /api/novels/:novelId/export
  query: { format: 'json' | 'pdf' | 'docx' }
  response: file stream
```

#### 后端服务层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Express App                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  路由层      │  │  中间件      │  │      控制器              │ │
│  │  (Routes)   │  │ (Auth/Valid)│  │   (Controllers)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      服务层 (Services)                        ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │ NovelService │  │ TaskService  │  │ DeepseekService  │  ││
│  │  │ (小说管理)    │  │ (任务调度)   │  │ (API调用封装)     │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │ScriptService │  │ ShotService  │  │ ExportService    │  ││
│  │  │ (剧本生成)   │  │ (镜头生成)   │  │ (导出处理)       │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      数据层 (Data Layer)                      ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │   SQLite     │  │    Redis     │  │   File Storage   │  ││
│  │  │ (剧本数据)   │  │ (任务队列)   │  │ (临时文件)       │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 核心算法设计

### 5.1 剧集划分算法

**目标**：将小说内容划分为若干集，每集时长控制在120秒±10秒。

#### 算法思路

```
输入: 剧情节点列表 plotPoints[], 每集目标时长 T=120s, 容差 Δ=10s
输出: 剧集划分方案 episodes[]

步骤:
1. 计算每个剧情节点的"叙事权重"（由Deepseek分析给出，1-10分）
   - 权重因素：冲突强度、情感浓度、信息量、视觉化程度

2. 将剧情节点按时间顺序排列，计算累积时长
   - 每个节点预估时长 = 基础时长(15s) + 对话字数×0.5s + 动作描述×0.3s

3. 动态规划求解最优划分
   - 状态: dp[i] = 前i个节点划分后的最小误差平方和
   - 转移: dp[i] = min(dp[j] + (sum_duration(j+1,i) - T)²) for j < i
   - 约束: |sum_duration(j+1,i) - T| ≤ Δ

4. 边界处理
   - 如果某段内容无法填满一集，允许与相邻集合并
   - 确保每集至少包含一个"高潮节点"（权重≥7）

5. 输出每集对应的原文起止位置
```

#### 时长估算公式

```typescript
function estimateDuration(content: string): number {
  const dialogueMatches = content.match(/["「『].*?["」』]/g) || [];
  const actionMatches = content.match(/[^「」"']{10,50}/g) || [];
  
  const dialogueDuration = dialogueMatches.length * 3; // 每句对话约3秒
  const actionDuration = actionMatches.length * 2;     // 每个动作约2秒
  const transitionDuration = 5; // 场景转场5秒
  
  return dialogueDuration + actionDuration + transitionDuration;
}
```

### 5.2 剧本格式标准

参考行业标准和AI视频生成平台要求，设计如下格式：

```json
{
  "episode": {
    "number": 1,
    "title": "第一集：命运的相遇",
    "duration": 118,
    "scenes": [
      {
        "scene_id": "S01",
        "location": "咖啡厅内",
        "time": "日",
        "description": "阳光透过落地窗洒进咖啡厅，男主坐在角落的位置，手中握着一杯已经凉透的咖啡。",
        "shots": [
          {
            "shot_id": "S01-01",
            "type": "establishing",
            "angle": "全景",
            "move": "固定",
            "duration": 5,
            "description": "咖啡厅全景，暖色调，阳光从右侧窗户斜射进来，几桌客人在轻声交谈。",
            "audio": "轻柔的钢琴背景音乐，环境嘈杂声"
          },
          {
            "shot_id": "S01-02",
            "type": "medium",
            "angle": "中景",
            "move": "推",
            "duration": 8,
            "description": "男主侧脸中景，眼神忧郁，手指无意识地摩挲着咖啡杯边缘。",
            "dialogue": "（内心独白）三年了，我还是忘不了她。",
            "audio": "钢琴音乐渐弱，心跳声渐强"
          }
        ]
      }
    ]
  }
}
```

---

## 6. 移动端界面设计

### 6.1 核心页面结构

```
┌─────────────────────────────────────────────────────────────────┐
│  App (React Native Navigation)                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  首页        │  │  项目页      │  │      我的               │ │
│  │  (HomeTab)  │  │(ProjectsTab)│  │   (ProfileTab)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                  │
│  页面栈:                                                         │
│  ├── HomeTab                                                     │
│  │   └── NovelUploadScreen (文件上传)                            │
│  │       └── TaskProgressScreen (进度追踪)                       │
│  │           └── AnalysisResultScreen (分析结果)                 │
│  │               └── EpisodeListScreen (剧集列表)                │
│  │                   └── ScriptDetailScreen (剧本详情)           │
│  │                       └── ShotListScreen (镜头清单)           │
│  │                           └── ExportScreen (导出)            │
│  ├── ProjectsTab                                                 │
│  │   └── ProjectListScreen (项目列表)                           │
│  │       └── ProjectDetailScreen (项目详情)                     │
│  └── ProfileTab                                                  │
│      └── SettingsScreen (设置)                                  │
│          └── ApiKeyScreen (API配置)                             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 关键界面原型

#### 文件上传页
- 支持 TXT/EPUB/DOCX 格式
- 显示文件大小和字数统计
- 上传进度条 + 分块上传指示

#### 进度追踪页
- 环形进度条显示整体进度
- 分阶段列表（分析中/生成中/已完成）
- 实时日志输出区域
- 预计剩余时间

#### 剧本详情页
- 分集Tab切换
- 剧本内容阅读器（支持高亮角色名、场景）
- 底部操作栏：编辑/重新生成/导出

#### 镜头清单页
- 卡片式镜头列表
- 每卡显示：镜头编号、景别图标、时长、缩略描述
- 点击展开完整描述和运镜说明

---

## 7. 项目目录结构

```
ai-video-script-app/
├── 📁 apps/
│   ├── 📁 mobile/                    # React Native App
│   │   ├── 📁 src/
│   │   │   ├── 📁 api/              # API客户端
│   │   │   ├── 📁 components/       # 公共组件
│   │   │   ├── 📁 screens/          # 页面
│   │   │   ├── 📁 navigation/       # 路由配置
│   │   │   ├── 📁 store/            # Zustand状态管理
│   │   │   ├── 📁 db/               # SQLite数据库操作
│   │   │   ├── 📁 utils/            # 工具函数
│   │   │   └── 📁 types/            # TypeScript类型
│   │   ├── App.tsx
│   │   └── package.json
│   │
│   └── 📁 server/                    # Node.js后端
│       ├── 📁 src/
│       │   ├── 📁 routes/           # API路由
│       │   ├── 📁 controllers/      # 控制器
│       │   ├── 📁 services/         # 业务服务
│       │   ├── 📁 models/           # 数据模型
│       │   ├── 📁 prompts/          # Deepseek Prompt模板
│       │   ├── 📁 utils/            # 工具函数
│       │   ├── 📁 middleware/       # 中间件
│       │   ├── 📁 jobs/             # BullMQ任务处理器
│       │   └── 📁 types/            # TypeScript类型
│       ├── 📁 uploads/              # 临时上传目录
│       ├── 📁 scripts/              # 部署脚本
│       ├── docker-compose.yml
│       └── package.json
│
├── 📁 packages/
│   ├── 📁 shared-types/              # 共享类型定义
│   └── 📁 shared-utils/              # 共享工具函数
│
├── 📁 docs/                          # 文档
│   └── 📁 specs/                     # 设计规范
│
├── turbo.json                        # Monorepo配置
└── package.json
```

---

## 8. 实施阶段规划

### Phase 1: 核心流水线（MVP）

**目标**：实现文件上传 → 小说分析 → 剧集划分 → 剧本生成 → 本地存储的完整流程

| 模块 | 任务 | 预估工时 |
|------|------|---------|
| 后端基础 | Express项目搭建、数据库初始化、文件上传接口 | 2天 |
| 后端分析 | Deepseek API封装、文本分块、Prompt设计 | 3天 |
| 后端生成 | 剧集划分算法、剧本生成、镜头生成 | 3天 |
| 移动端基础 | React Native项目搭建、导航、SQLite | 2天 |
| 移动端上传 | 文件选择、分块上传、进度显示 | 2天 |
| 移动端展示 | 分析结果页、剧集列表、剧本阅读器 | 3天 |
| 联调测试 | 端到端测试、Bug修复 | 2天 |

**Phase 1 总计：约17天**

### Phase 2: 用户体验优化

**目标**：进度实时推送、剧本编辑、镜头微调、导出功能

| 模块 | 任务 | 预估工时 |
|------|------|---------|
| WebSocket | 实时进度推送、任务状态同步 | 2天 |
| 剧本编辑 | 富文本编辑器、角色高亮、场景标记 | 3天 |
| 镜头微调 | 镜头描述编辑、时长调整、顺序调整 | 2天 |
| 导出功能 | JSON/TXT/PDF导出、分享功能 | 2天 |
| UI优化 | 动画、过渡、主题切换 | 2天 |

**Phase 2 总计：约11天**

### Phase 3: 高级功能

**目标**：批量处理、云端同步、多小说管理、模板自定义

| 模块 | 任务 | 预估工时 |
|------|------|---------|
| 多项目管理 | 小说列表、搜索、分类 | 2天 |
| 用户系统 | 注册登录、多设备同步 | 3天 |
| 模板系统 | 剧本模板、镜头模板、自定义Prompt | 3天 |
| 批量操作 | 批量生成、批量导出 | 2天 |
| 性能优化 | 大数据量处理优化、缓存策略 | 2天 |

**Phase 3 总计：约12天**

---

## 9. 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| Deepseek API响应慢/失败 | 分析中断 | 实现指数退避重试、任务断点续传 |
| 50万字处理超时 | 用户体验差 | 后端异步处理 + WebSocket进度推送 |
| 剧本质量不稳定 | 输出不可用 | 多轮校验 + 人工审核点 + 重新生成 |
| 移动端内存不足 | 大文件崩溃 | 分块读取、流式处理、后端承担主要计算 |
| API费用过高 | 成本超支 | Token预估、批量调用优化、本地缓存 |
| 大文本数据库存储 | 性能下降 | 原文存文件，数据库存路径（Issue-001） |
| 依赖版本不一致 | 构建失败 | 统一使用sqlite包，锁定版本（Issue-002） |
| 剧集切片切断句子 | 上下文丢失 | 按段落边界切片，增加上下文重叠（Issue-012） |
| 状态流转错误 | 流程跳过 | 严格状态机：pending→analyzing→analyzed→generating→completed（Issue-004） |

---

## 10. 已知问题清单

> 详细问题描述见 [docs/issues.md](../issues.md)

| Issue | 级别 | 状态 | 说明 |
|-------|------|------|------|
| Issue-001 | P1 | 待处理 | 大文本存储策略：原文改存文件 |
| Issue-002 | P0 | 待处理 | 依赖不一致：sqlite vs sqlite3 |
| Issue-003 | P1 | 待处理 | EpisodePlan类型与Prompt不匹配 |
| Issue-004 | P1 | 待处理 | 状态流转逻辑错误 |
| Issue-005 | P1 | 待处理 | 缺少EPUB/DOCX解析器 |
| Issue-006 | P1 | 待处理 | WebSocket实现缺失 |
| Issue-007 | P1 | 待处理 | 缺少限流与并发控制 |
| Issue-008 | P2 | 待处理 | 移动端API地址硬编码 |
| Issue-009 | P2 | 待处理 | 缺少日志系统 |
| Issue-010 | P1 | 待处理 | Docker构建问题 |
| Issue-011 | P2 | 待处理 | 缺少Nginx配置 |
| Issue-012 | P1 | 待处理 | 剧本生成切片逻辑缺陷 |
| Issue-013 | P2 | 待处理 | 移动端SQLite与后端不同步 |
| Issue-014 | P2 | 待处理 | 缺少Token预估和成本控制 |
| Issue-015 | P2 | 待处理 | 任务断点续传机制缺失 |

---

## 11. 参考项目

1. **Toonflow-app** (GitHub 7.8k⭐) - 开源一站式AI短剧创作工具
2. **drama-workshop** - AI一站式短剧/漫剧生成平台，支持多LLM
3. **NovelToStoryboard** - 小说分镜师，AI分镜头脚本自动生成
4. **cc-novel2video** - 基于Claude Code的小说转视频工具

---

*文档结束*
