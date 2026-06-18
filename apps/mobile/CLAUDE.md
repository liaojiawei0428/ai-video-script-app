# Deep剧本 Mobile — AI Agent 必读 (Claude Code 入口)

> 你是 AI agent, 在你**改任何 mobile 代码之前**, 必先读这三份:
> 1. [`BUGS.md`](./BUGS.md) — 历史 BUG 案例库
> 2. [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — 当下硬性规范 (23 条) + BUG 记录强制流程
> 3. [`DEPLOY.md`](./DEPLOY.md) — **完整升级部署手册** (改完代码 → 打 APK → 部署 → 验证)
>
> BUGS.md 记录了:
> - 历史 BUG 跟真凶 (代码层根因)
> - 怎么验证修好
> - **怎么避免再犯** — 这是关键, 防止你重复踩坑
> - 通用防坑清单 (Android / Hermes / ES6 import / monorepo / version 同步 / APK 部署 / SSH / 升级流程)
>
> CODING_STANDARDS.md 记录了:
> - 23 条硬性规范 (改代码必遵守)
> - BUG 记录强制流程 (修完 BUG 必追加 BUGS.md)
> - 文档维护规则
>
> DEPLOY.md 记录了:
> - **完整版本升级流程** (改 3 处 → 打 APK → scp → bump server → 5 维验证)
> - **试纸 5 步** (5 min 验证升级链路, 防 BUG-024 死循环)
> - **常见 7 类失败诊断** (弹窗不显示 / 装不上 / 死循环 / 自动装失败 等)
> - SSH key 位置 + PM2 操作 + 远端路径速查

## 项目速览

- **栈**: React Native 0.73 + Hermes + TypeScript + React Navigation 6 (Stack + BottomTabs)
- **包名**: `com.aiscriptmobile` (applicationId + namespace)
- **目录**:
  - `App.tsx` — 根组件, 5 Tab (书架/进度/生图/视频/上传/我的) + Auth gate
  - `src/screens/` — 30+ screen .tsx
  - `src/api/client.ts` — axios + auth
  - `src/config/version.ts` — **APP_VERSION 唯一来源**
  - `src/config.ts` — `API_BASE_URL = http://159.75.16.110:6000/api`
  - `src/utils/updater.tsx` — 在线升级弹窗 (DownloadManager + Modal + 通知栏)
  - `android/app/src/main/java/com/aiscriptmobile/` — **MainApplication.kt + MainActivity.kt (必修)**
  - `android/app/release.keystore` — **永久 release 签名 (BUG-023)**, 别名 `release`, 密码 `deepscript2026`
- **monorepo 共享包** (junction 指向 `F:\QiTa\banmu\APP\ai-video-script-app\packages\shared-types`):
  - `@ai-script/shared-types` — **只放 TS type**, 不要 import value (参考 BUG-005)
- **依赖 server**:
  - `apps/server/` (shipin-APP prod)
  - `apps/web/` (web 端, 镜像 mobile UI)

## 改代码前 3 步必做

1. `Read BUGS.md` 全部 + `Read CODING_STANDARDS.md` 23 条规范 + `Read DEPLOY.md` 升级流程
2. `Read 目标文件` 完整内容
3. `Grep 关键 import` 是否引用真源 (不要臆造字段, 不要从 monorepo 拿 value)

## 改完代码后 5 步必做 (升级部署流程)

1. **改 3 处版本号** — `version.ts` + `build.gradle` (versionCode + versionName) + 任何新代码
2. `gradlew assembleRelease` 重打 APK (3-5 min 增量编译)
3. `aapt2 dump badging app-release.apk` 验 versionName 跟 `version.ts` 一致, `apksigner verify --print-certs` 验证书 DN = `CN=DeepScript Release`
4. **scp 上传 + bump server** (PM2 env 切 APP_VERSION) — 详见 `DEPLOY.md` § 3
5. **5 维验证** — 公网 APK 200 + SHA256 跟本机一致 + /api/version 触发升级 + 弹窗按钮数 3 + 历史 APK 不覆盖

## 升级链路 7 条铁律 (S58 P10 BUG-021/022/023/024/025 总结)

1. **弹窗代码 100% 走 `react-native-blob-util` + `useDownloadManager: true`** (BUG-021/022)
2. **release APK 必用 `signingConfigs.release`**, 不用 debug (BUG-023)
3. **试纸 / 新版本必重打包**, 不 cp 旧包 (BUG-024)
4. **装 APK 必用 `_state.destPath` 不用 `res.path()`** (BUG-025)
5. **公网 APK 文件名 `DeepScript_v${version}.apk` 跟 APK 内 `versionName` 一致** (防 BUG-017 覆盖错位)
6. **不批量覆盖历史 APK**, 部署只上传当前版本 (防 BUG-017)
7. **历史 APK 文件保留**, 至少留 5 个版本, 用户回滚有路

详细 5 步流程 + 7 类失败诊断 + 完整命令模板 → 看 `DEPLOY.md`
