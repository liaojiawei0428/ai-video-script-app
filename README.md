# AI 视频剧本生成应用

> 将长篇小说智能转换为标准 AI 视频剧本

[![CI/CD](https://github.com/liaojiawei0428/ai-video-script-app/actions/workflows/ci.yml/badge.svg)](https://github.com/liaojiawei0428/ai-video-script-app/actions)

## 项目简介

本项目是一款 AI 视频剧本生成应用，能够将长篇小说（支持 50 万字以内）自动分析并转换为符合行业标准的视频剧本。应用支持 Android 和 iOS 双平台，后端部署于腾讯云服务器。

## 核心功能

- **小说上传**：支持 TXT、EPUB、DOCX 格式
- **智能分析**：使用 Deepseek V4 API 分析角色、场景、剧情
- **剧集划分**：自动将小说划分为 120 秒左右的剧集
- **剧本生成**：生成包含场景描述、对白、动作指示的标准剧本
- **镜头设计**：为每集剧本生成分镜画面描述
- **实时进度**：WebSocket 推送任务处理进度
- **断点续传**：任务中断后可从中断处继续

## 技术架构

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 移动端 | React Native | 0.73+ |
| 后端 | Node.js + Express | 20+ |
| 数据库 | SQLite | 5.1+ |
| 缓存 | Redis | 7.x |
| AI 模型 | Deepseek V4 | API |
| 部署 | Docker + Nginx | - |

### 项目结构

```
ai-video-script-app/
├── apps/
│   ├── mobile/          # React Native App
│   └── server/          # Node.js 后端服务
├── packages/
│   ├── shared-types/    # 共享 TypeScript 类型
│   └── shared-utils/    # 共享工具函数
├── docs/                # 项目文档
└── .github/workflows/   # CI/CD 配置
```

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 10.0.0
- Redis 7.x（可选，用于任务队列）

### 安装依赖

```bash
# 根目录安装
cd ai-video-script-app
npm install

# 构建共享包
cd packages/shared-types && npm install && npm run build
cd ../shared-utils && npm install && npm run build

# 安装后端依赖
cd ../../apps/server && npm install
```

### 配置环境变量

```bash
cd apps/server
cp .env.example .env
```

编辑 `.env` 文件，配置你的 Deepseek API 密钥：

```env
DEEPSEEK_API_KEY=sk-your-api-key-here
```

### 启动后端服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务启动后访问：http://localhost:60000/health

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/novels/upload` | 上传小说文件 |
| POST | `/api/novels/:id/analyze` | 分析小说 |
| GET | `/api/novels/:id/analysis` | 获取分析结果 |
| GET | `/api/novels/:id/episodes` | 获取剧集列表 |
| POST | `/api/novels/:id/episodes/generate` | 生成剧集剧本 |
| GET | `/api/tasks/:id/progress` | 查询任务进度 |

## Docker 部署

### 使用 Docker Compose（推荐）

```bash
# 配置环境变量
export DEEPSEEK_API_KEY=your-api-key

# 一键部署
chmod +x deploy.sh
./deploy.sh
```

### 手动构建

```bash
# 构建镜像
docker build -f apps/server/Dockerfile -t ai-script-server .

# 运行容器
docker run -d -p 60000:60000 \
  -e DEEPSEEK_API_KEY=your-api-key \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  ai-script-server
```

## 腾讯云部署

### 1. 服务器准备

- 购买腾讯云 CVM（建议 2核4G 以上）
- 安装 Docker 和 Docker Compose
- 配置安全组，开放 80/443/60000 端口

### 2. 部署步骤

```bash
# 克隆代码
git clone https://github.com/liaojiawei0428/ai-video-script-app.git
cd ai-video-script-app

# 配置环境变量
export DEEPSEEK_API_KEY=your-api-key

# 部署
./deploy.sh

# 配置 Nginx
sudo cp apps/server/nginx.conf /etc/nginx/conf.d/ai-script.conf
sudo nginx -s reload
```

### 3. SSL 证书

将 SSL 证书放置到 `/etc/nginx/ssl/` 目录：
- `cert.pem` - 证书文件
- `key.pem` - 私钥文件

## 移动端开发

### 环境配置

```bash
cd apps/mobile

# 安装依赖
npm install

# iOS（Mac  only）
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

### 配置 API 地址

创建 `.env` 文件：

```env
API_BASE_URL=https://your-domain.com/api
WS_BASE_URL=https://your-domain.com
```

## 测试

```bash
cd apps/server

# 运行测试
npm test

# 带覆盖率
npm test -- --coverage
```

## 项目文档

- [系统设计规范](docs/specs/2026-05-13-ai-video-script-design.md)
- [实施计划](docs/plans/2026-05-13-implementation-plan.md)
- [AI 执行规范](docs/specs/ai-execution-protocol.md)
- [问题追踪](docs/issues.md)

## 费用估算

使用 Deepseek V4 API 处理 50 万字小说的大致费用：

| 步骤 | 输入 Token | 输出 Token | 费用 |
|------|-----------|-----------|------|
| 全文分析 | 75 万 | 2 万 | ~$0.4 |
| 剧集划分 | 2 万 | 0.5 万 | ~$0.01 |
| 剧本生成（40集） | 60 万 | 12 万 | ~$0.5 |
| 镜头生成（40集） | 20 万 | 8 万 | ~$0.3 |
| **总计** | **157 万** | **22.5 万** | **~$1.2** |

## 贡献指南

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/xxx`
3. 提交更改：`git commit -m "feat: xxx"`
4. 推送分支：`git push origin feature/xxx`
5. 创建 Pull Request

## 许可证

MIT License

## 联系方式

- 项目地址：https://github.com/liaojiawei0428/ai-video-script-app
- 问题反馈：https://github.com/liaojiawei0428/ai-video-script-app/issues
