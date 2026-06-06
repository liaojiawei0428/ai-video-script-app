# Deep剧本 v2.0.0 部署指南

**重要：操作前先在宝塔面板备份数据库 + 现有 shipin-APP 目录**

## 部署包
- `shipin-APP-server-v2.0.0.tar.gz` (154KB) - 后端
- `shipin-APP-web-v2.0.0.tar.gz` (86KB) - Web 端

## 一、前置：服务器备份（已做过，可跳过）

```bash
# 已备份
ls /www/backup/ai-script-migration/ai_script-20260604-133818.sql
ls /www/backup/shipin-APP-v1.2.0/
```

## 二、部署后端 (5 步)

```bash
# 1. 上传部署包
scp shipin-APP-server-v2.0.0.tar.gz root@159.75.16.110:/tmp/

# 2. SSH 进服务器
ssh root@159.75.16.110

# 3. 停 PM2
cd /www/wwwroot/shipin-APP
pm2 stop shipin-app 2>/dev/null || pm2 stop all

# 4. 替换 dist (保留 node_modules, uploads, .env)
tar -xzf /tmp/shipin-APP-server-v2.0.0.tar.gz
# 只覆盖 dist 和 package.json (因新增 uuid + pdfkit + docx 依赖)
cp -r dist dist.bak
rm -rf dist
tar -xzf /tmp/shipin-APP-server-v2.0.0.tar.gz
ls dist/index.js  # 验证

# 5. 安装新依赖 (uuid + pdfkit + docx)
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -5

# 6. 启动 + 验证
pm2 restart shipin-app
sleep 3
pm2 logs shipin-app --lines 30 --nostream
curl -s http://localhost:6000/health
curl -s http://localhost:6000/api/version  # 应返回 2.0.0
```

## 三、DB 增量迁移 (initTables 自动跑)

后端启动时**自动跑** `initTables()` 内的兼容迁移 SQL：
- characters 表加 8 字段
- novels 表加 5 字段  
- episodes 表加 3 字段
- shots 表加 5 字段
- 新增 assets/chapters/points_orders/style_presets 4 表
- notifications 表加 2 字段

**验证**:
```bash
mysql -h10.1.0.11 -uroot -p ai_script -e "
  DESC characters; -- 应有 8 新字段
  DESC novels;     -- 应有 5 新字段
  SELECT COUNT(*) FROM style_presets; -- 应为 5
  SHOW TABLES;     -- 应有 13 张表 (原 11 + assets/chapters)
"
```

## 四、部署 Web 端 (3 步)

```bash
# 1. 上传
scp shipin-APP-web-v2.0.0.tar.gz root@159.75.16.110:/tmp/

# 2. 部署到宝塔 web 目录
ssh root@159.75.16.110
# 选项 A: 单独站点 (推荐) - 在宝塔添加 ab.maque.uno 站点指向 /www/wwwroot/ab.maque.uno
mkdir -p /www/wwwroot/ab.maque.uno
cd /www/wwwroot/ab.maque.uno
tar -xzf /tmp/shipin-APP-web-v2.0.0.tar.gz
ls index.html  # 验证
# 配 nginx 反代 /api -> http://localhost:6000 (宝塔"反向代理"功能)

# 选项 B: 部署到 maque.uno 子目录 /drama
# 在宝塔"网站 → maque.uno → 子目录"添加 /drama 指向 /www/wwwroot/ab.maque.uno
```

## 五、宝塔 Nginx 反代 (站点配置)

进入 `宝塔面板 → 网站 → ab.maque.uno → 配置文件`, 添加:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:6000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    client_max_body_size 50M;
}
```

## 六、smoke test

```bash
# 后端
curl -s http://localhost:6000/api/version | jq
# 期望: {"success":true,"data":{"version":"2.0.0",...}}

# Web (假设 ab.maque.uno 已指向)
curl -sI https://ab.maque.uno | head -3
# 期望: 200 OK, content-type: text/html

# 移动端新接口 (需登录)
curl -s -H "Authorization: Bearer <token>" http://localhost:6000/api/novels/<id>/characters | jq
curl -s -X POST -H "Authorization: Bearer <token>" http://localhost:6000/api/novels/<id>/outline/generate | jq
```

## 七、监控

```bash
pm2 monit                    # 实时监控
pm2 logs shipin-app --lines 100  # 查错误
```

## 部署包位置
- 本地: `/tmp/shipin-APP-server-v2.0.0.tar.gz`
- 本地: `/tmp/shipin-APP-web-v2.0.0.tar.gz`
