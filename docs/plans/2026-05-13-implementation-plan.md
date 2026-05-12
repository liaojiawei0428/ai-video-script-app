# AI视频剧本生成应用 - 详细实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个完整的AI视频剧本生成系统，包含React Native移动端（iOS/Android）和Node.js后端，部署在腾讯云服务器上，能够将50万字小说转换为标准AI视频剧本。

**Architecture:** 采用Monorepo结构，移动端使用React Native + Zustand + SQLite，后端使用Node.js + Express + BullMQ + Redis，通过Deepseek V4 API进行全文分析和剧本生成。

**Tech Stack:** React Native 0.73+, Node.js 20, Express, TypeScript, Zustand, SQLite, BullMQ, Redis, Deepseek V4 API

---

## 项目结构

```
ai-video-script-app/
├── apps/
│   ├── mobile/                 # React Native App
│   │   ├── src/
│   │   │   ├── api/           # API客户端 (axios封装)
│   │   │   ├── components/    # 公共组件
│   │   │   ├── screens/       # 页面组件
│   │   │   ├── navigation/    # 路由配置
│   │   │   ├── store/         # Zustand状态管理
│   │   │   ├── db/            # SQLite数据库操作
│   │   │   ├── utils/         # 工具函数
│   │   │   └── types/         # TypeScript类型定义
│   │   ├── App.tsx
│   │   └── package.json
│   │
│   └── server/                 # Node.js后端
│       ├── src/
│       │   ├── routes/        # API路由定义
│       │   ├── controllers/   # 请求控制器
│       │   ├── services/      # 业务服务层
│       │   ├── models/        # 数据模型/数据库操作
│       │   ├── prompts/       # Deepseek Prompt模板
│       │   ├── utils/         # 工具函数
│       │   ├── middleware/    # Express中间件
│       │   ├── jobs/          # BullMQ任务处理器
│       │   └── types/         # TypeScript类型定义
│       ├── uploads/           # 临时上传目录
│       ├── scripts/           # 部署脚本
│       ├── docker-compose.yml
│       └── package.json
│
├── packages/
│   ├── shared-types/           # 共享类型定义
│   └── shared-utils/           # 共享工具函数
│
├── docs/
│   ├── specs/                  # 设计规范
│   └── plans/                  # 实施计划
│
├── turbo.json                  # Monorepo配置
└── package.json
```

---

## Phase 1: 项目初始化与基础设施

### Task 1: Monorepo基础架构搭建

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `.gitignore`

- [ ] **Step 1: 创建根目录package.json**

```json
{
  "name": "ai-video-script-app",
  "private": true,
  "version": "1.0.0",
  "description": "AI视频剧本生成应用 - 将小说转换为标准AI视频剧本",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: 创建turbo.json配置**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: 创建.gitignore**

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
build/
dist/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Testing
coverage/

# React Native
.expo/
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*

# Temporary files
*.tmp
*.temp
uploads/*
!uploads/.gitkeep
```

- [ ] **Step 4: 初始化Git仓库并提交**

```bash
git init
git add .
git commit -m "chore: initialize monorepo structure"
```

---

### Task 2: 共享包创建

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-utils/package.json`
- Create: `packages/shared-utils/src/index.ts`
- Create: `packages/shared-utils/tsconfig.json`

- [ ] **Step 1: 创建shared-types包**

```json
// packages/shared-types/package.json
{
  "name": "@ai-script/shared-types",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

```json
// packages/shared-types/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

```typescript
// packages/shared-types/src/index.ts
export interface Novel {
  id: string;
  title: string;
  author: string;
  contentText?: string;
  totalChars: number;
  totalWords: number;
  genre: string;
  theme: string;
  style: string;
  tone: string;
  status: 'pending' | 'analyzing' | 'generating' | 'completed' | 'error';
  createdAt: number;
  updatedAt: number;
}

export interface Episode {
  id: string;
  novelId: string;
  episodeNumber: number;
  title: string;
  summary: string;
  durationSec: number;
  sceneLocation: string;
  characters: string[];
  scriptContent: string;
  scriptFormat: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  createdAt: number;
}

export interface Shot {
  id: string;
  episodeId: string;
  shotNumber: number;
  sceneType: 'INT' | 'EXT';
  location: string;
  timeOfDay: '日' | '夜' | '晨' | '昏';
  description: string;
  cameraAngle: string;
  cameraMove: string;
  lighting: string;
  durationSec: number;
  audioNote: string;
  dialogue: string;
  action: string;
  status: 'pending' | 'completed';
}

export interface Character {
  id: string;
  novelId: string;
  name: string;
  aliases: string[];
  appearance: string;
  personality: string;
  roleType: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  relationships: Array<{ target: string; relation: string }>;
  referenceImage?: string;
  createdAt: number;
}

export interface TaskJob {
  id: string;
  novelId: string;
  type: 'upload' | 'analyze' | 'episode_generate' | 'shot_generate';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  totalSteps: number;
  currentStep: number;
  resultData?: Record<string, unknown>;
  errorMsg?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface NovelAnalysis {
  genre: string;
  theme: string;
  style: string;
  tone: string;
  characters: Character[];
  scenes: Array<{ name: string; description: string; importance: number }>;
  plotPoints: Array<{ chapter: number; description: string; importance: number }>;
}

export interface EpisodePlan {
  episodeNumber: number;
  title: string;
  startPosition: number;
  endPosition: number;
  summary: string;
  estimatedDuration: number;
}
```

- [ ] **Step 2: 创建shared-utils包**

```json
// packages/shared-utils/package.json
{
  "name": "@ai-script/shared-utils",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

```typescript
// packages/shared-utils/src/index.ts
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function estimateDuration(content: string): number {
  const dialogueMatches = content.match(/["「『].*?["」』]/g) || [];
  const actionMatches = content.match(/[^「」"']{10,50}/g) || [];
  
  const dialogueDuration = dialogueMatches.length * 3;
  const actionDuration = actionMatches.length * 2;
  const transitionDuration = 5;
  
  return dialogueDuration + actionDuration + transitionDuration;
}

export function chunkText(text: string, chunkSize: number, overlap: number = 500): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= end) break;
  }
  
  return chunks;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
}
```

- [ ] **Step 3: 构建共享包**

```bash
cd packages/shared-types && npm install && npm run build
cd ../shared-utils && npm install && npm run build
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add shared types and utils packages"
```

---

## Phase 2: 后端服务搭建

### Task 3: Express后端基础架构

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/config.ts`
- Create: `apps/server/.env.example`

- [ ] **Step 1: 创建后端package.json**

```json
{
  "name": "@ai-script/server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "@ai-script/shared-types": "workspace:*",
    "@ai-script/shared-utils": "workspace:*",
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.4.0",
    "multer": "^1.4.5-lts.1",
    "bullmq": "^5.7.0",
    "ioredis": "^5.4.0",
    "sqlite3": "^5.1.7",
    "axios": "^1.7.0",
    "ws": "^8.17.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "@types/multer": "^1.4.11",
    "@types/ws": "^8.5.10",
    "@types/uuid": "^9.0.8",
    "@types/node": "^20.12.0",
    "typescript": "^5.4.0",
    "tsx": "^4.11.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.12"
  }
}
```

- [ ] **Step 2: 创建tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建环境配置**

```typescript
// apps/server/src/config.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '60000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Deepseek API
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Database
  dbPath: process.env.DB_PATH || './data/app.db',
  
  // File Upload
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

if (!config.deepseekApiKey) {
  console.warn('Warning: DEEPSEEK_API_KEY is not set');
}
```

```env
# apps/server/.env.example
PORT=60000
NODE_ENV=development

# Deepseek API
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_API_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# Redis
REDIS_URL=redis://localhost:6379

# Database
DB_PATH=./data/app.db

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# CORS
CORS_ORIGIN=*
```

- [ ] **Step 4: 创建入口文件**

```typescript
// apps/server/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: Add routes

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
```

- [ ] **Step 5: 安装依赖并测试启动**

```bash
cd apps/server
npm install
npm run dev
```

Expected: Server running on port 60000

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: setup Express server with basic middleware"
```

---

### Task 4: 数据库层实现

**Files:**
- Create: `apps/server/src/models/db.ts`
- Create: `apps/server/src/models/novel.ts`
- Create: `apps/server/src/models/episode.ts`
- Create: `apps/server/src/models/shot.ts`
- Create: `apps/server/src/models/character.ts`
- Create: `apps/server/src/models/taskJob.ts`

- [ ] **Step 1: 创建数据库连接和初始化**

```typescript
// apps/server/src/models/db.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (db) return db;
  
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = await open({
    filename: config.dbPath,
    driver: sqlite3.Database,
  });
  
  await initTables();
  return db;
}

async function initTables(): Promise<void> {
  if (!db) return;
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      content_text TEXT,
      total_chars INTEGER,
      total_words INTEGER,
      genre TEXT,
      theme TEXT,
      style TEXT,
      tone TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      summary TEXT,
      duration_sec INTEGER DEFAULT 120,
      scene_location TEXT,
      characters TEXT,
      script_content TEXT,
      script_format TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      FOREIGN KEY (novel_id) REFERENCES novels(id)
    );

    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      shot_number INTEGER NOT NULL,
      scene_type TEXT,
      location TEXT,
      time_of_day TEXT,
      description TEXT,
      camera_angle TEXT,
      camera_move TEXT,
      lighting TEXT,
      duration_sec REAL,
      audio_note TEXT,
      dialogue TEXT,
      action TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (episode_id) REFERENCES episodes(id)
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT,
      appearance TEXT,
      personality TEXT,
      role_type TEXT,
      relationships TEXT,
      reference_image TEXT,
      created_at INTEGER,
      FOREIGN KEY (novel_id) REFERENCES novels(id)
    );

    CREATE TABLE IF NOT EXISTS task_jobs (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      progress INTEGER DEFAULT 0,
      total_steps INTEGER,
      current_step INTEGER,
      result_data TEXT,
      error_msg TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_novel ON episodes(novel_id);
    CREATE INDEX IF NOT EXISTS idx_shots_episode ON shots(episode_id);
    CREATE INDEX IF NOT EXISTS idx_characters_novel ON characters(novel_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_novel ON task_jobs(novel_id);
  `);
}
```

- [ ] **Step 2: 创建Novel模型**

```typescript
// apps/server/src/models/novel.ts
import { getDb } from './db';
import { Novel } from '@ai-script/shared-types';

