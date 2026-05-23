#!/bin/bash
set -e

echo "=== AI视频剧本生成应用部署脚本 ==="

# 检查环境
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "错误: 请设置 DEEPSEEK_API_KEY 环境变量"
    exit 1
fi

# 创建必要目录
echo "创建数据目录..."
mkdir -p data uploads logs

# 构建并启动
echo "构建 Docker 镜像..."
docker-compose build

echo "启动服务..."
docker-compose up -d

echo "等待服务启动..."
sleep 10

# 健康检查
echo "检查服务健康状态..."
if curl -f http://localhost:6000/health > /dev/null 2>&1; then
    echo "服务启动成功！"
    echo "API地址: http://localhost:6000"
else
    echo "服务可能未完全启动，请检查日志: docker-compose logs -f server"
fi

echo "部署完成！"
