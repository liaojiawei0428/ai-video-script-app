# 阶段1: 构建依赖和编译
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制 workspace 配置
COPY package.json turbo.json ./
COPY packages ./packages
COPY apps/server ./apps/server

# 安装所有依赖 (包括 workspace 依赖)
RUN npm install

# 构建共享包
RUN npm run build --workspace=@ai-script/shared-types
RUN npm run build --workspace=@ai-script/shared-utils

# 构建后端
RUN npm run build --workspace=@ai-script/server

# 阶段2: 生产运行
FROM node:20-alpine AS production

WORKDIR /app

# 安装生产依赖
RUN apk add --no-cache curl

# 创建必要的目录
RUN mkdir -p data uploads logs

# 复制构建产物
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/packages/shared-types/dist ./node_modules/@ai-script/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./node_modules/@ai-script/shared-utils/dist
COPY --from=builder /app/packages/shared-types/package.json ./node_modules/@ai-script/shared-types/
COPY --from=builder /app/packages/shared-utils/package.json ./node_modules/@ai-script/shared-utils/

# 只安装生产依赖
RUN npm install --only=production --omit=dev

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:60000/health || exit 1

EXPOSE 60000

CMD ["node", "dist/index.js"]