export class NovelModel {
  async create(novel: Novel): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO novels (id, title, author, content_text, total_chars, total_words, 
       genre, theme, style, tone, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [novel.id, novel.title, novel.author, novel.contentText, novel.totalChars,
       novel.totalWords, novel.genre, novel.theme, novel.style, novel.tone,
       novel.status, novel.createdAt, novel.updatedAt]
    );
  }

  async findById(id: string): Promise<Novel | undefined> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM novels WHERE id = ?', id);
    if (!row) return undefined;
    return this.mapRowToNovel(row);
  }

  async updateStatus(id: string, status: Novel['status']): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE novels SET status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), id]
    );
  }

  async updateAnalysis(id: string, analysis: Partial<Novel>): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE novels SET genre = ?, theme = ?, style = ?, tone = ?, updated_at = ?
       WHERE id = ?`,
      [analysis.genre, analysis.theme, analysis.style, analysis.tone, Date.now(), id]
    );
  }

  async list(): Promise<Novel[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM novels ORDER BY created_at DESC');
    return rows.map(row => this.mapRowToNovel(row));
  }

  private mapRowToNovel(row: any): Novel {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      contentText: row.content_text,
      totalChars: row.total_chars,
      totalWords: row.total_words,
      genre: row.genre,
      theme: row.theme,
      style: row.style,
      tone: row.tone,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const novelModel = new NovelModel();
```

- [ ] **Step 3: 创建Episode模型**

```typescript
// apps/server/src/models/episode.ts
import { getDb } from './db';
import { Episode } from '@ai-script/shared-types';

export class EpisodeModel {
  async create(episode: Episode): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO episodes (id, novel_id, episode_number, title, summary, duration_sec,
       scene_location, characters, script_content, script_format, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [episode.id, episode.novelId, episode.episodeNumber, episode.title, episode.summary,
       episode.durationSec, episode.sceneLocation, JSON.stringify(episode.characters),
       episode.scriptContent, episode.scriptFormat, episode.status, episode.createdAt]
    );
  }

  async findByNovelId(novelId: string): Promise<Episode[]> {
    const db = await getDb();
    const rows = await db.all(
      'SELECT * FROM episodes WHERE novel_id = ? ORDER BY episode_number',
      novelId
    );
    return rows.map(row => this.mapRowToEpisode(row));
  }

  async findById(id: string): Promise<Episode | undefined> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM episodes WHERE id = ?', id);
    if (!row) return undefined;
    return this.mapRowToEpisode(row);
  }

  async updateScript(id: string, scriptContent: string): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE episodes SET script_content = ?, status = ? WHERE id = ?',
      [scriptContent, 'completed', id]
    );
  }

  private mapRowToEpisode(row: any): Episode {
    return {
      id: row.id,
      novelId: row.novel_id,
      episodeNumber: row.episode_number,
      title: row.title,
      summary: row.summary,
      durationSec: row.duration_sec,
      sceneLocation: row.scene_location,
      characters: JSON.parse(row.characters || '[]'),
      scriptContent: row.script_content,
      scriptFormat: row.script_format,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}

export const episodeModel = new EpisodeModel();
```

- [ ] **Step 4: 创建Shot模型**

