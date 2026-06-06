# v2.0.0 Web 端部署步骤 (ab.maque.uno)

## ✅ 已完成 (我做完的)
- 后端 v2.0.0 部署: PM2 `ai-script-server` pid 在线, /api/version 返回 2.0.0
- DB v2.0 迁移: 4 新表 (assets/chapters/points_orders/style_presets) + 5 行画风 seed + 多列扩展
- Web 静态资源: 已部署到 `/www/wwwroot/ab.maque.uno/`
- nginx extension 配置: 已准备好 → `ab.maque.uno.ext.conf`
- 宝塔 add site 模板: 用户操作 5 分钟

## 📋 用户在宝塔操作 (5 分钟)

### 步骤 1: 添加站点
宝塔面板 → 网站 → 添加站点:
- 域名: `ab.maque.uno`
- 根目录: `/www/wwwroot/ab.maque.uno` (我已创建并放入 dist, **不要**勾选"创建数据库")
- PHP: 纯静态 (选 "不创建" 或 "纯静态")
- 提交

### 步骤 2: 签 SSL 证书
宝塔面板 → 网站 → ab.maque.uno → 设置 → SSL:
- 选 "Let's Encrypt"
- 勾选 ab.maque.uno
- 点击 "申请"
- 等待 30-60 秒签发完成

### 步骤 3: 强制 HTTPS
宝塔面板 → ab.maque.uno → 设置 → SSL → 右上角 "强制 HTTPS" → 开启

## 📋 我会做的 (用户完成宝塔 2 步后告诉我)

1. scp 推送 extension conf:
   ```bash
   scp -i ~/.ssh/id_ed25519 ab.maque.uno.ext.conf \
       root@159.75.16.110:/www/server/panel/vhost/nginx/extension/ab.maque.uno/web.conf
   ```

2. 测试 nginx 配置 + reload:
   ```bash
   ssh root@159.75.16.110 'nginx -t && nginx -s reload'
   ```

3. 验证:
   ```bash
   curl -sI https://ab.maque.uno              # 200, 看到 <title>Deep剧本
   curl -s  https://ab.maque.uno/api/version   # {"version":"2.0.0"}
   ```

## 🎯 验证后

- ✅ https://ab.maque.uno 可访问
- ✅ 登录注册功能通
- ✅ 11 个页面 (Bookshelf/ScriptDetail/EpisodeDetail/CharacterList/Outline/PlotGraph/AssetLibrary/AIAssistant/Recharge/Login/Register) 可访问

## 🔄 APK 重打 (后续)

移动端 App.tsx 已注册 8 个 v2.0 屏幕, 需在 Android Studio build 验证。
下载链接 `/api/version` 已指向 `DeepScript_v2.0.0.apk`。
