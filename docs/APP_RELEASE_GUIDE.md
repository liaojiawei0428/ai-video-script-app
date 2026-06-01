# APP版本发布与官网更新指南

> 本文档记录了Deep剧本APP的版本发布流程，包括APK编译、上传服务器、更新官网下载页面的完整步骤。

---

## 目录结构

```
项目根目录/
├── apps/mobile/                    # React Native APP源码
│   ├── android/app/build/outputs/apk/release/
│   │   └── app-release.apk        # 编译输出的APK
│   └── src/                        # APP源代码
├── apps/server/                    # 后端服务代码
└── docs/
    └── APP_RELEASE_GUIDE.md        # 本文档
```

## 服务器目录结构

```
/www/wwwroot/shipin-APP/public/     # Nginx实际指向的下载目录
├── Deep剧本_vX.X.X.apk            # 版本APK文件
├── index.html                      # 下载页面
└── qrcode.min.js                   # 二维码库（备用）

Nginx配置位置：/www/server/panel/vhost/nginx/extension/maque.uno/app-download.conf
下载页面URL：https://maque.uno/app/
APK下载URL：https://maque.uno/app/Deep剧本_vX.X.X.apk
```

---

## 版本发布流程

### 步骤1：确定版本号

版本号格式：`X.Y.Z`（如 1.1.0）

按项目版本管理规范判定更新类别并计算版本号：

- **3类（大版本）X**：UI + 核心功能改动
- **2类（中版本）Y**：UI + 小功能微调
- **1类（小版本）Z**：仅UI逻辑改动

详见 [VERSION_POLICY.md](./VERSION_POLICY.md)

在 `apps/mobile/src/config/version.ts` 中修改 `APP_VERSION` 为新的版本号。

### 步骤2：编译APK

```bash
# 设置环境变量
export ANDROID_HOME=/home/jiawei/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin

# 进入android目录编译
cd apps/mobile/android
./gradlew clean assembleRelease

# 编译输出位置
# apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 步骤3：上传APK到服务器

```bash
# 重命名APK（包含版本号）
# 格式：Deep剧本_vX.X.X.apk

# 上传到服务器
scp apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
    root@159.75.16.110:/www/wwwroot/shipin-APP/public/Deep剧本_vX.X.X.apk
```

### 步骤4：更新下载页面

SSH登录服务器，更新下载页面中的版本号和APK文件名：

```bash
ssh root@159.75.16.110

# 更新index.html中的版本号和APK链接
sed -i 's|v旧版本|v新版本|g' /www/wwwroot/shipin-APP/public/index.html
sed -i 's|Deep剧本_v旧版本.apk|Deep剧本_v新版本.apk|g' /www/wwwroot/shipin-APP/public/index.html

# 删除旧版本APK（可选）
rm -f /www/wwwroot/shipin-APP/public/Deep剧本_v旧版本.apk
```

### 步骤5：验证

```bash
# 验证APK可下载
curl -sI https://maque.uno/app/Deep剧本_vX.X.X.apk | head -3
# 应返回 HTTP/2 200

# 验证下载页面
curl -sI https://maque.uno/app/ | head -3
# 应返回 HTTP/2 200
```

### 步骤6：记录版本信息

在 `DEV_PROGRESS.md` 的"AI 会话追踪"表中记录本次发布：

```markdown
| S序号 | 日期 | **版本发布**：vX.X.X<br>- 功能1<br>- 功能2<br>- Bug修复 | 下一个任务 |
```

---

## 完整示例：发布v1.1.0

```bash
# 1. 编译
cd /media/jiawei/D266CE3A66CE1F5B/xiangmu/APP_kaifa/AI_shipin_jiaoben
export ANDROID_HOME=/home/jiawei/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin
cd apps/mobile/android && ./gradlew assembleRelease && cd ../../..

# 2. 上传
scp apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
    root@159.75.16.110:/www/wwwroot/shipin-APP/public/DeepScript_v1.1.0.apk

# 3. 更新下载页面
ssh root@159.75.16.110 "sed -i 's|DeepScript_v1.0.1.apk|DeepScript_v1.1.0.apk|g' /www/wwwroot/shipin-APP/public/index.html && sed -i 's|v1.0.1|v1.1.0|g' /www/wwwroot/shipin-APP/public/index.html"

# 4. 删除旧版本
ssh root@159.75.16.110 "rm -f /www/wwwroot/shipin-APP/public/DeepScript_v1.0.1.apk"

# 5. 验证
curl -sI https://maque.uno/app/DeepScript_v1.1.0.apk | head -3
```

---

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器IP | 159.75.16.110 |
| SSH用户 | root |
| SSH密钥 | ~/.ssh/id_ed25519 |
| 下载目录 | /www/wwwroot/shipin-APP/public/ |
| 官网URL | https://maque.uno/app/ |
| Nginx配置 | /www/server/panel/vhost/nginx/extension/maque.uno/app-download.conf |

---

## 注意事项

1. **Nginx配置**：`/app/` 路径指向 `/www/wwwroot/shipin-APP/public/`，不是 `/www/wwwroot/sparrow-logic/app/`
2. **文件名编码**：APK文件名包含中文，URL需要URL编码（浏览器自动处理）
3. **版本号同步**：确保 `index.html` 中的版本号与APK文件名一致
4. **旧版本清理**：发布新版本后及时删除旧版本APK，节省服务器空间
5. **GitHub同步**：重要版本更新后，将变更推送到GitHub仓库

---

## 服务端部署检查清单

每次服务端部署**必须**严格按以下顺序执行：

| # | 步骤 | 命令/API |
|---|------|----------|
| 1 | 检查活跃任务 | `GET /api/admin/active-tasks` |
| 2 | 有任务→发布公告 | `POST /api/notifications/admin/announcement` |
| 3 | 开启维护模式 | `PUT /api/admin/maintenance?enable=true` |
| 4 | 等待任务完成 | 轮询步骤1，最长等15分钟 |
| 5 | 执行部署 | `tar xzf dist.tar.gz && pm2 restart` |
| 6 | 验证健康检查 | `GET /health` 返回 `{"status":"ok"}` |
| 7 | 关闭维护模式 | `PUT /api/admin/maintenance?enable=false` |
| 8 | 通知完成 | `POST /api/notifications/admin/announcement` |

**自动化**: `apps/server/deploy.sh`（设 `ADMIN_TOKEN` 环境变量后执行）

> ⚠️ 严禁跳过检查直接 `pm2 restart`，中断正在执行的分析任务将导致用户扣费但无结果。

---

## 相关文档

- [DEV_PROGRESS.md](../DEV_PROGRESS.md) - 开发进度追踪
- [AGENTS.md](../AGENTS.md) - AI助手项目指令

---

*最后更新：2026-05-31*