```typescript
// apps/server/src/models/shot.ts
import { getDb } from './db';
import { Shot } from '@ai-script/shared-types';

export class ShotModel {
  async create(shot: Shot): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO shots (id, episode_id, shot_number, scene_type, location, time_of_day,
       description, camera_angle, camera_move, lighting, duration_sec, audio_note,
       dialogue, action, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shot.id, shot.episodeId, shot.shotNumber, shot.sceneType, shot.location,
       shot.timeOfDay, shot.description, shot.cameraAngle, shot.cameraMove, shot.lighting,
       shot.durationSec, shot.audioNote, shot.dialogue, shot.action, shot.status]
    );
  }

  async findByEpisodeId(episodeId: string): Promise<Shot[]> {
    const db = await getDb();
    const rows = await db.all(
      'SELECT * FROM shots WHERE episode_id = ? ORDER BY shot_number',
      episodeId
    );
    return rows.map(row => this.mapRowToShot(row));
  }

  async bulkCreate(shots: Shot[]): Promise<void> {
    const db = await getDb();
    const stmt = await db.prepare(
      `INSERT INTO shots (id, episode_id, shot_number, scene_type, location, time_of_day,
       description, camera_angle, camera_move, lighting, duration_sec, audio_note,
       dialogue, action, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    for (const shot of shots) {
      await stmt.run(
        shot.id, shot.episodeId, shot.shotNumber, shot.sceneType, shot.location,
        shot.timeOfDay, shot.description, shot.cameraAngle, shot.cameraMove, shot.lighting,
        shot.durationSec, shot.audioNote, shot.dialogue, shot.action, shot.status
      );
    }
    
    await stmt.finalize();
  }

  private mapRowToShot(row: any): Shot {
    return {
      id: row.id,
      episodeId: row.episode_id,
      shotNumber: row.shot_number,
      sceneType: row.scene_type,
      location: row.location,
      timeOfDay: row.time_of_day,
      description: row.description,
      cameraAngle: row.camera_angle,
      cameraMove: row.camera_move,
      lighting: row.lighting,
      durationSec: row.duration_sec,
      audioNote: row.audio_note,
      dialogue: row.dialogue,
      action: row.action,
      status: row.status,
    };
  }
}

export const shotModel = new ShotModel();
```

- [ ] **Step 5: 创建Character模型**

```typescript
// apps/server/src/models/character.ts
import { getDb } from './db';
import { Character } from '@ai-script/shared-types';

export class CharacterModel {
  async create(character: Character): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO characters (id, novel_id, name, aliases, appearance, personality,
       role_type, relationships, reference_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [character.id, character.novelId, character.name, JSON.stringify(character.aliases),
       character.appearance, character.personality, character.roleType,
       JSON.stringify(character.relationships), character.referenceImage, character.createdAt]
    );
  }

  async findByNovelId(novelId: string): Promise<Character[]> {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM characters WHERE novel_id = ?', novelId);
    return rows.map(row => this.mapRowToCharacter(row));
  }

  async bulkCreate(characters: Character[]): Promise<void> {
    const db = await getDb();
    const stmt = await db.prepare(
      `INSERT INTO characters (id, novel_id, name, aliases, appearance, personality,
       role_type, relationships, reference_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    for (const character of characters) {
      await stmt.run(
        character.id, character.novelId, character.name, JSON.stringify(character.aliases),
        character.appearance, character.personality, character.roleType,
        JSON.stringify(character.relationships), character.referenceImage, character.createdAt
      );
    }
    
    await stmt.finalize();
  }

  private mapRowToCharacter(row: any): Character {
    return {
      id: row.id,
      novelId: row.novel_id,
      name: row.name,
      aliases: JSON.parse(row.aliases || '[]'),
      appearance: row.appearance,
      personality: row.personality,
      roleType: row.role_type,
      relationships: JSON.parse(row.relationships || '[]'),
      referenceImage: row.reference_image,
      createdAt: row.created_at,
    };
  }
}

export const characterModel = new CharacterModel();
```

- [ ] **Step 6: 创建TaskJob模型**

```typescript
// apps/server/src/models/taskJob.ts
import { getDb } from './db';
import { TaskJob } from '@ai-script/shared-types';

export class TaskJobModel {
  async create(job: TaskJob): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO task_jobs (id, novel_id, type, status, progress, total_steps,
       current_step, result_data, error_msg, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [job.id, job.novelId, job.type, job.status, job.progress, job.totalSteps,
       job.currentStep, JSON.stringify(job.resultData), job.errorMsg,
       job.createdAt, job.updatedAt]
    );
  }

  async findById(id: string): Promise<TaskJob | undefined> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM task_jobs WHERE id = ?', id);
    if (!row) return undefined;
    return this.mapRowToTaskJob(row);
  }

  async updateProgress(id: string, progress: number, currentStep: number): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE task_jobs SET progress = ?, current_step = ?, updated_at = ? WHERE id = ?',
      [progress, currentStep, Date.now(), id]
    );
  }

  async complete(id: string, resultData?: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE task_jobs SET status = ?, progress = 100, result_data = ?,
       completed_at = ?, updated_at = ? WHERE id = ?`,
      ['completed', JSON.stringify(resultData), Date.now(), Date.now(), id]
    );
  }

  async fail(id: string, errorMsg: string): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE task_jobs SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?',
      ['failed', errorMsg, Date.now(), id]
    );
  }

  private mapRowToTaskJob(row: any): TaskJob {
    return {
      id: row.id,
      novelId: row.novel_id,
      type: row.type,
      status: row.status,
      progress: row.progress,
      totalSteps: row.total_steps,
      currentStep: row.current_step,
      resultData: JSON.parse(row.result_data || '{}'),
      errorMsg: row.error_msg,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }
}

export const taskJobModel = new TaskJobModel();
```

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat: add database models for novels, episodes, shots, characters, tasks"
```

---

### Task 5: Deepseek API服务封装

**Files:**
- Create: `apps/server/src/services/deepseek.ts`
- Create: `apps/server/src/prompts/novelAnalysis.ts`
- Create: `apps/server/src/prompts/episodeGeneration.ts`
- Create: `apps/server/src/prompts/shotGeneration.ts`

- [ ] **Step 1: 创建Deepseek API服务**

```typescript
// apps/server/src/services/deepseek.ts
import axios from 'axios';
import { config } from '../config';

export interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepseekService {
  private client = axios.create({
    baseURL: config.deepseekApiUrl,
    headers: {
      'Authorization': `Bearer ${config.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 300000, // 5分钟超时
  });

  async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7
  ): Promise<string> {
    const response = await this.client.post<DeepseekResponse>('/chat/completions', {
      model: config.deepseekModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    });

    return response.data.choices[0].message.content;
  }

  async chatCompletionStream(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7
  ): Promise<void> {
    const response = await this.client.post('/chat/completions', {
      model: config.deepseekModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 8192,
      stream: true,
    }, {
      responseType: 'stream',
    });

    // Handle stream
    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    });

    return new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
    });
  }
}

export const deepseekService = new DeepseekService();
```

- [ ] **Step 2: 创建小说分析Prompt**

```typescript
// apps/server/src/prompts/novelAnalysis.ts
export const novelAnalysisSystemPrompt = `
你是一位专业的小说分析专家。请对提供的小说进行深度分析，提取关键信息。

## 分析维度
1. 类型与风格：判断小说的具体类型（玄幻/都市/言情/悬疑/科幻等）和风格特点
2. 核心角色：提取所有重要角色，包括外貌、性格、身份、人物关系
3. 核心主题：提炼小说的核心主题和情感基调
4. 主要场景：提取重要场景设定
5. 剧情节点：识别关键转折点和高潮

## 输出格式（严格JSON）
{
  "genre": "小说类型",
  "theme": "核心主题",
  "style": "风格定位",
  "tone": "情感基调",
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名"],
      "appearance": "外貌描述",
      "personality": "性格特点",
      "identity": "身份",
      "role_type": "protagonist|antagonist|supporting|minor",
      "importance": 1-10,
      "relationships": [
        {"target": "相关角色", "relation": "关系类型"}
      ]
    }
  ],
  "scenes": [
    {
      "name": "场景名",
      "description": "场景描述",
      "importance": 1-10
    }
  ],
  "plot_points": [
    {
      "chapter": "章节位置",
      "description": "剧情描述",
      "importance": 1-10,
      "type": "setup|rising_action|climax|falling_action|resolution"
    }
  ]
}

请只输出JSON，不要有任何其他说明文字。
`;

export const novelAnalysisUserPrompt = (novelText: string) => `
请分析以下小说文本：

${novelText}
`;
```

- [ ] **Step 3: 创建剧集生成Prompt**

```typescript
// apps/server/src/prompts/episodeGeneration.ts
export const episodeDivisionSystemPrompt = `
你是一位专业的剧本编辑。基于小说分析结果，将小说划分为多个剧集，每集时长控制在120秒±10秒。

## 划分原则
1. 每集必须包含完整的叙事弧线（起承转合）
2. 每集时长控制在110-130秒之间
3. 确保每集至少包含一个高潮或转折点
4. 保持角色出场的一致性
5. 场景转换自然流畅

## 输出格式（严格JSON）
{
  "episodes": [
    {
      "episode_number": 1,
      "title": "剧集标题",
      "start_position": "起始章节/段落位置",
      "end_position": "结束章节/段落位置",
      "summary": "本集摘要（50字内）",
      "estimated_duration": 120,
      "key_characters": ["角色名"],
      "key_scenes": ["场景名"]
    }
  ]
}

请只输出JSON，不要有任何其他说明文字。
`;

export const episodeDivisionUserPrompt = (
  novelText: string,
  analysis: string,
  targetDuration: number = 120,
  tolerance: number = 10
) => `
基于以下小说原文和分析结果，划分剧集：

## 时长要求
- 每集目标时长：${targetDuration}秒
- 容差范围：±${tolerance}秒

## 小说分析结果
${analysis}

## 小说原文（节选关键部分）
${novelText.slice(0, 100000)}

请输出剧集划分方案。
`;
```

- [ ] **Step 4: 创建镜头生成Prompt**

```typescript
// apps/server/src/prompts/shotGeneration.ts
export const shotGenerationSystemPrompt = `
你是一位专业的分镜师。根据剧本内容，生成详细的镜头画面描述。

## 镜头要素
1. 景别：特写/近景/中景/全景/远景
2. 运镜：推/拉/摇/移/跟/升/降/固定
3. 灯光：自然光/侧光/逆光/顶光/底光
4. 画面描述：精确、具体、可执行的视觉描述
5. 音效提示：环境音/配乐/特效音

## 输出格式（严格JSON）
{
  "shots": [
    {
      "shot_number": 1,
      "scene_type": "INT|EXT",
      "location": "具体位置",
      "time_of_day": "日|夜|晨|昏",
      "description": "画面描述（给AI视频生成使用）",
      "camera_angle": "景别",
      "camera_move": "运镜方式",
      "lighting": "灯光设定",
      "duration_sec": 5.0,
      "audio_note": "音效提示",
      "dialogue": "对白内容",
      "action": "动作描述"
    }
  ]
}

请只输出JSON，不要有任何其他说明文字。
`;

export const shotGenerationUserPrompt = (
  scriptContent: string,
  characters: string,
  scenes: string
) => `
请为以下剧本生成分镜镜头：

## 角色设定
${characters}

## 场景设定
${scenes}

## 剧本内容
${scriptContent}
`;
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add Deepseek API service and prompt templates"
```

---

### Task 6: 业务服务层实现

**Files:**
- Create: `apps/server/src/services/novelService.ts`
- Create: `apps/server/src/services/taskService.ts`
- Create: `apps/server/src/services/scriptService.ts`

- [ ] **Step 1: 创建Novel服务**

```typescript
// apps/server/src/services/novelService.ts
import { novelModel } from '../models/novel';
import { characterModel } from '../models/character';
import { taskJobModel } from '../models/taskJob';
import { deepseekService } from './deepseek';
import { novelAnalysisSystemPrompt, novelAnalysisUserPrompt } from '../prompts/novelAnalysis';
import { generateUUID } from '@ai-script/shared-utils';
import { Novel, NovelAnalysis, TaskJob } from '@ai-script/shared-types';
import fs from 'fs/promises';

export class NovelService {
  async createNovel(
    title: string,
    author: string,
    contentText: string,
    filePath: string
  ): Promise<Novel> {
    const novel: Novel = {
      id: generateUUID(),
      title,
      author,
      contentText,
      totalChars: contentText.length,
      totalWords: contentText.split(/\s+/).length,
      genre: '',
      theme: '',
      style: '',
      tone: '',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await novelModel.create(novel);
    return novel;
  }

  async analyzeNovel(novelId: string): Promise<TaskJob> {
    const novel = await novelModel.findById(novelId);
    if (!novel) throw new Error('Novel not found');
    if (!novel.contentText) throw new Error('Novel content not available');

    const task: TaskJob = {
      id: generateUUID(),
      novelId,
      type: 'analyze',
      status: 'running',
      progress: 0,
      totalSteps: 3,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);
    await novelModel.updateStatus(novelId, 'analyzing');

    // Step 1: Full text analysis
    await taskJobModel.updateProgress(task.id, 10, 1);
    const analysisResult = await deepseekService.chatCompletion(
      novelAnalysisSystemPrompt,
      novelAnalysisUserPrompt(novel.contentText),
      0.3
    );

    // Step 2: Parse and save analysis
    await taskJobModel.updateProgress(task.id, 60, 2);
    const analysis: NovelAnalysis = JSON.parse(analysisResult);

    await novelModel.updateAnalysis(novelId, {
      genre: analysis.genre,
      theme: analysis.theme,
      style: analysis.style,
      tone: analysis.tone,
    });

    // Save characters
    if (analysis.characters?.length > 0) {
      const characters = analysis.characters.map(char => ({
        id: generateUUID(),
        novelId,
        name: char.name,
        aliases: char.aliases || [],
        appearance: char.appearance || '',
        personality: char.personality || '',
        roleType: char.role_type || 'supporting',
        relationships: char.relationships || [],
        createdAt: Date.now(),
      }));
      await characterModel.bulkCreate(characters);
    }

    // Step 3: Complete
    await taskJobModel.updateProgress(task.id, 100, 3);
    await taskJobModel.complete(task.id, { analysis });
    await novelModel.updateStatus(novelId, 'completed');

    return task;
  }

  async getNovel(novelId: string): Promise<Novel | undefined> {
    return novelModel.findById(novelId);
  }

  async listNovels(): Promise<Novel[]> {
    return novelModel.list();
  }
}

export const novelService = new NovelService();
```

- [ ] **Step 2: 创建Task服务**

```typescript
// apps/server/src/services/taskService.ts
import { taskJobModel } from '../models/taskJob';
import { TaskJob } from '@ai-script/shared-types';

export class TaskService {
  async getTask(taskId: string): Promise<TaskJob | undefined> {
    return taskJobModel.findById(taskId);
  }

  async updateProgress(
    taskId: string,
    progress: number,
    currentStep: number
  ): Promise<void> {
    await taskJobModel.updateProgress(taskId, progress, currentStep);
  }

  async completeTask(
    taskId: string,
    resultData?: Record<string, unknown>
  ): Promise<void> {
    await taskJobModel.complete(taskId, resultData);
  }

  async failTask(taskId: string, errorMsg: string): Promise<void> {
    await taskJobModel.fail(taskId, errorMsg);
  }
}

export const taskService = new TaskService();
```

- [ ] **Step 3: 创建Script服务**

```typescript
// apps/server/src/services/scriptService.ts
import { episodeModel } from '../models/episode';
import { shotModel } from '../models/shot';
import { characterModel } from '../models/character';
import { novelModel } from '../models/novel';
import { taskJobModel } from '../models/taskJob';
import { deepseekService } from './deepseek';
import {
  episodeDivisionSystemPrompt,
  episodeDivisionUserPrompt,
} from '../prompts/episodeGeneration';
import {
  shotGenerationSystemPrompt,
  shotGenerationUserPrompt,
} from '../prompts/shotGeneration';
import { generateUUID, estimateDuration } from '@ai-script/shared-utils';
import { Episode, Shot, TaskJob, EpisodePlan } from '@ai-script/shared-types';

export class ScriptService {
  async generateEpisodes(
    novelId: string,
    targetDuration: number = 120,
    tolerance: number = 10
  ): Promise<TaskJob> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.contentText) throw new Error('Novel not found or no content');

    const task: TaskJob = {
      id: generateUUID(),
      novelId,
      type: 'episode_generate',
      status: 'running',
      progress: 0,
      totalSteps: 4,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);
    await novelModel.updateStatus(novelId, 'generating');

    // Step 1: Get analysis results
    await taskJobModel.updateProgress(task.id, 10, 1);
    const characters = await characterModel.findByNovelId(novelId);
    const analysis = {
      genre: novel.genre,
      theme: novel.theme,
      style: novel.style,
      tone: novel.tone,
      characters: characters.map(c => ({
        name: c.name,
        appearance: c.appearance,
        personality: c.personality,
        role_type: c.roleType,
      })),
    };

    // Step 2: Generate episode division
    await taskJobModel.updateProgress(task.id, 30, 2);
    const divisionResult = await deepseekService.chatCompletion(
      episodeDivisionSystemPrompt,
      episodeDivisionUserPrompt(
        novel.contentText,
        JSON.stringify(analysis),
        targetDuration,
        tolerance
      ),
      0.5
    );

    const { episodes: episodePlans }: { episodes: EpisodePlan[] } = JSON.parse(divisionResult);

    // Step 3: Generate scripts for each episode
    await taskJobModel.updateProgress(task.id, 50, 3);
    const episodes: Episode[] = [];

    for (let i = 0; i < episodePlans.length; i++) {
      const plan = episodePlans[i];
      const startIdx = Math.floor((plan.startPosition / 100) * novel.contentText.length);
      const endIdx = Math.floor((plan.endPosition / 100) * novel.contentText.length);
      const episodeText = novel.contentText.slice(startIdx, endIdx);

      const scriptResult = await deepseekService.chatCompletion(
        `你是一位专业编剧。请将以下小说片段转换为标准剧本格式。\n\n输出JSON格式：{"script_content": "剧本内容", "title": "剧集标题"}`,
        `角色设定：${JSON.stringify(characters)}\n\n小说片段：${episodeText}`,
        0.7
      );

      const { script_content, title } = JSON.parse(scriptResult);

      const episode: Episode = {
        id: generateUUID(),
        novelId,
        episodeNumber: plan.episodeNumber,
        title: title || plan.title,
        summary: plan.summary,
        durationSec: plan.estimatedDuration,
        sceneLocation: plan.keyScenes?.[0] || '',
        characters: plan.keyCharacters || [],
        scriptContent: script_content,
        scriptFormat: 'v1',
        status: 'completed',
        createdAt: Date.now(),
      };

      await episodeModel.create(episode);
      episodes.push(episode);

      // Update progress
      const progress = 50 + Math.floor((i + 1) / episodePlans.length * 40);
      await taskJobModel.updateProgress(task.id, progress, 3);
    }

    // Step 4: Complete
    await taskJobModel.complete(task.id, { episodeCount: episodes.length });
    await novelModel.updateStatus(novelId, 'completed');

    return task;
  }

  async generateShots(episodeId: string): Promise<TaskJob> {
    const episode = await episodeModel.findById(episodeId);
    if (!episode) throw new Error('Episode not found');

    const characters = await characterModel.findByNovelId(episode.novelId);

    const task: TaskJob = {
      id: generateUUID(),
      novelId: episode.novelId,
      type: 'shot_generate',
      status: 'running',
      progress: 0,
      totalSteps: 2,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await taskJobModel.create(task);

    // Generate shots
    await taskJobModel.updateProgress(task.id, 50, 1);
    const shotResult = await deepseekService.chatCompletion(
      shotGenerationSystemPrompt,
      shotGenerationUserPrompt(
        episode.scriptContent,
        JSON.stringify(characters),
        JSON.stringify({ location: episode.sceneLocation })
      ),
      0.7
    );

    const { shots: shotData }: { shots: Array<Partial<Shot>> } = JSON.parse(shotResult);

    const shots: Shot[] = shotData.map((shot, index) => ({
      id: generateUUID(),
      episodeId,
      shotNumber: index + 1,
      sceneType: shot.sceneType || 'INT',
      location: shot.location || episode.sceneLocation,
      timeOfDay: shot.timeOfDay || '日',
      description: shot.description || '',
      cameraAngle: shot.cameraAngle || '中景',
      cameraMove: shot.cameraMove || '固定',
      lighting: shot.lighting || '自然光',
      durationSec: shot.durationSec || 5,
      audioNote: shot.audioNote || '',
      dialogue: shot.dialogue || '',
      action: shot.action || '',
      status: 'completed',
    }));

    await shotModel.bulkCreate(shots);

    await taskJobModel.complete(task.id, { shotCount: shots.length });

    return task;
  }
}

export const scriptService = new ScriptService();
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add business services for novel analysis and script generation"
```

---

### Task 7: API路由与控制器

**Files:**
- Create: `apps/server/src/routes/novels.ts`
- Create: `apps/server/src/routes/tasks.ts`
- Create: `apps/server/src/routes/episodes.ts`
- Create: `apps/server/src/controllers/novelController.ts`
- Create: `apps/server/src/controllers/taskController.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: 创建Novel路由**

```typescript
// apps/server/src/routes/novels.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { novelController } from '../controllers/novelController';

const router = Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.epub', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .txt, .epub, .docx are allowed'));
    }
  },
});

// Routes
router.post('/upload', upload.single('file'), novelController.upload);
router.post('/:novelId/analyze', novelController.analyze);
router.get('/:novelId/analysis', novelController.getAnalysis);
router.get('/:novelId/episodes', novelController.getEpisodes);
router.post('/:novelId/episodes/generate', novelController.generateEpisodes);
router.get('/:novelId/export', novelController.exportNovel);
router.get('/', novelController.list);

export default router;
```

- [ ] **Step 2: 创建Novel控制器**

```typescript
// apps/server/src/controllers/novelController.ts
import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { novelService } from '../services/novelService';
import { scriptService } from '../services/scriptService';
import { episodeModel } from '../models/episode';
import { characterModel } from '../models/character';

export const novelController = {
  async upload(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const content = await fs.readFile(filePath, 'utf-8');
      const title = req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname));
      const author = req.body.author || 'Unknown';

      const novel = await novelService.createNovel(title, author, content, filePath);

      res.json({
        novelId: novel.id,
        title: novel.title,
        totalChars: novel.totalChars,
        status: novel.status,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload novel' });
    }
  },

  async analyze(req: Request, res: Response) {
    try {
      const { novelId } = req.params;
      const task = await novelService.analyzeNovel(novelId);
      res.json({ taskId: task.id, status: task.status });
    } catch (error) {
      console.error('Analyze error:', error);
      res.status(500).json({ error: 'Failed to start analysis' });
    }
  },

  async getAnalysis(req: Request, res: Response) {
    try {
      const { novelId } = req.params;
      const novel = await novelService.getNovel(novelId);
      if (!novel) {
        return res.status(404).json({ error: 'Novel not found' });
      }

      const characters = await characterModel.findByNovelId(novelId);

      res.json({
        genre: novel.genre,
        theme: novel.theme,
        style: novel.style,
        tone: novel.tone,
        characters,
      });
    } catch (error) {
      console.error('Get analysis error:', error);
      res.status(500).json({ error: 'Failed to get analysis' });
    }
  },

  async getEpisodes(req: Request, res: Response) {
    try {
      const { novelId } = req.params;
      const episodes = await episodeModel.findByNovelId(novelId);
      res.json({ episodes });
    } catch (error) {
      console.error('Get episodes error:', error);
      res.status(500).json({ error: 'Failed to get episodes' });
    }
  },

  async generateEpisodes(req: Request, res: Response) {
    try {
      const { novelId } = req.params;
      const { targetDuration = 120, tolerance = 10 } = req.body;
      const task = await scriptService.generateEpisodes(novelId, targetDuration, tolerance);
      res.json({ taskId: task.id, status: task.status });
    } catch (error) {
      console.error('Generate episodes error:', error);
      res.status(500).json({ error: 'Failed to generate episodes' });
    }
  },

  async exportNovel(req: Request, res: Response) {
    try {
      const { novelId } = req.params;
      const { format = 'json' } = req.query;
      const episodes = await episodeModel.findByNovelId(novelId);

      if (format === 'json') {
        res.json({ episodes });
      } else {
        res.status(400).json({ error: 'Unsupported format' });
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export novel' });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const novels = await novelService.listNovels();
      res.json({ novels });
    } catch (error) {
      console.error('List novels error:', error);
      res.status(500).json({ error: 'Failed to list novels' });
    }
  },
};
```

- [ ] **Step 3: 创建Task路由和控制器**

```typescript
// apps/server/src/routes/tasks.ts
import { Router } from 'express';
import { taskController } from '../controllers/taskController';

const router = Router();

router.get('/:taskId/progress', taskController.getProgress);

export default router;
```

```typescript
// apps/server/src/controllers/taskController.ts
import { Request, Response } from 'express';
import { taskService } from '../services/taskService';

export const taskController = {
  async getProgress(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const task = await taskService.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        currentStep: task.currentStep,
        totalSteps: task.totalSteps,
        errorMsg: task.errorMsg,
      });
    } catch (error) {
      console.error('Get progress error:', error);
      res.status(500).json({ error: 'Failed to get task progress' });
    }
  },
};
```

- [ ] **Step 4: 更新入口文件注册路由**

```typescript
// Modify apps/server/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import novelRoutes from './routes/novels';
import taskRoutes from './routes/tasks';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/novels', novelRoutes);
app.use('/api/tasks', taskRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add API routes and controllers for novels and tasks"
```

---

## Phase 3: 移动端开发

### Task 8: React Native项目初始化

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/App.tsx`
- Create: `apps/mobile/index.js`
- Create: `apps/mobile/metro.config.js`

- [ ] **Step 1: 创建移动端package.json**

```json
{
  "name": "@ai-script/mobile",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "start": "react-native start",
    "test": "jest",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx"
  },
  "dependencies": {
    "@ai-script/shared-types": "workspace:*",
    "@ai-script/shared-utils": "workspace:*",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/native-stack": "^6.9.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    "react-native-screens": "^3.29.0",
    "react-native-safe-area-context": "^4.8.0",
    "react-native-gesture-handler": "^2.14.0",
    "zustand": "^4.5.0",
    "axios": "^1.6.0",
    "react-native-document-picker": "^9.1.0",
    "react-native-fs": "^2.20.0",
    "react-native-sqlite-storage": "^6.0.1",
    "socket.io-client": "^4.7.0",
    "react-native-vector-icons": "^10.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0",
    "@babel/runtime": "^7.23.0",
    "@react-native/babel-preset": "^0.73.0",
    "@react-native/eslint-config": "^0.73.0",
    "@react-native/metro-config": "^0.73.0",
    "@react-native/typescript-config": "^0.73.0",
    "@types/react": "^18.2.0",
    "@types/react-native": "^0.72.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: 创建tsconfig.json**

```json
{
  "extends": "@react-native/typescript-config/tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "App.tsx", "index.js"]
}
```

- [ ] **Step 3: 创建入口文件**

```typescript
// apps/mobile/index.js
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

```typescript
// apps/mobile/App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { AnalysisScreen } from './src/screens/AnalysisScreen';
import { EpisodeListScreen } from './src/screens/EpisodeListScreen';
import { ScriptDetailScreen } from './src/screens/ScriptDetailScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'AI剧本生成' }} />
          <Stack.Screen name="Upload" component={UploadScreen} options={{ title: '上传小说' }} />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: '处理进度' }} />
          <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ title: '分析结果' }} />
          <Stack.Screen name="Episodes" component={EpisodeListScreen} options={{ title: '剧集列表' }} />
          <Stack.Screen name="ScriptDetail" component={ScriptDetailScreen} options={{ title: '剧本详情' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: initialize React Native mobile app"
```

---

### Task 9: 移动端核心功能实现

**Files:**
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/store/useNovelStore.ts`
- Create: `apps/mobile/src/db/sqlite.ts`
- Create: `apps/mobile/src/screens/HomeScreen.tsx`
- Create: `apps/mobile/src/screens/UploadScreen.tsx`
- Create: `apps/mobile/src/screens/ProgressScreen.tsx`

- [ ] **Step 1: 创建API客户端**

```typescript
// apps/mobile/src/api/client.ts
import axios from 'axios';

const API_BASE_URL = 'http://your-server-ip:60000/api'; // 替换为实际服务器地址

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadFile = async (fileUri: string, fileName: string, title?: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: 'text/plain',
  } as any);
  if (title) formData.append('title', title);

  return apiClient.post('/novels/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const analyzeNovel = (novelId: string) => 
  apiClient.post(`/novels/${novelId}/analyze`);

export const getTaskProgress = (taskId: string) =>
  apiClient.get(`/tasks/${taskId}/progress`);

export const getNovelAnalysis = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/analysis`);

export const getEpisodes = (novelId: string) =>
  apiClient.get(`/novels/${novelId}/episodes`);

export const generateEpisodes = (novelId: string, targetDuration?: number) =>
  apiClient.post(`/novels/${novelId}/episodes/generate`, { targetDuration });
```

- [ ] **Step 2: 创建Zustand状态管理**

```typescript
// apps/mobile/src/store/useNovelStore.ts
import { create } from 'zustand';
import { Novel, Episode, Character, TaskJob } from '@ai-script/shared-types';

interface NovelState {
  novels: Novel[];
  currentNovel: Novel | null;
  episodes: Episode[];
  characters: Character[];
  currentTask: TaskJob | null;
  
  setNovels: (novels: Novel[]) => void;
  setCurrentNovel: (novel: Novel | null) => void;
  setEpisodes: (episodes: Episode[]) => void;
  setCharacters: (characters: Character[]) => void;
  setCurrentTask: (task: TaskJob | null) => void;
  addNovel: (novel: Novel) => void;
  updateTaskProgress: (progress: number) => void;
}

export const useNovelStore = create<NovelState>((set) => ({
  novels: [],
  currentNovel: null,
  episodes: [],
  characters: [],
  currentTask: null,

  setNovels: (novels) => set({ novels }),
  setCurrentNovel: (novel) => set({ currentNovel: novel }),
  setEpisodes: (episodes) => set({ episodes }),
  setCharacters: (characters) => set({ characters }),
  setCurrentTask: (task) => set({ currentTask: task }),
  addNovel: (novel) => set((state) => ({ novels: [novel, ...state.novels] })),
  updateTaskProgress: (progress) =>
    set((state) => ({
      currentTask: state.currentTask
        ? { ...state.currentTask, progress }
        : null,
    })),
}));
```

- [ ] **Step 3: 创建SQLite数据库**

```typescript
// apps/mobile/src/db/sqlite.ts
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DATABASE_NAME = 'AiScript.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });

  await createTables();
  return db;
}

async function createTables(): Promise<void> {
  if (!db) return;

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      total_chars INTEGER,
      total_words INTEGER,
      genre TEXT,
      theme TEXT,
      style TEXT,
      tone TEXT,
      status TEXT,
      created_at INTEGER
    )
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      episode_number INTEGER,
      title TEXT,
      summary TEXT,
      duration_sec INTEGER,
      scene_location TEXT,
      characters TEXT,
      script_content TEXT,
      status TEXT
    )
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      name TEXT,
      aliases TEXT,
      appearance TEXT,
      personality TEXT,
      role_type TEXT
    )
  `);
}

export async function saveNovel(novel: any): Promise<void> {
  const database = await initDatabase();
  await database.executeSql(
    `INSERT OR REPLACE INTO novels (id, title, author, total_chars, total_words,
     genre, theme, style, tone, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [novel.id, novel.title, novel.author, novel.totalChars, novel.totalWords,
     novel.genre, novel.theme, novel.style, novel.tone, novel.status, novel.createdAt]
  );
}

export async function getNovels(): Promise<any[]> {
  const database = await initDatabase();
  const [results] = await database.executeSql('SELECT * FROM novels ORDER BY created_at DESC');
  const novels = [];
  for (let i = 0; i < results.rows.length; i++) {
    novels.push(results.rows.item(i));
  }
  return novels;
}

export async function saveEpisodes(episodes: any[]): Promise<void> {
  const database = await initDatabase();
  for (const episode of episodes) {
    await database.executeSql(
      `INSERT OR REPLACE INTO episodes (id, novel_id, episode_number, title, summary,
       duration_sec, scene_location, characters, script_content, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [episode.id, episode.novelId, episode.episodeNumber, episode.title, episode.summary,
       episode.durationSec, episode.sceneLocation, JSON.stringify(episode.characters),
       episode.scriptContent, episode.status]
    );
  }
}
```

- [ ] **Step 4: 创建首页**

```tsx
// apps/mobile/src/screens/HomeScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNovelStore } from '../store/useNovelStore';
import { getNovels, initDatabase } from '../db/sqlite';

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { novels, setNovels } = useNovelStore();

  useEffect(() => {
    loadNovels();
  }, []);

  const loadNovels = async () => {
    await initDatabase();
    const localNovels = await getNovels();
    setNovels(localNovels);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => navigation.navigate('Upload' as never)}
      >
        <Text style={styles.uploadButtonText}>+ 上传小说</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>我的项目</Text>

      <FlatList
        data={novels}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.novelCard}
            onPress={() => navigation.navigate('Analysis' as never, { novelId: item.id } as never)}
          >
            <Text style={styles.novelTitle}>{item.title}</Text>
            <Text style={styles.novelInfo}>
              {item.author} · {item.total_chars}字 · {item.status}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>暂无项目，点击上方按钮上传小说</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  novelCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  novelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  novelInfo: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
});
```

- [ ] **Step 5: 创建上传页面**

```tsx
// apps/mobile/src/screens/UploadScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { uploadFile } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { saveNovel } from '../db/sqlite';

export function UploadScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const { addNovel } = useNovelStore();

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.plainText],
      });

      const file = result[0];
      if (!file.uri) return;

      setUploading(true);
      const response = await uploadFile(file.uri, file.name || 'unknown.txt', title || undefined);
      
      const novel = response.data;
      await saveNovel(novel);
      addNovel(novel);

      Alert.alert('上传成功', '是否立即开始分析？', [
        { text: '稍后', style: 'cancel' },
        { 
          text: '开始分析', 
          onPress: () => navigation.navigate('Progress' as never, { 
            novelId: novel.novelId,
            taskType: 'analyze'
          } as never)
        },
      ]);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('上传失败', '请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>小说标题（可选）</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="输入小说标题"
      />

      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.disabledButton]}
        onPress={pickDocument}
        disabled={uploading}
      >
        <Text style={styles.uploadButtonText}>
          {uploading ? '上传中...' : '选择文件'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>支持格式：.txt, .epub, .docx</Text>
      <Text style={styles.hint}>最大支持50万字</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
```

- [ ] **Step 6: 创建进度页面**

```tsx
// apps/mobile/src/screens/ProgressScreen.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useNovelStore } from '../store/useNovelStore';
import { getTaskProgress, analyzeNovel, generateEpisodes } from '../api/client';

export function ProgressScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const { novelId, taskType } = route.params as { novelId: string; taskType: string };
  const { currentTask, setCurrentTask } = useNovelStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startTask();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startTask = async () => {
    try {
      let response;
      if (taskType === 'analyze') {
        response = await analyzeNovel(novelId);
      } else if (taskType === 'episode_generate') {
        response = await generateEpisodes(novelId);
      }

      if (response?.data?.taskId) {
        setCurrentTask({ id: response.data.taskId, status: 'running', progress: 0 } as any);
        startPolling(response.data.taskId);
      }
    } catch (error) {
      console.error('Start task error:', error);
    }
  };

  const startPolling = (taskId: string) => {
    intervalRef.current = setInterval(async () => {
      try {
        const response = await getTaskProgress(taskId);
        const task = response.data;
        setCurrentTask(task as any);

        if (task.status === 'completed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          navigation.navigate('Analysis' as never, { novelId } as never);
        } else if (task.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 2000);
  };

  const progress = currentTask?.progress || 0;

  return (
    <View style={styles.container}>
      <View style={styles.progressCircle}>
        <Text style={styles.progressText}>{progress}%</Text>
      </View>
      <Text style={styles.statusText}>
        {currentTask?.status === 'running' ? '处理中...' : 
         currentTask?.status === 'completed' ? '完成' : '等待中'}
      </Text>
      {currentTask?.errorMsg && (
        <Text style={styles.errorText}>{currentTask.errorMsg}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  statusText: {
    fontSize: 18,
    color: '#333',
  },
  errorText: {
    color: '#FF3B30',
    marginTop: 12,
  },
});
```

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat: implement mobile core screens and API integration"
```

---

## Phase 4: 部署配置

### Task 10: 部署脚本与Docker配置

**Files:**
- Create: `apps/server/docker-compose.yml`
- Create: `apps/server/Dockerfile`
- Create: `apps/server/scripts/deploy.sh`
- Create: `apps/server/scripts/setup.sh`

- [ ] **Step 1: 创建Dockerfile**

```dockerfile
# apps/server/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist ./dist
COPY .env ./

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 60000

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: 创建docker-compose.yml**

```yaml
# apps/server/docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "60000:60000"
    environment:
      - NODE_ENV=production
      - PORT=60000
      - REDIS_URL=redis://redis:6379
      - DB_PATH=/app/data/app.db
      - UPLOAD_DIR=/app/uploads
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

- [ ] **Step 3: 创建部署脚本**

```bash
#!/bin/bash
# apps/server/scripts/deploy.sh

set -e

echo "Starting deployment..."

# Build
echo "Building application..."
npm run build

# Deploy with Docker Compose
echo "Deploying with Docker Compose..."
docker-compose down
docker-compose up -d --build

echo "Deployment complete!"
echo "API available at: http://localhost:60000"
```

```bash
#!/bin/bash
# apps/server/scripts/setup.sh

set -e

echo "Setting up AI Script Server..."

# Create directories
mkdir -p data uploads logs

# Install dependencies
echo "Installing dependencies..."
npm install

# Build
echo "Building..."
npm run build

# Setup environment
echo "Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Please edit .env file with your configuration"
fi

echo "Setup complete!"
echo "Run 'npm run dev' to start development server"
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add Docker and deployment configuration"
```

---

## 测试计划

### Task 11: 基础测试

**Files:**
- Create: `apps/server/tests/novel.test.ts`
- Create: `apps/server/tests/api.test.ts`

- [ ] **Step 1: 创建Novel服务测试**

```typescript
// apps/server/tests/novel.test.ts
import { NovelService } from '../src/services/novelService';
import { novelModel } from '../src/models/novel';

jest.mock('../src/models/novel');

describe('NovelService', () => {
  let service: NovelService;

  beforeEach(() => {
    service = new NovelService();
    jest.clearAllMocks();
  });

  it('should create a novel', async () => {
    const mockCreate = jest.fn().mockResolvedValue(undefined);
    (novelModel.create as jest.Mock) = mockCreate;

    const novel = await service.createNovel(
      'Test Novel',
      'Test Author',
      'This is a test novel content',
      '/path/to/file.txt'
    );

    expect(novel.title).toBe('Test Novel');
    expect(novel.author).toBe('Test Author');
    expect(novel.totalChars).toBe(28);
    expect(mockCreate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 创建API测试**

```typescript
// apps/server/tests/api.test.ts
import request from 'supertest';
import express from 'express';
import novelRoutes from '../src/routes/novels';

const app = express();
app.use(express.json());
app.use('/api/novels', novelRoutes);

describe('API Routes', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "test: add basic unit tests"
```

---

## 总结

### 实施计划概览

| Phase | 任务数 | 核心交付物 |
|-------|--------|-----------|
| Phase 1 | 2 | Monorepo架构、共享包 |
| Phase 2 | 5 | Express后端、数据库、Deepseek集成、业务服务、API路由 |
| Phase 3 | 2 | React Native移动端、核心页面 |
| Phase 4 | 2 | Docker部署、测试 |

### 关键检查点

- [ ] 后端API可独立运行 (`npm run dev`)
- [ ] 数据库表结构正确创建
- [ ] Deepseek API调用正常
- [ ] 移动端可编译运行
- [ ] 文件上传流程端到端测试通过
- [ ] 剧本生成流程端到端测试通过

### 后续优化方向

1. **WebSocket实时推送**：替换HTTP轮询
2. **缓存优化**：Redis缓存分析结果
3. **并发控制**：限制同时处理的任务数
4. **错误重试**：指数退避重试机制
5. **日志监控**：结构化日志和监控告警
