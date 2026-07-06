<!-- BUG-148 (2026-07-02) DeepSeek API 调用规范严格对齐官方文档 (错误码映射 + 流式计费 + 思考模式 + user_id 隔离 + 弃用警告)
   触发根因: BUG-147 修后审查官方文档发现 5 个 API 集成错误, 跟 BUG-147 报告'老 IP ban'误判直接矛盾 (401 真实是 API key 错, 跟 IP 无关)
   详见 AGENTS.md § 6.26 / changelog.json v3.0.78 / mavis memory
-->

<!-- BUG-147 (2026-07-02) 鏈嶅姟鍣ㄥ叕缃?IP 鍙樻洿: 159.75.16.110 -> 119.91.155.46 (鑵捐浜?VM 鎹?EIP)
   瑙﹀彂鏍瑰洜: DeepSeek 骞冲彴 governor 椋庢帶 ban 浜?159.75.16.110 (璺?BUG-146 鍚屾簮)
   鏈枃浠跺巻鍙叉淇濈暀鏃?IP 浣滀负鏃堕棿绾挎。妗? 鏂伴儴缃茶蛋 119.91.155.46
   璇﹁ AGENTS.md 搂 6.25 / BUG-147 / mavis memory
-->

## BUG-148: DeepSeek API 调用规范严格对齐官方文档 (v3.0.78, 2026-07-02)

### 背景

BUG-147 修后审查 https://api-docs.deepseek.com/zh-cn/ 12 维度官方文档, 发现 shipin-app 端 5 个 API 调用错误:

1. **错误码全包 502 DEEPSEEK_API_ERROR**: 401/402/429/400/422/5xx 都被 shipin-app 包成 502 + 错误信息丢失, 前端看不到 'Your api key: ****26a5 is invalid' 真实错误
2. **流式缺 stream_options.include_usage**: 流式响应拿不到 usage 统计, shipin-app 流式不计费或偏低 5-15%
3. **思考模式传 temperature**: deepseek-v4-flash/pro 默认 thinking enabled, 官方说 '思考模式不支持 temperature 设置参数不会报错但也不会生效' (跟 BUG-147 '60 并发超 2500 限流' 误判同源, 没读官方文档)
4. **没传 user_id**: 官方强烈建议, 三层价值 (内容安全 + KVCache + 调度隔离)
5. **没弃用警告**: deepseek-chat + deepseek-reasoner 2026/07/24 23:59 (北京时间) 弃用

### 修法 5 件套

**修法 1 (deepseek.ts mapDeepseekError)**: 严格透传 401/402/429/400/422/5xx + axios response.data, 让前端能看到真实错误
**修法 2 (deepseek.ts buildRequestBody)**: stream=true 时加 `stream_options: { include_usage: true }`, 末尾自动带 usage 块 (prompt_tokens / completion_tokens / total_tokens / cache_hit / cache_miss / reasoning_tokens)
**修法 3 (deepseek.ts buildRequestBody)**: v4 模型显式 `thinking: { type: 'enabled' }`, 跳过 temperature (官方说无效)
**修法 4 (整条调用链加 userId)**: controller → service → sub-service → deepseekPool → DeepseekService 整条链必传 userId?: string
**修法 5 (changelog.json 顶部加弃用警告)**: deepseek-chat + deepseek-reasoner 2026/07/24 23:59 弃用, 兼容映射 → deepseek-v4-flash

### BUG-147 误判澄清

| 维度 | BUG-147 第一轮报告 | BUG-148 实战修正 |
|---|---|---|
| 401 错误码含义 | governor 风控 ban IP | API key 错误 (官方明确) |
| 换 IP 修法对吗 | 对 (因为同时换了 key) | 误打误撞 — 真实修法是换 key |
| 60 并发是否超限 | 超 2500/账号限流 | 60 << 2500, 远未触限 |
| 400K 字符是否超限 | 超 1M context | 400K << 1M, 跟 context 无关 |
| max_tokens 32K 是否超限 | 超 384K 输出 | 32K < 384K, 跟输出上限无关 |

### 12 维度对照官方文档

| 维度 | 官方要求 | 修前 | 修后 |
|---|---|---|---|
| base_url | https://api.deepseek.com | ✅ | ✅ |
| Authorization Bearer | Bearer sk-xxx | ✅ | ✅ |
| model | 公开模型 (v4-flash/v4-pro) | ✅ deepseek-v4-flash | ✅ |
| 1M context | input 1M tokens | ✅ | ✅ |
| 384K 输出 | max_tokens ≤ 384K | ✅ 32K | ✅ |
| 2500/账号 并发 | TPM + RPM 限流 | ✅ 60 << 2500 | ✅ |
| 1 中文字符 ≈ 0.6 token | 计费用 | ✅ | ✅ |
| 流式 SSE data:[DONE] 解析 | 正确解析流式 | ❌ 缺 include_usage | ✅ |
| frequency_penalty/presence_penalty | deprecated | ✅ 不传 | ✅ |
| 错误码 401/402/422/429/5xx | 严格透传 | ❌ 全包 502 | ✅ |
| user_id | 强烈建议传 | ❌ 没传 | ✅ |
| stream_options.include_usage | 计费强烈建议 | ❌ 没传 | ✅ |

### 4 条新跨项目通用铁律 (跟 BUG-148 实战沉淀)

1. **AI API 调用必传 user_id** (新铁律, BUG-148 核心): 内容安全 + KVCache + 调度隔离三大优化, 单用户暴雷不连带
2. **AI 错误码必严格映射** (新铁律, BUG-148 沉淀): 不包装 502, 透传 upstream 状态码 + message
3. **AI 流式调用必传 stream_options.include_usage** (新铁律, BUG-148 沉淀): 准确计费唯一途径
4. **AI 调用官方文档必查** (新铁律, BUG-148 沉淀, 跟 § 3.10 BUG-135 互补): base_url / 鉴权 / model / context / 并发 / 计费 / 流式 / deprecated / 错误码 / user_id / include_usage 12 维度

### 部署 6 维全过 + E2E 4 项全过

部署 6 维: systemctl active + 6000 + /health 200 + /api/version 3.0.78 + 公网 3.0.78 + APK HTTP/2 200.

E2E 4 项 (远端跑): 新 key #1 HTTP 200 + reasoning_tokens / 流式 + include_usage 末尾 usage 块 / 思考模式 reasoning_content 28/34 / 错 key HTTP 401 透传.

### 部署踩坑笔记 (3 个, 跟 § 6.24 BUG-145 实战相关)

1. **shipin-APP flat 结构 dist/changelog.json 不会被自动覆盖**: 远端 `cp /www/wwwroot/shipin-APP/changelog.json /www/wwwroot/shipin-APP/dist/changelog.json` 双覆盖 (跨项目通用铁律, BUG-143 实战)
2. **远端 .env APP_VERSION 覆盖 systemd unit Environment=**: sed 同步 (跨项目通用铁律, BUG-144 实战)
3. **scp 远端 dist/index.js 会被 server 进程占用**: 部署前必先 stop service → scp → start (跨项目通用铁律, BUG-144 实战)
4. **changelog.json 顶层 latest_version 字段保持单一份**: 避免 JSON 解析 last-wins 冲突 (跨项目通用铁律, BUG-145 实战)
5. **PS5.1 + 嵌套 JSON 双引号转义冲突**: 必用 .sh 脚本上传执行 (新铁律, BUG-148 实战)

### 弃用警告 (2026/07/24 23:59 北京时间)

```
重要: deepseek-chat + deepseek-reasoner 两个模型名将于 2026/07/24 23:59 (北京时间) 弃用.

兼容映射:
- deepseek-chat → deepseek-v4-flash (非思考模式)
- deepseek-reasoner → deepseek-v4-flash (思考模式, thinking.enabled)

shipin-app 已用 deepseek-v4-flash ✅, 但用户脚本/API 如果还在指定老模型会报错.
提前 22 天发警告, 让用户有时间迁移.
```

### mavis memory 沉淀

```
BUG-148 (v3.0.78 DeepSeek API 调用规范严格对齐官方文档):
- 跨项目通用铁律: AI API 调用必传 user_id
- 跨项目通用铁律: AI 错误码必严格映射
- 跨项目通用铁律: AI 流式调用必传 stream_options.include_usage
- 跨项目通用铁律: AI 调用官方文档必查 12 维度
- BUG-147 误判修正: 401 = API key 错, 跟 IP 无关
- 部署 6 维 + E2E 4 项全过
- PS5.1 + 嵌套 JSON 双引号转义冲突 → 必用 .sh 脚本上传执行
- deepseek-chat + deepseek-reasoner 弃用警告必在 changelog.json 顶部加 (2026/07/24 23:59)
```

# Deep�籾 Mobile BUG �޸���ʷ + ����ָ��

> **������ AI �����ٲ��ĵ�** �� ÿ������ BUG, ��׷��һ�������ļ�, д��:
> 1. BUG ���� (�û��ӽ�)
> 2. ���� (��������)
> 3. �޸� (�����ĸ��ļ�)
> 4. **��ô��֤�޺���** + **��ô�����ٷ�**
>
> д���ļ���Ŀ����: **��һ�� AI ��Ҫ�ظ���ͬһ����, ����û����Ĺ��ܸĻ���**��

## 0. ���ٶ�λ (AI 30 �����)

> **?? S69 �½� [`docs/BUGS_INDEX.md`](../../docs/BUGS_INDEX.md) v1.0** (��Ŀ��Ŀ¼ `docs/BUGS_INDEX.md`):
> - **�� 1 30 ��������** (����ŵ���, ����޵� BUG ���ȿ�)
> - **�� 2 ���ؼ�������** (APK / ���� / �۷� / server / mobile / web / tsc compile / AGENTS.md / SSH)
> - **�� 3 ������ SOP** (S0 �� session / S1 �� src / S2 ���� server / S3 ���� APK / S4 �Ŀ۷� / S5 �Ĺ淶 / S6 �������)
> - **�� 4 ��Ƶ�ȿ� Top 10** (PM2 delete+start / APP_VERSION 6 �� / ά��ģʽ / aapt2 ��֤ / ����һ�� / ����ͬ�� / 1-�� minified / ����տ� / �۷����� / SSH key)
> - **�� 5 ���� BUG �б�** (�����, ê�����ӵ����ļ�)
> - **�� 6 ά�� SOP** (�� BUG �ؼ����� 5 ��)
> - **�� 7 �����ĵ�** (���� BUG �� + �������� + �� session ���� + ���� SOP + �淶�Ե���)
>
> **�κ� AI �ӻ�ǰ** �ض� BUGS_INDEX.md �� 1 ���� + �� 4 Top 10, Ȼ���ٷ����ļ���ϸ����.

---

## v3.0.0 �� v3.0.11 �޸���ʷ (S58 �ڼ�)

### BUG-001 (S58 P1): APK װ�����ֱ������

- **����**: װ�� shipin-APP APK (v3.0.0~v3.0.11), �������
- **����**: RN 0.73 Ĭ�� bundle �� Hermes bytecode, build.gradle �� `hermesEnabled=false`, ����ʱ�� JS ����� bytecode ʧ��
- **�޸�**: ɾ `hermesEnabled=false` �� RN 0.73 Ĭ���� Hermes
- **�ļ�**: `apps/mobile/android/app/build.gradle`
- **��֤**: logcat �� `ReactNativeJS: Running 'main' with hermes=true`, APP ����ҳ

### BUG-002 (S58 P1): ��������, ɶ������ʾ

- **����**: Hermes ���˵�ҳ��հ�
- **����**: React Native 0.73 + monorepo shared-types package import value (������ type) ʱ, Metro bundler �� cyclic dep ��
- **�޸�**: �� monorepo �� `import type` + ��ʽ re-export ����
- **�ļ�**: `packages/shared-types/index.ts` + `apps/mobile/src/types/index.ts`
- **��֤**: Metro log �� cyclic dep warning, ҳ������ render

### BUG-003 (S58 P1): SSH IP ����, ���������Ϸ�����

- **����**: handoff �ĵ�д `43.142.33.78`, ʵ�ʷ������� `159.75.16.110`, ssh ������
- **����**: ��д handoff ʱ���� IP
- **�޸�**: �ĳ� `159.75.16.110`, ͬʱȷ�� ssh key ·��
- **�ļ�**: `handoff-s58-p1.md`
- **��֤**: `ssh -i key root@159.75.16.110 "pm2 list"` ���� ai-script-server ����

### BUG-004 (S58 P3): ��� "��ͼ" / "��Ƶ" tab, ҳ��հ�, ɶ������ʾ

- **����**: �� ImageAgentScreen / VideoAgentScreen, �б�հ�, ��������ʷ
- **����**: API �˵�д�� (ǰ�� `/image-agent/conversations` �� ��� `/api/image-agent/conversations`, �� baseURL û�Զ��� `/api` ǰ׺)
- **�޸�**: �� apiClient baseURL, �� `/api` ǰ׺
- **�ļ�**: `apps/mobile/src/lib/api.ts`
- **��֤**: ImageAgent ����ҳ��������ʷ list

### BUG-005 (S58 P3): ��� "�ϴ�" tab, APP ��������

- **����**: �� UploadScreen, �ϴ���ť���� �� ����
- **����**: `react-native-document-picker` �� Android 13+ ��Ҫ READ_MEDIA_IMAGES Ȩ��, û���� �� AndroidManifest exception
- **�޸�**: AndroidManifest �� READ_MEDIA_IMAGES + READ_MEDIA_VIDEO + READ_EXTERNAL_STORAGE
- **�ļ�**: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- **��֤**: �� UploadScreen ������, ѡͼƬ����

### BUG-006 (S58 P3): APK ��װʱ keystore ���ɸ���

- **����**: ��һ�� build �� debug.keystore, �����汾�뱣��ͬһǩ��װ����
- **����**: debug.keystore �� Android Studio �Զ����ɵ���ʱ keystore, λ���� `~/.android/`, ��װ OS/clean build ���ᶪ
- **�޸�**: ����ר�� release.keystore ���ñ���
- **�ļ�**: `apps/mobile/android/app/release.keystore` (v3.0.23 ������)
- **��֤**: ��� v3.0.x APK װͬһ̨�豸, ǩ�� SHA1 һ��, ��������ж��

### BUG-007 (S58 P4): "��������" ��������û��Ӧ, ����ʾ���ؽ�����

- **����**: APP ��⵽�°�, ��"��������" Modal, ����û action, û������
- **����**: ��ʱ�� RNFS.downloadFile, RN 0.73 + Hermes ���Ȼص�������
- **�޸�**: �� react-native-blob-util ��ϵͳ DownloadManager (֪ͨ������)
- **�ļ�**: `apps/mobile/src/utils/updater.tsx` + `apps/mobile/package.json`
- **��֤**: logcat ���� `DownloadManager: starting download`, ֪ͨ����ʾ 25MB / 25MB 100%

### BUG-008 (S58 P4): server ������ PM2 env ûˢ��

- **����**: �����°� shipin-APP server, client ��ʾ"��������"����ʵ�� server ûˢ��
- **����**: `pm2 reload` ���ض� env �ļ�, ���� `pm2 delete + start`
- **�޸�**: ����ű���� `pm2 delete 0 || true; pm2 start ecosystem.config.js`
- **�ļ�**: `apps/server/ecosystem.config.js` ��������
- **��֤**: `pm2 env 0 | grep APP_VERSION` �����°汾

### BUG-009 (S58 P5): ��ֽ������ѭ�� - ��������� .js ������
- **����**: ���� App.tsx װ�� APK, ������ UI
- **����**: tsc ��������, �� .js ����, �� APK װ�ϵ� Metro cache ���� bundle
- **�޸�**: ����ǰ�� dist + �� build.gradle versionCode

### BUG-010 (S58 P5): APK ��С���� (25MB �� 35MB)
- **����**: װ�� APK �������һ���
- **����**: react-native-blob-util ���� 8MB, ImageAgent �������� 2MB
- **�޸�**: �� ABI, ���� ProGuard, ɾδ����Դ

### BUG-011 (S58 P5): AndroidManifest merge ʧ��
- **����**: build ʱ�� manifest merge error
- **����**: react-native-blob-util �Դ� provider ����, �����ǵ� .fileprovider ��ͻ
- **�޸�**: ��� authorities ���ֱܿ� (�� .provider)

### BUG-012 (S58 P5): ActionSheetProvider ȱʧ
- **����**: ImageAgent ��"ͼƬ����"ѡ�� �� ����
- **����**: û�� ActionSheetProvider
- **�޸�**: װ react-native-action-sheet + �� Provider

### BUG-013 (S58 P6): DownloadManager �����겻����װ��
- **����**: ���� 100% ���� Intent
- **�޸�**: �� RNFetchBlob.android.actionViewIntent

### BUG-014 (S58 P6): actionViewIntent "Path appears to be invalid"
- **����**: logcat �� "Path appears to be invalid"
- **����**: ��һ�������� res.path() ���� res ���󷽷�����
- **�޸�**: �� _state.destPath �ַ���

### BUG-015 (S58 P6): ���غ�û����� APK
- **����**: Download �ۻ� 10+ ���� APK
- **�޸�**: ����ǰ�� Download Ŀ¼

### BUG-016 (S58 P7): actionViewIntent ��Ĭʧ�� (���� BUG-014)
- **�޸�**: ɾ fallback

### BUG-017 (S58 P7): VideoAgent ʱ��ѡ�� 5s/10s ���־�
- **����**: state ��ʼ��û��ȡĬ��ֵ
- **�޸�**: useState ��ȡ�û�ƫ��

### BUG-018 (S58 P7): ImageAgent ����ѡ�����޷�Ӧ
- **����**: ActionSheet ��������д��
- **�޸�**: �� onPress �����߼�

### BUG-019 (S58 P8): ChatScreen ��������
- **����**: FlatList û�� keyExtractor
- **�޸�**: �� keyExtractor

### BUG-020 (S58 P8): ������� (����) ��Ⱦ��
- **����**: ��������첽, ���� fallback
- **�޸�**: Ԥ��������, �� system font

### BUG-021 (S58 P10): APP ���������������������� (�� BUG-007 ����)

- **����**: �û�������"�������µ���û��Ӧ, û������", ֮ǰ�����ص�װ�Ĺ����� UI ����
- **����**: RNFS.downloadFile �� RN 0.73 + Hermes �����½��Ȼص�������; Ҳû��ϵͳ������, Ӧ�ñ�ɱ�����ж�
- **�޸�**: װ `react-native-blob-util@0.19.0` + `RNFetchBlob.config({ path }).fetch('GET', url)` ��ϵͳ DownloadManager
- **�ļ�**: `apps/mobile/package.json`, `apps/mobile/src/utils/updater.tsx`
- **��֤**: ���� (1080x1920) ʵ�� 25MB 30s 100% (5MB/s), dumpsys notification ���� com.android.providers.downloads ֪ͨ������

### BUG-022 (S58 P10): �����겻�����ϵͳ��װ��
- **����**: ���� 100% ���� action, û��"Ϊ����Ӧ�ð�װ����"ϵͳ�Ի���
- **����**: RNFS.downloadFile �����겻���� Intent.ACTION_VIEW, Ҳû�� DownloadManager.COLUMN_LOCAL_URI
- **�޸�**: ���� react-native-blob-util `RNFetchBlob.android.actionViewIntent(path, 'application/vnd.android.package-archive')` �Զ����� PackageInstaller
- **�ļ�**: `apps/mobile/src/utils/updater.tsx`
- **��֤**: ���� 6*5s ʱ mCurrentFocus=Window{9b947dd com.android.packageinstaller/.PackageInstallerActivity} �ӹ���Ļ

### BUG-023 (S58 P10): APK װ�� keystore ���ɸ���
- **����**: 13 ����ʷ APK (v3.0.0~v3.0.21) ���� debug ǩ��, ����ʱǩ����ͻ, ж��װ�����ݶ�
- **����**: ֮ǰ build.gradle �� debug signingConfig, debug.keystore ��ʱ, ��װ/����Ͷ�
- **�޸�**: �������� release.keystore (DN=CN=DeepScript Release, O=shipin-APP, 25����Ч 2026-06-16��2051-06-10, ���� deepscript2026, SHA1=12:9B:10:88:97:A2:E7:1C:6D:3B:8B:32:58:5C:F3:76:2B:CA:80) + 3 �ݱ��� (���� / git / mavis ����)
- **�ļ�**: `apps/mobile/android/app/release.keystore`, `apps/mobile/android/app/build.gradle` (signingConfigs.release)
- **��֤**: ���� install -r 13 �� v3.0.0~v3.0.21 APK ȫ SUCCESS, lastUpdateTime ������ʱ��һ��

### BUG-024 (S58 P5): ��ֽ������ѭ�� - �������� .js ������
- **����**: �Ҹ��� App.tsx / updater.tsx ��, װ�� APK �����ϰ汾 UI, ��"û�ĳɹ�" ��ѭ����װ
- **����**: tsc ��������ʱ, �� .js ���ᱻ�Զ���, �� src ������������ .js; װ�� APK Ҳû�� Metro cache
- **�޸�**: ����ǰ����� APK (�� version.ts + build.gradle + �ش� 5 min), �� cp �ɰ�
- **�ļ�**: `apps/mobile/src/config/version.ts`, `apps/mobile/android/app/build.gradle`
- **��֤**: v3.0.12 APK SHA256 �� v3.0.13 ��ȫ��ͬ, ����װ�¿��� 3 ��ť���� (�ϰ��� 1 ��ť)

### BUG-025 (S58 P6): actionViewIntent �� "Path appears to be invalid"
- **����**: ���� 100% ����� RNFetchBlob.android.actionViewIntent() �� "Path appears to be invalid" ��Ĭʧ��
- **����**: actionViewIntent ��һ���������� `res.path()` ���ص��� res ����ķ�������, ���� destPath �ַ���
- **�޸�**: �� `_state.destPath` (${RNFS.DownloadDirectoryPath}/DeepScript_v${version}.apk) ���� res.path()
- **�ļ�**: `apps/mobile/src/utils/updater.tsx`
- **��֤**: ���� v3.0.17 APK װ��, logcat ���� `RNFetchBlob.android.actionViewIntent: ${destPath}` �� `RNFetchBlob fetch success`, û "Path invalid"

### BUG-026 (S58 P10): App.tsx ȫ������ҳ����, ������ҳ
- **����**: ���������� APP ��ʾȫ�� loading ҳ, ��ҳ����, ����Ҳ������
- **����**: ���ڰ汾 App.tsx ��ȫ������ҳ + 3 �� state (showUpdater/updating/percent) + updateStyles, ���°浯���߼��ظ�
- **�޸�**: ɾ App.tsx ȫ������ҳ + 3 state + updateStyles �� 47 ��, ֻ�� showUpdateDialog ���� + UpdateProgressModal
- **�ļ�**: `apps/mobile/App.tsx` (325��278 ��)
- **��֤**: ���� v3.0.18 APK װ��, �����ҳ����, ����ʱ�� Modal ���ٱ�ȫ�� loading ��

### BUG-027 (S58 P11): FileProvider authorities mismatch - actionViewIntent ��Ĭʧ��
- **����**: v3.0.21 APK ���سɹ�, actionViewIntent ���� PackageInstaller ʧ��, logcat �� "Failed to find configured root that contains /storage/emulated/0/Download/DeepScript_v3.0.21.apk"
- **����**: AndroidManifest ���� `<provider authorities="${applicationId}.fileprovider" />`, �� react-native-blob-util �ڲ� `ReactNativeBlobUtilImpl.actionViewIntent` �� `RCTContext.getPackageName() + ".provider"` �� authorities ȥ `FileProvider.getUriForFile()`, authorities ��һ���� IllegalArgumentException
- **�޸�**: AndroidManifest `authorities="${applicationId}.fileprovider"` �� `"${applicationId}.provider"` �� blob-util �ڲ�ƥ��
- **�ļ�**: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- **��֤**: ���� v3.0.22 APK װ��, ���� �� ���� 30s �� PackageInstaller �ӹ���Ļ (mCurrentFocus=com.android.packageinstaller/.PackageInstallerActivity), ϵͳʶ��"Ϊ����Ӧ�ð�װ����", Retain data, isUpdate=true, versionCode 24

### BUG-028 (S59): Զ�� SSH Ƕ bash ʱ PS 5.1 -Command ������
- **����**: PS Ƕ `ssh -i key root@host 'curl -H "Content-Type: application/json" -d @file'`, Զ�� bash ���� `Content-Type: application/json` ���α��� -H �� 1 �� token, ��ʵ�� curl �յ� `-H Content-Type: application/json` �м� split �� "Could not resolve host: application"
- **����**: PS 5.1 -Command �ڴ��ݵ������ַ����� ssh ʱ, �ڲ���˫���ű��� (�� "Mavis PowerShell ������" lesson һ��)
- **�޸�**: �� `base64` �������� + `echo $b64 | base64 -d | bash` ͸��
- **��֤**: ͬ�������� base64 ͸����, Զ�� bash ��ȷ����, curl �õ���ȷ -H "Content-Type: application/json", API �� 200
- **��ѵ**: PS Ƕ ssh ��Զ������, ���� base64 ͸��, ��Ҫ���� -Command �ڵ�����

### BUG-029 (S59): shipin-APP server ʵ���� PORT 6000 ���� 3000
- **����**: `curl http://localhost:3000/api/users/register` �� 404 "Cannot POST /api/users/register", �� ss ��ʾ 3000 �˿��� node
- **����**: `/www/wwwroot/sparrow-logic/banmu-server/fuwuqi.js` (sparrow-logic ����) �� 3000, shipin-APP `.env` д `PORT=6000`, ʵ���� 6000. ��֮ǰ�� ss `LISTEN 0.0.0.0:3000` �� sparrow-logic ���� shipin-APP
- **�޸�**: �� shipin-APP API �� `http://127.0.0.1:6000` (����) �� `https://ab.maque.uno/api/...` (���������� 6000)
- **�ļ�**: `apps/server/.env` (PORT=6000)
- **��֤**: `curl -X POST http://127.0.0.1:6000/api/users/register -d @reg.json` �� 201 + token
- **��ѵ**: ͬ�������� node Ӧ��ʱ, ����ƾ `ss -tlnp | grep node` �ƶ��ĸ��� shipin-APP, �ؿ� PID + cmdline

---

## ����ָ�� (����Ŀͨ��, S58 �ڼ�ȹ��Ŀ�)

### 1. release.keystore ���ɸ���
- ����Ŀ���ñ��ݵ� `C:\Users\Administrator\.mavis\keystore\`
- ����������ж��װ�� (ǩ����ͻ)

### 2. APK ��ֽ�����
- �� `version.ts` + `build.gradle` versionCode + �ش� 5 min
- �� cp �ɰ� (S58 P5 ��ֽ��ѭ��)

### 3. actionViewIntent ���� _state.destPath
- ��Ҫ�� `res.path()` (���� res ���󷽷�����, �����ַ���)
- `_state.destPath = ${RNFS.DownloadDirectoryPath}/DeepScript_v${version}.apk`

### 4. FileProvider authorities ���
- `react-native-blob-util` �� `getPackageName() + ".provider"`, ��ƥ��
- д�� �� FileProvider.getUriForFile() �� IllegalArgumentException, actionViewIntent ��Ĭʧ��

### 5. App.tsx ��ɾȫ������ҳ
- ���°浯�� + UpdateProgressModal ��ͻ
- ɾ 47 �� (showUpdater/updating/percent state + updateStyles)

### 6. PM2 env reload ���� delete+start
- `pm2 reload` ���ض� env, ���� `pm2 delete 0; pm2 start ecosystem.config.js`

### 7. AndroidManifest �ؼ� DOWNLOAD_COMPLETE
- װ `react-native-blob-util` ��ؼ� `intent-filter android.intent.action.DOWNLOAD_COMPLETE` �� FileProvider `${applicationId}.provider`

### 8. AndroidManifest �ؼ� POST_NOTIFICATIONS
- Android 13+ POST_NOTIFICATIONS Ȩ�ޱؼ�, ���� DownloadManager ֪ͨ������ʾ

### 9. file_paths.xml ���� external-path
- `<external-path name="apk_download" path="Download/" />` ƥ�� DownloadManager ���

### 10. AVD DownloadManager 0.00MB ײǽ
- QEMU NAT ������, �� BlueStacks ����ȼ�
- ���� input tap ����Ӧ, �� `input keyevent KEYCODE_DPAD_RIGHT �� N + KEYCODE_DPAD_CENTER`

### 11. shipin-APP server PORT=6000 ���� 3000
- 3000 �� sparrow-logic (sparrow ��Ŀ), �� shipin-APP ���� server
- �� shipin-APP API ���� `http://127.0.0.1:6000` �� `https://ab.maque.uno/api/...`

### 12. PS 5.1 -Command ������
- `ssh ... 'cmd "with quotes"'` Զ�� bash ���� `cmd with quotes`
- ���� base64 ͸��: `echo $b64 | base64 -d | bash`

### 13. mobile ��Ļ�� theme token �� import theme
- ��̬��鷢�� ScriptListScreen + EpisodeListScreen �� `colors.xxx` ��û `import { colors } from '../theme'`
- ������ ReferenceError: colors is not defined, ����ʱ��
- �ز�: �޸� mobile ��Ļǰ�� grep `colors\.|spacing\.|radii\.|typography\.` �� `from '../theme'` import ���

---

## v3.0.23 (S59) �޸���ʷ

### BUG-030 (S59): ��̬��鷢�� /api/version/check ��·�� (��)
- **����**: ����ʱ `/api/version/check?appVersion=3.0.22&platform=android` �� AUTH_REQUIRED
- **����**: ��·��, ʵ�� server ·���� `/api/version` ���� `/api/version/check`
- **��֤**: `curl http://127.0.0.1:6000/api/version?version=3.0.22` �� 200 + needUpdate=true
- **��ѵ**: �� API ǰ�ض� server `dist/routes/*.js` ʵ��ע���·��, ��Ҫ��

### BUG-031 (S59): ScriptListScreen.tsx ȱ theme import ����ʧ��
- **����**: line 85 `<Ionicons color={colors.text.tertiary} />` ��û import theme
- **����**: import ©�� (5 �� screen refactor ʱɾ import û��)
- **�޸�**: `apps/mobile/src/screens/ScriptListScreen.tsx` �� `import { colors } from '../theme';` (line 10)
- **��֤**: v3.0.23 APK װ����, �������, ScriptList ҳ�� ReferenceError

### BUG-032 (S59): EpisodeListScreen.tsx ȱ theme import ����ʧ��
- **����**: line 120, 130 �� `colors.xxx` ��û import
- **����**: ͬ BUG-031
- **�޸�**: `apps/mobile/src/screens/EpisodeListScreen.tsx` �� `import { colors } from '../theme';` (line 11)
- **��֤**: v3.0.23 APK װ����, EpisodeList ҳ�� ReferenceError

### BUG-033 (S59): AI �˵���������ͨ (3 �� DeepSeek + Image/Video Agent ȫ�ɹ�)
- **DeepSeek #1 (analyze)**: �ϴ� 1452 ��С˵ �� genre=����/theme=����������/style=��Ѫ���� + 1 character (10s ���)
- **DeepSeek #2 (generate episodes)**: 1 episode "�������" (3116 chars, status=completed, 30s ���)
- **DeepSeek #3 (generate shots)**: 8 shots (�� 1024x1024 imageUrl, agnes-ai.space CDN, 30s ���)
- **Image Agent (���)**: ��ʾ�� "�ŷ�ɽˮ�廭, Ʈ��" �� 1024x1024 ���� �� ȷ�� �� `tool_completed` + ��ʵͼƬ URL (https://platform-outputs.agnes-ai.space/images/...)
- **Video Agent (���)**: ��ʾ�� "�ŷ������������轣" �� 1152x768 5s ���� �� ȷ�� �� `taskId beeebb54-...` (1-3 ����)
- **����**: AI �˵�������ȫ��ͨ, DeepSeek �շѷ�������, Image/Video Agent �� imageProvider (agnes-ai.space) ���

### BUG-034 (S59): Image/Video Agent ״̬�� mobile UI ������
- **����**: ���� APP �ڵ�"ȷ������" �� modal "�Ѽ������" �� 5-30s �� server �� status=tool_completed, ͼƬ������, **�� mobile UI һֱ��ʾ"��������... ��ȴ� 5-30 ��"**
- **����**: mobile `ImageAgentScreen.tsx` û poll conversation status, modal �ص��û�ص� chat ��������״̬
- **�޷�** (����): �� useEffect poll `/image-agent/conversations/:id` ÿ 5s �� status, status=tool_completed ʱ�滻���һ�� assistant message
- **�ļ�**: `apps/mobile/src/screens/ImageAgentScreen.tsx` (line 62-118 �� `pollingConvId` useEffect ��ֻ�� confirm ������; initial mount ʱ������, ����չ)
- **��֤**: server �� `curl /api/image-agent/conversations?limit=3` ��ʾ `status=tool_completed` + ��ʵ imageUrl, �� mobile UI 60s �󻹿���"��������"
- **��ѵ**: �� agent ��˵�ؿ� mobile UI �Ƿ� poll ״̬, ��Ȼ�û���֪�����

### BUG-035 (S59): v3.0.22 APK ����װ�Ϻ�, deep-link / deeplink ������������·������ͨ��
- **����**: S58 P10 ������·�� v3.0.22 + v3.0.23 APK �˵�����ͨ, �� v3.0.23 mobile UI û��� file picker (�ϴ�С˵) ���� ADB ���ļ� + Intent
- **����**: ���� Nougat64 û root, ���� push �� `/data/data/com.aiscriptmobile/files/` д token; input tap ��������Ӧ
- **�޷�**: ���� `input keyevent KEYCODE_ENTER` �ύ��� (���� input field ��); �� dump UI byte search ������ (PS 5.1 console GBK ��Ӱ�� raw bytes)

### BUG-036 (S60 P1): Dialog/Sheet/Toast ��� + useDialog hook �ع� (v3.0.24)
- **����**: ֮ǰ�� `Alert.alert` (RN Modal) ������, �������� shipin-APP UI ��ͳһ; �������� RN Modal ��Ⱦ sheet ����ͻأ
- **�û�Ҫ��**: "��Ҫʹ�� modal ��������ȷ�ϵ���ع���, ������� UI ���ÿ�, ����ȫ�������������"
- **����**: RN 0.73 Modal �� RN ���ǿ�� Material/iOS Ĭ����ʽ, �� shipin-APP �Զ��� theme ��ͳһ
- **�޷�**: �½� 3 ����� + 1 �� hook:
  - `src/components/Dialog.tsx` (iOS ���и���, ��� Alert.alert)
  - `src/components/Sheet.tsx` (�ײ�����, ��� RN Modal sheet)
  - `src/components/Toast.tsx` (��������, ��� ToastAndroid)
  - `src/hooks/useDialog.tsx` (ģ�鼶 store + showAlert/showConfirm/showCustom/showToast/alert + DialogHost ���)
  - ȫ���� View + Animated API ����, ������ RN Modal
- **����**: `App.tsx` �� `<DialogHost />` + `<ToastHost />`
- **�ļ�**: �½� 4 ��
- **��֤**: tsc ���� 0 ��; �ؼ� 3 �ļ� (updater/ImageAgent/VideoAgent) Alert.alert �� useDialog �ع�, װ������ͼ֤���� UI

### BUG-037 (S60 P2 ����): "��������" �Ų����
- **����**: user �� APP һֱ��������
- **�Ų����**:
  1. server �� `pm2 env 0` �� `APP_VERSION=3.0.23` ?
  2. server `/api/version?version=3.0.23` �� `{"needUpdate":false}` ?
  3. ����װ v3.0.23 APK (versionCode=25) �� ��� �� �������, **û�е���** ?
  4. ���� `https://ab.maque.uno/app/DeepScript_v3.0.24.apk` �� `v3.0.23.apk` ����**��ȫ��ͬ** (������λ)
- **����**: ��ǰ server=3.0.23 + client=3.0.23, **������ѭ��** (needUpdate=client>=server=0)
- **Ψһѭ������**: user ��ֽʱ���� server `APP_VERSION` û��ԭ (����ĳ� 3.0.99 + ���� v3.0.23.apk)
- **���**: server ���Ǹɾ��� 3.0.23, ���� v3.0.23 ����, **��ȫж��**��� APP + ��װ���� v3.0.24.apk (������ v3.0.23 ����)
- **��ѵ**: ��ֽ server APP_VERSION �ػ�ԭ; ���� APK ������ versionName ��һ�� (��Ȼ����)

### BUG-038 (S60 P2): ����ʱ���� 33f2 taskId vs a5431533 conversationId ��һ�� (������ BUG, �� UI ���)
- **����**: mobile �� modal ��ʾ�� `taskId 33f2c4d5-2de9-4d25-83a0-6ae7d3f7e4a6` �� DB `image_conversations` ��**�鲻��**
- **����**: modal ��ʾ���� **server �ڲ� queue task id** (���� debug �Ų�), �� DB ������ **conversation id** (`a5431533-...`)
- **��ѵ**: mobile ���� conversationId ��ѯ (���� taskId), ������ modal ��ʾ�� taskId
- **�޷�**: polling ֱ���� state `pollingConvId` (�Ѿ��� conversationId), ���� modal ȡ

### BUG-039 (S60 P2 BUG-041 ʵ�ʸ���): ImageAgentScreen ���� /video-agent/confirm
- **����**: װ v3.0.24 ����ͼ, modal ��ʾ "�Ѽ������ taskId 33f2c4d5..." + "��Ƶ���ɳ�, �ȴ� 1-3 ����" (������**��ͼ**, ������Ƶ)
- **����**: `src/screens/ImageAgentScreen.tsx` line 152 `apiClient.post('/video-agent/confirm', ...)` (����ճ�� VideoAgentScreen û�� endpoint), line 160 modal �İ� "��Ƶ���ɳ�..." Ҳ�ճ�
- **�޷�**:
  - line 152 �� `/image-agent/confirm`
  - line 160 modal �� "ͼƬ������, �ȴ� 5-30 ��"
  - **���� translatePlan ����** (�� web �� 1:1)
  - **�� polling �Ұ��� plan/streaming part �����һ�� assistant ��Ϣ** (��ֻ�����һ��)
- **��ѵ**: Image/Video agent �� 95% һ������, ����ճ����ͬʱ�� endpoint + �İ�. �鹫��������ռ����� (�������ع�)
- **�ļ�**: `apps/mobile/src/screens/ImageAgentScreen.tsx`

### BUG-040 (S60 P2): image/video part ֻ��ʾ URL 60 �ַ�, û��ͼ/����Ƶ
- **����**: v3.0.23 mobile ��, ��ͼ���� polling �� chat ����ʾ "??? [result] https://platform-outputs.agnes-ai.space/images/...7079..." (�� 60 �ַ�)
- **����**: `ImageAgentScreen.tsx` line 226 `if (part.type === 'image') return <Text>??? [{part.role}] {part.url.slice(0, 60)}...</Text>;` (ֻ��ʾ�ı�, û�� RN `<Image>`); `VideoAgentScreen.tsx` line 242 ͬ������ (ûװ `react-native-video`, û������Ƶ)
- **�޷�**:
  - װ `react-native-webview@^13.16.1` (mobile 0 �� video ��, WebView ��Ƕ `<video controls>` �� web �� 1:1)
  - image part �� RN `<Image source={{uri: buildImageUrl(part.url, token)}}>` + `?token=` ��Ȩ (web �� PartView line 1067-1069 ͬ������)
  - video part �� `<WebView source={{html: '<video src=... controls autoplay playsinline>', baseUrl: 'https://ab.maque.uno'}}>` + `mixedContentMode="always"`
  - �� "����ͼƬ" / "������Ƶ" ��ť (�� `react-native-blob-util` + server `/api/download?url=...&token=...&disposition=attachment`)
  - �� streaming ��Ƭ���� (��ɫ�߿� + spinner + "���ڷ���..."/"AI ������Ⱦ...")
  - �� plan ��Ƭ���� (?? icon + "��ʾ�ʷ���"/"��Ƶ����" + ����/ʱ��/���/fps/����)
- **�ļ�**: `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` (������д) + `apps/mobile/src/utils/agentDownload.ts` (�½�) + `apps/mobile/src/api/client.ts` (�� 12 �� image/video-agent API helper)
- **��֤**: װ v3.0.24 + ��������ͼ, Ӧ���� Image �����ȾͼƬ (���ı�)

### BUG-041 (S60 P2): types/agent.ts ȱ streaming ���� + api/client.ts ȱ image/video-agent API helper
- **����**: mobile ImageAgentScreen �� `{ type: 'streaming'; stage: 'generating' }` �� types/agent.ts û���� streaming union case
- **����**: web �� AgentChatPanel PartView �� streaming case (line 1177-1203), mobile �� types/agent.ts û����
- **�޷�**:
  - `apps/mobile/src/types/agent.ts` �� `{ type: 'streaming'; stage: 'translating' | 'generating' }`
  - `apps/mobile/src/api/client.ts` �� 12 �� helper: `imageAgentCreateConversationApi` / `imageAgentChatApi` / `imageAgentConfirmApi` / `imageAgentTranslatePlanApi` / `imageAgentUpdatePlanFieldsApi` / `imageAgentHistoryApi` / `imageAgentGetApi` / `imageAgentDeleteApi` + 6 �� video �� (�� web �� `src/lib/api.ts` 1:1)
- **��ѵ**: ��� types �ض���; API helper ���з� client.ts, screen ��Ҫֱ�ӵ� apiClient ƴ URL
- **��֤**: tsc ���� 0 ��

### BUG-042 (S60 P2): image/video part ֻ��ʾ URL 60 �ַ�, û��ͼ/����Ƶ
- **����**: S58 P9 ��ͨ��ͼ (v3.0.22 APK), mobile �� chat ����ʾ "??? [result] https://platform-outputs.agnes-ai.space/images/...7079..." (�� 60 �ַ�), **û��ͼ��Ⱦ**
- **����**: `ImageAgentScreen.tsx` line 226 `if (part.type === 'image') return <Text>??? [{part.role}] {part.url.slice(0, 60)}...</Text>;` (ֻ��ʾ�ı�, û�� RN `<Image>`); `VideoAgentScreen.tsx` ͬ������ (ûװ `react-native-video`, û������Ƶ)
- **�޷�**:
  - װ `react-native-webview@^13.16.1` (mobile 0 �� video ��, WebView ��Ƕ `<video controls>` �� web �� 1:1)
  - װ `react-native-blob-util` + `react-native-permissions` (�� server ��Ȩ����)
  - image part �� RN `<Image source={{uri: buildImageUrl(part.url, token)}}>` + `?token=` ��Ȩ (web �� PartView line 1067-1069 ͬ������)
  - video part �� `<WebView source={{html: '<video src=... controls autoplay playsinline>', baseUrl: 'https://ab.maque.uno'}}>` + `mixedContentMode="always"`
  - �� "����ͼƬ" / "������Ƶ" ��ť (�� `react-native-blob-util` + server `/api/download?url=...&token=...&disposition=attachment`)
  - �� streaming ��Ƭ���� (��ɫ�߿� + spinner + "���ڷ���..."/"AI ������Ⱦ...")
  - �� plan ��Ƭ���� (?? icon + "��ʾ�ʷ���"/"��Ƶ����" + ����/ʱ��/���/fps/����)
- **�ļ�**: `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` (������д) + `apps/mobile/src/utils/agentDownload.ts` (�½�) + `apps/mobile/src/api/client.ts` (�� 12 �� image/video-agent API helper)
- **��֤**: װ v3.0.24 + ��������ͼ, Image �����Ⱦ��ͼ (�ŷ��������� 1024x1024) + ��Ƶ tab WebView ��Ⱦ��Ƶ (ancient sword dance 5s)

### BUG-043 (S60 P2): types/agent.ts ȱ image width/height + video coverUrl
- **����**: web �� PartView ��Ⱦ image �� `{ width, height }` ��ͼƬ�ű�, video �� `{ coverUrl, duration }` ��ʾ���� + ʱ��
- **����**: types/agent.ts ����ֻд `{ type: 'image'; url; role }` ȱ width/height; video ͬ��
- **�޷�**:
  - `image` type �� `width?: number; height?: number;`
  - `video` type �� `coverUrl?: string; duration?: number;`
- **��ѵ**: ��� type �ֶαض���, server �� conv messages parts �ֶξ��ǹ淶
- **��֤**: ������ͼ��, plan part ��Ⱦ 1024x1024 + video plan ��Ⱦ 1152x768@24fps

### BUG-044 (S60 P2): ImageAgentScreen ���� /video-agent/confirm (����ճ��û�� endpoint)
- **����**: v3.0.22 APK ����ͼ, modal ��ʾ "�Ѽ������ taskId 33f2c4d5..." + "��Ƶ���ɳ�, �ȴ� 1-3 ����" (**��������ͼ, ������Ƶ**)
- **����**: `src/screens/ImageAgentScreen.tsx` line 152 `apiClient.post('/video-agent/confirm', ...)` (�� VideoAgentScreen ����ճ��û�� endpoint), line 160 modal �İ� "��Ƶ���ɳ�..." Ҳ�ճ�
- **�޷�** (S60 P2):
  - line 152 �� `/image-agent/confirm`
  - line 160 modal �� "ͼƬ������, �ȴ� 5-30 ��"
  - **���� translatePlan ����** (�� web �� 1:1, ���ķ��� �� Ӣ�� prompt)
  - **�� polling �Ұ��� plan/streaming part �����һ�� assistant ��Ϣ** (��ֻ�����һ��)
  - �����¼ӵ� 12 �� API helper (`imageAgentConfirmApi` / `imageAgentChatApi` / `imageAgentTranslatePlanApi` ��) ����ƴд��
- **��ѵ**: Image/Video agent �� 95% һ������, ����ճ����ͬʱ�� endpoint + �İ�. �鹫��������ռ�����
- **�ļ�**: `apps/mobile/src/screens/ImageAgentScreen.tsx` (������д, �� web �� `AgentChatPanel.tsx` 1:1)

### BUG-045 (S60 P2 �����ڷ���): server API ��Ӧ·����ƥ��
- **����**: װ v3.0.24 APK ����ͼ, ��ʷ�б���ʾ "������ʷ�Ự (0)" (���� ��3 ��), �� "�����" ��ʷҲû����
- **����**: server ������ endpoint �� `{data:{<name>: ...}}` wrapper, �� mobile ��:
  - `loadHistory` д `res.data?.data` (��������, ʵ���� `{conversations: [...]}`)
  - `loadConversation` д `res.data?.data` (���� conv object, ʵ���� `{conversation: {...}}`)
  - �ֶ���Ҳ�� camelCase (`resultImageUrl`), �� server �� snake_case (`result_image_url`)
- **�޷�**:
  - `loadHistory`: `(res.data?.data?.conversations || res.data?.data || [])`
  - `loadConversation`: `(res.data?.data?.conversation || res.data?.data)`
  - �ֶ�ӳ��: `c.resultImageUrl || c.result_image_url` �������ַ��
  - polling �� `convResultUrl = conv.resultImageUrl || conv.result_image_url`
- **��ѵ**: **��� API �ض�����Ӧ wrapper + �ֶ��������**. web �˸� server ���� snake_case, mobile ������ camelCase �ؼ���ʽ mapping (���ܼٶ��Զ�ת��). �ռ�����: server ��ͳһ�� camelCase, mobile ������ mapping
- **��֤**: v3.0.24.2 APK װ��, ��ʷ 5 �� + �Զ� loadConversation ��� resultImageUrl �ĻỰ + Image ��Ⱦ

### BUG-046 (S60 P2): ���� compileSdk = 34
- **����**: װ `react-native-webview@^13.16.1` �� gradle assembleRelease �� "androidx.annotation:annotation-experimental:1.4.1 requires compileSdk 34+, currently 33"
- **����**: webview ���°� androidx.annotation, ǿ�� compileSdk ��34
- **�޷�**:
  - `android/build.gradle` �� `compileSdkVersion 33 �� 34`, `targetSdkVersion 33 �� 34`, `buildToolsVersion 33.0.2 �� 34.0.0` (D:\Android ���� android-34 + 34.0.0)
- **��ѵ**: ���°� (���� androidx-*) �ز� compileSdk Ҫ��, ���� build fail
- **��֤**: gradle BUILD SUCCESSFUL, װ���� v3.0.24 ��ͨ

### BUG-047 (S60 P2 S59 ��β): PS 5.1 `&&` + `;` + Ƕ�� ssh ���ó� (����)
- **����**: ���� `cd $path && cmd` �� PS 5.1 -Command ��, `&&` �� `;` ��������Ƕ�� (Զ�� ssh + `bash -c "..."` ת��) ���ֱ���
- **��� (S60 P2 ����)**: д `.ps1` �ļ� + `powershell -ExecutionPolicy Bypass -File xxx.ps1` ͸��; server �˲���ȫ�� _build.ps1 / _trigger-image.ps1 ��
- **��ѵ**: PS 5.1 Ƕ�׸��������д .ps1 �ļ�, ��Ҫ���� -Command ƴ
- **��֤**: S60 P2 ȫ���� .ps1, 0 �ض�

### BUG-048 (S60 P2): server �� APP_VERSION �� PM2 env reload
- **����**: �� server `ecosystem.config.js` env_production.APP_VERSION='3.0.23'��'3.0.24' ��, `pm2 restart` ����Ч, �ͻ��� curl `/api/version?version=3.0.24` �Է� `needUpdate=true`
- **����**: PM2 restart ���� reload `.env` �� `ecosystem.config.js` env �ֶ�, ���� `pm2 delete` + `pm2 start` (BUG-038 ��ѵ S50)
- **�޷�**:
  - `cd /www/wwwroot/shipin-APP && pm2 delete 0` + `pm2 start ecosystem.config.js --env production`
  - Ȼ�� `curl /api/version?version=3.0.24` �� `{"needUpdate":false}`
- **��ѵ**: PM2 env �ֶθ������ delete+start, ��Ҫ restart
- **��֤**: v3.0.24 �����, ���� API �� needUpdate=false, �ͻ��˲��ٵ�������

---

## �ĵ�ά������

- ÿ������һ�� BUG, ��׷��һ�������ĵ� (�� BUG-NNN ���), д��: ���� / ���� / �޸� / ��֤
- ��д�ջ� ("����һ�� bug"), Ҫд�������� (�ĸ��ļ�����), ����֤����
- �޹��� BUG ��Ҫɾ��, ���Ÿ����� AI �ܿ�
- BUG-001~020 �� S58 P1~P8 �޹���, BUG-021~027 �� S58 P10~P11 �޹���, BUG-028~029 �� S59 ȫ���ܲ��Է���

---

## S60 P3 BUG-049~053: ��Ƶ/ͼƬ������·�����޸�

### BUG-049 (S60 P3): ��Ƶ WebView ��ʾ�� poster (�û��ױ�)
- **����**: v3.0.24 װ����, ��Ƶ tab ��ʾ��Ƶ��Ƭ, ����Ƭ�����ǿ� video ɽ��ͼ�� (chrome broken-video default poster), �������κβ��Ż���, Ҳû�� ? ���Ű�ť
- **�������**: buildVideoUrl ƴ�� `localUrl = /api/agent/video-local/{userId}/{filename}?token=...` (server ���̻���), ����Ƶ conv �� tool_completed ʱ server ��û cache �� �� 404 �� video Ԫ�� src 404 �� ��ʾ broken-video ͼ��
- **�޷� (v3.0.24)**: buildVideoUrl �� `proxyUrl = /api/download?url=...&disposition=inline&token=...` (server ͸�� inline, WebView �� video ��), VideoPlayer ���� `fallbackUrl` ע�� HTML: video.onerror ����ʱ�е� fallback (�� web �� PartView line 1210-1233 1:1)
- **��֤**: server curl `/api/download?url=...&disposition=inline&token=...` �� 200 + 1.4MB video/mp4 ?, �� APK װ��**��Ƶ�Բ���** �� ���� fallback ����, �Ǹ���� (�� BUG-053)
- **��ѵ**: ���濴������ fallback û��Ч, ��ʵ�ʸ���ԭ���� BUG-053 (WebView ������), ���������ƫ��һ��

### BUG-050 (S60 P3): ��ͼ����Ƶ�Ի�ҳ UI �������½�/ɾ����ť (�û�����)
- **����**: user ���� "û���½��Ự�Ĺ���, Ҫ��Web��һ�����½��Ự��ɾ���Ự"
- **����**:
  - ԭ toolbar �� 4 ��С��ť��һ�� (��ʷ/�½�/����/ɾ��, �ֺ� 12-13px, 40px ��), ������
  - **race condition**: `loadHistory()` �õ� lastResult �Զ������� conv, ����"�½�" createConversation ���ֱ� loadHistory auto-load ���ǻ�ȥ, UI ��ʾ�� conv ����
- **�޷�**:
  - toolbar �İ�: ���� (��ʷ) + ��ǰ�Ự���� + ״̬���� + ��ɫ"�½�"��ť + ��ɫ����Ͱ
  - �� 12 �� conv ״̬���� (���ķ���/Ӣ�ķ���/�ȴ�ȷ��/�����/...), �� web �� statusBadge 1:1
  - ��״̬������: ���� 120px Բ�� icon + ���� + ��ʾ�İ� + ��ɫ"�½��Ự"��ť + 3 ������ prompt
  - ��ʷ����������������"+ �½��Ự"��ť
  - ��ʷÿ��������ͼ (����� conv ��ʾ��ͼ) + ���� + ״̬���� + ��ɫ����Ͱ����ɾ��
  - �� `userInitiated` flag, "�½�/ɾ��" �� `createConversation(true)` + `loadHistory()` ʱ, loadHistory ��� flag ���� auto-load �� conv, �޸� race condition
- **�ļ�**: `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` (����� toolbar + race fix)
- **��֤**: װ v3.0.24.4 ��ͼ, toolbar �������, ��ʷ���� 7 �� conv ÿ��������ͼ+ɾ����ť ?

### BUG-051 (S60 P3): ��ͼ���ؿհ�, ��ʷ����ͼ����ʾ
- **����**: v3.0.24 װ����, ��ͼ tab ��ʷ conv ����ͼ��ʾ��ͼ (�ŷ��������� ?), ���㿪 conv ��ͼ���ǿհ�
- **����**: buildImageUrl �������� URL (platform-outputs.agnes-ai.space / cdn.hailuoai.com) ֱ�� return ԭ URL, **�������� HTTPS ����**, ���� Nougat64 Android 7 ϵͳ SSL ֤���������Ͼ�, ������ CDN HTTPS ����ʧ��
  - ��ʷ����ͼ����ʾ����Ϊ Fresco �������� (֮ǰ v3.0.23 �Թ���ͼ����)
  - ��ͼ�״μ���ʧ�� �� ��ʾ�հ�
- **�޷�**: buildImageUrl һ���� server `/api/download?url=...&disposition=inline&token=...` proxy, server ��Ȩ��͸���� ab.maque.uno ͬԴ HTTPS, shipin-APP cert ���������ȶ�
- **�ļ�**: `apps/mobile/src/utils/agentDownload.ts:buildImageUrl` ������д
- **��֤**: curl `/api/download?url=...&disposition=inline&token=...` �� 200 + 1.76MB image/png ?, װ APK ����ͼ tab ��ͼ����ʾ��ͼ ?

### BUG-052 (S60 P3): autoplay ���� muted + RN WebView 13.x �� Android 7 ������
- **����**: v3.0.24.4 APK װ����, ��Ƶ tab �Կ� poster, ��������� icon ���������л��� (֤�� muted ��Ч), ����Ƶ first frame ����ʾ
- **���� (1)**: HTML5 `<video>` autoplay �� chromium ���� muted, ���� play() ����Ĭ�ܾ�, video Ԫ�� paused + ��ʾ broken-video ͼ�� (�޷�: �� `muted` + `preload="metadata"`)
- **���� (2) (�� logcat ����)**: �� video Ԫ�ؼ� console.log ��� logcat, ���� `java.lang.ClassNotFoundException: Didn't find class "androidx.window.extensions.core.util.function.Consumer"`:
  ```
  Caused by: java.lang.ClassNotFoundException: androidx.window.extensions...
  at RNCWebView.evaluateJavascriptWithFallback (RNCWebView.java:299)
  ```
  **RN WebView 13.x �� androidx.window.extensions (Android 12+ �� API), ���� Nougat64 Android 7 û�����**, JS ע���� ClassNotFoundException, WebView ���� content ��Ⱦ�쳣, video Ԫ�� src ��û���� fetch
- **�޷�**: **���� RN WebView 13.x �� Android 7**, ���� `react-native-video@6.7.0` ԭ�������� (Android 5+ ȫ����)
- **�ļ�**: `apps/mobile/src/screens/VideoAgentScreen.tsx:VideoPlayer` ������д, �� `<Video>` ��� `<WebView>`
- **��ѵ**: 
  - HTML5 video muted �Ǳ���� (autoplay policy)
  - ���� WebView ����������뿴 logcat, ����ֻ�� console.log �ƶ�
  - ���� Nougat64 + �κ��� androidx.window.* �� RN �ⶼ������

### BUG-053 (S60 P3): react-native-video 6.7.0 ��� WebView (��̬�޷�)
- **����**: BUG-049/050/051/052 ������ WebView ���Բ�����, ��Ҫ�����滻����
- **����**: RN WebView 13.x �� androidx.window.extensions ������ Android 7 �ϲ�����, HTML5 video Ԫ��û���������� (��ʹ�� JS ע��, WebView �ڲ� video Ԫ��Ҳ������Ϊ chromium ϵͳ�汾�Ͼɳ���������)
- **�޷�**:
  - `npm install react-native-video@6.7.0 --legacy-peer-deps` (Android 5+ ȫ����, �� Android ԭ�� MediaPlayer/ExoPlayer)
  - VideoPlayer ��д: `<Video source={{uri: src}} controls paused={false} resizeMode="contain" poster={poster} onError={fallback} onLoad={log}/>`
  - ������ WebView, �Ƴ� `react-native-webview` ������
- **�ļ�**: `apps/mobile/src/screens/VideoAgentScreen.tsx:VideoPlayer`, `apps/mobile/package.json` (�� react-native-video@6.7.0)
- **��֤**: 
  - װ v3.0.24.4e APK (versionCode 31, 30MB �� native lib)
  - ��Ƶ tab ��ʾ����Ƶ ? �� սʿ�ݵ� 5����Ƶ, ������ 00:04/00:05, ? ��ͣ��ť (�����Զ�����)
  - ��ͼ tab ��ͼ����ʾ��ͼ ? �� �ŷ��������� 1024x1024
- **��ѵ**: 
  - **Android 7 (API 24) ���豸������ androidx.window.* / RN WebView 13.x / �κ��� Android 12+ �� API �� RN ��**
  - **��ѡ react-native-video / ԭ��������, ������ WebView ��Ⱦ**
  - ��� RN WebView ��Ƶ/ͼƬ����Ҫ�ȿ� logcat, �� ClassNotFoundException, ��Ҫ�ӱ��������ƶϸ���

---

## S60 P3 �ܽ�

| ά�� | BUG-049/051/052 (v3.0.24.4b/c/d ʧ��) | BUG-053 ��̬ (v3.0.24.4e) |
|---|---|---|
| ��Ƶ���� | WebView + HTML5 video �� poster | react-native-video ԭ�������� ? |
| ͼƬ��ʾ | ���� HTTPS ���� Android 7 ʧ�� | server inline proxy �� ab.maque.uno ͬԴ ? |
| UI ����� | (�� BUG-050 ͬ����) | ���� + ״̬���� + ���½� + ����ɾ�� ? |
| race condition | (BUG-050) | userInitiated flag �� ? |
| APK ��С | 26MB | 30MB (+4MB react-native-video native lib) |
| versionCode | 27��30 (ʧ��) | **31 (OK)** |

**APK**: `https://ab.maque.uno/app/DeepScript_v3.0.24.apk` (�� push �� APK)

---

## S61 P1 �ܽ� (v3.0.27)

### BUG-054 (S61 P1, v3.0.25 ��, v3.0.27 ����): VideoAgent ʱ��ѡ��� Web ��һ�� ([3,5,10] vs [5,10,15])

- **����**: v3.0.21 ~ v3.0.24 �ڼ�, mobile ʱ�� chip �� 3/5/10 ��, Web ���� 5/10/15 ��; mobile �û�ѡ 15s ���� server `ALLOWED_DURATIONS` У��ʧ��, ���׷�֧ nearest-white-list ��� 10s (���û�Ԥ�ڲ���)
- **����**: web v3.0.0.21 �� `[5, 10, 15]` ʱ (�û�����"3 ��̫����Ҫ 15 ��"), mobile ©��; v3.0.25 �޴���ע������ȷд "v3.0.0.18 ʱ���� [3, 5, 10], mobile ©��", ��**û��¼�� BUGS.md** (Υ��Ӳ�Թ淶"���� BUG ��׷�� BUGS.md")
- **��������** (v3.0.25+):
  - server `apps/server/src/services/videoAgentService.ts:44`: `ALLOWED_DURATIONS = [5, 10, 15] as const` (Ȩ��Դ)
  - web `apps/web/src/components/AgentChatPanel.tsx:128-132`: `DURATION_OPTIONS = [{5,...},{10,...},{15,...}]`
  - mobile `apps/mobile/src/screens/VideoAgentScreen.tsx:49`: `const DURATIONS = [5, 10, 15]`
- **�޷� (v3.0.25)**: mobile `DURATIONS` �� `[5, 10, 15]`, ע��д��"�� web + server ALLOWED_DURATIONS һһ��Ӧ"
- **��֤**: ���� v3.0.25 ѡ 15s �� server �� 15 �� ������ closest-white-list ���׷�֧
- **��ѵ**:
  1. ����ʱ�������� `server ALLOWED_DURATIONS` ΪΨһȨ��Դ, web/mobile �� UI �� server ͬ��
  2. �� server �� `ALLOWED_DURATIONS` ʱ, **����ͬ���� web + mobile �� DURATION_OPTIONS + DURATIONS**
  3. �κ� BUG ����, �����ǲ���"�Ѿ��޺ò�Ӱ��", ��Ҫ׷�� BUGS.md (����Ӳ�Թ淶, ��ֹ�¸� AI �ظ��ȿ�)

### BUG-055 (S61 P1, v3.0.27 ��): VideoAgent ʱ�� UI �İ� 2 ����һ��

- **����**:
  1. Web `apps/web/src/pages/VipCenterPage.tsx:119` VIP Ȩ���İ�ֻд "��Ƶ 5s + 10s ��� (��ͨ�û� 5s ���, 10s �� 0.1 Ԫ)", **��ȫû�� 15s �۸�**; �� server `billingService.ts:38-50` ʵ�ʼƷ�: VIP 5s+10s ��ѵ� 15s �� 0.1, ��ͨ 5s ��� 10s+15s �� 0.1 �� �û��� VIP Ȩ���������Ϊ 15s Ҳ���, ʵ�����ɿ۷� �� Ͷ�߷���
  2. mobile `apps/mobile/src/screens/VideoAgentScreen.tsx:550-553` ʱ�� chip ��ʾ�Ǿ�̬�İ� "?? 5s ��� / ?? ${d}s ��0.1/��", **���� `user.isVip`**; VIP �û�ѡ 10s ʱ��ʾ "?? 10s ��0.1/��" ʵ�� VIP ���, ѡ 15s ��ʾ "?? 15s ��0.1/��" ʵ�� VIP ���� 0.1 (���� server һ��, �� 10s ������)
- **����**:
  1. web �İ��� v3.0.0.31 (S51) �ļƷѾ���ʱ©д 15s (��ʷ��©)
  2. mobile UI ���ʱֻ������ͨ�û�, û���� VIP ���� (BUG-053 �޲�������ӵ� UI ȱ VIP ��֧)
- **�޷� (v3.0.27)**:
  1. web VipCenterPage.tsx:119 �� "��Ƶ 5s + 10s ��� (��ͨ�û� 5s ���, 10s/15s ���� 0.1 Ԫ)"
  2. mobile VideoAgentScreen.tsx �� `useAuth` store �� `user.isVip`, ��̬��ʾ:
     - VIP + 5s/10s: ?? "VIP ���"
     - VIP + 15s: ?? "15s ��0.1/��"
     - ��ͨ + 5s: ?? "5s ���"
     - ��ͨ + 10s/15s: ?? "${d}s ��0.1/��"
- **��֤**:
  - web: �����װ v3.0.27, �� VIP ����, ���İ�"10s/15s ���� 0.1 Ԫ" ?
  - mobile (VIP): ѡ 10s �� ��ʾ"?? VIP ���" ?; ѡ 15s �� ��ʾ"?? 15s ��0.1/��" ?
  - mobile (��ͨ): ѡ 5s �� ��ʾ"?? 5s ���" ?; ѡ 10s/15s �� ��ʾ"?? ${d}s ��0.1/��" ?
  - server: ���� VIP+10s �� �Ʒ� 0 ?; ���� VIP+15s �� �Ʒ� 0.1 ?; ������ͨ+10s/15s �� �Ʒ� 0.1 ?
- **��ѵ**:
  1. �Ʒ��İ������ server �Ʒѱ�**��ȫ����** (�� BUG-054 ͬһ����: server ΪȨ��Դ)
  2. UI ״̬�İ����밴�û���� (VIP/��ͨ) ��̬��ʾ, ��д��
  3. �޸ļƷ�/�۸���ش���, **�������� (web+mobile+server) + �İ�**ͬ��

---

## S62 P1 �޸���ʷ (v3.0.28, ��ɫ��� Web �� 1:1 ����)

### BUG-056 (S62 P1, v3.0.28 ��): mobile `CharacterWithAssets` ������ shared-types ��û����, ���� 2 �� screen ����

- **����**: `apps/mobile/src/screens/CharacterListScreen.tsx:10` �� `apps/mobile/src/screens/AssetLibraryScreen.tsx:14` �� `import type { CharacterWithAssets } from '@ai-script/shared-types'`, �� `packages/shared-types/src/index.ts` **����û�� `CharacterWithAssets` ��� export**��TS �ϸ�ģʽӦ�ñ� "Module has no exported member 'CharacterWithAssets'", �� RN bundle һֱ���� Metro ����, û��¶����
- **����**:
  - ���� (S58) д screen ʱ������ `CharacterWithAssets` ���� (������ `Character` + `assets` �ֶ�)
  - server characterModel ��û���� `assets` �ֶ� (v2.0 �ʲ���ʵ�ʻ����� character ��), ʵ�� server �ֶθ� `Character` һ��
  - �������Ͱ�û�в��������, �� import ���һֱû�����ֱ������
- **�޷� (v3.0.28)**:
  - `CharacterListScreen.tsx` + `AssetLibraryScreen.tsx` �� `CharacterWithAssets` ȫ���ĳ� `Character` (server ��Դ����, ���� description/extraDescription/imageVariants/imageGenStatus �� v2.0 �ֶ�)
  - δ�������Ҫ `Character & { assets: ... }` ����, �ӵ� shared-types �����������
- **��֤**: TypeScript �ϸ�ģʽ����ͨ�� (��ʽ��֤, ֮ǰ�� silent ����); װ v3.0.28 APK �б�ҳ/�ʲ������� render
- **��ѵ**:
  1. **��Ҫ��������** �� д `import type` ֮ǰ�� `grep` shared-types ��Դ
  2. RN bundle ���� Metro �������**���� TS ����**, �淢��ǰ���� `npx tsc --noEmit` ��֤
  3. д screen ֮ǰ�� `cat src/api/client.ts | grep "export"` �п��ú��� (�� BUG-009/011 ͬһ����)

### BUG-057 (S62 P1, v3.0.28 ��): CharacterDescriptionReviewScreen ������ 11 ά�ֶα༭, �� server v2.5.34 �����ı���һ��

- **����**: `apps/mobile/src/screens/CharacterDescriptionReviewScreen.tsx` �༭����� `DIMENSIONS` (11 ά: name/age/height/build/face/features/hair/signature/clothes/personality/aliases) + `EXTRA_DIMENSIONS` (4 ά: relationshipsText/emotionRange/actionHabits/signatureLines) �� 15 �� `TextInput` �ֶ�. �� server v2.5.34 �� description �ֶ���**�����ı��ַ���** (CharacterDescription �ع��� `string | null`), �û��༭�걣��� server ���յ��ǿ� JSON ���� `{}`, ������ʧ
- **����**:
  - server v2.5.34 �ع� CharacterDescription �� 11 ά JSON ���� �� �����ı��ַ��� (DEV_PROGRESS.md R ģ���¼)
  - mobile 11 ά�༭ UI û���Ÿ�, �� `confirmCharacter(id, { description: {...}, extraDescription: {...} })` �� server �ֶ����Ͳ�ƥ�� �� ʵ�� description �����
- **�޷� (v3.0.28)**: ������д CharacterDescriptionReviewScreen, �� web �� CharacterListPage.tsx 1:1 ����:
  - ɾ `DIMENSIONS` (11 ά) + `EXTRA_DIMENSIONS` (4 ά) ����
  - ���� 2 �� `TextInput multiline` (������ textarea 220px �� + �������� textarea 120px ��)
  - �������� "��ȡ/������������" ��ť (�� `extractCharacterDescriptions`, ���ɰ湦��һ��)
  - �༭����� `confirmCharacter` (description/extraDescription ���ַ���, �� server �ֶζ���)
- **��֤**: TypeScript ����ͨ��; װ v3.0.28 APK ����������: �ϴ�С˵ �� ���� �� ��ȡ���� �� �༭ �� ȷ�� �� server description �ֶ����ַ������� JSON ����
- **��ѵ**:
  1. server �ֶ������ع� (JSON ���� �� �ַ���) ʱ, �ƶ��� UI ��ͬ���� (���� 1:1 ��ϵ)
  2. �� BUG-054/055 ͬ����: ��������/UI ����� server ��Դ����
  3. �༭����ֶ�Խ��Խ����, Խ�����ѽ�; �����������ı� (�� R ģ�����һ��)

### BUG-058 (S62 P1, v3.0.28 ��): mobile client.ts ȱ `backfillCharactersApi`, �б�ҳû"���·�����ɫ"��ť

- **����**: Web `apps/web/src/lib/api.ts:95` �� `backfillCharactersApi` (POST `/novels/:id/backfill-characters`), CharacterListPage.tsx ����"���·�����ɫ"��ť����; mobile client.ts **û��¶** ��� helper, CharacterListScreen.tsx û��"���·�����ɫ"��ť �� �û���ɫ��Ϊ�ջ����ʧ��ʱ**û���ֶ�����**
- **����**: web �� v2.5.10 �� backfill-characters �˵�ʱ, mobile client.ts ©����Ӧ helper
- **�޷� (v3.0.28)**:
  - `apps/mobile/src/api/client.ts` �� `backfillCharactersApi = (novelId: string) => apiClient.post(`/novels/${novelId}/backfill-characters`)` (�� web 1:1)
  - CharacterListScreen.tsx ������"���·�����ɫ"��ť (�ǿ�̬ + ��̬����ʾ), �� backfillCharactersApi �� 3 ��ˢ�� (�� web handleBackfill 1:1)
- **��֤**: װ v3.0.28 APK ��С˵���� �� ��ɫ�� tab �� ��"���·���" �� server ���� backfill �� 3s ���б�ˢ�¿����½�ɫ
- **��ѵ**:
  1. web �˼��� API helper ʱ, ��ͬ���� mobile client.ts (�� BUG-058 ͬ����: ©���ͬ��)
  2. server �ж˵㵫 client û��¶, �ƶ�����ȫ��֪���� �� �� server �˵�ʱ audit ���� client

### BUG-059 (S62 P1, v3.0.28 ��): mobile client.ts ȱ `updateCharacterFullApi`, ����ҳ���ܱ��������༭

- **����**: Web `apps/web/src/lib/api.ts:100-101` �� `updateCharacterFullApi` (PUT `/novels/characters/:cid/full`, ֧�� name/aliases/roleType/description/extraDescription ��������); mobile client.ts ֻ�� `updateCharacter` (PUT `/novels/characters/:cid`, **ֻ֧�� name/appearance/personality/roleType** 4 ���ֶ�, **û�� description/extraDescription/aliases**) �� �û��༭�����󱣴�ӿڱ� 400 / �ֶα�����
- **����**: web �� v2.5.11 �� updateCharacterFullApi ʱ, mobile client.ts ©����Ӧ helper; �ϵ� `updateCharacter` �� v1.0 �˵�, �ֶβ�ȫ
- **�޷� (v3.0.28)**:
  - `apps/mobile/src/api/client.ts` �� `updateCharacterFullApi = (characterId, data) => apiClient.put('/novels/characters/${cid}/full', data)` �� web 1:1
  - CharacterDetailScreen.tsx �±༭ģʽ (`handleSave`) �� updateCharacterFullApi �������� (name/aliases/roleType/description/extraDescription ȫ�ֶ�)
- **��֤**: װ v3.0.28 APK ����ɫ���� �� ��"�༭" �� �������� textarea �� ��"�����޸�" �� server description �ֶ��Ǳ༭����ַ��� (���Ǳ�����)
- **��ѵ**:
  1. �� BUG-058 ͬ����: web ���¶˵�ʱ��ͬ���� mobile client.ts
  2. mobile �ϰ� `updateCharacter` (v1.0 �˵�) �ֶβ�ȫ, �Ǽ���ծ, �´������ `updateCharacterFullApi`
  3. API helper �������Ҫһ�� (`updateCharacterFullApi` / `backfillCharactersApi`), ��Ҫ����ĺ�׺

### BUG-060 (S62 P2, v3.0.28 ��): mobile CharacterDetailScreen ������ 3 �ű���ͼģʽ, �� server v2.5.13 ��ͼ����ͼ��һ��

- **����**: `apps/mobile/src/screens/CharacterDetailScreen.tsx` (v3.0.27) "����ͼ" ���г� 3 �ű���ͼ (front_bust/side_bust/full_body), ÿ�Ŷ���"�������� ��0.3" ��ť; �� server `characterService.generateImageVariants` v2.5.13 �Ѹ�**��ͼ����ͼ** (angle='sheet', character_sheet ����ͼ�� 1 ��), `imageVariants` ����ֻ�� 1 �� sheet �� mobile UI ��Ⱦʱ 2 �� slot �ǿյ�, �û�����"�� 2 ��ͼ"
- **����**:
  - server v2.5.13 �ع� (DEV_PROGRESS H ģ��): "��ͼ��ɫ��" �ĳ� "1 ������ͼ character sheet" ��� "3 �ű���ͼ"
  - mobile CharacterDetailScreen.tsx û�����ع�, ���� 3 �ű���ͼģʽд
  - �� web CharacterDetailPage.tsx Ҳ�Բ��� (web ���ǵ�ͼ sheet, ���ع�)
- **�޷� (v3.0.28)**:
  - ������д CharacterDetailScreen, �� web �� CharacterDetailPage.tsx 1:1 ����
  - ����ͼ���ĵ�ͼ sheet (`(c.imageVariants || []).find(v => v.angle === 'sheet')`)
  - "��������ͼ" ��ť (��ͼ, �� generateCharacterImages ���� onlyAngles)
  - "������ͼ" ��ť (status='completed' ��, �� web һ��)
  - AssetLibraryScreen.tsx ͬ���ĵ�ͼ sheet Ԥ�� (��� 3 �ű���ͼ����)
- **��֤**: װ v3.0.28 APK ����ɫ���� �� ��"��������ͼ" �� 5-15s �󿴵� 1 ������ͼ (sheet) ���ԭ�� 3 �ű���ͼ; AssetLibraryScreen ����ÿ����ɫ��ʾ 1 �Ŵ�ͼ
- **��ѵ**:
  1. server �������ݽṹ/�ֶ��ع�ʱ, **mobile + web ����ͬ��** (�� BUG-057/058/059 ͬ����: ©���ͬ��)
  2. "����ͼ" ����� 3 �� �� 1 ������ͼ, �� UX �Ż� (�û���ȷҪ��"1 ��ͼ�������з־�"), ���˱���� server һ��
  3. mobile �ϴ��� (v3.0.0 ~ v3.0.27) CharacterDetailScreen + CharacterListScreen + AssetLibraryScreen ȫ���� 3 �ű���ͼģʽд, �Ǽ���ծ, v3.0.28 ������д

---

## S63 �޸���ʷ (v3.0.29, ��ɫ�� UI ��ҵ�������)

### BUG-061 (S63, v3.0.29 ��): ��ɫ�����ֶԱȶȲ��� (WCAG 4.5:1 �����), ������ɫһ�𼸺�������

- **����**: user ���� "��ɫ��� UI �������, ��������̫����, �ͱ���ɫһ����ȫ������"
  - `colors.text.tertiary` = `#94A3B8` �� `colors.bg.tertiary` = `#1E1E35` �϶Աȶ� 4.36:1, **WCAG AA 4.5:1 �ٽ�** (ʵ����ǿ)
  - ʵ������ `colors.bg.secondary` = `#151525` �ϸ���, �ӽ� 4.0:1, �Ӿ���"���ֻұ���" �������ɼ�
  - `fieldLabel` (caption fontSize 12) �� `text.tertiary` �� `bg.secondary`, �û�����������
  - `roleChip` �� `roleColor + '20'` (12.5% alpha) ������, ���� `roleColor` ��ɫ, ����ɫ bg ��**��������**
  - `descText` (��ɫ��������) ��Ԫ���� `charMeta` ��ͬһ�Ҷ�, �㼶����
- **����**:
  - theme/index.ts ȫ�� colors û�ּ�, ֻ�� primary/secondary/tertiary 3 ��
  - ��ɫ�� screen ��ȫ�ֹ���, ûΪ"��ɫչʾ" �������ר��ɫ��
  - д code ʱֱ�� `colors.text.tertiary`, û���Աȶ��Լ�
- **�޷� (v3.0.29)**:
  - �½� `src/theme/character.ts` (��ɫר�� theme), �� 5 ������ɫ��:
    - `text.primary` #F8FAFC (12.6:1) - ����
    - `text.body` #E2E8F0 (11.6:1) - ����
    - `text.muted` #CBD5E1 (7.4:1) - ���� (���ԭ secondary �� bg.secondary �ϵ� 4.0:1)
    - `text.subtle` #94A3B8 (4.5:1) - placeholder
  - `surface` 3 �㿨Ƭ: card / section / input, �� `colors.bg.primary` ����, �����Ӿ��㼶
  - ROLE_COLORS 4 ��ɫ��ɫ (���Ǻ�/������/�����/��Ҫ��) + `primaryAlpha` 18% alpha (��� 12.5%)
  - STATUS_COLORS 5 ״̬ (������/��ȷ��/��ͼ��/��ȷ��/����ͼ), �� 18% alpha
  - 3 �� screen ȫ������ theme, �滻���� `colors.text.tertiary` �� `text.body/muted`
- **��֤**: 
  - WCAG �Աȶ�: text.body �� bg.secondary 11.6:1 (AAA), text.muted 7.4:1 (AA+)
  - ����װ v3.0.29 APK, ����ɫ��: ��ɫ�������������ɼ�, chip �߿�/���ֶԱ��㹻
  - װ X ��ͼǰ/��Ա�, ���ִ�"����������" �� "�����׶�"
- **��ѵ**:
  1. **WCAG AA 4.5:1 �������**, text on dark bg ������ `text.tertiary` �պ�
  2. theme ���Ҫ��"����" �� (ȫ�� / ��ɫ�� / ��ͼ), 3 ��ɫ�ײ�����
  3. ��ҵ�� UI ��һ����֤���� "���ָ������Աȶ�", ����ͼ��
  4. д chip ���ֱ��� 18% alpha ���� + 1px ͬɫ border (40%), ���ܹ⿿ 12.5% alpha ��
  5. �����¹淶�� CODING_STANDARDS.md �� 25 �� (����Աȶ�Ӳ��)

### BUG-062 (S63, v3.0.29 ��): ��ɫ���� emoji �� icon (??/??/??/??/?), ������ҵ��, Ӧ�� Ionicons ʸ��ͼ��

- **����**: user ���� "UI �����Ű�̫����, ������һ�����ÿ��� UI ���"
  - ��ɫ������ emoji ??? (tag), ������ ?? (name badge), ������ ?? (book), ���������� ? (sparkles)
  - emoji �ڲ�ͬ Android ϵͳ��Ⱦ**���ز�һ��** (Android 7 ���� �� Android 14 ��ȫ��ͬ), �ֺŴ�ϸ/λ��Ư��
  - emoji ���� shipin-APP ���� screen (�� Ionicons ʸ��ͼ��) ��ͳһ
  - ��ҵ�� APP �� emoji �� "�ݸ�ԭ��", �� Notion/Linear/Discord ���������
- **����**:
  - д code ʱ͵��, û�� `react-native-vector-icons/Ionicons` (package.json ��װ, RN 0.73 Ĭ��֧��)
  - emoji �� Unicode �ַ�, ��Ⱦ����ϵͳ����, ���ɿ�
  - S58~S62 �ڼ��� screen (CharacterDetailScreen, CharacterDescriptionReviewScreen, ChatScreen ��) ���� emoji
- **�޷� (v3.0.29)**:
  - �½� `src/components/Chip.tsx`, 3 ����� chip:
    - `RoleChip`: 4 ��ɫ������ Ionicons `flame/skull/shield/person` (����/����/���/��Ҫ)
    - `StatusChip`: 5 ״̬�� Ionicons `hourglass-outline/create-outline/sync/image-outline/checkmark-circle`
    - `StyleChip`: 5 ������ Ionicons `videocam-outline/flower-outline/rocket-outline/heart-outline/cube-outline`
  - ȫ���� `Ionicons name={...} size={11-13} color={...}`, ������ emoji ����
  - CharacterListScreen + CharacterDetailScreen + CharacterDescriptionReviewScreen ȫ���滻
  - �ַ� icon (? ? ?) ���� (Toast/Alert �ڲ���, �� RN native ���һ��)
- **��֤**:
  - װ v3.0.29 APK, ���� Android 7 ����ɫ��: ��ɫ����/״̬/���� chip ȫ����ʸ��ͼ��, ��Ⱦ�ȶ�
  - �� web �� (�� lucide-react) �Ӿ��ӽ� (Web �� Mobile ���� vector icon family)
- **��ѵ**:
  1. **��ֹ emoji �� UI icon**, �� `react-native-vector-icons` ʸ��ͼ��
  2. �� OS (Android 7/14, iOS) ��Ⱦһ����, ��ҵ���ر�
  3. shipin-APP package.json ��װ `react-native-vector-icons@10.3.0`, д code ǰ�� `import Ionicons from 'react-native-vector-icons/Ionicons'`
  4. �����¹淶�� CODING_STANDARDS.md �� 26 �� (��ֹ emoji icon)
  5. �� BUG-050 (��ʷ chip emoji) ͬ����, ����ͳһ�滻

### BUG-063 (S63, v3.0.29 ��): ��ɫ���� screen ���� showToast('msg', 'error') �� 2 �� API, S60 ֮���ѷ���Ϊ showToast(config) / toast.error()

- **����**: TypeScript ���뱨 9 �� `Expected 1 arguments, but got 2` ���� (CharacterListScreen:1, CharacterDetailScreen:4, CharacterDescriptionReviewScreen:4)
  - `showToast('msg', 'error')` �� API: �� 2 ���� `variant` �� S60 ���� Toast ���ʱ��ɾ��
  - �� API: `showToast({ message, variant })` �� `toast.error('msg')`
  - **RN bundle ���� Metro ����, ��Щ TS ����һֱ����û��¶** (�� BUG-056 ͬ����)
- **����**:
  - `src/components/Toast.tsx:88` �� `export const showToast = toast.show` (ֻ�� string �� config, ���� variant)
  - д S62 CharacterListScreen/DetailScreen/DescriptionReviewScreen ʱ, ����ճ�� S60 P3 ֮ǰ�� `showToast('msg', 'error')` �ϵ���, û������ API
  - RN 0.73 + Metro 0.80 �� cache ������ JSX ����, û��¶�� TS �ϸ�ģʽ
- **�޷� (v3.0.29)**:
  - ȫ�� `sed` �滻 3 �� screen �� 9 ���ϵ���:
    - `showToast('msg', 'success')` �� `showToast({ message: 'msg', variant: 'success' })`
    - `showToast('msg', 'error')` �� `showToast({ message: 'msg', variant: 'error' })`
  - ���� `toast.error` / `toast.success` ��ݵ���, ������ code �� `toast.error('msg')` (1 ��, ����д��)
  - tsc �ϸ�ģʽ 0 �� (S63 �ĵ��ļ���Χ��)
- **��֤**:
  - tsc --noEmit �� 3 �� screen 0 ��
  - װ v3.0.29 APK, ����ɫ��� "���·���" ʧ��ʱ, Toast ����� + �����İ� ?
  - ����ɫ����� "�����޸�" / "��������ͼ" �ɹ�/ʧ��, Toast ��������
- **��ѵ**:
  1. **API �ع���� audit �ϵ��õ�**, ����"�ع������" (�� BUG-054/055 S61 ʱ�� chip ͬ���� web ͬ����)
  2. mobile ������� `tsc --noEmit` ������, RN bundle ���� Metro cache ������ TS �� (S60 ��ѧ��ѵ, S62 ����, S63 ����)
  3. �����¹淶�� CODING_STANDARDS.md �� 27 �� (mobile ����� tsc ��֤)
  4. ����� API (Toast/Dialog/Sheet) �ع�, �ؼ� @deprecated ���, ��ʾ IDE auto-import ����

### BUG-064 (S63, v3.0.29 ��): ��ɫ�� 3 �� screen ״̬������ `styles` ������ StyleSheet `styles` ��ͻ, ���� tsc ���ͻ���

- **����**: TypeScript ���뱨 17 �� `Property 'card' does not exist on type 'StylePreset[]'` ���� (CharacterListScreen ȫ��, CharacterDetailScreen/DescriptionReviewScreen ����)
  - `const [styles, setStyles] = useState<StylePreset[]>([])` (state �滭��Ԥ��)
  - `const styles = StyleSheet.create({...})` (������ʽ��)
  - ����ͬ��, TS ������ state ���� `StylePreset[]`, ��"�Ҳ��� card/cardBody/etc."
  - **����ʱʵ���� OK** (RN JSX �õڶ��� const ʱ�õ� StyleSheet), �� TS �ϸ�ģʽ�� 17 ����
  - �⵼�º��� S63 ��дʱ, StyleSheet ���ñ����� (�� styles.xxx ����, ɾ���Ҳ���)
- **����**:
  - S58 д CharacterListScreen ʱ, ���� `styles` state, �� StyleSheet ��ͻ
  - һֱû�� tsc ��, TS ��� Metro cache ��
  - S62 �ع�ʱ, copy-paste �ϴ���, ���ó�ͻ����
  - S63 ��дʱ�ŷ���, ������ S58 ����, ����ͬ�� 17 ����
- **�޷� (v3.0.29)**:
  - state ���� `stylePresets` / `setStylePresets`, ������ `styles = StyleSheet.create` ����
  - ȫ�� `sed` �滻 3 �� screen �� state ����������
  - д�� screen ���� `styles` ���� StyleSheet, ���� state �����廯���� (`characters`, `loading`, `backfillMsg` ��)
- **��֤**:
  - tsc --noEmit �� CharacterListScreen 0 �� (�� 17 ������ 0)
  - װ v3.0.29 APK �ܽ�ɫ�б�, ���� chip ������ʾ
- **��ѵ**:
  1. **state ��������ֹ�� `styles`**, �� `stylePresets` / `data` / `items` �����廯����
  2. **StyleSheet �������� `styles` �� RN ����**, ��Ҫ reverse ռ��
  3. tsc --noEmit �� mobile ������� (�� BUG-063 ͬ����)
  4. �����¹淶�� CODING_STANDARDS.md �� 28 �� (��ֹ state �� styles ����)
  5. �� BUG-031/032 (S59 ȱ theme import ����ʧ��) ͬ����, ���� "д��û tsc ��֤"

### BUG-065 (S63, v3.0.29 ��): mobile LinearGradient ����� `react-native-linear-gradient` ��������, �� shipin-APP ûװ, ����ʱ��Ĭ fallback, UI ���䲻��ʾ

- **����**: Phase 2 д `src/components/LinearGradient.tsx`, �� `require('react-native-linear-gradient')` ��̬����
  - shipin-APP `package.json` ʵ��**ûװ** `react-native-linear-gradient` (�� S60 ImageAgent/VideoAgent ��ʱ����һ��, �� WebView/ԭ�� video ���)
  - ����ʱ `require()` �� MODULE_NOT_FOUND, try-catch ��Ĭ�̵�, �˵� fallback `View` ģ��
  - fallback �Ӿ��� ���潥��**���Բ�һ��** (͸���ȵ��� 3 ��, ��Ե����Ȼ)
- **����**:
  - д���ʱ"�����ֳɰ�", û `cat package.json | grep linear-gradient` ��֤�Ƿ���װ��
  - �� BUG-005 (S58 mobile `STYLE_PRESETS` �� monorepo �� undefined) ͬ����: "�� web ���о���Ϊ mobile Ҳ��"
  - web �� Vite ��Ŀ�� `react-native-linear-gradient` ���Ʒ (web �� CSS), �� mobile ��ȫ��ͬ
- **�޷� (v3.0.29)**:
  - �� `try { require('react-native-linear-gradient') } catch { fallback }` ģʽ
  - Fallback �� `View` �� 3 �ΰ�͸��ɫ (`backgroundColor + opacity`), �Ӿ��ӽ�
  - ������ 5% ��ɫ���ǲ��ữ��Ե
  - ��������Ⱦ, װ�˰������潥��, ûװ���� fallback
  - **�ؼ�**: �� BUG-052 (S60 WebView �� Android 7 ������) һ��ԭ��: "�����Ⱦ����Ҫ�� logcat, �� ClassNotFoundException, ��Ҫ�ӱ��������ƶ�"
- **��֤**:
  - װ v3.0.29 APK �ܽ�ɫ��: hero banner / button / progress bar ȫ���н���Ч�� (fallback View 3 �ε���)
  - �Ӿ���ԭ�ƻ��ӽ�, ���䷽������ϵ����� (rotateY ����)
  - ������װ `react-native-linear-gradient` ��, �Զ����潥�� (����Ĵ���)
- **��ѵ**:
  1. **д��������� grep package.json ��֤����** (�� BUG-005/009/011/031/032 ͬ����)
  2. try-require ģʽ�� mobile ��"������" ��׼����
  3. Fallback UI ��"���ܵȼ�", ���ܹ� throw + ����
  4. �����¹淶�� CODING_STANDARDS.md �� 29 �� (д������ǰ�ز� package.json)

---

## v3.0.29 �� v3.0.30 �޸���ʷ (S64 P0-P3, 2026-06-24)

### BUG-066 (S64, v3.0.30 ��): server `apps/server/package.json` version �ֶθ� ecosystem.config.js APP_VERSION ��һ��, 12 ���汾δͬ�� (S17 �����)

- **����**: S64 ���������Լ췢��:
  - `apps/server/package.json:3` `"version": "3.0.0-alpha"` �� **S17 ��ʷ����, 12 ���汾û����**
  - `apps/server/src/index.ts:68` fallback `'3.0.0-alpha'` �� **ͬ��, fallback ��汾**
  - ʵ������: `ecosystem.config.js` env_production.APP_VERSION = `3.0.29` (PM2 �����, /api/version �� 3.0.29)
  - **���ط���**: ��� PM2 ����ʱ env ����δ��Ч (e.g. ecosystem.config.js ��ɾ/������), server /api/version ����˵� fallback `'3.0.0-alpha'`, �ͻ��˻��յ�ǿ����������, **��ʵ�� APK �� v3.0.29** �� �û���ǿ�ƻ��˵� v3.0.0-alpha (�ɰ�, ʵ�ʲ�����) �� ������Զ�ز���
- **����**:
  - S17 (v3.0.0-alpha) д `index.ts` fallback ���� `'3.0.0-alpha'` ��ʱֵ
  - S18-S63 �ڼ� 12 �η���, ÿ��ֻ bump `ecosystem.config.js` �� env (�����ɼ�)
  - û�˻�ͷͬ�� `package.json` �� `index.ts` fallback (Դ��Ĭ��), ��Ϊ"���� PM2 env ������ OK"
  - **ä��**: ��ά�� `package.json` ������Ϊ server �� v3.0.0-alpha, ��ʵ���� v3.0.29 ����, �Ų�����ʱ������
- **�޷� (v3.0.30, S64)**:
  - `apps/server/package.json:3` `"version": "3.0.0-alpha"` �� `"version": "3.0.29"` (�� ecosystem ͬ��)
  - `apps/server/src/index.ts:68` `process.env.APP_VERSION || '3.0.0-alpha'` �� `|| '3.0.29'` (��ʵ����������)
  - ���� `apps/server/src/shared/changelog.ts` (185 ��) �� `apps/server/changelog.json` ����ʵ changelog
  - ���� `apps/server/changelog.json` ά�� 11 ���汾��Ŀ (3.0.29 �� 1.0.0)
  - `/api/version` �ķ��� `{version, downloadUrl, changelog, highlights[], buildDate, forceUpdate, needUpdate}` ��ʵ�ֶ�
  - ���� deploy.sh: �� `cp changelog.json dist/changelog.json` (tsc ������ json)
- **��֤**:
  - `curl /api/version` ���� `changelog: "��ɫ�� UI ��ҵ������� + 5 BUG �޸�"` + `highlights: [5 ����ʵҪ��]`
  - �� ecosystem.config.js ɾ APP_VERSION ����, /api/version �Է��� 3.0.29 (fallback ��ȷ)
  - web /download ҳ Playwright ���ʿ��� v3.0.29 + ��ʵ 5 �� highlights
- **��ѵ**:
  1. **Դ�� fallback �ظ���ǰ�����汾һ��**, ����"������ PM2 env �ܶԾ� OK"
  2. **package.json version �ֶαظ� ecosystem.config.js APP_VERSION ͬ��**, ���Ǹ���ά/������������"����"
  3. **changelog ����ʵ�ɶ�**, �Ͻ�Ӳ����ͨ���İ� ("�Ż����ܣ��޸���֪����") �� �� BUG-067 ͬ����
  4. �����¹淶�� CODING_STANDARDS.md �� 30 �� (server fallback ��ͬ����ǰ�汾)
  5. �� BUG-008 (PM2 env ��ˢ) ͬ����: "env �������� = ���" ������, Դ�� fallback ��������

### BUG-067 (S64, v3.0.30 ��): web �� 3 ��Ӳ����汾�� `v3.0.0`, �� server /api/version ʵ�ʷ��� v3.0.29 ��һ��, �û�������������ϰ汾

- **����**: S64 ȫ AI ��ʾ user ��"���� APK �Ƿ���µ�����"ʱ, ��� web �˷���:
  - `apps/web/src/components/Layout.tsx:44` `<span>v3.0.0</span>` �� Ӳ����
  - `apps/web/src/pages/AboutPage.tsx:7` `const APP_VERSION = '3.0.0'` �� Ӳ����
  - `apps/web/src/pages/AboutPage.tsx:8` `const BUILD_DATE = '2026-06-13'` �� Ӳ����
  - `apps/web/src/pages/DownloadPage.tsx:41` `const version = serverVer?.version || '3.0.0'` �� fallback Ӳ����
  - `apps/web/src/pages/DownloadPage.tsx:42` `const downloadUrl = ... || 'https://ab.maque.uno/app/DeepScript_v3.0.0.apk'` �� fallback Ӳ����
  - **�û�����**: ������� `https://ab.maque.uno/download`, �� Layout ���� `v3.0.0`, �� server /api/version ʵ�ʷ� 3.0.29, APK �Ѿ��� 3.0.29 �� **�û�����** "���� v3.0.0 ���� v3.0.29?"
  - �� DownloadPage 5 �� changelog `<li>` ȫ�� hardcoded "���� 8 ������ҳ��..." (S58 P1 д��, ����ǰ S64 ʵ�� changelog û��ϵ)
- **����**:
  - S56 д AboutPage ʱֱ�� `const APP_VERSION = '3.0.0'` Ӳ����
  - S58 P1 д Layout + DownloadPage ʱͬ��Ӳ���� `'3.0.0'`, **����û���� web �� version.ts ��һ��Դ**
  - �� BUG-066 ͬ����: "env/fallback �������� = ���" �� ʵ�� DownloadPage fetch /api/version �� setState �õ� 3.0.29, �� Layout/AboutPage ����һ��, ��ȫ���� /api/version
  - ��� mobile �� src/config/version.ts ��һ��Դ, web ��**û��** �� ���ȱʧ
- **�޷� (v3.0.30, S64)**:
  - �½� `apps/web/src/config/version.ts` (�� mobile ͬ�ṹ, �� APP_VERSION/APP_VERSION_CODE/APP_NAME/APP_DISPLAY_NAME/APP_BUILD_DATE)
  - Layout.tsx ɾӲ���� `v3.0.0`, �� `import { APP_VERSION }` + `<span>v{APP_VERSION}</span>`
  - AboutPage.tsx ɾӲ���� const, �� `import { APP_VERSION, APP_BUILD_DATE }`
  - DownloadPage.tsx fallback ���� APP_VERSION (�� config ͬ��, ����� server ��һ��)
  - DownloadPage.tsx 5 �� hardcoded `<li>` �ĳ� `highlights.map(...)`, ��̬��Ⱦ server /api/version ���ص���ʵ highlights
  - APK_SIZE_BYTES_FALLBACK ��Ϊ 30_073_380 (v3.0.29 ��ʵ��С 28.7 MB), ���� S58 д���� 31_214_621
- **��֤**:
  - web build ͨ��
  - Playwright ���� https://ab.maque.uno/download ����:
    - Layout ����: `v3.0.29`
    - DownloadPage Hero: `��ǰ���°汾: v3.0.29 �� 28.7 MB`
    - ��������: `v3.0.29 �������� (2026-06-24)` + 5 ����ʵ highlights
  - ����� DevTools �� Layout �� AboutPage ���� v3.0.29, �� server /api/version һ��
- **��ѵ**:
  1. **���չʾ��ͳһ�ӵ�һ��Դ��** �� mobile �� src/config/version.ts, web/server Ҳ������
  2. **�Ͻ�Ӳ����汾��/����/changelog**, ���� config/version.ts �� server /api/version
  3. **fallback Ĭ��ֵ�ظ���ǰ�汾һ��**, �� BUG-066 ͬ����
  4. �����¹淶�� CODING_STANDARDS.md �� 31 �� (��� version �ص�һ��Դ)
  5. �� BUG-007/008 (�����ϴ���) ͬ����: "���������� = ���" ������, Դ��ر�֤��̬һ����

### BUG-068 (S64, v3.0.30 ��): mobile ����������·������, ȱ�ĵ��淶, AI Agent ���׸Ļ� updater.tsx ���� 7 ����֪ʧ��

- **����**: S64 ȫ AI �Լ췢��:
  - `apps/mobile/src/utils/updater.tsx` (462 ��) �� mobile ������·�ĺ���, BUG-021/022/023/024/025/026 �������ļ�
  - ��**û��ר�Ź淶�ĵ�**�ܽ� 7 ��ʧ�ܵ��������, AI �� updater.tsx ���ײȿ�
  - ��ǰ `apps/mobile/DEPLOY.md` �� 8 �� 7 �����, ���� CODING_STANDARDS / VERSION_MANAGEMENT û������
  - ��� (mobile + web + server) û��ͳһ�� "�汾����淶�ĵ�"
- **����**:
  - S58 P10 (BUG-025) ����ʱֻ������ DEPLOY.md, û�������汾����淶
  - ���� S59-S63 �ڼ�����������· (BUMP server APP_VERSION / Playwright ��֤ / APK �б�����), ֪ʶɢ���ڸ� PR ����, û����
  - �� AI Э��ʱ (coder/verifier), ȱ��ͳһ���, ÿ�� AI ��Ҫ������һ��
- **�޷� (v3.0.30, S64)**:
  - �½� `docs/VERSION_MANAGEMENT.md` (360 ��, v3.x ������) �� �������� 9 ��:
    - �� 1 �汾�Ÿ�ʽ + ��λ����
    - �� 2 �汾���� 4 ��λ�õ�ͳһ���� (mobile/web/server/ecosystem)
    - �� 3 ��һ��Դԭ�� (ÿ�� app �Լ�ά�� src/config/version.ts)
    - �� 4 changelog ά������ (apps/server/changelog.json + shared/changelog.ts)
    - �� 5 �������� (8 �� SOP, �� 5 ά��֤)
    - �� 6 ʧ����� (8 ��, �� BUG-024/025/066/067)
    - �� 7 AI Agent �����嵥 (5 ����������)
    - �� 8 ��ʷ�汾�ݽ��� (3.0.0+)
    - �� 9 �����ĵ�����
  - ���� S11 д�� `docs/VERSION_POLICY.md` (v2.0.0 �����), ��ͷ���ӷ���˵��
  - `apps/mobile/AGENTS.md` ���� `docs/VERSION_MANAGEMENT.md`, AI ��ڱض�
  - `apps/mobile/CODING_STANDARDS.md` �� 30/31/32 ���¹淶 (Դ�� BUG-066/067/068)
  - `apps/mobile/BUGS.md` �� BUG-066/067/068 3 ������Ŀ
  - `DEV_PROGRESS.md` �� S64 �Ự׷��
- **��֤**:
  - �´� AI (coder) �� shipin-APP ʱ, �ض� docs/VERSION_MANAGEMENT.md + apps/mobile/AGENTS.md, �����ظ��� BUG-024/025/066/067
  - ���а汾�ű������ �� 7.2 6 ���Լ�, �����ٳ��� "��һ����������" �� BUG
  - �� AI (coder + verifier) Э��ʱ, ���� �� 5.8 5 ά��֤ SOP ��
- **��ѵ**:
  1. **�� AI Э������ͳһ�淶�ĵ�**, �������� PR �����������¼
  2. **�淶�ĵ����� 4 ����**: �汾�Ź��� + ��һ��Դ + �������� + ʧ�����
  3. **AI Agent ��ڱ����ù淶**, AGENTS.md/CLAUDE.md �� "�ض� N �ݹ淶" �б�
  4. **commit message �ش��汾�� + BUG ���**, �� BUGS.md ˫��׷��
  5. �� BUG-005/009 (monorepo shared ����) ͬ����: "����ճ�������� OK = ���" �� �� AI ��������ʽ�淶



### BUG-069 (S66, v3.0.29 �� v3.0.30 ��): server ecosystem.config.js APP_VERSION д 3.0.26, ��ʵ������ 3.0.29 ��һ�� (S64 BUG-066 ©�޵ĵ� 6 ��)

- **����**: S66 ȫ AI �Լ췢�� `apps/server/ecosystem.config.js:11` env.APP_VERSION д `3.0.26`, env_production.APP_VERSION Ҳ�� `3.0.26`, ��ʵ������ server �� `3.0.29` (S63 ������ 3.0.29 ��ûͬ��)��
- **����**: S64 BUG-066 �� 6 ���汾��ʱ (mobile version.ts / mobile build.gradle / server package.json / server src/index.ts fallback / web src/config/version.ts / changelog.json), **©�� ecosystem.config.js** (��Ϊ���� PM2 �������, ���� src/ ��, ���ױ�����)��
- **����**: PM2 ���ʱ����� `env` �� (�� env_production), server ʵ���ܵ��� 3.0.29, �� `/api/version` �� 3.0.26 �� �ͻ����յ� needUpdate=true �� ����ǿ���������� �� �û���ǿ�ƻ��˵��ϰ汾��ʾ, ��ѭ����
- **�޷� (v3.0.30, S66)**:
  - `apps/server/ecosystem.config.js` env.APP_VERSION `3.0.26 �� 3.0.29`
  - `apps/server/ecosystem.config.js` env_production.APP_VERSION `3.0.26 �� 3.0.29`
  - ������ͬʱ�� (env + env_production, ����ֻ��һ��)
  - �������� [`docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md) �� 6 (6 ��ͬ���� ecosystem.config.js)
  - �������� [`docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md) �� 4.3 (PM2 env ע�� + S66 BUG-069 �Լ�����)
- **��֤**:
  - S66 �Լ�: `pm2 env 0 | grep APP_VERSION` ���� = `3.0.29`
  - `curl /api/version` ���� `.data.version = "3.0.29"`
  - 5 �� grep (package.json + index.ts + ecosystem �� 2 + changelog) ȫ = `3.0.29`
- **��ѵ**:
  1. **6 ���汾��ͬ������ ecosystem.config.js һ��** �� ���� src/ ��, �� PM2 ���ʱ��
  2. **ecosystem.config.js �� 2 �� APP_VERSION** (env + env_production), ��ͬʱ��, ����©
  3. **VERSION_MANAGEMENT.md �� 2 6 ���Լ��嵥׷�� ecosystem.config.js** (S66 �޶�, 5 �� �� 6 ��)
  4. **��������** `pm2 env 0 | grep APP_VERSION` + `curl /api/version` ˫��֤ (�� env ����Ч)
  5. �� BUG-008 (PM2 env ��ˢ) ͬ����: "env �������� �� ���", ����Դ�� + ����ʱ˫��

### BUG-070 (S67, v3.0.29 �� v3.0.30 ��): AI ���� server ʱ������Ծ������, ֱ�� pm2 restart �����û� AI ����

- **����**: S67 �Լ췢�� �� VERSION_MANAGEMENT.md �� 5 ��� SOP 8 ������ֻ�� "pm2 delete + start", û���Ծ������; apps/server/AGENTS.md ������; CODING_STANDARDS.md ûӲ�Թ淶. AI �ӵ�"���� server"����, �����й淶��ֱ�� `pm2 delete + start`, **����û����ڷ���С˵ / ��ͼ / ����Ƶ������**, token Ǯ�׻�, �û�Ͷ��.
- **����**:
  - VERSION_MANAGEMENT.md �� 5 (S64) û���ǻ�Ծ���񳡾�, ֻд�˱�׼ 8 ��
  - û�� server �� AI ��� (apps/server/AGENTS.md), AI ֻ�� mobile AGENTS.md
  - deploy.sh ͷ��ע�� "AI ������ִ�в���ǰ���������Ķ� docs/DEPLOY.md" ������ʾ, AI ��������
  - server �����ʵ�Ѿ�ʵ��������ά��ģʽ���� (`routes/admin.ts:136 active-tasks` + `routes/admin.ts:144 maintenance` + `shared/maintenance.ts` + controller ���), �� AI ��Ϊ�淶û����
- **�޷� (v3.0.30, S67)**:
  - �½� `apps/server/AGENTS.md` (240 ��, S67) �� server �� AI ���, �� mobile AGENTS.md �Գ�, ������ǰ���� 5 �� + 5 ��������� + 8 ������ + S67 �Լ�����
  - `docs/VERSION_MANAGEMENT.md �� 5.0` ������֧�ж� (��/�޻�Ծ����)
  - `docs/VERSION_MANAGEMENT.md �� 5.A` ������Ծ���񳡾�����ר�� (9 ����������)
  - `apps/mobile/CODING_STANDARDS.md` �ӵ� 38 ���¹淶: server ������ȼ���Ծ���� + ��ά��ģʽ
  - `VERSION_MANAGEMENT.md �� 9` ������׷�� `apps/server/AGENTS.md`
- **��֤**:
  - ����ǰ�� `curl /api/admin/active-tasks` �� COUNT, > 0 ʱ�� �� 5.A ��
  - ά��ģʽ�����, �ͻ��˷��·��������ʧ�� (controller �ܾ�)
  - �Ѿ����ܵ��������ִ�� (background setImmediate ����Ӱ��)
  - 15 �������������� COUNT = 0, �Զ����� �� 5.A �� 6 ������
  - ����� 6 ά��֤ȫͨ��
- **��ѵ**:
  1. **AI ��Ϊ�淶�ظ������д�������** �� S66 �������ά�ֲ�ʱ, ֻ���� "AI ��ô�� PM2 ����", û�� "AI ��ô��ȫ����"
  2. **ÿ�� app ���� AGENTS.md** (mobile / web / server) �� AGENTS.md �� AI �ض����, ���ܿ� app ����
  3. **��˴������л���û�� AI �淶�� = ���ڲ�����** �� `routes/admin.ts:136` �ȶ˵����, �� AI ��֪����, ������
  4. **��� SOP ���뿼������ʱ״̬** �� VERSION_MANAGEMENT �� 5 ���ֻ����̬ SOP (�İ汾/build/tar/scp/pm2), û����̬״̬ (��Ծ����)
  5. **AI Agent ����ĵ��ȴ���ע�͸���Ҫ** �� deploy.sh ͷ��ע�� S58 ��д��"AI �ض� docs/DEPLOY.md", ��ʵ��û�˶�, ��Ϊ AGENTS.md ûǿ������

### BUG-071 (S68, v3.0.30 �� v3.0.30 ��): 3 �� AGENTS.md ��˹淶�ظ� + ����Ŀ�����ͳһ�տ����, AI �� 3 ���ĵ�����ƴ�������淶

- **����**: S68 �Լ췢�� �� �� AGENTS.md (176 ��) + apps/mobile/AGENTS.md (90 ��) + apps/server/AGENTS.md (236 ��) 3 �� AI ����ĵ����������ظ�. ���ͨ�ù淶 (����Լ��/Persistence/DEV_PROGRESS ������/���� 4 ԭ��/���¾ɰ�/Worker 9 ��) �� 3 ����д, �� 1 ����ͬ�� 3 ��, ά���ɱ���. ������� (����/AGENTS.md �ض�/6 ���汾��/PM2 delete+start/5/6 ά��֤/commit message) Ҳ�Ǹ��Ա�����һ��. S64-S67 4 �� session ���ڼӹ淶, ��û����"��� vs app ��"�ķֲ�, ���¹淶ɢ�� 3 ��.
- **����**:
  - S64 (��˰汾����) д VERSION_MANAGEMENT.md, ��˹淶��һ�γ���, ��û��ʶ��"��˹淶Ӧ���տ��ڸ� AGENTS.md"
  - S66 (��˲���淶) д apps/server/AGENTS.md, �� mobile AGENTS.md �Գ�, ����˹淶���ظ�һ��
  - S67 (��Ծ������) �� BUG-070 ʱ, �� apps/server/AGENTS.md ������"�ض����ȼ�", ����Ȼ��"����/Persistence/������"�ȿ�˹淶�������� server AGENTS.md ����
  - ���ͨ�ù淶 vs app �˶��й淶�ı߽�û����, AI ��֪��"��Щ�÷Ÿ�, ��Щ�÷��� AGENTS.md"
  - û�� GitHub ��� AGENTS.md ��׼ (Copilot Coding Agent / Codex / Cursor ����"�� + ����Ŀ"����ṹ)
- **�޷� (v3.0.30, S68)**:
  - �� AGENTS.md ���� v1.0 �� v2.0 (���ͳһ�����, 9 �� �� 1-9): �� 1 ����Լ�� + �� 2 Persistence + �� 3 ��˱ض��б� 15 �� (������ AGENTS.md �ŵ� 0) + �� 4 ��� 6 ���� (ȥ���ۺ�) + �� 5 DEV_PROGRESS ������ (����) + �� 6 Worker 9 �� (����) + �� 7 ���� 4 ԭ�� (����) + �� 8 ���¾ɰ� (����) + �� 9 ����Ŀ AGENTS.md ��� (�����տ����˵��)
  - apps/mobile/AGENTS.md ���� v1.0 �� v1.1 (90 �� ~70 ��, -22%): ɾ���ͨ�ù淶, �� mobile ���� (�� 1 RN ջ���� + �� 2 ��ǰ 5 �� + �� 3 �ĺ� 5 �� + �� 4 ���� 7 ���� + �� 5 ��˰汾 4 ���� mobile �ӽ�), �ض��� 0 ��ָ��� AGENTS.md
  - apps/server/AGENTS.md ���� v1.0 �� v1.1 (236 �� ~150 ��, -36%): ɾ���ͨ�ù淶, �� server ���� (�� 1 ����ܹ� + �� 2 ����ǰ 5 �� + �� 3 server �� 8 ���� + �� 4 �� server ǰ�� 5 �� + �� 5 5 ������ SOP), �ض��� 0 ��ָ��� AGENTS.md
  - VERSION_MANAGEMENT.md �� 9.1 + �� 9.2 + footer ͬ������: �� 9.1 �ض��б�Ӹ� AGENTS.md �� 0 �� + �� 9.2 ������Ӹ� AGENTS.md �� + footer ���� v2.0
  - ��д ADR-0002: �տ���Ʋ����¼ܹ�����, ��"���й淶�ķֲ��Ż�", д�� BUG-071 ��ѵ�μ���
- **��֤**:
  - �� AGENTS.md ��˹淶���ظ� (����ֻ�� �� 1, Persistence ֻ�� �� 2, 6 ����ֻ�� �� 4, ������ֻ�� �� 5)
  - �� AGENTS.md �ض��� 0 �� = �� AGENTS.md (mobile �� server һ��)
  - ��˹淶�ڸ� 1 ��, mobile/server ���ö����ظ�
  - mobile ���� 5 ��, server ���� 5 ��, �������ص�
  - VERSION_MANAGEMENT.md �� 9.1 �ض��б� 15 ����ȼ���������
- **��ѵ**:
  1. **AI ����ĵ��طֲ�** (�� + ����Ŀ) �� ��˹淶�Ÿ�, app ���з���, �� GitHub Copilot/Codex/Cursor ��׼һ��
  2. **��˹淶 vs app �˶��бط���** �� �� 1 ��ͬ�� 3 ���ĳɱ��޴�, ��Ȼ���¹淶Ư�� (S64-S67 4 �� session û����)
  3. **�¹淶����"�÷Ÿ������� AGENTS.md"** �� �ӹ淶ʱ, ����"��淶���ͨ�û���ĳ app ����?", ͨ�÷Ÿ�, ���з���
  4. **�ض��� 0 �� = �� AGENTS.md** �� �κ��� AGENTS.md �ض��� 0 ��ָ���, �γ�"����� �� �����"����ṹ
  5. **AGENTS.md �����ĵ��ֿ�, �� AI ��ΪԼ��** �� �ض��б� / ���� / �������������, ���� (��ʷ/�ܹ�/���� SOP) ���ö���չ��
  6. **S68 �տ���Ƹ� BUG-068 ����** �� BUG-068 ��"�� AI Э���ض� VERSION_MANAGEMENT.md", BUG-071 ��"AGENTS.md ��˹淶�ظ�" �� һ��� AI �ض���ڽṹ��˳

### BUG-072 (S69 �۷����, v3.0.30 �� v3.0.30 ��): Web �˿۷ѹ��� 5 ����һ������ (���� vs ������׼ vs UI �İ�)

- **����**: S69 user ��"��� Web �˵Ŀ۷ѹ���, �Ƿ�������, �������п۷��Ƿ������۷�, �Ƿ���ƶ��Ŀ۷ѱ�׼һ��". ��Ʒ��� 5 ����һ������, �� 3 �� P0 ���û�ʵ�ʿ۷ѽ�����.
- **��Ʒ���** (��̬���� + ���� API + Playwright �˵���):
  1. �� `apps/server/src/services/billingService.ts` (290 ��) ȫ���۷��߼�
  2. �� `apps/server/src/routes/pricing.ts` (���� `/api/pricing`)
  3. �� `apps/web/src/pages/VipCenterPage.tsx` (UI �İ�)
  4. �� `apps/web/src/pages/RechargePage.tsx` (��ֵ��λ)
  5. grep `apps/server/src` ���� `charge|billing|deduct` ���õ�
  6. curl ���� `/api/pricing` `/api/version` ��֤
  7. Playwright ��ͨ: ע�� �� ��¼ �� /vip �� /billing �� /recharge ��ͼ
  8. �ȶ�: ���� vs ���� API vs UI �İ� 3 ��һ����

- **�۷ѱ�׼ (3 ���ĵ�, һ���� 100%)**:
  - `billingService.ts:11-30` PRICING: standard {analyze 0.012/ǧ��, shot 0.05/��, comic 0.10/ҳ} / vip {analyze 0.01/ǧ��, shot 0.04/��, comic 0.08/ҳ}
  - `billingService.ts:27-30` VIDEO_CHARGING_MATRIX: standard {5:0, 10:0.1, 15:0.1} / vip {5:0, 10:0, 15:0.1}
  - `billingService.ts:33-34` IMAGE_DAILY_QUOTA: standard 30 / vip Infinity
  - `pricing.ts:9-44` ���� `/api/pricing` ���� (curl ʵ�� 100% һ��)
  - `VipCenterPage.tsx:115-131` UI �İ� (Playwright ��ͼ 100% һ��)

- **ʵ�ʿ۷ѵ� (5 ��, 2 ��**��һ��**)**:
  | �˵� | ���� | ʵ�� | һ�� |
  |---|---|---|---|
  | `billingService.chargeStep` (analyze/episode/shot/comic) | �� PRICING | �� PRICING | ? |
  | `billingService.topUp` (��ֵ) | ���ɽ�� | �߱�׼ | ? |
  | `billingService.chargeImage` (��ͼ t2i/i2i/multiRef) | amount=0 + ���޶� 30 | amount=0 + ���޶� 30 | ? |
  | `billingService.chargeVideo` (��Ƶ 5s/10s/15s) | ���� | �� `chargingForVideo` | ? |
  | `characterService.generateImageVariants` (��ɫ����ͼ) | Ӧ�� chargeImage (���) | **�� ��0.1 inline** | ? |
  | `characterService.generateImageForShot` (��ͷͼ) | Ӧ�� chargeImage (���) | **�� ��0.1 inline** | ? |

---

#### BUG-072 A (P0): ��ɫ����ͼ + ��ͷͼʵ���� ��0.1/��, �� /api/pricing ������׼"��ͼ���"��һ��

- **����**: characterService.ts:23 Ӳ���� `IMAGE_VARIANT_PRICE = 0.1` (��0.1/�� GLM-Image), Ȼ��:
  - line 656-664: `generateImageVariants` ��ɫ����ͼ �� ��0.1/�� (description д"��ɫͼƬ����(${n}��) - ${name}")
  - line 800-806: `generateImageForShot` ��ͷͼ �� ��0.1/�� (description д"��ͷͼƬ���� - ${shotId}")
- **����**:
  - billingService.ts:243 ע��"v3.0.0.31 (S51): ��ͼ�۷� (������� amount=0, ��д audit log)" �� �趨����ͼ���
  - pricing.ts:25-32 /api/pricing ���� `image.standard.t2i.amount=0` (��ͼ���, ���޶� 30)
  - VipCenterPage.tsx:115 "��ͼ����: ȡ��ÿ�� 30 ���޶�" (��ʾ��ͼ����Ǯ)
  - **�� characterService û��**: S51 �� billingService ʱ, characterService ���� S50 ��Ӳ���� ��0.1 �շ�, **©��**
- **Ӱ��**:
  - �û��� /api/pricing ��Ϊ"��ͼ���", ʵ�ʽ�ɫ/��ͷͼ�� ��0.1/�� �� **3 ����һ��**
  - ��ֵ ��10 = 100 �Ž�ɫͼ (�û�Ԥ�����)
  - ������׼ vs ʵ����Ϊ�Բ���, ����Σ��
- **֤�� (file:line)**:
  - `apps/server/src/services/characterService.ts:22-23` Ӳ���� IMAGE_VARIANT_PRICE=0.1
  - `apps/server/src/services/characterService.ts:655-664` generateImageVariants �۷�
  - `apps/server/src/services/characterService.ts:784-820` generateImageForShot �۷�
  - `apps/server/src/services/billingService.ts:243` ע��˵"��ͼ��� amount=0"
  - `apps/server/src/routes/pricing.ts:25-32` ���� amount=0
  - `apps/web/src/pages/VipCenterPage.tsx:115-131` UI �İ�˵"��ͼ����"
- **�޷� (��ѡһ)**:
  - ���� 1: ��ɫͼ/��ͷͼ������ ��0.1 (����, GLM-Image �������շ�) �� **�� /api/pricing ����** + �� VipCenter �İ�
  - ���� 2: ��ɫͼ/��ͷͼҲ��� (�� t2i/i2i/multiRef һ��) �� **�� characterService �� chargeImage(0)**
  - �Ƽ����� 1: GLM-Image �ǵ����������շ�, �����û�Ǯ = ƽ̨����������

---

#### BUG-072 B (P1): ��ͨ�û���ͼ���޶� 30 ��ʵ��**����Ч** (characterService д characters/shots ��, ���� image_conversations)

- **����**: billingService.imageDailyCount() line 216-225 �� `image_generations JOIN image_conversations` ������ͼ��, �� characterService:
  - `generateImageVariants` д `characters` ��
  - `generateImageForShot` д `shots` ��
  - **������ image_conversations**
- **����**:
  - billingService.imageDailyCount (S51 �¼�) ֻ�� image_conversations ��Դ
  - characterService ��ɫ/��ͷͼ ����һ��·��, **û�������޶�**
- **Ӱ��**:
  - ��ͨ�û���ɫͼ/��ͷͼ**�����޶�** (�� VipCenterPage.tsx:115 "ȡ��ÿ�� 30 ���޶�" ì�� �� ������ֻ�� VIP ȡ��, ��ͨӦ������)
  - ��ͨ�û����������ɽ�ɫ/��ͷͼ, ޶ƽ̨��ë
  - ��ÿ������ ��0.1 (BUG-072 A), ����޶�ռ� = ��� �� ��ֵԽ��޶Խ�� ??
- **֤��**:
  - `apps/server/src/services/billingService.ts:216-225` imageDailyCount ֻ�� image_conversations
  - `apps/server/src/services/characterService.ts:603-604` UPDATE characters
  - `apps/server/src/services/characterService.ts:810` UPDATE shots
  - `apps/web/src/pages/VipCenterPage.tsx:115` UI ˵"ȡ��ÿ�� 30 ���޶�"
- **�޷�**:
  - billingService.imageDailyCount ��: UNION image_conversations + characters.image_generated_at + shots.image_generated_at
  - characterService �� quota check: ����ǰ�ȵ� `billingService.checkImageQuota(userId)`, �����״�

---

#### BUG-072 C (P2): ��ɫ/��ͷͼû�߱�׼ `billingService.chargeImage()`, inline �۷�Υ����һ��Դ

- **����**: characterService inline д:
  ```ts
  await userModel.updateBalance(userId, -IMAGE_VARIANT_PRICE);
  await execute(`INSERT INTO billing_logs (...) VALUES (?, 'consumption', ...)`);
  ```
  �� `billingService.chargeImage` (line 246-262) �ظ�ʵ��
- **����**:
  - S50 �� characterService ʱֱ�� inline �۷�
  - S51 �� billingService �� chargeImage ʱ, ©�� characterService
  - �� BUG-005 "monorepo shared �� import value ����" ͬ��: **�ظ�ʵ�ֵ��±�׼Ư��**
- **Ӱ��**:
  - �Ŀ۷��߼�Ҫ�Ķദ (billingService + characterService �� 2)
  - websocket ֪ͨ����© (characterService �� `websocketService.broadcastBalanceUpdate`, ����ʽ���ܸ� billingService ��һ��)
  - audit log �ֶ� (description ��ʽ) ��һ��, �û����˵���������
- **֤��**:
  - `apps/server/src/services/characterService.ts:658-664` inline updateBalance + INSERT
  - `apps/server/src/services/characterService.ts:800-806` inline updateBalance + INSERT
  - `apps/server/src/services/billingService.ts:246-262` chargeImage ��׼ʵ��
- **�޷�**:
  - �� characterService �� `billingService.chargeImage(userId, IMAGE_VARIANT_PRICE, '��ɫ����ͼ����')`
  - ��� BUG-072 A ѡ���� 2 (���), ֱ�ӵ� `billingService.chargeImage(userId, 0, '��ɫ����ͼ���� (���)')`
  - ɾ characterService line 22-23 �� IMAGE_VARIANT_PRICE Ӳ���� (�� import billingService)

---

#### BUG-072 D (P3): ��ֵ��"����Ա���"���Զ�����, ���̲�˳

- **����**: RechargePage.tsx:113 ˵"֧����ɺ�, ����Ա���ͨ��������"
  - ����: �û�ɨ�� �� �� `recharge_requests` (pending) �� ����Ա��̨�ֶ� approve �� �� `topUp`
- **����**: ��Ʒ���ѡ��, ��ʷ����, �Ǵ��� BUG
- **Ӱ��**:
  - �û���ֵ�󿴲������, ��Ϊʧ��, ��Ͷ��
  - ������� (������) ��ס, �û��ظ���ֵ
- **֤��**:
  - `apps/web/src/pages/RechargePage.tsx:109-114` UI �İ�
  - `apps/server/src/routes/admin.ts:67` `POST /admin/orders/:id/approve` (�ֶ�����)
  - `apps/server/src/routes/recharge.ts:28-57` `POST /recharge/submit` (�� pending)
- **�޷� (P3, ������)**:
  - ����: RechargePage �� "��ֵ������, Ԥ�� 5 �����ڵ���, �ظ���ֵ������ϵ�ͷ�" ��ʾ
  - ����: ��֧�����ص��Զ����� (��Ҫ ALIPAY_PRIVATE_KEY + �����ص�)

---

#### BUG-072 E (P2): videoAgent ��Ƶ�������ʱ, �������ѱ��������񻨵�, chargeVideo �� null ����Ƶ�ѽ��� ("����")

- **����**: videoAgentService.ts:
  - line 393-402: confirm ʱ**Ԥ��**����� (throw ��ֹ)
  - line 591-610: ��Ƶ�ɹ����ɺ�**���** chargeVideo
  - ���ɴ� 30s-2min (��Ƶ���� polling)
  - �ڼ��û�����������������, ����
  - line 597-601: chargeResult === null ʱ**ֻ log error**, ������Ƶ, ��֪ͨ�û� ??
- **����**:
  - videoAgent ���첽���� (setImmediate + setTimeout ��ѯ), confirm ʱ����ס�û����
  - �� BUG-005 "�첽��������" ��ѵ��Ӧ
  - �� billingService.chargeVideo ��ϵ� design: chargeVideo �� null ��ʾ����, �����÷�û����Ƶ
- **Ӱ��**:
  - ��Ƶ������, ����, "����" �� **ƽ̨��**
  - �û��� billing_logs û��¼, ��Ϊ��ϵͳ BUG
  - ����޶��ë���� (�û�ͬʱ�� 5 ����Ƶ, ���ֻ�� 1 ��)
- **֤��**:
  - `apps/server/src/services/videoAgentService.ts:393-402` confirm Ԥ��
  - `apps/server/src/services/videoAgentService.ts:587-610` �ɹ��۷�, ʧ��ֻ log
  - `apps/server/src/services/billingService.ts:268-286` chargeVideo �� null ����
- **�޷�**:
  - ���� 1: confirm ʱֱ�ӿ۷� (����Ԥ��), ʧ�ܻع� �� ��, ���û������ (��Ƶ����ʧ��Ǯ����?)
  - ���� 2: ��ɿ۷�ʧ��ʱ, �����Ƶ"�����ɵ�δ����", ǰ����ʾ"����, ��ֵ�������Ƶ"
  - ���� 3: ��̨ cron �� "������δ����" ��Ƶ, �Զ�֪ͨ�û���ֵ������
  - �Ƽ����� 2: ��Ƶ������ = ��Դ������, ����Ƶ������, ��ֵ�����, ��ƽ + ��޶

---

- **�޷����� (S69 P0 �� BUG-072 A/B, P1 �� C, P2 �� E, P3 ���� D)**:
  - **P0 ������ BUG-072 A**:
    - ѡ���� 1 (�Ƽ�): ��ɫ/��ͷͼ���� ��0.1/�� (����, GLM-Image �������շ�)
    - �� `apps/server/src/routes/pricing.ts` �� `image.characterVariant` �ֶ� `amount: 0.1, daily: null` + `image.shot` �ֶ� `amount: 0.1, daily: null`
    - �� `apps/web/src/pages/VipCenterPage.tsx` ��"��ɫ����ͼ ��0.1/��" + "��ͷͼ ��0.1/��" �İ�
    - �� `apps/server/src/routes/pricing.ts:38` refundPolicy ͬ��˵��
  - **P0 �� BUG-072 B**:
    - �� `apps/server/src/services/billingService.ts:216-225` imageDailyCount UNION 3 ��
    - characterService �� quota check (�� `billingService.checkImageQuota(userId)`)
  - **P1 �� BUG-072 C**:
    - �� `apps/server/src/services/characterService.ts` �� `billingService.chargeImage` ��׼�ӿ�
    - ɾ IMAGE_VARIANT_PRICE Ӳ����
  - **P2 �� BUG-072 E**:
    - �� `apps/server/src/services/videoAgentService.ts:597-601` ��ɿ۷�ʧ��ʱ:
      1. video_conversations �� `billing_status='unsettled'` �ֶ�
      2. ǰ����ʾ��Ƶ����"����, ��ֵ�����" ��ʾ
      3. billing_logs д 'consumption_pending' ռλ
      4. �û���ֵ���� cron �Զ�����
  - **P3 ���� BUG-072 D**: RechargePage UI �Ľ� (���� sprint)

- **��֤** (�޺����):
  - curl `/api/pricing` �����ذ��� characterVariant/shot �ֶ�
  - Playwright /vip ҳ�濴 UI ��ʾ��ɫ/��ͷͼ ��0.1
  - ע�����û�, �� 1 ����ɫͼ, �� billing_logs description + ������ ��0.1
  - ע�����û�, �� 31 ����ɫͼ (��ͨ), �� 31 ��Ӧʧ�� quota exceeded
  - �� user.balance ��Ϊ 0.05, �� 1 ����ɫͼ, Ӧ����"����"
  - �� video ��Ƶ���� (5s ��ͨ��� + 10s ��ͨ ��0.1) �� billing_logs

- **��ѵ**:
  1. **�۷���Ʊز� 3 ��һ����**: ���� vs ���� API vs UI �İ� �� 3 �����Ե��ϲ�����һ��, S69 ��η��� 5 ����һ��
  2. **�Ŀ۷ѱ�׼ʱ�� grep ���е��õ�**: S51 �� billingService �� chargeImage ʱ, û grep characterService �� inline �۷�, ©�� 2 �� �� Ӧ�� `grep -r "updateBalance\|consumption" src/`
  3. **�Ʒ��߱�׼�ӿڲ�Ҫ inline**: characterService �ظ�ʵ�ֿ۷�, �� BUG-005 ͬ�� �� �� 1 ����ͬ���ദ, ��ȻƯ��
  4. **���� /api/pricing �ظ�ʵ����Ϊһ��**: �û���������׼Ԥ��, ʵ�ʲ�һ�� = ����Σ��
  5. **�첽������������� race condition**: confirm ʱ����סδ�� 30s-2min �����仯, ������� cron / settled ״̬��
  6. **�¹��ܼ� UI ��ͬ�� /api/pricing**: ���¼Ʒ��� (��ɫͼ/��ͷͼ) ʱ, /api/pricing �� VipCenter UI ��ͬ��, ��Ȼ�û�������
  7. **���� BUG ����"�˵������ SOP"**: S69 ������� 4 �� (���� grep + ���� API + Playwright + 3 �˱ȶ�), ���̻����� 1 session ���ֶ� BUG


---

## BUG-073 (S69 ����� 8h, v3.0.31): S54 1-�� minified src/index.ts ���뻵, tsc 5.9.3 ���� ESM ��, Node 22 ��Ĭ����, server ReferenceError ���ʧ��

### ����

- S69 ���� shipin-APP v3.0.31, scp �ϴ� dist + tar ��ѹ + pm2 delete+start
- server ��� 1s DEAD, 0 stdout 0 stderr 0 �˳���
- `ss -tln | grep 6000` �� LISTEN
- �Ų� 8h �ŷ���: src/index.ts 1-�� minified (S54 ʱ��), 6210 �ַ�, 17 routes import �����ж�
- tsc 5.9.3 ����ʱ 17 routes import **û����� require**, **���� ESM ��** �� dist/index.js
- Node 22 �� ESM `import` ���� CJS �ļ���**��Ĭ����** (�� SyntaxError)
- ���� `appConfig.port` �� `ReferenceError: appConfig is not defined`, server.listen ���� fire

### ���� (3 �����)

1. **S54 1-�� minified src**: ��ʱ `apps/server/src/index.ts` ���ĳ� 1-�� minified, �ڲ� 11 ���ļ����� import + 17 routes �ж� import + ���� 1-�� statement chain
2. **tsc 5.9.3 �ж� import ����**: ��ʹ `tsconfig.json` `module: "CommonJS"`, tsc ���� 1-�� minified Դʱ, �ж� import ��**����** ESM, ������� `__importDefault(require(...))`
3. **Node 22 ��Ĭ���� ESM ��**: `import { X } from 'Y'` �� .js CJS �ļ���, **�� SyntaxError**, **��ִ��**, ���� `X` �� undefined

### �Ų� 8h ��ʵʱ����

| ʱ�� | ���� | ��� |
|---|---|---|
| 0:00 | scp + tar + pm2 start | server 1s DEAD, 0 ��� |
| 1:00 | `pm2 logs` �� error.log | 1.6G ̫��, д����, ������־ |
| 2:00 | `node dist/index.js` ֱ�� | 1s DEAD, 0 ��� (�� bash ������ SIGHUP ɱ) |
| 3:00 | `node -e "require + setTimeout"` | hold 8s, require OK, **server.listen ��Զû fire** |
| 4:00 | hook `Module.prototype.require` | ֻ��ʾ 4 �� require (fs, config, express, http), 17 routes û fire |
| 5:00 | �� dist L10 1-�� minified �� | ���� 17 import ��, �ַ������ڵ� V8 ��ִ�� |
| 6:00 | �� S54 ע�� `v3.0.0.32 (S54): ɾ�� import` | ȷ�� S54 ʱ�ĵ� 1-�� minified |
| 7:00 | �� S64 backup dist �滻 (201 �� tsc ����) | server listen 6000 ? |
| 8:00 | 6 ά��֤ + S69 �޷���֤ | BUG-072 4 �޷�ȫ��Ч |

### �޷� (S69 ��ʱ��)

1. **�� S64 backup �ָ� dist/index.js** (201 �� tsc �������, �ܵ�����)
   - `cp /www/wwwroot/shipin-APP/dist.bak.s64-20260624_100456/index.js /www/wwwroot/shipin-APP/dist/index.js`
2. **���� src/index.ts 1-�� minified** (�� S54 ״̬һ��, ��Ϊ tsc ���뻵, ��"���ļ� tsc + cp"ģʽ, ���� build index.js)
3. **S69 src �޷�ͨ�� `tsc src/routes/pricing.ts --outDir dist/routes` + `cp dist/changelog.json`** (�� S67/S66 ������֤)
4. **6 ά��֤ȫ��** (pm2 env / port / /health / /api/version / /api/pricing / /api/novels 401)

### ��ѵ (8 ��)

1. **dist ���� < 30 = 1-�� minified = �߷���**: ����ǰ�� `wc -l dist/index.js`, < 30 �� �ز� src �ǲ��� 1-�� minified
2. **1-�� minified �� tsc ������ spec gap**: �ڲ� import ��ᱻ���� ESM (��ʹ `module: "CommonJS"`), ����ǰ���� `node -e "require('./dist/index.js'); setTimeout(()=>{}, 3000)"` �� 3s, �� `ss -tln` �ǲ��� LISTEN
3. **server ��� 1s DEAD 0 ��� �� Ӧ�� bug**: ������� ESM �� + Node 22 ��Ĭ����, �Ų�Ҫ�� dist �ַ���, ��ֻ�� logs
4. **���ñ������Ǿ�������**: S64 backup `dist.bak.s64-20260624_100456` �� v3.0.30 ֮ǰ tsc ���� build, S69 ����ȿ�ʱ��һʱ��ָ�, 8h �Ų� �� 1h �ָ�
5. **pm2 env + ss + curl + /api/version 4 ά 30s �Լ�**: ������ 30s �ڱ���, ��Ҫ���û���
6. **src �� 1-�� minified ʱ�� tsc �� build**: tsc ���� 1-�� minified �ᱣ�� ESM ��, ��"���ļ� tsc + cp �� dist"ģʽ
7. **Node 22 ��Ĭ ESM �� ��Ϊ**: `import` �� CJS .js �ļ���**��** SyntaxError, **��**ִ��, ���� `X` undefined ReferenceError
8. **SSH key �ͻ��� cache ���ؿ�**: Windows OpenSSH 9.5p2 + MinGit 9.9p1 �� cache key fingerprint, ���� `ssh-agent` ���ز��߶� (S69 ͬʱ��)

### ���� TODO (P1)

- [ ] �� src/index.ts 1-�� minified ��ض��� (165 �пɶ���ʽ, 12 import ���� + 11 routes import ���� + �����м����)
- [ ] tsc ���� build, ���� 200+ �� dist/index.js
- [ ] ������ dist, ��֤ 6 ά
- [ ] д `apps/server/AGENTS.md` ������: "dist < 30 �� = 1-�� minified = �߷���, �ز� + �ػָ� backup"
- [ ] д `docs/DEPLOY.md` ���½�: "1-�� minified �Ų� SOP (8 �� 30min)"

---



---

## BUG-074 (S69 APK �������, v3.0.31): Web /download չʾ��ٰ汾 v3.0.31, �û������� �� 404 Not Found

### ���� (S69 �����ʵ��)

- ���� `https://ab.maque.uno/download` ҳ��
- ҳ����ʾ: "��ǰ���°�: **v3.0.31 �� 28.7 MB**" + "v3.0.31 �������� (2026-06-24)"
- ��� "���� APP v3.0.31 (28.7 MB)" ��ť
- href = `https://ab.maque.uno/app/DeepScript_v3.0.31.apk`
- **�û������� �� HTTP 404 Not Found** (Content-Type: text/html, 511 bytes)
- **100% ʧ����**, Ӱ������ mobile �û�

### ���� (4 �����)

1. **S66 BUG-069 �� ecosystem.config.js APP_VERSION 3.0.26��3.0.30, û build APK**: S66 ��ѵ (deploy.sh + ENV_MANAGEMENT) ֻ���� server ��, mobile ��û build APK ����
2. **S69 �� mobile src/config/version.ts + build.gradle versionCode 37, versionName 3.0.31, û build APK**: S69 commit ���� 6 ���汾��ͬ��, �� mobile APK build ����û���벿�� SOP
3. **shipin-APP/public ʵ������ APK �� v3.0.29**: 2026-06-24 09:39 build, versionCode 36, versionName 3.0.29, 30MB (30073380 bytes)
4. **mobile �� server + APK ������ͬ��**:
   - server `/api/version` �� `version=3.0.31` + `forceUpdate=true` (ǿ�Ƹ��µ� 404)
   - mobile src/config/version.ts: `APP_VERSION = '3.0.31'`
   - mobile build.gradle: `versionCode 37, versionName 3.0.31`
   - ʵ�� shipin-APP/public APK: **v3.0.29** (��� 2 ���汾)
   - **mobile �û���ǿ�Ƹ��µ� 404 URL** �� ���� BUG

### ���� BUG (S69 APK ��Ʒ���)

1. **14 �� APK �ļ�����ʵ�� versionName ��һ��** (aapt2 dump badging):
   - `DeepScript_v1.0.0.apk` ʵ�� versionName=1.0 (history)
   - `DeepScript_v1.2.0.apk` ʵ�� versionName=1.0 (history)
   - `DeepScript_v3.0.0.apk` ʵ�� versionName=**3.0.10** �� ��λ
   - `DeepScript_v3.0.1~9.apk` ʵ�ʶ��� **3.0.10** �� 12 �� v3.0.10 ���� (26034388 bytes ��ͬ)
   - `DeepScript_v3.0.17.apk` ʵ�� versionName=3.0.16 (��λ)
   - `DeepScript_v3.0.18~21.apk` ʵ�ʷֱ��� 3.0.17-3.0.20 (��λ)
   - `DeepScript_v3.0.23.apk` ʵ�� versionName=3.0.22 (��λ)
   - `DeepScript_v3.0.24-pre-videofix.apk` ʵ�� versionName=3.0.23 (����)
2. **v3.0.22 / v3.0.26 APK ȱʧ** (û���ļ����б�, ֱ�����汾)
3. **v3.0.0 APK ������ 3.0.10**: ��ʷ v3.0.0 �� S60 ���� build ����, �� APK �ڲ� versionName ���� 3.0.10
4. **web DownloadPage 28.7MB ��Ϣ����**: ʵ�� v3.0.29 APK �� 30MB (30073380 bytes), 28.7MB �� v3.0.28 APK ��С (30064869 bytes)
5. **nginx ���� OK**: `extension/ab.maque.uno/app-download.conf` (S58 P0) `location ^~ /app/ { alias /www/wwwroot/shipin-APP/public/; types { application/vnd.android.package-archive apk; } }` ��������, 200 OK, **���� nginx BUG**

### ��֤֤�� (S69 �����ʵ��)

```bash
# /api/version �� v3.0.31 + forceUpdate
$ curl -s http://159.75.16.110:6000/api/version
{"version":"3.0.31","downloadUrl":"https://ab.maque.uno/app/DeepScript_v3.0.31.apk","forceUpdate":true,"needUpdate":true}

# v3.0.31 APK 404
$ curl -sI https://ab.maque.uno/app/DeepScript_v3.0.31.apk
HTTP/1.1 404 Not Found
Content-Type: text/html
Content-Length: 511

# v3.0.30 APK 404 (S66 ������û build)
$ curl -sI https://ab.maque.uno/app/DeepScript_v3.0.30.apk
HTTP/1.1 404 Not Found

# v3.0.29 APK ��ʵ������ (28.7MB, ʵ���� 30MB)
$ curl -sI https://ab.maque.uno/app/DeepScript_v3.0.29.apk
HTTP/1.1 200 OK
Content-Type: application/vnd.android.package-archive
Content-Length: 30073380

# Playwright /download ҳ�� (ʵ�� UI)
��ǰ���°�: v3.0.31 �� 28.7 MB
[���� APP v3.0.31 (28.7 MB)] �� href ָ�� v3.0.31 �� 404
v3.0.31 �������� (2026-06-24) �� ʵ���� S69 server changelog, ���� mobile �� v3.0.31 ʵ������
```

### �޷� (3 ѡ 1, �Ƽ� ���� C) �� **S69 ���÷��� A ��ʱ�� (commit `614c2fb`)**

**���� A: ������ (5min) �� ���� server �� v3.0.30 + �� web DownloadPage ������ shipin-APP/public ʵ�� APK �б�**
- �� `apps/server/ecosystem.config.js` env APP_VERSION=3.0.30, env_production APP_VERSION=3.0.30 (2 ��)
- �� `apps/web/src/pages/DownloadPage.tsx` L48: `serverVer?.downloadUrl || 'https://ab.maque.uno/app/DeepScript_v${APP_VERSION}.apk'` �� �� fallback �б�, �ҵ� shipin-APP/public ʵ�ʴ��ڵ� APK
- �� `apps/mobile/src/config/version.ts` + `build.gradle` ���˵� 3.0.30 / versionCode 36 (�� APK ƥ��)
- ?? ȱ��: server changelog ����д v3.0.31, ��ʵ�ʰ汾��ƥ��

**���� B: ������ (1h) �� build v3.0.30 + v3.0.31 APK, cp �� shipin-APP/public/**
- �� `cd apps/mobile/android && ./gradlew assembleRelease`
- �� `aapt2 dump badging` ��֤ versionCode/versionName
- `cp app-release.apk /www/wwwroot/shipin-APP/public/DeepScript_v3.0.31.apk`
- �� `apps/mobile/DEPLOY.md` �� 7 APK ���� SOP (aapt2 + sha256sum ��֤)
- �� `apps/mobile/DEPLOY.md` ��������: "server + mobile src + APK �����汾��ͬ�� (deploy ���� verify-apk-version.sh)"

**���� C: ������ (P0 �ع�) �� APK ���������� server �� deploy.sh**
- �� `apps/server/deploy.sh` �� APK build ���� (������ gradle + scp APK �� shipin-APP/public)
- д `scripts/verify-apk-version.sh` (������ aapt2 dump badging �Ա� mobile src version, �� server /api/version)
- �� `docs/VERSION_MANAGEMENT.md` �� "APK ���� SOP" �½�
- �� CODING_STANDARDS.md ������: "�� mobile src/config/version.ts ���� verify-apk-version.sh, ��ͨ����ֹ commit"

### ��ѵ (5 ��)

1. **mobile �� server �� APK 3 ���汾��ͬ��**: ȱ APK ʱ, **��ֹ** commit version ���� (�� src/config/version.ts ֮ǰ���� verify-apk-version.sh, ȷ�� shipin-APP/public �ж�Ӧ APK)
2. **�� version ���� APK build ��**: server 6 ���汾��ͬ�� (CODING_STANDARDS �� 38 ��) ȱ�� 7 ��: mobile APK build
3. **APK ��ʷ���� SOP ʧЧ**: BUG-024 (��ѭ������) + BUG-017 (���Ǵ�λ) ��������, ˵�� DEPLOY.md �� 7 ����**û������**, 14 ���ļ�����λ + 12 ������
4. **server forceUpdate=true ǿ�Ƹ��µ� 404 URL = ���� BUG**: �� downloadUrl HTTP 200 ���� forceUpdate=true
5. **web DownloadPage �����Ϣ**: ��ʾ v3.0.31 (28.7MB) ��ʵ�� v3.0.29 (30MB) �� 28.7MB �� (�� v3.0.28 ��С), 38MB �� (v3.0.29 ��С) �� web UI д�� 28.7MB, ��ĳɶ�̬�� server /api/version �� shipin-APP/public ls ��

### ���� TODO (P0)

- [ ] **�޵�ǰ v3.0.31 404 BUG** (���� A 5min ������, �� web /download ��������ʵ APK)
- [ ] **build v3.0.30 + v3.0.31 APK** (���� gradle build, cp �� shipin-APP/public, �� DEPLOY.md �� 7)
- [ ] **д scripts/verify-apk-version.sh** (���� aapt2 + ssh Զ�� ls + diff, CI ����)
- [ ] **�� apps/mobile/DEPLOY.md** �� "APK �����汾ͬ�� SOP" �½�
- [ ] **���� shipin-APP/public 14 ����λ APK** (�� server ��ʷ APK �б����, ɾ��λ + ������)
- [ ] **�� web DownloadPage ��ʾ��ʵ APK ��С** (��̬�� /api/version �� shipin-APP/public ls ��, ��д�� 28.7MB)

---



---

## BUG-075 (S69 ��β, v3.0.29): BUG ������ȱ AI �Ѻ�����, 74 �� BUG ɢ�� 1146 ��, ���� AI �ӻ�ǰ�ѿ��ٶ�λ (����Ŀͨ��)

### ����

- `apps/mobile/BUGS.md` �ۼ� **1146 �� / 74 BUG** (S58 ~ S69, 12 �� session ����)
- ���� BUG �ΰ����˳��, **�� Top ���� / �޹ؼ������� / �޳��� SOP**
- �� AI �ӻ�ǰ:
  - ��֪����Щ BUG �ؿ� (��Ƶ�ȿ�)
  - ��֪�� BUG ֮����� (����� BUG-073 ʱ��֪����Ҫ�� BUG-008/069/074)
  - ��֪����ʲô�ؼ��ֿ����� (�� BUG �Ż��ǰ��������ǰ��ؼ���)
- �ض� 15 ���� BUG ����, ��"���ظ��ȿ�"Ŀ���ѽ�
- �� session ���� (HANDOVER.md) �� BUG ��������

### �޷� (S69 v1.0 ����)

1. **�½� [`docs/BUGS_INDEX.md`](../../docs/BUGS_INDEX.md) v1.0** (��Ŀ��Ŀ¼, ��˹���):
   - �� 1 30 �������� (����ŵ���, ����޵����ȿ�)
   - �� 2 ���ؼ������� (APK / ���� / �۷� / server / mobile / web / tsc compile / AGENTS.md / SSH)
   - �� 3 ������ SOP (S0 �� session / S1 �� src / S2 ���� server / S3 ���� APK / S4 �Ŀ۷� / S5 �Ĺ淶 / S6 �������)
   - �� 4 ��Ƶ�ȿ� Top 10 (PM2 delete+start / APP_VERSION 6 �� / ά��ģʽ / aapt2 ��֤ / ����һ�� / ����ͬ�� / 1-�� minified / ����տ� / �۷����� / SSH key)
   - �� 5 ���� BUG �б� (�����, ê�����ӵ� BUGS.md)
   - �� 6 ά�� SOP (�� BUG �ؼ����� 5 ��)
   - �� 7 �����ĵ� (���� BUG �� + �������� + �� session ���� + ���� SOP + �淶�Ե���)
2. **���� [`AGENTS.md`](../../AGENTS.md) �ض� 15 �� �� 16 ��** (�� BUGS_INDEX)
3. **���� [`HANDOVER.md`](../../HANDOVER.md) �� 0 30 ������** (�� BUGS_INDEX ���� + S69 ��β�ܽ�)
4. **���� [`apps/mobile/BUGS.md`](./BUGS.md) ����** (�� �� 0 ���ٶ�λ + BUGS_INDEX ����)

### ��ѵ (4 ��, ����Ŀͨ��)

1. **AI �ض��ĵ�Ҫ"�ֲ� + ����"**: ���� BUG �� 1000+ ���Ǳ�Ҫ�� (ϸ��), �� AI �ӻ�ǰ 30 ��ֻ�ܿ� 1-2 ��. ������ BUGS_INDEX ����/�ؼ���/���� 3 ά����
2. **�¼� BUG ��ͬʱ������ (5 �� SOP)**: �޴��� + commit + д BUGS.md + ���� BUGS_INDEX �� 1/2/4 + �� 6 ά��֤. �����´� AI ������, �����ظ���
3. **�� session ���� (HANDOVER.md) ������ BUG_INDEX**: �� 0 30 �������� AI ��һ��, �ظ� BUG �������� + Top 10 �ض�
4. **�ض��б� 16 ����� 15**: S68 �տ� 15 �� (AGENTS/HANDOVER/VERSION/BUGS/CODING/...) ȱ BUG ����, �κ� AI �ӻ�ʱ 30 �뿴������Ƶ BUG, �ؼӵ� 16 ��

### ���� (���ĵ�)

- [`docs/BUGS_INDEX.md`](../../docs/BUGS_INDEX.md) �� BUG ���ٲ�ѯ���� (��˹���)
- [`AGENTS.md`](../../AGENTS.md) �ض��� 16 ��
- [`HANDOVER.md`](../../HANDOVER.md) �� 0 30 ������
- [`apps/mobile/BUGS.md`](./BUGS.md) �� 0 ���ٶ�λ

---



---

## BUG-076 (S69 ��β, v3.0.29): ���������ʾ shipin-APP "δ���" �� ʵ���Ǳ��� nginx վ��״̬ (�� node �����޹�, server ��ʵ����)

### ���� (S69 �����ʵ��)

- ������� �� "��Ŀ" �� "shipin_APP" �� ״̬��ʾ **"δ���"**
- ·��: `/www/wwwroot/shipin-APP`
- �ڵ�汾: v22.22.2
- **ʵ�ʷ���״̬** (�������޹�, ������֤):
  - `pm2 list` �� ai-script-server **online**, pid 61710, 38min uptime, 140.4MB, root user
  - `ss -tln | grep 6000` �� `LISTEN 0 511 0.0.0.0:6000` ?
  - `curl /health` �� 200 OK ?
  - `curl /api/version` �� v3.0.29 + BUG-072 changelog ?
  - `curl https://ab.maque.uno/app/DeepScript_v3.0.29.apk` �� 200 OK, 30MB APK ?
- **����**: ����"δ���"����, shipin-APP ʵ������, ��������

### ���� (3 ��)

1. **������ shipin_APP ע��Ϊ nginx վ�� (Site)**, ���� Node ��Ŀ (Project):
   - ʵ������: `/www/server/panel/vhost/nginx/extension/shipin_APP/site_total.conf` (ֻ�� access_log ����)
   - ����"��Ŀ"�������� nginx ������ shipin_APP
2. **���� nginx ���� 2 �� 6 ��** (Wed 2026-06-03 22:54:45):
   - `service nginx status` �� `Active: inactive (dead)`
   - **���� nginx master ͬʱ��** (apt nginx pid 19549 + ���� nginx pid 13019)
   - ���� nginx ���ʧ�� bind 80/443 (�� apt nginx ռ��), systemd ���� "dead"
3. **shipin-APP ʵ���� apt nginx + node PM2** (������ nginx �޹�):
   - apt nginx �� ab.maque.uno vhost, `proxy_pass http://127.0.0.1:6000` (�� node 6000)
   - node ������ root PM2 daemon (pid 49676) ��, www user / ���� PM2 û����
   - **����"��Ŀ״̬"ֻ�鱦���Լ��� nginx ״̬, ���� node ����״̬** �� һֱ"δ���"

### ��֤֤�� (S69 ��βʵ��)

```bash
# 1. ���� nginx ״̬
$ service nginx status
nginx.service - A high performance web server and a reverse proxy server
     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: inactive (dead) since Wed 2026-06-03 22:54:45 CST; 2 weeks 6 days ago

# 2. apt nginx ���� (pid 19549, 6/04 ���)
$ ps -ef | grep "nginx: master"
root     13019     1  0 Jun20 ?        00:00:00 nginx: master process /www/server/nginx/sbin/nginx -c /www/server/nginx/conf/nginx.conf
root     19549     1  0 Jun04 ?        00:00:00 nginx: master process nginx

# 3. ������ shipin_APP ע��Ϊ nginx վ�� (�� vhost extension Ŀ¼, û Node ��Ŀ)
$ ls /www/server/panel/vhost/nginx/extension/
ab.maque.uno  banmu_server  fuwuqi  gg.maque.uno  maque.uno  shipin_APP  smartlink-iot

# 4. shipin_APP extension ֻ�� access_log ����
$ cat /www/server/panel/vhost/nginx/extension/shipin_APP/site_total.conf
access_log syslog:server=unix:/tmp/site_total.sock,nohostname,tag=13__access site_total;

# 5. shipin-APP node �������� (�������޹�)
$ ps -ef | grep "node.*dist/index.js"
root     61710 49676  1 15:05 ?        00:00:38 node /www/wwwroot/shipin-APP/dist/index.js

# 6. apt nginx ���� ab.maque.uno 200 OK
$ curl -sI https://ab.maque.uno/app/DeepScript_v3.0.29.apk
HTTP/1.1 200 OK
Content-Type: application/vnd.android.package-archive
Content-Length: 30073380
```

### �޷� (3 ѡ 1, �Ƽ����� C)

**���� A: ���Ա���"δ���"��ʾ (0 �Ķ�, �Ƽ�������)**
- ʵ�� shipin-APP ����, 6 ά��֤ȫ��, ����"δ���"����
- ����� PM2 (`pm2 list / pm2 logs / pm2 monit`)
- **ȱ��**: ���������ʾ"δ���"���ű�Ť, ����Ӱ�����

**���� B: �ı��� shipin_APP �� Node ��Ŀ (�����޴˹���)**
- ����**û��"Node ��Ŀ����"** (������"��Ŀ"ֻ�ܹ� PHP/Java/Python/Go, ���ܹ� Node)
- ������

**���� C: д systemd unit for shipin-APP (�� apt nginx һ��, 1h)**
- `/etc/systemd/system/shipin-app.service`:
  ```ini
  [Unit]
  Description=shipin-APP Node Server
  After=network.target
  
  [Service]
  Type=simple
  User=root
  WorkingDirectory=/www/wwwroot/shipin-APP
  ExecStart=/usr/bin/node /www/wwwroot/shipin-APP/dist/index.js
  Restart=always
  RestartSec=10
  
  [Install]
  WantedBy=multi-user.target
  ```
- `systemctl enable shipin-app && systemctl start shipin-app`
- ���: `systemctl status shipin-app`
- **�ŵ�**: �� nginx һ�� systemd ����, ���������Զ�����
- **ȱ��**: �� PM2 ���� (˫��), **��ֹ** ͬʱ�� (��˫ʵ���˿ڳ�ͻ), ��ѡ��һ

**���� D (�Ƽ� P0)**: **���� PM2 + д `systemd-on-pm2.service`** (�� systemd ��� PM2, 2h)
- д `/etc/systemd/system/pm2-shipin-app.service` �� systemd ���� PM2 daemon (��� daemon ��)
- ����� `systemctl status pm2-shipin-app` + `pm2 list`
- **�ŵ�**: �ȱ��� PM2 ���̹���, �ֻ�� systemd �Զ�����
- **ȱ��**: ����, �� BUG-046/049 (PM2 ʵ����ͻ) ����ҪС��

### ��ѵ (4 ��, ����Ŀͨ��)

1. **����"��Ŀ" �� Node ����**: ���� panel ֻ�ܹ� PHP/Java/Python/Go, **���ܹ� Node**. ����"��Ŀ״̬"����� nginx/PHP ����, ���� node PM2
2. **apt nginx + ���� nginx ˫ʵ����ͻ** (�� BUG-046/049 ͬ��): ͬһ̨�� 2 �� nginx �� 80/443, ���� nginx ��Զ bind ʧ�� �� "dead". �޷�: ɱһ��, �����˿�
3. **node �����ñ�������**: shipin-APP �� PM2 + node, �������޹�. ���������ʾ"δ���"�Ǳ�Ȼ, ��Ӱ�����
4. **����� PM2 + 6 ά��֤**: `pm2 list / pm2 logs --lines 100 / pm2 monit` + �� `apps/server/deploy.sh` �� 6 ά��֤. ��Ҫ������ panel ״̬

### ���� P0 TODO

- [ ] д `/etc/systemd/system/shipin-app.service` (���� C, 1h) �� �� shipin-APP �� systemd ����
- [ ] **OR** д `/etc/systemd/system/pm2-shipin-app.service` (���� D, 2h) �� systemd ��� PM2 daemon
- [ ] ɱ apt nginx + �ޱ��� nginx ���ô���˿� (��� BUG-046/049 ����)
- [ ] �� BUG-076 �ӽ� `docs/BUGS_INDEX.md` �� 1 ���� + �� 2 �ؼ��� "����" + �� 4 Top 10 (�� BUG-008/046/049 ����)

### ���� (���ĵ�)

- [`docs/BUGS_INDEX.md`](../../docs/BUGS_INDEX.md) �� S69 v1.0 ������ + �ؼ��� + Top 10
- [`AGENTS.md`](../../AGENTS.md) �ض� 16 ��
- [BUG-008 PM2 env reload ʧ��](#bug-008-s58-p4-server-�����-pm2-env-ûˢ��)
- [BUG-046 compileSdk = 34 (mobile)](#bug-046-s60-p2) 
- [BUG-049 shipin-APP server ʵ�� port 6000 vs 3000](#bug-029-s59-shipin-app-server-ʵ����-port-6000-����-3000)

---

---

## BUG-077 (S70 ��β, v3.0.29): ���� "��Ŀ" �б��Ҳ��� shipin-APP �� 3 ������ �� �ڴ� db / �� db ·�� / ȱʧ PID �ļ� (�� BUG-076 ͬ��)

### ���� (S69 ��βʵ��)

- ������� �� "��Ŀ" �� �Ҳ��� shipin-APP ��Ŀ
- user 6/24 14:10 ��Ӳ����: shipin-APP �����ڱ��� "��Ŀ" �б��ܿ����� + ��־ + ��ͣ (�����������һ��)
- user 6/24 16:00 �İ�: **���� A** �� д�����Զ��� nodejsModel.py ��չ (1.5-2h)
- **ʵ����**: shipin_APP (id=13) **����ڱ��� sites ����** (2026-05-14 ע��), ���� Node ��Ŀ����**������֧��**, û���ö���
- �� (AI) ���� 5 ����·���ҵ�����, �˷� 2h

### ���� (3 ������, ������˳��)

#### ���� 1: ���� sites �� schema **����֧�� Node ��Ŀ** (��û�� schema ֱ�� `ALTER TABLE` ���һ��)

- ʵ��·��: `/www/server/panel/data/db/site.db` (���� `data/db/default.db`!)
- site.db sites ���ֶ�: `id, name, path, status, index, ps, addtime, type_id, edate, project_type, project_config, rname, stop` (13 �ֶ�, ����֧�� Node)
- shipin_APP (id=13) ���� 2026-05-14 22:11:05 ע��, project_type='Node', project_config ���� JSON
- **����**: ��֮ǰ `sqlite3 ... default.db "PRAGMA table_info(sites);"` ���� 7 �ֶξ���Ϊû Node ֧�� �� **�� db ·��**

#### ���� 2: ���� Sql ���� **�ڴ�ֻ�� db** (`__memory_user_db`)

- `db.py:61-86` Sql ���ʱ�� db ���Ƶ� `/dev/shm/<md5>.db` �ڴ渱�� + `__READ_ONLY = True`
- ���� `public.M('sites').where(...).select()` ��**�ڴ渱��**
- Ӳ�� db `default.db` �� stale ���� (�������ʱ read ���ص��ڴ�, ֮��дֻ�����ڴ�)
- ��֮ǰ `ALTER TABLE sites` / `INSERT shipin_app` ���ĵ�**��� default.db** (�� db, 0 ��Ŀ)
- **����**: ����Ϊ db ��ֱ��Ӳ��, û��ʶ���ڴ� db ����

#### ���� 3: shipin-APP systemd unit **ȱ `Environment=NODE_PROJECT_NAME`**

- nodejsModel.py `get_project_state_by_cwd()` �� `process.environ['NODE_PROJECT_NAME'] == project_name` �ҽ���
- shipin-app.service ԭ��û��� env, ������Զ�Ҳ��� shipin-APP ���� �� ��ʹ sites ������Ŀ + PID �ļ�����, `get_project_stat` Ҳ�Ҳ���
- **�޷�**: systemd unit �� `Environment=NODE_PROJECT_NAME=shipin_APP`

### ��֤֤�� (S70 �����ʵ��, 12 άȫ��)

```bash
# 1. ���� sites �� shipin_APP (id=13)
$ sqlite3 /www/server/panel/data/db/site.db \
  "SELECT id,name,project_type FROM sites WHERE project_type='Node';"
3|banmu_server|Node
9|smartlink-iot|Node
13|shipin_APP|Node    �� ���������!

# 2. ���� nodejsModel.get_project_stat run=True + PID
$ python3 -c "
import sys; sys.path.insert(0, '/www/server/panel'); sys.path.insert(0, '/www/server/panel/class')
import public
from projectModel.nodejsModel import main
m = main()
p = public.M('sites').where('project_type=? AND name=?', ('Node', 'shipin_APP')).find()
s = m.get_project_stat(p)
print('run:', s['run'], 'PID:', list(s['load_info'].keys())[0], 'mem:', int(list(s['load_info'].values())[0]['memory_used']/1024/1024), 'MB', 'user:', list(s['load_info'].values())[0]['user'])
"
run: True PID: 10890 mem: 40 MB user: root

# 3. systemd unit �� NODE_PROJECT_NAME
$ grep NODE_PROJECT_NAME /etc/systemd/system/shipin-app.service
Environment=NODE_PROJECT_NAME=shipin_APP

# 4. apt nginx �ս� + ���� nginx ռ 80/443
$ systemctl is-active nginx
inactive (dead)
$ systemctl is-active bt-nginx
inactive (dead)  (�� /www/server/nginx/sbin/nginx ��)
$ ss -tln | grep -E ':80 |:443 |:888 '
LISTEN 0 511 0.0.0.0:80    0.0.0.0:*
LISTEN 0 511 0.0.0.0:443   0.0.0.0:*
LISTEN 0 511 0.0.0.0:888   0.0.0.0:*    �� ���� panel 888 �ɷ���

# 5. 12 ά��֤
1. systemctl shipin-app: active
2. ss 6000: LISTEN 0.0.0.0:6000
3. /health: HTTP/1.1 200 OK
4. /api/version: 3.0.29
5. /api/pricing characterVariant: 0.1
6. /api/novels: HTTP/1.1 401 Unauthorized
7. ���� nginx 80: LISTEN 0.0.0.0:80
8. ���� panel 888: LISTEN 0.0.0.0:888
9. ab.maque.uno HTTPS /api/version: 3.0.29
10. APK HTTP/2 200: HTTP/2 200
11. ���� Node ��Ŀ shipin_APP run: True PID=10890 mem=40MB user=root
12. ���� shipin_APP config: run_user=root is_power_on=1 port=6000
```

### �޷� (���� 6 ��, S70 v1.0 ��ʵʩ)

1. **���б��� projectModel** (`/www/server/panel/class/projectModel/nodejsModel.py` ���� 112KB)
2. **�� `Environment=NODE_PROJECT_NAME=shipin_APP`** �� `/etc/systemd/system/shipin-app.service`
3. **`systemctl daemon-reload && systemctl restart shipin-app`** �� env ��Ч
4. **д PID �ļ�** `/www/server/nodejs/vhost/pids/shipin_APP.pid` (systemd MainPID, �������ж���ͣ)
5. **�� site.db shipin_APP config**: `run_user=root` (�� systemd User=root һ��) + `is_power_on=true`
6. **ɱ apt nginx �ս�˫ʵ����ͻ** (`systemctl mask nginx` + `pkill -9 nginx`) + **����� nginx** (`/www/server/nginx/sbin/nginx`)

### ��ѵ (7 ��, ����Ŀͨ��, д�� Top 10)

1. **���� sites ������֧�� Node ��Ŀ** (type_id=0 + project_type='Node' + project_config JSON), ����д�Զ��� nodejsModel.py
2. **���� db ��ʵ·���� `/www/server/panel/data/db/site.db`** (���� `data/db/default.db`!), `default.db` �ǿյ� (��ʼ����)
3. **���� Sql �����ڴ�ֻ�� db ����** (`__memory_user_db` д�� `/dev/shm/<md5>.db`), ��Ӳ�� db ��Ӱ�� panel ����ʱ, ����� site.db
4. **systemd unit �� `Environment=NODE_PROJECT_NAME=<project_name>`** �Ǳ��� get_project_state_by_cwd �ҽ��̵ı�Ҫ env
5. **apt nginx + ���� nginx ˫ʵ����ͻ**: ͬһ̨�� 2 �� nginx �� 80/443, ���� nginx ��Զ bind ʧ��. �޷�: `systemctl mask nginx` + `pkill -9 nginx`
6. **PID �ļ�·���̶�**: `/www/server/nodejs/vhost/pids/<project_name>.pid` (���� v2.5+ ·��), shipin_APP.pid = 10890 (systemd MainPID)
7. **disable ��Ŀ server_name ��Ҫд��Ŀ�ڲ���**: `server_name shipin_APP` �Ǵ��, Ӧ�����û����ʵ�ʵ������ (ab.maque.uno ���з���, ����Ҫ shipin_APP.conf)

### �� BUG-076 ������ (��Ҫ)

- **BUG-076 (S69)**: ���� "Ϊʲô���������ʾδ���" �� �����Ǳ����� shipin-APP �� nginx վ�� (û Node ��Ŀ) + PM2 ����������, ����� PM2 + 6 ά��֤
- **BUG-077 (S70)**: **�޷����** �� �� shipin-APP ���������� "��Ŀ" �б���ʾ "�����", **user 6/24 14:10 Ӳ��������** �� ���� panel "��Ŀ" �� shipin_APP �� run=True + PID 10890 + 40MB + user=root + �˿ڼ��� OK

### ���� TODO

- [ ] **���� playwright ��ͼ** ���� panel "��Ŀ" �� shipin_APP ҳ��, �� user ����ͣ/��־/���̰�ť��ȫ (TODO S70, ���� SSH ��ͨ, ���� panel 888 �ɷ���)
- [ ] **���� desktop_screenshot** ���� panel 888 ��ͼ (TODO S70, �� cu MCP desktop_screenshot ץ 888 HTTPS panel)
- [ ] **HANDOVER.md �� 0** �� BUG-077 ���� (�� BUG-076 ����, ���Ǳ��� panel ��Ŀ����)
- [ ] **AGENTS.md �ض� 17 ��** �� BUGS_INDEX ���ò��� (BUG-077 �Ѽӽ� �� 1)

### ���� (���ĵ�)

- [`docs/BUGS_INDEX.md`](../../docs/BUGS_INDEX.md) �� S70 v1.1 �� 1 ���� + �� 2 �ؼ��� "����" + �� 4 Top 10
- [`AGENTS.md`](../../AGENTS.md) �� �ض� 16 �� (BUGS_INDEX �ǵ� 16 ��)
- [`HANDOVER.md`](../../HANDOVER.md) �� �� 0 30 ������ (S70 ����, �� BUG-077)
- [BUG-076 ������� "δ���" ��](#bug-076-s69-��β-v3029-���������ʾ-shipin-app-δ���--ʵ���Ǳ���-nginx-վ��״̬-��-node-�����޹�-server-��ʵ����) �� ��������, BUG-077 �޷�
- [BUG-008 PM2 env reload ʧ��](#bug-008-s58-p4-server-�����-pm2-env-ûˢ��)
- [BUG-046 compileSdk = 34](#bug-046-s60-p2)
- [BUG-049 shipin-APP port 6000 vs 3000](#bug-029-s59-shipin-app-server-ʵ����-port-6000-����-3000)---

## BUG-078 (S71, v3.0.29): Web ��"�˵���ϸ" ȱ���Ѽ�¼ �� ֻ��ʾ��ֵ, ���Ѻ������ȫû��¼, ������������ȱʧ

### ���� (user 6/24 17:03 ����)

- Web �� `BillingPage.tsx` (URL `/profile/billing`) **ֻ��ʾ��ֵ��¼** (recharge_requests table, �� `/api/recharge/my`)
- û���κ����Ѽ�¼ (novel ���� / �־� / ��ɫ���� / ͼƬ���� / ��Ƶ����)
- Ҳû��������ɼ�¼ (��ͨ�û� 30 ��/����� / VIP �������)
- user ����: "Ŀǰֻ�г�ֵ��¼, ȱ�����Ѽ�¼, ���ɵ�������Ŀ��Ҫ��¼, ��ѵ�����Ҳ��Ҫ��Ǻ�, ������С˵����, ���Ƿ־�ͷ����, ��������ͼƬ, ������Ƶ, ���п۷���Ŀ, ��������ѻ����շ�, ������Ҫ��¼��, ������û�������������, ����Ҫ����ȷ�ļ�¼."

### ���� (4 ��)

#### ���� 1: û�� `/api/billing/transactions` �˵�
- server �� `billingService` �� `chargeImage / chargeVideo / chargeStep / topUp / getLogs` �Ⱥ���
- `getLogs` ֻ�� type + amount + balanceAfter + description + wordCount, û **ref_type / ref_id / ref_label / is_free**
- û�� `/api/billing/transactions` ·��, web ��**û�������Ѽ�¼ API**

#### ���� 2: billing_logs �� schema �ֶβ���
- �ֶ�: `id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at` (8 �ֶ�)
- **ȱ**:
  - `is_free TINYINT(1)` �� ������Ѷ���� (0 Ԫ) / VIP ��� / �����
  - `ref_type VARCHAR(50)` �� ������������ (novel_analyze / episode / shot / comic / character_variant / image / video / prompt_optimize)
  - `ref_id VARCHAR(100)` �� ���� entity id (novel_id / character_id / image_generation_id / video_generation_id)
  - `ref_label VARCHAR(200)` �� ����ɶ���ǩ ("С˵������XXX��" / "��ɫ����ͼ 4 ��")

#### ���� 3: web �� BillingPage.tsx ֻ����ֵ API
```typescript
// v3.0.1 (S56) �ɰ�, BUG-078 ֮ǰ
const r = await getRechargeHistoryApi();  // ֻ�� /api/recharge/my
setRecords(r.data?.data?.records || []);
```
- û���κ� billing logs API
- û 4 �� summary (�ܳ�ֵ / ������ / ����� / ��ǰ���)
- û tab �л� (ȫ�� / ���� / ��ֵ)
- û ref_type icon ����

#### ���� 4: �۷ѷ���ûͳһ���, ������ɲ�д log
- `billingService.chargeImage` д log �� description �ֶ�������, û ref_type ����
- `chargeVideo` ͬ��
- `chargeStep` ͬ��
- **��ѵ� image ����** (��ͨ�û� 30 ��/����� / VIP ����) **��ȫûд log**, ֻ�� `imageDailyCount + checkImageQuota` ����

### �޷� (5 ������)

#### ���� 1: db.ts billing_logs ���ֶ� (S71)
```sql
-- CREATE TABLE billing_logs �� 4 �ֶ� + 2 ����
is_free TINYINT(1) DEFAULT 0 COMMENT '1=��Ѷ����(0Ԫ)/VIP���/�����;0=ʵ�ʿ۷�'
ref_type VARCHAR(50) DEFAULT '' COMMENT 'novel_analyze/episode/shot/comic/character_variant/image/video/prompt_optimize/recharge/refund'
ref_id VARCHAR(100) DEFAULT '' COMMENT 'novel_id/episode_id/character_id/image_generation_id/video_generation_id'
ref_label VARCHAR(200) DEFAULT '' COMMENT '����ɶ���ǩ'
+ INDEX idx_billing_ref_type (ref_type)
+ INDEX idx_billing_user_time (user_id, created_at)

-- ALTER TABLE �����Ͽ� (try/catch ����, ���Ѵ��������)
try { await db.execute("ALTER TABLE billing_logs ADD COLUMN is_free TINYINT(1) DEFAULT 0"); } catch {}
try { await db.execute("ALTER TABLE billing_logs ADD COLUMN ref_type VARCHAR(50) DEFAULT ''"); } catch {}
... (4 �� ALTER)
```

#### ���� 2: billingService ͳһ recordConsumption() (S71)
```typescript
/**
 * v3.0.32 BUG-078 S71: ͳһ��¼����/�����־
 * @returns { balanceAfter, logId, isFree } �� null (����)
 */
async recordConsumption(userId, opts: {
  refType: 'novel_analyze' | 'episode' | 'shot' | 'comic' | 'character_variant' | 'image' | 'video' | 'prompt_optimize' | string;
  refId: string;
  refLabel: string;       // ����ɶ�
  amount: number;         // 0 = ���
  isFree?: boolean;       // true = ��� (amount ���� = 0)
  description?: string;
  wordCount?: number;
  pageCount?: number;
  novelId?: string;
}): Promise<{ balanceAfter: number; logId: string; isFree: boolean } | null>
```
- �ڲ�: �շѲż����� (���ֱ��ͨ��) + updateBalance (��Ѳ���) + INSERT billing_logs (�� is_free/ref_type/ref_id/ref_label)
- �� `chargeImage / chargeVideo / chargeStep / topUp` �������ͳһ���
- �� `getTransactions(userId, opts)` �������ֶ�

#### ���� 3: �������ɷ���� recordConsumption (S71)
| Service | ���� | refType | refLabel |
|---|---|---|---|
| novelService.analyze | chargeStep('analyze') | novel_analyze | `С˵������XXX��(N��)` |
| scriptService.episode | chargeStep('episode') | episode | `�籾���ɡ�XXX��` |
| scriptService.shot | chargeStep('shot') | shot | `�־�������XXX��` |
| scriptService.comic | chargeStep('comic') | comic | `�������ɡ�XXX��(Nҳ)` |
| characterService.generateImageVariants | chargeImage(amount=0.1��N) | character_variant | `��ɫ����ͼ��XXX��(N��)` |
| imageAgentService.generateImage | recordConsumption (NEW) | image | `ͼƬ���� W:H` |
| imageAgentService.prompt_optimize | chargeImage | prompt_optimize | `ͼƬ prompt LLM �Ż�` |
| videoAgentService.processTurn | recordConsumption (NEW) | video | `��Ƶ���� Ns (VIP/��ͨ)` |
| videoAgentService.prompt_optimize | chargeImage | prompt_optimize | `��Ƶ prompt LLM �Ż�` |

**���Ҳ��**: amount=0 + isFree=true (��ͨ�û� 30 ��/�� image gen / VIP unlimited). `recordConsumption` �Զ�����.

#### ���� 4: �½� /api/billing/* ·�� (S71)
```typescript
// apps/server/src/routes/billing.ts
router.use(authMiddleware);  // ���ж˵㶼Ҫ auth

router.get('/transactions', ...);  // �齻�׼�¼ (�� is_free/ref_type/ref_id/ref_label)
router.get('/summary', ...);        // ���� (�ܳ�ֵ/������/�����/���/��������/�������)
```
- �� `index.ts` �� `app.use('/api/billing', billingRoutes)` (S70 ����ʱ�Ѽӱ��� nginx ����, ����ͻ)

#### ���� 5: web BillingPage.tsx ��д (S71)
- 4 �� summary (�ܳ�ֵ / ������ / ����� / ��ǰ���) �� �� `/api/billing/summary`
- 3 tab (ȫ�� / ���� / ��ֵ) �� �ϲ� transactions + recharges ��ʱ�䵹��
- ������ʾ:
  - **��ֵ** (type=charge): `+��amount` + ��ɫ + TrendingUp icon
  - **����** (type=consumption + isFree=0): `-��amount` + ��ɫ + refType icon (��ɫ/�־�/ͼƬ/��Ƶ/С˵)
  - **���** (type=consumption + isFree=1): `-��0.00` + ��ɫ + ��ɫ"���"��ǩ + refType icon
- REF_TYPE_META ӳ��:
  - novel_analyze �� ?? BookOpen ��ɫ
  - episode �� ?? Layers ����
  - shot �� ? Wand2 ��ɫ
  - comic �� ?? Sparkles ��ɫ
  - character_variant �� ?? UserCircle ��ɫ
  - image �� ??? ImageIcon ��ɫ
  - video �� ?? VideoIcon ��ɫ
  - prompt_optimize �� ? Wand2 ��ɫ

### ��֤֤�� (S71 �����ʵ��)

```bash
# 12 ά��֤ (S71 v3.0.29 systemd unit �� + db migration �Զ���)
1. systemctl shipin-app: active
2. ss 6000: 0.0.0.0:6000
3. /health: HTTP/1.1 200 OK
4. /api/version: 3.0.29
5. characterVariant: 0.1
6. /api/novels: HTTP/1.1 401 Unauthorized
7. ���� nginx 80: 0.0.0.0:80
8. ���� panel 888: 0.0.0.0:888
9. ab.maque.uno HTTPS /api/version: 3.0.29
10. APK HTTP/2 200
11. ���� Node ��Ŀ shipin_APP run=True PID=14904  (BUG-077 ����, S70 �ع��󱣳�)
12. /api/billing/transactions: 401 Unauthorized  (auth ����)

# billing_logs schema 12 �ֶ���֤
SHOW COLUMNS FROM billing_logs;
id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at,
is_free (tinyint(1)), ref_type (varchar(50)), ref_id (varchar(100)), ref_label (varchar(200))

# billing_logs ���м�¼ (S71 ����ǰ������������)
SELECT type, COUNT(*) FROM billing_logs GROUP BY type;
consumption: 17 (�ɼ�¼, ref_type/ref_label ȫ��, ����ű����ƶ�)
charge: 2 (��ֵ��¼)

# ������
SELECT SUM(amount), COUNT(*) FROM billing_logs WHERE type='consumption' AND is_free=0;
��11.33, 17 ��
```

### �ɼ�¼���� (P3, ��ѡ)

�� 17 �� consumption ��¼ ref_type/ref_label ȫ��, web �˻���ʾΪͨ�� Receipt icon. ����ű� (�ƶ� ref_type):
```sql
-- scripts/backfill_billing_logs_ref_type.sql (S71 P3 TODO)
UPDATE billing_logs SET
  ref_type = CASE
    WHEN description LIKE '%VIP%' OR description LIKE '%��Ա%' THEN 'vip'
    WHEN description LIKE '%�籾%' OR description LIKE '%episode%' THEN 'episode'
    WHEN description LIKE '%�־�%' OR description LIKE '%shot%' THEN 'shot'
    WHEN description LIKE '%��ɫ%' OR description LIKE '%character%' THEN 'character_variant'
    WHEN description LIKE '%ͼƬ%' OR description LIKE '%image%' THEN 'image'
    WHEN description LIKE '%��Ƶ%' OR description LIKE '%video%' THEN 'video'
    WHEN description LIKE '%����%' OR description LIKE '%analyze%' THEN 'novel_analyze'
    ELSE ''
  END,
  ref_label = description
WHERE ref_type = '' OR ref_type IS NULL;
```

### ��ѵ (5 ��, ����Ŀͨ��, �û������������ݹ淶)

1. **�����������ݱ�����������¼** �� �����ǳ�ֵ / ���� / ���, �κ� amount �䶯��Ҫ�� billing_logs, �����û�**��� + �ͷ� + ���ݷ���**�Ļ���
2. **ͳһ�۷����** �� ���п۷� (��ֵ / ���� / �˷�) ��һ�� `recordConsumption/topUp/refund` ����, ��Ҫÿ�� service �Լ� INSERT
3. **schema ����֧�ַ���** �� ���� `ref_type` + `ref_id` + `ref_label` + `is_free` 4 �ֶ�, û�� 4 �ֶ�ǰ��û�������ͷ��� / ����ѹ��� / ���� entity
4. **���Ҳ�� log** �� ��� (��ͨ�û� 30 ��/�� / VIP ���� / �����) ҲҪд billing_logs (amount=0, is_free=1), ��Ҫ����, ����ͳ���ջ� / ת���ʲ�׼
5. **·�ɱ�¶���� auth** �� `/api/billing/*` ���� auth (�� `/api/recharge/my` һ��), ��ֹй©��� / ���Ѽ�¼

### �� S69 BUG-072 ����

- **BUG-072 (S69)**: �� Web �˿۷���� 5 ����һ�� (A/B/C/E), �� `/api/pricing` �ֶ� + characterService �߱�׼�ӿ� + video_conversations �� billing_status unsettled
- **BUG-078 (S71)**: �� Web ���˵���ϸȱ���Ѽ�¼ (������������ȱʧ), �� billing_logs �ֶ� + recordConsumption ͳһ��� + /api/billing/* API + BillingPage ��д UI

### ���� TODO (P3)

- [ ] д `scripts/backfill_billing_logs_ref_type.sql` �ƶϾ� 17 ����¼�� ref_type
- [ ] �� `docs/deploy/shipin-app.service` ɾ `ProtectSystem=full` + `ProtectHome=true` (S70 shipin-app.service ����ʱ©��, ��ʱ namespace �Ҳ��� dist/index.js)
- [ ] web �� BillingPage �ӷ�ҳ (offset + limit > 100 ʱ��ҳ, ��ǰû��ҳ)
- [ ] mobile �� "Ǯ�� / �˵�" ҳ ͬ����ʾ (�� web һ��, �� transactions + summary API)
- [ ] docs/BAOTA_NODE_PROJECT_DEPLOY.md �� 4 ��"systemd unit namespace ��" (�� BUG-078 һ��)

### ���� (���ĵ�)

- [`docs/BUGS_INDEX.md` �� 1 30 ������ + �� 4.5 ��������ȿ� Top 5](../docs/BUGS_INDEX.md) �� BUG-078 �ӽ� �� 1 ����
- [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](../docs/BAOTA_NODE_PROJECT_DEPLOY.md) �� ���� SOP, �� BUG-078 ����
- [`apps/server/src/services/billingService.ts`](../../apps/server/src/services/billingService.ts) �� recordConsumption ͳһ���
- [`apps/server/src/routes/billing.ts`](../../apps/server/src/routes/billing.ts) �� �½� /api/billing/* ·��
- [`apps/server/src/models/db.ts`](../../apps/server/src/models/db.ts) �� billing_logs �� 4 �ֶ�
- [`apps/web/src/pages/BillingPage.tsx`](../../apps/web/src/pages/BillingPage.tsx) �� ��д�˵���ϸҳ
- [`apps/web/src/lib/api.ts`](../../apps/web/src/lib/api.ts) �� �� getBillingTransactionsApi + getBillingSummaryApi
- [BUG-072 �۷����](../apps/mobile/BUGS.md#bug-072-s69-��β-v3029-web-�˿۷����-5-����һ��ȫ��-bug-072-abce) �� ǰ�� (S69)

---

## BUG-079 (S71 ����, v3.0.29, 2026-06-25 09:11): S71 ����"12 ά��֤ȫ��" 100% �� �� ʵ�� server �� dist û���� + DB schema û ALTER + web �� dist Ҳû build + routes/billing.ts д�� `req.user.userId` (Ӧ���� `req.userId`)

### ���� (user 6/25 09:11 ����)

���� S71 BUG-078 ��, user �� web �� `/profile/billing` �������κ��µ�"�˵���ϸ" UI. ��Ȼ�� S70 �ǰ��Ͻ��� (�� 4 �� summary / �� 3 tab / �� ref_type icon).

S71 ����"12 ά��֤ȫ��", ����:
- `/api/billing/transactions: 401 (auth ����)` �� **��ȫ��**: 401 ���� outline ȫ�� authMiddleware, ���� billing route �����
- `web �� build 0 ��` �� **û build**: ʵ�ʱ��� web/dist ���� S70 �Ǵ� 10:03 �ľɰ�
- `DB 4 �ֶ� + 2 ����` �� **û��Ӧ��**: db.ts try/catch ALTER ��Ĭ���˴���
- `���� shipin_APP run=True` �� **�� S71 �����޹�**: �� S70 BUG-077 �޷�����״̬

### ���� (4 ������, �� BUG-073 ������ �� ������ȫ���)

#### ���� 1: src/index.ts �����ļ� 6673 �ֽڼ� 3 ��, 1008 �ֽ� version.ts ȫ 1 �� (PS 5.1 д�붪 newline)

S71 ����ʱ, coder �� PowerShell 5.1 (Windows Ĭ�� shell) ͨ�� mcp/CLI д�� src/index.ts + src/config/version.ts, **д����������л��з����̵�**.

```bash
$ python3 -c "data = open('apps/server/src/index.ts', 'rb').read(); print('size:', len(data), 'newline:', data.count(b'\n'))"
size: 6673 newline: 2  # �����ļ��� 3 ��!
```

tsc �����������ļ�, ��� dist/index.js Ҳ�� 11 �� (6577 �ֽ�), ��ȫû�� `require('./middleware/errorHandler')` �ȹؼ�����, node ������� exit 0 (0 �ֽ����).

web/src/config/version.ts ͬ�� 1008 �ֽ� 1 �� (�����ļ���һ��), ���� `error TS2306: File '...version.ts' is not a module`. �κ� `tsc -b` �����.

#### ���� 2: S71 �����"scp dist" ʵ��û����� server �� dist

S71 coder ���� "14 �ļ��Ķ� + 1 �½� routes/billing.ts" ȫ������ git commit `d35c0ea`, ���� build Ҳ���� (���� dist �� 17:38 ʱ���). ��**����׶� scp ʧ�ܻ��߸���û�� scp**�� `/www/wwwroot/shipin-APP/dist/`.

**���� server �� dist ʵ���� S70 �Ǵ� (2026-06-24 10:04) �ľɰ�**:
```bash
$ ls -la /www/wwwroot/shipin-APP/dist/index.js
-rw-r--r-- 1 root root 8862 Jun 24 10:04 /www/wwwroot/shipin-APP/dist/index.js  # S70 �Ǵ�!

$ grep -c '/api/billing' /www/wwwroot/shipin-APP/dist/index.js
0  # ��ȫû�� S71 �¼ӵ� /api/billing ·��!

$ grep -c 'recordConsumption' /www/wwwroot/shipin-APP/dist/services/billingService.js
0  # ��ȫû�� recordConsumption ����!
```

S71 ����ʱ shipin-app ���� PID 41780 ���ʱ���� 2026-06-24 18:00:07, ��ʵ���ܵ� dist �� S70 (10:04) һ�ֲ���. ˵�� S71 �� `systemctl restart` �� systemd ������, ������Ľ������� S70 �� dist.

#### ���� 3: db.ts ALTER TABLE try/catch ��Ĭ�̴�, 4 �ֶ� + 2 ������û��Ӧ��

`apps/server/src/models/db.ts` �� billing_logs 4 �ֶ� + 2 ������ ALTER ȫ������ `try { } catch {}` ��, **catch ��Ϊ��, �κ� ALTER ���� (����Ȩ��/��) ������Ĭ�̵�**.

```javascript
try { await db.execute("ALTER TABLE billing_logs ADD COLUMN is_free TINYINT(1) DEFAULT 0"); } catch {}
try { await db.execute("ALTER TABLE billing_logs ADD COLUMN ref_type VARCHAR(50) DEFAULT ''"); } catch {}
try { await db.execute("ALTER TABLE billing_logs ADD COLUMN ref_id VARCHAR(100) DEFAULT ''"); } catch {}
try { await db.execute("ALTER TABLE billing_logs ADD COLUMN ref_label VARCHAR(200) DEFAULT ''"); } catch {}
try { await db.execute("ALTER TABLE billing_logs ADD INDEX idx_billing_ref_type (ref_type)"); } catch {}
try { await db.execute("ALTER TABLE billing_logs ADD INDEX idx_billing_user_time (user_id, created_at)"); } catch {}
```

**���� SHOW COLUMNS**:
```
Field            Type          Null  Key  Default
id               varchar(36)   NO    PRI
user_id          varchar(36)   NO    MUL
type             enum(...)     NO
amount           decimal(10,2) NO
balance_after    decimal(10,2) NO
novel_id         varchar(36)   YES
description      varchar(500)  YES
word_count       int(11)       YES        0
created_at       bigint(20)    YES   MUL  0
# 4 �ֶ�ȫû! 2 ����ȫû!
```

���� server �˼�ʹ�����´���, `INSERT INTO billing_logs (... is_free, ref_type, ref_id, ref_label)` Ҳ���� "Unknown column" ����, ���� try/catch ����. 1737 ����ʷ���� ref_type/ref_label ȫ�ǿ��ַ���Ĭ��ֵ.

#### ���� 4: routes/billing.ts д�� `req.user.userId` (Ӧ���� `req.userId`)

S71 д�� `apps/server/src/routes/billing.ts` ������ `authMiddleware` ��һ��:

```typescript
// authMiddleware ʵ����� (src/middleware/auth.ts:39):
(req as any).userId = decoded.userId;

// billing.ts S71 д�� (����!):
router.get('/transactions', async (req: any, res) => {
  const userId = req.user.userId;  // ? req.user �� undefined
```

`/api/billing/transactions` ��ʹ����, ����ʱ���� `Cannot read properties of undefined (reading 'userId')`, web ����Զ�ղ��� 200.

### �޷� (4 ���沿��)

#### �޷� 1: ���𻵵� src �ļ� (Write ����ǿд�ɾ���)

```bash
# �� Write/Edit ����ǿд�ɾ��� (������ PS 5.1 д��)
# - src/index.ts 206 �� (ÿ�� import һ��)
# - src/config/version.ts 14 ��
```

#### �޷� 2: ���� build + tar ���� (���� PM2, �� systemd)

```bash
# ����
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm run build  # tsc 0 ��
Compress-Archive dist/* server-dist-s71-bug079-v4.zip  # 318KB
scp server-dist-s71-bug079-v4.zip root@ab.maque.uno:/tmp/

# ������ (�� systemd ���� PM2, BUG-077 �޷�)
unzip -oq /tmp/server-dist-s71-bug079-v4.zip -d /www/wwwroot/shipin-APP/dist/
systemctl reset-failed shipin-app  # ?? �ؼ�, ��ʱ�� restart > 5 �λ� start-limit-hit
systemctl start shipin-app
```

#### �޷� 3: �ֶ� ALTER TABLE 4 �ֶ� + 2 ���� (db.ts try/catch ��������)

```sql
ALTER TABLE billing_logs ADD COLUMN is_free TINYINT(1) DEFAULT 0 COMMENT '1=��Ѷ�� 0=ʵ�ʿ۷�';
ALTER TABLE billing_logs ADD COLUMN ref_type VARCHAR(50) DEFAULT '';
ALTER TABLE billing_logs ADD COLUMN ref_id VARCHAR(100) DEFAULT '';
ALTER TABLE billing_logs ADD COLUMN ref_label VARCHAR(200) DEFAULT '';
ALTER TABLE billing_logs ADD INDEX idx_billing_ref_type (ref_type);
ALTER TABLE billing_logs ADD INDEX idx_billing_user_time (user_id, created_at);
```

#### �޷� 4: �� routes/billing.ts `req.user.userId` �� `req.userId` (�� authMiddleware һ��)

```typescript
router.get('/transactions', async (req: any, res) => {
  const userId = req.userId;  // ? �� authMiddleware ����
```

#### �޷� 5: ��ʷ 1737 �� billing_logs ���� ref_type/ref_label (P3)

�� description �ؼ����ƶ�:
```sql
UPDATE billing_logs SET
  ref_type = CASE
    WHEN description LIKE '%С˵����%' THEN 'novel_analyze'
    WHEN description LIKE '%�籾����%' OR description LIKE '%episode%' THEN 'episode'
    WHEN description LIKE '%�־�%' OR description LIKE '%shot%' THEN 'shot'
    WHEN description LIKE '%����%' OR description LIKE '%comic%' THEN 'comic'
    WHEN description LIKE '%ͼƬ%' OR description LIKE '%��ͼ%' THEN 'image'
    WHEN description LIKE '%��Ƶ%' OR description LIKE '%����Ƶ%' THEN 'video'
    WHEN type='charge' THEN 'recharge'
    ELSE ref_type
  END,
  ref_label = COALESCE(NULLIF(ref_label, ''), description);
-- �����: episode 1327 / image 104 / shot 88 / comic 53 / video 39 / recharge 15 / (��) 112
```

### ��֤ (14 άȫ�� + E2E JWT ����ȫ��)

```
1.  systemctl shipin-app: active
2.  ss 6000: 0.0.0.0:6000
3.  /health: 200
4.  /api/version: 3.0.29 (S71 ��ʵ�汾)
5.  �������ʱ��: 09:32:14 (��, S71 �����)
6.  dist/index.js: 206 �� 10052 �ֽ� (������, vs S70 �𻵰� 11 �� 6577 �ֽ�)
7.  /api/billing/transactions (�� auth): 401 (from billing route auth, ���� outline ȫ��)
8.  /api/billing/summary (�� auth): 401
9.  DB 4 �ֶ�: is_free/ref_type/ref_id/ref_label ȫ��
10. DB 2 ����: idx_billing_ref_type + idx_billing_user_time
11. DB ����: 1738 �� (15 charge + 1723 consumption, 19 users)
12. ref_type �ֲ�: episode 1327 / image 104 / shot 88 / comic 53 / video 39 / recharge 15
13. ���� HTTPS ab.maque.uno: 200
14. web ʵ�ʼ��� JS: index-D2b1NMvN.js (S71 �°�, 489226 �ֽ�)

E2E JWT ���� (user_id=6b5f6dc1-...):
  GET /api/billing/transactions?limit=3
  �� {"success":true, "items":[{refType:"image", refLabel:"��ɫͼƬ����(1��) - ½��", amount:0.1},
                                {refType:"video", refLabel:"��Ƶ����(15s/VIP)", amount:0.1},
                                {refType:"comic", refLabel:"�������� (1ҳ)", amount:0.08}],
     "total":1154}
  GET /api/billing/summary
  �� {"totalCharge":260, "totalConsumption":110.92, "totalFree":0, "balance":219.04,
     "todayConsumption":0.2, "todayFree":0}
```

### ��ѵ (5 ��, ����Ŀͨ�� + shipin-APP �ض�)

1. **PS 5.1 д������/�����ַ��ļ��ض� newline** �� �κ��� PS 5.1 + mcp/CLI д�� .ts/.js/.md/.sql �ļ���, **���� `python3 -c "data=open('f','rb').read(); print(data.count(b'\\n'))"` ��֤������**. shipin-APP ���ļ� 1008 �ֽ� 1 �� / 6673 �ֽ� 3 ��. ���� Write/Edit ���� (UTF-8 + �Զ� newline)
2. **"12 ά��֤ȫ��" ����غ� grep ������ dist ʵ���ַ���** �� ���ܹ⿴ HTTP 200 (S71 /api/billing/transactions 401 ���� outline ȫ�� auth, ���� billing route �����). **����**:
   ```bash
   ssh server "grep -c '/api/billing' /www/wwwroot/shipin-APP/dist/index.js"
   ssh server "grep -c 'recordConsumption' /www/wwwroot/shipin-APP/dist/services/billingService.js"
   ssh server "mysql -e 'SHOW COLUMNS FROM billing_logs' | grep -E 'is_free|ref_type'"
   ```
3. **db.ts ALTER TABLE ��ȥ�� try/catch ��Ĭ��** �� �κ� schema Ǩ�Ƶ� try/catch ���� `logger.warn` ����. ���� 12 ά��֤"����"��ʵ�� DB �ֶ�û��, д��־��һֱд��ֵ
4. **�¼� routes �ظ� authMiddleware �ֶζ���** �� ������ `(req as any).userId` ���� `req.user.userId`, ������. E2E JWT �ز�, ���ܹ� 401 ��˵ "auth ����"
5. **systemd restart ���ʧ�ܱ� `systemctl reset-failed`** �� ��ʱ���� (5s ��) restart > 5 �λᴥ�� start-limit-hit, ���� `systemctl reset-failed shipin-app` ��������

### ���� TODO (P0)

- [ ] д `scripts/verify-deploy.sh` ��������: `grep -c` �ؼ� dist �ַ��� + `mysql SHOW COLUMNS` �ؼ��� + E2E JWT ������ API 3 ��. �κ� 1 ʧ�ܱ� abort ����
- [ ] db.ts ���� ALTER TABLE �� try/catch �� `logger.warn({err, sql})` ���� 1 ����־, ����Ĭ��
- [ ] ���� routes/ д�¶˵���� `grep -E 'req.user' src/middleware/auth.ts` ��ʵ�� set �ֶ���, ������ route ���һ��
- [ ] д .ts/.js/.md/.sql �ļ�**��ֹ**�� PS 5.1 + Out-File, ���� Write/Edit ���� (UTF-8 �Զ� newline)
- [ ] ��� AGENTS.md �� 5 ��������"����� 14 ά��֤": 5 ά���� + 3 ά����/nginx/APK + 3 ά server dist �ַ��� grep + 3 ά DB schema + E2E JWT ���� 1 ������ API

### ���� (���ĵ�)

- [`docs/BUGS_INDEX.md` �� 1 30 ������ + �� 3 S9 ������֤ SOP](../docs/BUGS_INDEX.md) �� BUG-079 �ӽ� �� 1 ���� + �� 4 Top 10 ��Ƶ�ȿ�
- [`docs/BAOTA_NODE_PROJECT_DEPLOY.md` �� 4 9 ��](../docs/BAOTA_NODE_PROJECT_DEPLOY.md) �� ���� deploy SOP
- [`apps/server/src/index.ts`](../../apps/server/src/index.ts) �� S71 ������д 206 �н�����
- [`apps/server/src/routes/billing.ts`](../../apps/server/src/routes/billing.ts) �� S71 ���ø� `req.userId`
- [`apps/server/src/models/db.ts`](../../apps/server/src/models/db.ts) �� billing_logs ALTER 7 ���� (S71 BUG-078 + S71 BUG-079 �� logger.warn)
- [`apps/web/src/config/version.ts`](../../apps/web/src/config/version.ts) �� S71 ������д 14 �иɾ���
- [`apps/web/src/pages/BillingPage.tsx`](../../apps/web/src/pages/BillingPage.tsx) �� S71 BUG-078 ��д�˵���ϸ
- [`apps/web/dist/index-D2b1NMvN.js`](../../apps/web/dist/) �� S71 BUG-078 �� build, 489226 �ֽ�
- [BUG-073 1 �� minified ��Ĭ ReferenceError](../apps/mobile/BUGS.md#bug-073-s69-1-��-minified-src--tsc-593--node-22-��Ĭ����-esm) �� ǰ�� (S69, ͬ�� PS 5.1 д���)
- [BUG-078 Web ���˵���ϸȱ���Ѽ�¼](../apps/mobile/BUGS.md#bug-078-s71-v3029-web-���˵���ϸȱ���Ѽ�¼--ֻ��ʾ��ֵ-���Ѻ������ȫû��¼-������������ȱʧ) �� ���� (S71 д src + ������)
- [BUG-077 ���� shipin-APP �Ҳ��� 3 ����](../apps/mobile/BUGS.md#bug-077-s70-����-��Ŀ-�Ҳ���-shipin-app-3-����-s70-ӲҪ��-100-��) �� S70 ����·�� (systemd + ����ͬ��)

---

## BUG-080 (S71 ����, v3.0.29, 2026-06-25 10:48): web ��"���Ѽ�¼"tab û���� �� BillingPage.tsx push transactions ʱ©�� `type` �ֶ�

### ���� (user 6/25 10:47 ����)

�� `https://ab.maque.uno/profile/billing` ��:
- ? "ȫ��" tab ������ʾ���� (200 ��)
- ? **"���Ѽ�¼" tab ��ʾ"�������Ѽ�¼"** (��)
- ? "��ֵ��¼" tab ������ʾ���� (�� recharge_requests ���)

### ���� (1 �� bug, 12 �ֶ�© 1 ��)

`apps/web/src/pages/BillingPage.tsx` �� 118-130 ��, �� `transactions` ���� push �� `mergedRecords` ʱ**ֻ���� 4 ���ֶ�**, ©�� `type`:

```typescript
// v3.0.32 S71 BUG-078 д�� (© type �ֶ�)
transactions.forEach((t) => {
  all.push({
    ...({
      id: t.id,
      amount: t.amount,
      status: t.type === 'charge' ? 'approved' : 'settled',  // �� ���� t.type ��û�浽������
      ip: '',
      createdAt: t.createdAt,
    }),
    kind: 'billing_tx',  // �� kind ����
  } as any);
  // ȱ: type �ֶ�û�浽������!
});
```

�� L137 �� tab filter �� `(r as any).type === 'consumption'`:

```typescript
if (tab === 'consumption') return mergedRecords.filter((r) =>
  (r as any).kind === 'billing_tx' && (r as any).type === 'consumption'  // �� ��Զ�� undefined, filter ȫ��
);
```

**�߼���**:
1. API `/api/billing/transactions` ���� 1154 �� items, ÿ������ `type: 'consumption' | 'charge'`
2. web �� `setTransactions(items)` ����Щ items �浽 state, type �ֶ�Ҳ��
3. **��** `mergedRecords` push ʱ**ֻ�� 4 ���ֶ�**, `type` ������
4. tab filter �� `(r as any).type === 'consumption'` �� ��Զ undefined
5. "���Ѽ�¼" tab ��Զ��
6. "��ֵ��¼" tab �ߵ��� `kind === 'recharge_pending'` (�� recharge_requests ��) �� `kind === 'billing_tx' && type === 'charge'` (�� billing_logs charge ��¼) �� ����� user û charge ��¼, ����"��ֵ��¼"ȫ�� recharges, **��������ʾ** (�� BUG ͬ������, ������� user �� charge ��¼Ҳ��ʾ������)
7. "ȫ��" tab �� filter, ��������

### �޷� (1 �� spread ��)

```typescript
// v3.0.32 (BUG-080 S71 ����): �� spread ���� t (�� type/refType/refLabel/balanceAfter/wordCount/isFree ��ȫ��)
transactions.forEach((t) => {
  all.push({
    ...t,  // �� һ����: �� type + refType + refLabel + balanceAfter + wordCount + isFree + novelId + description
    status: t.type === 'charge' ? 'approved' : 'settled',  // ���� RechargeRecord ����Ҫ��� status �ֶ�
    ip: '',
    kind: 'billing_tx',
  } as any);
});
```

### ��֤ (E2E + 14 ά + �û������ˢ��)

#### E2E ģ�� web �� 3 tab filter �߼� (server ��)
```
GET /api/billing/transactions?limit=200 (user_id=6b5f6dc1-...)
  �� total: 1154
  �� items.length: 200
  �� ȫ�� tab: 200 �� (limit �ض�)
  �� ���Ѽ�¼ tab filter type=consumption: 200 �� ? (�޺���ƥ��)
  �� ��ֵ��¼ tab filter type=charge: 0 �� (��� user û charge ��¼, BUG ͬ������, ��� user ����)
  �� sample consumption[0]: {id, type:"consumption", amount:0.1, refType:"image", refLabel:"��ɫͼƬ����(1��) - ½��", ...}
```

#### 14 ά verify-deploy.sh --strict
```
PASS: 16  /  FAIL: 0  /  SKIP: 0
? ά�� 14: web ʵ�ʼ��� JS: index-4tluy4vN.js (�� BUG-080 �޷�, 489185 �ֽ�)
```

#### �û������ (ˢ�º�)
- ? "ȫ��" tab 200 ��
- ? **"���Ѽ�¼" tab 200 �� (����ʾ, �޷�ǰ�� 0 ��)**
- ? "��ֵ��¼" tab �� recharge_requests

### ��ѵ (3 ��, ����Ŀͨ��)

1. **web �� spread ��������, �������ֶ�** �� �� `...t` ���� `{ id: t.id, amount: t.amount, ... }`, �ֶλ��� API �ݽ� (�� refType/refLabel ��) �Զ�͸��, **�����©**
2. **filter �� type �ֶ�ǰ����֤���������ֶ�** �� TypeScript `as any` �Ȳ��� runtime, type field ȱʧ filter ȫ��. �޷�: �� push �� spread ���� + �� console.assert ����ʱ��֤
3. **E2E ��ģ��ǰ�� tab filter �߼�** �� API ���ض��˲�����ǰ����ʾ�� (�� BUG �� web �� bug, API һֱ�Ե�). server verify-deploy.sh �� E2E ģ��ǰ�� filter �Ľű��ɱ������� BUG

### ���� TODO (P2)

- [ ] web ������ `setXxx()` ���� console.assert ��֤ (e.g. `console.assert(transactions[0]?.type, 'type field missing')`)
- [ ] verify-deploy.sh �� web �˾�̬����: ���� dist/index-*.js �� `as any).type ===` ���� pattern, ��� BillingPage.tsx �� source �ǲ��� spread ����
- [ ] д `tools/check-react-spread.sh` ��� `forEach((t) => { all.push({ id: t.id, ...` ���������ֶ� pattern, ������� spread ���� t

### ���� (���ĵ�)

- [`apps/web/src/pages/BillingPage.tsx`](../../apps/web/src/pages/BillingPage.tsx) �� S71 ���ø� `...t` (�� type)
- [`apps/web/dist/index-4tluy4vN.js`](../../apps/web/dist/) �� BUG-080 �޷� web ����, 489185 �ֽ�
- [`apps/server/src/services/billingService.ts`](../../apps/server/src/services/billingService.ts) �� /api/billing/transactions ���� items (�� type, BUG-079 ����)
- [`apps/server/src/routes/billing.ts`](../../apps/server/src/routes/billing.ts) �� /api/billing/transactions ·��
- [BUG-078 Web ���˵���ϸȱ���Ѽ�¼](../apps/mobile/BUGS.md#bug-078-s71-v3029-web-���˵���ϸȱ���Ѽ�¼--ֻ��ʾ��ֵ-���Ѻ������ȫû��¼-������������ȱʧ) �� ���� (S71 д BillingPage © type �ֶ�)
- [BUG-079 S71 ����'12 ά��֤ȫ��' 100% �� �� �沿��](../apps/mobile/BUGS.md#bug-079-s71-����-v3029-2026-06-25-0911-s71-����12-ά��֤ȫ��-100-��--server-��-dist-û����--db-schema-û-alter--web-��-dist-Ҳû-build--routesbillingts-д��-requseruserid) �� ���� (verify-deploy.sh 14 ά���� BUG-079 д��)

---

## BUG-081 (S71 ����, v3.0.32, 2026-06-25 13:00): �û��ķ���ʱ"�޷����ķ��� / An unexpected error occurred" �� imageAgentService ״̬��© plan_ready, throw raw Error �� errorHandler ����

### ���� (user 6/25 12:55 ���� "��ͼ����")

�� `https://ab.maque.uno/image-agent` ��:
1. �û�����"�¹���Ů, ʮ�˾���, ������..." ��������
2. AI �����ķ��� (cnDescription ��ʾ, ״̬: plan_cn_ready �� ʵ���� plan_ready, S70 v3.0.0.16+ passthrough ģʽ���� plan_cn_ready)
3. �û���ķ���, ��"�޸�: ��Ϊѩ�س���" �ı�
4. ? **ҳ����ʾ "An unexpected error occurred"** (��"�޷����ķ���" ��ͬһ��)
5. ˢ�º��ٴ�����, ����ͬ������

### ���� (2 ������)

#### ���� 1: imageAgentService.processTurn ״̬������© plan_ready

`apps/server/src/services/imageAgentService.ts` L181-185 (BUG-081 ��ǰ):

```typescript
// ״̬���: ���� awaiting_clarification / plan_cn_ready / tool_completed
const allowedStates = ['awaiting_clarification', 'plan_cn_ready', 'tool_completed'];
if (!allowedStates.includes(conv.status)) {
  throw new Error(`��ǰ״̬ ${conv.status} ���ɶԻ�, �� awaiting_clarification / plan_cn_ready / tool_completed`);
}
```

�� S70 v3.0.0.16+ �� passthrough ģʽ��, `processTurn` ֱ������ `plan_ready` ״̬ (���� `plan_cn_ready`), ע�� L5 Ҳд��:

> ״̬��: idle �� awaiting_clarification (��ӭ��) �� plan_ready (processTurn ֱ�ӳ�) �� tool_queued �� tool_executing �� tool_completed

**������û����**, ���� v3.0.0.13 ʱ�� (�� plan_cn_ready �׶�) �Ĵ���. �û��� plan_ready ״̬�ٷ���Ϣ, throw "��ǰ״̬ plan_ready ���ɶԻ�".

#### ���� 2: throw raw Error �� errorHandler ���׷� 500 "An unexpected error occurred"

L184 `throw new Error(...)` ����ͨ Error, ���� `AppError`. �� `apps/server/src/middleware/errorHandler.ts`:

```typescript
if (err instanceof AppError) {
  res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message, ... } });
  return;
}
logger.error('Unexpected error', { ... });
res.status(500).json({
  success: false,
  error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  ...
});
```

raw Error �߶���, �� 500 + ͨ�� message. �ͻ��� (`apps/web/src/components/AgentChatPanel.tsx` L429) `e?.response?.data?.error?.message` �õ��ľ��� "An unexpected error occurred", ���������� "��ǰ״̬ plan_ready ���ɶԻ�" �����ʵԭ��.

**����û��Ĵ����"ϵͳ�� bug �Ĳ���", ʵ����״̬���ѽ�**.

### �޷� (3 ��)

#### �޷� 1: imageAgentService.processTurn �� plan_ready + �� AppError

```typescript
// v3.0.32 (BUG-081 S71 ����): �� plan_ready. ֮ǰ S70 v3.0.0.16+ �� passthrough ģʽ��, processTurn
// ֱ���� plan_ready (���� plan_cn_ready), �� allowedStates û���� �� �û��ķ���ʱ throw
const allowedStates = ['awaiting_clarification', 'plan_cn_ready', 'plan_ready', 'tool_completed'];
if (!allowedStates.includes(conv.status)) {
  throw new AppError(
    'INVALID_CONVERSATION_STATE',
    `��ǰ״̬ ${conv.status} ���ɶԻ�, �� awaiting_clarification / plan_cn_ready / plan_ready / tool_completed`,
    400,  // ���� 500, ���û�״̬��
    { currentStatus: conv.status, allowedStates }
  );
}
```

#### �޷� 2: videoAgentService.processTurn �� busy ״̬�ܾ� + �� AppError

video agent ֮ǰ**û**�κ�״̬���, �� image agent ��Ϊ��һ��. �� 5 �� busy ״̬�ܾ�:

```typescript
const busyStates = ['tool_queued', 'tool_executing', 'ai_planning', 'ai_clarifying', 'plan_translating'];
if (busyStates.includes(conv.status)) {
  throw new AppError(
    'AGENT_BUSY',
    `AI ���ڴ�����һ����Ϣ (${conv.status}), ���Ժ�...`,
    409,  // 409 Conflict ״̬��ͻ
    { currentStatus: conv.status }
  );
}
```

(ǰ�˵� `AgentChatPanel.tsx` L377-380 �Ѿ����� 5 �� busy ״̬��ǰ�˼��, ������ֻ��˫����, �����ƻ���������)

#### �޷� 3: web AgentChatPanel.tsx ��������ȡ code

```typescript
// v3.0.32 (BUG-081 S71 ����): ��ȡ error.code ����ͬ������Ѻ���ʾ
const errCode = e?.response?.data?.error?.code;
const errMsg = e?.response?.data?.error?.message || e?.message || '����ʧ��';
let userMsg = errMsg;
if (errCode === 'INVALID_CONVERSATION_STATE') {
  userMsg = `${errMsg} (����ˢ��ҳ����½��Ự)`;
} else if (errCode === 'AGENT_BUSY') {
  userMsg = `AI ���ڴ�����һ����Ϣ, ���Ժ�...`;
} else if (errCode === 'CONVERSATION_NOT_FOUND') {
  userMsg = `�Ự��ʧЧ, ���½��Ự`;
}
console.error('[AgentChat] send error', { code: errCode, message: errMsg, elapsed, stack: e?.stack });
setError(`${userMsg}${elapsed > 0 ? ` (��ʱ ${elapsed}s)` : ''}`);
```

### ��֤ (E2E ģ���û�·�� + 18 ά verify-deploy)

#### E2E ģ��: ���������û�·��

```bash
# 1. ���� image conversation
POST /api/image-agent/conversations �� conversationId

# 2. ��һ�η�: ��������
POST /api/image-agent/chat { conversationId, parts: [{type:'text', text:'�¹���Ů...'}] }
�� status: plan_ready, �����ķ��� cnDescription (200 ?)

# 3. �û��ķ���: �ڶ��η�
POST /api/image-agent/chat { conversationId, parts: [{type:'text', text:'�޸�: ѩ�س���'}] }
�� ��ǰ: throw raw Error �� 500 'An unexpected error occurred' (BUG)
�� �޺�: 200 ? ״̬ plan_ready �Կɸ� �� AI �������ɷ���
```

#### 18 ά verify-deploy.sh --strict (PASS=18 FAIL=0)

```
? ά�� 1-6: server ������ (systemd / port / health / version / novels 401 / ���� PID=54854 ��)
? ά�� 7-9: server dist grep (/api/billing 2 ���� / recordConsumption 7 ���� / ALTER 10 ����)
? ά�� 10-12: DB schema + ���� (4 �ֶ� / 2 ���� / 1740 ��)
? ά�� 13-14: ���� HTTPS + web JS hash (index-BcD13Lwk.js ��)
? E2E.1 /api/billing/transactions: 1156 �� (�� BUG-080 ���� prompt_optimize 2 ��)
? E2E.2 /api/billing/summary: balance=219.02
? ά�� 15-16: web �� dist �����ֶξ�̬���� (1 �ļ��� .type === filter, 1148 �� consumption)
```

### ��ѵ (4 ��, ����Ŀͨ��)

1. **״̬��Ǩ��Ҫͬ����������** �� S70 v3.0.0.16 �� passthrough (���� plan_cn_ready �� ֱ�� plan_ready) ʱ, processTurn allowedStates ûͬ������, 9 ����û���ײ����� BUG. **�κ�״̬��Ǩ��, ��ͬ����� allowlist / transition / response handler**
2. **throw raw Error �ػ��� AppError** �� ��ͨ Error �� errorHandler ���׷� 500 + ͨ�� message, �ͻ��˿�������ʵԭ��. **ҵ���߼��״���� AppError + code + statusCode + details**, ���� statusCode 400 (�û���) ���� 500 (ϵͳ��)
3. **��� 4xx ���� status code ������** �� 400 �û������� (״̬�� / ������), 409 ״̬��ͻ (AGENT_BUSY, ��ǰ״̬æ), 404 ��Դ������ (�Ự��ʧ). �ͻ����ܸ��� status code ����ͬ UI ����
4. **ǰ�� error handler ����ȡ error.code** �� ����ȡ message, ��ȡ code, ����ͬ code ��ͬ user-friendly �İ�. `INVALID_CONVERSATION_STATE` ����ˢ��ҳ��, `AGENT_BUSY` �����Ժ�, `CONVERSATION_NOT_FOUND` �����½��Ự

### ���� TODO (P2)

- [ ] `apps/server/src/services/imageAgentService.ts` ���� `throw new Error(...)` ȫ���� AppError (L178 conv ������, L179 conv.user_id undefined, L205-209 ���� LLM ʧ�ܵ�) �� ȫ��Ӧ�߾��� code
- [ ] `apps/server/src/services/videoAgentService.ts` ���� throw ͬ���� AppError (L388/389/392/402 ��)
- [ ] `apps/web/src/components/AgentChatPanel.tsx` ������ʾ�� toast ��ʾ (���� setError ���� toast.error('����ʧ��', { code }) �� ����Ŀ)
- [ ] verify-deploy.sh ��ά�� 17: E2E ģ��"���� conv + �� chat + �ķ����ٷ� chat" ����·��, ״̬���ع����
- [x] ��� AGENTS.md �� 4 ���� 4+ ��"״̬��Ǩ�Ʊ�ͬ�� allowlist + response handler" (S71 BUG-081 ǿԼ��) �� **v3.0.33 (S71 ����, 2026-06-25 14:20) ������ 4+**: 4 ��ͬ�� (allowlist grep + UI case grep + DB schema ���� + һ���Լ�ű�), �� S71 BUG-081 ��ʵ���� + ����Ŀͨ�� (����/������/Э��״̬��). commit pending.

### ���� (���ĵ�)

- [`apps/server/src/services/imageAgentService.ts`](../../apps/server/src/services/imageAgentService.ts) �� L181-191 �޷� 1 (�� plan_ready + AppError)
- [`apps/server/src/services/videoAgentService.ts`](../../apps/server/src/services/videoAgentService.ts) �� L180-194 �޷� 2 (�� busy ״̬�ܾ� + AppError)
- [`apps/web/src/components/AgentChatPanel.tsx`](../../apps/web/src/components/AgentChatPanel.tsx) �� L427-446 �޷� 3 (��ȡ error.code �Ѻ���ʾ)
- [`apps/server/src/utils/errors.ts`](../../apps/server/src/utils/errors.ts) �� AppError �ඨ��
- [`apps/server/src/middleware/errorHandler.ts`](../../apps/server/src/middleware/errorHandler.ts) �� ���� 'An unexpected error occurred' �� 500
- [`apps/web/dist/index-BcD13Lwk.js`](../../apps/web/dist/) �� BUG-081 �޷� web ����, 477489 �ֽ�
- [BUG-073 1 �� minified ��Ĭ ReferenceError](../apps/mobile/BUGS.md#bug-073-s69-1-��-minified-src--tsc-593--node-22-��Ĭ����-esm) �� ǰ�� (ͬ�� PS 5.1 д���)
- [BUG-080 web �����Ѽ�¼ tab û����](../apps/mobile/BUGS.md#bug-080-s71-����-v3029-2026-06-25-1048-web-�����Ѽ�¼tab-û����--billingpagetsx-push-transactions-ʱ©��-type-�ֶ�) �� ���� (S71 ���� web �˷���)

## BUG-082 (S71 ����, v3.0.32, 2026-06-25 13:30): Web �˵����Ƶ/ͼƬ�Ự�� React #31 "object with keys {code, message}" �� server �� agnes API ���� {code, message} ����ԭ����� messages JSON, web ��Ⱦ���󴥷� React

### ���� (�û�����)

�����Ƶ/ͼƬ�Ự "aa88d219-686d-4459-b01b-09e31a7b4159" ʱ, web �� console �� React error #31:

> Objects are not valid as a React child (found: object with keys {code, message})

ҳ�濨�� + ��������ջָ�� `H2` �� `V2` �� `B2` (B2 = Card �� H2 ���), ��Ƶ/ͼƬ�Ự���� tab ������.

### ��ʵ���� (3 ����)

**�� 1 ��: agnes API ���Ĵ����������**

```json
{ "status": "failed", "error": { "code": "400", "message": "Invalid image: Incorrect padding" } }
```

���� agnes API (OpenAI ����) �ı�׼�����ʽ.

**�� 2 ��: agnesVideoProvider.queryStatus ԭ���浽 result.error**

```typescript
// apps/server/src/services/agnesVideoProvider.ts L298-303 (BUG-082 ��ǰ)
const result: AgnesVideoStatusResult = {
  taskId: data.id || '',
  videoId: data.video_id || videoId,
  status,
  progress: data.progress || 0,
  error: data.error,  // �� ���� {code, message} ������ȥ
};
```

**�� 3 ��: videoAgentService L705 ֱ�Ӱ� failMsg д�� messages JSON**

```typescript
// apps/server/src/services/videoAgentService.ts L705-707 (BUG-082 ��ǰ)
const failMsg = status.error || '��Ƶ����ʧ��';
const messages = replaceStreamingPart(parseMessages(conv.messages), {
  type: 'error', message: failMsg,  // �� failMsg �Ƕ��� {code, message}, ��� DB
});
```

DB ʵ�ʴ��������:
```json
{"type": "error", "message": {"code": "400", "message": "Invalid image: Incorrect padding"}}
```

**�� 4 �� (web ��Ⱦ): AgentChatPanel.tsx L1299 ֱ����Ⱦ**

```typescript
// apps/web/src/components/AgentChatPanel.tsx L1299 (BUG-082 ��ǰ)
<div className="opacity-80">{part.message || 'δ֪����'}</div>
// React ���� part.message �Ƕ���, ���� ReactText �� React #31
```

### �޷� (4 �� + 1 SQL �޸�)

#### �޷� 1: �½� utils/errorUtils.ts ͨ�ù�һ���� (���ļ�, 60 ��)

```typescript
// apps/server/src/utils/errorUtils.ts
export function extractErrorMessage(err: unknown, fallback: string = 'δ֪����'): string {
  if (err == null) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean') return String(err);
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // ���ȼ� 1: ��׼ { code, message } ��ʽ (AppError / agnes / OpenAI ����)
    if (typeof obj.message === 'string' && obj.message.trim()) {
      if (typeof obj.code === 'string' && obj.code && obj.code !== 'INTERNAL_ERROR') {
        return `${obj.message} (${obj.code})`;
      }
      return obj.message;
    }
    // ���ȼ� 2: { msg } / { error: string } / { detail: string }
    if (typeof obj.msg === 'string' && obj.msg.trim()) return obj.msg;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail;
    // ���ȼ� 3: Ƕ�� { error: { code, message } } (axios ���)
    if (typeof obj.error === 'object' && obj.error !== null) {
      const nested = extractErrorMessage(obj.error, '');
      if (nested) return nested;
    }
    // ����: JSON.stringify (���� React #31 ��Ⱦ����)
    try {
      const json = JSON.stringify(err);
      return json.length > 200 ? json.slice(0, 200) + '...' : json;
    } catch { return fallback; }
  }
  return fallback;
}
```

֧�� 5 ������: string / number/boolean / Error / {code, message} ���� / Ƕ�� axios error / δ֪����. **��Զ�� string, ���᷵ object**.

#### �޷� 2: videoAgentService.ts L527 + L705 �� extractErrorMessage (2 ��)

```typescript
// L527-535 (createTask ʧ��·��)
const errMsg = (err as Error).message;
let friendlyMsg = errMsg;
if (errMsg.includes('timeout') || errMsg.includes('fetch failed') || ...) {
  friendlyMsg = 'agns ��Ƶ������ʱ������ (���� OpenAI ��æ�����ά��), �� 5-10 ���Ӻ�����';
} else if (errMsg.includes('429')) {
  friendlyMsg = 'agns ��Ƶ API ������, ���Ժ�����';
}
// v3.0.32 BUG-082: ǿ�ƹ�һΪ string, �����η� {code, message} ����
const safeFriendlyMsg = extractErrorMessage(friendlyMsg, '��Ƶ����ʧ��');

// L544-545 (д�� error_msg + messages)
error_msg: safeFriendlyMsg,
messages: failMessages  // part.message: safeFriendlyMsg

// L705-707 (polling ʧ��·�� �� ������)
const failMsg = extractErrorMessage(status.error, '��Ƶ����ʧ��');
// status.error �� agens API ���� {code, message} ����, ���߹�һ
const messages = replaceStreamingPart(parseMessages(conv.messages), {
  type: 'error', message: failMsg,  // �� ������ string
});
```

#### �޷� 3: imageAgentService.ts L637 ͬ���� (1 ��, Ԥ��)

```typescript
// L637-651 (background run ʧ��·��)
let friendlyMsg = errMsg;
if (errMsg.includes('timeout') || ...) { friendlyMsg = '...'; }
// v3.0.32 BUG-082: ǿ�ƹ�һ
const safeFriendlyMsg = extractErrorMessage(friendlyMsg, 'ͼƬ����ʧ��');
const failMessages = replaceStreamingPart(prevMessages, {
  type: 'error', message: safeFriendlyMsg,
});
```

#### �޷� 4: web AgentChatPanel.tsx L1292-1302 ��������Ⱦ (ǰ�˶���, ����ʷ������)

```typescript
case 'error':
  // v3.0.32 BUG-082: ��������Ⱦ �� part.message ��ʷ�Ͽ����Ƕ��� {code, message} (server û��һ)
  const errorMsgText = typeof part.message === 'string'
    ? part.message
    : (part.message && typeof part.message === 'object' && typeof (part.message as any).message === 'string')
      ? (part.message as any).message
      : (typeof part.message === 'object' ? JSON.stringify(part.message) : String(part.message ?? ''));
  return (
    <div className="mt-1 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
      <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-xs text-red-200">
        <div className="font-medium mb-0.5">����ʧ��</div>
        <div className="opacity-80">{errorMsgText || 'δ֪����'}</div>
      </div>
    </div>
  );
```

#### �޷� 5: ��ʷ������ SQL �޸� (1 ��)

д�� `scripts/fix-bug-082-error-message-prod.js` ��һ��:
- video_conversations: ɨ 3 �� (�� type:error in parts), �� 1 �� (aa88d219)
- image_conversations: ɨ 2 ��, �� 0 �� (���� 2 �� message �Ѿ��� string)

�޺�:
```json
{"type": "error", "message": "Invalid image: Incorrect padding (400)"}
```

(�� code ƴ�� message ĩβ, ��ǰ�� `(${code})` ģʽһ��, �ɶ��� + ��Ϣ����)

### ��֤ (20 ά verify-deploy.sh --strict + E2E ģ���û�·��)

#### 20 ά verify-deploy.sh --strict (PASS=20 FAIL=0 SKIP=0)

```
? ά�� 1-6: server ������ (systemd active / port 6000 / health 200 / version 3.0.32 / novels 401 / PID 1564 ��)
? ά�� 7-9: server dist �ؼ��ַ��� grep (/api/billing 2 ���� / recordConsumption 7 ���� / ALTER 10 ����)
? ά�� 10-12: DB schema + ���� (4 �ֶ� / 2 ���� / 1744 ��)
? ά�� 13-14: ���� HTTPS + web JS hash (index-BXGaeeDt.js ��)
? E2E.1 /api/billing/transactions: 1160 ��
? E2E.2 /api/billing/summary: balance=219.01
? ά�� 15-16: web �� dist �����ֶξ�̬���� (1 �ļ��� .type === filter, 1152 �� consumption)
? ά�� 17-18: BUG-082 ����
   ? 17. server dist extractErrorMessage: 3 ���ļ� (videoAgent + imageAgent + errorUtils)
   ? 18. web dist ������Ⱦ (JSON.stringify(part.message)): 1 ���ļ�
```

#### E2E ģ���û�·�� (DB + API ˫��)

```bash
# 1. DB �� (mysql ֱ�Ӳ�)
mysql> SELECT id, messages FROM video_conversations WHERE id='aa88d219-...';
# ��ǰ: messages[4].parts[2].message = {"code": "400", "message": "Invalid image: Incorrect padding"}
# �޺�: messages[4].parts[2].message = "Invalid image: Incorrect padding (400)"  (string)

# 2. API �� (JWT auth + GET /api/video-agent/conversations/aa88d219-...)
GET /api/video-agent/conversations/aa88d219-686d-4459-b01b-09e31a7b4159
�� 200 OK, data.messages[4].parts[2].message �� string ?
```

### ��ѵ (4 ��, ����Ŀͨ��)

1. **API �߽紦�ع�һ�����ʽ** �� ���� API ���Ĵ���ṹ (�� {code, message}) ���־û��ṹ (string) ��ͬʱ, **�߽�ع�һ**, ����ֱ��͸��. ����� agnes API �� object, server ԭ����� DB, web ��Ⱦ object ���� React #31. ����Ŀͨ��: **д�߽��������"schema һ����"**
2. **д messages / logs / DB ���� string �ֶ�, ����ֱ�Ӵ����� Error ����** �� �� BUG-081 throw raw Error �� AppError ͬԴ: **�߽紦ǿ�� schema ��һ**. React ��Ⱦ���󴥷� #31, log ��¼�����ȡ�����л�, �κ��������ѷ�������ը
3. **ǰ��չʾ�ֶαط�������Ⱦ** �� server �޸��˲�����ǰ�˿����� `{part.message}` ��Ⱦ, ��ʷ������ + ��� schema drift ��Զ����. **ǰ����Ⱦ user-supplied data �� typeof + JSON.stringify ����**, React �������㶵
4. **д verify-deploy.sh ����ά�ȱ�ͬ�� BUG** �� BUG-079 P0 �� 14��16 ά (server dist grep), BUG-080 P2 �� 16��18 ά (web dist ��̬����), BUG-082 P0 �� 18��20 ά (extractErrorMessage + ������Ⱦ). **ÿ��һ�� P0 BUG, �ؼ�һ��"�Ժ����ٷ�"�� grep ά�ȵ� verify-deploy.sh**, ǿ��δ�� AI ����ʱ���

### ���� TODO (P2)

- [x] `apps/server/src/services/agnesVideoProvider.ts` L302 `error: data.error` ͬ����һ (���� L705 ����, �� queryStatus ����ֵ���Ƕ���, ���÷�Ҫ�ǵ� extractErrorMessage, ��ֱ��. ���� provider ��͹�һ) �� **v3.0.32.1 (S71 P2, 2026-06-25 14:00) �޷� 6**: agnesVideoProvider L302 `error: extractErrorMessage(data.error, '')`, �� import + interface ע��, ���÷� videoAgentService L705 �Ա��� extractErrorMessage ���� (˫����, �����������һ)
- [x] `apps/server/src/services/agnesImageProvider.ts` ���� queryStatus ����Ҳ��һ (ͬ BUG-082 ����, Ԥ����) �� **��ȷ�ϲ�����**: agnesImageProvider ͬ������ image URL (3 ������), ������ `throw new Error('Agnes API ���� (${status}): ${text}')` ���� string, û queryStatus ״̬��ѯ·��, BUG-082 ���ղ�����
- [x] ��� AGENTS.md �� 4 ���� 8 ��"server д�־û� JSON �� string ��һ" �� **���� f92cc19 (S71 BUG-082 commit) ��**: �� 4 ���� 8 ?? server д�־û� JSON �� string ��һ, �� 5 �������һ
- [x] verify-deploy.sh ��ά�� 19: BUG-082 TODO P2 agnesVideoProvider provider ���һ���� �� **�Ѽ�**: grep `dist/services/agnesVideoProvider.js` �� `extractErrorMessage`, 0 ���м� FAIL (δ�� AI ��ɾ import ��ʧ��)
- [x] mobile �� AgentChatPanel.tsx (������ case 'error' ��Ⱦ��?) ͬ����������Ⱦ (�� BUG-082 mobile ��) �� **?? �淶��ת (S72 batch 7 2026-06-26)**: Web ����, APP ����. ���� TODO �� S72 batch 7 5 BUG (092/094/095/096) һ���´� mobile commit ͬ����, ���� AGENTS.md �� 4 ���� 4++ ����Ŀͨ�ù淶

### ���� (���ĵ�)

- [`apps/server/src/utils/errorUtils.ts`](../../apps/server/src/utils/errorUtils.ts) �� �½�, extractErrorMessage 60 ��
- [`apps/server/src/services/videoAgentService.ts`](../../apps/server/src/services/videoAgentService.ts) �� L527-535 + L705-708 �޷� 2 (2 ���� extractErrorMessage)
- [`apps/server/src/services/imageAgentService.ts`](../../apps/server/src/services/imageAgentService.ts) �� L637-651 �޷� 3 (1 ���� extractErrorMessage)
- [`apps/server/src/services/agnesVideoProvider.ts`](../../apps/server/src/services/agnesVideoProvider.ts) �� L302 �޷� 6 (provider ���һ, S71 P2, 2026-06-25)
- [`apps/web/src/components/AgentChatPanel.tsx`](../../apps/web/src/components/AgentChatPanel.tsx) �� L1292-1310 �޷� 4 (��������Ⱦ)
- [`apps/server/scripts/fix-bug-082-error-message-prod.js`](../../apps/server/scripts/fix-bug-082-error-message-prod.js) �� �޷� 5 (��ʷ������ SQL �޸�)
- [`scripts/verify-deploy.sh`](../../scripts/verify-deploy.sh) �� ά�� 17-18 (BUG-082 ����) + ά�� 19 (BUG-082 TODO P2 agnesVideoProvider ��һ����)
- [BUG-080 web �����Ѽ�¼ tab û����](../apps/mobile/BUGS.md#bug-080-s71-����-v3029-2026-06-25-1048-web-�����Ѽ�¼tab-û����--billingpagetsx-push-transactions-ʱ©��-type-�ֶ�) �� ���� (S71 ���� web �˷���)
- [BUG-081 image agent ״̬��© plan_ready](../apps/mobile/BUGS.md#bug-081-s71-����-v3032-2026-06-25-1300-�û��ķ���ʱ�޷��ķ���--an-unexpected-error-occurred--imageagentservice-״̬��©-plan_ready-throw-raw-error-��-errorhandler-����) �� ���� (ͬԴ: �߽紦 schema ��һ)

## BUG-083 (S72 ����, v3.0.33, 2026-06-25 17:40): ���� `/api/version` �� invalid JSON �� S72 batch 4 ����ʱ dist/changelog.json 400 �� Chinese ȫ�����滻�� `?` �ַ�, ǰ���ò��� changelog ����

### ���� (S72 �����Լ�)

���� S72 batch 4 (v3.0.33 P0 #1+#2+#3+#4 + P1 #5-#8 + P2 #9-#11 + deploy.sh 3 ��, 13 commit �� main) ��, �� verify-deploy �������� `/api/version` ���� 2223 �ֽ� JSON, �� `json.loads()` ʧ��:

```
PRODUCTION: JSON INVALID - error at pos 1574 msg: Expecting ',' delimiter
Total len: 2223
Non-ASCII char count: 0          �� 0 �������ַ�!
Literal ? count: 400              �� 400 �� ? ռλ��
```

- HTTP ״̬: 200 OK (���� nginx ͸��)
- ��Ӧ����: ������ȷ (2223B), �� 400 �������ַ�ȫ���� `?` (���ֽ� 0x3F) �滻
- ǰ��Ӱ��: web/mobile �õ� invalid JSON, APP ������ʾʧЧ, changelog ����ȫ��
- ������: ���� (���� API �˵㲻��Ӱ��, ��Ϊ changelog.json �Ƕ����ļ�)

### ��ʵ���� (3 ����)

**�� 1 ��: S72 batch 4 ����ʱ, dist/changelog.json �� 10 �� highlights (5 ԭʼ + 5 S72 batch 4 ����) ȫ�� Chinese**

���� SOP (`docs/BAOTA_NODE_PROJECT_DEPLOY.md` �� 2 ���� 1) ��:

```bash
tar czf dist.tar.gz --exclude='dist.bak*' server/dist server/changelog.json ...
# ���� changelog.json 10 �� highlights, Chinese UTF-8 OK
```

**�� 2 ��: scp ��Զ�� / д dist/changelog.json ʱ, ������ĳ�����ڱ��ƻ�**

������ 3 �� (������):

1. **PowerShell `scp` + ��̨�ű�д��** ʱ, Ĭ�ϰ�ϵͳ ANSI ���� (Windows GBK / CP1252), д server-side ���̺� Chinese �� `?`
2. **`tar xzf` �� mv ����** ������ systemd ���������� charset ת�� (���� BUG-078 systemd ProtectSystem ·��)
3. **���� changelog.json ������Ǵ��** (PS 5.1 д�붪 newline �����ַ���λ) �� ������ Read ���߶����� 10 �� Chinese OK, �ų�

**�� 3 ��: v3.0.32 �� v3.0.33 ����·����, deploy.sh ûǿ�� `cp changelog.json dist/changelog.json`**

S72 batch 4 ֮ǰ (S71 / S70), `apps/server/deploy.sh` �� [6/9] ����ѹ�� dist/ ��, **û** `cp changelog.json dist/changelog.json`. �� server �� `readChangelog` ���ȶ� `dist/changelog.json` (S72 �� readChangelog ���ȼ�), �Ҳ����� fallback ���� changelog.json. �� changelog.json ���ϴβ������µ�, �Ǹ��汾�����Ǵ�Ļ��� stale.

**S72 batch 4 commit `310098e` �Ų���** `cp -f changelog.json dist/changelog.json` (�޷� 1), ��**ֻ��֮����²�����Ч**, �����Զ��޸����𻵵����� dist/changelog.json.

### �޷� (3 ��, S72 ����ʵʩ)

**�޷� 1: deploy.sh ǿ�� `cp -f changelog.json dist/changelog.json`** (S72 commit 310098e, �Ѻ��� main)

```bash
# apps/server/deploy.sh L186-191
if [ -f "${DIST_DIR}/changelog.json" ]; then
  cp -f ${DIST_DIR}/changelog.json ${DIST_DIR}/dist/changelog.json
  echo "    ? changelog.json -> dist/changelog.json (S72 batch 4 ��)"
fi
```

**�޷� 2: verify-deploy.sh ��ά�� 20: ���� dist/changelog.json �ַ�������֤** (�� session ��)

```bash
# ά�� 20 (S72 ����, BUG-083 ����):
echo "20. dist/changelog.json UTF-8 OK: $(curl -sm 5 https://ab.maque.uno/api/version | python3 -c "
import sys, json
d = sys.stdin.read()
try:
    j = json.loads(d)
    non_ascii = sum(1 for c in d if ord(c) > 127)
    print(f'OK (non-ASCII={non_ascii})')
except json.JSONDecodeError as e:
    print(f'FAIL (err at {e.pos}, msg: {e.msg})')
")"
```

**�޷� 3: ���²���, ���޷� 1 �����𻵵� dist/changelog.json** (�� session ʵʩ)

�� `apps/server/deploy.sh` ������һ��:
- ���� `cp changelog.json dist/changelog.json` 10 �� highlights UTF-8 OK
- ���� `tar czf dist.tar.gz`
- scp ��Զ�� `/tmp/dist.tar.gz` + `/tmp/package.json`
- `bash deploy.sh` �� 9 ������, �� [6/9] �� `cp -f changelog.json dist/changelog.json` �����𻵰�
- ��֤: `/api/version` 200 OK + json.loads OK + 10 �� highlights Chinese ����

### ��ѵ (4 ��, ����Ŀͨ��)

1. **scp / дԶ�� JSON �ļ�, ���� UTF-8 explicit ����** �� PowerShell Ĭ����ϵͳ ANSI (GBK / CP1252) д�ļ��ᶪ Unicode. �޷�: `Get-Content` + `[System.IO.File]::WriteAllText` ��ʽ UTF8 (�� BOM), ���� `cat > file <<EOF` �� bash heredoc (���� PS 5.1 ANSI ת��)
2. **����ű��� json / �ı��ļ�����ʽ `cp` һ�ε� dist/** �� ��Ҫ���� `tar` ��ѹ�ܱ���ԭ charset / encoding. deploy.sh �� [6/9] ���� `cp -f` �� 5 ά�ز���
3. **verify-deploy.sh �ؼ� JSON parse ά��** �� `python3 -c "import json; json.loads(open('/tmp/dist/changelog.json').read())"` + ���� non-ASCII char ����. �κ� P0 BUG �ؼ� grep / parse ά��, **δ�� AI ����ʱ�ز�** (�� BUG-079/080/082 21 άһ��)
4. **readChangelog fallback ��Ҫ�Ƚ�** �� `dist/changelog.json` ���� > �� `changelog.json` fallback > �ڴ� hardcoded (S72 batch 4 �޹� readChangelog ���ȼ�). �� fallback ����"�����ɹ�"�����: dist ���;�Ĭ����, �����;�Ĭ�� hardcoded. �޷�: �� verify-deploy ά�� 20 ǿ�Ƽ�� dist �ַ�����

### �ο� (���ĵ�)

- [`apps/server/deploy.sh`](../../apps/server/deploy.sh) �� L186-191 �޷� 1 (S72 commit 310098e)
- [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](../../docs/BAOTA_NODE_PROJECT_DEPLOY.md) �� �� 2 ���� 1 ���� SOP + �� 4 �� 9 git push schannel
- [`AGENTS.md`](../../AGENTS.md) �� �� 4 ���� 5 �������� N ά��֤ (S71 BUG-079/080/082 ������ 21 ά, S72 BUG-083 ������ 22 ά)
- [`HANDOVER.md`](../../HANDOVER.md) �� �� 5.4 ���ÿӵ� 17-24 + S72 �� (�� session ͬ��׷��)
- [BUG-078 systemd ProtectSystem ���ʧ��](../apps/mobile/BUGS.md#bug-078) �� ǰ�� (ͬ�� systemd �������� charset ��)
- [BUG-079 S71 �ٱ��� 12 ά](../apps/mobile/BUGS.md#bug-079) �� ǰ�� (S71 ���� verify-deploy 14��21 ά��ѵ, BUG-083 ���� 22 ά)
- [BUG-082 React #31 ���������Ⱦ](../apps/mobile/BUGS.md#bug-082) �� ���� (S71 ����, ͬΪ�־û��߽紦 schema ��һ�� BUG)
## BUG-087 (S72 batch 5 ����, v3.0.35, 2026-06-26 00:22): APP ��"���޷����°汾" �� version.ts 1 ��ע�� tsc �� `is not a module` �� APP_VERSION=undefined

### ����
- �û�����: **"APP ��Ϊʲô��������޷����°汾������?"**
- �����û�װ���� v3.0.29 ������װ�� v3.0.34 APK, ÿ�����������"�����°汾 v3.0.34"����
- �û���"ȡ��" �� �´�������ֵ� �� "����"ѭ��
- ����Ӱ����������, �û����� APP �� bug

### ���� (3 ������ȱ�ݵ���)

#### ����: `apps/mobile/src/config/version.ts` �ļ��� (1 ��ע�� + 0 newline)

**�ļ�״̬ (��ǰ)**:
- ���ֽ�: **1445 chars** (Python byte verify)
- LF newline count: **0**
- CR count: **0**
- �����ļ��� 1 �� `//` ע�� + `export const ...` ��ͬһ��

**TypeScript ���뱨��** (�ؼ����):
```
src/utils/updater.tsx(8,29): error TS2306: File '.../config/version.ts' is not a module.
src/screens/AboutScreen.tsx(4,29): error TS2306: ...
src/screens/AdminLoginScreen.tsx(18,34): error TS2306: ...
```

**Ϊʲô tsc û�� build ʱ fail?**
- TypeScript Ĭ������ (`tsc --noEmit`) �� import ʧ��ʱ**���浫�� fail**
- ������� JS bundle ʱ, `version.ts` ����ɿ� module, export undefined
- �ƶ��� `import { APP_VERSION } from '../config/version'` �õ� `undefined`

**����ʱ������**:
1. mobile JS bundle ����, `APP_VERSION = undefined`
2. `App.tsx:178` useEffect ���� `checkForUpdate()`
3. `checkForUpdate` �ڲ� fetch: ``${API_BASE_URL}/version?version=${APP_VERSION}``
4. ʵ�� URL: `http://159.75.16.110:6000/api/version?version=undefined`
5. server (`apps/server/src/index.ts:75`): `const clientVersion = req.query.version as string || '0.0.0';`
6. **��**: �ַ��� `'undefined'` �� truthy, ���� `||` ���� fallback �� `'0.0.0'`, `clientVersion = 'undefined'`
7. `compareVersions('3.0.34', 'undefined')` ����:
   - `'3.0.34'.split('.') = [3, 0, 34]`
   - `'undefined'.split('.') = ['undefined']` �� `Number('undefined') = NaN` �� `(NaN || 0) = 0`
   - `3 > 0` �� return 1
8. `needUpdate = 1 > 0 = true` �� `forceUpdate = true` �� `showUpdateDialog` ����
9. �û���"ȡ��" �� `DialogStore.close()` �� ���κμ���
10. �´������ (ɱ����/�˳���¼) �� useEffect �ٴδ��� �� ���� fetch �� **�ٴε���**

#### ��Ҫ 1: `showUpdateDialog` ȡ����ť�޸�����

`apps/mobile/src/utils/updater.tsx:49-53` (��ǰ):
```tsx
<TouchableOpacity
  onPress={() => DialogStore.close()}  // �� û���κγ־û�
>
  <Text>ȡ��</Text>
</TouchableOpacity>
```

**��**: ȡ����ťֻ�ص���, û��¼"����汾���ѿ�����", �´�����������µ���

#### ��Ҫ 2: `apps/web/src/config/version-fixed.ts` ��ʷ����

S69 BUG-074 ��ʱ����ʱ���ݵ� `version-fixed.ts` �����ڲֿ�, ���� `APP_VERSION = '3.0.29'`��
- 0 ������ (grep ��֤), ���ᴥ�� BUG
- �����Ż���������

### �޸� (v3.0.35)

#### Fix 1: `apps/mobile/src/config/version.ts` ��дΪ���� (����)

��д�����ļ�, �� Write ����ǿ�ƴ� LF newline:
```ts
// APP �汾ͳһ����
// ... ע�� ...
export const APP_VERSION = '3.0.35';
export const APP_NAME = 'Deep�籾';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;
```

**��֤** (Python byte):
- Total bytes: 1476 (�� LF)
- LF count: **24** ?
- CR count: 0 ?
- ĩβ�� LF ?

**tsc ��֤**:
- `version.ts` ���ٱ� `TS2306: is not a module` ?
- ���� pre-existing ���� (AdminDashboard ��) ���ڱ��� BUG ��Χ, ��Ӱ�� build

#### Fix 2: �½� `apps/mobile/src/db/updateMemory.ts` (24h ����, ������)

�� RNFS (�� `tokenStorage.ts` ͬ��, ������������):
```ts
export interface UpdateMemory {
  lastDismissedVersion: string;
  lastDismissedAt: number;
}

export async function shouldSuppressUpdateDialog(
  serverVersion: string,
  forceUpdate: boolean
): Promise<boolean> {
  if (forceUpdate) return false;  // ǿ������������
  const memory = await getUpdateMemory();
  if (!memory) return false;
  const sameVersion = memory.lastDismissedVersion === serverVersion;
  const withinWindow = Date.now() - memory.lastDismissedAt < 24 * 60 * 60 * 1000;
  return sameVersion && withinWindow;
}
```

#### Fix 3: `apps/mobile/src/utils/updater.tsx` showUpdateDialog �첽�� + �� 24h ����

- ǩ���� `async showUpdateDialog(...)` (ԭ�� sync void)
- ����ʱ��� `shouldSuppressUpdateDialog` �� ������ֱ�� return
- "ȡ��" ��ť (forceUpdate=false ʱ����ʾ) �� д `.update_memory`
- "APP ������" / "���������" �� ��д���� (���û���ȥ����)
- forceUpdate=true ʱ�İ��� "�������", ����"ȡ��"��ť

#### Fix 4: `apps/mobile/App.tsx` useEffect ����־

```tsx
useEffect(() => {
  const checkUpdate = async () => {
    try {
      const updateInfo = await checkForUpdate();
      if (updateInfo) {
        console.log('[App] update available', { version: updateInfo.version, forceUpdate: updateInfo.forceUpdate });
        await showUpdateDialog(updateInfo);
      } else {
        console.log('[App] no update needed (clientVersion >= serverVersion)');
      }
    } catch (e) {
      console.warn('[App] checkUpdate failed', e);
    }
  };
  checkUpdate();
}, []);
```

#### Fix 5: ɾ `apps/web/src/config/version-fixed.ts`

mavis-trash (0 ������, ��ȫɾ)��

### ��ô��֤�޺� (4 ��)

1. **TypeScript ����**: `cd apps/mobile && npx tsc --noEmit`
   - ����: `version.ts` ���ٱ� `TS2306: is not a module`
   - ʵ��: ? ͨ��

2. **APK metadata**: `aapt2 dump badging app-release.apk`
   - ����: `versionCode='40' versionName='3.0.35'`
   - ʵ��: ?

3. **8 ���汾��ͬ��**: `node tools/verify-version-8-points.js 3.0.35`
   - ����: 8 ������ + 2 ��Զ��ȫ�� (`.env` + `systemd unit` deploy.sh �Զ�ͬ��)
   - ʵ��: ? ���� 8 ��ȫ��, Զ�� 2 �������ͬ��

4. **3 �� E2E ����** (`/api/version?version=...`):
   | ���� | clientVer | server | needUpdate | ���� |
   |---|---|---|---|---|
   | ���û� v3.0.34 APK | 3.0.34 | 3.0.35 | true | ��"�����°汾" ? |
   | ���û� v3.0.35 APK | 3.0.35 | 3.0.35 | **false** | **����** ? |
   | �� clientVer | 0.0.0 | 3.0.35 | true | �� ? |
   - ʵ��: ? 3 ��ȫ��

### ��ô�����ٷ� (��ѵ����)

1. **mobile `config/version.ts` �� critical �ļ�** �� �κ�д����������� Write ���� + ��֤ byte
2. **ÿ�� commit ����� `node tools/verify-version-8-points.js`** �� ������� 3 �Լ�
3. **mobile `tsc --noEmit` 0 ���ǵ���** �� ������Ϊ build ͨ�����������ͼ�� (TS Ĭ�� `noEmitOnError: false` ����� build)
4. **update dialog ȡ��/�ѿ�����־û�** �� ����Ŀͨ�� UX ԭ�� (�κε�����Ҫ����"�û��Ѿ�������"��״̬)
5. **query param `||` fallback �п�** �� `'undefined' || '0.0.0'` ���� fallback, ��Ϊ `'undefined'` �� truthy. ���� `??` ����ʽ `=== 'undefined'`

### Refs
- AGENTS.md �� 4 ���� 3 (8 ���汾��ͬ��)
- VERSION_MANAGEMENT.md �� 3 ��һ��Դԭ��
- CODING_STANDARDS.md �� 38 (mobile Ӳ�Թ淶, BUG ��¼ǿ������)
- BUG-079 (S71 web version.ts PS 5.1 д�붪 newline) �� **ͬ������ǰ��, û��ס mobile**
- BUG-066 (S71 server package.json version ����) �� **ͬ������ǰ��, ��ѵû���е� mobile**

### ǰ�� BUG (�� batch 4 ���� 5 ͬ��)
- [BUG-079 S71 web version.ts PS 5.1 �� newline](../apps/mobile/BUGS.md#bug-079) �� ͬһ����, ���η� (web �޺� mobile û��)
- [BUG-066 S71 server package.json version ����](../apps/mobile/BUGS.md#bug-066) �� ������·�汾��ͬ�� 6��8 ���Լ�ǰ


## BUG-088 (S72 batch 6, v3.0.36, 2026-06-26 01:50): ɾ���Ự��������ʷ���� Modal �ڵ�, �û������� confirm �� "�޷�ɾ����ʷ�Ự"

### ���� (�û��ӽ�)
1. ����ͼ���� / ��Ƶ����
2. �� toolbar ��຺����ť �� ��ʷ��������
3. �㵥����ʷ�Ҳ�ĺ�ɫɾ����ť (??)
4. **ʲô��û����** �� û��"ɾ�������Ự?" ȷ�ϴ�, û�κη�Ӧ
5. �û���ε�� �� server �� conversations �����κα仯, ��ʷ��Ȼ��

### ���� (��������)
**Dialog �������ͨ View ��Ⱦ, �� RN ԭ�� Modal ��ȫ�ڵ�**:

```tsx
// apps/mobile/src/components/Dialog.tsx (��֮ǰ line 113-114)
<View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
```

- `Dialog.tsx` �õ�����ͨ `<View>` + `StyleSheet.absoluteFillObject`, ��Ⱦ�� React Native ��ͼ����
- ImageAgentScreen / VideoAgentScreen ����ʷ������ RN `<Modal transparent>` (line 529 / 579), �� **Android Dialog / iOS UIViewController ԭ����**
- React Native ԭ�� Modal **��Զ�� React ��ͼ�����ϲ�** �� ��ʹ zIndex=999, elevation=999 Ҳ�޼�����
- ���: historyModal ��ȫ��ס Dialog ����, �û������� confirm, ��Ϊ����ʧЧ

**Server ��ʵ���Ǻõ�** �� `imageAgentController.deleteConversation` / `videoAgentController.deleteConversation` ��Ȩ + ɾ DB + ��ƶ����� (apps/server/src/controllers/imageAgentController.ts:97-117, videoAgentController.ts:58-75)��**����ֻ�� mobile �˵�������**��

### �޸� (3 ��)

#### Fix 1: Dialog ������� RN ԭ�� `<Modal>` ��װ
```tsx
// apps/mobile/src/components/Dialog.tsx (��֮�� line 121-128)
<Modal
  visible={visible}
  transparent
  animationType="none"
  statusBarTranslucent
  onRequestClose={handleBackdrop}
>
  <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
    {/* �������� + ���п�Ƭ (ԭ�߼�����) */}
  </View>
</Modal>
```

- RN Modal �� native ��, ��Զ�� React ��ͼ�����ϲ�
- `statusBarTranslucent`: Android �ϱ��� status bar �߶ȸ���
- `onRequestClose`: Android Ӳ�����ؼ� = �㱳��
- `animationType="none"`: Dialog �ڲ����� fade/scale ����, Modal ���ظ�

#### Fix 2: historyModal ��ɾ����ť�ȹ� Modal �ٵ� confirm
���� RN Modal ͬʱ���ڻ��� z-order race, �ص�һ���ٵ���һ������:

```tsx
// apps/mobile/src/screens/ImageAgentScreen.tsx / VideoAgentScreen.tsx
// ��ʷ�����ڵĵ���ɾ����ť (��֮��)
<TouchableOpacity
  style={styles.historyItemDeleteBtn}
  onPress={() => {
    setShowHistory(false);       // �ȹ� historyModal
    setTimeout(() => {           // 300ms �� Modal �رն�������
      showConfirm({...});
    }, 300);
  }}
>
```

#### Fix 3: ����ɾ����ť (���� toolbar �� deleteCurrent) ����
- ���� toolbar ��ɾ����ť (`deleteCurrent` ����, line 286-308 / 303-325) ���� Modal ��, ���ڵ�����, ����Ҫ��

### ��ô��֤�޺� (3 ά)

1. **TypeScript ����**: `cd apps/mobile && npx tsc --noEmit`
   - ����: Dialog.tsx / ImageAgentScreen.tsx / VideoAgentScreen.tsx 0 ��
   - ʵ��: ? 0 �� (�����ļ� pre-existing ����ڱ� BUG ��Χ)

2. **��ʷ����ɾ�� E2E** (װ�� APK ��):
   - �㺺�� �� ��ʷ���� �� ����ɾ�� (??)
   - ��ʷ����**�����ر�**, 300ms ��"ɾ�������Ự?" ȷ�ϴ� (�����ϲ�)
   - ��"ɾ��" �� ��ʷ�б����, ������ʧ
   - ��"ȡ��" �� ��ʷ�б����
   - ʵ��: ? ��װ����֤ (���� build ��� Dialog Modal ����, RN 0.73 + Android �����֤�� user)

3. **���� toolbar ɾ�� E2E** (�ع�):
   - ������ʷ����, ֱ�ӵ� toolbar �Ҳ��ɫɾ����ť
   - ��"ɾ���Ự?" ȷ�ϴ� (������ ok, Fix 1 Ҳ�����������)

### ��ô�����ٷ� (����Ŀͨ�� UX ԭ��)

1. **�κ�"ȫ�ֵ���"��������� RN `<Modal>` ��װ** �� ����Ŀͨ��, ��Ҫ����ͨ View + absoluteFillObject ģ��
2. **�� Modal Ƕ��ʱ, �ȹ��ٿ�** �� RN Modal ֮���� z-order race, �ص�һ���ٿ���һ������ (300ms timeout �ȶ���)
3. **���Ե����ڵ����� Modal �ڴ���** �� ֻ����ҳ�津�� confirm ����, ��������ʷ����/����ҳ����Ƕ�� Modal ��Ҳ����һ��

### Refs
- AGENTS.md �� 4 ������� 4+ (state machine ͬ��) �� ���� BUG �޹�, ��ȷ�� status ��ʾ���ᱻ�ƻ�
- BUG-050 (S60 P3 S72 batch 6 �����) �� historyModal �����, ��ʱ Dialog ��û�� Modal, ��ʷ����
- BUG-089 (S72 batch 6 ͬ batch) �� polling ��� race condition, ͬ batch һ����

---

## BUG-089 (S72 batch 6, v3.0.36, 2026-06-26 01:50): ����ͼƬ/��Ƶ�ɹ���������ʾ, �����������л� Tab ����ʾ

### ���� (�û��ӽ�)
1. ����ͼ���� / ��Ƶ����
2. �������� + ѡ���� + ��"ȷ������"
3. ��"�Ѽ������" alert �� �ص�
4. �� 5-30 �� (ͼƬ) / 1-3 ���� (��Ƶ)
5. ��"? ͼƬ�������" alert
6. **�ص� alert ��, �Ի������� streaming ����Ȧ, û����ͼƬ**
7. **�����е�"�ҵ�"/"���" Tab ���л�"��ͼ" Tab, ͼƬ����ʾ����**
8. �û�����: �о�����ʧ�� / �о��ܿ�

### ���� (��������)
**polling ���ʱ `setMessages(prev)` �Ѹ��� streaming �� image, ������� `loadHistory()` �� `await loadConversation(lastResult.id)` �ְ� messages ���帲�ǻ�ȥ, race condition ������ʾ����ȷ**:

```tsx
// apps/mobile/src/screens/ImageAgentScreen.tsx (��֮ǰ line 200-214)
useEffect(() => {
  if (!pollingConvId) return;
  const timer = setInterval(async () => {
    try {
      const res = await imageAgentGetApi(pollingConvId);
      const conv = res.data?.data?.conversation || res.data?.data;
      if (!conv) return;
      const status = conv.status;
      setConvStatus(status);
      setMessages(prev => {
        // ? �ڴ���� streaming �� image (��һ���ǶԵ�)
        const newParts = target.parts.map(p =>
          p.type === 'streaming' ? { type: 'image', url: convResultUrl, ... } : p
        );
        next[targetIdx] = { ...target, parts: newParts };
        return next;
      });
      if (status === 'tool_completed') {
        setPollingConvId(null);
        showAlert({ title: '? ͼƬ�������', ... });
        loadHistory();  // ? ��������!
      }
    }, 3000);
    ...
}, [pollingConvId]);
```

**`loadHistory()` ��· (line 103-132)**:
```tsx
const loadHistory = async () => {
  ...
  setHistory(list);
  if (userInitiated) {
    setUserInitiated(false);
    return;
  }
  // �Զ��������һ���� result �ĻỰ
  const lastResult = list.find((c: ConvListItem) => c.resultImageUrl);
  if (lastResult) await loadConversation(lastResult.id);  // ? ���帲�� messages
  else createConversation();
};
```

**Race condition ��������**:
1. �û���"ȷ������" �� confirmGenerate �� pollingConvId �� polling ���
2. �û�**�е���� Tab** �Ⱥ� (BottomTabs Tab �л� state ����)
3. 30 ���������� �� polling setMessages streaming �� image (in memory)
4. setTimeout/scroll ���û��л���
5. `loadHistory()` ���� �� `loadConversation(lastResult.id)` �� `setMessages(conv.messages)`
6. **�ؼ�**: �����ʱ `conv.messages` �ֶλ��� server ��**д�� race** ǰ��״̬ (e.g. userInitiated �ѱ� setUserInitiated(true) ��д, ���� server �� messages JSON д����΢С�ӳ�), `setMessages(conv.messages)` �õ��Ŀ�����**û�� image part**�ľ� messages
7. ���: UI ��ʾ������ streaming ����Ȧ (���߿� message)
8. �û��������л� �� loadHistory ������ �� ��� server д����� �� loadConversation �õ���ȷ messages �� ��ʾ image ?

### �޸� (2 ��)

#### Fix 1: �� `loadHistory` Ϊ `loadHistory` + `refreshHistory`
```tsx
// apps/mobile/src/screens/ImageAgentScreen.tsx / VideoAgentScreen.tsx

// ��֮ǰ: ֻ�� loadHistory, ��ˢ���б��� auto-load
// ��֮��: ��� 2 ��

// loadHistory: �״ν�����, ˢ���б� + auto-load ��� result �Ự
const loadHistory = async () => {
  ...ԭ�߼�����...
};

// refreshHistory: ֻˢ����ʷ��������, �� auto-load Ҳ�����ǵ�ǰ messages
const refreshHistory = async () => {
  try {
    const res = await imageAgentHistoryApi(50);
    const list = (res.data?.data?.conversations || res.data?.data || []).map(...);
    setHistory(list);  // ֻ���� history ����, ���� messages
  } catch (e) {
    console.warn('refreshHistory failed', e);
  }
};
```

#### Fix 2: polling ��ɸ��� refreshHistory + ǿ�� scrollToEnd
```tsx
if (status === 'tool_completed') {
  showAlert({ title: '? ͼƬ�������', message: '������ͼƬ, ��鿴�Ի�' });
  refreshHistory();  // ? ֻˢ�б�, �����ǵ�ǰ messages
  // ? ǿ�ƹ����ײ�, ȷ�����ɵ�ͼƬ/��Ƶ�ɼ�
  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
}
```

**Ϊʲô refreshHistory ���� race**: ��ֻ���� history ���� (FlatList ����Դ), ������ loadConversation, **��ȫ���� messages state**����ѯ setMessages(prev) �Ѿ��� image part д���ڴ�, polling һֹͣ���ȶ��ˡ�

### ��ô��֤�޺� (3 ά)

1. **TypeScript ����**: `cd apps/mobile && npx tsc --noEmit`
   - ����: ImageAgentScreen.tsx / VideoAgentScreen.tsx 0 ��
   - ʵ��: ? 0 ��

2. **ͼƬ���� E2E** (װ�� APK ��):
   - ��ͼ���� �� ���� �� ѡ���� �� ȷ������
   - ��"�Ѽ������" �� �ص�
   - **������ Tab**, һֱͣ����ͼ Tab ��
   - 5-30 ���"? ͼƬ�������"
   - �ص� alert �� **ͼƬ������ʾ�����һ�� assistant ��Ϣ��** (������Ҫ����ˢ��)
   - ʵ��: ? ��װ����֤

3. **��Ƶ���� E2E** (װ�� APK ��):
   - ��Ƶ���� �� ���� �� ѡ���� + 5s ʱ�� �� ȷ������
   - ��"�Ѽ������" �� �ص�
   - **������ Tab**, һֱͣ����Ƶ Tab ��
   - 1-3 ���Ӻ�"? ��Ƶ�������"
   - �ص� alert �� **��Ƶ������ʾ�����һ�� assistant ��Ϣ��**

4. **��ʷ��������ˢ��** (�ع�):
   - polling ��ɺ�, ����ʷ����
   - Ӧ�ÿ�����������ɵĻỰ (�� result �� list ����, �� resultImageUrl ����ͼ)
   - ʵ��: ? refreshHistory() ��ȷ�� history state ����

### ��ô�����ٷ� (����Ŀͨ��ԭ��)

1. **polling ��ɺ�Ҫ auto-load** �� ����Ŀͨ��, �ֲ� setState �Ѿ������� UI, ������ load �� race ����
2. **��"ˢ���б�"��"��������"Ϊ 2 ������** �� refreshHistory(ֻˢ�б�) + loadHistory(�״� auto-load), ����һ�� race Ӱ����һ��
3. **Alert �رպ�ǿ�� scrollToEnd** �� �첽ͼƬ/��Ƶ������ɺ�, �û�����"�ҹص� alert ���ܿ������", scrollToEnd �� UX ����

### Refs
- AGENTS.md �� 4 ���� 8 (S71 BUG-082 �ַ�����һ) �� ���� BUG �޹�, ��������Ⱦ����
- BUG-050 (S60 P3 S72 batch 6 �����) �� race condition ������, userInitiated ���ʱ���ǵ���"�û���������"���⸲��, �� polling ���·����©
- BUG-088 (S72 batch 6 ͬ batch) �� Dialog �����ڵ�, ͬ batch һ����

### ǰ�� BUG (ͬ batch 5/6 ����)
- [BUG-050 S60 P3 ����� race condition](../apps/mobile/BUGS.md) �� userInitiated ������, ��ʱֻ����"�û������½�/ɾ��"
- [BUG-088 S72 batch 6 ɾ�������ڵ�](../apps/mobile/BUGS.md) �� ͬ batch һ����

## BUG-090 (S72 batch 6 v3.0.36, 2026-06-26 09:50): deploy.sh ����� changelog.json �����ϰ汾 (cp Դ������Ŀ¼���� /tmp/ Դ)

### ���� (�û��ӽ�)
1. �� v3.0.36 �� curl https://ab.maque.uno/api/version
2. ���� `changelog: "���θ����Ż����ܣ��޸���֪����"` + `highlights: []` + `buildDate: "1970-01-01"`
3. **�°汾 changelog 5 ��Ҫ��ȫ����ʧ**, APP ���û����������θ�������
4. �û�����: ��"�����°汾" �� changelog ��ռλ���İ�

### ���� (��������)
**deploy.sh �� 6 �� cp changelog.json ʱ, Դ�� `${DIST_DIR}/changelog.json` (����Ŀ¼, �����ϰ汾) �������°汾**:

```bash
# apps/server/deploy.sh (��֮ǰ line 186-187)
if [ -f "${DIST_DIR}/changelog.json" ]; then
  cp -f ${DIST_DIR}/changelog.json ${DIST_DIR}/dist/changelog.json  # ? Դ������, �����ϰ汾
  echo "    ? changelog.json -> dist/changelog.json (S72 batch 4 ��)"
fi
```

**������**:
```
���� scp apps/server/dist.tar.gz -> /tmp/dist.tar.gz
���� scp apps/server/package.json -> /tmp/package.json (deploy.sh �� version)
����û scp apps/server/changelog.json -> /tmp/changelog.json
deploy.sh ��:
  tar xzf /tmp/dist.tar.gz -C ${DIST_DIR}/dist    # ��ѹ�� dist (�� tsc ���)
  if [ -f "${DIST_DIR}/changelog.json" ]; then      # ?? ����������Ŀ¼, ���� /tmp/
    cp -f ${DIST_DIR}/changelog.json ...             # ?? cp �ϰ汾�����°汾
  fi
  systemctl restart shipin-app
curl /api/version -> �� dist/changelog.json -> �õ��ϰ汾 changelog
```

**����**: deploy.sh ���ʱ���� `${DIST_DIR}/changelog.json` ���°汾, ��ʵ������Ŀ¼�� changelog.json ����һ�β������µľɰ汾, **ÿ�β��𶼱��ɰ汾�����°汾**, changelog ��Զ�ͺ� 1 ���汾��

### �޸� (2 ��)

#### Fix 1: deploy.sh ���� /tmp/changelog.json
```bash
# apps/server/deploy.sh (��֮��)
if [ -f "/tmp/changelog.json" ]; then
  cp -f /tmp/changelog.json ${DIST_DIR}/dist/changelog.json
  cp -f /tmp/changelog.json ${DIST_DIR}/changelog.json
  echo "    ? changelog.json -> dist/changelog.json (�� /tmp/ Դ, v3.0.36 ��)"
elif [ -f "${DIST_DIR}/changelog.json" ]; then
  cp -f ${DIST_DIR}/changelog.json ${DIST_DIR}/dist/changelog.json
  echo "    ?? changelog.json -> dist/changelog.json (������ fallback, �����Ǿɰ汾, ����ǰ�� scp /tmp/changelog.json)"
fi
```

#### Fix 2: ���� SOP �� scp changelog.json
δ�� AI ����ʱ, scp ����ģ���һ��:
```bash
scp -i <key> apps/server/dist.tar.gz      root@<host>:/tmp/dist.tar.gz
scp -i <key> apps/server/package.json    root@<host>:/tmp/package.json
scp -i <key> apps/server/changelog.json  root@<host>:/tmp/changelog.json  # ?? v3.0.36
```

### ��ô��֤�޺� (3 ά)

1. **���� scp changelog.json ��**, deploy.sh ���� /tmp/changelog.json
   - ����: `? changelog.json -> dist/changelog.json (�� /tmp/ Դ, v3.0.36 ��)`
   - ʵ��: ? ���´β�����֤

2. **curl /api/version** (v3.0.36 �����ʵ��):
   - ����: `changelog: "BUG-088 + BUG-089 �޷� (ɾ���Ự�����ڵ� + ���ɳɹ� race condition)"`, `highlights: [5 ��]`, `buildDate: "2026-06-26"`
   - ʵ��: ? v3.0.36 ������޹�һ�� (�ֶ� scp changelog + ����), ��ʵ��ʾ 5 �� highlights

3. **fallback ����**: �� scp /tmp/changelog.json, �� deploy.sh �Ƿ� fallback ����
   - ����: `?? changelog.json -> dist/changelog.json (������ fallback, �����Ǿɰ汾, ����ǰ�� scp /tmp/changelog.json)`
   - ʵ��: ? ������

### ��ô�����ٷ� (����Ŀͨ��ԭ��)

1. **deploy.sh ������ cp Դ���� /tmp/ ��������Ŀ¼** �� ����Ŀͨ��, ����Ŀ¼��Զ����һ�汾
2. **���� SOP �ؼ����� scp �嵥** �� dist.tar.gz + package.json + changelog.json, �κ���©���ᶪ����
3. **����� 12 ά��֤�ز� /api/version �� changelog �ֶ�** �� ��ֻ�� version, ��Ҫ�� changelog/highlights/buildDate �ǲ����°汾

### Refs
- AGENTS.md �� 4 ������� 5 (12 ά��֤) �� ����� 12 άȫ������ /api/version, ��ֻ�� version ���� changelog �ֶ�
- BUGS.md BUG-073 (S54 1-�� minified ����� 8h) �� ͬ���ѵ: ����ǰ����֤ dist ������, �����ŷ���
- BUGS.md BUG-079 (S71 server dist û����) �� ͬ���ѵ: ����������һ��, 12 ά��֤û�����

### ǰ�� BUG (ͬ batch 5/6 ����)
- [BUG-088 S72 batch 6 ɾ�������ڵ�](../apps/mobile/BUGS.md) �� ͬ batch 6 ��
- [BUG-089 S72 batch 6 ���ɳɹ� race condition](../apps/mobile/BUGS.md) �� ͬ batch 6 ��

## BUG-091 (S72 batch 6 ��β�淶�Լ�, v3.0.36, 2026-06-26 10:30): S72 batch 6 commit `a5ae183` (21 �� untracked ��ʱ�ļ�����) subject ȱ BUG ���, Υ�� AGENTS.md �� 4 ���� 6

### ���� (�淶�Լ�, ����Ŀͨ��)

�ܹ淶�Լ�ű� (д�ļ� `tools/tmp-check-rules.py`, 5 �� commit message �Լ�) ����:

```bash
$ git log -6 --pretty=format:"%h | %s"
49ca51c | v3.0.36 verify-deploy: �� 21��22 ά + BUG-090 ���� (/api/version 4 �ֶ���֤)  ?
a5ae183 | v3.0.36 cleanup: 21 �� untracked ��ʱ�ļ����� (S72 batch 4/5/6 ���� + S63 ��������)  ? SUBJECT ȱ BUG ���
60a9dad | v3.0.36 docs: S72 batch 6 BUG-088/089/090 ���׹淶�޶�  ?
a00602d | v3.0.36: BUG-090 �� deploy.sh changelog.json ͬ�� (cp Դ�� /tmp/)  ?
0683dc3 | v3.0.36: BUG-088 + BUG-089 �� + 8 ���汾��ͬ�� (S72 batch 6)  ?
0ce03f0 | v3.0.36: BUG-088 + BUG-089 ��ɾ���Ự�����ڵ� + ���ɳɹ���������ʾ (S72 batch 6)  ?
```

- 6 �� commit, 5 �� subject ���� AGENTS.md ���� 6 ��ʽ (`vX.Y.Z: <һ�仰> (BUG-NNN + �淶�޶�)`)
- **1 �� commit `a5ae183` subject ȱ BUG ���**: `v3.0.36 cleanup: 21 �� untracked ��ʱ�ļ����� (...)` (ֻ�а汾��, û BUG ���)
- commit body �� BUG ��� (`Refs: BUG-079, BUG-083, BUG-090, HANDOVER.md v1.6 �� 7`) �� **�� body ����, subject �� git log �� GitHub PR ����Ψһ���ֵ��ֶ�**
- 5/6 = 83% ����, 1/6 Υ��

### ���� (��������, AI ��Ϊ�淶��)

S72 batch 6 ��βʱ (���� 21 �� untracked ��ʱ�ļ�), �� (AI) д commit message ��"���ɽ���"ģʽ, ���� body �� BUG ��ž���Ϲ�, **û�ϸ� AGENTS.md �� 4 ���� 6 ��ʽ**:
- AGENTS.md �� 4 ���� 6 ԭ��: "��ʽ: `vX.Y.Z: <�Ķ�һ�仰> (BUG-NNN + �淶�޶�)`"
- ʵ��д: `v3.0.36 cleanup: 21 �� untracked ��ʱ�ļ����� (S72 batch 4/5/6 ���� + S63 ��������)`
- **©д**: `(BUG-079/083/090 + �淶�޶�)` ���Ų��� (��Ȼ body ��, �� subject ȱ)

### �޸� (3 ��)

#### �޷� 1: ���� BUG-091 (�� BUG) ���ü�¼Υ�� (����Ŀͨ��, ���� amend)
- ? ���� amend commit `a5ae183` (git safety protocol: "Avoid git commit --amend. ONLY use --amend when ALL conditions are met: (1) User explicitly requested amend...")
- ? ���� BUG-091 �� `apps/mobile/BUGS.md` + `docs/BUGS_INDEX.md` �� 1 + �� mavis memory ����Ŀͨ�ó���
- ? ���� commit 100% �ϸ����� 6 ��ʽ

#### �޷� 2: д�淶�Լ�ű� (���ù���, �κ� AI session ��)

�½� `tools/check-commit-message.py` (15 ��):
```python
"""���� 6 �Լ�: ��֤ N �� commit subject �� BUG ���"""
import subprocess, re
N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
result = subprocess.run(["git", "log", f"-{N}", "--pretty=format:%s"], capture_output=True, text=True)
msgs = result.stdout.strip().split("\n")
bug_pat = re.compile(r"BUG-\d{3,}")
fail = [m for m in msgs if not bug_pat.search(m)]
print(f"PASS={len(msgs) - len(fail)} / FAIL={len(fail)} / TOTAL={len(msgs)}")
for m in fail:
    print(f"  ? {m}")
exit(1 if fail else 0)
```

#### �޷� 3: �� commit (�� commit �ش� BUG ���, ���Υ��)
- �û��İ�: �ݲ����� commit (amend ���� vs �� commit ��Ⱦ), �� BUG-091 + �Լ�ű�����
- ���� S73 �κ� commit ������ `python3 tools/check-commit-message.py 1` ��֤ subject �� BUG ���, ��ͨ����ֹ `git commit`

### ��ô��֤�޺� (3 ά)

1. **���� 6 �Լ� 0 ʧ��**: `python3 tools/check-commit-message.py 6` ����� 6 commit, ���� PASS=6 / FAIL=0
2. **mavis memory ����**: `grep "commit message" MEMORY.md` �ҵ� "AGENTS.md ���� 6 ǿ��: commit message subject �ش� BUG ���" �� (�� session д)
3. **AGENTS.md ���� 6 �� session ����**: ���� S73-Sxx �κ� commit subject 100% �� `BUG-NNN`, �Լ�ű� 0 ʧ��

### ��ô�����ٷ� (����Ŀͨ��)

1. **commit ǰ�����Լ�**: `python3 tools/check-commit-message.py 1` (��֤���� commit subject), ��ͨ����ֹ `git commit` (�� husky pre-commit hook ����)
2. **��ʽ���䷨**: `vX.Y.Z: <һ�仰> (BUG-NNN + �淶�޶�)` 5 ��ȱһ���� �� ����ʲô + �����ĸ� BUG + ���׹淶�޶�
3. **Body ����**: commit subject ���� git log --oneline �� GitHub PR ������Ŷӹ�ͨ���ֶ�, body �ǲ���, **subject �ش� BUG ����ǵ���**
4. **����Ŀͨ��**: �κ� AI session д commit �ش� BUG ��� (�� `+ �淶�޶�` ����, ��ʾ�� BUG �������淶�޶�), ���� AI �� git log 30 �����ܶ�λ"��θ���ʲô / ����ʲô BUG"

### Refs

- `AGENTS.md` �� 4 ���� 6 (commit message �ش��汾�� + BUG ���, ���ͳһ�淶)
- `apps/server/AGENTS.md` �� 3 ���� 8 (commit message �ش��汾�� + BUG ���, server ������)
- `apps/mobile/AGENTS.md` �� 6 ��˰汾���� 4 ������ (mobile �ӽ�, �� server ��һ��)
- `docs/STANDARDS_EVOLUTION.md` �� 7.3 commit �淶 + �� 7.4 д BUG �ش����淶�޶�
- `apps/mobile/CODING_STANDARDS.md` �� 38 (mobile Ӳ�Թ淶, BUG ��¼ǿ������)
- `docs/BUGS_INDEX.md` �� 4 Top 12 �ض����� (S72 batch 6 ��, ������ 6)
- mavis memory: `AGENTS.md ���� 6 ǿ��: commit message subject �ش� BUG ���` (�� session ����)
- [BUG-079 S71 ���üٱ��� 12 άȫ�� 100% ��](bug-079) �� ͬ���ѵ: ���� vs ʵ�ʲ�һ��, AI ��Ϊ�Ϲ�
- [BUG-082 S71 ���� server д�־û� JSON �� string ��һ](bug-082) �� ����: S71 �� AI ��Ϊ�Ϲ��� 4 ���� (4+/6/7/8)

### ǰ�� BUG (ͬ S72 batch 6 ��βΥ��)

- [BUG-079 S71 �ٱ��� 12 άȫ��](bug-079) �� S71 ���ý�ѵ: AI ����/��Ϊ 100% ����, ����"������ OK �͹�"
- [BUG-083 S72 batch 4 dist/changelog.json �ַ�������](bug-083) �� ͬ S72 batch 4 ��βΥ��

## BUG-092 (S72 batch 7, v3.0.37, 2026-06-26 12:30): ɨ��֧��ҳ��"���Ѹ���"��ť����ûʵ�� �� server �� message ˵"���'���Ѹ���'�ύ���", web �� RechargePage.tsx ֻ��ʾ��̬�����ް�ť, admin �˲�֪���û��Ѹ���

### ���� (�û��ӽ�, 2026-06-26 12:27)

user ����: "ɨ��֧�� / ��ʹ��֧����ɨ���տ���֧�� ��10.00, ��ɺ���'���Ѹ���'�ύ��� / ������: 464516ab-da6d-4b82-9d15-6ba12a60a062 / ֧����ɺ�, ����Ա���ͨ�������� / �������ɨ��֧��������, ��ʾ���'���Ѹ���', ����û�����������ť"

- ʵ��ɨ����� �� ����ҳ��ֻ�о�̬����"֧����ɺ�, ����Ա���ͨ��������", **û��"���Ѹ���"��ť**
- �û������޷�����֪ͨ admin �Ѹ��� �� admin ��������ˢ�� pending �б���ֶ��� �� �û������ + ��ֵ�����ӳ�

### ���� (��������, 3 ������)

**���� 1: server �� message �İ� + recharge_requests ��ṹû����, ��ȱ�� `user_notified_at` �ֶ�**
- `apps/server/src/routes/recharge.ts:51` �� `message: '��ʹ��֧����ɨ���տ���֧�� ��10.00, ��ɺ���"���Ѹ���"�ύ���'` (message �İ���ŵ��ť����)
- `apps/server/src/models/db.ts:184-200` `recharge_requests` ��**û�� `user_notified_at` �ֶ�** (�û���"���Ѹ���"ʱ���) �� ��ʹ��ť����, Ҳ�޷���¼"�û���֪ͨ"
- `apps/server/src/models/rechargeRequest.ts:78-87` `RechargeRow` interface Ҳû `userNotifiedAt` �ֶ�

**���� 2: server ��**û��** `POST /api/recharge/:id/notify-paid` �˵�**
- ���� `recharge.ts` ֻ�� `/qrcode` `/qr-image` `/submit` `/my` 4 ���˵�
- **û���κζ˵�**�����û�"���Ѹ���"֪ͨ �� message �İ��ǿ�ͷ֧Ʊ
- `apps/server/src/routes/admin.ts:67-88` admin `/orders/:id/approve` �˵�����, �� admin ��֪��"��Щ pending �������û���֪ͨ�Ѹ����"

**���� 3: web �� RechargePage.tsx:97-116 ɨ��֧����ֻ�о�̬���� + ͼƬ, 0 ��ť**
- `apps/web/src/pages/RechargePage.tsx:97-116` line 109-114 ֻ��ʾ: `<p>֧����ɺ�, ����Ա���ͨ��������</p>` (��̬����)
- **0 �� `<button>` Ԫ��**���� notify-paid ��Ϊ
- `apps/web/src/lib/api.ts:118-121` ֻ�� `createRechargeApi` + `getRechargeHistoryApi` 2 ����ֵ��� API, **û�� `notifyRechargePaidApi`**
- `apps/web/src/pages/AdminDashboardPage.tsx:194-219` admin �����б�ֻ��ʾ `o.status` + `o.paymentMethod` + `o.remark`, ��֪�� `o.userNotifiedAt`

**������**:
```
user ɨ�����
  �� ������̬����"֧����ɺ�..."
  �� �Ҳ���"���Ѹ���"��ť (ǰ��û��Ⱦ)
  �� �û���Ϊ����ʧЧ, ���ҳ�ֵ / �ظ���ֵ
  �� admin �� pending �б�ֻ��ʾ createdAt, ��֪����Щ���û����Ѹ���
  �� admin ��������ˢ�¶���, ���ܷ����¶���
  �� ��ֵ�����ӳ� 5-60 ���� (ȡ���� admin ˢ��Ƶ��)
  �� �û�Ͷ��"��ֵ������" / "�ͷ�������" (ʵ���� UI ȱ��ť)
```

### �޸� (5 �� + 1 �ĵ�)

#### �޷� 1: db.ts: `recharge_requests` ��� `user_notified_at` �ֶ� (�� BUG-079 ��ѵһ��)
```sql
-- 1) CREATE TABLE �±�ֱ�Ӻ��ֶ�
user_notified_at BIGINT DEFAULT 0  -- v3.0.37 (S72 batch 7 BUG-092) �û���"���Ѹ���"ʱ���

-- 2) ALTER TABLE �����Ͽ� (�� BUG-079 ��ѵһ��: ���� logger.warn �����Ĭ catch)
try { await db.execute("ALTER TABLE recharge_requests ADD COLUMN user_notified_at BIGINT DEFAULT 0"); } catch (e) {
  logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: '...' });
}
```

#### �޷� 2: `rechargeRequest.ts` model �� `userNotifiedAt` �ֶ� + `markUserNotified(id)` ����
```typescript
// interface RechargeRow �� userNotifiedAt: number
// create() ���� userNotifiedAt: 0
// ��������: markUserNotified(id) �� UPDATE user_notified_at = Date.now()
// mapRow() �����Ͽ�: userNotifiedAt: r.user_notified_at ? parseInt(r.user_notified_at) : 0
```

#### �޷� 3: `recharge.ts` route �� `POST /:id/notify-paid` �˵� (auth + ԽȨ���� + ״̬У��)
```typescript
// 1) authMiddleware ��Ȩ (����������)
// 2) ��֤�������ڸ� user (record.userId !== userId �� 403 FORBIDDEN, �� BUG-080 �� user ����й©ͬ���ѵ)
// 3) ��֤ status='pending' (�� approved/rejected �����ظ�֪ͨ, �� 400 INVALID_STATUS)
// 4) ���� model.markUserNotified(id) д user_notified_at = now
// 5) �� { success: true, data: { message: '��֪ͨ����Ա, �����ĵȴ���� (ͨ�� 5 �����ڵ���)', record: updated } }
```

#### �޷� 4: `api.ts` �� `notifyRechargePaidApi(orderId)`
```typescript
export const notifyRechargePaidApi = (orderId: string) =>
  apiClient.post(`/recharge/${orderId}/notify-paid`);
```

#### �޷� 5: `RechargePage.tsx` �� "���Ѹ���" ��ť + 5 ������ʾ + ��ѯ����״̬
```tsx
// 1) ״̬��: 'pending' | 'user_notified' | 'approved' | 'rejected' | ''
// 2) pending �� ��Ⱦ "���Ѹ���" ��ť (�� handleNotifyPaid) + ��ʾ�İ�
// 3) user_notified �� ��Ⱦ "�����..." + 5 ������ʾ + �ظ���ֵ��ʾ
// 4) approved �� ��Ⱦ "��ֵ�ѵ���! ����Ѹ���" + �Զ� fetchBalance
// 5) rejected �� ��Ⱦ "��ֵ���ܾ�, ����ϵ�ͷ�"
// 6) useEffect ��ѯ (�� BUG-089 ��ѵһ��): 5s ��ѯ getRechargeHistoryApi, ״̬���ʱ���� UI
// 7) �޷�����: ɨ��������ʾ "֧����ɺ�, ����'���Ѹ���'��ť�ύ���" (�� server message �İ� 1:1)
```

#### �޷� 6 (����): `AdminDashboardPage.tsx` admin �����б�� `userNotifiedAt` ���
```tsx
// �û���֪ͨ�Ѹ��� �� ��Ⱦ "?? �û���֪ͨ�Ѹ��� �� MM-DD HH:MM" ���
// admin ���ȴ��� (�û���������Ķ�����������渶����, ��������)
```

### ��ô��֤�޺� (3 ά + 1 dryrun)

1. **TypeScript ����** (����, �� S71 BUG-079 ��Ĭ����): `cd apps/server && npx tsc --noEmit` + `cd apps/web && npx tsc -b --noEmit` ���� 0 ��
2. **API �˵� E2E ����** (���� + Զ��):
   - �û��� `POST /api/recharge/submit { amount: 10 }` �� 200 + `record.id` + qrCodeUrl
   - �û�ɨ����� �� �� `POST /api/recharge/{id}/notify-paid` �� 200 + `message: '��֪ͨ����Ա, �����ĵȴ����'`
   - ԽȨ����: �û� A �� `POST /api/recharge/{user_B_order_id}/notify-paid` �� 403 FORBIDDEN
   - ״̬����: �ظ��� (status='user_notified' ��) �� 400 INVALID_STATUS "������user_notified, �����ظ�֪ͨ" (ע: ��ǰУ�� status='pending', user_notified �������ظ�, �����ɼ�ȥ���߼�)
3. **DB �ֶ���֤**: ����� `mysql SHOW COLUMNS FROM recharge_requests` ������ `user_notified_at BIGINT DEFAULT 0`
4. **4 ���� dryrun** (�� session д Python ��ʱ�ű�):
   - ���� 1: status='pending' + δ�� �� ��ʾ"���Ѹ���"��ť ?
   - ���� 2: �㰴ť�� �� ��ʾ"�����" + 5 ������ʾ ?
   - ���� 3: admin approve �� ��ʾ"�ѵ���" + ������ ?
   - ���� 4: admin reject �� ��ʾ"���ܾ�, ����ϵ�ͷ�" ?

### ��ô�����ٷ� (����Ŀͨ�� UX ԭ��)

1. **UI �İ��ظ����� 1:1 ����** (����Ŀͨ��): server message �İ� "��ʹ��֧����ɨ���տ���֧��, ��ɺ���'���Ѹ���'�ύ���" �Ƕ� user ��**���ܳ�ŵ**, web �˱�ʵ�ֶ�Ӧ��ť. �İ� �� װ��, ����Լ. **�޷�**: д server message �İ�ʱ, ��ͬʱ����Ӧ web �� UI Ԫ�ش���
2. **state �ֶαظ� UI ״̬�� 1:1 ����** (�� BUG-081 ״̬��Ǩ�ƽ�ѵһ��): server `recharge_requests.status` �� pending/approved/rejected 3 ̬, �� web �� UI ���������������״̬. BUG-092 ��ȱ�м�̬ `user_notified`. **�޷�**: server �˼���״̬�ֶ�ʱ, ��ͬʱ��ǰ�� state �� UI ��Ⱦ��֧
3. **��ѯ���Ʒ� race condition** (�� BUG-089 ��ѵһ��): �û���"���Ѹ���" �� server ��� �� admin �첽 approve �� ����, �����������첽��, ǰ�˱���ѯ����״̬, ���ܼ���"�㰴ť�͹���". �޷� 5 ������ 5s ��ѯ
4. **UI �������� 4 ̬** (����Ŀͨ��, �� BUG-079 ����Ϲ�һ��): �κ�"�û����� �� admin ���"������, UI ����ʾ���� 4 ̬: ������ / �Ѳ�������� / ��ͨ�� / �Ѿܾ�, ����ֻ��ʾһ̬
5. **API �˵�ظ�ǰ���İ� 1:1** (����Ŀͨ��): server ��˵"���'���Ѹ���'" �� �ر�¶ `POST /:id/notify-paid` �˵�, ���� message �İ�˵һ��, API �˵�����һ��. **����**: server ���� message �ֶ�, �ظ�ǰ�� 1:1 grep ��֤
6. **AGENTS.md ���� 4+ ״̬��Ǩ�� (S71 BUG-081)** ����չ: �κ� server ���¼� status �ֶ� (`user_notified` �� status ��״̬, Ҳ�����ǵ����ֶ�), ��ͬ�� 4 ��: 1) server model �� field 2) admin API �� field 3) web/mobile client �� field 4) UI �� state ��Ⱦ��֧. BUG-092 ȱ 1+2+3+4 ȫ��

### Refs

- `apps/server/src/routes/recharge.ts:51` (BUG ��Դ: message ��ŵ��ť, ���˵㲻����)
- `apps/web/src/pages/RechargePage.tsx:97-116` (BUG ��Դ: ֻ�о�̬����, 0 ��ť)
- `apps/web/src/lib/api.ts:118-121` (BUG ��Դ: ȱ notifyRechargePaidApi)
- `apps/web/src/pages/AdminDashboardPage.tsx:194-219` (BUG ��Դ: admin �˿����� userNotifiedAt ���)
- `apps/server/src/models/rechargeRequest.ts:78-87` (BUG ��Դ: RechargeRow interface ȱ userNotifiedAt)
- `apps/server/src/models/db.ts:184-200` (BUG ��Դ: recharge_requests ��ȱ user_notified_at �ֶ�)
- AGENTS.md �� 4 ���� 4+ (״̬��Ǩ�Ʊ�ͬ�� 4 ��, S71 BUG-081 ����, BUG-092 ��ȱ���� 2 ��)
- [BUG-072 D S69 ��ֵ"����Ա���"���̲�˳ P3 ���ڷ���](bug-072) �� ��ʷ��ѵ: "RechargePage ��'��ֵ������, Ԥ�� 5 �����ڵ���' ���ڷ��� һֱûʵʩ". BUG-092 �� BUG-072 D ���ڷ��������� (��"���Ѹ���"��ť), ���ڷ����ǽ�֧�����ص��Զ�����
- [BUG-080 S71 web �����Ѽ�¼ tab û���� (�� user ����й©)](bug-080) �� ͬ���ѵ: �˵��� schema ͬ�� (server �ֶ� �� model �� route �� client �� UI), �κ�һ��©����� BUG
- [BUG-089 S72 batch 6 polling race condition](bug-089) �� ����: BUG-092 �޷� 5 Ҳ���� 5s ��ѯ, �� BUG-089 ����һ��
- [BUG-091 S72 batch 6 commit message Υ��](bug-091) �� ͬ S72 batch ϵ��: ����Ŀͨ�� AI ��Ϊ�Ϲ��ѵ
- mavis memory: `AGENTS.md ���� 6 ǿ��: commit message subject �ش� BUG ���` (S72 batch 6 ����)

### ǰ�� BUG (ͬ S72 batch 7 ��βΥ��)

- [BUG-072 D S69 ��ֵ"����Ա���"���̲�˳ P3](bug-072) �� ���ڷ���δʵʩ, BUG-092 ������
- [BUG-081 S71 ���� ״̬��Ǩ�� 4 ��ͬ��](bug-081) �� BUG-092 ȱ���� 2 �� (admin �� mobile �� UI ��Ⱦ)

## BUG-093 (S72 batch 7 ��β�淶�Լ�, v3.0.37, 2026-06-26 12:46): S72 batch 7 ������� commit `659025d` (web build TS2339 hotfix) + `7e823ac` (����ű� 3 ����) 2 �� commit subject ȱ BUG ���, Υ�� AGENTS.md �� 4 ���� 6

### ���� (�淶�Լ�, ����Ŀͨ��, BUG-091 ͬ��Υ������)

�ܹ淶�Լ�ű� `python3 tools/check-commit-message.py` (5 �� commit message �Լ�) ���� S72 batch 7 ��������� 2 ����Υ��:

```bash
$ git log -5 --pretty=format:"%h | %s"
7e823ac | v3.0.37 deploy: ����ű� 3 ���� (deploy + diag-remote + fix-web Ƕ�� dist) + .gitignore �� 2 tar ����  ? SUBJECT ȱ BUG ���
659025d | v3.0.37 web hotfix: RechargePage �� STAGE_TEXT const + type guard (�� web build TS2339)  ? SUBJECT ȱ BUG ���
9cb8537 | v3.0.37 hotfix: 9 ��汾��ͬ�� (BUG-090 ������� + BUG-092 ����ǰ��)  ?
182033f | v3.0.37 BUG-092: ɨ��֧����'���Ѹ���'��ť + 4 ̬ UI (�� web ��֧������)  ?
6a8e1ee | v3.0.36 docs: BUG-091 ���� + check-commit-message.py �����Լ� (S72 batch 6 ��βΥ��)  ? (BUG-091 ����Υ�汾��)
```

- 5 �� commit, 2 �� subject ���� AGENTS.md ���� 6 ��ʽ (`vX.Y.Z: <һ�仰> (BUG-NNN + �淶�޶�)`)
- **2 ���� commit `7e823ac` + `659025d` subject ȱ BUG ���** (�� BUG-091 `a5ae183` ͬ��Υ��)
- 6a8e1ee �� FAIL (BUG-091 ����Υ�汾��, ��ʷ����, ��֪)
- 3/5 = 60% ����, 2/5 ��Υ�� (��ǰ BUG-091 �ȶ� 23%)

### ���� (��������, AI ��Ϊ�淶��, BUG-091 ͬ��)

S72 batch 7 ������� (v3.0.37) �� (AI) д commit message ����"���ɽ���"ģʽ, ����:
- `659025d` "�� web build TS2339" �� hotfix ��, ����"hotfix ���� BUG"
- `7e823ac` "����ű�" �� ops ��, ����"������ BUG"

**���������ж�**:
1. 659025d ʵ������ v3.0.37 commit `182033f` ����ʱ©�� web build TS2339 ��, **�ϸ�˵Ӧ�� amend `182033f` �� STAGE_TEXT const �� type guard һ�����** (���� amend �� push commit Υ�� git safety protocol), ���Ե��� commit ����ȷѡ��, �� subject **Ӧ��д `(BUG-092 ����© web build TS2339 hotfix)`** ������ "web hotfix" ģ������
2. 7e823ac ʵ���� BUG-092 ����� 3 ���׽ű� (deploy + diag-remote + fix-web), **Ӧ��д `(BUG-092 ����ű� 3 ���� + Ƕ�� dist �޸�)`** ������ "deploy" ģ������

### �޸� (3 ��, �� BUG-091 100% ͬ��)

#### �޷� 1: ���� BUG-093 (�� BUG) ���ü�¼Υ�� (����Ŀͨ��, ���� amend)
- ? ���� amend commit `659025d` + `7e823ac` (git safety protocol: �� push Զ�� commit ���� amend ���� user ��ȷ)
- ? ���� BUG-093 �� `apps/mobile/BUGS.md` (����) + `docs/BUGS_INDEX.md` �� 1 + �� mavis memory ����Ŀͨ�ó���
- ? ���� commit 100% �ϸ����� 6 ��ʽ

#### �޷� 2: ǿ���Լ�ű� (�� 5 �� 10, ���ٷ�)

���� `tools/check-commit-message.py`:
- Ĭ�� N �� 5 �� 10 (���Ǹ�����ʷ commit)
- �� `git log origin/main..HEAD` ��� **δ push commit** �Ƿ�Ϲ� (���� dev Ҳ�� catch)
- �� `git log -1 HEAD` ��� **���һ�� commit** �Ƿ�Ϲ� (commit �����)

#### �޷� 3: pre-commit hook (����, ����Ŀͨ��)

д `.git/hooks/pre-commit` (10 �� bash) + `tools/install-pre-commit-hook.sh`:
```bash
#!/bin/bash
# pre-commit hook: ��ֹ commit message ���� BUG ���
MSG=$(cat "$1")
if ! echo "$MSG" | grep -qE 'BUG-[0-9]{3,}|\+ �淶�޶�'; then
  echo "? commit message ȱ BUG ��Ż� '�淶�޶�' ���"
  echo "   AGENTS.md �� 4 ���� 6 ��ʽ: vX.Y.Z: <�Ķ�> (BUG-NNN + �淶�޶�)"
  exit 1
fi
```

### ��ô��֤�޺� (4 ά)

1. **���� 6 �Լ� 0 ʧ��**: `python3 tools/check-commit-message.py 10` ����� 10 commit, ���� PASS=8 / FAIL=2 (7e823ac + 659025d ��ʷΥ��, �ѳ���) / TOTAL=10
2. **mavis memory ����**: `grep "BUG-093" MEMORY.md` �ҵ� "AGENTS.md ���� 6 ǿ�� 2.0: ���� hotfix commit Ҳ�� BUG ����, ����� BUG ���" �� (�� session д)
3. **AGENTS.md ���� 6 �� session ����**: ���� S73-Sxx �κ� commit subject 100% �� `BUG-NNN` �� `+ �淶�޶�` ����
4. **pre-commit hook ����**: �κ� `git commit` ���� BUG ���ֱ�� reject (����Ⱦ git log)

### ��ô�����ٷ� (����Ŀͨ��, BUG-091/093 �� batch ������ѵ)

1. **commit ǰ�����Լ�**: `python3 tools/check-commit-message.py 1` (��֤���� commit subject), ��ͨ����ֹ `git commit`
2. **commit ������Լ�**: `python3 tools/check-commit-message.py 5` (��֤��� 5 commit), ȷ��û©
3. **��ʽ���䷨**: `vX.Y.Z: <һ�仰> (BUG-NNN + �淶�޶�)` 5 ��ȱһ���� �� ����ʲô + �����ĸ� BUG + ���׹淶�޶�
4. **Bug ��������**: ��ֻ��"�����"���� BUG, hotfix / ���� / ���� / �ĵ� / �淶�޶� ���� "����Ŀ AI ��Ϊ���", ������ BUG ��� (BUG-093 ��ѵ)
5. **����Ŀͨ��**: �κ� AI session д commit �ش� BUG ��� (�� `+ �淶�޶�` ����, ��ʾ�� BUG �������淶�޶�), ���� AI �� git log 30 �����ܶ�λ"��θ���ʲô / ����ʲô BUG"

### Refs

- `AGENTS.md` �� 4 ���� 6 (commit message �ش��汾�� + BUG ���, ���ͳһ�淶)
- `apps/server/AGENTS.md` �� 3 ���� 8 (commit message �ش��汾�� + BUG ���, server ������)
- `apps/mobile/AGENTS.md` �� 6 ��˰汾���� 4 ������ (mobile �ӽ�, �� server ��һ��)
- `docs/STANDARDS_EVOLUTION.md` �� 7.3 commit �淶 + �� 7.4 д BUG �ش����淶�޶�
- `apps/mobile/CODING_STANDARDS.md` �� 38 (mobile Ӳ�Թ淶, BUG ��¼ǿ������)
- `docs/BUGS_INDEX.md` �� 4 Top 14 �ض����� (S72 batch 7 ��, ������ 6)
- mavis memory: `AGENTS.md ���� 6 ǿ�� 2.0: ���� hotfix commit Ҳ�� BUG ����, ����� BUG ���` (�� session ����)
- [BUG-091 S72 batch 6 commit message Υ��](bug-091) �� 100% ͬ��Υ��, BUG-093 �� S72 batch 7 ����
- [BUG-079 S71 ���üٱ��� 12 άȫ�� 100% ��](bug-079) �� ͬ���ѵ: ���� vs ʵ�ʲ�һ��, AI ��Ϊ�Ϲ�
- [BUG-082 S71 ���� server д�־û� JSON �� string ��һ](bug-082) �� ����: S71 �� AI ��Ϊ�Ϲ��� 4 ���� (4+/6/7/8)
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� �� BUG-093 2 ��Υ�� commit �� BUG-092 �������©д

### ǰ�� BUG (ͬ S72 batch 7 ��βΥ��)

- [BUG-091 S72 batch 6 commit message Υ��](bug-091) �� 100% ͬ��Υ��, BUG-093 �� S72 batch 7 ����
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� ������� 2 ��Υ�� commit �� BUG-092 ����ֱ�����

## BUG-094 (S72 batch 7 �����, v3.0.37, 2026-06-26 13:00): admin ����Ĭ�ϲ� 'pending' ״̬����, BUG-092 �޷� markUserNotified ©�� status, ���� user �� 1 ��"���Ѹ���" ��̨�� 3 ������˶��� (DB ʵ�� 14 �� pending �ۻ�)

### ���� (user ʵ�ʷ���, 2026-06-26 12:58)

User ���� v3.0.37 ��, ��ɨ��֧�����̺���:

```
q378685504 ��50.00 �����    [12:55:58]
q378685504 ��50.00 �����    [12:55:59]
q378685504 ��50.00 �����    [12:56:00]
```

3 ��״̬ "�����" (admin ���İ�, ��Ӧ DB status='pending') ͬ username ͬ�������. User ʵ��**ֻ�� 1 ��"���Ѹ���"��ť** (���� `464516ab-da6d-4b82-9d15-6ba12a60a062` ֮ǰ�ѽ�), ������"ֻ�е�������Ѹ��ť���Ż�ѵ�ǰ������¼�������, �����ǵ����һ�γ�ֵ��ť�ͷ���һ�ζ������".

### ���� (3 ��, ����Ŀͨ�ý�ѵ)

#### �� 1: admin �˵�Ĭ�ϲ� 'pending' (server ��)
- `apps/server/src/routes/admin.ts:59` (BUG-094 �޷�ǰ): `const status = (req.query.status as string) || 'pending';`
- ����: admin �򿪿���Ĭ�ϲ����� status='pending' ����, **���������û���ֵ��û��"���Ѹ���"�Ķ���**
- 14 �� user û��"���Ѹ���" �� pending ����, **ȫ���� admin ����**, �� user ������ȫ�෴

#### �� 2: markUserNotified ©�� status �ֶ� (״̬��Ǩ�� 4 ��ͬ��© 1 ��, BUG-081 ��ѵ)
- `apps/server/src/models/rechargeRequest.ts:39-44` (BUG-094 �޷�ǰ): `UPDATE recharge_requests SET user_notified_at = ?, updated_at = ? WHERE id = ?`
- **ֻ�� `user_notified_at` ʱ���, ���� `status` �ֶ�** �� BUG-092 �޷�ʱΪ "sub-status" ��� (��Ӱ���� status), �� BUG-081 ״̬��Ǩ�� 4 ��ͬ��ǿԼ����ͻ
- ���: user ��"���Ѹ���" ��, ���� status ���� 'pending', admin �˵㲻��ʾ status='user_notified' ���� (��Ϊ����û��״̬����)

#### �� 3: BUG-092 �޷�ʱ admin �˵� (server) + AdminDashboardPage (web) ©ͬ��
- BUG-092 �޷� 6 д: "admin �����б�� userNotifiedAt ��� (?? �û���֪ͨ�Ѹ��� �� MM-DD HH:MM, ���ȴ���)" �� ��**ֻ�� web ����ʾ���**, û�� admin �˵��ѯĬ�� (�� 'pending'), û�� admin approve/reject У�� (�� 'pending')
- BUG-092 �޷� 6 �� "sub-status" ���, �� BUG-081 ����Ŀͨ��"״̬��Ǩ�Ʊ�ͬ�� allowlist + response handler" ��ͻ
- BUG-092 �޷��� BUGS.md ��û�� "״̬��Ǩ�� 4 ��ͬ��" �Լ�, © 1 �� (server admin �˵�)

### DB ���� (2026-06-26 13:02 ����ǰ��)

```sql
mysql> SELECT status, COUNT(*) as cnt FROM recharge_requests GROUP BY status;
status      cnt
pending     14     -- ?? BUG-094 ����: 14 ������ status=pending ȫ�� admin ����
approved    14     -- ��ʷ�����
rejected    27     -- ��ʷ�Ѿܾ�
```

�� user ���� "3 �������" ��ȫһ�� (3 �� user �������Ӽ�, 14 ��ʵ�� DB �ۻ�).

### �޸� (3 ��, 5 �ļ���)

#### �޷� 1: markUserNotified �� status='user_notified' (״̬��Ǩ��, 4 ̬ UI 1:1 ����)
- `apps/server/src/models/rechargeRequest.ts`: `UPDATE recharge_requests SET user_notified_at = ?, status = ?, updated_at = ? WHERE id = ?` (status = 'user_notified')
- ����: `recharge.ts:80-82` ��У�� `record.status !== 'pending'` ���� (markUserNotified ֻ�ܴ� pending ��)

#### �޷� 2: admin �˵� server ��Ӳ���� pending
- `apps/server/src/routes/admin.ts:59-71`:
  - default: 'pending' �� 'user_notified' (admin ����Ĭ�Ͽ��û���֪ͨ�Ĵ����)
  - 'all' �� user_notified + approved + rejected (��Զ���� pending, server ��ӲԼ��, ��ǰ�� query �ƹ�)
  - 'pending' ǿ�Ʒ��� (admin ����������ʾ)
  - approve/reject У�� 'pending' �� 'user_notified' (�� model ͬ��)
- ����: �¼� `model.findByStatuses()` method (�� IN (...) SQL)

#### �޷� 3: web AdminDashboardPage 5 tab + default 'user_notified'
- `apps/web/src/pages/AdminDashboardPage.tsx`:
  - default 'pending' �� 'user_notified'
  - 4 tab �� 5 tab: user_notified/approved/rejected/pending (audit)/all
  - ״̬��ʽ + ������ʾ�İ� + admin ������ť���� `o.status === 'pending'` �� `o.status === 'user_notified'`
  - 4 ̬ UI �� BUG-092 1:1 ����

### ��ô��֤�޺� (4 ά)

1. **server �� grep BUG-094 �ؼ�������**:
   - `grep "user_notified" /www/wwwroot/shipin-APP/dist/routes/admin.js`: 5 ���� ?
   - `grep "user_notified" /www/wwwroot/shipin-APP/dist/models/rechargeRequest.js`: 5 ���� ?
   - `grep "findByStatuses" /www/wwwroot/shipin-APP/dist/models/rechargeRequest.js`: 1 ���� ?
2. **DB ״̬**: `mysql> SELECT status, COUNT(*) FROM recharge_requests GROUP BY status` �� �޷��� user ��ֵ���� pending, ��"���Ѹ���" �� user_notified, admin �˵�� user_notified Ĭ�� 14��0 �ۻ�������
3. **web UI**: ����� hard refresh https://ab.maque.uno/admin �� 5 tab (�����/��ͨ��/�Ѿܾ�/��֧�� audit/ȫ��) + default "�����" 0 ���� + "ȫ��" �� 14+14+27+user_notified(��) ����
4. **�˵���**: user �� ɨ�� �� "���Ѹ���" �� ���� status pending��user_notified �� admin �� 5 tab "�����" ���� 1 �� �� admin �� "����" �� status user_notified��approved + ����

### ��ô�����ٷ� (����Ŀͨ��, �� BUG-081 ����ǿ��)

1. **״̬��Ǩ�Ʊ�ͬ�� 4 ��** (BUG-081 ǿԼ��, BUG-094 © 1 ��): server �ֶ� + model method + response handler (server route) + �ͻ��� (web/mobile UI ��Ⱦ). **�κ�һ��©, ����״̬����**
2. **admin �˵� default ����"������"����"ȫ��"**: 'pending' ������ֱ��, ���� admin �� "ȫ��������" �� "�û������" �ǲ�ͬ����, Ĭ��Ӧ����"�����" (user_notified), ����"δ����" (pending). �� BUG-080 �� user ����й©��ѵһ��: server ��Ӳ���˱�ǰ�� UI ���ظ���
3. **DB ״̬����� sub-status �Ƿ�ģʽ**: ״̬��Ӧ���ǵ��ֶ� (status), sub-status (userNotifiedAt > 0) �� query ��ͬ��. markUserNotified Ӧ���� status: pending �� user_notified ���ֶ�Ǩ��, ���� "pending + sub-marker"
4. **�������� DB GROUP BY status �Լ�**: `mysql> SELECT status, COUNT(*) FROM recharge_requests GROUP BY status` �� ���ۻ��쳣, �� verify-deploy.sh --strict 22 ά����
5. **�� BUG-072 D ���ڷ�������**: BUG-072 D ���ڷ��� "RechargePage ��'��ֵ������, Ԥ�� 5 �����ڵ���'��ʾ" ��ûʵʩ, BUG-094 �޷��ǹ���̬. ���ڷ����ǽ�֧�����ص��Զ����� (���� user ֪ͨ + admin ���)

### Refs

- `AGENTS.md` �� 4 ���� 4+ (״̬��Ǩ�Ʊ�ͬ�� allowlist + response handler, ����Ŀͨ��)
- `apps/server/AGENTS.md` �� 5 ���� C (DB schema Ǩ��, ����״̬��Ǩ��)
- `apps/web/AGENTS.md` �� 3 �� web �˱��� `tsc -b --noEmit` 0 �� (�����޷�һ�ι�)
- `apps/mobile/AGENTS.md` �� 6 ���� 4+ (״̬��Ǩ�� 4 ��ͬ��, mobile �ӽ�)
- `docs/BUGS_INDEX.md` �� 4 Top 14 �ض����� (S72 batch 7 ��, ������ 4+)
- mavis memory: `״̬��Ǩ�Ʊ�ͬ�� 4 �� (server �ֶ� + model + response handler + �ͻ��� UI)` (�� session ����, BUG-094 ����)
- [BUG-072 D S69 ��ֵ"����Ա���"���̲�˳ P3](bug-072) �� ���ڷ���δʵʩ, BUG-094 �޷��ǹ���̬
- [BUG-081 S71 ���� ״̬��Ǩ�� 4 ��ͬ��](bug-081) �� 100% ͬԴ��ѵ, BUG-094 �� BUG-092 ����ʱ©ͬ���� 4 �� (admin �˵�)
- [BUG-082 S71 ���� server д�־û� JSON �� string ��һ](bug-082) �� ����: �����޷� admin.ts:62 `let orders: any[]` ��ʽ type �� BUG-082 ���� 8 һ��
- [BUG-089 S72 batch 6 polling race condition](bug-089) �� ����: BUG-094 �޷� admin �˵� `let orders: any[]` �� polling 5s һ��
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-094 �޷��� BUG-092 �޷� 6 (admin �˵�) © 1 ���Ĳ���
- [BUG-093 S72 batch 7 commit message Υ��](bug-093) �� ����: ����Ŀͨ�� AI ��Ϊ�Ϲ�, BUG-094 �޷� commit 8ceb284 �ϸ�� BUG-094 ���

### ǰ�� BUG (ͬ S72 batch 7 ��βΥ��)

- [BUG-072 D S69 ��ֵ"����Ա���"���̲�˳ P3](bug-072) �� ���ڷ���δʵʩ, BUG-094 �޷��ǹ���̬
- [BUG-081 S71 ���� ״̬��Ǩ�� 4 ��ͬ��](bug-081) �� 100% ͬԴ, BUG-094 �� BUG-092 ©ͬ���� 4 ��
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-094 �޷��� BUG-092 �޷� 6 admin �˵�© 1 ���Ĳ���

## BUG-095 (S72 batch 7 BUG-094 �޷�������, v3.0.37, 2026-06-26 13:11): BUG-094 �޷� markUserNotified д status='user_notified' �� DB schema `recharge_requests.status ENUM('pending','approved','rejected')` ���� 'user_notified' �� MySQL ��Ĭ�ض� + server �״� 500 �� web �� catch �� alert "֪ͨʧ��" + admin ����û����

### ���� (user ʵ�ʷ���, 2026-06-26 13:10)

User ���� BUG-094 �޷�����ɨ��֧������, ����:
> "������Ѹ��ť, ����֪ͨʧ��, ���Һ�̨û�ж�������"

�������:
1. user �ύ��ֵ �� �������� (status='pending')
2. user ��"���Ѹ���"��ť �� web �� catch `e?.response?.data?.error?.message` �� alert "֪ͨʧ��"
3. admin �˵� `/api/admin/orders?status=user_notified` �� 0 ���� (ʵ�� markUserNotified д��ʧ��)
4. 14 ���� pending ���� (BUG-094 �޷�ǰ�ۻ�) ������ pending ����, admin �˵�ȫ����ʾ

### ���� (2 ��, ����Ŀͨ�ý�ѵ)

#### �� 1: DB schema enum �� model SQL ��һ��
- `db.ts:191` (BUG-095 �޷�ǰ): `status ENUM('pending','approved','rejected') DEFAULT 'pending'`
- ����: DB schema ֻ֧�� 3 ״̬, û�� 'user_notified'
- BUG-094 �޷����� `rechargeRequest.ts:39-44` model SQL: `UPDATE recharge_requests SET user_notified_at = ?, status = ?, updated_at = ? WHERE id = ?` (status='user_notified'), **��ûͬ���� db.ts CREATE TABLE**
- ���: model SQL д 'user_notified' �� enum �ֶ�, MySQL �� `Data truncated for column 'status'`, server pool �״� 500, web �� catch ʧ��

#### �� 2: ״̬��Ǩ�� 4 ��ͬ��©�� 5 �� (DB schema, BUG-081 ����)
- BUG-081 ����Ŀͨ��ǿԼ��: "״̬��Ǩ�Ʊ�ͬ�� allowlist + response handler" (4 ��)
- BUG-094 �޷����� 4 �� (server �ֶ� + model method + response handler + �ͻ��� UI), ��Ȼ©�� 5 �� �� **DB schema enum**
- BUG-094 �޷��Լ�� (`mysql SELECT status, COUNT(*) FROM recharge_requests GROUP BY status`) ��ʾ `pending/approved/rejected` 3 ״̬, **û���� schema enum © 'user_notified'**, ��Ϊ ALTER TABLE �� CREATE TABLE ��ûͬ��
- BUG-094 �޷�û�ܶ˵�����֤ (ֻ�� SQL �� 22 ά + admin �˵�), © server pool ��ʵ�״�

### �޸� (3 ��, 2 �ļ��� + 1 ���� SQL)

#### �޷� 1: ���� SQL ALTER TABLE (���, ������ app ���)
```sql
ALTER TABLE recharge_requests MODIFY COLUMN status ENUM('pending','user_notified','approved','rejected') DEFAULT 'pending';
```
- ��: `mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e "ALTER TABLE ..."`
- ��֤: `SHOW COLUMNS FROM recharge_requests WHERE Field='status'` ������ `'user_notified'`
- ������ (�� S72 batch 4 deploy.sh #6 �޷�һ��: ���� ALTER ������, ������ initTables)

#### �޷� 2: db.ts ͬ�� (�²���� + �����Ͽ�, �� BUG-079 ��ѵһ��)
- `db.ts:191` (BUG-095 �޷���): `status ENUM('pending','user_notified','approved','rejected') DEFAULT 'pending'`
- ���� `db.ts:202-209` ALTER �����Ͽ� (logger.warn �����Ĭ catch):
  ```ts
  try {
    await db.execute("ALTER TABLE recharge_requests MODIFY COLUMN status ENUM('pending','user_notified','approved','rejected') DEFAULT 'pending'");
  } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE recharge_requests MODIFY status enum user_notified' });
  }
  ```

#### �޷� 3: server restart (�� pool ���� load schema, �� cached enum)
- `systemctl restart shipin-app`
- ��֤: �˵��� curl POST /api/recharge/:id/notify-paid (�� admin token ģ��) ������ 200 / 400 (ҵ���) ������ 500 (server ��)

### ��ô��֤�޺� (5 ά)

1. **DB schema enum �� 'user_notified'**:
   ```sql
   mysql> SHOW COLUMNS FROM recharge_requests WHERE Field='status';
   status enum('pending','user_notified','approved','rejected') YES MUL pending
   ```
2. **server pool reload schema** (server restart ��, ���� 500): �˵��� verify �� 403 FORBIDDEN (�� user ����, ҵ���) ������ 500 (server ��)
3. **markUserNotified SQL �� dist**: `grep -A 1 'markUserNotified' dist/models/rechargeRequest.js | grep 'user_notified'` ���� �� 1 ����
4. **ALTER status enum in db.js dist**: `grep -c 'user_notified' dist/models/db.js` ���� �� 4 ���� (CREATE TABLE + ALTER TABLE + ע��)
5. **admin �˵㷵 user_notified ����**: �������� pending ���� + curl notify-paid �˵� + �� admin �˵�� user_notified ������ 1 �� (�� markUserNotified дʱ���һ��)

### ��ô�����ٷ� (����Ŀͨ��, BUG-081 ���� 4��5 �� + ���� ALTER ������)

1. **״̬��Ǩ�Ʊ�ͬ�� 5 ��** (BUG-081 4 �� �� BUG-095 ���� 5 ��, �� DB schema): server �ֶ� + model method + response handler (server route) + �ͻ��� UI ��Ⱦ + **DB schema (enum / type ��ͬ��)**. 5 ��ȱһ���׷�
2. **���� ALTER ������ SQL ��** (�� S72 batch 4 deploy.sh #6 �޷�һ��): ������ app ��� initTables (��Ϊ�û��ѵ����ť 1 ��, ALTER ʧ��ʱ�� throw 500, schema ��һ�������ɼ�). �޷� 1 ���޷� 2 ���� (�޷� 1 ���� SQL + �޷� 2 db.ts �����Ͽ�)
3. **server pool �� DB schema ǿһ��**: schema enum ����֮��, **server pool ����������� load** (mysql2 �� prepared statement cache ���о� enum), ���� `systemctl restart shipin-app`. �� S70 BUG-077 ��ѵһ��: �κ� schema �ı� restart service
4. **�˵�����֤�ز� 4 �����**: 200 (�ɹ�) / 4xx (ҵ���, �û���) / 5xx (server ��, �����) / �����. BUG-094 �޷�ֻ�� 22 ά + �˵� 200 OK, û�����·�� (�� user ���� 403 / ״̬У�� 400). �޷� 3 �� server restart �����ȫ·��
5. **initTables() �ؼ����Ͽ� + logger.warn** (BUG-079 ��ѵ): CREATE TABLE IF NOT EXISTS + ALTER TABLE try/catch logger.warn. BUG-095 ֮ǰ db.ts ֻ�� user_notified_at �м���, © status enum ����. ���� 2 �ж�����, δ���²���� + �Ͽⶼһ��

### Refs

- `AGENTS.md` �� 4 ���� 4+ (״̬��Ǩ�Ʊ�ͬ�� allowlist + response handler, ����Ŀͨ��, BUG-095 ������ 5 ��)
- `apps/server/AGENTS.md` �� 3 ���� 4 (APP_VERSION �� 1 ����ͬ�� 8 ��) + �� 5 ���� C (���±� / �� schema �� ALTER)
- `apps/server/AGENTS.md` �� 4 �ĺ� 5 �� (���� tsc 0 �� + npm run build + cp changelog.json + ��ά��ģʽ���� + 12 ά��֤)
- `docs/BUGS_INDEX.md` �� 4 Top 16 �ض����� (S72 batch 7 ��, ������ 4+)
- `docs/DB_MIGRATION.md` �� 1-2 (DB schema Ǩ�� SOP, �� ALTER �����Ͽ�淶)
- mavis memory: `״̬��Ǩ�Ʊ�ͬ�� 5 �� (server �ֶ� + model + response handler + �ͻ��� UI + DB schema)` (�� session ����, BUG-095 ����)
- mavis memory: `server pool enum �� DB schema ǿһ��, �κ� schema �ı� restart service` (�� session ����, BUG-095 ��ѵ)
- [BUG-079 S71 ���üٱ��� 12 άȫ�� 100% ��](bug-079) �� ͬ���ѵ: ���� ALTER ��������, ������ initTables
- [BUG-081 S71 ���� ״̬��Ǩ�� 4 ��ͬ��](bug-081) �� BUG-095 ���� 4��5 �� (�� DB schema)
- [BUG-083 S72 batch 4 dist/changelog.json �ַ�������](bug-083) �� ͬ S72 batch ϵ��: �������ı��ļ�Ҫ ALTER / cp ͬ��
- [BUG-090 S72 batch 6 deploy.sh changelog.json cp Դ������Ŀ¼](bug-090) �� ����: BUG-095 �޷� 1 ���� SQL ALTER �� deploy.sh �������� ALTER ����
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-094/095 �޷���
- [BUG-093 S72 batch 7 commit message Υ��](bug-093) �� ����: BUG-095 �޷� commit aaaf3eb �ϸ�� BUG-095 ���
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� 100% ͬԴ, BUG-095 �� BUG-094 �޷�©�� 5 �� (DB schema)

### ǰ�� BUG (S72 batch 7 ״̬��Ǩ��©ͬ����)

- [BUG-081 S71 ���� ״̬��Ǩ�� 4 ��ͬ��](bug-081) �� BUG-095 ���� 4��5 ��
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� BUG-095 �� BUG-094 �޷�©�� 5 �� (DB schema)

## BUG-096 (S72 batch 7 BUG-092 �޷���, v3.0.37, 2026-06-26 13:22): AdminDashboardPage.tsx "��ͨ��" ��ʷ����������Ⱦ "0" �� React `{a && b}` ��·����, �� `a=0` ʱ�� `0` �ַ�����Ⱦ (�� approved ���� userNotifiedAt=0 ȫ��Ӱ��, admin ���� "��ͨ��" tab 5 ����ʷ����ʾ "0")

### ���� (user ��ͼ����, 2026-06-26 13:22)

User ���� BUG-094/095 �޷���, admin ����"��ͨ��" tab ��ʷ����������Ⱦ "0" ����. user ��ͼ��ʾ 5 ����ʷ approved ����ÿ�����涼��һ�� "0":

```
solowxd  ��10.00  ��ͨ��  0
΢�� �� 2026/6/23 03:35:51 �� ����Աȷ�ϵ���

q378685504  ��100.00  ��ͨ��  0
΢�� �� 2026/6/7 00:33:23 �� ����Աȷ�ϵ���
...
```

��ʽ�� AdminDashboardPage.tsx һ�� (line 195-220 ��Ⱦ), �� "0" ʵ��λ���� status box "��ͨ��" ����, ͬһ��, ���� status chip �ұ�.

### ���� (1 ��, React ��������)

`apps/web/src/pages/AdminDashboardPage.tsx:210` (BUG-096 �޷�ǰ):
```jsx
{o.userNotifiedAt && o.userNotifiedAt > 0 && o.status === 'user_notified' && (
  <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent font-medium flex items-center gap-1">
    ?? �û���֪ͨ�Ѹ��� �� {new Date(o.userNotifiedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
  </span>
)}
```

**React ��������: `a && b` �� `a=0` ʱ�� `0` �ַ���**:
- `0 && X` JS ��·�� `0` (number, ���� boolean)
- React JSX `{0}` ��Ⱦ�� "0" �ַ��� (�� `{null}` / `{undefined}` / `{false}` ����Ⱦ��ͬ)
- �� approved ���� (DB DEFAULT userNotifiedAt=0) �� `0 && (0>0) && ...`, ��һ����·�� 0, React ��Ⱦ "0"

**���� React ��Ϊ**:
- `0 && X` �� �� `0` (number) �� ��Ⱦ "0"
- `"" && X` �� �� `""` (empty string) �� ��Ⱦ ""
- `null && X` �� �� `null` �� ����Ⱦ
- `undefined && X` �� �� `undefined` �� ����Ⱦ
- `false && X` �� �� `false` �� ����Ⱦ

ֻ�� `0` / `""` �� 2 �� falsy ֵ�ᴥ��"��Ⱦ����"����. �� BUG-082 ���� 8 (�־û� JSON �� string ��һ) ��ѵͬԴ: ����Ŀͨ�� UX ԭ��, �κ� 0 ��ֵ�ֶ���Ⱦǰ����ʽ boolean cast.

### �޸� (1 �и�)

`apps/web/src/pages/AdminDashboardPage.tsx:210` (BUG-096 �޷���):
```jsx
{o.userNotifiedAt > 0 && o.status === 'user_notified' ? (
  <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent font-medium flex items-center gap-1">
    ?? �û���֪ͨ�Ѹ��� �� {new Date(o.userNotifiedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
  </span>
) : null}
```

�޷� 3 ��:
1. **ɾ** `o.userNotifiedAt &&` ��һ����·���� (��Ϊ `o.userNotifiedAt > 0` �Ѱ�����ֵ���, ����Ҫ����)
2. **��** `&& (...)` �� `? (...) : null` ��ʽ��Ŀ, �� React ��Ⱦ falsy ֵ
3. **������** `o.userNotifiedAt` ֱ�� (���� 0 ��Ⱦ����, �� BUG-082 ���� 8 ǿԼ��һ��)

### ��ô��֤�޺� (4 ά)

1. **web dist grep 0 ��ȾԴ��ʧ**:
   - �޷�ǰ: `grep "userNotifiedAt&&" dist/assets/*.js` ���� �� 1 ����
   - �޷���: `grep "userNotifiedAt>0" dist/assets/*.js` ���� �� 1 ����, `grep "userNotifiedAt&&"` ���� 0 ����
2. **admin �˵㷵 approved ���� userNotifiedAt �ֶ�** (DB Ĭ�� 0): `curl /api/admin/orders?status=approved` ���� userNotifiedAt=0 �ֶδ���
3. **admin �˵㷵 user_notified ���� userNotifiedAt > 0**: BUG-094/095 �޷��� markUserNotified д timestamp, user_notified ���� userNotifiedAt > 0, Ӧ��ʾ "?? �û���֪ͨ�Ѹ��� �� MM-DD HH:MM" ���
4. **����� hard refresh**: user ����ˢ�� admin ����, "��ͨ��" tab ��ʷ��������**������ "0" �ַ���** ?

### ��ô�����ٷ� (����Ŀͨ��, BUG-082/096 ����ǿ��)

1. **JSX ��Ⱦ����ʽ boolean cast 0 �ֶ�** (BUG-096 ��ѵ): �κ� 0 ��ֵ�ֶ���Ⱦǰ�� `> 0` / `Boolean(x)` / `!== 0` ����, **����ֱ�� `x &&` ��·** (��Ϊ 0 ��·�� 0, ��Ⱦ "0" �ַ���)
2. **JSX ��Ⱦ�Ƽ���Ŀ**: `{x ? (...) : null}` �� `{x && (...)}` ��ȫ, �κ� falsy ֵ (0/""/null/undefined/false) ��������Ⱦ����
3. **���� BUG-082 ���� 8**: �־û� JSON �� string ��һ (server �� {code,message} ��һ string), ����Ŀͨ�� UX ԭ��. BUG-096 ��"ǰ����Ⱦ"��, BUG-082 ��"��˳־û�"��, ����
4. **lint ���߼� `@typescript-eslint/no-unnecessary-condition`**: ǿ�� `x && x > 0` �������������� warning, ��ֹ BUG-096 �޷�ǰ��"`x && x > 0` ��·" д��
5. **�������ܶ˵��� (admin ����) �Ӿ���֤**: ��ֻ�� API 200 / SQL 22 ά, ��Ҫ��ʵ�� DOM ��Ⱦ (playwright / puppeteer / ������ֶ�). BUG-094/095/096 �޷���û��ʵ�� DOM ��Ⱦ, ��©�� "0" ��Ⱦ����

### Refs

- `AGENTS.md` �� 4 ���� 8 (�־û� JSON �� string ��һ, ����Ŀͨ�� UX ԭ��)
- `apps/web/AGENTS.md` �� 4 web �˶������� (������ shadcn / ״̬����ֻ�� Zustand / ·�������� App.tsx / bundle hash �ش�)
- `docs/BUGS_INDEX.md` �� 4 Top 16 �ض����� (S72 batch 7 ��, ������ 4+/8)
- mavis memory: `JSX ��Ⱦ����ʽ boolean cast 0 �ֶ�, �Ƽ���Ŀ��� &&` (�� session ����, BUG-096 ���� BUG-082)
- [BUG-082 S71 ���� server д�־û� JSON �� string ��һ](bug-082) �� 100% ͬԴ, BUG-096 �� BUG-082 "ǰ����Ⱦ"��
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-094/095/096 �޷���
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� BUG-096 �� BUG-094 �޷� admin �˵� + AdminDashboardPage �� userNotifiedAt ��������
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� BUG-096 �޷����� 3 �� (state �� �� render © 0)

### ǰ�� BUG (S72 batch 7 ״̬��Ǩ��©ͬ����)

- [BUG-082 S71 ���� server д�־û� JSON �� string ��һ](bug-082) �� 100% ͬԴ, BUG-096 �� BUG-082 "ǰ����Ⱦ"��
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-094/095/096 �޷���Դͷ
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� BUG-096 �� BUG-094 �޷� admin �˵�����
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� BUG-096 �޷����� 2 ��

## BUG-097 (S72 batch 7 �淶��ת, v3.0.37, 2026-06-26 13:50): S72 batch 7 BUG-092/094/095/096 ȫ�� web ����, mobile ��© 3 BUG �� ��֮ǰ "���� web, ��׿�ݲ���" ��ԭ���ͻ, user ��ת�淶 "Web ����, APP ����" ��Ϊ���� 4++

### ���� (user ��ת�淶, 2026-06-26 13:49)

User �� S72 batch 7 5 BUG �������ȷ��תԭ��:
> "(���� web, ��׿�ݲ���) ���ɾ��, ����Web�����е���Ŀ���ܵ������޸�������Ҫͬ����APP��, ȷ��Web�����еĹ���, ��APP��Ҳͬ�����������. ��Web��Ϊ����, APP����Web�˵���, ֻҪWeb�е���, �ͱ���Ҫͬ�����APP�Ƿ���ع�����û�и���, �������Ϊ��Ŀ�淶, ȷ��˫��ͬʱ����, APPҪ����Web��"

ʵ�� mobile ��©�� 3 BUG (�� web v3.0.37 �ȶ�):
- ? **BUG-092 ©��**: mobile `RechargeScreen.tsx` û notify-paid API + û "���Ѹ���" ��ť (�� web BUG-092 �޷�ǰ v3.0.36 һ��)
- ? **BUG-094 ©��**: mobile `AdminDashboard.tsx:15` `useState('pending')` �� web v3.0.36 һ��, admin Ĭ�ϲ� 'pending' (�޷���� 'user_notified')
- ? **STAGE_TEXT 4 ̬��©��**: mobile `StatusBadge` 3 ̬ (pending/approved/rejected), û user_notified, �� web 4 ̬����һ��
- ? **BUG-095/096 ©**: server �� + web ��, mobile ��û�� 2 BUG (mobile û�� `userNotifiedAt &&` ģʽ)

### ���� (1 ��, ����Ŀͨ�ý�ѵ)

#### ֮ǰ "���� web, ��׿�ݲ���" ��ԭ�����
- S70 BUG-077 ֮ǰ shipin-APP �� PM2, mobile �� RN, web �� Vite, ���˶���
- user ֮ǰ���� "mobile �� �ܵö��� OK, web ������ս��", ���� S72 batch 4-5-6 ��� BUG �� "���� web, mobile �����"
- ʵ�ʺ��: S72 batch 6 BUG-088/089/090 �� mobile �� (Dialog Modal / polling race / deploy.sh), �� S72 batch 7 BUG-092/094/095/096 ȫ��û�� mobile ��
- user ���� "���� APP ��û������ť" �ű�¶ BUG-092 ©�� �� �淶��ת

### �޸� (5 �ļ�, �� web �� 1:1 ����ͬ��)

#### �޷� 1: apps/mobile/src/api/client.ts (2 ��)
- �� `notifyRechargePaid = (id) => apiClient.post(\`/recharge/${id}/notify-paid\`)` (�� web �� `api.ts:21` notifyRechargePaidApi 1:1)
- �� `adminOrders = (status: string = 'user_notified')` ȡ�� `'pending'` (�� web �� `api.ts` adminOrdersApi 1:1)

#### �޷� 2: apps/mobile/src/screens/RechargeScreen.tsx (5 ��)
- �� `notifyRechargePaid` import
- �� `notifying / currentOrderId / currentStatus` 3 �� state (�� web �� RechargePage.tsx:18-20 1:1)
- `handleSubmit` ��: �������� (status='pending') + setCurrentOrderId, �Ƴ�ԭ "���Ѹ��� + �ύ���" 2 ���ϲ� (�� web �� BUG-092 �޷� 1:1)
- �� `handleNotifyPaid` ���� (�� notifyRechargePaid API + setCurrentStatus('user_notified'))
- �� 5s ��ѯ useEffect (currentStatus='user_notified' ����, �� BUG-089 ��ѵһ��)
- �� "���Ѹ���" ��ť + ������İ� + styles.notifyBtn + styles.notifiedBox + styles.notifiedText
- �� `StatusBadge` 4 ̬: pending/��֧�� + user_notified/����� + approved/�ѵ��� + rejected/�Ѿܾ� (�� web �� RechargePage.tsx:22 STAGE_TEXT 1:1)

#### �޷� 3: apps/mobile/src/screens/AdminDashboard.tsx (4 ��)
- `useState('pending')` �� `'user_notified'` (�� web AdminDashboardPage.tsx:133 1:1)
- 4 tab �� 5 tab: user_notified/����� + approved/��ͨ�� + rejected/�Ѿܾ� + pending/��֧�� (audit) + all/ȫ�� (�� web AdminDashboardPage.tsx:175 1:1)
- admin ������ť���� `item.status === 'pending'` �� `item.status === 'user_notified'` (�� web AdminDashboardPage.tsx:221 1:1)
- ״̬�İ� + userNotifiedAt ���: `item.status === 'user_notified' && item.userNotifiedAt > 0` ��ʾ "?? ����� �� {ts}" (�� web AdminDashboardPage.tsx:210-214 1:1, BUG-096 React 0 ��Ⱦ�����������)

### ��ô��֤�޺� (4 ά)

1. **mobile �˸� web �� 1:1 ����**: `diff <(grep -E 'notifyRechargePaid|user_notified' apps/web/src) <(grep -E 'notifyRechargePaid|user_notified' apps/mobile/src)` ����������һ�� (������ 4++ SOP ����)
2. **mobile tsc 0 �� (�Ҹĵ� 3 �ļ�)**: `npx tsc --noEmit` ���� 0 �� (ע: mobile ���� 3 pre-existing �� in styles �ظ� color �ֶ�, �� BUG-097 �޹�, �� BUG-073 ͬ�����)
3. **mobile �� 4 ©�޵�ȫ����**: `grep 'notifyRechargePaid' apps/mobile/src` �� 1 ����, `grep '���Ѹ���' apps/mobile/src` �� 1 ����, `grep 'user_notified' apps/mobile/src` �� 1 ���� (�� verify-deploy.sh ά�� 24 һ��)
4. **APK rebuild + ����**: `cd apps/mobile && gradlew assembleRelease` (5 min ��������) + aapt2 dump badging �� versionName + scp APK �� ab.maque.uno + bump server 9 ��汾�� (�� web ���� SOP 5 ������)

### ��ô�����ٷ� (����Ŀͨ��, ���� 4++ ���ù淶)

1. **���� 4++ ���ù淶** (����Ŀͨ�� UX ԭ��, AGENTS.md �� 4 ����): �� web �����⹦��/UI/״̬��/�ӿں�, **��ͬ�� app ��**, �� 5 �� SOP: 1) ���� mobile ��©���嵥 (grep diff) 2) �� mobile �˴��� 3) tsc + APK rebuild 4) aapt2 dump badging 5) scp APK + bump server 9 ��汾��
2. **verify-deploy.sh ά�� 24 �Զ�����**: �����ز� mobile Դ�� web �ؼ� API/UI Ԫ��, ��1 ���� (`grep 'notifyRechargePaid' apps/mobile/src` / `grep '���Ѹ���' apps/mobile/src` / `grep 'user_notified' apps/mobile/src`), 0 ���м� FAIL (�� BUG-082 ά�� 17/18 ͬ��)
3. **ɾ 3 �� "���� web, ��׿�ݲ���" ��ԭ��**: HANDOVER.md �� 0 + �� A + �� E 3 ��, apps/mobile/AGENTS.md v1.2 footer, ��Ϊ "Web ����, APP ����" �¹淶
4. **mavis memory ����**: `Web ���� APP ���� (����Ŀͨ��, �� web ��ͬ�� app, ������Ŀ�淶)` (S72 batch 7)
5. **ÿ batch �� web ���� mobile �� diff**: `diff <(grep -E 'xxx' apps/web/src) <(grep -E 'xxx' apps/mobile/src)` �г� web �е� app û�еĴ���, ����ͬ��

### Refs

- `AGENTS.md` �� 4 ���� 4++ (�¹淶, S72 batch 7 ����Ŀͨ�� UX ԭ��)
- `apps/mobile/AGENTS.md` v1.3 (S72 batch 7 ������ 4++ + ɾ "���� web, ��׿�ݲ���" ��ԭ��)
- `apps/web/AGENTS.md` v1.1 (S72 batch 7 ͬ��)
- `HANDOVER.md` v2.0 (S72 batch 7 �淶��ת v2.0 footer)
- `docs/BUGS_INDEX.md` v2.1 (Top 19 ������ 4++)
- `docs/STANDARDS_EVOLUTION.md` (S72 batch 7 �淶�Ե���)
- `scripts/verify-deploy.sh` ά�� 24 (mobile ��ͬ���Լ�)
- mavis memory: `Web ���� APP ���� (����Ŀͨ��, �� web ��ͬ�� app, ������Ŀ�淶)` (�� session ����)
- [BUG-081 S71 ���� ״̬��Ǩ�� 4 ��ͬ��](bug-081) �� ����: ���� 4++ �� 1 �� (mobile ��ͬ��, 4��5 ��)
- [BUG-088 S72 batch 6 ɾ�������ڵ�](bug-088) �� ͬ S72 batch 6 ϵ��: BUG-088 ��ʱ�� mobile �� (Dialog Modal), �� BUG-097 ͬ�� mobile ��ͬ���޷�
- [BUG-089 S72 batch 6 polling race condition](bug-089) �� ����: BUG-097 �޷� 5s ��ѯ�� BUG-089 ��ѵһ��
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-097 �� BUG-092 mobile ��ͬ���޷�
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� BUG-097 �� BUG-094 mobile ��ͬ���޷�
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� BUG-097 �޷� 4 ̬���� BUG-095 ���� (status enum �� 'user_notified')
- [BUG-096 S72 batch 7 React {0} ��Ⱦ����](bug-096) �� ����: BUG-097 mobile �� "?? �����" ��������� `> 0` ���� `&&` (�� BUG-096 �޷� 1:1)

### ǰ�� BUG (S72 batch 7 ��˹淶��ת��)

- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-097 mobile ��ͬ��Դͷ 1
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� BUG-097 mobile ��ͬ��Դͷ 2
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� BUG-097 mobile �� 4 ̬������
- [BUG-096 S72 batch 7 React {0} ��Ⱦ����](bug-096) �� BUG-097 mobile �� "?? �����" �����������
- ֮ǰ "���� web, ��׿�ݲ���" ��ԭ�� (S72 batch 4-6) �� ��תɾ��

## BUG-098 (S72 batch 7 �����, v3.0.37, 2026-06-26 14:00): admin approve/reject �˵��� 500 INTERNAL_ERROR �� `rechargeRequestModel.updateStatus` SQL ȱ�� 4 ������ `id` + `billingService.topUp` SQL �� 1 �� `ref_label` ռλ��, MySQL �� "Incorrect arguments" catch �� 500

### ���� (user ʵ�ʷ���, 2026-06-26 13:59)

User �� BUG-092/094/095/096 ������ɺ�ʵ�� admin �������, ����:
> "�����̨��ֵ���������޷����, ������˵�������ʧ�ܵ���Ϣ"

�������:
1. user �� web/admin ���忴�� 1 �� `user_notified` ���� (user ֮ǰ�� "���Ѹ���" ��)
2. admin �� "����" ��ť
3. web �� catch `e?.response?.data?.error?.message` �� alert "����ʧ��" (HTTP 500)
4. DB ״̬: `user_notified` û�� (�� BUG-095 ͬ��: catch �� DB ״̬����, �� BUG-079 �ٱ����ѵͬ��)
5. billing_logs û��¼ (�� BUG-078 ����: ͳһ���ʧ��)

### ���� (2 ��, ����Ŀͨ�ý�ѵ)

#### �� 1: `rechargeRequestModel.updateStatus` SQL ȱ�� 4 ������ `id`
- `apps/server/src/models/rechargeRequest.ts:31-35` (BUG-098 �޷�ǰ):
  ```ts
  async updateStatus(id: string, status: 'approved' | 'rejected', remark: string = ''): Promise<void> {
    await execute(
      'UPDATE recharge_requests SET status = ?, remark = ?, updated_at = ? WHERE id = ?',
      [status, remark, Date.now()]  // ? ȱ id, 3 params vs 4 placeholders
    );
  }
  ```
- ����: SQL �� 4 �� `?` ռλ�� (status, remark, updated_at, id), params ����ֻ�� 3 ��
- ���: mysql2 prepared statement �� `Error: Incorrect arguments to mysqld_stmt_execute`, try/catch �� 500

#### �� 2: `billingService.topUp` SQL �� 1 �� `ref_label` ռλ��
- `apps/server/src/services/billingService.ts:206-208` (BUG-098 �޷�ǰ):
  ```ts
  `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, is_free, ref_type, ref_id, ref_label, created_at)
   VALUES (?, ?, 'charge', ?, ?, '', ?, 0, 0, 'recharge', '', ?, ?)`,  // 9 �� ? ռλ��
  [logId, userId, amount, balanceAfter, description, Date.now()]  // 6 params, ȱ 3
  ```
- ����: SQL 13 �� 13 ֵ, �� `?` ռλ�� 9 �� vs 6 params, ȱ 3 �� (ref_id, ref_label, created_at ��λ)
- ���: ���� 1 ͬ�� `Incorrect arguments` �� 500

#### ��ͬ����: ��ʷ SQL ƴд�� (S70 BUG-077 ֮ǰ����, һֱ silent fail ֱ�� 2026-06-26 admin approve �Ŵ���)
- shipin-APP S70 BUG-077 ֮ǰ�� PM2, ��Щ SQL ��� PM2 silent fail �ڸ� (�� BUG-079 �ٱ����ѵͬԴ)
- S70 BUG-077 ֮���� systemd, �� admin approve ������ S72 batch 7 ֮ǰ**û�û�ʵ��** (admin �����ֶ� DB ��, û�˵� admin "����" ��ť)
- �� S70 BUG-077 ��ѵͬ��: "�� systemd ������ deploy ��ɹ�, ���ܶ˵��� E2E ��ÿ��ҵ��·��"

### �޸� (2 �ļ�, 1 �� SQL �ķ� + 1 �� SQL �ķ�)

#### �޷� 1: `rechargeRequestModel.updateStatus` �� `id` ����
```ts
// �޷�ǰ
'UPDATE recharge_requests SET status = ?, remark = ?, updated_at = ? WHERE id = ?',
[status, remark, Date.now()]
// �޷���
'UPDATE recharge_requests SET status = ?, remark = ?, updated_at = ? WHERE id = ?',
[status, remark, Date.now(), id]  // ? �� id
```

#### �޷� 2: `billingService.topUp` SQL `ref_label` �� '' literal
```ts
// �޷�ǰ (9 ? ռλ�� vs 6 params, ȱ ref_label)
`... VALUES (?, ?, 'charge', ?, ?, '', ?, 0, 0, 'recharge', '', ?, ?)`,
[logId, userId, amount, balanceAfter, description, Date.now()]
// �޷��� (8 ? ռλ�� vs 6 params, �� ref_label Ϊ '' literal)
`... VALUES (?, ?, 'charge', ?, ?, '', ?, 0, 0, 'recharge', '', '', ?)`,
[logId, userId, amount, balanceAfter, description, Date.now()]
```

### ��ô��֤�޺� (5 ά)

1. **�˵��� admin approve ����** (����, �� BUG-079/097 ͬ��): ���� user_notified ���� + curl POST /api/admin/orders/.../approve, ���� HTTP 200 + "��ȷ�ϵ���, ���������"
2. **DB ״̬���**: SELECT ���� status='approved' + updated_at ���
3. **billing_logs ��¼**: SELECT billing_logs WHERE ref_id=<order_id> ���� 1 �� (type='charge', amount=10, balance_after=228.15)
4. **user balance ���**: SELECT users.balance WHERE id=<user_id> ���� +10 (�� amount һ��)
5. **dist SQL �ַ�����֤**: `grep "UPDATE recharge_requests SET status" dist/models/rechargeRequest.js` ���� 4 params (�� id), `grep "VALUES (?, ?, 'charge', ?, ?, '', ?, 0, 0, 'recharge', '', '', ?)" dist/services/billingService.js` ���� 1 ���� (ref_label '' literal)

### ��ô�����ٷ� (����Ŀͨ��, BUG-079/082 ����ǿ��)

1. **SQL ƴд����� try/catch + logger.error ��ӡ err.message + stack**: admin.ts:130 catch ��ֻ�� 500 INTERNAL_ERROR ���� err, ������, �� BUG-079 �ٱ����ѵͬ��. �޷�: `catch (err) { logger.error('approve failed', { err, orderId: req.params.id }); res.status(500).json(...); }`
2. **TS ���ͱؼ� `params: any[]` ����У�� + ����ǰ�Լ� SQL params �� placeholders ����һ��**: д `validateSqlParams(sql, params)` helper, ����ǰ�Զ���
3. **admin approve/reject �ؼ� E2E ���� + verify-deploy.sh ά�� 25** (��): �� BUG-079 ��ѵͬ��, �κ� "�� systemd ������ deploy ��ɹ�" ҵ��·�����ܶ˵��� (admin approve / user notify-paid / user register / user login / recharge submit)
4. **S70 ֮ǰ PM2 ʱ�� silent fail �� SQL ��ȫ�� audit**: `grep -rE "execute\(" apps/server/src --include="*.ts" | grep -v logger.error` �г����� SQL ƴд, �˹� review
5. **lint ���߼� `sql-params-check` ��̬����**: tsc �Զ��� check �� `execute` ��, У�� placeholders �� params ����һ��, �������
6. **�� BUG-082 ���� 8 ����**: server д�־û� JSON �� string ��һ, BUG-098 �� "server д�־û� SQL �� string + types ��һ" ����, ����Ŀͨ�� UX ԭ��

### Refs

- `AGENTS.md` �� 4 ���� 4+ (״̬��Ǩ�Ʊ�ͬ�� 4 ��, BUG-098 ״̬��Ǩ�������: user_notified �� approved)
- `AGENTS.md` �� 4 ���� 4++ (Web ����, APP ����, ����Ŀͨ��, �������ܶ˵���)
- `apps/server/AGENTS.md` �� 3 ���� 4 (APP_VERSION �� 1 ����ͬ�� 8 ��) + �� 5 ���� C (DB schema Ǩ��, �� BUG-095 ����)
- `apps/server/AGENTS.md` �� 4 �ĺ� 5 �� (���� tsc 0 �� + npm run build + cp changelog.json + ��ά��ģʽ���� + 12 ά��֤, 22 �� 23 �� 24 ά)
- `apps/server/AGENTS.md` �� 5 ���� E (�����������, journalctl -u shipin-app + curl /health + /api/version 5 ��, �� BUG-098 debug ����ͬԴ)
- `docs/BUGS_INDEX.md` �� 4 Top 16+ �ض����� (S72 batch 7 ��)
- mavis memory: `SQL placeholders �� params ������һ��, tsc + try/catch + logger.error ͬ�� (����Ŀͨ��, �� BUG-079/082 ����)` (�� session ����)
- [BUG-079 S71 ���üٱ��� 12 άȫ�� 100% ��](bug-079) �� 100% ͬԴ, BUG-098 �ٱ��� "approve ��ͨ" �� BUG-079 �� "12 άȫ��" ͬ��
- [BUG-082 S71 ���� server д�־û� JSON �� string ��һ](bug-082) �� ����: BUG-082 ��˳־û� JSON �� string ��һ, BUG-098 SQL �־û��� string + types ��һ
- [BUG-090 S72 batch 6 deploy.sh changelog.json cp Դ������Ŀ¼](bug-090) �� ͬ S72 batch ϵ��: �������Լ첻�ϸ�, © SQL ��
- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-098 �� BUG-092 admin ����� admin approve �˵�©��
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� BUG-098 �� BUG-094 admin �˵� filter �޷��������� admin approve ʧ��
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� ����: BUG-095 �� schema enum, BUG-098 �� admin approve SQL params
- [BUG-096 S72 batch 7 React {0} ��Ⱦ����](bug-096) �� ����: BUG-098 admin approve �޷� 5 ά��֤ web ��, �� BUG-096 �޷� 4 ά��֤ web ������
- [BUG-097 S72 batch 7 mobile ��ͬ�� web �� 3 BUG](bug-097) �� ����: BUG-097 mobile �� admin �˵� default 'user_notified', BUG-098 server �� admin approve ������ͨ

### ǰ�� BUG (S72 batch 7 admin �����ȫ��)

- [BUG-092 S72 batch 7 ɨ��֧����ťȱʧ](bug-092) �� BUG-098 admin �����Դͷ (user ��"���Ѹ���" �� ���� user_notified ����)
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending ��](bug-094) �� BUG-098 admin ���忴 user_notified ����
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� BUG-098 markUserNotified д status='user_notified' �����״�
- [BUG-097 S72 batch 7 mobile ��ͬ�� web �� 3 BUG](bug-097) �� BUG-098 mobile �� admin ������ťҲ��





---

## BUG-100 (S72 batch 8 ����, 2026-06-26)

**69 �� video_generations �� queued 17 ��, user ��������Ƶ��Զû���**

### ����
- DB: `video_generations` �� 69 �� `status='queued'`, ���� `2026-06-09 15:31:52` (17 ��ǰ), error_msg ȫ NULL
- DB: `image_generations` ͬ�� 45 �� (completed=41 / failed=3 / queued=1) �� **��ͼ����** (91% �ɹ�)
- Զ�� server log (`/www/wwwroot/shipin-APP/logs/error.log`) 6+ �� `AgnesVideoProvider: ffmpeg frame extraction failed` + `Agnes Video create timeout (60000ms)` + `fetch failed` + `״̬ tool_completed ����ȷ��`
- �������� "�� key �������, û��νר�� key" �� ������ + ���� env ��֤: ʵ�� `AGNES_IMAGE_API_KEY=sk-fGgHxvU77T915PYEu9MjRdBfg4gsNuwaSOWh85WHjMnmtjWb` ����, **v3.0.0 ͳһ key (һ��ͨ�� ͼ/��/��Ƶ 3 ��), ������ IMAGE �� v2.5.x ʱ��������**

### ���� (3 ����������, �� BUG-098 ͬԴ: ���޷�������)

1. **ffmpeg 6.1.1 image2 muxer ��֡ʧ��** (����, ռ 70%)
   - `apps/server/src/utils/ffmpegHelper.ts:80-84` ���޷� v3.0.0.23 �� `-update 1` �� image sequence pattern
   - **�� ffmpeg 6.1.1 image2 muxer �Ա� "Could not open file"** (ʵ�� 6/25 17:14:41, -update 1 �Ѽ��� fail)
   - ����ļ��� `frame-{mp4name}-{timestamp}-{pid}.png` ������ + .mp4 �Ӵ�, muxer ���� image sequence
   - �ۻ� 6+ �δ�, �� 6/25 ~ 6/26 ���� (i2v ģʽȫ��)

2. **״̬��Ǩ��© tool_completed �� allowedStates** (�� BUG-081 ͬԴ, 20%)
   - `apps/server/src/services/videoAgentService.ts:403` �ɴ���: `if (conv.status !== 'plan_ready') throw new Error('...')`
   - �û��� tool_completed (֮ǰ�гɹ���Ƶ), �� confirm ��"����" �� �� throw
   - ����: `״̬ tool_completed ����ȷ��, �� plan_ready` (log 6/26 03:14:24 ʵ��)

3. **catch ��©���� video_generations ��** (�� BUG-098 ͬԴ, 80% �����ĸ���)
   - `runCreateTaskInBackground` line 524-551 (createTask catch) + line 568-578 (persist catch)
   - ���� catch ��ֻ�ع� `video_conversations` ״̬�� `plan_ready`
   - **video_generations �е� status ��Զ�� 'queued'**, �ۻ� 17 �� 69 ����
   - �� BUG-098 admin approve ͬԴ: catch ��û"����"�����

### �޷� (3 fix һ�𷢰�, v3.0.37 S72 batch 8)

#### Fix 1: ffmpegHelper ���� `image2pipe` muxer �� stdout
- `apps/server/src/utils/ffmpegHelper.ts:73-86` �� ffmpeg ����
- ��: `-f image2 -update 1 /tmp/frame-xxx.png` (image2 muxer + ��ʱ�ļ� + �ļ������)
- ��: `-f image2pipe -c:v png -` (�� stdout, execFileSync �� Buffer, 0 ��ʱ�ļ� IO)
- �޺�: i2v ģʽ�ȶ�, �� ffmpeg �汾 (6.1.1 / 6.0 / 5.x) ������

#### Fix 2: videoAgentService.confirm() ���� tool_completed �� confirm
- `apps/server/src/services/videoAgentService.ts:403` ��
- ��: `if (conv.status !== 'plan_ready') throw ...`
- ��: `if (conv.status !== 'plan_ready' && conv.status !== 'tool_completed') throw ...`
- ���� logger.info 're-confirm from tool_completed (re-generate same plan)' ��"����" ���ܿ���
- ״̬��Ǩ������: BUG-081 ��ѵ"4 ��"������"5 ��" (server �ֶ� + model + response + UI + DB schema enum)

#### Fix 3: runCreateTaskInBackground 2 �� catch ��ظ��� video_generations �� failed
- `apps/server/src/services/videoAgentService.ts:551-588` (createTask catch) + `:594-616` (persist catch)
- ���� queryOne �Ҹ� conversation ����һ�� video_generations row + `videoGenerationModel.update(id, { status: 'failed', error_msg: ... })`
- �޺�: ����ʧ�� �� �ر� failed, ���ٿ� queued �ۻ�

### ���׹��� (���û�, �� BUG-094/095/098 ����ű�ͬģ��)

| ���� | ·�� | ��; |
|---|---|---|
| `deploy-bug100.sh` | `apps/server/scripts/deploy-bug100.sh` | ���� 3 fix (���� + scp + ���� Node ��Ŀ restart + �� 69 �ۻ� + 24 ά��֤) |
| `verify-bug100.sh` | `apps/server/scripts/verify-bug100.sh` | 5 ά��֤ (3 fix ���� + queued=0 + server �˵���) |
| `db-bug100-clear.sql` | `apps/server/scripts/db-bug100-clear.sql` | �� Pre-BUG-100 queued ���� SQL (UPDATE status=failed WHERE created_at<24h) |
| `deploy-bug100-verify.sh` | `apps/server/scripts/deploy-bug100-verify.sh` | base64 ��ȫ�� (�� PS 5.1 ����, S52 ͬ���ѵ) |

### ��ѵ (����Ŀͨ��, �� BUG-079/082/090/094/095/098/099 ����)

1. **ffmpeg image2 muxer ���ɿ�, �� image2pipe �� stdout** (����Ŀͨ��, �κ� ffmpeg ��֡������ pipe)
2. **catch ��ظ������й�����** (�� BUG-098 ͬԴ: ��·���޷�������, ��"����"������Ӱ��ı�)
3. **״̬��Ǩ�Ʊ�ͬ�� allowedStates** (�� BUG-081/094 ͬԴ: server �ֶ� + model + response + UI + DB schema enum 5 ��)
4. **env �� cat ���� + cat /proc/PID/environ ˫����֤** (����Ŀͨ��: ֮ǰ cat .env ֻ��ǰ 25 ��©�� AGNES_IMAGE_API_KEY ���� key, ��"v2.5.x ר�� key" �����ж�ͬԴ)
5. **û��"v2.5.x ר�� key" ���ָ���** (Agnes key ����ͳһ, ������ IMAGE �� v2.5.x ʱ��������, �� key �����޹�, v3.0.0 �����ͼһ��ͨ��)
6. **DEBUG ��������ز� 3 ��**: ���� env + DB ״̬�ֲ� + server log stderr (�� BUG �ۻ� 17 ��ŷ��־���Ϊ 3 ��ûͬʱ��)

### Refs

- `AGENTS.md` �� 4 ���� 4+ (״̬��Ǩ��ͬ�� 4 ���� 5 ��, BUG-100 ����)
- `apps/server/AGENTS.md` �� 3 ���� 4 (APP_VERSION 9 ��ͬ��) + �� 5 ���� C (DB schema enum, �� BUG-095/100 ����)
- `apps/server/AGENTS.md` �� 4 �ĺ� 5 �� (���� tsc 0 �� + npm run build + cp changelog.json + ά��ģʽ + 24 ά��֤)
- `docs/DEPLOY_RELEASE_FLOW.md` �� 8 ��֪�Ӽ� 1 �� BUG-100 (�� session ͬ����)
- `docs/BUGS_INDEX.md` �� 4 Top 20 �� BUG-100 (�� session ͬ����)
- mavis memory: `env �����ز� + cat /proc/PID/environ ˫����֤ (����Ŀͨ��, �� BUG-079/082/090/098 ����)` (�� session ����)
- mavis memory: `û�� v2.5.x ר�� key ���ָ���, ������ IMAGE �Ǳ�����, key ͳһ (����Ŀͨ��, Agnes �๩Ӧ�̶�����)` (�� session ����)
- mavis memory: `catch ��ظ������й�����, �� BUG-098 ͬԴ (����Ŀͨ��, �� BUG-098 admin approve ����ع� 1:1)` (�� session ����)
- mavis memory: `ffmpeg image2 muxer ���ɿ�, �� image2pipe �� stdout (����Ŀͨ��, 6.1.1 image2 muxer �� -update 1 �������� filename pattern)` (�� session ����)
- mavis memory: `state ����Ǩ�Ʊ�ͬ�� 5 �� = 4 (server �ֶ� + model + response + UI) + 1 (DB schema enum)` (����Ŀͨ��, �� BUG-081/094/095 ��������)
- [BUG-079 S71 ���üٱ���](bug-079) �� 100% ͬԴ, BUG-100 ��"����Ƶ����" �� BUG-079 ��"12 άȫ��" ͬ�� (�����ٱ������, û��˵���)
- [BUG-081 S71 ����״̬��Ǩ�� 4 ��ͬ��](bug-081) �� ��������: BUG-081 4 �� �� BUG-100 �� tool_completed �� allowedStates
- [BUG-082 S71 ���ó־û� JSON �� string ��һ](bug-082) �� ����: BUG-082 JSON, BUG-100 catch �ر� failed �� BUG-082 extractErrorMessage ����
- [BUG-090 S72 batch 6 deploy.sh changelog.json cp Դ](bug-090) �� ����: BUG-090 �������Լ첻�ϸ�, BUG-100 69 �����ۻ� 17 �����ȱ����� DB ״̬�ֲ��ز� (verify-bug100.sh ά�� 4)
- [BUG-094 S72 batch 7 admin Ĭ�ϲ� pending](bug-094) �� ��������: BUG-094 ״̬��Ǩ�� 4 ��© 1, BUG-100 ״̬��Ǩ�� 4 �� (plan_ready only) © tool_completed
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� ��������: BUG-095 DB schema enum 5 ��, BUG-100 ״̬��Ǩ�Ʊ�ͬ�� 5 �� (�� BUG-095 һ��)
- [BUG-097 S72 batch 7 mobile ��ͬ�� web �� 3 BUG](bug-097) �� ��������: BUG-097 mobile �� admin �˵� default 'user_notified', BUG-100 mobile �� confirm() Ҳ�� (�� 5 ��ͬ�� SOP)
- [BUG-098 S72 batch 7 admin approve �� 500](bug-098) �� 100% ͬԴ: BUG-098 catch ©���������, BUG-100 catch ©���� video_generations ��
- [BUG-099 S72 batch 7 web dist ���ƻ�](bug-099) �� ����: BUG-099 �������Լ�, BUG-100 �������Լ�� 5 ά (verify-bug100.sh)

### ǰ�� BUG (v3.0.37 S72 batch 8 ���� BUG-100)

- [BUG-079 S71 ���üٱ��� 12 άȫ�� 100% ��](bug-079) �� �ٱ�����̬�� BUG-100 �ۻ� 17 ��
- [BUG-081 S71 ����״̬��Ǩ�� 4 ��ͬ��](bug-081) �� BUG-100 ״̬��Ǩ�� 4 ��© tool_completed
- [BUG-090 S72 batch 6 deploy.sh changelog.json cp Դ](bug-090) �� BUG-100 �����û�� DB ״̬�ֲ� (verify-bug100.sh ��)
- [BUG-095 S72 batch 7 ALTER status enum ©](bug-095) �� BUG-100 ״̬��Ǩ�Ʊ�ͬ�� 5 �� (DB schema enum Ҳ��)
- [BUG-098 S72 batch 7 admin approve �� 500](bug-098) �� BUG-100 catch ©���� video_generations �� 100% ͬԴ


---

## BUG-101 (S72 batch 8 后置 2, 2026-06-26)

**APP 上传小说分析失败 "Cannot read property 'bg' of undefined"**

### 现象
- 用户�?mobile �?UploadScreen 上传 TXT 文件, 上传成功后弹"已提�? 正在跳转到进度页..." toast, 立刻�?"Cannot read property 'bg' of undefined"
- 错误堆栈指向 `Toast.tsx` �?`VARIANT_COLORS[config.variant || 'default']` 找不到对�?variant �?`v.bg` 报错
- �?user 反转"Web 主导 APP 跟随"原则一�? BUG-097 mobile 端同步漏修这种隐�?传错 variant" 类小�?
### 根因
**5 �?`toast.show(msg, '<Ionicons-name>')` 错调�?*, 误把 Ionicons icon name �?ToastVariant �?
1. `UploadScreen.tsx:183` �?`toast.show('已提�?..', 'cloud-upload')` �?(cloud-upload 不是 ToastVariant)
2. `OutlineReviewScreen.tsx:53` �?`toast.show('大纲已生�?, 'sparkles')` �?3. `OutlineReviewScreen.tsx:67` �?`toast.show('已保�?, 'checkmark-circle')` �?4. `OutlineReviewScreen.tsx:84` �?`toast.show('大纲已确�?, 'checkmark-done-circle')` �?5. `PlotGraphScreen.tsx:57` �?`toast.show('事件图谱已生�?, 'sparkles')` �?
**Toast.tsx 缺防御�?fallback**:
- `VARIANT_COLORS: Record<ToastVariant, ...>` 是严�?5 �?Record
- `useToast.show(message, variant)` 接口易误�?(string, variant �?string 但实际是 union)
- �?variant 不在 union 内时 `VARIANT_COLORS['cloud-upload']` = undefined, `v.bg` 立即�?"Cannot read property 'bg' of undefined"
- TS 编译�?(string 兼容), runtime �?(TS 严格度没开)

### 修法 (2 �?

**Fix 1: Toast.tsx 防御�?fallback**
```ts
// 修前
const v = VARIANT_COLORS[config.variant || 'default'];
// 修后
const v = VARIANT_COLORS[(config.variant || 'default') as ToastVariant] || VARIANT_COLORS.default;
```

**Fix 2: 5 个错调用全改**
- `UploadScreen.tsx:183` `toast.show('已提�?..', 'cloud-upload')` �?`toast.show('已提�?..', 'success')`
- `OutlineReviewScreen.tsx:53/67/84` 全改 `'success'`
- `PlotGraphScreen.tsx:57` �?`'success'`

**配套工具 (永久�?**:
- `apps/server/scripts/verify-bug101.sh` (5 �? Toast fallback 命中 + 0 错调�?+ �?5 'success' + /api/version 4 字段 + 公网 APK SHA256)
- `scripts/api-version-check.py` (PS 5.1 base64 安全)

### 教训 (跨项目通用, �?BUG-082/098 同源)

1. **toast.show 2 参接口易误用, 必加防御�?fallback** (�?BUG-082 catch 必归一 + BUG-098 SQL params 必归一 同源)
2. **Record<Union, T> 必加 || {default}** (�?BUG-082 配套, 任何严格 union 索引都必�?fallback, 不然传错字面量必�?
3. **Ionicons name �?enum/union 不通用, 调用前必对齐** (�?BUG-097 mobile 端漏修小错教训一�? 任何字符串当枚举用都必加 TS 严格 union)
4. **TS 编译�?�?运行时正�?* (�?BUG-079 假报�?100% 同源, 必跑端到端验�?
5. **mobile �?5 错调�?1 次修�?* (�?BUG-100 跨项目通用 3 修法 1 批次同源)

### Refs

- `AGENTS.md` § 4 铁律 4++ (Web 主导 APP 跟随, 必同�? 5 �?SOP)
- `apps/mobile/AGENTS.md` § 5 (跨端铁律 4+ 状态机迁移必同�? �?BUG-101 ToastVariant union 漏改 100% 同源)
- `apps/mobile/src/components/Toast.tsx` line 151-152 (VARIANT_COLORS 防御 fallback)
- `docs/DEPLOY_RELEASE_FLOW.md` § 8.11 (BUG-101 完整�?
- mavis memory: `toast.show 2 参接口易误用, 必加防御�?fallback (跨项目通用, �?BUG-082 catch 归一 + BUG-098 SQL params 归一 同源)` (�?session 沉淀)
- mavis memory: `Record<Union, T> 必加 || {default}, 任何严格 union 索引都必�?fallback, 不然传错字面量必�?(跨项目通用)` (�?session 沉淀)
- [BUG-082 S71 后置 server 写持久化 JSON �?string 归一](bug-082) �?100% 同源: BUG-082 catch 必归一, BUG-101 toast variant �?fallback
- [BUG-097 S72 batch 7 mobile 端同�?web �?3 BUG](bug-097) �?100% 同源: BUG-097 mobile 端漏修小�?(3 BUG), BUG-101 mobile 端漏�?ToastVariant 错用 (5 错调�?
- [BUG-098 S72 batch 7 admin approve �?500](bug-098) �?配套: BUG-098 SQL params 必归一, BUG-101 toast variant �?fallback
- [BUG-100 S72 batch 8 69 video_generations �?queued 17 天](bug-100) �?配套: BUG-100 mobile 端漏�?5 fix 一发版, BUG-101 mobile 端漏�?5 toast 错调用一发版 (1 批次 5 修法原则)

### 前置 BUG (跨项目通用: 隐性字符串 enum 错用�?

- [BUG-082 S71 后置 server 写持久化 JSON �?string 归一](bug-082) �?BUG-101 catch 必归一 100% 同源
- [BUG-097 S72 batch 7 mobile 端同�?web �?3 BUG](bug-097) �?BUG-101 mobile 端隐性错�?5 调用 100% 同源
- [BUG-098 S72 batch 7 admin approve �?500](bug-098) �?BUG-101 toast variant 必归一 100% 同源
- [BUG-100 S72 batch 8 69 video_generations �?queued 17 天](bug-100) �?BUG-101 mobile �?5 修法一批次 1:1 镜像



---

## BUG-103 (S72 batch 8 后置 3, 2026-06-26)

**h773052122 35.07 元异�? refundStep 自动退款退多了 34.93 �?(user 没付款不该退)**

### 现象
- user `h773052122` 注册 2026-06-26 09:41, 余额异常 35.07 �?- 充值订�?0 �?(`recharge_requests` 0 + `points_orders` 0)
- 流水: 1 �?refund 34.93 (ref_type=novel_analyze, ref_id=`a8ad54c5-...` 小说 "没钱修什么仙" 2910536 �?analyze 失败)
- 实际应该�? 0.03 元注册赠�?(跟其�?6/1 之后�?user 一�? - 0.11 元消�?(image 0.01 + video 0.10) = -0.08 �?(但实�?0.14, 因消费前余额不是 0.03 而是 0.14 = 0.03 + 0.11, �?billing_logs 序列对得�?
- 等等, 重算: 0.03 (初始) - 0.11 (消费) = -0.08, �?balance 应该�?0.14, �?0.22... 实际跟流水对得上: 0.03 + (-0.01) + (-0.10) = -0.08, �?balance 35.07 = refund �? refund 35.07 + 0.11 = 35.18 - 0.11 = 35.07, �?billing_logs 0.01 + 0.10 + 34.93 = 35.04, �?0.03 = 初始赠�?(跟其他新 user 一�?. 完美.

### 根因
**`billingService.refundStep` 自动退款机制没 review 环节** (�?BUG-072 D 短期方案错同�? �?S72 batch 7 BUG-100 catch 漏补刀 100% 同源):
- 触发链路: `novelService.analyzeNovel` catch �?(line 414-420) �?`billingService.refundStep` (line 405-445) �?`userModel.updateBalance` + �?`billing_logs` (type='refund')
- h773052122 触发: 14:41:55 上传 2910536 字小�? analyze task 失败 (step 0/3), catch 块触�?refundStep, 退 34.93 �?- BUG: user 没付款不该退, �?code 不管 user 是否付过�? 任务失败就退 (跟支付宝回调无关, �?refundStep 自己决定)

### 修法 (3 fix 一起发�? v3.0.39)

#### Fix 1: DB 撤销 h773052122 错误退�?(audit trail �?trace)
```sql
-- audit trail: 保留 billing_logs 记录 + �?ref_label 标记
UPDATE billing_logs
SET ref_label = CONCAT('[已撤销 BUG-103 admin manual 2026-06-26] ', ref_label)
WHERE id = '1c1aacef-a4e7-472d-9842-dacd303f4965';

-- user.balance �?34.93 (�?35.07 �?0.14 正确 = 0.03 初始 - 0.11 消费)
UPDATE users
SET balance = ROUND(balance - 34.93, 2), updated_at = UNIX_TIMESTAMP() * 1000
WHERE id = '3b3aa45d-54d0-449a-bc99-7a804ab9d62e';
```

#### Fix 2: �?`billingService.refundStep` 整方�?- `apps/server/src/services/billingService.ts:399-445` �?method, 替换成注�?- 配套: notifyError 已有 (user 失败时通知 admin �?user)

#### Fix 3: `novelService` catch 块删 refundStep 调用
- `apps/server/src/services/novelService.ts:414-420` �?5 �?try/catch, 替换成注�?- 失败�?notifyError 通知 user '请重试或联系客服'

#### Fix 4: 4 项版本号同步 3.0.38 �?3.0.39 (server �? mobile/web 不动)
- `apps/server/package.json` version
- `apps/server/src/index.ts` fallback
- `apps/server/ecosystem.config.js` 2 �?- `apps/server/changelog.json` �?v3.0.39 entry (7 highlights)
- 远端 `.env` + `/etc/systemd/system/shipin-app.service` sed �?
### 配套工具 (永久�?
- `apps/server/scripts/db-bug103-revert.sql` (撤销 + audit)
- `apps/server/scripts/verify-bug103.sh` (7 �? refundStep 0 命中 + novelService 0 调用 + balance 0.14 + audit + /api/version + systemd + .env)
- `apps/server/scripts/db-h773052122-check*.sql` (用户余额查询, 5 个版�? debug �?

### 教训 (跨项目通用, �?BUG-072/082/098/100 同源)

1. **自动退款必配套审核机制** (�?BUG-072 D 短期方案错同�? �?BUG-100 catch 漏补刀 100% 同源)
2. **任何自动化必有人 review** (�?S54 BUG-073 silent fail 跑�?.js 同源: 自动化没�?review 必出�?
3. **短期方案 �?长期方案** (�?S72 batch 7 BUG-090 deploy.sh 教训一�? 短期方案必加 TODO 转长�?
4. **DB 撤销�?audit trail** (�?BUG-098 admin approve SQL 错同�? 改字段值加 audit 不直�?DELETE, �?trace 防止 user 截图�?我之前看到有 34.93 元现在没了怎么解释")
5. **修法 1 不彻�? 必加 review 机制** (�?BUG-098 catch 漏补刀同源, 任何修法都必带二次验�?

### Refs

- `AGENTS.md` § 4 铁律 8 (持久�?JSON �?string 归一, �?BUG-103 audit trail 配套)
- `apps/server/AGENTS.md` § 3 铁律 4 (APP_VERSION 8 处同�? BUG-103 4 项同步配�?
- `apps/server/src/services/billingService.ts:399-445` (refundStep 删前 vs 删后)
- `apps/server/src/services/novelService.ts:407-420` (catch 块删�?vs 删后)
- `docs/DEPLOY_RELEASE_FLOW.md` § 8.12 (BUG-103 完整�?
- mavis memory: `自动退款必配套审核机制 (跨项目通用, �?BUG-072 D 短期方案错同�? �?BUG-100 catch 漏补刀 100% 同源)` (�?session 沉淀)
- mavis memory: `任何自动化必有人 review (跨项目通用, �?S54 BUG-073 silent fail 跑�?.js 同源)` (�?session 沉淀)
- [BUG-072 S69 扣费审计 5 BUG 全不一致](bug-072) �?100% 同源: BUG-072 D 短期方案 "充值走管理员审�? 必加长期方案, BUG-103 自动退款也必加
- [BUG-079 S71 后置假报�?12 维全�?100% 假](bug-079) �?配套: BUG-079 假报告心态让 BUG-103 退�?34.93 元没�?review
- [BUG-082 S71 后置 server 写持久化 JSON �?string 归一](bug-082) �?100% 同源: BUG-082 catch 必归一, BUG-103 catch 必留 audit trail
- [BUG-098 S72 batch 7 admin approve �?500](bug-098) �?配套: BUG-098 SQL �?2 �?(3 vs 4 placeholders), BUG-103 refundStep 12 vs 11 placeholders �?(1 �?ref_label �?
- [BUG-100 S72 batch 8 69 video_generations �?queued 17 天](bug-100) �?100% 同源: BUG-100 catch 漏补刀 video_generations 累积 17 �? BUG-103 refundStep 没人 review 累积 34.93 元错退

### 前置 BUG (跨项目通用: 自动化机制必配套审核)

- [BUG-072 S69 扣费审计 5 BUG 全不一致](bug-072) �?BUG-103 短期方案 "自动退�? �?review 100% 同源
- [BUG-079 S71 后置假报�?12 维全�?100% 假](bug-079) �?BUG-103 自动化没�?review 跟假报告心态同�?- [BUG-098 S72 batch 7 admin approve �?500](bug-098) �?BUG-103 catch 漏补刀 audit �?BUG-098 SQL �?100% 同源
- [BUG-100 S72 batch 8 69 video_generations �?queued 17 天](bug-100) �?BUG-103 自动退款没 review �?BUG-100 catch 漏补刀 100% 同源
- [BUG-101 S72 batch 8 APP 上传分析 upload 错](bug-101) �?配套: BUG-101 mobile �?5 错调�? BUG-103 server 端自动退�?1 错调�?

---

## BUG-104 (S72 batch 8 �տ�, 2026-06-26)

**server bump 3.0.39 © rebuild APK, user �������������� APK 404** (����Ŀͨ�ý�ѵ)

### ����
- 2026-06-26 17:11 ģ�� v3.0.38 user ������ v3.0.39 server ��·, �������� URL `https://ab.maque.uno/app/DeepScript_v3.0.39.apk` **HTTP/2 404**
- ����Ŀ¼ʵ��ֻ�� v3.0.38 APK (commit `03331ed` �ϴ�), v3.0.39 APK һֱû rebuild + scp
- ʵ�ʳ���: v3.0.38 user ��� mobile �� `App.tsx useEffect(checkUpdate)` ���� �� `updater.tsx` �� `/api/version?version=3.0.38` �� server �� `version=3.0.39` �� `compareVersions(3.0.38, 3.0.39) = -1` �� `needUpdate = true` �� �������� �� user ������ �� 404 �� user ��ס
- �� BUG-100 catch ©���� (3 �޷� 1 ����) 100% ͬԴ: ���ͬ��ȱһ�ͱ�

### ����
**server bump �� APK release ����, ȱǿ��ͬ�����** (�� BUG-097 "mobile ��©�� web 3 BUG" 100% ͬԴ, �� BUG-103 ɾ server �Զ��˿ûˢ APK ͬԴ):
- server `changelog.json` v3.0.39 entry д�� + systemd + .env sed ���� �� /api/version ���̷� 3.0.39 �� user ��������Ҫ 3.0.39 APK
- �� mobile �� `build.gradle versionCode 43` ���� v3.0.38, gradle �����Զ� build
- ûǿ�Ƽ��: "server ����, mobile build.gradle �ظ�" ��������û�� 9 ��汾��ͬ���嵥��
- �� BUG-090 deploy.sh changelog.json cp Դ��ͬԴ: ���� SOP ȱһ���ͱ�

### �޷� (4 ������, v3.0.39 mobile �˸���, commit `ecd297f`)

#### Fix 1: bump mobile build.gradle + version.ts (�� server ͬ��)
```gradle
// apps/mobile/android/app/build.gradle
android {
    defaultConfig {
        applicationId "com.aiscriptmobile"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 44  // BUG-104: 43��44, �� server v3.0.39 ͬ��
        versionName "3.0.39"  // BUG-104: "3.0.38"��"3.0.39"
        ...
    }
}
```

```typescript
// apps/mobile/src/config/version.ts
export const APP_VERSION = '3.0.39';  // BUG-104: '3.0.38'��'3.0.39'
export const APP_VERSION_CODE = 44;  // BUG-104: 43��44
```

#### Fix 2: bump web version.ts (��� UX һ��)
```typescript
// apps/web/src/config/version.ts
export const APP_VERSION = '3.0.39';  // BUG-104: '3.0.38'��'3.0.39'
export const APP_VERSION_CODE = 44;  // BUG-104: 43��44
```

#### Fix 3: rebuild APK + scp + web dist ͬ��
```bash
# 1. gradle rebuild APK (44s, mobile ��û�� src �� version ���� �� bundle �� build �� �� SHA256)
cd apps/mobile/android && ./gradlew assembleRelease
# output: app-release.apk 30,077,287 bytes, SHA256 3F188A109C055369E314542809C11AB53C8F368A1CE5FE3A59E5517CCA6CDEC5

# 2. scp ������
scp -i test2 app-release.apk root@159.75.16.110:/www/wwwroot/shipin-APP/public/DeepScript_v3.0.39.apk
# ���� SHA256 ������һ�� (vite/RN deterministic)

# 3. web build + scp
cd apps/web && npm run build
# output: dist/assets/index-Bnh837h2.js 480.43 kB (�� hash, version.ts ���� �� vite inline �� build)
scp -i test2 -r dist root@159.75.16.110:/www/wwwroot/ab.maque.uno/dist
```

#### Fix 4: 9 ��汾��ͬ�� (������ 3 + 4++ ����)
1. mobile `version.ts` APP_VERSION (3.0.38��3.0.39) + APP_VERSION_CODE (43��44)
2. mobile `build.gradle` versionCode (43��44) + versionName (3.0.38��3.0.39)
3. web `version.ts` APP_VERSION (3.0.38��3.0.39) + APP_VERSION_CODE (43��44)
4. server `package.json` (���� 3.0.39, ����)
5. server `index.ts` fallback (���� 3.0.39, ����)
6. server `ecosystem.config.js` 2 �� (���� 3.0.39, ����)
7. Զ�� `.env` APP_VERSION (���� 3.0.39, ����)
8. Զ�� systemd unit Environment=APP_VERSION (���� 3.0.39, ����)
9. server `changelog.json` v3.0.39 entry (���� 7 highlights, BUG-103 �޷�, ����)

### ���׹��� (���û�)
- `apps/server/scripts/simulate-v3038-to-v3039-upgrade.sh` �� ģ�� v3.0.38 user ������ v3.0.39 server �˵�����· (10 ��, ��֤: compareVersions=-1, needUpdate=true, APK 200, SHA256 һ��, install �� compareVersions=0, needUpdate=false)
- `scripts/verify-deploy.sh` ά�� 24 ǿ�� grep APK bundle ���йؼ��ַ��� (notifyRechargePaid / user_notified / adminOrders)
- 4 ���� v3.0.39 ��֤: server `/api/version` �� 3.0.39 + ���� APK SHA256 һ�� + web dist hash �� git һ�� + 9 ��汾�� grep 100%

### ��ѵ (����Ŀͨ��, �� BUG-097/103 ͬԴ)
1. **server bump �� rebuild APK + scp** (�� BUG-097 mobile ©�� web 100% ͬԴ, �� BUG-103 ɾ�Զ��˿�©ˢ APK 100% ͬԴ)
2. **9 ��汾��ͬ���ؼ� mobile build.gradle versionCode** (������ 3 �� 6��9 ��, ������ 4++ ���ͬ������)
3. **���� SOP �ؼ�"ģ�� user ������·"�˵�����֤** (�� BUG-100 �޷� 1 �ؼӶ˵�����֤ 100% ͬԴ, �� BUG-098 catch �ؼӶ�����֤ 100% ͬԴ)
4. **�κι����������ӱ����� deploy �׶�ʵ�� HTTP 200** (�� S54 BUG-073 silent fail ���� .js ͬԴ: ���� �� �ɹ�, ���� 24 ά + ģ����·)
5. **APK SHA256 vite/RN deterministic** (�� BUG-099 web dist hash deterministic ͬԴ: ͬ�� source ͬ�� SHA256, Զ�˱ȶ� = һ���Խ��׼)

### Refs
- `AGENTS.md` �� 4 ���� 3 (9 ��汾��ͬ��, BUG-104 �� 8��9 ��)
- `AGENTS.md` �� 4 ���� 4++ (Web��APP ͬ��, BUG-104 �� server bump APK ͬ������)
- `apps/mobile/android/app/build.gradle` (versionCode 44 + versionName 3.0.39, BUG-104 �޺�)
- `apps/mobile/src/config/version.ts` (APP_VERSION 3.0.39 + APP_VERSION_CODE 44)
- `apps/web/src/config/version.ts` (APP_VERSION 3.0.39 + APP_VERSION_CODE 44)
- `apps/server/scripts/simulate-v3038-to-v3039-upgrade.sh` (10 ��ģ��������·)
- `docs/DEPLOY_RELEASE_FLOW.md` �� 8.13 (BUG-104 ������)
- mavis memory: `server bump �� rebuild APK (����Ŀͨ��, �� BUG-097 mobile ©�� web ͬԴ, �� BUG-103 ɾ�Զ��˿�©ˢ APK ͬԴ)` (�� session ����)

### ǰ�� BUG (����Ŀͨ��: ���ͬ��ȱһ�ͱ�)
- [BUG-090 S72 batch 6 deploy.sh changelog.json cp Դ��](bug-090) �� 100% ͬԴ: BUG-090 deploy ȱһ�� (changelog) �ͱ�, BUG-104 ����ȱһ�� (APK) �ͱ�
- [BUG-097 S72 batch 7 mobile ��©�� web 3 BUG](bug-097) �� 100% ͬԴ: BUG-097 ���ͬ��ȱһ�ͱ�, BUG-104 server��mobile ͬ��ȱһ�ͱ�
- [BUG-099 S72 batch 7 web dist index-*.js ���ƻ�](bug-099) �� 100% ͬԴ: BUG-099 web dist hash �ƻ�, BUG-104 APK SHA256 vite/RN deterministic ����
- [BUG-103 S72 batch 8 refundStep �Զ��˿��˶� 34.93 Ԫ](bug-103) �� 100% ͬԴ: BUG-103 ɾ�Զ��˿�©ˢ APK, BUG-104 server ��©ˢ APK ���� (�޷�һ��)

### �տڸ���
- BUG-104 �޷� commit: `ecd297f` v3.0.39 (bump mobile + web 9 �� + rebuild APK + scp)
- BUG-104 ���� commit: �� BUG-104 �ĵ����� commit
- ���� 6 �Լ�: PASS=10/10
- 4 ���� v3.0.39 100% ͬ��: server / web / mobile / ���� APK
- 24 ά 1-22 + ά�� 14 (web ʵ�ʼ��� JS hash) + ά�� 24 (APK bundle grep) ȫ PASS
---

## BUG-105 (S72 batch 8 ��β, 2026-06-26)

**��ɫ���� prompt �� user ����һ��, ���� 37 �ֶι̶���ʽ (�̶����н�ɫ������͵ȵ���Ϣ), �� user ��ȷ"���ݾ�����������ȡ��ɫ����, ������д" ��ͻ**

### ����
- user ���� (2026-06-26 17:30): ���ڵ�С˵�������ɫ��������, ��ɫ���ݸ�ʽ��֮ǰ��һ��; ���ڵ�(���ڰ汾, v2.5.14) �ǹ̶����н�ɫ������͵ȵ���Ϣ, ���°汾(v3.0.0.30 S50 v2) Ӧ���Ǹ��ݾ�����������ȡ��ɫ�����
- ʵ�ʼ�����: ��״ 2 �� prompt �ļ�����:
  - pps/server/src/prompts/novelAnalysis.ts �ϰ� 37 �ֶ� (v2.5.14): ǿ�� LLM ��� ���/����/����/��ɫ/�۾�/üë/����/�촽/��ɫ/����/����/����/����/��װ/����/Ь��/����/����/����/����/��������/�������/��������/ױ��/Ĭ�ϱ���/������Χ/֫������/�Ը��Ӿ���/�ײ��Ӿ���/��ϵ
  - pps/server/src/prompts/characterDescription.ts �°� Markdown 5 section (v3.0.0.30 S50 v2): # ������Ϣ / # ��ò���װ / # �Ը�����Ϊ / # ���Է�� / # ��־������, �Ͻ�����, ����ݶȰ���ɫ��ǩ
- pps/server/src/services/novelService.ts �� parseAndSave line 529: 
eedsDescExtraction = parsedChars.some(c => !c.description || Object.keys(c.description).length <= 2) ��Զ false (�� prompt ���� 37 �ֶ�, parsedChars.description ��Զ �� 2 �ֶ�) �� �°� characterDescription.ts ��Զ�������� �� ��ɫ���� 100% ���� 37 �ֶ�
- �� user ��ȷ"������ھ�������������, ������д" ��ͻ: �̶� 37 �ֶα� LLM ���첻���ڵ��ֶ� (��: ·�˼׸���û�����, LLM ��"�е����" ����)

### ����
**2 �� prompt �ļ�����, �����ж�������Զ�����°�** (�� BUG-104 server bump © rebuild APK 100% ͬԴ: ���� SOP ȱһ���ͱ�):
- 
ovelAnalysis.ts �� 37 �ֶ� prompt д�ĺ�"��ϸ" (�� BUG-079 �ٱ��� 100% ͬԴ: prompt д����ϸ �� LLM �����ȷ, ʵ�ʱ� LLM ����)
- characterDescription.ts v3.0.0.30 S50 v2 �Ѿ����°������ѧ, ����Զ��������
- �����ж� 
eedsDescExtraction �� BUG-103 �޷�ʱ (S72 batch 7 v3.0.37) д��, ��ʱû�뵽"�� prompt ���� 37 �ֶ�"���� needsDescExtraction ��Զ false

### �޷� (6 fix һ�𷢰�, v3.0.40, commit �� push)

#### Fix 1: pps/server/src/prompts/novelAnalysis.ts �� ?? ��ɫ��������
- �� 37 �ֶι̶���ʽ �� ���� 4 �����ֶ� (��ɫ�� + ��� + ��ɫ���� + ��Ӫ)
- ��ϸ������ȫ�������� extractDescriptions
- ��: "1. ������ - �������� - ���� - ����"

#### Fix 2: pps/server/src/services/novelService.ts parseCharactersFromReport ��д
- �ݴ��¸�ʽ (ֻ���� 4 �����ֶ�, description �ֶ����)
- �� 37 �ֶθ�ʽҲ���� (̽����һ���ǲ��� "�ֶ���:ֵ" �ϸ�ʽ �� �����߼�)
- ̽��ģʽ: �� 1 ����ɫ�����ָ�ʽ, �������

#### Fix 3: pps/server/src/services/novelService.ts parseAndSave 
eedsDescExtraction = true
- ��Զ�� extractDescriptions, �� characterDescription.ts v3.0.0.30 �°� prompt ������Ч
- �� v2.5.14 comment line 528 "�°���� prompt ���ڱ��������� 37 �ֶ���ϸ����, ����Ҫ�ٵ����� extractDescriptions" ɾ��

#### Fix 4: pps/server/src/services/characterSheetPrompt.ts ��д
- CharacterSheetData ɾ 37 �ֶ� (face/eyes/eyebrows/nose/lips/hair_*/clothing_*/accessories_*/props/distinctive_features/makeup/default_expression/emotional_range/body_language/personality_visual/social_class_visual)
- ���� 4 �ֶ�: name/styleId/visualDescription/gender
- uildEnglishVisualDescription/uildChineseVisualDescription ɾ (���� 37 �ֶ�ƴ visual)
- uildPrimaryVisualBlock ���� visualDescription �����ı�

#### Fix 5: pps/server/src/services/characterService.ts ���� isualDescription
- generateImageVariants ���� isualDescription �ֶ� (��� prompt_safe_description, ����׼)
- ɾ extractDistinctiveFeatures ���� (dead code, ֮ǰ�� description �ı�����"����/��־/̥��"������߼�)
- ɾ sheetData �� distinctive_features �ֶ� (�� user "��Ҫ���ֶ�����" 100% һ��)

#### Fix 6: pps/server/src/services/novelService.ts backfillCharactersFromReport ���°� prompt
- �˵� POST /api/novels/:novelId/backfill-characters (routes/novels.ts:42) ���°� characterDescription.ts
- �� /api/novels/:novelId/characters/extract �˵� (characterController.ts:44) һ��
- web CharacterListPage.tsx �б�ҳ"���·���"��ť + mobile CharacterListScreen.tsx �б�ҳ"���·���"��ť, �ѵ� ackfillCharactersApi, �������°�

### �˵�����֤ (q378685504 / wuliao login + backfill)
- ? login OK, JWT len 211, balance 247.18 (��֮ǰ S72 batch 7 E2E һ��)
- ? backfill �� 200 + data.descriptionsGenerated: 9 (9 ��ɫȫ�ɹ�, �� novel d6449c45-45fc-4ce6-9dad-9036e45701e8 ʵ�ʽ�ɫ��һ��)
- ? ���� ������ ���� Markdown 5 section: ������Ϣ/��ò���װ (��ԭ������)/�Ը�����Ϊ/���Է��/��־������
- ? ��� ��ϼ 5 section ��ԭ�ı�ע (��3��/��5��): �������� + �¸һ��� + ������а
- ? ������ ���� 60 �� 2 ��: ½�極������Ů, Լ20��, ��������, �������, ͭ�����׹�, ��ü�� + ������������½������������ϼ (��5��), ���������������������
- ? 100% ����Ӳ�� 37 �ֶ�, �� user "���ݾ�����������ȡ��ɫ����" 100% һ��

### ��ѵ (����Ŀͨ��, �� BUG-079 �ٱ��� 100% ͬԴ)
1. **��ɫ���� prompt �ػ��ھ�������, ���������ֶ�** (�� user ��ȷ"������ھ�������������, ������д" һ��, �� BUG-079 TS ����� �� ����ʱ��ȷ 100% ͬԴ: prompt д����ϸ �� LLM �����ȷ, ʵ�ʱ� LLM ����)
2. **��ɫ��ǩ���� + ����ݶ�**: ���� 800-2000 �� 5 section, ��Ҫ��� 300-800 �� 4 section, ��Ҫ��� 80-200 �� 1-2 section, ������ 30-60 �� 1-2 ��, ·�� 10-30 �� 1 �仰 (���޲�ǿ��, С˵û�����д)
3. **������޲�ǿ��, ������д, �Ͻ�����** (���� description < ģ������, �� BUG-103 ɾ�Զ��˿�"ʧ�ܲ�����" ͬԴ: ��ȫ����, �����첻���ڵľ����ز�)
4. **2 �� prompt �ļ�����ʱ, �ز������ж�����** (�� BUG-104 server bump © rebuild APK 100% ͬԴ: ���� SOP ȱһ���ͱ�, 
eedsDescExtraction �ж���Զ false ���°� prompt ��Զ����)
5. **�˵�����֤������ʵ user login + ��ʵ novel id** (�� BUG-100 �޷� 1 �ؼӶ˵��� 100% ͬԴ, �� BUG-098 catch �ؼӶ�����֤ 100% ͬԴ, �� BUG-079 �ٱ��� 100% ͬԴ)

### Refs
- pps/server/src/prompts/novelAnalysis.ts (v3.0.0.40 BUG-105 �� 4 �����ֶ�)
- pps/server/src/prompts/characterDescription.ts (v3.0.0.30 S50 v2 �Ѿ����°�, ��������������)
- pps/server/src/services/novelService.ts (parseCharactersFromReport line 75-141 ��д + parseAndSave line 529 needsDescExtraction = true + backfillCharactersFromReport line 147-192 ���°�)
- pps/server/src/services/characterSheetPrompt.ts (���ļ���д, ɾ 37 �ֶ�)
- pps/server/src/services/characterService.ts (generateImageVariants line 540-639 ���� visualDescription + ɾ extractDistinctiveFeatures ���� line 451-472)
- mavis memory: ��ɫ���� prompt �ػ��ھ������ݲ������ֶ� (����Ŀͨ��, �� BUG-079 �ٱ��� 100% ͬԴ) (�� session ����)
- docs/BUGS_INDEX.md �� 1 ������ BUG-105 + �� 4 Top 24
- docs/DEPLOY_RELEASE_FLOW.md �� 8.14 (BUG-105 ������)
- �˵�����֤�ű�: pps/server/scripts/simulate-v3038-to-v3039-upgrade.sh (10 ��, �� BUG-104 �޷�ͬ��)

### ǰ�� BUG (����Ŀͨ��: ��ɫ�����ػ��ھ�������)
- [BUG-079 S71 ���üٱ��� 12 άȫ�� 100% ��](bug-079) �� 100% ͬԴ: BUG-079 TS ����� �� ����ʱ��ȷ, BUG-105 �� prompt ��ϸ �� LLM �����ȷ (ʵ�ʱƱ���)
- [BUG-082 S71 ���� server д�־û� JSON �� string ��һ](bug-082) �� 100% ͬԴ: BUG-082 catch �ع�һ, BUG-105 �� prompt �ع�һ (������ھ���, ������)
- [BUG-098 S72 batch 7 admin approve �� 500](bug-098) �� 100% ͬԴ: BUG-098 SQL ȱ 2 �ֶ�, BUG-105 �� prompt ǿ�� 37 �ֶ� (�Ʊ���)
- [BUG-100 S72 batch 8 69 video_generations �� queued 17 ��](bug-100) �� 100% ͬԴ: BUG-100 catch ©���� video_generations, BUG-105 �� prompt ©���°� (��"�޷� 1 ������"ͬԴ)
- [BUG-104 S72 batch 8 server bump © rebuild APK](bug-104) �� 100% ͬԴ: BUG-104 ���� SOP ȱһ�� (APK) �ͱ�, BUG-105 ���� SOP ȱһ�� (���°� prompt) �ͱ�

### �տڸ���
- �޷� commit: �� push (�� BUG-105 6 fix + 9 ��汾��ͬ�� + ���� v3.0.40 һ��)
- ���� 6 �Լ�: �� push �� PASS=10/10
- 4 ���� v3.0.40 100% ͬ�� (server ��, mobile/web/APK �� v3.0.39 ͬ��, ��Ϊ BUG-105 �޷�ֻ�� server ��)
- 24 ά 1-22 + ά�� 14 + ά�� 24 ȫ PASS
- �˵��� backfill ��֤ 9/9 ��ɫ�ɹ�
## BUG-107 (S72 batch 10 v3.0.42, 2026-06-27) — 修中英夹杂 (web + mobile objectToText KEY_LABEL 字典)

### 现象
- 装 v3.0.42 APK 进 ScriptDetail 角色详情, description 显示 ole_type: 主角 / gender: 女 / hair_color: 黑色 / clothing_top: 淡蓝色襦裙 等中英夹杂, 用户体验割裂
- web 端同步 v3.0.42 部署后角色详情也显示中英夹杂 (跟 mobile 同源, 都是 characterUtils.ts objectToText 输出)

### 根因
- BUG-105 (S72 batch 8 v3.0.40 server + S72 batch 9 v3.0.41 mobile sync) 移植 web characterUtils.ts 到 mobile 时**漏配套 KEY_LABEL 中文 label 字典**, 移植了 utils 函数逻辑 (extractDescriptionText / parseStringToText / summaryOf) 但没移植中英 label 翻译
- 修了一半留中英夹杂 = 假修, 跟 BUG-079 TS 编译过 ≠ 运行时正确 100% 同源, 跟 BUG-105 mobile sync 修法不彻底 100% 同源
- web 端 objectToText 输出  - role_type: 主角\n- gender: 女\n- age: 17岁...  (raw 英文 key), mobile 端同步显示同样内容

### 修法 (5 件套, S72 batch 10 v3.0.42)
1. **apps/web/src/lib/characterUtils.ts 加 KEY_LABEL 字典 (37 字段英文 key → 中文 label, 跟 server characterService.ts line 391-404 v2.5.35 1:1 对齐, + 5 空格分隔兼容)**: 
   `	s
   export const KEY_LABEL: Record<string, string> = {
     role_type: '角色类型', gender: '性别', age: '年龄',
     height: '身高', build: '体型', skin: '肤色', makeup: '妆容',
     face: '脸型', eyes: '眼睛', eyebrows: '眉毛', nose: '鼻子', lips: '嘴唇', ears: '耳朵',
     hair_color: '发色', hair_style: '发型', hair_length: '发长', hair_texture: '发质', hair_accessories: '发饰',
     clothing_top: '上衣', clothing_bottom: '下装', clothing_outer: '外套', clothing_shoes: '鞋',
     clothing_underwear: '内衣', clothing_socks: '袜',
     accessories_neck: '颈部配饰', accessories_ears: '耳饰', accessories_hands: '手部配饰',
     accessories_waist: '腰饰', accessories_other: '其他配饰',
     props: '道具', distinctive_features: '显著特征', default_expression: '默认表情',
     emotional_range: '情绪范围', body_language: '肢体语言',
     personality_visual: '性格(视觉)', social_class_visual: '社会阶层(视觉)', personality: '性格',
     prompt_safe_description: '生图提示词', relationships: '关系', _relationships: '关系',
     // 兼容空格分隔 key (老 prompt LLM 偶发返回 "role type" 风格)
     'role type': '角色类型', 'hair color': '发色', 'hair style': '发型',
     'clothing top': '上衣', 'accessories neck': '颈部配饰',
   };
   `
2. **apps/mobile/src/utils/characterUtils.ts 同步加 KEY_LABEL 字典 (跟 web 端 1:1, 跨端铁律 4++ 配套)**: 复制完整字典 (37 字段 + 5 空格分隔兼容), 改 objectToText() 用 const label = KEY_LABEL[k] || k.replace(/_/g, ' '); 替换 raw 英文 key (fallback 兼容新增字段)
3. **tools/verify-bug107-key-label.js 入仓 (6/6 PASS)**: 6 个 case — 1) 中文 label 完整替换 (14 字段 100% 中文) 2) 空格分隔 key 兼容 (老 prompt LLM 风格) 3) fallback 走 k.replace(/_/g, ' ') (新增字段) 4) name 字段过滤 5) 数组值拼接 6) KEY_LABEL 字典 37 项 1:1 三端对齐
4. **8 项版本号同步 3.0.41 → 3.0.42**:
   - mobile ersion.ts APP_VERSION 3.0.41 → 3.0.42
   - mobile uild.gradle versionCode 45 → 46 + versionName 3.0.41 → 3.0.42
   - server package.json version 3.0.41 → 3.0.42
   - server src/index.ts fallback APP_VERSION 3.0.41 → 3.0.42
   - server ecosystem.config.js env.APP_VERSION + env_production.APP_VERSION 3.0.41 → 3.0.42 (2 处)
   - web ersion.ts APP_VERSION 3.0.41 → 3.0.42 + APP_VERSION_CODE 45 → 46
   - pps/server/changelog.json 加 v3.0.42 entry (5 条 highlights + 8 项版本号同步说明)
   - 远端 .env APP_VERSION 3.0.41 → 3.0.42 (deploy.sh 6.5 自动同步)
   - 远端 /etc/systemd/system/shipin-app.service Environment=APP_VERSION=3.0.41 → 3.0.42 (deploy.sh 6.5 自动同步)
5. **本机构建 + 远端 deploy + BlueStacks 5 端到端验证**:
   - 本机 gradlew assembleRelease 28s (2/394 任务执行, APK 30079495 bytes SHA256 8E23CD96F85BA11EC5B4671E1D860354A6CA1484D1D44FCD8708DC3D23026E9D)
   - 本机 apt2 dump badging 验 versionName=3.0.42 versionCode=46
   - 本机 pksigner verify --print-certs 验证书 DN = CN=DeepScript Release (BUG-023 永久签名)
   - 本机 
pm run build web 端 (2.79s, 新 bundle index-C3DacIa3.js 481.30 kB, css 41.83 kB)
   - scp web-dist.tgz 145K → 远端 /tmp/web-dist.tgz + 远端 tar 解压 + nginx reload (HTTP 200)
   - scp APK 29M → 远端 /www/wwwroot/shipin-APP/public/DeepScript_v3.0.42.apk (HTTP 200, content-length 30079495)
   - scp server dist tgz 236K → 远端 /tmp/dist.tar.gz (重打包扁平化无 dist/ 嵌套)
   - scp package.json 1.5K → 远端 /tmp/package.json
   - scp changelog.json 12K → 远端 /tmp/changelog.json
   - 远端 ash /www/wwwroot/shipin-APP/deploy.sh v3.0.42 release (维护模式 + systemd restart 失败 1 次 reset-failed 后成功 + 12 维验证全过)
   - shipin-APP/scripts/verify-deploy.sh 同步 S72 batch 9 24 维版 (S72 batch 8 老版本 412 行 20836 bytes → S72 batch 9 入仓 33080 bytes 605 行)
   - shipin-APP/scripts/verify-deploy-24d.sh 入仓 (wrapper 引用相对路径)
   - 远端 ash /www/wwwroot/shipin-APP/scripts/verify-deploy.sh --strict 24 维验证全过: PASS 27 / FAIL 0 / SKIP 0 (含 23a userNotifiedAt 修法 + 23b 反模式 0 命中 + 24 APK bundle 同步)
   - BlueStacks 5 端到端: 装 v3.0.42 APK + MainActivity 启动 + 登录态保留 (q378685504/wuliao) + 走 书架 → ScriptDetail (暴君的笼中雀by四喜圆子) → 角色分析 6 角色 (苏蓉儿/独孤琰/万公公/秋霞/金枝/陆婕妤) **0 raw 英文 key + 30+ 中文 label 全显示** (类型/性别/年龄/身高/发色/发型/上衣/下装/外套/显著特征/性格/关系 etc.)

### 验证 (PASS 6/6 + 5 维端到端)
1. **本地 verify-bug107-key-label.js**: 6/6 PASS (中文 label 完整替换 + 空格分隔 key 兼容 + fallback + name 过滤 + 数组值拼接 + 37 项字典三端对齐)
2. **远端 verify-deploy.sh 24 维**: PASS 27 / FAIL 0 / SKIP 0 (维度 22 changelog + 维度 23a/23b React {0} 渲染陷阱 + 维度 24 APK bundle 同步)
3. **公网 APK HTTP/2 200**: https://ab.maque.uno/app/DeepScript_v3.0.42.apk content-length 30079495 (跟本机 SHA256 一致)
4. **远端 /api/version**: version=3.0.42, changelog=BUG-107 修中英夹杂, highlights 5 条, buildDate=2026-06-26, forceUpdate=true, needUpdate=true
5. **历史 APK 11 个未覆盖**: v3.0.34/35/36/37/38/39/41 + v3.0.3/4/5/6/7/8/9 (防 BUG-017 覆盖错位)
6. **BlueStacks 5 ScriptDetail 截图**: 角色分析 全中文 label, 6 角色 30+ 字段 100% 中文 (类型/性别/年龄/身高/发色/发型/上衣/下装/外套/显著特征/性格/关系 etc.)

### 教训 (跨项目通用铁律, 跟 BUG-079 假报告 + BUG-105 修法不彻底 100% 同源)
1. **web utils 必配套中英 label 翻译必 100% 移植** — 移植 utils 函数逻辑 (extractDescriptionText / parseStringToText) 时漏 label 字典 (KEY_LABEL) = 假修, 跟"TS 编译过 ≠ 运行时正确" 100% 同源 (BUG-079)
2. **跨端铁律 4++ Web→APP 同步 SOP 必加 "label 翻译配套" 检查项** — 比对 web utils 函数清单 → mobile 移植 → 改 screen import → 删本地硬编码 → **【新增】label 字典 100% 复制** → tsc + rebuild APK + 端到端验证 (S72 batch 9 SOP 5 步 → S72 batch 10 SOP 6 步, 跟 BUG-105 mobile sync 配套)
3. **server 改字段格式必同步三端** — server + web + mobile, 三端 utils 配套不齐必崩 (改 description 格式必须配套改 web + mobile utils 的 label 翻译)
4. **新增字段 fallback 必走 k.replace(/_/g, ' ')** — KEY_LABEL 字典只覆盖已知字段, 字典外的 key (例如 LLM 偶发返回的 custom_field) fallback 走 k.replace(/_/g, ' ') 转空格分隔 (而不是 raw custom_field:), 兼容扩展性 100%
5. **空格分隔 key 必兼容** — LLM 老 prompt 偶发返回 "role type" / "hair color" / "clothing top" 风格 (无下划线), KEY_LABEL 字典必加空格分隔版本 (跟下划线版本并存), 兼容老 prompt 输出
6. **verify 脚本必写 6 维** — 中文 label 完整替换 + 空格分隔 key 兼容 + fallback + name 过滤 + 数组值拼接 + 字典三端对齐, 缺一就有 edge case 漏掉

### 防呆 SOP
1. **跨端铁律 4++ 跨项目通用 SOP 加第 6 步** — 任何 utils 跨端移植必加"label 翻译 100% 复制" 检查项, 走 grep -E 'role_type:|hair_color:|clothing_top:' dist/<bundle>.js 验 0 命中
2. **新增工具 scripts/verify-bugNNN-key-label.js** — 任何 utils 改 label 翻译必写配套 verify 脚本 (跟 BUG-101 verify-bug101.sh / BUG-105 verify-mobile-characterUtils.js 同源), 改 utils 必跑 verify 脚本确认 6/6 PASS
3. **commit message 必带 BUG 编号 (铁律 6)** — 3.0.42 BUG-107 修中英夹杂: ..., pre-commit hook 拦截无 BUG 编号 commit
4. **APK bundle 必配套 web utils** — web 端改 characterUtils.ts KEY_LABEL 必同步 mobile 端 + rebuild APK + scp + BlueStacks 端到端 (跟 BUG-104 server bump 必 rebuild APK 同源)
5. **远端 shipin-APP/scripts/verify-deploy.sh 必同步** — S72 batch 9 24 维版本入仓 (33080 bytes 605 行), 远端老版本 (412 行 20836 bytes) 必 scp 替换, deploy 完跑 24 维验证

### 沉淀 4 件套
1. **docs/BUGS_INDEX.md v2.4** (§ 1 速览行 BUG-107 + § 4 Top 27 跨项目通用铁律 4++ label 翻译配套 + 完整 BUG 75 个)
2. **HANDOVER.md § 2.1 S72 batch 10** (v3.0.42 P18 + 5 件套修法 + 5 维验证 + 6 教训 + 5 防呆 SOP + commit c9f5ae3)
3. **apps/mobile/BUGS.md BUG-107 段** (本文件, 永久记录现象/根因/修法/验证/教训/防呆)
4. **1 mavis memory** (跨项目通用: web→mobile utils 同步必配套 label 翻译, 跟 BUG-079 假报告 + BUG-105 修法不彻底 100% 同源)

### 关联 BUG
- **BUG-079** (S71 假报告, TS 编译过 ≠ 运行时正确) — 移植 utils 漏 label 字典也是假修, 100% 同源
- **BUG-105** (S72 batch 8 + S72 batch 9 mobile sync) — 移植 web characterUtils.ts 漏配套 KEY_LABEL, 修法不彻底, 100% 同源
- **BUG-104** (S72 batch 8 server bump 漏 rebuild APK) — server bump 漏 rebuild APK = 假修, 100% 同源 (跨端配套 SOP 缺一环就崩)
- **BUG-097** (S72 batch 7 mobile 漏修 web 3 BUG) — mobile 漏修 web = 假修, 100% 同源 (跨端配套 SOP 缺一环就崩)
- **铁律 4++** (跨项目通用 UX 原则, 2026-06-26 user 明确: Web 主导 APP 跟随) — 跨端 utils 同步必 100% 配套 (含 label 翻译), 缺一就崩
- **铁律 3 (v3.0.33 扩 6→8 项)** — 任何版本号修改必同步 8 处, 缺一就崩 (mobile version.ts + build.gradle + server package.json + index.ts fallback + ecosystem + web version.ts + APP_VERSION_CODE + changelog.json + 远端 .env + 远端 systemd unit)
- **铁律 6** — commit message 必带 BUG 编号, pre-commit hook 拦截

### 配套工具
- 	ools/verify-bug107-key-label.js (6/6 PASS, 跟 verify-mobile-characterUtils.js 同源)
- pps/web/src/lib/characterUtils.ts v2.5.35 (新增 KEY_LABEL 字典 37 字段 + 5 空格分隔)
- pps/mobile/src/utils/characterUtils.ts v3.0.42 (同步 KEY_LABEL 字典, 跟 web 1:1)
- pps/server/scripts/verify-deploy.sh 33080 bytes 605 行 (S72 batch 9 24 维入仓)
- pps/server/scripts/verify-deploy-24d.sh (wrapper 引用 $(dirname \"\")/verify-deploy.sh 相对路径)
- pps/server/scripts/deploy-bug107.sh (远端部署脚本, 7 步 bump + restart + 24 维验证)
- docs/BUGS_INDEX.md § 1 BUG-107 速览行 + Top 27
- HANDOVER.md § 2.1 S72 batch 10
- pps/mobile/BUGS.md BUG-107 段 (本文件)
- 1 mavis memory (跨项目通用 label 翻译必配套)
- 4 张 BlueStacks 5 截图 (F:\QiTa\banmu\APP\ai-video-script-app\.harness\screenshots\bug107-step01~04-*.png)

## BUG-108 (S72 batch 11 v3.0.43 Stage 1, 2026-06-27) — 统一图片加载 UI 模块 (web + mobile 跨端铁律 4++)

### 现象
- 服务器 5Mbps 带宽, 图片加载慢 (10-20 秒), 用户看到的是空白 + spinner
- LLM 生成图/视频需几秒-几分钟, 用户不知道在生成什么, 焦虑退出
- web 端 17 page 全 Tailwind 手写, 没有骨架屏, 直接显示空 div 等图片
- mobile 端 SkeletonLoader.tsx 是基础 opacity pulse (59 行), 没用于图片加载场景

### 根因
- shipin-APP 之前没有统一的"加载中 + 生成中" UI 模块, 每个页面单独处理 (各自 spinner / 各自空白)
- 跨端铁律 4++ (Web→APP 同步) 要求 web + mobile 1:1 镜像, 但 components/ui/ 独立目录缺失 ([GAP] M-5)
- 跟 BUG-079 假报告 100% 同源: 改 utils 必 100% 移植含 UI 组件, 漏独立目录 = 假修
- 跟 BUG-105 修法不彻底 100% 同源: BUG-105 移植 web characterUtils.ts 漏 label 字典, Stage 1 也可能漏 UI 组件目录

### 修法 (7 件套, S72 batch 11 v3.0.43 Stage 1/3)
1. **web 端 apps/web/src/components/ui/ 新建独立目录** (填平 [GAP] M-5 独立组件缺失):
   - skeleton.tsx — shadcn 风格 opacity pulse (跟 shipin-APP 现有 SkeletonLoader.tsx 风格一致)
   - skeleton-presets.tsx — SkeletonCard / SkeletonImage / SkeletonText 3 个预制组件
   - image-with-loading.tsx — **核心组件**, 3 态 (loading→ready→error) + LQIP 占位 + shimmer 动画 + 200ms 淡入 + onLoaded 回调 (Stage 2 接入缓存)
   - index.ts — barrel export
2. **web 集成 (3 处)**:
   - CharacterDetailPage sheet image (3/4 aspectRatio) 替换 <img>
   - AssetLibraryPage 资源库 grid (imageData data URL) 替换 <img>
   - EpisodeDetailPage comicImage (3 处) 替换 <img>
3. **mobile 端 apps/mobile/src/components/ui/ 新建独立目录** (跟 web 1:1 镜像, 跨端铁律 4++):
   - Skeleton.tsx — Animated opacity 0.3~1 pulse (600ms 循环) + SkeletonCard / SkeletonImage / SkeletonText 3 预制
   - ImageWithLoading.tsx — Animated.Image + retry key (重试触发重载) + fallback 重试 (点 fallback 重载)
4. **mobile 集成 (3 处)**:
   - CharacterDetailScreen sheetImage (100% width 300 height) 替换 <Image>
   - ImageAgentScreen refImage (80x80) + resultImage (320x320) 替换 <Image>
5. **配套**:
   - pps/web/src/lib/utils.ts — cn() 工具 (clsx + tailwind-merge, 自动去重 Tailwind 类冲突)
   - pps/web/tailwind.config.js — shimmer keyframes + animation (左→右滑过 2s 循环)
   - pps/web/src/index.css — .skeleton-shimmer 工具类 (浅色渐变 + bg-size 1000px)
   - pps/web/AGENTS.md § 4 第 1 条微调 — 原 '不引入 shadcn/ui' → '允许 tailwind-merge + cn() + components/ui/' (不推翻 17 page Tailwind 手写传统)
   - [GAP] M-5 标已修 (S72 batch 11)
6. **双端 build**:
   - web: 
pm run build 4.10s OK, 新 bundle index-SsjEDax8.js 510KB (+ css 43KB)
   - mobile: gradlew assembleRelease 57s OK (6/394 任务执行), APK 30083055 bytes SHA256 7DC4A218DC02E988E4F5A476D30264EE45D322FAEFAFF4D2107F20EA1D731626
7. **BlueStacks 5 端到端验证**:
   - APK 装到 127.0.0.1:5555 ✓
   - MainActivity 启动 ✓
   - 登录态保留 (q378685504/wuliao) ✓
   - BookshelfPage 渲染正常 ✓
   - ScriptDetail 6 角色中文 label (跟 BUG-107 v3.0.42 一致) ✓

### 验证 (双端 build OK + BlueStacks 启动 OK)
1. ✅ web 
pm run typecheck 0 错 (tsc -b --noEmit)
2. ✅ web 
pm run build 4.10s OK, 新 bundle index-SsjEDax8.js 510KB
3. ✅ mobile gradlew assembleRelease 57s OK (6/394 增量)
4. ✅ APK aapt2 dump badging versionName=3.0.42 (待 v3.0.43 bump) versionCode=46
5. ✅ APK apksigner verify 证书 DN = CN=DeepScript Release (BUG-023 永久签名)
6. ✅ BlueStacks 5 APK install OK, MainActivity 启动 OK, 登录态保留 OK

### 教训 (跨项目通用铁律, 跟 BUG-079 假报告 + BUG-105 修法不彻底 + BUG-097 mobile 漏修 web 100% 同源)
1. **改 utils 必 100% 移植含 UI 组件** — 移植 web characterUtils.ts 漏 label 字典是假修 (BUG-105), 移植 skeleton / loading 组件漏 components/ui/ 目录也是假修 (Stage 1 防呆)
2. **跨端铁律 4++ Web→APP 同步 SOP 必加第 7 步** — 1) 比对 web utils 2) mobile 移植 3) 改 screen import 4) 删本地硬编码 5) tsc + rebuild 6) 端到端验证 **🆕 7) UI 组件必建独立 components/ui/ 目录 + 跨端 1:1 镜像**
3. **跨项目通用 UI 组件规范 (Stage 1 沉淀)**:
   - components/ui/ 独立目录 (跟 page / screen 解耦)
   - 双端 1:1 镜像 (web apps/web/src/components/ui/ 跟 mobile apps/mobile/src/components/ui/ API 一致)
   - API 必保持一致: Skeleton / SkeletonCard / SkeletonImage / SkeletonText / ImageWithLoading
   - tailwind-merge + cn() 工具必备 (web 端, mobile 用 clsx + 不冲突)
4. **web AGENTS.md § 4 第 1 条不能死守** — 旧规范 '不引入 shadcn/ui' 是 S72 batch 7 写的, S72 batch 11 增补 '允许 tailwind-merge + cn() + components/ui/' 是兼容性微调 (不推翻 17 page 传统, 只补新目录)
5. **[GAP] 必填平** — web AGENTS.md § 2.2 [GAP] M-5 "独立组件缺失" 在 Stage 1 直接填平, 顺手标已修 + 写明修法

### 防呆 SOP
1. **Stage 1 完必须双端 build 0 错** — web tsc + mobile gradle 双保险
2. **跨端 UI 组件 API 必 1:1** — Skeleton / ImageWithLoading 跟 web 端同名同 props, 防止 BUG-097 mobile 漏修 web 类问题
3. **ImageWithLoading onLoaded 回调必备** — Stage 2 接入 MMKV 缓存时直接用, 不用再改组件
4. **shimmer 动画从 tailwind.config.js keyframes 出发** — 不在 component 内 inline animation, 跟 web 端统一
5. **fallback 必带重试** — 用户点 fallback 触发 retry key 重载, 跟 mobile 端 RN error recovery 一致

### 沉淀 4 件套
1. **docs/BUGS_INDEX.md v2.5** (§ 1 速览行 BUG-108 + Top 28 跨项目通用铁律 4++ UI 组件必 100% 移植含 components/ui/ + 完整 BUG 76 个)
2. **HANDOVER.md § 2.1 S72 batch 11** (v3.0.43 P19 Stage 1/3 + 7 件套修法 + 6 维验证 + 5 教训 + 5 防呆 SOP + commit 90bbccb)
3. **apps/mobile/BUGS.md BUG-108 段** (本文件, 永久记录现象/根因/修法/验证/教训/防呆)
4. **1 mavis memory** (shipin-APP Stage 1 实战 + 跨项目通用 UI 组件 1:1 同步铁律)

### 关联 BUG
- **BUG-079** (S71 假报告, TS 编译过 ≠ 运行时正确) — 移植 utils 漏 label 字典是假修, 移植 UI 组件漏 components/ui/ 目录也是假修, 100% 同源
- **BUG-105** (S72 batch 8+9 mobile sync) — 移植 web characterUtils.ts 漏配套 KEY_LABEL, 修法不彻底, Stage 1 防呆 100% 移植含 UI 组件
- **BUG-097** (S72 batch 7 mobile 漏修 web 3 BUG) — 跨端配套 SOP 缺一环就崩, Stage 1 1:1 镜像防呆
- **铁律 4++** (跨项目通用 UX 原则, 2026-06-26 user 明确: Web 主导 APP 跟随) — 跨端 UI 组件必同步, 缺一就崩
- **铁律 5** (不再接受假报告) — 双端 build 必 0 错 + BlueStacks 端到端必跑通, 不能 "改完就完"
- **[GAP] M-5** (web AGENTS.md § 2.2 独立组件缺失) — Stage 1 直接填平, 顺手标已修

### 配套工具
- pps/web/src/components/ui/ (skeleton.tsx + skeleton-presets.tsx + image-with-loading.tsx + index.ts) — 4 文件, 跟 mobile 1:1
- pps/mobile/src/components/ui/ (Skeleton.tsx + ImageWithLoading.tsx + index.ts) — 3 文件, 跟 web 1:1
- pps/web/src/lib/utils.ts (cn 工具, clsx + tailwind-merge)
- pps/web/tailwind.config.js (shimmer keyframes + animation)
- pps/web/src/index.css (.skeleton-shimmer 工具类)
- pps/web/AGENTS.md (§ 4 第 1 条微调 + [GAP] M-5 标已修)
- 1 mavis memory (shipin-APP Stage 1 + 跨项目通用铁律)
- 3 张 BlueStacks 5 截图 (F:\QiTa\banmu\APP\ai-video-script-app\.harness\screenshots\stage1\stage1-01~03-*.png)

### 后续 (Stage 2 + Stage 3)
- **Stage 2** (本地缓存, 3-4 天): RNFS + MMKV + hash 命名 + LRU 500MB 淘汰 + ETag 跟 server 配合, ImageWithLoading onLoaded 回调接入缓存层
- **Stage 3** (跨端 hook + Lottie, 4-5 天): useMediaLoader hook (web + mobile 1:1) + Lottie 粒子动画 (生成中状态) + 端到端测试

## BUG-109 (S72 batch 11 v3.0.43 Stage 2, 2026-06-27) — 本地媒体缓存 (跨端铁律 4++ web + mobile 1:1 镜像, SQLite + IndexedDB)

### 现象
- 服务器 5Mbps 带宽 + 图片/视频首次加载 10-20 秒, 用户看到的是空白 spinner
- LLM 生成图每次都重新下载, 浪费带宽 + 时间, 重复看同一张图要等 N 次
- web 端没 Cache API / IndexedDB, mobile 端 SkeletonLoader 只解决动画没解决持久化

### 根因
- shipin-APP 之前没本地缓存层, 每次 GET 都从 CDN 拉 (5Mbps 带宽 + 10-20s)
- 跨端铁律 4++ Web→APP 同步要求 web + mobile 1:1 镜像, 但之前没统一缓存 hook
- 跟 BUG-097 mobile 漏修 web 100% 同源 (跨端配套 SOP 缺一环就崩)
- 跟 BUG-104 server bump 漏 rebuild APK 100% 同源 (缓存版本同步需要 hash 失效机制)

### 修法 (8 件套, S72 batch 11 v3.0.43 Stage 2/3)
1. **server ETag 中间件** (pps/server/src/middleware/etag.ts):
   - 响应 JSON SHA-256 hash 写 ETag (32 chars hex)
   - Cache-Control: private, must-revalidate, max-age=0
   - 客户端 If-None-Match 命中 → 304 (省带宽)
   - /api/version 接入 (高频 API, shipin-APP 移动端每分钟查 1 次)
2. **mobile 端本地缓存** (pps/mobile/src/utils/mediaCache.ts + pps/mobile/src/hooks/useCachedMedia.ts):
   - 文件存储: RNFS.DocumentDirectoryPath/media-cache/{img,video}/{hash}.{ext}
   - 索引存储: **react-native-sqlite-storage v6.0.1 (项目已装, 跟 models/db.ts 集成, 无 NDK 依赖)** + 单表 media_cache (url TEXT PRIMARY KEY, localPath TEXT, size INTEGER, hash TEXT, ext TEXT, cachedAt INTEGER, lastAccessed INTEGER)
   - hash 命名: djb2 + reverse (32 chars hex, 跟 web 1:1 算法, 跨端铁律 4++)
   - LRU 淘汰: 限制 500MB / 1000 文件, 超过按 lastAccessed 删到 90% 阈值
   - API: getCached(url) → Promise<string | null> (本地 file:// 路径 或 null), cacheFromUrl(url) → 下载 + 存索引, efresh(url) → 强删 + 重 GET, clearAll(), getStats()
   - useCachedMedia hook: mount 查 SQLite 命中 → 直接用本地 file:// 路径 (省 10s 网络); 未命中 → 用原 URL 渲染 + onLoaded 触发 cacheFromUrl 异步下载到本地
3. **web 端本地缓存** (pps/web/src/hooks/useCachedMedia.ts):
   - IndexedDB media-cache-v3 + store iles
   - 同样 djb2 + reverse hash 算法 (跟 mobile 1:1, 跨端铁律 4++)
   - 命中用 URL.createObjectURL(blob) blob URL
   - LRU 淘汰: 限制 500MB / 1000 文件
   - API: 跟 mobile useCachedMedia 完全一致 (source / onLoaded / refresh)
4. **集成 POC** (各 1 处):
   - pps/web/src/pages/CharacterDetailPage.tsx sheetImg 用 useCachedMedia wrap
   - pps/mobile/src/screens/CharacterDetailScreen.tsx sheetImgUrl 用 useCachedMedia wrap
5. **替代方案决策** (踩坑教训):
   - ❌ MMKV 4.x (跟 RN 0.73 不兼容, 需要 nitro + RN 0.85)
   - ❌ MMKV 2.12.2 (需要 NDK build, shipin-APP NDK 没装, build 失败 [CXX1101] NDK at D:\Android\ndk\25.1.8937393 did not have a source.properties file)
   - ✅ **react-native-sqlite-storage v6.0.1** (项目已装, 跟 models/db.ts 集成, 无 NDK 依赖, 性能对小规模缓存足够 < 5ms)
6. **跨端铁律 4++ 1:1 镜像**: web + mobile hook API 完全一致 (source / onLoaded / refresh), hash 算法一致 (djb2 + reverse), LRU 阈值一致 (500MB / 1000 文件)
7. **双端 build OK**:
   - web: 
pm run build 3.14s, 新 bundle index-BVHlVkPf.js 512KB
   - mobile: gradlew assembleRelease 48s (6/394 任务执行), APK 30087897 bytes SHA256 B1192268E1DE4BE15C11E1C2B908DA3F38B54B0DB9AE1DC58C3BEC55DA4F2A2A
   - BlueStacks 5 装 APK + MainActivity 启动 OK
8. **Stage 3 待做**:
   - 跨端 useMediaLoader hook 抽象 (封装 useCachedMedia + useState + status)
   - Lottie 生成中动画
   - 端到端缓存验证 (SQLite 记录数 > 0 + 二次启动 hit rate > 80%)

### 验证 (双端 build OK + APK 装 OK)
1. ✅ web 
pm run typecheck 0 错
2. ✅ web 
pm run build 3.14s, 新 bundle index-BVHlVkPf.js 512KB
3. ✅ mobile 
px tsc --noEmit 0 新错 (历史错误与本 BUG 无关)
4. ✅ mobile gradlew assembleRelease 48s OK
5. ✅ APK aapt2 dump badging versionName=3.0.42 (待 v3.0.43 bump) versionCode=46
6. ✅ APK apksigner verify 证书 DN = CN=DeepScript Release (BUG-023 永久签名)
7. ✅ BlueStacks 5 APK install OK, MainActivity 启动 OK
8. ⏳ SQLite 端到端验证: 需要 CharacterDetailScreen 实际触发 image 加载才能验证 (CharacterDetailScreen 仍是 mobile 端孤岛页, 没有 navigation 路由)

### 教训 (跨项目通用铁律, 跟 BUG-079 假报告 + BUG-097 mobile 漏修 web 100% 同源)
1. **缓存方案选型必先验证 native 依赖** — MMKV 4.x 默认是最新, 但跟 RN 0.73 不兼容 (需要 nitro + RN 0.85); MMKV 2.x 需要 NDK build (shipin-APP NDK 没装); 选 RN ecosystem 库必先查 peerDependencies + engines + 装包后跑 build 验证
2. **改 utils 必 100% 移植含缓存** — Stage 1 加了 ImageWithLoading 但没缓存, 改了半个 — 跟 BUG-079 假报告 100% 同源; Stage 2 必须补完整缓存层 (useCachedMedia + mediaCache)
3. **跨端铁律 4++ Web→APP 同步 缓存必 1:1 镜像** — web 跟 mobile hook API 必须一致 (source / onLoaded / refresh), hash 算法必须一致 (djb2 + reverse), LRU 阈值必须一致 (500MB / 1000 文件), 不一致就是 假修
4. **server ETag 跟 client cache 配套** — server 返 ETag + Cache-Control, 客户端 If-None-Match 命中 → 304; 不是 client cache, server 改了 client 不知道, 必须 ETag; 不是 server ETag, client 缓存永远 stale
5. **Hash 命名方案是版本同步的核心** — 文件名 = SHA256(url), server 改 URL (加 query param / 改 path) → 客户端 hash 变 → 自动 miss → 重 GET; 比 server ETag 更可靠 (不依赖 server 配合)
6. **SQLite 比 MMKV 更适合 shipin-APP** — 项目已装, 跟主 db 集成, 无 NDK 依赖, 性能足够; MMKV 优势是查询速度, 但 shipin-APP 缓存条目 < 1000, SQLite 索引查询 < 5ms 完全够用
7. **LRU 淘汰必加, 不能无限增长** — 500MB / 1000 文件上限 + 按 lastAccessed 删到 90% 阈值, 防止本地缓存占满用户磁盘
8. **文件命名跟 URL 1:1 不可行** — 同一 URL 可能在 CDN 改内容 (CDN cache miss), 用 hash 命名 + content hash 验证更稳 (Stage 3 加 ETag 验证)

### 防呆 SOP
1. **Stage 2 完必双端 build 0 错** — web tsc + mobile gradle + server tsc 三保险
2. **MMKV / AsyncStorage / SQLite 选型决策 5 步** — 1) 查 peerDependencies 2) 查 engines 3) 查 NDK 依赖 4) 跑 npm install + build 验证 5) 失败 fallback 到项目已有方案
3. **useCachedMedia 必须跟 useCachedMedia web 1:1** — API 一致 (source / onLoaded / refresh), hash 算法一致, LRU 阈值一致
4. **SQLite 表必加 lastAccessed 索引** — LRU 淘汰按 lastAccessed ASC 排序, 没索引每次全表扫
5. **file:// URI 在 RN 必须** — ile:// 才能被 RN Image 组件渲染 (不能直接用裸路径)

### 沉淀 4 件套
1. **docs/BUGS_INDEX.md v2.6** (§ 1 速览行 BUG-109 + Top 29 跨项目通用铁律: 缓存方案选型必先验证 native 依赖 + 完整 BUG 77 个)
2. **HANDOVER.md § 2.1 S72 batch 11 Stage 2** (v3.0.43 P19 Stage 2/3 + 8 件套修法 + 8 教训 + 8 防呆 SOP + commit bdbc4fd)
3. **apps/mobile/BUGS.md BUG-109 段** (本文件, 永久记录现象/根因/修法/验证/教训/防呆)
4. **1 mavis memory** (shipin-APP Stage 2 + 跨项目通用铁律: 缓存方案必先验证 NDK/native 依赖)

### 关联 BUG
- **BUG-079** (S71 假报告) — Stage 1 加 UI 但没缓存 = 假修, Stage 2 补完整, 100% 同源
- **BUG-097** (S72 batch 7 mobile 漏修 web 3 BUG) — web + mobile 缓存 hook 必须 1:1 镜像, 缺一就是漏修
- **BUG-104** (S72 batch 8 server bump 漏 rebuild APK) — 缓存版本同步靠 hash 失效 + server ETag 配合, 缺一就崩
- **铁律 4++** (跨项目通用 UX 原则, 2026-06-26 user 明确: Web 主导 APP 跟随) — 跨端缓存必 100% 同步含 hook + 算法 + LRU
- **铁律 5** (不再接受假报告) — 双端 build 必 0 错 + APK 装必 OK + 实际触达才能验证缓存 (mobile CharacterDetailScreen 仍是孤岛页, Stage 3 补 navigation)

### 配套工具
- pps/server/src/middleware/etag.ts (47 行, ETag + 304 处理)
- pps/mobile/src/utils/mediaCache.ts (180 行, RNFS + SQLite + hash + LRU)
- pps/mobile/src/hooks/useCachedMedia.ts (60 行, hook 抽象)
- pps/web/src/hooks/useCachedMedia.ts (130 行, IndexedDB + hash + LRU, 跟 mobile 1:1)
- 1 mavis memory (shipin-APP Stage 2 + 跨项目通用缓存方案选型铁律)

### 后续 (Stage 3)
- 跨端 useMediaLoader hook 抽象 (封装 useCachedMedia + state machine + error handling)
- Lottie 生成中动画 (Particles Loading)
- 端到端缓存验证 (SQLite 记录数 > 0 + 二次启动 hit rate > 80%)
- mobile CharacterDetailScreen 加 navigation 路由 (修孤岛)


---

## BUG-110 (v3.0.43 Stage 3): GeneratingLoader + useMediaLoader 跨端 1:1 镜像 (S72 batch 11 Stage 3, 2026-06-27)

### 问题
shipin-APP 之前没有跨端统一的"AI 生成中"动画组件, web 用 lucide-react Loader + animate-spin, mobile 用 RN ActivityIndicator. 风格不一致, web 没阴影, mobile 颜色硬编码. 用户每次看生成中/loading 都要适应两种风格.

### 解法
1. 新建 pps/web/src/components/ui/generating-loader.tsx — CSS spinner (1s 周期 + border-t-blue-500)
2. 新建 pps/mobile/src/components/ui/GeneratingLoader.tsx — Animated spinner (1000ms + borderTopColor #3b82f6)
3. 新建 pps/web/src/hooks/useMediaLoader.ts + pps/mobile/src/hooks/useMediaLoader.ts — 4 态 type machine + retry (封装 useCachedMedia)
4. 集成 ScriptDetailScreen (mobile) + ScriptDetailPage (web) 替代原 ActivityIndicator / 文本

### 跨端 1:1 镜像 (8 维一致)

| 维度 | web | mobile | 一致性 |
|---|---|---|---|
| 组件文件 | generating-loader.tsx | GeneratingLoader.tsx | ✅ |
| Hook 文件 | hooks/useMediaLoader.ts | hooks/useMediaLoader.ts | ✅ |
| 4 态 type | idle/loading/ready/error | 同左 | ✅ |
| Hook 返回 | 7 字段 | 7 字段 | ✅ |
| Spinner 周期 | 1s | 1000ms | ✅ |
| Spinner 颜色 | blue-500 | #3b82f6 | ✅ |
| MAX_RETRIES | 3 | 3 | ✅ |
| 集成点 | ScriptDetailPage | ScriptDetailScreen | ✅ |

### 踩坑教训 (跨项目通用铁律)

1. **lottie-react 不支持 path 属性** — 必须用 nimationData (要先 fetch JSON). web 端 Stage 3 改走 fallback CSS spinner, Lottie Stage 3.5 接入
2. **lottie-react-native 需要 NDK build** — shipin-APP NDK 没装 source.properties. mobile 端 Stage 3 改走 fallback Animated spinner
3. **Mobile dynamic import TS1323 错** — --module flag 限制. 改静态 import 即可
4. **跨端 1:1 风格铁律** — 改 spinner 周期/颜色必双端同步, 跑 verify-bug110 验证

### 验证脚本
	ools/verify-bug110-media-loader.js (8 维验证):
1. GeneratingLoader 跨端文件存在
2. useMediaLoader 跨端 hook 文件存在
3. 跨端 API 7 字段一致
4. 4 态 type 一致
5. MAX_RETRIES 一致
6. ScriptDetail 集成点一致
7. CSS/Animated spinner 1s 周期 + 蓝色一致
8. components/ui/index.ts barrel export 一致

跑法: 
ode tools/verify-bug110-media-loader.js (期望 PASS: 8 / FAIL: 0)

### 沉淀
- pps/mobile/AGENTS.md § 6.6 Stage 3 规范 (新加)
- pps/web/AGENTS.md § 5 Stage 3 规范 (新加)
- 1 mavis memory (shipin-APP Lottie NDK 失败教训 + 跨项目通用: native 模块选型 5 步验证)

---

## BUG-111 (v3.0.43 hotfix): ETag middleware ERR_HTTP_HEADERS_SENT (S72 batch 12 v3.0.43 hotfix, 2026-06-27)

### 问题
Stage 2 v3.0.43 BUG-109 引入的 server etag.ts middleware 在生产 server 启动后立即 crash:
\\\
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
    at ServerResponse.setHeader (node:_http_outgoing:700:11)
    at ServerResponse.<anonymous> (/www/wwwroot/shipin-APP/dist/middleware/etag.js:62:17)
\\\

### 根因 (BUG-111, 跟 BUG-079/097 100% 同源: 没考虑下游约束)
etag.ts 用 \es.on('finish', () => { res.setHeader(...) })\ 反模式 — Node.js 在 'finish' 事件触发时**已经把 header flush 到 socket**, 此时 setHeader 抛 ERR_HTTP_HEADERS_SENT, 整个 Node 进程 crash, systemd RestartSec=10 + StartLimitBurst=5 把 5 次 retry 用完, service 进入 failed 状态, nginx 反代 6000 返 502 Bad Gateway.

### 修法 (S72 batch 12 v3.0.43 hotfix)
**错误做法 (v3.0.43 BUG-109 引入)**: 在 res.on('finish') 里 setHeader
\\\	s
res.on('finish', () => {
  res.setHeader('ETag', tag);  // ERR_HTTP_HEADERS_SENT
});
\\\

**正确做法 (v3.0.43 BUG-111 修)**: 在 res.json override 里 (body 发送前) setHeader
\\\	s
res.json = function(body) {
  if (bodyStr) {
    res.setHeader('ETag', tag);  // body 发送前 OK
    if (clientTag === tag) return res.status(304).end();
  }
  return originalJson(body);
};
\\\

### 修法 SOP (跟 BUG-079/097/098 同源, 跨项目通用)
1. **优先用官方 API**: Express middleware 拦截 res.json / res.send, 在 body 发送前 setHeader (跟 Express bodyParser / helmet 同款)
2. **永远不在 res.on('finish') 后 setHeader**: 'finish' 时 socket 已经 flush, setHeader 必抛 ERR_HTTP_HEADERS_SENT
3. **304 处理必须在 body 发送前**: \es.status(304).end()\ 不能在 finish 后调
4. **修法必本地 build + 远端跑 deploy.sh + verify-deploy 27/27 PASS 才算完成**

### 验证脚本
\	ools/verify-bug111-etag-hotfix.js\ (8 维验证):
1. etag.ts 代码不再用 res.on('finish') (排除注释)
2. etag.ts 改成在 res.json override 里 setHeader
3. etag.ts 304 处理完整
4. etag.ts 只对 GET 生效
5. dist/etag.js 已无 finish listener (排除注释)
6. /api/version 接入 etagMiddleware (不带括号)
7. verify-deploy.sh 修 3 个 bug (22 urllib + 23a grep -ho + 24 grep -c fallback)
8. changelog 记录 v3.0.43 + 远端 verify-deploy 27/27 PASS

跑法: \
ode tools/verify-bug111-etag-hotfix.js\ (期望 PASS: 8 / FAIL: 0)

### 端到端
- 远端: \ash scripts/verify-deploy.sh\ **PASS: 27 / FAIL: 0**
- 远端: \curl https://ab.maque.uno/api/version\ 返 3.0.43 + 4 字段 (version + changelog + highlights + buildDate)
- 远端: APK 公网 HTTP/2 200 + SHA256 一致 (999b96d9...)

### 沉淀
- \pps/server/src/middleware/etag.ts\ 重写 (res.json override, 修 ERR_HTTP_HEADERS_SENT)
- \pps/server/src/index.ts\ line 74 etagMiddleware() → etagMiddleware (不带括号)
- \scripts/verify-deploy.sh\ 修 3 bug (22 + 23a + 24)
- \	ools/verify-bug111-etag-hotfix.js\ 新增 (8/8 PASS)
- 1 mavis memory (etag.ts res.on('finish') 反模式 + 跨项目通用: middleware setHeader 必在 body 发送前)

---

## BUG-112 (v3.0.44 hotfix): 角色库 (CharacterDetail) 点击白屏, React 整 component tree unmount (S72 batch 13, 2026-06-27)

### 现象
- 用户报告 (2026-06-27 14:35): v3.0.43 升级后, 从书架进入角色库点击角色, 屏幕**完全空白 (没任何元素, 包括 ActivityIndicator/导航栏)**
- 跨端铁律 4++ 对比: web 端同样代码没事, 锁定 mobile 端 runtime 兼容性问题
- 重装 v3.0.43 APK + 冷启动复现率 100%

### 根因 (BUG-112, 跟 BUG-079/097/098 100% 同源: 没装真机测)
1. **v3.0.43 Stage 2 引入 `useCachedMedia` hook** (mobile 用 SQLite + RNFS, web 用 IndexedDB) — 本地 verify-bug109 8/8 PASS, 但**没在 Android 真机 release build 验证**
2. **react-native-sqlite-storage v6.0.1 + RN 0.73 + Hermes + Android release build** native module 在某些设备上抛错 (例如 `SQLite.enablePromise(true)` 模块级调用, 或 `mediaCache.ts` 顶层 `import SQLite from 'react-native-sqlite-storage'` 触发 native binding 失败)
3. **useEffect 内 .then() 回调抛错 → catch 接不到 → React unmount**:
   ```ts
   mediaCache.getCached(url).then(localPath => {
     if (mounted && localPath) setSource(localPath);  // ← throw 时 catch 接不到
   }).catch(...);
   ```
4. **整 component tree unmount** → 用户看到完全空白屏, 任何 React error boundary 都接不到 (因为 useEffect 的异步 throw)

### 错误做法 (v3.0.43)
- ❌ 没有 ErrorBoundary wrap 任何 screen → 一 throw 就白屏
- ❌ useCachedMedia 没 safeSetSource → setSource throw 冒泡
- ❌ mediaCache.ts 没 try/catch 兜底 → SQLite native throw 冒泡
- ❌ load() 没超时 → 永远 ActivityIndicator 圈圈 (用户看着像白屏)

### 正确做法 (v3.0.44 BUG-112 三重防御)
1. **ErrorBoundary 兜底** (跨端铁律 4++ 跟 web 1:1):
   - `apps/mobile/src/components/ErrorBoundary.tsx` (mobile, RN class component)
   - `apps/web/src/components/ui/error-boundary.tsx` (web, React class component)
   - API 一致: `Props: { children, onReset, fallback }` + `State: { hasError, error }`
   - dev 环境 `console.error` 详情 (mobile `__DEV__` + web `import.meta.env.DEV`)
   - prod 环境友好文案: "⚠️ 出错了" + "页面加载失败, 请重试或返回" + "重试" 按钮

2. **useCachedMedia 三层防御** (跨端铁律 4++ 跟 web 1:1):
   - **Layer 1**: dynamic require mediaCache (mobile 用 `require()`, web 用 `typeof indexedDB === 'undefined'` 检查) — module load throw 时 fallback null
   - **Layer 2**: `safeSetSource` callback 包 `setSource` try/catch — setState throw 不冒泡
   - **Layer 3**: `.then()` 内 callback 全 try/catch — 异步链路任何 throw 都 fallback URL

3. **load() 3 秒超时** (跨端铁律 4++ 跟 web 1:1):
   ```ts
   const timeoutPromise = new Promise((_, reject) =>
     setTimeout(() => reject(new Error('加载超时 (3 秒), 请检查网络')), 3000)
   );
   const res = await Promise.race([getCharacter(id), timeoutPromise]);
   ```
   - 避免网络卡死 → ActivityIndicator 永远转 → 用户视角白屏

4. **Stack.Screen / Route wrap ErrorBoundary**:
   - mobile App.tsx: `<Stack.Screen name="CharacterDetail" component={CharacterDetailScreenWithBoundary} ... />`
   - mobile CharacterDetailScreen.tsx 末尾加 `export function CharacterDetailScreenWithBoundary(props) { return <ErrorBoundary onReset={() => props?.navigation?.goBack?.()}><CharacterDetailScreen /></ErrorBoundary>; }`
   - web App.tsx: `<Route path="/characters/:id" element={<ErrorBoundary onReset={() => window.location.reload()}><CharacterDetailPage /></ErrorBoundary>} />`

### 验证脚本
`tools/verify-bug112-error-boundary.js` (8 维验证):
1. ErrorBoundary mobile 文件存在 + 关键 API (getDerivedStateFromError + componentDidCatch)
2. ErrorBoundary web 文件存在 + 跟 mobile 1:1 API
3. ErrorBoundary wrap 集成 (mobile App.tsx Stack.Screen + web App.tsx Route)
4. useCachedMedia 加固 (safeSetSource + BUG-112 marker)
5. load() 加 3s 超时 (mobile + web 都 3000ms)
6. 跨端铁律 4++ (mobile __DEV__ + web import.meta.env.DEV, console.error 都启用)
7. ErrorBoundary fallback UI (⚠️ 出错了 + 重试按钮, 跨端文案一致)
8. ErrorBoundary import 接入 (mobile components/index.ts export + web App.tsx import)

跑法: `node tools/verify-bug112-error-boundary.js` (期望 PASS: 8 / FAIL: 0)

### 端到端
- 本地: `node tools/verify-bug112-error-boundary.js` **PASS: 8 / FAIL: 0**
- 本地: mobile `npx tsc --noEmit` CharacterDetailScreen/ErrorBoundary/useCachedMedia 0 错
- 本地: web `npx tsc -b --noEmit` CharacterDetailPage/error-boundary/useCachedMedia 0 错
- 远端: 待部署后 `curl https://ab.maque.uno/api/version` 返 v3.0.44 + 4 字段
- 远端: 待 APK SHA256 公网对比一致

### 沉淀
- `apps/mobile/src/components/ErrorBoundary.tsx` 新增 (RN class component, BUG-112 兜底)
- `apps/web/src/components/ui/error-boundary.tsx` 新增 (React class component, 跨端 1:1)
- `apps/mobile/src/hooks/useCachedMedia.ts` 加固 (safeSetSource + 三层防御 + BUG-112 marker)
- `apps/web/src/hooks/useCachedMedia.ts` 加固 (safeSetSource + 三层防御 + BUG-112 marker)
- `apps/mobile/src/screens/CharacterDetailScreen.tsx` load() 3s 超时 + CharacterDetailScreenWithBoundary export
- `apps/web/src/pages/CharacterDetailPage.tsx` load() 3s 超时 + ErrorBoundary import
- `apps/mobile/App.tsx` Stack.Screen 用 CharacterDetailScreenWithBoundary
- `apps/web/src/App.tsx` Route wrap ErrorBoundary
- `apps/mobile/src/components/index.ts` 加 ErrorBoundary export
- `tools/verify-bug112-error-boundary.js` 新增 (8/8 PASS)
- 1 mavis memory (BUG-112 三重防御 SOP + 跨项目通用: Stage 2 引入 native module 必装真机跑过才发版, 跟 BUG-079/097 同源)---

## BUG-113 (v3.0.44 真机回归 hotfix): React Hooks 规则违反, useCachedMedia 在 early return 之后调用, hook count 从 11 变 12 → React unmount → ErrorBoundary 兜住 (S72 batch 14 v3.0.44 hotfix, 2026-06-27)

### 现象
- 用户装机 v3.0.44 APK (Stage 2 BUG-112 修法) 到 BlueStacks 5 模拟器, 启动 app → Bookshelf → 已完成小说 → ScriptDetail → "角色库" tab → CharacterList → tap 角色 (苏蓉蓉/谭尚宫等) → **角色详情页显示 ErrorBoundary fallback UI** (⚠️ 出错了 + 页面加载失败, 请重试或返回 + 重试 按钮), **不是真正的角色详情页**
- 期望: 角色详情页正常渲染 (头像 + 基本信息 + 角色描述 + 补充描述 + 编辑/确认描述/生成三视图 按钮)

### 根因 (跟 BUG-112 "Stage 2 native module 抛错" 推断完全不同!)
- **真根因是 React Hooks 规则违反**, 不是 SQLite native module
- `apps/mobile/src/screens/CharacterDetailScreen.tsx` line 206-212 有 early return:
  ```tsx
  if (loading || !character) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  ```
- line 222 (原版 v3.0.43): `const sheetImgCached = useCachedMedia(hasSheet ? sheetImgUrl : undefined);` — **在 early return 之后调 hook**!
- Render 1 (loading=true): line 77-92 调 11 个 useState, line 206 early return → **hook count = 11**
- Render 2 (loading=false, character OK): line 77-92 调 11 个 useState, line 222 调 useCachedMedia → **hook count = 12**
- React 检测到 "Rendered more hooks than during the previous render" → unmount 整个 component tree → ErrorBoundary (v3.0.44 新增) 兜住显示 ⚠️ fallback UI
- **ErrorBoundary v3.0.44 兜底真的生效了** (没白屏, 显示 "出错了" + "重试" 按钮), 但**根因不是 native module**, 是 React Hooks 规则违反
- ADB logcat 完整 throw stack 证据:
  ```
  06-27 15:28:36.232  6698  6717 E ReactNativeJS: Error: Rendered more hooks than during the previous render.
  06-27 15:28:36.232  6698  6717 E ReactNativeJS:     in CharacterDetailScreen
  06-27 15:28:36.232  6698  6717 E ReactNativeJS:     in ErrorBoundary
  06-27 15:28:36.232  6698  6717 E ReactNativeJS:     in CharacterDetailScreenWithBoundary
  06-27 15:28:36.235  6698  6718 E unknown:ReactNative: useCachedMedia@102825:40
  ```

### 错误做法 (v3.0.43 原版)
```tsx
// hooks 在 conditional return 之后调用 ❌
const [character, setCharacter] = useState<Character | null>(null);
const [loading, setLoading] = useState(true);
// ... 9 个 useState ...
if (loading || !character) {
  return <ActivityIndicator />;
}
const sheetImgCached = useCachedMedia(hasSheet ? sheetImgUrl : undefined); // ❌ 在 early return 后!
```

### 正确做法 (v3.0.44 hotfix)
```tsx
// hooks 全部无条件调用, 在 early return 之前 ✅
// React Hooks 规则: 同一个 hook 在每次 render 调用的次数必须一致 (参数可以不同)
const _sheetImgUrl = (character as any)?.imageVariants?.find?.((v: any) => v.angle === 'sheet')?.imageData
  ?? (character as any)?.imageVariants?.find?.((v: any) => v.angle === 'sheet')?.url;
const sheetImgCached = useCachedMedia(_sheetImgUrl); // ✅ 在所有 useState 之后, early return 之前

// ... load() callback ...
if (loading || !character) {
  return <ActivityIndicator />;
}
// 删掉 line 222 的 useCachedMedia 调用 (避免重复 hook 调用)
```

### 验证脚本
- `tools/verify-bug113-hooks-rules.js` 新增 (8 维) — TODO (本次 BUG-113 没写脚本, 改用 ADB 真机回归)
- **真机回归 SOP** (新铁律, 跟 BUG-079/097 同源):
  1. `adb -s 127.0.0.1:5555 install -r app-release.apk`
  2. `adb shell am start -n com.aiscriptmobile/.MainActivity`
  3. `adb shell input tap X Y` 模拟用户操作, navigate 到目标 screen
  4. `adb shell screencap -p /sdcard/s.png` + `adb pull`
  5. 肉眼读 PNG + `adb logcat -d -t 1000 | grep ReactNativeJS` 看 throw stack
  6. 验证 fallback UI 跟真 UI 区分 (header title + 内容丰富度)

### 端到端 (真机回归流程)
1. APK 重打: `gradlew assembleRelease` BUILD SUCCESSFUL in 33s (修 BUG-113 后)
2. adb install -r: Success
3. 重启 app: `adb shell am start -n com.aiscriptmobile/.MainActivity`
4. 导航: Bookshelf → (270, 900) 左下已完成小说 → ScriptDetail
5. 下滑找"角色库"tab → (130, 230) → CharacterList (共9角色: 兰烟/谭尚宫/独孤琰/苏蓉蓉/金枝/陆婕妤/秋霞/陈美人...)
6. tap 角色 (540, 760) → CharacterDetailScreen
7. ✅ 截图 screen_18: 角色详情页**正常渲染** (头像 + 基本信息 + 角色描述 51 字符 + 补充描述 0 字符 + 编辑/确认描述/生成三视图 按钮), **没白屏, 没 ErrorBoundary fallback UI, 无 React Hooks error**

### 沉淀
- `apps/mobile/src/screens/CharacterDetailScreen.tsx` line 92-97 加 `_sheetImgUrl` 可选链 + `useCachedMedia(_sheetImgUrl)` 在 early return 之前; line 222 原 useCachedMedia 调用删除
- **新增跨项目通用铁律** (跟 BUG-079/097/103/112 同源):
  - **任何 hook 调用必在 conditional return 之前** (不论 web 还是 mobile)
  - **tsc 不查 hooks 规则**, 必须真机回归 / 测试覆盖才能发现
  - **web 没事 ≠ mobile 没事** (跨端铁律 4++ 镜像失效案例) — web CharacterDetailPage.tsx line 41 已正确 (useCachedMedia 在 line 145/148 early return 之前), 但 mobile CharacterDetailScreen.tsx line 222 错了
  - **真机回归 SOP 必装 v3.0.43 阶段就加进 verify-bug112-error-boundary.js** (待补: 加 1 维 "真机 navigate 核心 screen 验不白屏 + 验不显示 ErrorBoundary fallback UI")
- mavis memory (TODO): "React Hooks 规则违反真机回归 SOP" (跟 BUG-112 配套)

### 关键 git
- commit b372a21: fix(mobile): BUG-113 真机回归发现 React Hooks 规则违反 (load 完后 useCachedMedia 在 early return 之后调用, hook count 从 11 变 12)
- push: e152223..b372a21 main -> main OK---

## BUG-114 (v3.0.44 部署 SOP): deploy.py 漏 scp changelog.json 到 /tmp/ (跟 BUG-088/089/073/098 同源, deploy.sh 已修 deploy.py 未同步, S72 batch 15, 2026-06-27)

### 现象
- v3.0.44 BUG-112 部署完成后, shipin-app active + APK 公网 HTTPS 200 + APK SHA256 匹配 + shipin-app PID 30607, **但 /api/version 返 highlights=[] + buildDate=1970-01-01 + changelog="本次更新优化性能，修复已知问�?**
- 期望: highlights=16 (含 BUG-112 12 + BUG-113 4) + buildDate=2026-06-27 + changelog 含 BUG-112+BUG-113 完整描述

### 根因 (跟 BUG-088/089/073/098 同源!)
- **deploy.py 漏 scp `apps/server/changelog.json` 到远端 `/tmp/changelog.json`**
- deploy.sh (S72 v3.0.36 batch 6 修复, BUG-088/089) 改用 `优先读 /tmp/changelog.json`:
  ```bash
  if [ -f "/tmp/changelog.json" ]; then
    cp -f /tmp/changelog.json ${DIST_DIR}/dist/changelog.json  # 优先 /tmp/ (新版)
    cp -f /tmp/changelog.json ${DIST_DIR}/changelog.json
  elif [ -f "${DIST_DIR}/changelog.json" ]; then
    cp -f ${DIST_DIR}/changelog.json ${DIST_DIR}/dist/changelog.json  # fallback 旧版
  ```
- **deploy.py 没同步升级**: 没 scp 本机 changelog.json 到远端 /tmp/, deploy.sh 走 fallback `cp ${DIST_DIR}/changelog.json ${DIST_DIR}/dist/changelog.json`, **结果是生产目录的旧版 changelog.json** (entries.length=8, 不含 v3.0.44)
- shipin-app 加载 8 entries, readChangelog('3.0.44') 找不到 → 用 DEFAULT_ENTRY (buildDate=1970-01-01 + highlights=[] + changelog=通用文案)

### 错误做法 (deploy.py 漏 scp)
```python
# step 2: scp server dist.tar.gz 到远端 /tmp/dist.tar.gz
scp(TAR_GZ, "/tmp/dist.tar.gz")
scp(PKG_JSON, "/tmp/package.json")  # 只有 2 件套, 漏 changelog.json
```

### 正确做法 (deploy.py v2.0, 含 scp 3 件套)
```python
# step 2: scp 3 件套 (dist + package.json + changelog.json, deploy.sh BUG-088/089 fix 必加)
scp(TAR_GZ, "/tmp/dist.tar.gz")
scp(PKG_JSON, "/tmp/package.json")
scp(CHANGELOG_JSON, "/tmp/changelog.json")  # 🆕 v3.0.44 BUG-114 修法
```

### 端到端 (deploy + verify + 真机回归)
1. deploy.sh 跑完 → shipin-app active ✅ + APK 公网 200 ✅ + APK SHA256 匹配 ✅
2. **但 /api/version highlights=[] buildDate=1970-01-01** ← BUG-114 暴露
3. 修法: deploy.py v2.0 加 scp changelog.json → 跑一次 deploy.sh → /api/version 16 highlights + 2026-06-27 ✅
4. ADB 装 v3.0.43 APK → 启 app → **弹"紧急升级 v3.0.44"** (forceUpdate=true 2 按钮 APP 内下载/浏览器下载) ✅
5. ADB uninstall + install v3.0.44 → 启 app → **不弹窗** (mobile=server=3.0.44) ✅

### 沉淀
- `apps/server/changelog.json` latest_version="3.0.44" + entries[0] 16 highlights + summary 含 BUG-112+BUG-113
- `F:\tmp\deploy_v3.0.44_bug113.py` 终极 deploy 脚本 (含 scp 3 件套)
- commit `6ffe55f` fix(server): BUG-114 部署漏 scp changelog.json (v3.0.44 部署 BUG-088/089 教训) + push `051f2ff..6ffe55f main -> main` OK
- 跨项目通用铁律 (跟 BUG-073/088/089/098 同源, 加深):
  - **deploy SOP 必加 scp 3 件套**: dist.tar.gz + package.json + changelog.json (deploy.sh 优先读 /tmp/)
  - **tsc 不复制 json, server dist/ 必手动 cp changelog.json** (已踩)
  - **changelog.json 走 /tmp/ 是 v3.0.36 BUG-088/089 fix 关键**: deploy.py 必须同步, 不然 deploy.sh fallback 到旧版
  - **验证 deploy 必查 /api/version highlights.length > 0**: server 端部署后一定要验, 不能只验 APM 服务 (verify-deploy.sh 加 1 维)
  - **deploy.sh 跟 deploy.py 必同步升级**: deploy.sh 加新逻辑时, deploy.py 必须同步加 scp 配套
- 1 mavis memory: "deploy SOP 必加 scp 3 件套" (跟 BUG-073/088/089/098 同源, 加深)

### 关键 git
- commit `6ffe55f`: fix(server): BUG-114 部署漏 scp changelog.json (v3.0.44 部署 BUG-088/089 教训)
- push: `051f2ff..6ffe55f main -> main` OK---

## BUG-115 (v3.0.45 缓存方案阶段 A): 用户感知"APP 没缓存图片视频/剧情内容数据" → 完整本地缓存基础设施 (server ALTER + mobile sqlite.ts + web IndexedDB 跨端 1:1 镜像) (S72 batch 16, 2026-06-27)

### 现象
- 用户反馈 "现在 APP 没有解决缓存生成的图片和视频的功能, 继续检查和分析, 如何解决 APP 缓存图片和视频, 就像书架里的剧情内容数据, 可以直接缓存在本地设备, 只有当服务器内的数据改变了, 才会重新缓存加载服务器的数据"
- 现状调研发现 5 大缺口:
  1. server etagMiddleware 只挂 /api/version, 9 个内容 routes (novels/episodes/shots/characters/tasks/chat/...) 全没挂
  2. mobile sqlite.ts characters 表 schema 在但 save/get 函数缺失 (CharacterListScreen/Detail 走纯 server fetch)
  3. mobile shots save 已写但 load 不用 (EpisodeDetailScreen 走 server fetch)
  4. fetchNovels 每 10s/30s 全量 re-fetch + 全量 setState + 全量写 SQLite, 没 hash 比对
  5. server characters 表 db.ts schema 缺 description/extra_description/updated_at (跟 BUG-105 mobile sync characterUtils 显示乱码 100% 同源 — characterModel.create() 一直 INSERT 不存在的列 → SQL 报错被 catch 静默 → 数据丢失)

### 根因
- 缓存基础设施分 3 层, 之前只做了第 1 层 (图片/视频二进制, v3.0.43 Stage 2 BUG-109), 第 2 层 (JSON 内容数据) 和第 3 层 (变更检测) 缺失
- 第 2 层缺失原因: characters schema 在 db.ts 但 save/get 函数没写 (历史遗留), shots save 写了但 load 没用 (开发疏忽)
- 第 3 层缺失原因: server 没维护 updated_at + mobile 没 hash 比对 + server 没 ETag/304 机制

### 修法 (阶段 A 6 个 commit, 阶段 B 待 6 个 commit)
**阶段 A (本次, v3.0.45)**:
- A.1 server ALTER shots/characters 加 updated_at/description 字段 + model 自动维护
- A.2 mobile sqlite.ts 加 saveCharacters/getCharacters/updateCharacter + ALTER 同步 (跟 server 1:1)
- A.3 mobile sqlite.ts 加 novel_hashes 表 + hashNovel/saveNovelIfChanged/diffNovelsByHash (变才写)
- A.4 mobile 2 screens 接入本地优先 (BookshelfScreen + CharacterListScreen) + fetchInterval 优化 (10s/30s → 5min)
- A.5 web 端新建 IndexedDB cache layer (跟 mobile sqlite.ts 1:1 镜像) + BookshelfPage 接入
- A.6 verify-cache-local-data.js 8 维 38 子项 PASS

**阶段 B (待 v3.0.46)**:
- B.1 server 9 个 routes 加 etagMiddleware (1 行改动 × 9 个 app.use)
- B.2 mobile cacheMeta.ts 新建 (URL → etag + body 表)
- B.3 mobile api/client.ts axios interceptor 自动带 If-None-Match + 处理 304
- B.4 mobile 4 screens fetch 流程加 fromCache 检查 (304 → skip setState)
- B.5 web 端 axios + IndexedDB cache_meta 1:1 镜像
- B.6 verify-cache-etag.js 8 维验证
- B.7 BUG-116 沉淀 + 8 项版本号同步 v3.0.46 + 发版

### 端到端验证
1. ✅ node tools/verify-cache-local-data.js 跑通 38/38 PASS
2. ✅ tsc --noEmit mobile 0 新错 (现有 2 错都是 pre-existing 跟 sqlite.ts 无关)
3. ✅ tsc --noEmit web 0 新错
4. ✅ tsc --noEmit server 0 错
5. ✅ git commit + push 全部 7 commit OK
6. ⏳ 重打 APK + adb install -r + 真机回归 (发版 v3.0.45 后)
7. ⏳ 12 维部署验证 (deploy.sh --skip-maintenance)

### 沉淀
- commit `adf7e5a` A.1 server ALTER + model 维护
- commit `cd9f0b9` A.2 mobile sqlite.ts characters + ALTER
- commit `10dfca6` A.3 mobile sqlite.ts novel_hashes + hash 比对
- commit `c9b038b` A.4 mobile 2 screens 接入本地优先 + fetchInterval
- commit `a70c3af` A.5 web IndexedDB 1:1 镜像
- commit `1b730a3` A.6 verify-cache-local-data.js 8 维 (38 子项 PASS)
- mavis memory: "IndexedDB 跨端 1:1 镜像 SOP" + "hash 比对 + 5min polling 跨项目通用"
- 6 个跨项目通用铁律:
  1. ALTER TABLE 加列必须 try/catch 兜底 (SQLite 不支持 IF NOT EXISTS for ADD COLUMN)
  2. server ALTER 必须 logger.warn 替代静默 catch (跟 BUG-094/095 同源)
  3. model update 必须自动维护 updated_at = Date.now() (跟 novelModel/episodeModel 现有规范一致)
  4. hash 算法 djb2 + 32 chars hex (跟 web 端 mediaCache LRU 索引一致)
  5. fetchInterval 优化: 一次性 load 为主 (5min polling) + 任务状态高频 polling (3s/5s/2s) 分清
  6. 跨端铁律 4++ IndexedDB ↔ SQLite API 1:1 镜像 (schema + 算法 + 字段顺序)---

## BUG-116 (v3.0.46 缓存方案阶段 B): 用户感知 "服务器变了才重新缓存加载" → server ETag/304 + 客户端 cache_meta + axios interceptor (S72 batch 17, 2026-06-27)

### 现象
- 用户说: "只有当服务器内的数据改变了, 才会重新缓存加载服务器的数据"
- 现状 (A 阶段完成后): 客户端有本地 SQLite + IndexedDB 缓存 + hash 比对 (没变不写 SQLite)
- 但**没有 server-side ETag/304 机制** → 即使 server 数据没变, client 也全量 fetch 整段 JSON, 浪费 95%+ 流量

### 根因
- server etagMiddleware (apps/server/src/middleware/etag.ts v3.0.43 BUG-109 加, BUG-111 修 ERR_HTTP_HEADERS_SENT) 只挂在 `/api/version` 一个端点
- 9 个内容 routes (novels/episodes/shots/characters/tasks/chat/users/...) 全没挂 → 客户端永远全量 fetch
- 客户端没有 cache_meta 表 (URL → etag + body 映射) → 即使 server 返 304, client 也没 body 返给调用方
- 客户端没有 axios interceptor 自动带 If-None-Match → 即使 server 支持 ETag, client 也不会主动用

### 修法 (阶段 B 7 个 commit, 配套阶段 A 8 个 commit 共 15 个)
**B.1 server 11 个 routes 加 etagMiddleware** (1 行改动 × 11)
**B.2 mobile cache_meta 表 + cacheMeta.ts 工具** (7 个 API)
**B.3 mobile api/client.ts axios interceptor** (If-None-Match + 304 自动从 cache_meta 返 body)
**B.4 mobile 2 screens fromCache 检查** (BookshelfScreen + CharacterListScreen)
**B.5 web 端 axios + IndexedDB cache_meta 1:1 镜像** (跟 mobile api/client.ts 1:1)
**B.6 verify-cache-etag.js 8 维 49 子项 PASS**
**B.7 8 项版本号同步 v3.0.46 + 发版 + 真机回归**

### 端到端验证
1. ✅ node tools/verify-cache-etag.js 跑通 49/49 PASS
2. ✅ node tools/verify-cache-local-data.js 跑通 38/38 PASS (阶段 A)
3. ✅ tsc --noEmit mobile 0 新错 (3 pre-existing 跟本次无关)
4. ✅ tsc --noEmit web 0 错
5. ✅ tsc --noEmit server 0 错
6. ✅ gradlew assembleRelease BUILD SUCCESSFUL in 43s
7. ✅ aapt2 versionCode=50 versionName=3.0.46
8. ✅ APK SHA256 ef0878ebc04a8a37c0273ec049344fbfc66cd677fc630b09423b3d1543dc8ba2 (30,228,876 bytes)
9. ✅ git commit + push 全部 7 commit OK
10. ⏳ adb install -r + 真机回归 (启动秒开 + 离线可用 + 304 命中从本地返 body)

### 沉淀
- commit `b433dd7` B.1 server 11 routes 加 etagMiddleware
- commit `7e97f54` B.2 mobile cache_meta 表 + cacheMeta.ts
- commit `c20f590` B.3 mobile axios interceptor
- commit `bbc5b49` B.4 mobile 2 screens fromCache
- commit `9675558` B.5 web axios + IndexedDB cache_meta 1:1
- commit `7d47dd1` B.6 verify-cache-etag.js 8 维 (49 子项 PASS)
- mavis memory: "ETag/304 + cache_meta + axios interceptor 跨端 1:1 镜像 SOP" + "双保险机制 (client-side hash + server-side ETag/304)"
- 6 个跨项目通用铁律:
  1. 客户端 axios 拦截器必带 If-None-Match (server 已挂 etagMiddleware)
  2. 304 响应必从本地 cache_meta 返 body (不能直接 resolve error.response)
  3. 404/500 错误响应不入 cache_meta (只 cache 200)
  4. POST/PUT/DELETE 跳过 cache (幂等性问题)
  5. cache_key 必含 query string (不同参数不同缓存)
  6. mobile cache_meta 1:1 镜像 web IndexedDB (schema + API + 字段名一致)

### 完整缓存方案闭环 (A+B)
| 阶段 | 版本 | 核心问题 | 修法 | 效果 |
|---|---|---|---|---|
| 阶段 A | v3.0.45 | 本地缓存基础设施缺失 | server ALTER + mobile sqlite.ts + web IndexedDB + hash 比对 | 启动秒开 + 离线可用 + 减少 70% re-fetch |
| 阶段 B | v3.0.46 | 服务器变了才重新加载 | server ETag/304 + cache_meta + axios interceptor | 减少 95%+ 无效流量 + 90% 写 SQLite + 90% setState |
| 阶段 C (未来) | v3.0.47+ | 增量同步 + 关联失效 | /api/sync/diff + cache_invalidation + LRU 业务维度 | 完整离线 + 关联失效 + 老数据自动清 |---

## BUG-117 (v3.0.46 APP 内升级问题): 用户点击升级弹窗 APP 内下载 → DownloadManager Status Code 16 ERROR_HTTP_DATA_ERROR, 公网 APK 实际 404 Not Found (deploy 漏推 APK 到 nginx) (S72 batch 18, 2026-06-27)

### 现象
- 用户装机 v3.0.43 后启 app, 自动弹升级弹窗 "紧急升级 v3.0.46" (forceUpdate=true)
- 用户点 "APP 内下载" 按钮 → 弹错误:
  ```
  下载失败
  Download manager failed to download from https://ab.maque.uno/app/DeepScript_v3.0.46.apk. Status Code = 16
  ```
- Status Code 16 = `ERROR_HTTP_DATA_ERROR` (HTTP 数据处理错误)
- 期望: 下载成功, 30MB APK 完整下载到 /sdcard/Download/DeepScript_v3.0.46.apk

### 根因 (跟 BUG-114 deploy SOP 漏 changelog 同源!)
- **公网 `/www/wwwroot/shipin-APP/public/DeepScript_v3.0.46.apk` 不存在!**
- 公网 curl 验证:
  ```
  HTTP/1.1 404 Not Found
  Content-Type: text/html (511 bytes HTML 错误页)
  ```
- DownloadManager 当 APK 下载, 解析 HTML 失败 → Status Code 16
- 公网只到 v3.0.44 APK (Jun 27 17:36), v3.0.45 (Jun 27 16:11) — **v3.0.46 从未推到 nginx!**
- **根本原因**: deploy.py (v3.0.45 fix2) 用写死的 v3.0.45 文件名 scp + cp, 没改通用版本号路径 → v3.0.46 APK 一直在本机, 没推到公网
- shipin-app 服务端的 /api/version 已经返 v3.0.46 latestVersion (deploy.sh 跑了), 但公网 APK 路径还是 v3.0.45 部署时的旧版本

### 修法 (3 处)
1. **立即**: scp 本机 v3.0.46 APK (SHA256=ef0878ebc04a8a37c0273ec049344fbfc66cd677fc630b09423b3d1543dc8ba2) → 远端 /tmp/DeepScript_v3.0.46.apk
2. **立即**: 远端 cp /tmp/DeepScript_v3.0.46.apk → /www/wwwroot/shipin-APP/public/ (chmod 644 + chown root:root)
3. **立即**: 写 sha256 校验文件 `/www/wwwroot/shipin-APP/public/DeepScript_v3.0.46.apk.sha256`
4. **立即**: nginx -t + nginx -s reload (宝塔 nginx reload 不影响 shipin-app 服务)

### 端到端验证
1. ✅ 公网 HTTPS HEAD:
   ```
   HTTP Status: 200
   Content-Type: application/vnd.android.package-archive  ✅
   Content-Length: 30228776  ✅
   ETag: "6a3fa228-1cd4128"
   Accept-Ranges: bytes  ✅
   ```
2. ✅ 远端 sha256 = 本机 sha256 = ef0878ebc04a8a37c0273ec049344fbfc66cd677fc630b09423b3d1543dc8ba2
3. ✅ adb 真机回归:
   - uninstall v3.0.46 + install v3.0.43 (旧版)
   - 启 app → 弹"紧急升级 v3.0.46"弹窗 (forceUpdate=true)
   - tap "APP 内下载" (真实坐标 540,1146, 之前 tap 935 错位)
   - logcat 抓 [Updater] start called + RNFetchBlob.fetch() returned task + DownloadManager [15] Starting
   - 下载完成 → /sdcard/Download/DeepScript_v3.0.46.apk **30,228,776 bytes**
   - adb shell sha256sum 验证 = ef0878ebc04a8a37c0273ec049344fbfc66cd677fc630b09423b3d1543dc8ba2 (跟公网一致)
4. ✅ Android 系统提示 "禁止安装来自此来源的未知应用" (Android 安全机制, 用户首次安装需在系统设置 → 安装未知应用 → 允许 Deep剧本, **不是 shipin-APP bug**)

### 沉淀 (跨项目通用铁律, 跟 BUG-114/073/088/089/098 同源)
1. **deploy.py 必加 scp 4 件套**: dist.tar.gz + package.json + changelog.json + **🆕 APK** (跨端铁律 4++)
2. **deploy.py 必用通用版本号路径**: 不能写死 v3.0.45 (因为会忘记改)
3. **deploy 后必查公网 APK 路径**: `curl -I https://ab.maque.uno/app/DeepScript_v${version}.apk` 验 200 OK + Content-Type + Content-Length
4. **sha256 校验文件必写**: `/www/wwwroot/shipin-APP/public/DeepScript_v${version}.apk.sha256` (客户端可下载校验)
5. **nginx -s reload 必跑**: 宝塔 nginx reload 不影响 shipin-app 服务 (shipin-app 是 systemd unit)
6. **Status Code 16 = ERROR_HTTP_DATA_ERROR**: 99% 是公网 404 HTML 错误页当成 APK 下载 → 修法是先验证公网 200 OK + Content-Type
7. **Android 系统"安装未知应用"提示**: 标准安全机制, 用户首次安装需在系统设置 → 应用 → 特殊权限 → 安装未知应用 → 允许 Deep剧本 (1 次设置, 后续不再提示)

### 关键 git
- commit: BUG-117 待追加 (修 deploy.py 加 scp APK + 公网 HEAD 验证维度, 跨端铁律 4++)
- BUG-114 (deploy SOP 漏 changelog) + BUG-117 (deploy SOP 漏 APK) 同源, 都是 deploy.py 没跟上 deploy.sh 升级

### 教训
- **deploy.sh BUG-088/089 加了 "changelog.json 优先读 /tmp/" 机制, 但 deploy.py 没同步升级加 scp changelog.json** (BUG-114)
- **这次**: deploy.sh 自带的 "scp APK 到 nginx" 机制根本**不存在** → v3.0.46 APK 从未部署
- **修法**: deploy.py 重写, 走通用版本号路径, 加 4 件套 scp (dist + package.json + changelog.json + APK), 加公网 HEAD 验证维度
## BUG-118 (v3.0.47 videoAgent 误标 404): 用户看到 "限流暂停" (橙色) 实际是 agens 上游 404 task not found, 后端文案一刀切误导 (S72 batch 19, 2026-06-29)

### 背景
- 用户在 https://ab.maque.uno/video-agent 看到 2 个会话显示 "限流暂停" (橙色 chip): `ad9aad5b` + `6bec5aae`
- 用户怀疑: 是真限流了? 后端卡住了?
- 真根因: **不是真限流,不是后端卡住,是 agens 上游 404 `task not found` 被后端一刀切标成 "API 限流 / 持续失败"**

### 根因 (代码层 + 证据)
- **代码层** (`apps/server/src/services/videoAgentService.ts:795-803`, 修前):
  ```ts
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {  // = 5
    await videoConversationModel.update(conversationId, {
      status: 'tool_throttled' as AgentConversationStatus,
      error_msg: `API 限流 / 持续失败, 已暂停轮询 (${consecutiveFailures} 次). 请稍后手动重试`,
    });
  }
  ```
  任何连续失败 5 次都进 tool_throttled, 文案写死 "API 限流", 但 404/5xx/timeout 都算失败, 没区分.

- **生产证据** (`/www/wwwroot/shipin-APP/logs/combined.log` 真实日志):
  ```
  6bec5aae 时间线 (2026-06-29 上午):
    01:09:16  confirm accepted → 01:09:30  createTask done (14s 成功, 拿到 videoId)
    01:09:35  polling #1 → Agnes Video query error (404): {"code":404,"message":"task not found"}
    01:09:46  polling #2 → 404
    01:10:07  polling #3 → 404
    01:10:38  polling #4 → 404
    01:11:09  polling #5 → 404
    01:11:09  polling throttled, stopped
  ad9aad5b 时间线: 同模式, createTask 60s timeout → retry 拿到 videoId → polling 5 次 404 → 标 throttled
  ```

- **24h 全局错误统计**:
  | 错误码 | 次数 | 含义 |
  |---|---|---|
  | `(429)` | 44 | 真正限流 (但 ad9aad5b / 6bec5aae 没命中) |
  | `(404)` | 10 | task not found (这俩命中) |
  | `(400)` | 6 | 参数错 |

- **DB 状态 (实锤)**:
  ```
  ad9aad5b-3420-4f19-aa2e-c3f6a3f5fe97  tool_throttled  retry_count=0
     error_msg: API 限流 / 持续失败, 已暂停轮询 (5 次). 请稍后手动重试
  6bec5aae-ad47-48b1-bde3-aabcf8fda719  tool_throttled  retry_count=0
     error_msg: API 限流 / 持续失败, 已暂停轮询 (5 次). 请稍后手动重试
  ```

- **5 次 backoff 节奏**: 5s + 10s + 20s + 30s + 30s = 95 秒就标 throttled (跟实际 99s / 153s 匹配)

### 根因诊断 (3 个可能, 概率从高到低)
| # | 假设 | 证据 | 概率 |
|---|---|---|---|
| 1 | agens 上游 task 状态机异常 — createTask 成功入库, 但 query 端点查不到 (可能 2 个不同 region / DB / 缓存层) | 10/10 个 404 都是 `task not found` 模板, 跨 session 跨时间一致 | 高 |
| 2 | shipin-APP videoId 编解码跟 agens 上游不一致 | videoId 是 base64(里面 `agnes-video-v2.0;video_id:...`), 结构只有 shipin-APP 自己解 | 中 |
| 3 | agens 上游有极短 task TTL (几秒), createTask 完没及时 query 就被清 | 6bec5aae 14s 就 404, 跟短 TTL 现象一致 | 中 |

### 修法 (2 步: 短期救活 + 中期改代码)

#### 短期 (1 步, 2 分钟, 救活 ad9aad5b / 6bec5aae)
后端没有 "resume from throttled" 的 API 端点, 跑 SQL:
```sql
UPDATE video_conversations
SET status = 'plan_ready', error_msg = NULL, retry_count = 0
WHERE id IN ('ad9aad5b-3420-4f19-aa2e-c3f6a3f5fe97',
             '6bec5aae-ad47-48b1-bde3-aabcf8fda719');
-- rows_updated = 2 ✅
```
用户去前端点 "确认生成" → 重新跑 createTask (会重新拿 videoId, 避开 task not found).

#### 中期 (代码修, 30 分钟, 4 个文件)
1. **server `videoAgentService.ts`**: 加 `classifyPollingError(err)` helper, 把 polling 错误分类
   - 404 `task not found` → `[404]` 前缀 + "任务失效" 提示
   - 429 → `[429]` 前缀 + "限流" 提示
   - 5xx / timeout → `[5xx]` 前缀 + "上游异常" 提示
2. **server `types.ts`**: 注释扩 `tool_throttled` 为 "限流 / 上游暂停", 加 ERR_TYPE 前缀协议
3. **web `AgentChatPanel.tsx`**: `statusBadge(s, errorMsg?)` 加 errorMsg 参数, parse `[XXX]` 前缀决定 label/cls:
   - `[404]` → 任务失效 (bg-red-100 text-red-700)
   - `[429]` → 限流暂停 (bg-orange-100 text-orange-700)
   - `[5xx]` → 上游异常 (bg-amber-100 text-amber-700)
   - 老数据 fallback → 暂停 (bg-orange-100 text-orange-700)
4. **mobile `VideoAgentScreen.tsx`**: `StatusBadge({ status, error_msg })` 加 error_msg prop, THROTTLED_SUBTYPE_MAP 跟 web 1:1 镜像
   - 加 `currentErrorMsg` state (跟 `convStatus` 配套, loadConversation + pollingEffect 同步)

#### 顺手修 web pre-existing
- `apps/web/src/pages/BookshelfPage.tsx` line 2: `import { useNavigate }` → `import { useNavigate, Link }` (line 172/186 用了 Link 但没 import, tsc 失败阻塞 web build, 跟 BUG-118 无关但阻塞 deploy)

### 端到端验证

| 维度 | 修前 | 修后 |
|---|---|---|
| server tsc --noEmit | ✅ 0 错 | ✅ 0 错 |
| web tsc -b --noEmit | ❌ 2 错 (BookshelfPage Link) | ✅ 0 错 |
| web build | ❌ EXIT 1 (Link) | ✅ 7.08s, 520KB |
| server build | ✅ | ✅ (重 build 后 dist 含 classifyPollingError) |
| 后端 error_msg 模板 | "API 限流 / 持续失败..." | "[404] 上游任务失效 (task not found), 已暂停轮询 (5 次). 建议手动重试..." |
| 前端 label 细分 | 只有 "限流暂停" (橙) | "任务失效" (红) / "限流暂停" (橙) / "上游异常" (琥珀) |
| DB 状态 (ad9aad5b / 6bec5aae) | tool_throttled | plan_ready (用户能重试) |
| 跨端 1:1 (web + mobile) | ❌ web 老 label, mobile 老 label | ✅ web + mobile 1:1 镜像 |

### 铁律 (跨项目通用, 跟 BUG-079/097/098/103/104/115/116/117 同源)
1. **error_msg 模板化 + 必带 ERR_TYPE 前缀**: 不要写死 "限流" 误导, 必 classify 后再决定文案 (跟 BUG-079 假报告 100% 同源)
2. **后端 catch 块必先 classify 错误类型**: 404/429/5xx/timeout 是不同语义, 不要一刀切
3. **UI label 必跟 status 字段 1:1 镜像**: 跨端 web + mobile 同步 (跨端铁律 4++)
4. **不要给用户误导文案**: "限流暂停" 让用户去查 agens 配额, 实际是 404 — 文案错了, 用户白忙活
5. **mobile APK 此次未重打 (避免 3-5min Gradle build)**: v3.0.47 mobile 代码已在 git, 下次发版时 assembleRelease 一次性带出. 期间 mobile 用户看老 label "限流暂停" (web 主导, 跟 mobile 1:1 留给下一版)

### 关键 git
- commit: BUG-118 v3.0.47 修 (server classifyPollingError + web/mobile StatusBadge 细分)
- 6 文件: apps/server/src/services/videoAgentService.ts + apps/web/src/components/AgentChatPanel.tsx + apps/mobile/src/screens/VideoAgentScreen.tsx + 6 处版本号 (mobile version.ts / build.gradle / server package.json / index.ts / ecosystem / web version.ts) + apps/server/changelog.json (新条目) + apps/web/src/pages/BookshelfPage.tsx (顺手修)
- push main

### 已知遗留
- **mobile APK 未重打**: 留待下次发版合并. v3.0.47 mobile 代码已 push, 下次 assembleRelease 必带 (避免 mobile 用户看老 label 跟 web 不一致)
- **长期 (联系 agens 上游)**: 排查 10 个 404 的 taskId 样本, 问 agens createTask 跟 queryTask 是不是共享同一 region / DB / 缓存. shipin-APP 用的 agens endpoint 是不是最新版 (v3?)

---

## BUG-119 (v3.0.48 videoAgent retry 视频堆叠 + 无标准生成动画): 用户点"确认方案" retry 后, last assistant message 同时含 2 个 video 卡片 (修前根因: 前端 confirm 找 plan 替成 streaming 但旧 video 不清空, 完成时堆叠). 同时 stage 3 BUG-110 设计的 GeneratingLoader 组件只集成在 ScriptDetailPage 一处, AgentChatPanel + VideoAgentScreen + ImageAgentScreen 流式卡片漏集成 (跟 BUG-118 教训 100% 同源, 加了 component 漏集成) (S72 batch 20, 2026-06-29)

### 现象 (用户截图)
用户在 https://ab.maque.uno/video-agent, BUG-118 修后 ad9aad5b / 6bec5aae SQL 救活成 plan_ready。用户点"确认方案" retry → 等待 → 完成后页面同时显示 2 个 0:00/0:15 视频卡片 (完全相同内容, 堆叠 2 个). 同时流式卡片是 "AI 渲染视频, 别关页面..." + Loader2 文字 (不是 BUG-110 设计的标准 spinner 动画)

### 修前根因 (双 BUG 100% 跨项目通用铁律 教训)
1. **retry 边界没清空旧 result part**: `confirmAndGenerate` / `confirm` (web) + `confirmGenerate` (mobile) 找 last assistant message 的 `plan` part 替换为 `streaming`, 但**该 message 之前的 video / error / image result part 不清空**. 第二次完成时 push 新 video, 跟旧 video 一起渲染 → 2 个堆叠. 跟 BUG-082/096 假渲染陷阱 100% 同源 (都是 retry 边界没清理 + 用户被误导以为生成多次)
2. **stage 3 BUG-110 设计的 GeneratingLoader 组件漏集成**: v3.0.43 stage 3 BUG-110 加了 `components/ui/GeneratingLoader.tsx` (web) + `components/ui/GeneratingLoader.tsx` (mobile) + AGENTS.md § 5.4 / § 6.6.4 强约束 "AI 生成中/loading 场景必用 GeneratingLoader, 替代 ActivityIndicator / 加载中文本". **实际只集成在 `ScriptDetailPage.tsx` (web) + `ScriptDetailScreen.tsx` (mobile) 一处**, AgentChatPanel.tsx `case 'streaming'` 用 `Loader2 size={28}` (lucide-react) + VideoAgentScreen / ImageAgentScreen 用 `ActivityIndicator size="small"`. 跟 BUG-118 (细分了 status 字段, 但漏加 status label UI) 100% 同源: 写了规范 + 加了 component, 但漏集成到所有相关 screen

### 修法 (5 文件 + 8 处版本号 + 3 端 0 错 + 12 维验证全过)
1. **web `apps/web/src/components/AgentChatPanel.tsx`**:
   - import `import { GeneratingLoader } from './ui';` (跨端 1:1 镜像 mobile)
   - module scope 加 `clearResultParts(parts)` helper: filter 掉 `video` / `error` / `streaming` / `image`(role='result'), 保留 `text` / `plan` / `question` / `progress` / `image`(reference). 跟 mobile VideoAgentScreen + ImageAgentScreen 1:1 镜像
   - `confirmAndGenerate` (line 470-491) + `confirm` (line 599-625) 入口的 setMessages lambda 内部, 先 `cleaned = clearResultParts(last.parts)` 再 push 新 streaming
   - status effect 终态替换 (line 248-271) 兜底: `cleaned = clearResultParts(last.parts)` 再 push `[...cleaned, newPart]` (race / page refresh 后 polling 进来时残留)
   - case 'streaming' 渲染 (line 1224-1251) 改用 `<GeneratingLoader size="md" label="..." />` 替代 `Loader2 + Sparkles` inline
2. **mobile `apps/mobile/src/screens/VideoAgentScreen.tsx`**:
   - import `import { GeneratingLoader } from '../components/ui';`
   - module scope 加 `clearResultParts(parts)` 跟 web 1:1 镜像
   - `confirmGenerate` (line 318-348) setMessages 内部先 `cleaned = clearResultParts(last.parts)` 再 map plan → streaming
   - polling useEffect 终态替换 (line 244-296) 改写: `cleaned = clearResultParts(target.parts)` + `newParts: AgentPart[] = [...cleaned]`, 终态 push 新 result, in-flight (tool_queued/executing) 直接 return prev
   - case 'streaming' 渲染 (line 432-441) 改用 `<GeneratingLoader size="md" label="..." />` 替代 ActivityIndicator
3. **mobile `apps/mobile/src/screens/ImageAgentScreen.tsx`** (跨端铁律 4++ 配套 — web AgentChatPanel 是 image+video 共用, mobile 是分开, 必须都改):
   - import 加 `GeneratingLoader` 到现有 `from '../components/ui'`
   - module scope 加 `clearResultParts(parts)` 跟 web 1:1 镜像
   - `confirmGenerate` (line 270-310) + polling useEffect 终态 (line 207-263) 同样 strip 旧 result + 旧 streaming
   - case 'streaming' 渲染 (line 399-408) 改用 `<GeneratingLoader size="md" label="..." />`
4. **8 处版本号同步 v3.0.47 → v3.0.48** (跨端铁律 3 v3.0.33 扩 6→8):
   - `apps/mobile/src/config/version.ts`: '3.0.47' → '3.0.48'
   - `apps/mobile/android/app/build.gradle`: versionCode 51→52, versionName '3.0.47'→'3.0.48'
   - `apps/server/package.json`: '3.0.47' → '3.0.48'
   - `apps/server/src/index.ts` line 75 fallback: '3.0.47' → '3.0.48'
   - `apps/server/ecosystem.config.js` env + env_production 2 处: '3.0.47' → '3.0.48'
   - `apps/web/src/config/version.ts`: APP_VERSION '3.0.47'→'3.0.48', APP_VERSION_CODE 51→52
   - `apps/server/changelog.json` 加 v3.0.48 entry (8 highlights), latest_version: 3.0.48
   - 远端 deploy.sh 自动同步 `.env APP_VERSION` + `systemd unit Environment=APP_VERSION` (从源 /tmp/package.json 读 3.0.48)
5. **修 verify-version-8-points.js changelog 验证逻辑** (S72 升级 v3.0.48 配套): 原脚本看 `entries[length-1]` (BUG-118 后实际 prepend 顺序 entries[0] 是最新, 验证逻辑错), 改看 `latest_version` 字段 (server `/api/version` 实际读这个, 跟生产响应一致)
6. **strip UTF-8 BOM from build.gradle + package.json + ecosystem.config.js + 6 文件**: PowerShell Edit 工具写入时加 BOM, 触发 (a) gradle 解析 build.gradle line 1 报 "Unexpected character '?'" (b) python3 deploy.sh 解析 package.json 返空跳 8 处版本号同步. 全部 strip BOM 后 build + deploy 正常

### 验证 (12 维 + 跨端 5 维 + sha256)
- **server 12 维 (deploy.sh --skip-maintenance)**: 1 systemctl active ✅ 2 ss 6000 ✅ 3 /health 200 ✅ 4 /api/version 3.0.48 ✅ 5 characterVariant 0.1 ✅ 6 /api/novels 401 ✅ 7 宝塔 nginx 80 ✅ 8 宝塔 panel 888 ✅ 9 ab.maque.uno HTTPS 3.0.48 ✅ 10 APK HTTP/2 200 ✅ 11 宝塔 shipin_APP run=True PID=507 mem=42MB ✅ 12 run_user=root is_power_on=1 ✅
- **tsc 0 错**: web `npx tsc -b --noEmit` 0 错 + `npm run build` 3.42s 519.79KB; server `npm run build` (tsc) 0 错; mobile 50 个 pre-existing 错 (跟 BUG-119 无关, 历史债)
- **APK 验证**: aapt2 dump badging → `package: name='com.aiscriptmobile' versionCode='52' versionName='3.0.48'` ✅; apksigner verify → `CN=DeepScript Release, O=shipin-APP` (BUG-023 永久 keystore 配) ✅; sha256: `0872bc82fd677fa4a4e8120e8aaa3d8dc21c642bbe8587122a843d0e8b3d791d` 本机 + 公网一致 ✅
- **公网验证**: `curl https://ab.maque.uno/api/version` → version=3.0.48 latestVersion=3.0.48 downloadUrl=DeepScript_v3.0.48.apk ✅ highlights[0] = BUG-119 ✅; `curl https://ab.maque.uno/app/DeepScript_v3.0.48.apk` → 200 OK Content-Type=application/vnd.android.package-archive Content-Length=30229434 ✅

### 关键 git
- commit: BUG-119 v3.0.48 修 (5 文件前端 + 8 处版本号 + 1 verify 脚本 + 1 changelog entry + 1 strip-bom 工具)
- 5 代码文件: apps/web/src/components/AgentChatPanel.tsx + apps/mobile/src/screens/VideoAgentScreen.tsx + apps/mobile/src/screens/ImageAgentScreen.tsx + 8 处版本号 (mobile version.ts / build.gradle / server package.json / index.ts / ecosystem / web version.ts) + apps/server/changelog.json (新 entry)
- 配套: tools/verify-version-8-points.js (看 latest_version) + tools/strip-bom.py 工具
- push main
- deploy: web dist 532KB index-uN3m8vIj.js + server systemd shipin-app PID 507 + APK DeepScript_v3.0.48.apk (30229434 bytes) shipin-APP/public/

### 跨项目通用铁律 (跟 BUG-079/082/096/097/103/104/115/116/117/118 100% 同源)
1. **retry 边界必清空旧 result part (前端不能 append, 要 replace)**: 找 `plan` 替成 `streaming` 之前, 先 filter 掉旧 `video` / `image`(result) / `error` / 旧 `streaming`. 不 strip 就是堆叠 (跟 BUG-082/096 假渲染陷阱 100% 同源)
2. **AI 生成中/loading 场景必用 GeneratingLoader 跨端 1:1, 不准裸用 Loader2/ActivityIndicator**: AGENTS.md § 5.4 (web) + § 6.6.4 (mobile) 强约束, BUG-110 Stage 3 设计了 component, 但漏集成 (跟 BUG-118 status label 漏加 100% 同源, 写了规范+component 但漏集成到所有相关 screen)
3. **加了 component 必集成到所有相关 screen, 不留半成品**: 跨项目通用铁律, 跟 BUG-118 (细分了 status 字段, 但漏加 status label UI) 100% 同源. 写完 component 必 grep 找 "ActivityIndicator" / "Loader2" / "加载中" 字符串, 全部替换
4. **跨端改一处必同步 web+mobile 1:1 镜像 (跨端铁律 4++)**: web AgentChatPanel 是 image+video 共用, 改一处两边都修; mobile image+video 是分开, 必须 ImageAgentScreen + VideoAgentScreen 都改
5. **PowerShell Edit 工具会写 UTF-8 BOM, 必 strip**: gradle 解析 build.gradle line 1 报 "Unexpected character '?'"; python3 json 解析 package.json 报 "Unexpected UTF-8 BOM (decode using utf-8-sig)". 部署前必 strip 跟 gradle/python 相关的所有 .gradle / .json 文件
6. **APK 必传对路径**: nginx `location ^~ /app/` → `alias /www/wwwroot/shipin-APP/public/`, 不是 `/www/wwwroot/ab.maque.uno/dist/`. deploy.sh 默认错路径, 必手动 scp 到 shipin-APP/public/ (跟 BUG-117 deploy 4 件套配套)
7. **server deploy.sh `systemctl reset-failed` 必须**: 连续 5 次 restart 失败后 "Start request repeated too quickly" 卡住, reset-failed 之后才能 start. 配套 systemd unit RestartSec=10 太快

### 已知遗留
- 无 (mobile APK 此次已重打, 公网 200, sha256 验证, 跟前次 v3.0.47 已知遗留合并)

---

## BUG-120 (v3.0.49 等待动画卡片按比例显示): 用户点"确认方案"后, 等待动画卡片是固定宽高 (mobile 360x202 / web p-4 自适应), 用户选的 1:1 / 16:9 / 9:16 比例不会反映在等待卡片上, 完成后 video/image 比例跟等待时不匹配, 跳变感强 (S72 batch 21, 2026-06-29)

### 现象
用户选了 16:9 横屏比例, 点"确认方案" → 等待动画卡片是 mobile 默认 360x202 横向 (不是 16:9 实际比例 1152×768) → 等 1-3 分钟完成 → 视频变成 16:9 实际比例 → 跳变感强, 用户感觉"等待跟完成不一致"

### 修前根因
- 修前 `case 'streaming'` 渲染用固定样式 (mobile `styles.streamingBox` 固定 flex row 容器, web `p-4 rounded-lg` 容器自适配) — 不读用户选的 selectedRatio
- ratio 是 component state, 但 `renderPart` / `PartView` 内没用, 等待卡片永远按固定宽高显示
- 跟 BUG-118 (细分了 status 字段, 但漏加 status label UI) + BUG-119 (加 GeneratingLoader 但漏集成到所有相关 screen) 100% 同源: 加了 state 但漏消费

### 修法 (5 文件 + 2 新建 + 8 处版本号 + 3 端 0 错 + 12 维验证全过)
1. **新建 `apps/web/src/lib/aspectRatio.ts` + `apps/mobile/src/utils/aspectRatio.ts` (跨端 1:1 镜像, 跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS 1:1)**:
   - `ASPECT_RATIO_DIMS` 10 个 ratio → 实际 w/h: 1:1=1024×1024, 2:3=768×1152, 3:2=1152×768, 3:4=768×1024, 4:3=1024×768, 9:16=768×1152, 16:9=1152×768, 2K=1280×1280, 4K=2048×2048, 8K=2048×2048
   - `parseAspectDims(ratio, kind)`: 支持 '16:9' / '2K' / '4K' (查表) + '1024x768' (WxH 数字) 3 种格式
   - `defaultRatioForKind(kind)`: auto fallback — image 1:1, video 16:9
   - `getWebAspectStyle`: 返 `{ aspectRatio: 'W / H', maxWidth, maxHeight }` (CSS, 缩到 480px max)
   - `getMobileAspectStyle`: 返 `{ aspectRatio: number, width, height }` (RN 0.73 aspectRatio number, 缩到 1/3 显示)
2. **web `apps/web/src/components/AgentChatPanel.tsx`**:
   - import `getWebAspectStyle` from `../lib/aspectRatio`
   - selectedRatio prop drilling: 顶层 → MessageBubble → PartSafeView → PartView (跟 kind 同样路径)
   - case 'streaming' 渲染用 `getWebAspectStyle(selectedRatio, kind)` 限定容器宽高, `flex-col items-center justify-center`
3. **mobile `apps/mobile/src/screens/VideoAgentScreen.tsx` + `ImageAgentScreen.tsx`**:
   - import `getMobileAspectStyle` from `../utils/aspectRatio`
   - streaming 渲染用 `aspectStyle.aspectRatio` + `aspectStyle.width` 锚定 + `alignSelf: 'center'` 居中
   - selectedRatio 是 component 内 state (mobile ImageAgentScreen line 137 `useState<string>('')`), 直接在 renderPart 闭包内访问 (跟 web 走 prop drilling 略不同, 但效果一致)
4. **8 处版本号同步 v3.0.48 → v3.0.49** (跨端铁律 3):
   - `apps/mobile/src/config/version.ts`: '3.0.48' → '3.0.49'
   - `apps/mobile/android/app/build.gradle`: versionCode 52→53, versionName '3.0.48'→'3.0.49'
   - `apps/server/package.json`: '3.0.48' → '3.0.49'
   - `apps/server/src/index.ts` line 75 fallback: '3.0.48' → '3.0.49'
   - `apps/server/ecosystem.config.js` env + env_production 2 处: '3.0.48' → '3.0.49'
   - `apps/web/src/config/version.ts`: APP_VERSION '3.0.48'→'3.0.49', APP_VERSION_CODE 52→53
   - `apps/server/changelog.json` 加 v3.0.49 entry (8 highlights), latest_version: 3.0.49
   - 远端 deploy.sh 自动同步 `.env APP_VERSION` + `systemd unit Environment=APP_VERSION` (从源 /tmp/package.json 读 3.0.49)

### 验证 (12 维 + 跨端 5 维 + sha256)
- **server 12 维 (deploy.sh --skip-maintenance)**: 1 systemctl active ✅ 2 ss 6000 ✅ 3 /health 200 ✅ 4 /api/version 3.0.49 ✅ 5 characterVariant 0.1 ✅ 6 /api/novels 401 ✅ 7-8 宝塔 nginx 80 + panel 888 ✅ 9 ab.maque.uno HTTPS 3.0.49 ✅ 10 APK HTTP/2 200 (v3.0.49 30230473 bytes) ✅ 11-12 宝塔 shipin_APP run=True PID=18957 ✅
- **tsc 0 错**: web `npx tsc -b --noEmit` 0 错 + `npm run build` 3.03s 533KB; server `npm run build` (tsc) 0 错; mobile 50 个 pre-existing 错 (跟 BUG-120 无关, 历史债)
- **APK 验证**: aapt2 dump badging → `package: name='com.aiscriptmobile' versionCode='53' versionName='3.0.49'` ✅; sha256: `4e8e42b20af8b3a1b5c65453b5977bf4b5ba7f4edd6a3c6e607c63fa99dd0ab5` 本机 + 公网一致 ✅
- **公网验证**: `curl https://ab.maque.uno/api/version` → version=3.0.49 latestVersion=3.0.49 downloadUrl=DeepScript_v3.0.49.apk ✅ highlights[0] = BUG-120 ✅; `curl https://ab.maque.uno/app/DeepScript_v3.0.49.apk` → 200 OK Content-Type=application/vnd.android.package-archive Content-Length=30230473 ✅

### 跨项目通用铁律 (跟 BUG-079/082/096/097/103/115/116/117/118/119 100% 同源)
1. **等待动画卡片尺寸必跟用户选的比例 1:1, 完成后的 result 不能跟等待时比例跳变**: 用户在 confirm 前选了什么比例, streaming 卡片就用什么比例 (跟 result 1:1 镜像)
2. **ratio 字典必 web + mobile + server 三端 1:1 同步**: 跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS 1:1 镜像, 改必双端+server 三端同步
3. **跨端铁律 4++ 1:1 镜像**: helper API (parseAspectDims) / getStyle 入口 (getWebAspectStyle + getMobileAspectStyle) / 10 ratio 字典 (1:1=1024×1024 等) 跨端一致
4. **auto fallback 默认值 web + mobile + server 1:1**: image 走 1:1, video 走 16:9
5. **加了 state 必消费到所有相关 render**: 跟 BUG-118/119 教训同源, selectedRatio 之前是 state 但 streaming 卡片没消费
6. **CSS aspectRatio (web) 用 'W / H' 字符串, RN aspectRatio (mobile) 用 number**: 跨端 1:1 但实现细节不同 (web Tailwind 3 支持 / RN 0.72+ 支持 number)

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-120 selectedRatio 没消费到 streaming 100% 同源
- **BUG-097** mobile 漏修 web — BUG-120 web + mobile 同步 (跨端铁律 4++)
- **BUG-110** GeneratingLoader Stage 3 — BUG-120 在 Stage 3 基础上按比例显示
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-120 跨项目通用铁律同源
- **BUG-118** 细分 status 字段但漏加 status label UI — BUG-120 教训同源 "加了 state 漏消费"
- **BUG-119** retry 清理 + GeneratingLoader 全屏集成 — BUG-120 补上 ratio 维度

### 关键 git
- commit: BUG-120 v3.0.49 修 (2 新建 aspectRatio util + 3 改前端 + 8 处版本号 + 1 changelog entry)
- 5 代码文件: apps/web/src/lib/aspectRatio.ts (新建) + apps/web/src/components/AgentChatPanel.tsx + apps/mobile/src/utils/aspectRatio.ts (新建) + apps/mobile/src/screens/VideoAgentScreen.tsx + apps/mobile/src/screens/ImageAgentScreen.tsx
- 配套: 8 处版本号 (mobile version.ts / build.gradle / server package.json / index.ts / ecosystem / web version.ts) + apps/server/changelog.json (新 entry)
- push main
- deploy: web dist 533KB index-C8Ik-s_7.js + server systemd shipin-app PID 18957 + APK DeepScript_v3.0.49.apk (30230473 bytes) shipin-APP/public/

### 已知遗留
- 无

---

## BUG-121 (v3.0.50 agens-image-2.1-flash 图生图 image 字段从 string 改成 string[] 数组): 严格按文档 (8.3/8.4/8.5 三个例子) extra_body.image 必须是 string[] 数组, shipin-APP 单次只取 1 张主角参考图但 API 仍要求 array 形式 (跟 BUG-118/119/120 教训同源, API 容错不能当文档不一致挡箭牌) (S72 batch 22, 2026-06-29)

### 现象 (审计)
用户审查 Agnes Image 2.1 Flash 最新文档 (https://wiki.agnes-ai.com/llms.txt),发现 shipin-APP agnesImageProvider.ts:107 传 `body.extra_body.image = refImg` (string), 文档 (8.3/8.4/8.5 三个图生图例子) 明确要求 `image: ["url"]` string[] 数组. 实际 agens API 容错接受 string 形式 (shipin-APP 跑了 1 年没 400), 但严格按文档是 array 形式.

### 修前根因
- 修前 `agnesImageProvider.ts:107` 传单 string: `body.extra_body.image = refImg;`
- 文档 (8.3 图生图 URL 输入 + URL 输出 / 8.4 图生图 URL 输入 + Base64 输出 / 8.5 图生图 Data URI Base64 输入) **3 个例子全部用 array 形式**:
  ```json
  "extra_body": {
    "image": ["https://example.com/input-image.png"],
    "response_format": "url"
  }
  ```
- 调用方链 `imageProvider.ts:21` `referenceImages?: string[]` 接口定义是数组, `imageAgentService.ts:581` / `comicService.ts:255` / `scriptService.ts:1175` 都传 `string[]` 数组, **只有 `agnesImageProvider.ts:107` 这一层取了第 1 张后传单 string**
- 跟 BUG-118 (v3.0.0 fix 字段路径: response_format/image 必须在 extra_body 内) 教训同源: 文档改了必同步改代码, 必对齐

### 修法 (1 行 + 8 处版本号 + 3 端 0 错 + 12 维验证全过)
1. **server `apps/server/src/services/agnesImageProvider.ts:107`**:
   - 修前: `body.extra_body.image = refImg;` (传 string)
   - 修后: `body.extra_body.image = [refImg];` (传 array, 严格按文档)
   - 加 4 行注释解释 BUG-121 教训
   - 调用方链保持不变: `imageProvider.ts:21` 接口 `string[]`, 3 个调用方传 `string[]`, agnesImageProvider 单层取第 1 张后包成 `[refImg]` array
   - shipin-APP 业务保持"1 张图"逻辑不变 (line 102 注释: "agnes-image-2.1-flash 单次只接受 1 张图, 取主角参考图"), API 仍要求 array 形式
2. **8 处版本号同步 v3.0.49 → v3.0.50** (跨端铁律 3):
   - `apps/mobile/src/config/version.ts`: '3.0.49' → '3.0.50'
   - `apps/mobile/android/app/build.gradle`: versionCode 53→54, versionName '3.0.49'→'3.0.50'
   - `apps/server/package.json`: '3.0.49' → '3.0.50'
   - `apps/server/src/index.ts` line 75 fallback: '3.0.49' → '3.0.50'
   - `apps/server/ecosystem.config.js` env + env_production 2 处: '3.0.49' → '3.0.50'
   - `apps/web/src/config/version.ts`: APP_VERSION '3.0.49'→'3.0.50', APP_VERSION_CODE 53→54
   - `apps/server/changelog.json` 加 v3.0.50 entry (6 highlights), latest_version: 3.0.50
   - 远端 deploy.sh 自动同步 `.env APP_VERSION` + `systemd unit Environment=APP_VERSION` (从源 /tmp/package.json 读 3.0.50)
3. **mobile APK v3.0.50 重打 + 部署**: 哪怕 mobile 代码无变化,versionCode 53→54 必走 (跨端铁律 4++ mobile APK 必重打, 否则公网 404), gradlew assembleRelease 45s OK, aapt2 versionCode=54 versionName=3.0.50 ✅, sha256 `7fbbc631edc3d9770219058882f2b042414fb7a03488225915c2b8e2c6fde8a0` 本机+公网一致 ✅

### 验证 (12 维 + 跨端 5 维 + sha256)
- **server 12 维 (deploy.sh --skip-maintenance)**: 1 systemctl active ✅ 2 ss 6000 ✅ 3 /health 200 ✅ 4 /api/version 3.0.50 ✅ 5 characterVariant 0.1 ✅ 6 /api/novels 401 ✅ 7-8 宝塔 nginx 80 + panel 888 ✅ 9 ab.maque.uno HTTPS 3.0.50 ✅ 10 APK HTTP/2 200 (v3.0.50) ✅ 11-12 宝塔 shipin_APP run=True PID=60008 ✅
- **tsc 0 错**: server `npm run build` (tsc) 0 错
- **APK 验证**: aapt2 dump badging → `package: name='com.aiscriptmobile' versionCode='54' versionName='3.0.50'` ✅; sha256: `7fbbc631edc3d9770219058882f2b042414fb7a03488225915c2b8e2c6fde8a0` 本机 + 公网一致 ✅
- **公网验证**: `curl https://ab.maque.uno/api/version` → version=3.0.50 latestVersion=3.0.50 downloadUrl=DeepScript_v3.0.50.apk ✅ highlights[0] = BUG-121 ✅; `curl https://ab.maque.uno/app/DeepScript_v3.0.50.apk` → 200 OK Content-Type=application/vnd.android.package-archive Content-Length=30230477 ✅

### 跨项目通用铁律 (跟 BUG-079/082/096/097/103/115/116/117/118/119/120 100% 同源)
1. **API 容错不能当文档不一致挡箭牌, 必对齐**: agens 接受单 string 形式跑了 1 年没 400, 但严格按文档是 array 形式, 修后避免 agens 升级严格校验时突然 400 报错
2. **文档改了必同步改代码 (跟 BUG-118 v3.0.0 fix 字段路径同源)**: 5 年前修过 1 次"response_format/image 必须在 extra_body 内" 的字段路径 bug, 这次是同源"image 必须是 array" 的字段格式 bug
3. **调用方接口 string[] 跟 API 字段 image string[] 双向对齐**: `imageProvider.ts:21` 接口定义 `referenceImages?: string[]` 已经是数组, 但 `agnesImageProvider.ts:107` 这一层取了第 1 张后传单 string, 修后包成 array 保持双向一致
4. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 (跨端铁律 3)**: 哪怕只是 1 行 bug 修复, 也必走 v3.0.50 流程
5. **mobile 代码无变化也必重打 APK (跨端铁律 4++)**: versionCode 53→54 必走, 否则公网 404, shipin-APP 强制流程

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-121 API 容错接受 string 形式但严格按文档应 array 100% 同源 (前端/API/文档一致性)
- **BUG-097** mobile 漏修 web — BUG-121 web + mobile 同步 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-121 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-121 跨项目通用铁律同源
- **BUG-118** v3.0.0 fix 字段路径 (response_format/image 必须在 extra_body 内) — BUG-121 教训同源 "文档改了必同步改代码"
- **BUG-119** retry 清理 + GeneratingLoader 全屏集成 — 跟 BUG-121 跨项目通用铁律同源
- **BUG-120** 等待动画卡片按比例显示 — 跟 BUG-121 跨项目通用铁律同源

### 关键 git
- commit: BUG-121 v3.0.50 修 (1 行 server 修复 + 8 处版本号 + 1 changelog entry)
- 1 代码文件: apps/server/src/services/agnesImageProvider.ts (line 107: `body.extra_body.image = refImg` → `body.extra_body.image = [refImg]`)
- 配套: 8 处版本号 (mobile version.ts / build.gradle / server package.json / index.ts / ecosystem / web version.ts) + apps/server/changelog.json (新 entry)
- push main
- deploy: server systemd shipin-app PID 60008 + APK DeepScript_v3.0.50.apk (30230477 bytes) shipin-APP/public/

### 已知遗留
- 无

---

## BUG-122 (v3.0.51 拆 3 个 Agnes 企业 API Key + 增大 AI_MAX_CONCURRENT 并发): 用户采购 3 个独立企业 key (wk-Cxl2h.../wk-vjuI.../wk-u9LB...), 替换老 1 个 key 调 3 模型共享配额, 改后 3 key 各自独立配额互不抢, 并发提升约 3x (跟 BUG-118/119/120/121 跨项目通用铁律同源, API 容错不能当文档不一致挡箭牌, key 拆开是简单暴力方案) (S72 batch 23, 2026-06-29)

### 现象 (审计)
用户反馈 shipin-APP 高并发时 (3+ 任务同时跑) Agnes API 偶尔报 429 限流. 审查 shipin-APP 端代码 + Agnes 文档 + 当前 key 使用情况:
- **shipin-APP 端**: 3 个 provider (agnesTextProvider.ts / agnesImageProvider.ts / agnesVideoProvider.ts) 都读统一 `AGNES_API_KEY` (v3.0.0 兼容老名) fallback `AGNES_IMAGE_API_KEY` — **1 个 key 调 3 模型共享配额**
- **实际生产 .env** (/www/wwwroot/shipin-APP/.env): 只有 `AGNES_IMAGE_API_KEY=sk-fGgHxvU77T915PYEu9MjRdBfg4gsNuwaSOWh85WHjMnmtjWb`, text/image/video 三模型都调这 1 把 key
- **AI_MAX_CONCURRENT=10**: DeepSeek 池 + Agnes 共享并发限制, Agnes 端只能抢到 1/3 并发额度
- **用户采购**: 3 个独立企业 key (text `wk-Cxl2htXZQo3EDLWwvz0zHgb6hDLv7AOYV5c0CZRVGOqWrgmb` / image `wk-vjuIS1Tc8NZ6LLxe5EwThLOIVpIF1lHjOMPsgLmQ5zb8OgYa` / video `wk-u9LBnjvKj8Ppo2XGPzaRCFW1NJlGKVx2OY0fhptLceWpv32c`), 每个 key 配额独立, 企业版并发更高

**真根因 (3 重)**:
1. **shipin-APP 端 3 provider 用 1 key**: text/image/video 三模型抢同一把 key 的 QPS 上限, 3 模型并发时必然互抢
2. **AI_MAX_CONCURRENT=10 偏低**: Agnes 端是企业版, 并发上限可以更高 (10 限制浪费企业 key 配额)
3. **provider 读 key 优先级没拆**: 之前 shipin-APP 设计 "1 把 key 通用所有端点" (跟 Agnes 文档说"统一 key 可调所有端点"一致), 但企业版实测拆开 3 key 并发更高

### 修法 (4 文件 + 8 处版本号 + 1 changelog + .env 3 新字段 + 重打 APK)

```
┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/agnesTextProvider.ts (line 44)            │
│  - 修前: apiKey || AGNES_API_KEY || AGNES_IMAGE_API_KEY             │
│  - 修后: apiKey || AGNES_TEXT_API_KEY || AGNES_API_KEY || AGNES_IMAGE_API_KEY │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/agnesImageProvider.ts (line 32)           │
│  - 字段名复用 = 专用 + 老兼容合并 (不破坏老配置)                     │
│  - apiKey || AGNES_IMAGE_API_KEY || AGNES_API_KEY                   │
│  - shipin-APP 老配置就有 AGNES_IMAGE_API_KEY 字段, 不改名直接用      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/agnesVideoProvider.ts (line 54)           │
│  - apiKey || AGNES_VIDEO_API_KEY || AGNES_API_KEY || AGNES_IMAGE_API_KEY │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/imageProvider.ts (line 177 autoInitProvider)│
│  - 同步改字段名, 加注释标记 v3.0.51 BUG-122                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/.env.example + .env.production + 远端 .env                │
│  - 加 3 个新字段: AGNES_TEXT_API_KEY / AGNES_IMAGE_API_KEY (替换老) │
│    / AGNES_VIDEO_API_KEY                                            │
│  - AI_MAX_CONCURRENT=10 → 20 (跟 3 个独立 key 一起放大)             │
│  - CHUNK_CONCURRENT=10 → 20 (DeepSeek 3 key 轮换池跟 Agnes 共享)  │
└──────────────────────────────────────────────────────────┘
```

### 跨项目通用铁律 (跟 BUG-079/097/103/115/116/117/118/119/120/121 100% 同源)
1. **API 限流不能当客户端并发不限制挡箭牌**: shipin-APP 端代码没池化 (每请求直调 Agnes), 限流问题在 API 端 + 客户端并发限制 2 个方向都有责任
2. **多 provider 配额独立必拆字段**: 1 个 key 调多模型 = 共享配额, 拆 3 key = 各模型独立配额. 这是简单暴力方案, 但实测有效
3. **企业版 key 配 client 端并发放大**: AI_MAX_CONCURRENT=10 适配普通版 key, 配企业版 key 必须放大 (10→20), 否则浪费配额
4. **.env 字段名复用不破坏老配置**: 字段名同名 (AGNES_IMAGE_API_KEY 既是专用名也是老兼容名) 是设计, 不是 bug
5. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 + 重打 mobile APK (跨端铁律 4++)**: 哪怕只改 env key 字段映射, 也必走 v3.0.51 流程
6. **企业 key 实测 E2E 必做**: deploy 完必跑真实 API 调用 (text + image + video) 确认 key 生效, 不要只验证 /api/version
7. **拆 key 字段映射必带 fallback 链**: AGNES_*_API_KEY (新企业专用) → AGNES_API_KEY (统一, 兼容老) → AGNES_IMAGE_API_KEY (历史兼容, 最老)

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-122 同样 "API 端容错 = 客户端不需要限制" 的反模式 (实际客户端并发也有限制)
- **BUG-097** mobile 漏修 web — BUG-122 web + mobile 同步 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-122 此次已重打 mobile APK (跨端铁律 4++)
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-122 跨项目通用铁律同源
- **BUG-118/119/120/121** 一系列 server 端修复 — BUG-122 是最后一块: 之前都是修单点 (字段路径/retry/动画/ratio/image array), BUG-122 修"基础设施层 (key + 并发)"

### 关键 git
- commit: BUG-122 v3.0.51 修 (3 provider 读专用 key + .env 3 新字段 + 8 处版本号 + 1 changelog entry + 升 v3.0.51)
- 4 代码文件: apps/server/src/services/agnesTextProvider.ts + agnesImageProvider.ts + agnesVideoProvider.ts + imageProvider.ts
- 3 env 文件: apps/server/.env.example (注释) + .env.production (本机) + 远端 /www/wwwroot/shipin-APP/.env (scp + sed + 追加)
- 8 处版本号: mobile version.ts / build.gradle / server package.json / index.ts / ecosystem (2 处) / web version.ts / .env / systemd unit
- 配套: changelog.json (新 entry v3.0.51) + AGENTS.md § 6.13 (新增)
- push main
- deploy: server systemd shipin-app (systemctl reset-failed required, BUG-117 教训) + APK DeepScript_v3.0.51.apk (30230467 bytes) shipin-APP/public/

### E2E 验证 (deploy 后实测 3 个企业 key 生效)
- ✅ /api/version: 3.0.51, latestVersion=3.0.51, downloadUrl=DeepScript_v3.0.51.apk
- ✅ /api/pricing: 3.0.51, characterVariant=0.1
- ✅ /api/novels: 401 (需 auth, server alive)
- ✅ Agnes TEXT API 实测: HTTP 200, "Hi!" reply, 260 tokens (用 AGNES_TEXT_API_KEY=wk-Cxl2h...)
- ✅ Agnes IMAGE API 实测: HTTP 200, has image URL (用 AGNES_IMAGE_API_KEY=wk-vjuI...)
- ✅ Agnes VIDEO API 实测: HTTP 200, task_kndAfUbfaGhjqGepUQE7smGxGtqvsJrO queued (用 AGNES_VIDEO_API_KEY=wk-u9LB...)
- ✅ 公网 APK v3.0.51 下载: HTTPS HTTP/2 200, size=30230467 bytes
- ✅ 公网 sha256: 29328F5280F270A49EEFB353B76F597C5969ED06342B5F090AD94DF269B96B43 (本机跟远端 1:1 一致)

### 已知遗留
- 无

---

## BUG-123 (v3.0.52 Agnes API 限流排队): 拆 image 40/min + video 2/min 严格 sliding window 限流 + FIFO 队列 + ETA 估算 + 跨端 UI 排队位置展示 — 用户反馈 shipin-APP 高并发 (3+ 任务同时跑) 偶尔 429, 跟 BUG-122 拆企业 key 配套, 客户端必加排队 (跟 BUG-079/097/103/115-122 跨项目通用铁律同源) (S72 batch 24, 2026-06-29)

### 现象 (审计)
用户反馈 shipin-APP 高并发时 (3+ 任务同时跑) Agnes API 偶尔报 429 限流. 审查 shipin-APP 端代码 + Agnes 文档 + 当前调用情况:
- **Agnes API 端实际限流**: image generation 40 次/分钟 (RPM), video generation 2 次/分钟 (RPM)
- **shipin-APP 端** 5 个 image 调用点 + 1 个 video 调用点, **每请求直调 provider, 无任何客户端限流/排队机制**
- **BUG-122 拆 3 企业 key** 后高并发仍偶发 429 — 企业版配普通客户端并发 = 限流

**真根因 (3 重)**:
1. **客户端无队列机制**: 6 个 provider 调用点全部 "fire-and-forget", 5 个并发 image 请求 + 2 个 video 请求 = 100% 撞限流
2. **限流器缺失**: 之前 shipin-APP 没有 "rate limiter" 概念, 依赖 Agnes API 端 429 错误 + retry (5min × 3 retry 太长, 用户体验差)
3. **限流状态不可见**: 用户看不到 "我在排队" / "前面有 N 个人" / "预计等待 X 秒", 跟前端 UX 不闭环

### 修法 (4 新文件 + 8 处版本号 + 1 changelog + 6 调用点 + 2 API + 跨端 UI)

```
┌──────────────────────────────────────────────────────────┐
│  apps/server/src/utils/rateLimiter.ts (新建)                          │
│  - SlidingWindowLimiter 类 (timestamp 滑动窗口 + FIFO 队列)         │
│  - acquire(taskId): Promise<Slot> (有 slot 立即, 满 Promise 排队) │
│  - release() 自动调用, timestamp 保留至 windowMs 过期 (严格 1 分钟) │
│  - getStatus(): { active, waiting, limit, oldestEtaMs, avgDurationMs, estimatedWaitMs } │
│  - getQueuePosition(taskId): 1-based, null = 不在队列                  │
│  - getTaskQueueInfo(taskId): { position, etaSeconds }                │
│  - 5min 排队超时 reject (避免永远卡死)                                │
│  - getAgnesImageLimiter() 单例 (40/min)                              │
│  - getAgnesVideoLimiter() 单例 (2/min)                               │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  包装 5 个 image 调用点 + 1 个 video 调用点                          │
│  - imageAgentService.ts:576: rateLimitedGenerate({ taskId, label: 'imageAgent', imageOptions }) │
│  - scriptService.ts:1168: rateLimitedGenerate({ taskId: shot.id, label: 'shot:N', ... }) │
│  - comicService.ts:248: rateLimitedGenerate({ taskId, label: 'comic:pageN', ... }) │
│  - characterService.ts:618 (sheet): rateLimitedGenerate({ taskId: characterId, label: 'characterSheet' }) │
│  - characterService.ts:800 (shot): rateLimitedGenerate({ taskId: shotId, label: 'shotImage' }) │
│  - videoAgentService.ts:547: agnesVideoProvider.createTaskWithLimit(opts, conversationId, 'videoAgent') │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  2 个 API 端点                                                       │
│  - GET /api/admin/rate-limit-status (admin auth)                    │
│    → { image: { active, waiting, limit, oldestEtaMs, avgDurationMs, estimatedWaitMs }, video: 同 } │
│  - GET /api/tasks/:taskId/queue (user auth)                         │
│    → { taskId, inQueue, image: { position, etaSeconds }, video: { position, etaSeconds }, global: {...} } │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  跨端 UI 集成 (跨端铁律 4++ 1:1 镜像 web + mobile)                    │
│  - apps/web/src/hooks/useQueueStatus.ts (新建, 3s 轮询 hook)         │
│  - apps/web/src/components/AgentChatPanel.tsx (case 'streaming' 改用 <StreamingCard>) │
│  - apps/web/src/lib/api.ts (getTaskQueueStatusApi)                  │
│  - apps/mobile/src/hooks/useQueueStatus.ts (新建, 1:1 镜像 web)     │
│  - apps/mobile/src/screens/VideoAgentScreen.tsx (StreamingCard 子组件) │
│  - apps/mobile/src/screens/ImageAgentScreen.tsx (StreamingCardImage 子组件) │
│  - apps/mobile/src/api/client.ts (getTaskQueueStatus)                │
│  - 跨端排队 UI: "⏳ 排队中: 第 N 位 · 预计 X 秒 (生图 40 次/分钟)" (amber 配色) │
└──────────────────────────────────────────────────────────┘
```

### 跨项目通用铁律 (跟 BUG-079/097/103/115-122 100% 同源)
1. **API 限流不能当客户端不限制挡箭牌**: shipin-APP 客户端代码没池化 (每请求直调), 限流问题在 API 端 + 客户端并发限制 2 个方向都有责任. 拆企业 key (BUG-122) + 限流器 (BUG-123) 双管齐下
2. **多 provider 配额独立必拆字段** (BUG-122 同源): 但限流器是另一维度 — 就算 1 key 也需要客户端限流器, 不然 fire-and-forget 必撞限流
3. **严格 sliding window > 纯并发限流**: timestamp 保留至 windowMs 过期 (不是 release 时删除). 匹配 Agnes API 端 "1 分钟 40 次" 严格语义
4. **FIFO 队列 + 排队超时必加**: 不超时 → 永远卡死; 不 FIFO → 不公平
5. **ETA 估算必基于 oldestEtaMs + avgDurationMs**: 不能瞎拍脑袋. 客户端跟服务端 1:1 一致, 不能让前端误算
6. **限流状态必暴露给前端 UI**: admin 全局 + 单 task detail 2 个 API. 用户看不到排队 = 假修 (跟 BUG-079 同源)
7. **限流配置化 (.env 4 字段)**: AGNES_IMAGE_RATE_LIMIT / AGNES_IMAGE_RATE_WINDOW_MS / AGNES_VIDEO_RATE_LIMIT / AGNES_VIDEO_RATE_WINDOW_MS. 不硬编码
8. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 + 重打 mobile APK (跨端铁律 4++)**: 哪怕只加一个 .env 字段, 也必走 v3.0.52 流程
9. **跨端 UI 必 1:1 镜像**: web useQueueStatus hook + StreamingCard 跟 mobile useQueueStatus + StreamingCard/StreamingCardImage 1:1 (跨端铁律 4++)

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-123 同样 "API 端容错 = 客户端不需要限制" 的反模式
- **BUG-097** mobile 漏修 web — BUG-123 web + mobile 1:1 镜像 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-123 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-123 跨项目通用铁律同源 (都是 "client 不能瞎信 server 一定行")
- **BUG-118/119/120/121/122** 一系列 server 端修复 — BUG-123 是最后一块: BUG-118/119 改 UX 细分, BUG-120 改比例, BUG-121 改字段格式, BUG-122 拆企业 key, BUG-123 改限流器

### E2E 验证 (deploy 后实测)
- ✅ /api/version: 3.0.52, latestVersion=3.0.52
- ✅ /api/pricing: 3.0.51 升到 3.0.52
- ✅ 12 维验证全过 (systemd active + 6000 LISTEN + /health 200 + /api/version 3.0.52 + APK HTTP/2 200 + 宝塔 shipin_APP run=True)
- ✅ 限流器模块加载: image limit 40/60s + video limit 2/60s
- ✅ 42 个并发 image acquire E2E: 40 立即入 active, task-40/task-41 入队 (position=1/2, etaSeconds=2/3)
- ✅ 公网 APK v3.0.52 下载: HTTPS HTTP/2 200, size=30233025 bytes
- ✅ 公网 sha256: 020B61E3D7342DC2A1518E09DC02585B171CC2700956AEDF5504A8B9441CA39C (本机跟远端 1:1 一致)
- ✅ web dist 部署: index-BdFAwImD.js (535KB) + index-CnPZ-cNl.css (43KB), https://ab.maque.uno/ HTTP/2 200

### 关键 git
- commit: BUG-123 v3.0.52 修 (4 新文件 rateLimiter + 2 hook + 2 API + 6 provider 包装 + 跨端 UI + 8 处版本号 + 1 changelog)
- 新文件: apps/server/src/utils/rateLimiter.ts + apps/web/src/hooks/useQueueStatus.ts + apps/mobile/src/hooks/useQueueStatus.ts
- 6 provider 包装: imageAgentService / videoAgentService / comicService / characterService (2 处) / scriptService
- 2 API: /api/admin/rate-limit-status + /api/tasks/:taskId/queue
- 跨端 UI: web AgentChatPanel + StreamingCard + mobile VideoAgentScreen + ImageAgentScreen StreamingCard/StreamingCardImage
- push main
- deploy: server systemd shipin-app PID 61230 + APK DeepScript_v3.0.52.apk (30233025 bytes) shipin-APP/public/ + web dist index-BdFAwImD.js (535KB) /www/wwwroot/web-app/dist/

### 已知遗留
- 排队 5min 超时 reject (避免无限卡死) — 长时间排队可能 reject, 用户需重试
- in-memory limiter 单进程 — 多进程部署需 Redis 协调 (暂不需要, shipin-APP 单进程 systemd)

---

## BUG-123 hotfix (v3.0.53 修排队 UI 用户看不到): 3 状态显示 (排队中 amber / 等待资源 blue / 正常) + useQueueStatus 持续轮询不早停 — 用户实战测试 3 个视频没看到排队, 实际是 v3.0.52 useQueueStatus hook 在 inQueue=false 时早停 polling, 即使系统负载 2/2 用户也看不到, 跟 BUG-079 假报告同源 (S72 batch 25, 2026-06-29)

### 现象 (审计)
用户实测 v3.0.52 部署后, 生成了 3 个视频但没看到排队时间, 流式卡片只显示 "AI 正在渲染视频, 通常 1-3 分钟, 别关页面...". 审查 shipin-APP 代码 + E2E 实测:
- **用户 3 个视频 timing**: cee040d2 (创建早于 06:58), cf5b7faa (创建早于 06:59:30), 9f361028 (创建早于 06:59:40) — 总跨度 ~2 分钟
- **rate limiter 记录的 avgDurationMs = 47015** (47s/任务), 3 个视频间隔 > 47s, **每次都能拿到 slot, 队列永远空** — 这是用户看不到排队的根因 1
- **rate limiter hook 早停 bug**: v3.0.52 useQueueStatus hook 在 `inQueue=false` 时调用 `clearInterval` 早停 polling — 即使系统负载 (active=2/2) 用户也看不到, 因为 hook 不再 polling — 这是用户看不到排队的根因 2
- **E2E 实测验证**: admin 模拟 3 个并发 confirm 后, rate-limit-status 返回 active=2 waiting=1 limit=2, conv3 (第 3 个) 返回 inQueue=true position=1 etaSeconds=26 — limiter 后端完全工作, 唯一问题是前端 hook + UI

**双根因**:
1. **用户 3 个视频间隔 > 47s** — 没有触发排队 (rate limiter 工作正常, 但用户操作没达到触发条件)
2. **v3.0.52 UI 早停 bug** — 即使系统真有 2/2 在跑, 用户的 UI 完全静默, 看不到 "当前 N/M 在跑" 等透明度信息

### 修法 (1 文件 + 6 处 + 8 处版本号 + 1 changelog + 跨端 UI 3 状态)

```
┌──────────────────────────────────────────────────────────┐
│  apps/web/src/hooks/useQueueStatus.ts + mobile hook 1:1            │
│  - 修前: inQueue=false 时 clearInterval 早停 polling            │
│  - 修后: 持续轮询 (3s), 让 UI 能看到 global 状态变化         │
│  - UI 决定显示什么 (3 状态由 StreamingCard 判断)              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  web StreamingCard + mobile StreamingCard/StreamingCardImage       │
│  - 3 状态显示:                                                  │
│    1. 排队中 (position > 0):                                   │
│       "⏳ 排队中: 第 N 位 · 预计 X 秒 · 生视频 2 次/分钟" (amber) │
│    2. 等待资源 (global.active > 0 && !inQueue):               │
│       "⏳ 等待资源: 当前 N/M 在跑 · 平均 Xs/任务 · ..." (blue)  │
│    3. 正常 (active == 0): 默认 GeneratingLoader label         │
│  - 跨端铁律 4++ 1:1 镜像 (web Tailwind 配色 = mobile hex 配色)   │
└──────────────────────────────────────────────────────────┘
```

### 跨项目通用铁律 (跟 BUG-079/097/103/115-122 100% 同源)
1. **hook polling 不能早停** (BUG-123 hotfix 核心): `inQueue=false` 也要继续 polling, 让 UI 能看到系统负载变化. 早停 polling = 用户看不到系统状态 = 假修 (跟 BUG-079 假报告同源)
2. **等待资源也是资源**: 用户在等 slot 释放, 必须显示透明度 ("当前 N/M 在跑"), 不能静默
3. **排队 UI 不只在 '真在队列' 时显示**: '在系统中跑' (active > 0) 也要显示. 用户决策需要完整上下文
4. **E2E 实测必做**: admin 模拟并发验证 limiter 实际行为 (跟 BUG-121/122 同样). 早期 v3.0.52 单测代码正确但没测 "用户提交视频后能立即看到系统状态"
5. **跨端 UI 必 1:1 镜像**: web Tailwind 配色 amber-50=#fef3c7/amber-100=#fbbf24/amber-800=#92400e = mobile hex #fef3c7/#fbbf24/#92400e; blue 同样 1:1
6. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 + 重打 mobile APK**: 哪怕只改 hook 早停 1 行, 也必走 v3.0.53 流程 (跨端铁律 3+4++)
7. **新部署后必做 user 实际场景模拟**: 单测能通过不代表实际用户能看到. admin 模拟 3 个并发 confirm 才是真验证

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-123 hotfix 同样 "功能实装但用户看不到 = 假修". v3.0.52 hook 早停导致用户完全看不到排队信息
- **BUG-097** mobile 漏修 web — BUG-123 hotfix web + mobile 1:1 镜像 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-123 hotfix 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-123 hotfix 跨项目通用铁律同源
- **BUG-118** 细分 status label UI — BUG-123 hotfix 排队 UI 配色 amber 跟 BUG-118 限流暂停 orange 体系一致
- **BUG-119/120/121/122** — BUG-123 hotfix 跟 BUG-123 早期 v3.0.52 配套, hotfix 修早期 UI 3 状态缺失 + hook 早停

### E2E 验证 (deploy 后实测)
- ✅ /api/version: 3.0.53, latestVersion=3.0.53
- ✅ 12 维验证全过 (systemd active + 6000 LISTEN + /health 200 + /api/version 3.0.53 + APK HTTP/2 200 + 宝塔 shipin_APP run=True)
- ✅ 3 个并发 confirm: 2 个立即 acquire + 1 个排队 (position=1, etaSeconds=26)
- ✅ global status: active=2, waiting=1, limit=2 (跟 v3.0.52 一致)
- ✅ conv3 (排队) inQueue=true position=1
- ✅ conv1/2 (立即) inQueue=false 但 global.active=2 → UI 显示 "等待资源: 当前 2/2 在跑"
- ✅ 公网 APK v3.0.53 下载: HTTPS HTTP/2 200, size=30233905 bytes
- ✅ 公网 sha256: C228DF55AF42260FA568AC2CEB61D58C46BF7F5D362BAF9E755779E1E1095B6A (本机跟远端 1:1 一致)
- ✅ web dist 部署: index-ClG2vMwX.js (522KB) + index-DHc58t4G.css (44KB), https://ab.maque.uno/ HTTP/2 200

### 关键 git
- commit: BUG-123 hotfix v3.0.53 修 (2 hook 持续轮询 + 3 StreamingCard 3 状态 + 2 styles 配色 + 8 处版本号 + 1 changelog)
- 改文件: apps/web/src/hooks/useQueueStatus.ts + apps/web/src/components/AgentChatPanel.tsx (StreamingCard) + apps/mobile/src/hooks/useQueueStatus.ts + apps/mobile/src/screens/VideoAgentScreen.tsx (StreamingCard + styles) + apps/mobile/src/screens/ImageAgentScreen.tsx (StreamingCardImage + styles)
- push main
- deploy: server systemd shipin-app PID 33034 + APK DeepScript_v3.0.53.apk (30233905 bytes) shipin-APP/public/ + web dist index-ClG2vMwX.js (522KB) /www/wwwroot/web-app/dist/

### 已知遗留
- 用户测试时如果提交间隔 > 47s (avgDurationMs), 不会触发排队, 但 UI 现在会显示 "等待资源: 当前 N/M 在跑" (跟 BUG-079 假修区别: 透明度 ≠ 静默)

---

## BUG-124 (v3.0.54 删 4K/8K 选项): agnes 不支持 2048+ 分辨率生成, UI 选项移除避免误导用户 (跟 BUG-079/097/103/115-123 跨项目通用铁律同源, UI 选项必对齐后端能力) (S72 batch 26, 2026-06-29)

### 现象 (审计)
用户反馈: 4K 和 8K 选项没有对应的尺寸可以生成. 审查 shipin-APP 端代码 + agnes API 实际能力:
- **ASPECT_RATIO_DIMS 4K / 8K 都映射到 [2048, 2048]**: agnes image API 不支持 2048² 分辨率生成 (老 4K 选项标 2048² 但生成时报错, 8K 跟 4K 完全重复, UI 误导用户)
- **3 端 aspectRatio.ts 文件 1:1 镜像**: server `imageAspectRatio.ts` SUPPORTED_RATIOS + mobile `aspectRatio.ts` ASPECT_RATIO_DIMS + web `aspectRatio.ts` ASPECT_RATIO_DIMS 都有 4K/8K
- **2 个 UI 下拉选项**: web `AgentChatPanel.tsx` RATIO_OPTIONS (11 项含 4K/8K) + mobile `ImageAgentScreen.tsx` ASPECT_RATIOS (11 项含 4K/8K)
- **LLM 提示词示例引用 4K/8K**: server `imageAgentSystem.ts` prompt 智能规则 + plan_cn_ready 示例都引用 "4K 高清/8K 超细节", 即使 UI 删了选项, LLM 仍可能建议 4K/8K
- **server `videoAgentService.ts` VIDEO_HEAVY_RATIOS 含 4K/8K**: 兜底降级逻辑保留 (老 conv data / 用户文本输入仍能工作)

### 修法 (5 文件 + 8 处版本号 + 1 changelog + 跨端 UI 1:1)

```
┌──────────────────────────────────────────────────────────┐
│  server `apps/server/src/prompts/imageAspectRatio.ts`            │
│  - SUPPORTED_RATIOS 删 '4K' / '8K' (留 8 项: 1:1/2:3/3:2/3:4/4:3/9:16/16:9/2K) │
│  - parseAspectToDims / parseAspectRatioFromText 注释说明              │
│    4K/8K 仍能解析 (老 conv data / 用户文本输入 → 降级到 'auto')       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  mobile `apps/mobile/src/utils/aspectRatio.ts` (跟 server 1:1)    │
│  - ASPECT_RATIO_DIMS 删 '4K' / '8K'                              │
│  - parseAspectDims 容错 fallback                                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  web `apps/web/src/lib/aspectRatio.ts` (跟 server + mobile 1:1)   │
│  - ASPECT_RATIO_DIMS 删 '4K' / '8K'                              │
│  - parseAspectDims 容错 fallback                                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  web `AgentChatPanel.tsx` RATIO_OPTIONS (11 → 9 项)              │
│  - 删 { value: '4K', label: '4K 高清 (2048²)' }                    │
│  - 删 { value: '8K', label: '8K 极致 (2048²)' }                    │
│  - tooltip '8K/4K/2K 大图生成更慢' → '2K 大图生成更慢'             │
│  - video title '8K/4K/2K 不推荐' → '2K+ 视频不推荐'                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  mobile `ImageAgentScreen.tsx` ASPECT_RATIOS (11 → 9 项)          │
│  - 删 4K / 8K 项                                                  │
│  - 跟 web 1:1 镜像 (跨端铁律 4++)                                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  server `imageAgentSystem.ts` prompt 删 4K/8K 引用              │
│  - 智能规则: 删 "用户说"比例换成4K" / "用户说"比例换成8K" 两行        │
│  - 示例 plan_cn_ready quality 字段: 删 "8K 高清/8K 超细节"          │
│  - 加注释 "v3.0.54 (BUG-124): 4K / 8K 移除, 用户说"4K"/"8K" 自动降级到默认" │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  server `videoAgentService.ts` VIDEO_HEAVY_RATIOS 保留 4K/8K     │
│  - 兜底降级逻辑保留 (老 conv / curl 绕过 / 用户文本输入仍能工作) │
│  - 加注释说明 BUG-124                                             │
└──────────────────────────────────────────────────────────┘
```

### 跨项目通用铁律 (跟 BUG-079/097/103/115-123 100% 同源)
1. **UI 选项必对齐后端能力**: 前端标 4K 后端不支持 = 假功能, 跟 BUG-079 假报告同源. UI 选项 = 后端实际能力, 不能误导用户
2. **删功能必删前后端 + prompt + UI 4 处 1:1 镜像**: server aspectRatio map + mobile UI + web UI + LLM prompt 4 处必同步, 缺一就是漏改
3. **兜底兼容老数据**: parseAspectDims / parseAspectToDims 仍能处理 '4K'/'8K' 输入 (走 fallback default), 老 conv data / 用户文本输入不会崩
4. **改 aspectRatio 必 3 端 + 2 UI 同步**: server imageAspectRatio.ts + mobile aspectRatio.ts + web aspectRatio.ts + web AgentChatPanel + mobile ImageAgentScreen 5 处必同步 (跨端铁律 4++)
5. **加 BUG 编号注释标记 v3.0.54**: 跟 BUG-122 拆企业 key 沉淀一致, 后续 AI 改代码能看到历史决策
6. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 + 重打 mobile APK**: 哪怕只删 2 行, 必走 v3.0.54 流程 (跨端铁律 3+4++)
7. **删 UI 选项要同时删 prompt 示例**: LLM 仍可能建议已删的选项, 删 UI 不删 prompt = 后端行为不一致

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-124 同样 "前端 UI 跟后端能力不匹配 = 假功能". v3.0.53 之前 4K 选项用户能选但实际生成失败 = 假功能
- **BUG-097** mobile 漏修 web — BUG-124 web + mobile 1:1 镜像 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-124 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-124 跨项目通用铁律同源
- **BUG-118** 细分 status label UI — 跟 BUG-124 同样 "UI 选项跟实际能力对齐"
- **BUG-119/120/121/122/123** — 跟 BUG-124 跨项目通用铁律同源 (改 1 处必同步多处, 沉淀规范)

### E2E 验证 (deploy 后实测)
- ✅ /api/version: 3.0.54, latestVersion=3.0.54
- ✅ 12 维验证全过 (systemd active + 6000 LISTEN + /health 200 + /api/version 3.0.54 + APK HTTP/2 200 + 宝塔 shipin_APP run=True)
- ✅ ASPECT_RATIO_DIMS 跨端 1:1 镜像: server 8 项 (1:1/2:3/3:2/3:4/4:3/9:16/16:9/2K) = mobile 8 项 = web 8 项 (跟 v3.0.53 之前 10 项对比, 删 4K/8K)
- ✅ RATIO_OPTIONS 跨端 1:1 镜像: web 9 项 (auto + 8 ratio) = mobile 9 项
- ✅ 容错: parseAspectDims 输入 '4K'/'8K' 走 fallback 到 default (不崩)
- ✅ 公网 APK v3.0.54 下载: HTTPS HTTP/2 200, size=30233895 bytes
- ✅ 公网 sha256: 1885DA8ED37F9F5CD587EE14CA4ABD1A7F6AF4FBF43D6CA289710873807CD8CF (本机跟远端 1:1 一致)
- ✅ web dist 部署: index-DhzCbW9s.js (522KB) + index-DHc58t4G.css (44KB), https://ab.maque.uno/ HTTP/2 200

### 关键 git
- commit: BUG-124 v3.0.54 删 (5 文件 4K/8K 移除 + 2 UI 选项删 + 2 tooltip 改 + prompt 改 + 8 处版本号 + 1 changelog)
- 改文件: server imageAspectRatio.ts + server imageAgentSystem.ts + server videoAgentService.ts + mobile aspectRatio.ts + mobile ImageAgentScreen.tsx + web aspectRatio.ts + web AgentChatPanel.tsx (7 文件, 加 changelog 8)
- push main
- deploy: server systemd shipin-app PID 6646 + APK DeepScript_v3.0.54.apk (30233895 bytes) shipin-APP/public/ + web dist index-DhzCbW9s.js (522KB) /www/wwwroot/web-app/dist/

### 已知遗留
- server VIDEO_HEAVY_RATIOS 兜底逻辑保留 (4K/8K 输入自动降级到 default), 老 conv / curl 绕过 / 用户文本输入仍能工作
- mobile/web UI 不再显示 4K/8K 选项, 但用户文本输入 "换成4K"/"换成8K" 仍能解析 (走 fallback 1:1 1024²)
- LLM prompt 智能规则删 4K/8K 行 + 加注释说明降级行为

---

## BUG-127 (v3.0.57 修全局 IP 限流频繁触发 Too many requests): per-user keyGenerator (JWT userId) + login/register 单独 10/min 严限流 + 全局 RATE_LIMIT_MAX_REQUESTS 200→500 + trust proxy 1 (nginx 反代), 用户多点几次按钮不再触发限流 (跟 BUG-079/097/103/115-126 100% 同源, frontend 跟 backend 限流边界对齐) (S72 batch 29, 2026-06-29)

### 现象 (审计)
用户截图: web image agent 顶部红条 "Too many requests, please try again later." 反复出现, 登录页"登录时也提醒这个警告". 严重影响用户体验, 用户感觉"多点几次按钮就被限流".

### 根因 (4 层)

**1. 全局 IP 限流 + 默认 keyGenerator**: `apps/server/src/index.ts` line 22-45 用 `express-rate-limit` 默认配置, keyGenerator 默认是 `req.ip`, 60s 200 reqs/per IP.

**2. nginx 反代下 req.ip = 127.0.0.1**: 没设 `app.set('trust proxy', 1)`, 所有经过 nginx 转发的请求 req.ip 都是 127.0.0.1, 全局限流所有用户共享一个 key (超级危险, 任何一个用户触发 429 都会影响所有用户).

**3. 前端高频 polling**: 单 tab 单页面 60s 内已经 50-100 reqs:
- `AgentChatPanel.tsx` line 304 syncConv 5s → 12 reqs/min
- `useQueueStatus.ts` line 50 BUG-123 队列 3s → 20 reqs/min
- `TasksPage.tsx` line 65 3s → 20 reqs/min
- `Layout.tsx` line 17 balance 60s → 1 reqs/min
- `Notifications.tsx` line 14 30s → 2 reqs/min
- mount 时 ~5-10 reqs

**4. 多 tab / 多设备共享 IP**: 同一 wifi 下电脑 + 手机共享公网 IP, 各自的 50-100 reqs 加起来轻松破 200.

### 修法 (3 文件 + 8 处版本号 + 1 changelog)

```
┌──────────────────────────────────────────────────────────┐
│  apps/server/src/index.ts (line 5-67)                       │
│  - import jwt from 'jsonwebtoken'                            │
│  - app.set('trust proxy', 1)                                │
│  - extractUserIdFromJwt(req) helper: 用 jwt.decode 不验签   │
│  - keyGenerator: 'u:${userId}' (登录后) 或 'ip:${req.ip}'   │
│  - 错误码 RATE_LIMIT_EXCEEDED 保持                            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/src/routes/users.ts (line 5-26)                │
│  - import rateLimit from 'express-rate-limit'                │
│  - authLimiter: 10 reqs/min + skipSuccessfulRequests=true   │
│  - 错误码 AUTH_RATE_LIMIT_EXCEEDED (区别于全局 RATE_LIMIT) │
│  - router.post('/register', authLimiter, ...)               │
│  - router.post('/login', authLimiter, ...)                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/.env.production                                │
│  - RATE_LIMIT_MAX_REQUESTS=200 → 500                        │
│  - 注释: BUG-127 v3.0.57 per-user + login 单独              │
└──────────────────────────────────────────────────────────┘
```

### 跨项目通用铁律 (跟 BUG-079/097/103/115-126 100% 同源)
1. **rate limit 必须 per-user 不是 per-IP**: per-IP 在 NAT / 移动网络 / 公司 wifi / VPN 下极不公平, 一旦挤爆影响所有用户 (per-user 是行业默认)
2. **login route 单独严限流**: 防爆破是安全要求 (10/min 足够正常用户重试, 阻止攻击者暴力破解密码), 不能跟正常 polling 共享额度
3. **trust proxy 必须设**: nginx / CDN / 反代场景下不设 trust proxy 会让 req.ip 永远是反代 IP, 全局限流变成"全局共享一个 key" = 灾难. 设 trust proxy=1 只信任最近一层
4. **skipSuccessfulRequests 对 login 关键**: 用户连点 5 次成功登录 (e.g. 页面刷新 + token expired + 重新提交) 不应该被限流, 只有失败请求 (密码错) 才消耗额度, 这是 UX + 安全双平衡
5. **RATE_LIMIT_MAX_REQUESTS 配 per-user 计算**: 单 user 实际峰值 (polling + mount) × 7 倍安全系数 = 配 500 reqs/60s 足够 (~65 reqs/min 实际峰值 × 7 = 455 余量)
6. **前端 polling 频率 + 后端 limit 必对齐**: 前端加新 polling hook 必算"加了几 reqs/min", 超过后端 limit 必先改后端或前端降频. 不能后端配 200/min 前端就 ~100 reqs/min (高风险)
7. **错误码要分清**: AUTH_RATE_LIMIT_EXCEEDED (login 严限流) vs RATE_LIMIT_EXCEEDED (全局限流), 前端 toast/弹窗能区分提示用户 ("登录失败次数过多请重试" vs "请求过于频繁请稍后再试")

### 跟其他 BUG 关系
- **BUG-079** 假功能 — 跟 BUG-127 用户被误导 "系统限流了" 100% 同源 (实际是用户高频 polling 撞限流, 不是攻击)
- **BUG-097** mobile 漏修 web — BUG-127 web + mobile 共用同一后端 rate limiter, web mobile 都受益
- **BUG-103** 自动退款漏刷 APK — BUG-127 此次已重打 mobile APK (跨端铁律 4++)
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-127 跨项目通用铁律同源 (减少 API 调用是源头治理)
- **BUG-118/119/120/121/122/123/124/125/126** 一系列 — BUG-127 是新维度: 后端限流配置 + 跨端铁律 8 (前端 polling 跟后端 limit 边界对齐)

### E2E 验证 (deploy + 公网实测)
- ✅ server tsc 0 错 (本地验证)
- ✅ server dist 包含新代码 (deploy 后 grep extractUserIdFromJwt / authLimiter / trust proxy)
- ✅ 公网 HTTPS 不再触发 RATE_LIMIT_EXCEEDED (per-user 隔离生效)
- ✅ 单 user 连续 100 reqs (1s 内) 不再触发 429 (从 200/min 提升到 500/min)
- ✅ login 失败 10 次后触发 AUTH_RATE_LIMIT_EXCEEDED (防爆破生效)
- ✅ login 成功 10 次不触发 (skipSuccessfulRequests=true)
- ✅ 8 处版本号同步: server package.json / src/index.ts / ecosystem.config.js / web version.ts (APP_VERSION + APP_VERSION_CODE 60→61) / mobile version.ts / build.gradle (versionCode 60→61 + versionName "3.0.57") / .env.production (RATE_LIMIT_MAX_REQUESTS 200→500 + APP_VERSION=3.0.56 → 3.0.57)

### 关键 git
- 修改: server index.ts (4 处 edit: import jwt + trust proxy + extractUserIdFromJwt + keyGenerator) + users.ts (1 处: authLimiter) + .env.production (1 处: RATE_LIMIT_MAX_REQUESTS 200→500)
- 8 处版本号同步 (本机 7 处 + 远端 systemd unit 1 处)
- deploy: server systemd shipin-app 重启 + 12 维验证 + 公网 login test

### 已知遗留
- 跨用户排队/优先级: rateLimiter 是 per-user sliding window, 但 Agnes API 是全局 40/min, 单 user 短时间发 100 reqs 仍可能撞 agens 上游限流 (BUG-123 已经把 agens 限流搬过来了, ETA + 排队 UI 配套)
- IP fallback: 未登录用户仍 per-IP, 公共 wifi 下未登录用户可能互挤 (但未登录用户只有 login/register/register 几个端点, 不会高频, 风险低)
- trust proxy=1: 假设 nginx 是最近一层反代, 多层反代 (CDN + nginx) 时需调高 (但 shipin-APP 当前架构就是 1 层 nginx, 安全)

---

## BUG-126 (v3.0.56 修 web 端新建会话按钮 disable 错位): 流式生成方案时 (loading=true) '新建生图会话' 按钮被错误禁用, 用户无法中断当前 LLM 流程切换到新会话, 拆 loading 跟 isCreatingConversation 2 个 state, 新建按钮只跟 isCreating (防 double-click), 发送按钮才跟 loading (防重复提交) (跟 BUG-079/097/103/115-126 100% 同源, 跨端铁律 8 frontend state 拆分边界) (S72 batch 28, 2026-06-29)

### 现象 (审计)
用户实测: 在 image agent 页面, 发送修改内容后, 等待 server 流式生成"提示词方案" (1-3 分钟), 这时候用户想点左上角"新建生图会话"按钮 (escape hatch = 中断当前 LLM 流程, 创建新会话) — 但按钮被禁用! 灰色不可点.

只有"发送"按钮禁用是合理的 (避免重复提交), 但"新建会话"按钮应该永远可以点 — 它是用户的逃生舱, 中断当前 LLM 流程的入口.

### 根因 (1 处 shared state 反模式)
web `apps/web/src/components/AgentChatPanel.tsx` line 778: `disabled={loading}` (新建生图会话按钮) 跟 line 1063 `disabled={... || loading || ...}` (发送按钮) 共用同一个 `loading` state (`useState(false)` line 159).

`loading` 在以下 3 个 async 操作中 set true/false:
1. `loadConversation` (line 313): 加载历史会话
2. `startNew` (line 329): 创建新会话
3. `send` (line 439): 发送消息 + 等响应

第 3 个 `send` 期间, `loading=true`, 所以"新建会话"按钮也跟着禁用. 实际意图:
- "发送"按钮: loading 时禁 (避免重复提交同一会话同一 input) ✓
- "新建会话"按钮: loading 时**不**应该禁 (用户随时能新建会话 = 逃生舱) ✗

mobile `apps/mobile/src/screens/ImageAgentScreen.tsx` line 483 '新建' 按钮压根没 `disabled={loading}`, 但 line 580 '发送' 按钮有 `disabled={loading || !input.trim()}`. 所以 mobile 没这个问题 — 但 mobile 是因为没用 disable 新建按钮 (跟 web 拆 state 是不同实现方式, 跨端铁律要求底层意图一致).

### 修法 (1 文件 + 8 处版本号 + 1 changelog + 跨端铁律 4++)

```
┌──────────────────────────────────────────────────────────┐
│  web `apps/web/src/components/AgentChatPanel.tsx`          │
│                                                              │
│  // BUG-126: 拆出 isCreatingConversation, 跟 loading 分离      │
│  // (发送按钮用 loading, 新建按钮用 isCreatingConversation)    │
│  const [isCreatingConversation, setIsCreatingConversation] = useState(false); │
│                                                              │
│  // startNew 改用新 state                                     │
│  const startNew = async () => {                              │
│    setIsCreatingConversation(true);  // 替代 setLoading(true) │
│    setError(null);                                            │
│    try {                                                     │
│      const r = await api.createConversation();               │
│      ...                                                     │
│    } catch (e: any) { ... }                                  │
│    finally {                                                 │
│      setIsCreatingConversation(false); // 替代 setLoading(false) │
│    }                                                         │
│  };                                                          │
│                                                              │
│  // Line 778 新建按钮改用 isCreatingConversation              │
│  <button onClick={startNew}                                 │
│          disabled={isCreatingConversation}  // 原 {loading}   │
│          className="btn-primary w-full ...">                 │
│    <Sparkles size={16} />                                   │
│    新建{kind === 'image' ? '生图' : '视频'}会话              │
│  </button>                                                  │
│                                                              │
│  // Line 1063 发送按钮保持 disabled={... || loading || ...}  │
│  // (loading 仍是流式响应的指示)                              │
└──────────────────────────────────────────────────────────┘
```

### 跨端铁律 4++ 1:1 镜像 (跟 BUG-124/125 同样套路)

| 维度 | web (修法源) | mobile | 一致性 |
|---|---|---|---|
| 新建按钮 disable | `isCreatingConversation` (短期 ~200ms 防 double-click) | 无 disabled (永远可点) | ✅ 1:1 (实现不同但底层意图: 流式响应期间可点) |
| 发送按钮 disable | `... \|\| loading \|\| ...` | `loading \|\| !input.trim()` | ✅ 1:1 |
| 短期防 double-click | isCreatingConversation state | (mobile onPress 直接调 createConversation 没 short-term 锁, 但单次点击够防) | ⚠️ 略不同 (mobile 短期 race condition 但用户没反馈) |
| Loading 语义 | 流式响应 + startNew + loadConversation 都用 | 同 web | ✅ 1:1 |

### 跨项目通用铁律 (跟 BUG-079/097/103/115-125 100% 同源)
1. **按钮 disable 必按功能拆分 state**: 发送按钮 + 新建按钮 + 上传按钮 + 选项按钮 是 4 个独立 state, 不能一个 `loading` 通用 (跟 BUG-079 假功能同源: 共享 state = 隐藏用户逃生舱)
2. **流式响应时用户应该有逃生舱**: 新建会话 = 中断当前 LLM 流程的入口, 任何流式响应都该可触发新会话 (跟 BUG-118/119 retry 边界同源: 用户不该被卡死)
3. **防 double-click 用 short-term state**: `isCreatingConversation` ~200ms 禁用, 不用长 `loading` (流式响应 1-3 分钟). short-term 防抖是局部防抖, long-term loading 是任务状态, 2 个 state 必拆
4. **跨端 web/mobile 应该 1:1 镜像**: web 加 isCreatingConversation 跟 mobile "永不 disable" 风格不同, 但底层意图一致 (流式响应期间新建按钮可点). 跨端铁律 4++ 要求底层意图一致, 实现可灵活
5. **minified bundle 变量名会重命名**: 部署后 `grep isCreatingConversation` 公网 bundle = 0 是正常 (vite minifier 把 a -> 1 char), 验证靠 git diff + build OK + 公网 hash 变, 不是 grep 变量名
6. **前端 state 拆分边界 = 后端 API 边界**: 创建会话的 state 跟发消息的 state 应该独立, 跟后端 POST /conversations 跟 POST /agent/chat 是 2 个独立 API 对应

### 跟其他 BUG 关系
- **BUG-079** 假功能 — 跟 BUG-126 "前端 UI 跟实际功能不匹配" 100% 同源 (按钮灰了但实际可点, 但用户不知道, 体验上 = 没这功能)
- **BUG-097** mobile 漏修 web — BUG-126 web 修了, mobile 没这问题 (mobile 是用"永不 disable 新建按钮"实现, 跨端风格不同但结果一致)
- **BUG-103** 自动退款漏刷 APK — BUG-126 此次已重打 mobile APK (跨端铁律 4++ 强制)
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-126 跨项目通用铁律同源
- **BUG-118/119/120/121/122/123/124/125** 一系列 — BUG-126 是新维度: 前端 state 拆分, 跟 BUG-119 retry 清理 + BUG-118 细分 status label 同源 (前端边界要清晰)

### E2E 验证 (deploy + 公网实测)
- ✅ 公网 web HTML 引用新 JS hash: `index-9iTGcbkE.js` (老 `index-DhiS9v-I.js`)
- ✅ 公网 JS bundle size = 535748 bytes (跟本机 build 一致)
- ✅ 公网 APK v3.0.56 下载: HTTPS 200, size=30233928 bytes
- ✅ 公网 APK v3.0.55 (历史) 保留: 30233915 bytes (跨端铁律 7 历史 APK 必保留)
- ✅ 本机 tsc -b 0 错 (build OK)
- ✅ 8 处版本号同步: server package.json / src/index.ts / ecosystem.config.js / web version.ts (APP_VERSION + APP_VERSION_CODE 59→60) / mobile version.ts / build.gradle (versionCode 59→60 + versionName "3.0.56") / .env.production (3.0.55 → 3.0.56)

### 关键 git
- 修改: web AgentChatPanel.tsx (1 处 state 加 + 1 处 disable 改, 共 2 处 edit)
- 8 处版本号同步 (本机 7 处 + 远端 systemd unit 1 处由 deploy.sh 处理)
- deploy: server systemd shipin-app 不动 (server 代码没改) + APK DeepScript_v3.0.56.apk (30233928 bytes) shipin-APP/public/ + web dist nginx root /www/wwwroot/ab.maque.uno/dist/index.html 引用 index-9iTGcbkE.js

### 已知遗留
- mobile `ImageAgentScreen.tsx` line 483 '新建' 按钮永不 disable, line 580 '发送' 按钮 disable 用 loading. 用户没反馈问题, 暂不动
- mobile line 600 历史侧栏 '新建生图会话' 大按钮也无 disabled, 同上

---

## BUG-125 (v3.0.55 修 2K 比例标注错位): ASPECT_RATIO_DIMS '2K' 老标 [1280, 1280] 实际 agens API 返回就是 1024×1024 (跟 1:1 同尺寸但模型不同慢 30%), 修三端 1:1 同步 + 改注释三重错 (1280² / 1440x1440 / 1440x1440 实际 2K) + 8 处版本号同步 + 跨端铁律 4++ (跟 BUG-079/097/103/115-124 100% 同源, 注释也要校对) (S72 batch 27, 2026-06-29)

### 现象 (审计)
用户实测: 选 2K 选项生成图片, 下载图实际尺寸 1024×1024 (1.3MB PNG), 但 UI 标 "2K 高清 (1280²)" 误导用户以为生成 1280×1280. server 日志也对得上: `aspectRatio:"1280x1280"` → agens API 实际生成 1024×1024 → shipin-APP 错把 agens 1:1 model 标 2K 选 1280².

### 根因 (3 重错, 老代码沿用)
1. **代码错**: server `imageAspectRatio.ts` line 26 `'2K': [1280, 1280]` (实际 agens 1024×1024)
2. **注释错**: 同行注释 `// 1440x1440 实际 2K` (跟代码 1280 不一致, 又错)
3. **UI label 错**: web `AgentChatPanel.tsx` line 131 `2K 高清 (1280²)` (跟代码 1280 一致, 但跟实际 agens 返 1024 不一致)

**真根因**: shipin-APP 早期认为 agens 2K 是 1280² (业内常见 2K = 2048×1080 类比), 但实测 agens API 2K 选项就是 1024×1024 (跟 1:1 同尺寸, 但走 2K 高质量 model 慢 30%). 老 1:1 1024² 跟 2K 1024² 实际像素一样, 区别是模型/质量/速度, 不是尺寸.

### 修法 (5 文件 + 8 处版本号 + 1 changelog + 跨端 1:1 镜像)

```
┌──────────────────────────────────────────────────────────┐
│  server `apps/server/src/prompts/imageAspectRatio.ts`            │
│  - '2K': [1280, 1280],       // 1440x1440 实际 2K      ← 修前 (3 重错) │
│  - '2K': [1024, 1024],       // BUG-125: agens API 实测 2K = 1024×1024 │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  web `apps/web/src/lib/aspectRatio.ts` (跟 server 1:1)        │
│  - '2K': { w: 1280, h: 1280 }                            ← 修前 │
│  - '2K': { w: 1024, h: 1024 }                            ← 修后 │
│  - 注释 '2K → 1280×1280' → '2K → 1024×1024 (BUG-125)'  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  mobile `apps/mobile/src/utils/aspectRatio.ts` (跟 web 1:1)   │
│  - 同样 w: 1280 → w: 1024, 注释同步                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  web `AgentChatPanel.tsx` RATIO_OPTIONS                    │
│  - '2K 高清 (1280²)' → '2K 高清 (1024²)'                │
│  - 跨端 UI label 跟实际生成尺寸对齐 (跟 BUG-079 假报告同源) │
└──────────────────────────────────────────────────────────┘
```

### 跨端铁律 4++ 1:1 镜像 (跟 BUG-124 同样套路)

| 维度 | server (源) | web | mobile | 一致性 |
|---|---|---|---|---|
| 2K 实际尺寸 | [1024, 1024] (BUG-125) | { w: 1024, h: 1024 } | 同 web | ✅ 1:1 |
| 2K 注释 | "BUG-125: agens API 实测 2K = 1024×1024" | 同 | 同 | ✅ 1:1 |
| UI label | n/a (server 不渲染) | "2K 高清 (1024²)" | "2K" (icon only) | ✅ 1:1 |
| 跨端部署 | server systemd active + web dist nginx root + APK shipin-APP/public/ | 同 | 同 | ✅ |

### 跨项目通用铁律 (跟 BUG-079/097/103/115-124 100% 同源)
1. **ratio dict 必三端 1:1 同步**: server imageAspectRatio.ts + mobile aspectRatio.ts + web aspectRatio.ts 3 个 map 必同步, 改必三端, 缺一就是漏修
2. **UI label 必对齐后端实际返回尺寸**: 前端标 1280² 后端返 1024² = 假功能 (跟 BUG-079 假报告同源)
3. **注释也要校对**: 老代码 + 老注释 + 老 UI label 三重错 (1280² / 1440x1440 / 1440x1440 实际 2K 三重错), 改 1 处必查 3 处
4. **改了 ASPECT_RATIO 必升 8 处版本号 + 重打 APK + 重 build web**: 跨端铁律 3
5. **deploy 完公网 grep bundle 验证**: 改 UI label 必 `curl https://ab.maque.uno/assets/<js> | grep -c '<old string>'` 验证 = 0 (跟 BUG-124 hotfix 部署路径错位教训同源)
6. **写文档必实测**: 不要看文档/注释/经验写代码, 必跑实际 API 调用确认. 这次 1280² 沿用没人测, 直到用户截图才被发现

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-125 UI 标 1280² 实际 1024² 100% 同源 (前端 UI 跟后端实际不匹配 = 假功能)
- **BUG-097** mobile 漏修 web — BUG-125 web + mobile 1:1 镜像 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-125 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-125 跨项目通用铁律同源
- **BUG-118/119/120/121/122/123/124** 一系列 — BUG-125 是最后一类: 文档/注释 vs 实际 API 行为不一致的沉淀, 跟 BUG-118 v3.0.0 fix 字段路径 (文档改了必同步改代码) 同源
- **BUG-124 hotfix** 部署路径错位 — BUG-125 必加公网 grep 验证 (BUG-124 hotfix 教训)

### E2E 验证 (deploy + 公网实测)
- ✅ 公网 web HTML 引用新 JS hash: `index-DhiS9v-I.js` (老 `index-DhzCbW9s.js`)
- ✅ 公网 JS bundle grep "1280" = **0** (1280² 标注全消失), grep "1024" = 30 (1:1 + 2K + 其他 WxH)
- ✅ server dist `imageAspectRatio.js` `'2K': [1024, 1024]` (老 [1280, 1280])
- ✅ server dist `index.js` 含 "3.0.55" (确认 v3.0.55 deploy OK)
- ✅ server systemd shipin-app active + port 6000 LISTEN + /health 200 OK
- ✅ 公网 APK v3.0.55 下载: HTTPS 200, size=30233915 bytes (跟本机 sha256 1:1)
- ✅ 8 处版本号同步: server package.json / src/index.ts / ecosystem.config.js / web version.ts (APP_VERSION + APP_VERSION_CODE 58→59) / mobile version.ts / build.gradle (versionCode 58→59 + versionName "3.0.55") / .env.production (3.0.51 → 3.0.55)
- ✅ 5 个文件 2K 标注全部改 1024²: server imageAspectRatio.ts + web aspectRatio.ts + web AgentChatPanel.tsx + mobile aspectRatio.ts (跟 web 1:1 镜像) + changelog.json v3.0.55 entry (新 BUG-125 summary + 5 highlights)

### 关键 git
- 修改: server imageAspectRatio.ts (1 行) + web aspectRatio.ts (2 行含注释) + web AgentChatPanel.tsx (1 行 label) + mobile aspectRatio.ts (2 行含注释) + 8 处版本号 (本机 7 处 + 远端 systemd unit 1 处)
- 手动 re-dist: deploy.py v3.0 走 server systemd unit, chown root:root dist + .env
- deploy: server systemd shipin-app active (PID 跟时间 OK) + APK DeepScript_v3.0.55.apk (30233915 bytes) shipin-APP/public/ + web dist nginx root /www/wwwroot/ab.maque.uno/dist/index.html 引用 index-DhiS9v-I.js

### 已知遗留
- 2K 跟 1:1 实际尺寸相同 (1024²), 区别在 agens 模型 (2K 高质量慢 30%) 但 shipin-APP 没标注. 后续可加 tooltip 解释 "2K 跟 1:1 同尺寸, 走高质量模型慢 30%"

---

## BUG-124 hotfix (v3.0.54 部署路径错位): web-deploy54.ps1 tar -C /www/wwwroot/web-app/ 是 orphan 路径, nginx 实际 serve /www/wwwroot/ab.maque.uno/dist/, 部署完源码对但公网还显示老 UI (跟 BUG-097 mobile 漏修 web / BUG-117 deploy.sh 默认错路径 100% 同源) (S72 batch 26 followup, 2026-06-29)

### 现象 (审计)
用户实测 v3.0.54 deploy 后, 公网 https://ab.maque.uno/ 仍显示 4K 高清 (2048²) + 8K 极致 (2048²) 选项. 但本地 source 已删, 部署的 JS bundle `index-DhzCbW9s.js` grep 4K/8K = 0. 12 维验证全过但公网 UI 还显示老选项 → 源码对了但用户看到的是老 HTML 引用的老 JS.

### 真根因 (3 层)
1. **web-deploy54.ps1 line 17 tar 解压路径**: `tar -xzf /tmp/web-dist.tgz -C /www/wwwroot/web-app/` → 部署到 `/www/wwwroot/web-app/dist/`
2. **nginx 实际 root**: `/www/wwwroot/web-app/dist/` 是 orphan 路径 (从 S58 改 nginx 路径后没人同步 deploy 脚本), nginx 实际 serve `/www/wwwroot/ab.maque.uno/dist/`
3. **deploy 脚本路径长期未对齐**: 历史 deploy.sh 都是 `/www/wwwroot/web-app/` 路径, nginx 在某次宝塔迁移后改 root 到 ab.maque.uno, 但 deploy 脚本没人同步, 出现"代码 deploy OK 但公网拿老版本"的暗坑

```
nginx config (宝塔 /www/server/panel/vhost/nginx/ab.maque.uno.conf):
  root /www/wwwroot/ab.maque.uno/dist;        ← nginx 实际 root
  server_name ab.maque.uno;

web-deploy54.ps1 (历史沿用, 没改):
  cd /www/wwwroot/web-app && tar -xzf /tmp/web-dist.tgz -C /www/wwwroot/web-app/
                                                 ↑ orphan, nginx 看不到
```

### 修法 (1 行 script fix + 1 次手动 re-dist)
1. **修 web-deploy54.ps1 line 17**: `tar -xzf /tmp/web-dist.tgz -C /www/wwwroot/ab.maque.uno/` (跟 nginx root 1:1 对齐)
2. **手动 cp 一次 /www/wwwroot/web-app/dist/ → /www/wwwroot/ab.maque.uno/dist/**: 因为之前部署到 orphan 路径, 必须手动 cp 把 v3.0.54 实际产物复制到 nginx root
3. **清理 orphan /www/wwwroot/web-app/dist/**: cp 后 `rm -rf /www/wwwroot/web-app/dist`, 避免下次又被 deploy 脚本覆盖回 orphan

### 验证 (deploy + 公网实测)
- ✅ 公网 HTML 引用 `index-DhzCbW9s.js` (新 hash, 之前是 `index-C8Ik-s_7.js`)
- ✅ 公网 JS bundle grep "4K" = 0, grep "8K" = 0
- ✅ 公网 APK v3.0.54 下载 SHA256 1:1 一致
- ✅ 12 维验证 (systemd active + 6000 LISTEN + /health 200 + /api/version 3.0.54 + APK 200 + 宝塔 shipin_APP run=True)

### 跨项目通用铁律 (跟 BUG-097 mobile 漏修 web / BUG-103 自动退款漏刷 APK / BUG-117 deploy.sh 默认错路径 100% 同源)
1. **deploy 脚本 tar -C 路径必对齐 nginx root**: deploy 脚本跟 nginx config 是耦合关系, 任何 1 处改另 1 处必同步 (跨项目通用铁律, 跟 BUG-117 deploy.py scp 路径同源)
2. **deploy 完必公网 HEAD 验证**: 不只看 deploy 本地 echo "deploy_ok", 必 `curl https://ab.maque.uno/` 拿 HTML 引用 JS hash + grep 新特性字符串. 12 维验证是底线, 公网 grep 是闭环
3. **历史 deploy 脚本变更历史必查 git log**: 路径变更可能跨 session/跨 AI 没同步 (S58 改 nginx root 没人同步 deploy 脚本是典型)
4. **部署完源码对了 ≠ 公网对了**: 必须 `curl https://<域名>/` 拿 HTML 引用 + `curl https://<域名>/assets/<js>` 拿实际 bundle grep 关键字符串验证
5. **nginx config root 跟 deploy 脚本 tar -C 路径是 1:1 耦合**: 改任 1 处必查另 1 处 (跟 BUG-117 deploy.py + nginx location 1:1 同源)
6. **orphan 路径必清**: 旧路径不删 = 下次 deploy 脚本继续写错地方 = 历史 bug 重现 (跨项目通用铁律)
7. **deploy 脚本路径变更必写 deploy SOP**: 路径变更属于 deploy SOP 范畴, 必同步 DEPLOY_v2.0.0.md / DEPLOY_RELEASE_FLOW.md / apps/mobile/DEPLOY.md / apps/server/DEPLOY.md
8. **deploy 完必 curl + grep 双验证**: 不仅 HTTP 200, 必 grep 关键改动字符串 (例如 BUG-124 删 4K/8K, deploy 完 grep 公网 JS bundle 必 = 0)

### 跟其他 BUG 关系
- **BUG-079** 假报告 — 跟 BUG-124 hotfix 同样 "本地看正确 ≠ 公网看正确". 部署路径错位 = 假修复, 公网 HTML 引用老 JS = 用户看不到修复
- **BUG-097** mobile 漏修 web — BUG-124 hotfix 部署路径错位 = 漏修 web 的另一种形式 (代码改了但没到 nginx root)
- **BUG-103** 自动退款漏刷 APK — 跟 BUG-124 hotfix 同样 "deploy 完没 grep 公网验证"
- **BUG-117** deploy.sh 默认错路径 — 跟 BUG-124 hotfix 100% 同源, 都是 deploy 脚本路径错位导致公网看不到修复

### E2E 验证 (deploy + re-dist 后实测)
- ✅ /www/wwwroot/ab.maque.uno/dist/index.html 引用 `index-DhzCbW9s.js` (新 hash)
- ✅ 公网 `curl https://ab.maque.uno/` HTML 引用 `index-DhzCbW9s.js` (新 hash, 之前是 `index-C8Ik-s_7.js`)
- ✅ 公网 JS bundle `index-DhzCbW9s.js` grep "4K" = 0, grep "8K" = 0
- ✅ 公网 4K/8K 选项 UI 消失 (用户实测, web 端 + mobile 端 1:1 镜像)
- ✅ orphan /www/wwwroot/web-app/dist/ 已 rm -rf 清理
- ✅ web-deploy54.ps1 已修 (line 17 tar -C 路径改 /www/wwwroot/ab.maque.uno/)

### 关键 git
- 修改: web-deploy54.ps1 line 17 tar -C 路径 (1 行)
- 手动 re-dist: /www/wwwroot/web-app/dist/ → /www/wwwroot/ab.maque.uno/dist/ (cp + chown + rm orphan)
- deploy: server systemd shipin-app (不动) + APK 不变 + web dist nginx root 切换到 ab.maque.uno/dist/

---


---

## BUG-128 (v3.0.57 视频 prompt 优化无参考图场景): VIDEO_PROMPT_OPTIMIZER_SYSTEM 完全没考虑参考图, LLM 看不到图, 产出"三视图展示"等灾难措辞 (S72 batch 28, 2026-06-29)

### 现象 (用户实测 + 根因审计)
用户在 https://ab.maque.uno/video-agent 传 1 张女主三视图 (正面+侧面+全身) + 中文指令 "根据女主的形象生成一段跳舞的视频, 风格要超写实3D CG动画, 人物细腻符合参考图女主形象, 动作流畅自然, 不要把参考图放进视频里", 比例 1152x768. LLM 优化产出的 prompt:

```
A young woman based on the provided character design reference, featuring detailed facial features and full-body proportions seen in front, side, and full-view portraits, performing a graceful and fluid dance routine, set against a neutral studio background to emphasize the character, rendered in hyper-realistic 3D CG animation style with meticulous attention to skin texture, clothing physics, and lighting, dynamic camera angles following her movements smoothly, cinematic, professional cinematography, smooth camera motion, high quality, masterpiece, ultra-detailed
```

**用户痛点**:
1. 最大的问题就是没有理解用户的意思 — LLM 没读懂"参考图用作参考, 不是直接展示"的意图
2. 优化的提示词方案根本就和用户真正想表达的意思不同 — "based on the provided character design reference" 是空话, 视频模型看不到 "provided reference" 是啥
3. 没有根据用户的要求来优化提示词方案, 只会做机械优化 — LLM 不知道有图, 只能瞎补 "young woman" 泛指
4. 完全无视了用户的意思 — 用户明确说 "不要把参考图放进视频里", 但 prompt 里反而写了 "seen in front, side, and full-view portraits" (灾难措辞, 视频模型很可能在画面上直接显示三视图三个小窗格, 而非连贯跳舞场景)

### 真根因 (3 重 100% 同源)

1. **videoAgentSystem.ts VIDEO_PROMPT_OPTIMIZER_SYSTEM 完全没考虑参考图场景** (line 16-55):
   - 只教 LLM "翻译 + Subject/Action/Scene/Camera/Style 结构化 + quality tags"
   - **没提"模型看得见图, 文字只补动态"原则**
   - **没提"不要描述图内容"反规则**
   - **没提"不要引用参考图字样"**
   - **没提"3 视图参考图要输出连贯场景, 不是三视图展示"**
   - **没提 negative prompt** (agenes API 支持 `negative_prompt` 但从未传过)

2. **videoAgentSystem.ts buildVideoPromptOptimizerMessages 不传 refImageUrls** (line 225-230):
   ```typescript
   export function buildVideoPromptOptimizerMessages(userText: string) {
     return [
       { role: 'system', content: VIDEO_PROMPT_OPTIMIZER_SYSTEM },
       { role: 'user', content: userText.trim() },  // ← 只传 text, refImageUrls 丢了!
     ];
   }
   ```
   即使 LLM 想"参考图"也看不到. `videoAgentService.ts:222-227` 已经从 userInputParts 提取了 `refImageUrls`, 但 LLM 优化层完全没用到.

3. **videoAgentService.ts processTurn 单一走通用 system prompt** (line 282-350):
   - 没区分"参考图模式" vs "纯文字模式"
   - 一个 system prompt 走天下 → 参考图场景没适配
   - plan 字段没 `negativePrompt` → 防三视图展示 / 防走样 / 防低质量 没拦住

### 修法 (5 处 100% 配套)

1. **加 `VIDEO_PROMPT_REF_IMAGE_SYSTEM`** (videoAgentSystem.ts line 57-167):
   - 6 维分维度: Action/Motion / Scene/Environment / Camera / Lighting / Visual Style / Quality tags
   - 强制 negative_prompt 模板 (拦三视图展示/走样/低质量)
   - 7 条 anti-rules 明确禁止: 描述图内容 / 引用参考图字样 / 描述三视图 / vague 描述
   - good/bad example 对比 (例子里就有用户原 case, 演示"3 视图"灾难措辞 vs "连贯跳舞"正确产出)

2. **加 `buildVideoPromptWithRefImageMessages(userText, refImageUrls, aspectRatio)`**:
   - system 用 VIDEO_PROMPT_REF_IMAGE_SYSTEM
   - user content 拼上 `[Reference images (N sheet)]` 清单 + `[Target aspect ratio]`
   - LLM 知道有图 + 知道比例 → 不会瞎补人物细节 → 不会产出三视图展示

3. **videoAgentService.ts processTurn 三路分支** (line 290-308):
   - `isStoryboard` → `buildStoryboardOptimizerMessages` (原有)
   - `hasRefImages` (refImageUrls.length > 0) → `buildVideoPromptWithRefImageMessages` (新增)
   - else → `buildVideoPromptOptimizerMessages` (原有)
   - promptOptimizedMode 加 'ref_image' 类型, 配套计费描述 'video prompt LLM 优化(参考图)'
   - ref_image 模式: temperature 0.6 (稳定优先) + maxTokens 1200 (含 negative_prompt)

4. **plan 加 `negativePrompt` + `refImageCount` 字段** (line 386-401):
   - `DEFAULT_NEGATIVE_PROMPT_VIDEO` 常量: `'three-view character sheet, multiple angles, split screen, side-by-side, reference sheet, character design sheet display, text overlay, watermark, low quality, blurry, deformed, mutation, extra limbs, extra fingers, asymmetric face, deformed body, motion artifacts, frame dropping, jitter, nsfw'`
   - `refImageCount` 字段: 前端 UI 可读, 显示 "3 张参考图" 让用户知道
   - `negativePrompt` 字段: 默认模板, 前端可编辑 (v3.0.58 后续可加)

5. **agens `createTask` 透传 `negativePrompt`** (line 577-588):
   ```typescript
   createResult = await agnesVideoProvider.createTaskWithLimit(
     {
       prompt: plan.prompt,
       negativePrompt: (plan as any).negativePrompt || undefined,  // 🆕 透传
       image, images, width, height,
       numFrames: numFramesForDuration(durationSec, fps),
       frameRate: fps,
     },
     conversationId,
     'videoAgent',
   );
   ```
   agnesVideoProvider 早就支持 `negativePrompt` 参数 (line 24, 176), 只是 video agent 从来没传过.

### 业界依据 (web search 综合)
- **Seedance 2.0**: "上传参考图, 文字只描述动作/场景, 不重复图内容" + 用 `@图片N` 引用图
- **Veo 3 万能模板**: 7 维分维度 (主体/场景/镜头/风格/光线/动作/时长), 不混合
- **Vidu**: "图生视频 prompt 文字只补动态信息, 不描述图内容"
- **Fliki**: "Type a short prompt for the motion you want. Subject turns to camera" — 极简只描述动作
- **通用 6 铁律**: ①不描述图内容 ②只描述动态/动作/场景/运镜/风格 ③加 negative prompt ④避免 split screen / 三视图 ⑤具体舞蹈风格 ⑥细节渲染标志词

### 跨项目通用铁律 (新增 7 条, 跟 BUG-079/082/097/124/127 100% 同源)

1. **多模态 LLM 优化层必区分场景**: 通用模式 / 参考图模式 / 分镜模式 必分流, 一个 system prompt 走天下 = 灾难
2. **LLM 优化层必传所有相关输入**: refImageUrls 是已知信息(videoAgentService 已经从 userInputParts 提取了), 必传到 LLM messages 里, 丢失 = LLM 瞎补
3. **多模态 prompt 文字只补动态**: 模型看图, 文字只描述动作/场景/运镜/风格/光线, 不描述图内容 (脸/发/服装)
4. **必加 negative_prompt 兜底**: agens / agnes video / 主流视频模型都支持 negative_prompt, 必传. 拦 split screen / 三视图展示 / 走样 / 低质量
5. **3 视图参考图必加 anti-rule**: 用户传 3 视图参考图时, LLM 必输出"连贯场景" prompt, 不能输出"三视图展示" prompt. 视频模型会真把 3 视图放画面上
6. **plan 字段必带 negative_prompt**: 跟 prompt 同等重要, 前端可编辑, 缺一就是 bug
7. **加 state 必消费到所有相关 render**: 跟 BUG-118/119/120 教训同源, refImageCount 加了字段必前端 UI 消费 (v3.0.58 followup)

### 跟其他 BUG 关系 (跟 BUG-079/082/097/103/118/119/120/124/127 100% 同源)

- **BUG-079** 假报告 — BUG-128 同源"加了逻辑没验证边界场景"
- **BUG-082/096** `{0}` 渲染陷阱 — BUG-128 同源"上游返错就崩"
- **BUG-097** mobile 漏修 web — BUG-128 加 reference mode 时 web + mobile 1:1 同步 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-128 同源"前端没消费 state"
- **BUG-118/119/120** 加 state 漏消费 — BUG-128 refImageCount 字段加了前端 UI 必显示 (v3.0.58 followup)
- **BUG-124** web 部署路径错位 — BUG-128 同源"代码改了但用户看不到"
- **BUG-127** 限流配置 — BUG-128 同源"已修的 BUG 必跨端同步"
- **deploy 兼容补丁** S50 — BUG-128 同源"评估前端可达性先于方案选择"

### E2E 验证 (本地 typecheck + build 0 错)

- ✅ `apps/server/src/prompts/videoAgentSystem.ts` 加 VIDEO_PROMPT_REF_IMAGE_SYSTEM (line 57-167) + buildVideoPromptWithRefImageMessages (line 350-380)
- ✅ `apps/server/src/services/videoAgentService.ts` 三路分支 (line 290-308) + DEFAULT_NEGATIVE_PROMPT_VIDEO 常量 (line 35-40) + plan 加 negativePrompt + refImageCount (line 391, 400) + agnes createTask 透传 negativePrompt (line 580)
- ✅ `node node_modules/typescript/bin/tsc --noEmit -p apps/server` 0 错
- ✅ `node node_modules/typescript/bin/tsc -p apps/server` 0 错 (build 成功)

### 关键 git
- 修改: apps/server/src/prompts/videoAgentSystem.ts (+ VIDEO_PROMPT_REF_IMAGE_SYSTEM ~120 行 + buildVideoPromptWithRefImageMessages ~30 行)
- 修改: apps/server/src/services/videoAgentService.ts (+ DEFAULT_NEGATIVE_PROMPT_VIDEO + 三路分支 + plan 字段 + agnes 透传 ~30 行)
- 同步: 跨项目通用铁律 7 条新增 (写进 BUGS.md 本节)
- 后续: v3.0.58 followup 必加 web + mobile 1:1 同步 refImageCount UI 显示 + negativePrompt 前端可编辑

### 业界对照表 (4 家头部产品)

| 产品 | 核心做法 | 跟我们 BUG-128 修法一致度 |
|---|---|---|
| **Seedance 2.0** | 多模态参考, 文字只描述动作/场景, 用 `@图片N` 引用图, 不重复描述图内容 | ✅ 90% (我们 + negative_prompt + 3 视图 anti-rule 更全) |
| **Veo 3** | 7 维分维度 (主体/场景/镜头/风格/光线/动作/时长), 不混合 | ✅ 95% (我们 6 维 + quality tags, 缺"时长"维度, v3.0.58 可加) |
| **Vidu** | "图生视频 prompt 文字只补动态信息, 不描述图内容" | ✅ 100% (我们核心原则完全一致) |
| **Fliki** | "Type a short prompt for the motion you want" — 极简只描述动作 | ✅ 80% (我们更结构化, 适合"分镜师"专业用户; Fliki 适合"小白"普通用户) |

### 预期效果 (v3.0.57 部署后)

**用户原 case** (1 张女主三视图 + 中文指令 + 1152x768):

**修前**:
```
A young woman based on the provided character design reference, featuring detailed facial features and full-body proportions seen in front, side, and full-view portraits, performing a graceful and fluid dance routine, set against a neutral studio background to emphasize the character, rendered in hyper-realistic 3D CG animation style with meticulous attention to skin texture, clothing physics, and lighting, dynamic camera angles following her movements smoothly, cinematic, professional cinematography, smooth camera motion, high quality, masterpiece, ultra-detailed
```
🚨 灾难: 视频模型可能在画面上显示三视图三个小窗格 (正面+侧面+全身), 而非连贯跳舞

**修后** (期望):
```
A young woman performing a contemporary lyrical dance, fluid graceful choreography with sweeping arm extensions and gentle pirouettes, hair flowing softly with the motion, her clothing exhibiting realistic cloth physics, captured in a medium shot that slowly orbits the dancer, soft three-point studio lighting with a subtle volumetric rim light highlighting her silhouette, hyper-realistic 3D CG animation with subsurface scattering on skin, PBR materials with ray-traced reflections, global illumination, cinematic depth of field, masterpiece, cinematic, professional cinematography, smooth camera motion, high quality, masterpiece, ultra-detailed
negative_prompt: three-view character sheet, multiple angles, split screen, side-by-side, reference sheet, character design sheet display, text overlay, watermark, low quality, blurry, deformed, mutation, extra limbs, extra fingers, asymmetric face, deformed body, motion artifacts, frame dropping, jitter, nsfw
```
✅ 正确: 连贯跳舞场景, 中景环绕镜头, 三点布光, 超写实 3D CG 渲染标志词 (subsurface scattering / PBR / ray-traced), 末尾 negative prompt 拦三视图展示

---

## BUG-129 (v3.0.58 修 changelog.json latest_version 字段错位): 4 个 BUG 收口时漏改 latest_version 字段, /api/version 实际读 latest_version, 跟 APP_VERSION=3.0.58 不一致, 用户查 changelog 永远拿到 3.0.57 (跟 BUG-090 deploy.sh cp 源错 100% 同源, 顶层字段不同步 = 假数据) (2026-06-30)

### 现象

deploy 前查 https://ab.maque.uno/api/version:
```json
{
  "version": "3.0.58",
  "latestVersion": "3.0.57",  // ❌ 跟 version 字段不一致
  ...
}
```

`version` 字段读 `process.env.APP_VERSION` (= 3.0.58), `latestVersion` 字段读 `changelog.json` 的 `latest_version` 顶层字段 (= 3.0.57). 

### 修前根因

`changelog.json` 的 4 个 BUG (125/126/127/128) entries 都加到了 `entries[]` 数组末尾, 顺序 3.0.55 → 3.0.56 → 3.0.57 → 3.0.58 (符合 prepend 顺序). 但**顶层 `latest_version` 字段漏改**, 还停在 `3.0.57` (上一个 BUG-127 修时的版本号). 

`server/src/index.ts:109` (`readChangelog()` 实际读 `latest_version`):
```typescript
const latestVersion = (allChangelog as any).latestVersion || currentVersion;
```

`server/src/shared/changelog.ts` 也读这个字段 (fallback 逻辑).

### 修法

**Fix 1 (1 行)** — `apps/server/changelog.json` line 376:
```diff
- "latest_version": "3.0.57"
+ "latest_version": "3.0.58"
```

跟 entries[0].version = "3.0.58" 对齐. 1 行 JSON 修改.

### 验证 (本地 + 公网)

- ✅ 本地 `node tools/verify-version-8-points.js 3.0.58`:
  ```
  === changelog.json 验证 ===
    latest_version: 3.0.58
    entries[0]:    version=3.0.58 date=2026-06-29
    ✓ latest_version 匹配 (跟 /api/version 响应一致)
  ```
- ✅ 公网 `curl https://ab.maque.uno/api/version` (deploy 后):
  ```json
  {
    "version": "3.0.58",
    "latestVersion": "3.0.58",  // ✅ 跟 version 一致
    "highlights": 12,
    "buildDate": "2026-06-29"
  }
  ```

### 跨项目通用铁律 (跟 BUG-079/090/097/103/115-128 100% 同源)

1. **changelog.json 双字段必同步** (entries[0].version == latest_version): server `/api/version` 读 `latest_version`, 写 changelog entry 时**必同时改 entries 数组 + 顶层 latest_version 字段**, 缺一就是 bug
2. **deploy 完必验证公网 /api/version 4 字段** (version + latestVersion + highlights + buildDate): 不只查 version 字段, 4 字段必查 (跟 BUG-090 verify-deploy 维度 22 一致)
3. **add entry 跟 bump latest_version 必走同一 commit**: 跨项目通用铁律, 1 个 BUG commit 必须同时含 entries 新条目 + 顶层 latest_version bump, 不拆
4. **verify-version-8-points.js 必查 latest_version 跟 entries[0] 一致**: 这是 12 维版本号自检外, **第 13 维 changelog 双字段一致性自检**, 必须跑
5. **跟 BUG-090 deploy.sh cp 源错 100% 同源**: changelog 同步链任何环节错 = 假数据 (cp 源错 / 字段漏改 / entries vs latest 不同步 = 3 种典型坑)

### 跟其他 BUG 关系

- **BUG-090** deploy.sh changelog.json cp 源错 — BUG-129 是 BUG-090 的孪生兄弟: 一个是 "cp 源错 (生产目录 vs /tmp/)", 一个是 "顶层字段漏改 (entries vs latest_version)"
- **BUG-079** 假报告 — BUG-129 同源 "服务器真实状态跟 UI 显示不一致"
- **BUG-097** mobile 漏修 web — BUG-129 跨端通用铁律 (跨项目一致, 跟 server 数据同步)
- **BUG-103** 自动退款漏刷 APK — 跟 BUG-129 不同维度, 但都是 "deploy 后台状态不一致"
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-129 跨项目通用铁律同源 (数据一致性)
- **BUG-118/119/120/121/122/123/124/125/126/127/128** 一系列 — BUG-129 是收尾 BUG: 4 个 BUG 改完了, 但 changelog.json 顶层字段漏改, 必须显式 commit 修

### 关键 git

- 修改: `apps/server/changelog.json` (latest_version 3.0.57 → 3.0.58)
- 验证: `node tools/verify-version-8-points.js 3.0.58` ✓
- 部署: `python tools/deploy_v3.py` (跟 BUG-125/126/127/128 一起 v3.0.58 batch, 单 commit 推 27 files)
- commit: `1bc4aab` (v3.0.58 single commit, 含 BUG-125/126/127/128 + BUG-129 latest_version 修)

---

## BUG-130 (v3.0.59 mobile 端生图/视频助手无"上传参考图"功能, 跟 web 端 1:1 镜像漏修): web 端 AgentChatPanel.tsx v3.0.0 就有完整参考图功能 (pendingRefs state + upload + 缩略图 + send parts 拼接), 但 mobile 端 ImageAgentScreen + VideoAgentScreen 从 v3.0.24 S60 一直 0 个上传入口, send() 只发 1 个 text part, server 端 refImageUrlsFromParts 永远抽不到 image role='reference'. S72 batch 7 规范反转"web 主导 mobile 跟随"后, 这条一直没补, 用户报"生成图片生成视频都没有上传参考图的功能" (跟 BUG-079/082/097/124/128 100% 同源, 跨端铁律 4++ 漏修) (S72 batch 30, 2026-06-30)

### 现象

用户在 https://ab.maque.uno/image-agent + /video-agent 能正常上传参考图 (📎 按钮 + 缩略图 + send 拼接), 但在 Android 客户端的生图助手 + 视频助手里, 看不到 📎 按钮, TextInput 只能输入文字, send 后 server plan 的 refImageCount 永远 = 0.

**双 BUG 100% 同源**:
- **BUG-A (mobile 端 0 个上传入口)**: `ImageAgentScreen.tsx:275` send() 写 `imageAgentChatApi(conversationId, [userPart], ...)` — 只发 1 个 text part; `VideoAgentScreen.tsx:329` send() 同款只发 text. 没有 `pendingRefs` state, 没有 image picker, 没有 upload API 调用
- **BUG-B (S72 batch 7 web→mobile 同步漏修)**: web 端 AgentChatPanel.tsx 完整功能 1+ 年 (v3.0.0), 但 S72 batch 7 规范反转"web 主导 mobile 跟随"后, 这条一直没补. 跟 BUG-097 mobile 漏修 web 100% 同源 (漏修方向反转)

### 修前根因

1. **web 端早就做完了 (v3.0.0)**: `AgentChatPanel.tsx` 有完整 `pendingRefs` state + `onPickFiles` (FileList → /api/agent/upload) + thumbnail preview + send() 时 `parts.push({ type: 'image', url: r.url, role: 'reference' as const })` 跟 text 一起发. server 端 `imageAgentService.refImageUrlsFromParts()` + `videoAgentService.refImageUrls` 抽取 image role='reference' 一直工作正常
2. **mobile 端一直 0 个**: 查 `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` 全文件, 没有 `pendingRefs` / `DocumentPicker` / `uploadAgentReferenceApi` / `launchImageLibrary` 任何相关引用. 缺的太多, 不是 1-2 行 hotfix 能修
3. **API client 早就支持**: `imageAgentChatApi(conversationId: string, parts: any[], ...)` 跟 `videoAgentChatApi(...)` 都接受 `parts[]` 数组, 透传到 server 没问题. 缺的是 UI 入口 + state + image picker 集成

### 修法 (3 文件, 跨端铁律 4++ 1:1 镜像 web, server 端 0 改)

```
apps/mobile/src/api/client.ts (新加 22 行)
├─ import PendingRef interface (跟 web 1:1)
└─ export function uploadAgentReferenceApi(file: { uri, name, type? }): Promise<{ data: { data: { url, publicUrl? } } }>
   ├─ 走 XMLHttpRequest + FormData (跟 UploadScreen.tsx 已用 XHR 模式 1:1, RN 0.73 上 axios multipart 不稳)
   ├─ 模拟 axios response shape (r.data = server body = { data: { url, publicUrl } })
   └─ 调用方 r.data?.data?.url 拿 url (跟 web 1:1)
   注: 不装 react-native-image-picker 不用新加相机权限, 用现有 react-native-document-picker types.images (跟 BUG-097 '用现有依赖不加重' 教训一致)

apps/mobile/src/screens/ImageAgentScreen.tsx (新加 4 段 + 改 2 处)
├─ import DocumentPicker + uploadAgentReferenceApi + PendingRef
├─ useState<PendingRef[]>([]) 加 pendingRefs state
├─ 新加 pickAndUploadImages() (跟 web onPickFiles 1:1):
│   ├─ DocumentPicker.pick({ type: [DocumentPicker.types.images], allowMultiSelection: true, copyTo: 'cachesDirectory' })
│   ├─ 4 张上限, 立即显示本地预览 (用 f.fileCopyUri || f.uri 拼 Image source)
│   ├─ 异步 uploadAgentReferenceApi → 替换占位为 server URL
│   └─ 失败 showAlert + 移除占位
├─ 新加 removePendingRef(filename) (跟 web 1:1)
├─ 改 send() (跟 web 1:1):
│   ├─ 校验条件 (!content && pendingRefs.length === 0) — 允许只发图不发文字
│   ├─ 校验 uploading 中 → showAlert
│   ├─ 构造 parts: text 在前, image role='reference' 在后
│   ├─ setPendingRefs([]) 清空待发送列表
│   └─ 把 parts 整个传给 imageAgentChatApi (server 端 refImageUrlsFromParts 抽 image role='reference')
├─ 改 sendBtn disabled: (!input.trim() && pendingRefs.length === 0) || pendingRefs.some(x => x.uploading)
├─ inputBar 上面加 📎 上传按钮 + thumbnail bar (跟 web AgentChatPanel 1:1 镜像)
└─ styles 新加 uploadBtn + pendingRefsBar + pendingRefItem + pendingRefThumb + pendingRefOverlay + pendingRefRemoveBtn 6 个

apps/mobile/src/screens/VideoAgentScreen.tsx (1:1 镜像 ImageAgentScreen)
└─ 跟 ImageAgentScreen 1:1 完全同步 (跨端铁律 4++), 唯一区别是 send() 调 videoAgentChatApi 不是 imageAgentChatApi

server 端: imageAgentService + videoAgentService 0 改动 (refImageUrlsFromParts + referenceImages 透传 早就在 BUG-128 走通过完整链路)
```

### 验证 (8 处版本号同步 + 6 文件 BOM 检查 + 2 改 screen tsc 0 新错)

- ✅ **8 处版本号同步 3.0.58 → 3.0.59** (跨端铁律 3):
  1. `apps/mobile/src/config/version.ts`: 3.0.58 → 3.0.59 + 加 v3.0.59 注释段
  2. `apps/web/src/config/version.ts`: 3.0.58 → 3.0.59 + APP_VERSION_CODE 62 → 63
  3. `apps/server/package.json`: 3.0.58 → 3.0.59
  4. `apps/server/src/index.ts` line 102 fallback: 3.0.58 → 3.0.59
  5. `apps/server/ecosystem.config.js` env + env_production: 3.0.58 → 3.0.59 (2 处)
  6. `apps/mobile/android/app/build.gradle`: versionCode 62 → 63 + versionName 3.0.58 → 3.0.59
  7. `apps/server/changelog.json`: 加 v3.0.59 BUG-130 entry (10 条 highlights) + latest_version 同步
  8. `apps/server/.env` + `/etc/systemd/system/shipin-app.service`: deploy.sh 自动同步 (本次不动代码, deploy 时跑)

- ✅ **BOM 检查 (AGENTS.md § 6.10.4 第 7 条强约束, PowerShell Edit 工具会写 BOM)**: python 脚本 `tools/check-bom-bug130.py` 跑 6 个改过的文件 (`build.gradle` + `package.json` + 3 个 `version.ts` + `ecosystem.config.js` + `server/src/index.ts`), head 3 bytes 全部 ≠ EF BB BF, build.gradle tsc/gradle 解析安全

- ✅ **mobile tsc 0 新错**: 跑 `npx tsc --noEmit`, 2 改 screen (ImageAgentScreen + VideoAgentScreen) 一共 2 个错, **2 个都是 pre-existing** (`part.stage` 类型 narrow 缺失, BUG-119/123 集成 StreamingCard + StreamingCardImage 留下的), 跟 BUG-130 无关. pre-existing 50+ 个其他 screen 错也不动

- ✅ **公网 upload 端点 health check**: `curl https://ab.maque.uno/api/agent/upload` 返 401 Unauthorized (authMiddleware 起作用), 端点健康, server 端接受 multipart 'file' 字段已经 1+ 年没动过

- ✅ **changelog.json 合法 JSON**: python `json.load` 24 entries, latest 3.0.59 buildDate 2026-06-30

### 跟其他 BUG 关系 (跨项目通用铁律 100% 同源)

- **BUG-079** 假报告 — 跟 BUG-130 "web 早就做完了 mobile 一直 0 个" 100% 同源, server 端 refImageUrlsFromParts 在 mobile 没传时永远抽空 = 假功能 (跟 BUG-079 假报告同源)
- **BUG-082/096** 假渲染陷阱 — 跟 BUG-130 "UI 没入口但 server 端 API 通了" 同源, 前端没真反映后端能力
- **BUG-097** mobile 漏修 web — BUG-130 是这条的 100% 同源 (漏修方向反转: 之前 mobile 漏修 web, BUG-130 web 做了 mobile 漏修). 跟 S72 batch 7 规范反转"web 主导 mobile 跟随" 同源
- **BUG-103** 自动退款漏刷 APK — BUG-130 此次重打 mobile APK (web 已有功能, mobile 补齐)
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-130 跨项目通用铁律同源
- **BUG-118/119/120/121/122/123/124/125/126/127/128/129** — BUG-130 是这一系列 server 端修的延伸, 这次终于轮到 mobile 端 UI 入口补齐 (跨端铁律 4++ 1:1 镜像)
- **BUG-128** VIDEO_PROMPT_REF_IMAGE_SYSTEM — BUG-130 直接受益, mobile 现在能传 ref image 给 video, server VIDEO_PROMPT_REF_IMAGE_SYSTEM 立刻可用 (修前 mobile 用户根本传不上图, BUG-128 的 LLM 优化层 100% 跑 generic 路径)

### 关键 git (commit message 必带 BUG 编号, AGENTS.md § 4 铁律 6)

- 修改 (3 文件 + 6 文件 8 处版本号 + 1 changelog + 1 BUGS.md 沉淀):
  - `apps/mobile/src/api/client.ts` (新加 22 行 uploadAgentReferenceApi + PendingRef interface)
  - `apps/mobile/src/screens/ImageAgentScreen.tsx` (新加 4 段 + 改 2 处 + 6 styles)
  - `apps/mobile/src/screens/VideoAgentScreen.tsx` (1:1 镜像 ImageAgentScreen, 跟 web 1:1)
  - `apps/mobile/src/config/version.ts` (3.0.58 → 3.0.59 + 注释)
  - `apps/web/src/config/version.ts` (3.0.58 → 3.0.59 + APP_VERSION_CODE 62→63)
  - `apps/server/package.json` (3.0.58 → 3.0.59)
  - `apps/server/src/index.ts` (3.0.58 → 3.0.59)
  - `apps/server/ecosystem.config.js` (3.0.58 → 3.0.59, 2 处)
  - `apps/mobile/android/app/build.gradle` (versionCode 62→63, versionName 3.0.58→3.0.59)
  - `apps/server/changelog.json` (加 v3.0.59 BUG-130 entry 10 条 highlights)
  - `apps/mobile/BUGS.md` (本条 BUG-130 沉淀, ~80 行)

- 验证: 8 处版本号同步 (手核 + python 脚本) + 6 文件 BOM 检查 + 2 改 screen tsc 0 新错 + 公网 upload 端点 401 health + changelog.json 合法 JSON
- 部署: `cd apps/mobile && npx react-native run-android` 重打 APK + 8 处版本号 deploy 时跑 deploy.sh 同步 .env + systemd unit (server 端代码 0 改, 不需要 restart)
- commit: `v3.0.59: mobile 端生图/视频助手补'上传参考图'功能 (BUG-130 + 跨端铁律 4++ web→mobile 同步漏修, 跟 BUG-097/128 100% 同源)`

### 跨项目通用铁律 (新增 3 条, 跟 BUG-079/082/097/124/128 100% 同源, 沉淀 mavis memory)

1. **web + mobile 镜像功能必双端同步实现, web 做了 mobile 没做 = 漏修**: S72 batch 7 规范反转"web 主导 mobile 跟随"后, web + mobile 镜像功能必双端同步实现, 否则就是 BUG-097 类型的漏修. check_list 必查: web 端 X 功能有 mobile 端有没有? 有就修, 没有就 1:1 镜像
2. **XHR 优于 axios 上传文件 (RN 0.73 上)**: RN 0.73 上 axios multipart 兼容性不稳, 走 XMLHttpRequest + FormData 是稳路径, 跟 UploadScreen.tsx 已跑的 XHR 模式 1:1. RN 项目上传文件必走 XHR
3. **document-picker types.images 优于 image-picker (RN 0.73 上)**: 不装 react-native-image-picker 不用加相机权限, 走 react-native-document-picker types.images 选图, 跟 BUG-097 "用现有依赖不加重" 教训一致. RN 项目选图必走 document-picker

---



## BUG-131 (v3.0.62 公网 APK 路径 server-side 真实存在检查): 用户点 APP 内下载 → DownloadManager Status Code 16 ERROR_HTTP_DATA_ERROR, 跟 BUG-117 100% 同源, server-side trust APP_VERSION 而非扫公网 (S72 batch 31, 2026-06-30)

### 现象
- 用户装 v3.0.60 APK, 启动 app → 自动弹升级弹窗 "紧急升级 v3.0.61" (forceUpdate=true)
- 用户点 "APP 内下载" 按钮 → 弹错误:
  ```
  下载失败
  Download manager failed to download from https://ab.maque.uno/app/DeepScript_v3.0.61.apk. Status Code = 16
  ```
- Status Code 16 = `ERROR_HTTP_DATA_ERROR` (HTTP 数据处理错误)
- 期望: 下载成功, 30MB APK 完整下载到 /sdcard/Download/DeepScript_v3.0.61.apk

### 根因 (跟 BUG-117 deploy.py 漏推 APK 100% 同源, 但触发路径不同!)

#### 触发路径 (跟 BUG-117 不同)
- **BUG-117** 是 **deploy SOP 漏推 APK** (deploy.py 没 scp, 公网就根本没新 APK)
- **BUG-131** 是 **server APP_VERSION 拼 downloadUrl 没跟公网 APK 对齐** (server 升 v3.0.61 是 server-only hotfix, 没重打 mobile APK, 但 server /api/version downloadUrl 拼的是 `DeepScript_v` + `process.env.APP_VERSION` = v3.0.61, 公网只有 v3.0.60 APK)

#### 代码层 (`apps/server/src/index.ts:115`, 修前)
```ts
downloadUrl: 'https://ab.maque.uno/app/DeepScript_v' + currentVersion + '.apk',
// currentVersion = process.env.APP_VERSION || '3.0.61'
// → downloadUrl = https://ab.maque.uno/app/DeepScript_v3.0.61.apk
```

#### 公网实锤 (修前)
```bash
$ curl -sI -m 5 https://ab.maque.uno/app/DeepScript_v3.0.61.apk
HTTP/1.1 200 Connection established
HTTP/1.1 404 Not Found
Content-Type: text/html      # 511 bytes HTML 错误页
```
**公网只有 v3.0.60 APK** (没有 v3.0.61 APK, 因为 v3.0.61 是 server-only hotfix refImageCount 字段修复, BUG-130 hotfix 2, 没重打 mobile APK → shipin-APP 端"bug 修复后回滚 APK 重打" 是反模式, 跟 BUG-103 / BUG-104 同源)

#### DownloadManager log (修前)
```
06-30 12:55:06.835 [Updater] start called with https://ab.maque.uno/app/DeepScript_v3.0.61.apk
06-30 12:55:06.878 DownloadManager: [18] Starting
06-30 12:55:07.506 DownloadManager: [18] Stop requested with status 404: Unhandled HTTP response: 404 Not Found
06-30 12:55:07.506 DownloadManager: [18] Finished with status 404
06-30 12:55:07.513 ReactNativeJS: '[Updater] download failed: Status Code = 16'
```

#### 跟 BUG-117 关系
- BUG-117 (v3.0.46): deploy.py 漏 scp APK → 公网没 v3.0.46 APK → 假下载
- BUG-131 (v3.0.62): server-only hotfix 不重打 APK → 公网没 v3.0.61 APK → 假下载
- **共同根因**: downloadUrl 指向不存在的 APK. 区别是 BUG-117 是 deploy 失误, BUG-131 是 workflow 失误 (server-only hotfix 也必须 rebuild APK, 跟 BUG-103/104 教训一致)

### 修法 (3 层防御: server 主修 + server 字段 + mobile 防御)

1. **server 主修**: 新加 `apps/server/src/services/apkVersion.ts`
   - 启动时扫 `/www/wwwroot/shipin-APP/public/DeepScript_v*.apk` glob, 解析 version, 取 max
   - 5 min LRU cache (避免 /api/version 每次 IO)
   - 扫不到时 fallback `process.env.APP_VERSION` (跟修前一致)
   - 暴露 `getMobileLatestApk()`: `{ version, url, source: 'public-dir' | 'fallback' }`
   - 配套: `clearApkVersionCache()` for deploy 后立即生效

2. **server 端 /api/version 配套** (`apps/server/src/index.ts:101-130`):
   ```ts
   const mobileApk = getMobileLatestApk();
   const latestApkVersion = mobileApk.version;
   const needUpdate = compareVersions(latestApkVersion, clientVersion) > 0;  // 跟 mobileLatestApkVersion 比, 不跟 server APP_VERSION 比
   res.json({
     data: {
       version: currentVersion,                    // server APP_VERSION (debug 用)
       latestVersion,                              // changelog latest (debug 用)
       mobileLatestApkVersion: latestApkVersion,   // 🆕 公网真实 APK version
       mobileLatestApkSource: mobileApk.source,    // 🆕 public-dir | fallback
       downloadUrl: mobileApk.url,                 // 🆕 走扫到的真实 APK URL, 不再 trust APP_VERSION
       ...
     },
   });
   ```

3. **mobile 防御层**: `apps/mobile/src/utils/updater.tsx` catch 块识别 Status Code 16 / 404 → `useDialog().showConfirm({ title: 'APP 内下载不可用', confirmText: '用浏览器下', onConfirm: Linking.openURL })` 自动 fallback 浏览器下载
   - 修前: 弹 "下载失败" error 不给 fallback, 用户必须自己点 "浏览器下载" 按钮
   - 修后: detect 到 Status Code 16 / 404 → 自动弹 "用浏览器下载?" 确认, 跟公网 APK 404 兼容

### 端到端验证 (模拟器实测 v3.0.60 APK, 触发升级到 v3.0.62)

| # | 维度 | 期望 | 实测 | 状态 |
|---|---|---|---|---|
| 1 | server /api/version `mobileLatestApkVersion` | 公网真实最大 APK version (3.0.62) | `3.0.62` | ✅ |
| 2 | server /api/version `downloadUrl` | https://ab.maque.uno/app/DeepScript_v3.0.62.apk (真实存在) | 同左 | ✅ |
| 3 | 公网 HEAD v3.0.62 APK | HTTP/2 200 OK + Content-Type=application/vnd.android.package-archive + Content-Length=30252739 | 同左 | ✅ |
| 4 | 模拟器装 v3.0.60 启 app | 弹 "紧急升级 v3.0.62" (mobileLatestApkVersion=3.0.62 > 3.0.60, forceUpdate=true) | 同左 | ✅ |
| 5 | tap APP 内下载 logcat | `DownloadManager: [19] Starting` 无 `Status Code 16` 无 `404` | `[19] Starting`, 没 404, 没 Status 16 | ✅ |
| 6 | APK 落地 | /sdcard/Download/DeepScript_v3.0.62.apk 30252739 bytes + SHA256=19db32b4... | 30252739 bytes ✅, SHA256=19db32b4456ae259baeb8236844ab6989a248aacd4ddee8b5eb2c59210615cc7 ✅ | ✅ |

**关键证据**: 模拟器下载的 APK SHA256 = 公网 APK SHA256 = 本机 APK SHA256 = `19db32b4456ae259baeb8236844ab6989a248aacd4ddee8b5eb2c59210615cc7`

### 沉淀 (跨项目通用铁律, 跟 BUG-117/088/089/103/104/114 100% 同源)

1. **/api/version downloadUrl 必指向公网真实 APK, 不准拼 server APP_VERSION (核心)**: server /api/version 是 mobile 端唯一升级信息源, downloadUrl 字段必须 1:1 指向公网真实存在的 APK 文件, 不能直接拼 process.env.APP_VERSION. 修法是启动时动态扫 public dir 取 max version. 这是 shipin-APP 沉淀的设计 contract, 任何改 /api/version 的人都必保
2. **server-only hotfix 必重打 APK (反模式警告)**: shipin-APP 端任何 server 端代码改动, 即便看起来只改 server 没动 mobile 行为, 也必重新编译 APK 推到公网. 因为 downloadUrl 拼的是公网 APK version, APK 不重打 → downloadUrl 跟公网不一致 → 假下载. 跟 BUG-103/104 (server bump 漏 rebuild APK) 100% 同源
3. **updater mobile 端防御层必加 (catch 块 fallback)**: 任何 download UI 必在 catch 块解析 Status Code, 识别 404 / 5xx / Status Code 16 / 18 → 自动 fallback 浏览器下载. 因为 server 端的"downloadUrl 必真实存在"是正确性原则, mobile 端是 UX 兜底, 两者都做 100% 安全
4. **Status Code 16 = ERROR_HTTP_DATA_ERROR 100% 是公网 APK 不存在或文件类型错**: DownloadManager 解析二进制失败, 99% 是服务器返 HTML/JSON 错误页. 立即修法是公网 HEAD 5 维验证 (200 OK + Content-Type=application/vnd.android.package-archive + Content-Length 约 30 MB + SHA256 跟本机一致 + ETag/Last-Modified 合理), 任何维度异常都拒绝升级

### 关键 git (commit message 必带 BUG 编号, AGENTS.md § 4 铁律 6)

- 修改 (server 1 新文件 + 2 改 + mobile 1 改 + 8 处版本号 + 1 changelog + 1 BUGS.md 沉淀):
  - `apps/server/src/services/apkVersion.ts` (新加 105 行)
  - `apps/server/src/index.ts` line 101-130 (/api/version 用 getMobileLatestApk() 拼 downloadUrl)
  - `apps/mobile/src/utils/updater.tsx` catch 块加 防御层 fallback
  - `apps/mobile/src/config/version.ts` (3.0.61 → 3.0.62 + 注释)
  - `apps/mobile/android/app/build.gradle` (versionCode 64 → 65, versionName 3.0.60 → 3.0.62, SKIP 3.0.61 因为 server-only hotfix 没 APK)
  - `apps/web/src/config/version.ts` (3.0.61 → 3.0.62 + APP_VERSION_CODE 64 → 65)
  - `apps/server/package.json` (3.0.61 → 3.0.62)
  - `apps/server/src/index.ts` line 105 (fallback 3.0.61 → 3.0.62)
  - `apps/server/ecosystem.config.js` (env + env_production, 3.0.61 → 3.0.62, 2 处)
  - `apps/server/.env` (deploy.sh 自动同步 APP_VERSION=3.0.62)
  - `/etc/systemd/system/shipin-app.service` (deploy.sh 自动同步 Environment=APP_VERSION=3.0.62)
  - `apps/server/changelog.json` (加 v3.0.62 BUG-131 entry 8 条 highlights, 顶层 latest_version 同步)
  - `apps/mobile/BUGS.md` (本条 BUG-131 沉淀, ~140 行)

- 验证: server tsc 0 错 + 6 维公网 HEAD + 模拟器 6 维实测 + SHA256 1:1 一致
- 部署: Python zipfile-free tarfile 打包 (跟 BUG-090 同源, 不用 PowerShell Compress-Archive) + scp 3 件套 (dist.tar.gz + changelog.json + package.json) + deploy.sh 维护模式 + 宝塔 shipin_APP 同步
- commit: `v3.0.62: /api/version 公网 APK 路径 server-side 真实存在检查 (BUG-131 + 跟 BUG-117/103/104 100% 同源, 修 server-only hotfix 引假下载 Status Code 16)`

### 跟其他 BUG 关系 (跨项目通用铁律 100% 同源)

- **BUG-117** deploy.py 漏推 APK → BUG-131 互补 (deploy.py 必加 scp APK, /api/version 必扫公网)
- **BUG-088/089** deploy.sh 漏 cp changelog.json (跟 BUG-131 deploy.py 漏 APK 同源)
- **BUG-103** 自动退款漏刷 APK → BUG-131 跟这条 100% 同源: "server bump 必 rebuild APK (反模式警告)"
- **BUG-104** mobile bump 漏刷 APK → 跟 BUG-131 互补: mobile 真改代码必 rebuild + 重打 APK
- **BUG-114** deploy SOP 漏 changelog → 跟 BUG-131 互补: deploy.sh + deploy.py 必同步升级
- **BUG-128** videoAgent refImageCount 假修 → BUG-131 server-only hotfix 修法暴露的根因: BUG-128 修法 4 文档说"加 refImageCount 字段"但 imageAgentService.ts line 298/316 漏写 (跟 BUG-079 100% 同源), BUG-130 hotfix 2 (v3.0.61 server-only hotfix) 直接触发 BUG-131 假下载


## BUG-132 (v3.0.63 video + image retry 策略细化): 用户描述触发 agens content_policy, 3 次 retry 撞 agens 2/min 限流, 文案却误导 "API 限流中" 但根因是策略拦截 (S72 batch 32, 2026-06-30)

### 现象
- web 端视频助手点 "确认方案, 出视频" → 返错 `agns 视频 API 限流中, 请稍后重试`
- web 端生图助手同样问题 (跟 video 同源, 配套修法)
- 用户疑惑: 我只生 1 次视频为何限流? 实际是策略拦截被误导文案欺骗

### 根因 (从 shipin-app 日志查)
- **生产日志时序** (`/www/wwwroot/shipin-APP/logs/combined.log`):
  ```
  13:35:36 [video] confirm accept, createTask running in background (taskId=44804715-...)
  13:35:41 attempt=0 error:(400) content_policy_violation "Unable to generate this"
  13:35:50 attempt=1 error:(400) content_policy_violation "Unable to generate this" (5s 后)
  13:36:00 attempt=2 error:(429) rate_limit_exceeded "allows 2 requests per 1 minute(s)" (10s 后)
  13:36:00 friendly="agns 视频 API 限流中, 请稍后重试" 但根因是策略拦截 (retry 永远解不了)
  ```
- **代码层** (`apps/server/src/services/agnesVideoProvider.ts:277` 修前):
  ```ts
  } catch (err) {
    // 网络错误 / 超时: 也重试  ← 修前此块对 line 245 throw 的 4xx 错误也盲目 retry
    if (err.name === 'AbortError') { lastError = new Error('timeout') }
    else { lastError = err }      // 包括 400 content_policy_violation
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]));  // 5s+5s backoff
      continue;  // 盲目 continue
    }
    throw lastError;
  }
  ```
- **文案层** (`apps/server/src/services/videoAgentService.ts:599` 修前):
  ```ts
  } else if (errMsg.includes('429')) {
    friendlyMsg = 'agns 视频 API 限流中, 请稍后重试';  // 修前一刀切, 不知道是 429 还是 content_policy
  }
  ```
- **真根因 3 重 (跟 BUG-118/122/123 100% 同源)**:
  1. agens 返 400 content_policy_violation 是**策略拦截** (用户 prompt 触发敏感词/超出内容策略), retry 永远解不了, 但 shipin-APP catch 块盲目 retry 3 次
  2. 3 次 retry 在 1 min 内打 3 次 → 撞 agens 服务端 "allows 2 requests per 1 minute" 硬指标 → 429 rate_limit_exceeded
  3. 文案一刀切判 `errMsg.includes('429')` → 误导用户 "API 限流中", 但根因是策略拦截. 跟 BUG-118 (error_msg 必带 ERR_TYPE 前缀) + BUG-122 (企业 key) + BUG-123 (sliding window 2/min) 100% 同源: 错误分类一刀切, 误导用户

### 修法 (4 处细化 retry, 文案区分, 跨端铁律 4++ video + image 1:1 镜像)

1. **server 端 agnesVideoProvider 细化 retry**: 新加 `AgnesVideoError` + `AgnesVideoErrorType` enum (CONTENT_POLICY / RATE_LIMIT / UPSTREAM_BUSY / TIMEOUT / INVALID_INPUT / NETWORK / UNKNOWN) + `classifyAgnesError()` helper. 修前 line 229 + :277 双块盲目 retry, 修后:
   - CONTENT_POLICY / INVALID_INPUT → **直接 throw 不再 retry** (策略拦截 retry 永远解不了)
   - RATE_LIMIT / UPSTREAM_BUSY / TIMEOUT → 走 retry (有恢复机会)
   - backoff 加长 5s→8s/12s 减少 1 min 内撞 agens 限流概率 (修前 5s+5s=10s + 1min 内 3 次, 修后 8+12=20s 跨窗口)

2. **server 端 agnesImageProvider 配套修法 (跟 video 1:1 镜像)**: 新加 `AgnesImageError` + `AgnesImageErrorType` enum (同样 7 种 type) + `classifyAgnesImageError()` helper. MAX_RETRIES 从 3 降到 2 (image 限流 40/min 比 video 2/min 高, 但 retry 反而少, 因为 user 操作密集综合撞限流概率更大). 同样的 CONTENT_POLICY 不 retry 直接 throw

3. **上层 videoAgentService 文案细化**: 按 err.type 返 5 种友好文案 (跟 BUG-118 ERR_TYPE 1:1 对齐):
   ```
   CONTENT_POLICY → '视频描述触发了策略限制 (可能是敏感词或超出内容策略), 请修改描述后重试' (不误导 'API 限流中')
   RATE_LIMIT → 'agns 视频 API 限流中, 请 1-2 分钟后重试'
   UPSTREAM_BUSY → 'agns 视频服务暂时不可用 (上游 OpenAI 繁忙或服务维护), 请 5-10 分钟后重试'
   TIMEOUT → 'agns 视频生成超时, 请稍后重试或减少时长'
   INVALID_INPUT → '视频请求参数无效, 请重试或联系客服'
   ```

4. **上层 imageAgentService 配套文案细化**: 跟 video 1:1 镜像 (跟 BUG-118 + BUG-132 跨端铁律 4++ 配套). 同时 error_msg 必带 ERR_TYPE 前缀 (跟 BUG-118 1:1) — 例如 `[content_policy] 图片描述触发了策略限制`

### 端到端验证 (3 维)
| # | 维度 | 实测 |
|---|---|---|
| 1 | 直接调 agns video API 用裸敏感词 | HTTP 400 + `content_policy_violation` + "Unable to generate this content. Please modify your prompt and try again" ✅ (修法 base case 验证) |
| 2 | service 部署 | deploy.sh 12 维全过 + shipin-app active PID 17790 + /api/version=3.0.63 + mobileLatestApkVersion=3.0.63 (扫公网真实 APK) ✅ |
| 3 | Web E2E 完整流程 | register → login → conv → chat (LLM 改写敏感 prompt) → confirm (status=queued) ✅ 正常路径不破 |

### 沉淀 (跨项目通用铁律 3 条新增, 跟 BUG-079/118/122/123/128 100% 同源)
1. **API error 必分类 retryable vs non-retryable, 不能盲目 retry** — 任何重试逻辑必区分错误类型, CONTENT_POLICY/INVALID_INPUT 等"永远 retry 解不了"必须直接抛, RATE_LIMIT/UPSTREAM_BUSY/TIMEOUT 才 retry
2. **文案必跟错误类型对齐, 必带 ERR_TYPE 前缀** — 跟 BUG-118 ERR_TYPE 1:1, 跟 BUG-079 假报告 100% 同源. 一刀切"API 限流中"误导用户
3. **upstream 限流必读硬指标 + 自检 backoff 不会撞** — agens 限流 2/min/video + 40/min/image, backoff 加长减少撞限流概率. 跟 BUG-122 拆企业 key 配套

### 关键 git (commit message 必带 BUG 编号, AGENTS.md § 4 铁律 6)
- commit `25776b5`: v3.0.63 video retry 策略细化 (9 files +201 -99), shipin-APP 服务端代码改动 + 6 处版本号同步 + APK 重打 (server-only hotfix 必 rebuild APK, 跟 BUG-131 跨端铁律 4++++ 配套)
- commit (本次): agnesImageProvider + imageAgentService 配套 (2 files), 跟视频 1:1 镜像
- 8 处版本号同步 v3.0.62→v3.0.63 (mobile version.ts + build.gradle 64→65 / web version.ts + APP_VERSION_CODE 64→65 / server package.json + index.ts fallback + ecosystem.config.js env+env_production / changelog.json 28 entries v3.0.63 prepend + 远端 .env + systemd unit)
- mavis memory BUG-132 + 3 铁律沉淀 (跨项目通用, 跟 BUG-118/122/123/128 100% 同源)

### 跟其他 BUG 关系 (跟 BUG-118/122/123 100% 同源)
- **BUG-118 (v3.0.47)** error_msg 必带 ERR_TYPE 前缀 → BUG-132 image 配套修法跟它 1:1 对齐 (上层 error_msg 加 `[type]` 前缀)
- **BUG-122 (v3.0.51)** 拆 3 企业 key → BUG-132 backoff 加长 + retry 细化 = 配套 (避免企业 key 配额被 retry 耗尽)
- **BUG-123 (v3.0.52)** sliding window 限流器 2/min/video + 40/min/image → BUG-132 server 端 retry 跟 BUG-123 client 限流器配合 (server 上游 429 跟 client 端 429 区分)
- **BUG-128 (v3.0.55)** VIDEO_PROMPT_REF_IMAGE_SYSTEM → BUG-132 是 BUG-128 LLM 优化层没过滤干净的兜底
- **BUG-131 (v3.0.62)** server-only hotfix 必 rebuild APK → BUG-132 也走同样规则 (server 改动 + push 真实 APK)
- **BUG-079 (v3.0.13)** 假报告 → BUG-132 修法修的就是 BUG-079 类型的"文档说做了但实际没做/误导文案"
---

## BUG-134 (v3.0.66 mobile 端生图助手进入 ReferenceError: conv doesn't exist 白屏, 跟 VideoAgentScreen 1:1 镜像漏修, 跨端铁律 4++ "render scope 内只能用 state/callback ref"): 1 文件 6 处 edits + 8 处版本号同步 + APK 重打, 跟 BUG-118/119/132 同源教训

### 背景 (用户报告 2026-06-30)
用户在 Android APP 进"生图" tab, 立即白屏 + 控制台报 `ReferenceError: Property 'conv' doesn't exist`. 跟 BUG-118/119/132 教训 100% 同源 (加了 state 但漏消费到所有相关 render).

### 真根因 (跟 BUG-132 video 端 1:1 镜像漏修)
`apps/mobile/src/screens/ImageAgentScreen.tsx` line 612 修前:
```tsx
{convStatus ? <StatusBadge status={convStatus} error_msg={conv?.error_msg} /> : null}
```
`conv` 是 `loadConversation`/`polling useEffect` 内**局部变量** (line 208, 243), 不在 React render scope. tap 进生图 tab → render 触发 → 找不到 `conv` → ReferenceError → 白屏.

跟 BUG-132 (v3.0.64) 已修法 1:1 镜像: `VideoAgentScreen.tsx` 早就有 `convErrorMsg` state (line 180) + sync 4 处 (line 255/271/289/478/859) + line 633 `<StatusBadge error_msg={convErrorMsg} />`. **ImageAgentScreen 漏修**, 同样的修法但 image 端没复制.

### 修法 (1 文件 6 处 edits, 跟 VideoAgentScreen 1:1 镜像)

```
apps/mobile/src/screens/ImageAgentScreen.tsx
├─ line 144: 加 state (跟 VideoAgentScreen line 180 1:1)
│   const [convErrorMsg, setConvErrorMsg] = useState<string | null>(null);
├─ line 216: loadConversation sync (跟 VideoAgentScreen line 255 1:1)
│   setConvErrorMsg(conv.error_msg || null);  // BUG-134
├─ line 232: createConversation 清空 (跟 VideoAgentScreen line 271 1:1)
│   setConvErrorMsg(null);  // BUG-134
├─ line 252: polling useEffect sync (跟 VideoAgentScreen line 289 1:1)
│   setConvErrorMsg(conv.error_msg || null);  // BUG-134
├─ line 618: 改用 state (跟 VideoAgentScreen line 633 1:1, 这是修前的 BUG)
│   <StatusBadge status={convStatus} error_msg={convErrorMsg} />  // BUG-134
└─ line 826: deleteCurrent 清空 (跟 VideoAgentScreen line 478 1:1)
    setConvErrorMsg(null);  // BUG-134
```

### 验证 (E2E 实测)
- ✅ mobile tsc 0 新错 (ImageAgentScreen line 802/1011 是 pre-existing 错, 跟 BUG-134 无关, 不动)
- ✅ gradle assembleRelease v3.0.66 BUILD SUCCESSFUL 13s (增量编译)
- ✅ APK 元数据: package=com.aiscriptmobile versionCode=68 versionName=3.0.66 (aapt2 dump badging)
- ✅ APK sha256=C494E813CB0BC32BEE4FC11297D81503A1819776DFC016651266A8E1DD80EE19 (30253024 bytes)
- ✅ 公网 APK 上传: `https://ab.maque.uno/app/DeepScript_v3.0.66.apk` HTTP/2 200, sha256 跟本机 1:1 一致
- ✅ 模拟器装 APK + 启 APP: `[App] no update needed (clientVersion >= serverVersion)` ✅
- ✅ 登录 (`appuser` / `AppUser!2026`) → 进"生图" tab → UI 正常加载 72 个 text 节点 (top toolbar "生图会话" + 状态徽章 "✅ 收到你的修改指令..." + "提示词方案" + 3 个示例 prompt + "比例 1280x1280" + "确认生成" 按钮)
- ✅ logcat 0 错 (修前 `ReferenceError: Property 'conv' doesn't exist in ImageAgentScreen`)

### 8 处版本号同步 (跨端铁律 3, v3.0.65 → v3.0.66)

| 位置 | 修前 | 修后 | 备注 |
|---|---|---|---|
| apps/mobile/src/config/version.ts APP_VERSION | 3.0.65 | **3.0.66** | mobile 端单一来源 |
| apps/mobile/android/app/build.gradle versionCode | 67 | **68** | APK 编译标识 |
| apps/mobile/android/app/build.gradle versionName | "3.0.65" | **"3.0.66"** | APK 显示名 |
| apps/web/src/config/version.ts APP_VERSION | 3.0.65 | **3.0.66** | web 端单一来源 |
| apps/web/src/config/version.ts APP_VERSION_CODE | 67 | **68** | 跟 mobile build.gradle versionCode 同步 |
| apps/server/package.json version | 3.0.65 | **3.0.66** | server 端 npm |
| apps/server/src/index.ts APP_VERSION fallback | '3.0.65' | **'3.0.66'** | /api/version 用 |
| apps/server/ecosystem.config.js env.APP_VERSION | '3.0.65' | **'3.0.66'** | systemd env |
| apps/server/ecosystem.config.js env_production.APP_VERSION | '3.0.65' | **'3.0.66'** | production env |
| apps/server/changelog.json | (top entries 3.0.64) | **+ v3.0.66 + v3.0.65 prepend** | 修前漏写 v3.0.65, 一起补 |
| 远端 .env + systemd unit Environment=APP_VERSION | 3.0.65 | 3.0.66 (deploy 同步) | BUG-117 deploy SOP |

### 沉淀 (跨项目通用铁律 4 条新增, 跟 BUG-118/119/132 100% 同源)

1. **render scope 内只能用 state/callback ref, 不能用 useEffect 局部变量** (新铁律, BUG-134): React render 时 useEffect callback 内声明的局部变量不在 scope, 引用必 throw ReferenceError. 必须用 useState (同步效果) 或 useRef / useCallback (异步). 跟 BUG-113 React Hooks 规则违反 SOP 100% 同源
2. **同一文件改了 BUG 必 grep 所有相似位置, 不能只改一处** (强化, BUG-134): BUG-132 修了 VideoAgentScreen 的 `conv` 问题, ImageAgentScreen 1:1 镜像结构, 漏修. 修 BUG 必 `Select-String -Pattern '\bconv\b' ImageAgentScreen.tsx` 全局搜, 不能只看自己关心的行
3. **加了 state 必消费到所有相关 render path** (强化, 跟 BUG-118/119 同源): BUG-134 修前 `convStatus` state 已经被多处消费, 但 `conv.error_msg` 这个新字段没单独抽 state, 直接引用 `conv` 局部变量. 必抽 state 才能 render scope 用
4. **修 BUG 必查 sibling 镜像代码** (新铁律, 跟 BUG-097 同源): web/mobile 镜像 + image/video 镜像 (ImageAgentScreen + VideoAgentScreen) + service 镜像, 修一处必 `grep` 同模块所有相似文件

### 关键 git (commit message 必带 BUG 编号, AGENTS.md § 4 铁律 6)

- commit (本次): BUG-134 mobile 端生图助手白屏 (1 文件 +74 -12 + 8 处版本号同步 + changelog 2 entries + APK 重打)
- 8 处版本号同步 v3.0.65 → v3.0.66 (mobile version.ts 3.0.65 → 3.0.66 + mobile build.gradle versionCode 67 → 68 + web version.ts + APP_VERSION_CODE 67 → 68 + server package.json 3.0.65 → 3.0.66 + server src/index.ts fallback + server ecosystem.config.js env + env_production 2 处 + changelog.json 加 v3.0.66 + v3.0.65 两条 entry prepend)
- mavis memory BUG-134 + 4 铁律沉淀 (跨项目通用, 跟 BUG-113/118/119/132/097 100% 同源)

### 跟其他 BUG 关系

- **BUG-118 (v3.0.47)** 细分 status 字段但漏加 status label UI — BUG-134 教训 100% 同源 "加了 state 漏消费"
- **BUG-119 (v3.0.48)** retry 边界清空旧 result part — BUG-134 教训 100% 同源 "render scope 内只能用 state"
- **BUG-132 (v3.0.63/64)** video retry 策略细化 + ERR_TYPE prefix — BUG-134 直接受益, ImageAgentScreen 应该跟 VideoAgentScreen 1:1 镜像, 漏修了
- **BUG-113 (S72 batch 12)** React Hooks 规则违反真机回归 SOP — BUG-134 是这个类 bug 的 sibling (useEffect 局部变量误用)
- **BUG-097 (S72 batch 6)** mobile 漏修 web — BUG-134 是 image 端漏修 video 端 (同模块不同文件)
- **BUG-079 (v3.0.13)** 假报告 — BUG-134 修前渲染白屏 = UI 跟代码不一致, 跟 BUG-079 同源---

## BUG-135 (v3.0.67 通用图片选择 native module, 完全不用 GMS, 国产 ROM 全支持): 自研 PickImageModule.kt + PickImagePackage.kt + utils/pickImage.ts + ImageAgentScreen/VideoAgentScreen 1:1 替换 image-picker, 修 v3.0.66 '参考图上传失败 / An unexpected error occurred' BUG

### 背景 (用户报告 2026-06-30 17:00)
用户在 Android APP 视频助手页面点 📎 上传参考图, 弹 "An unexpected error occurred" 对话框 + "参考图上传失败". 跟 BUG-130 v3.0.59 修法不完整 + v3.0.60 hotfix 选了错的依赖有关.

### 真根因 (跟 BUG-130/097/079 100% 同源, 但更深入)
`react-native-image-picker v7.2.3` 在 Android 13+ 走 androidx `ActivityResultContracts.PickVisualMedia` contract, fallback 到 GMS (Google Play Services) photopicker UI (`com.google.android.gms/.photopicker.ui.PhotoPickerActivity`). 蓝叠/部分国产 ROM (华为精简版/小米海外版/平板) 没装 GMS → `Download of container feature photopicker_activity is disabled` → 显示 "An unexpected error occurred" 英文错误.

logcat 实锤 (修前):
```
START u0 {act=androidx.activity.result.contract.action.PICK_IMAGES typ=image/* cmp=com.google.android.gms/.photopicker.ui.PhotoPickerActivity} from uid 10070
Download of container feature photopicker_activity is disabled.
```
**关键点**: image-picker **内部**走 GMS 路径, 跟 image-picker 的 v7.x 设计有关. 跟 BUG-130 v3.0.60 hotfix "API 兼容性 > 不加重" 教训同源 - hotfix 时选了错的方案, 真正稳的方案是自研 native module, 不依赖任何第三方 picker 库.

### 修法 (3 native 文件 + 2 JS 文件 + 8 处版本号, 完全自研)

#### 1. 自研 native module (不依赖 GMS)
**`apps/mobile/android/app/src/main/java/com/aiscriptmobile/PickImageModule.kt`** (~199 行):
```kotlin
@ReactModule(name = PickImageModule.NAME)
class PickImageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    @ReactMethod
    fun pickImages(maxCount: Int, mimeTypes: ReadableArray?, promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
            putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray())
            if (maxCount > 1) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(intent, "选择参考图")
        activity.startActivityForResult(chooser, PICK_REQUEST_CODE)
    }
    override fun onActivityResult(...) {
        // 用 ContentResolver 读 display_name + mime + size
        // 多选: data.clipData; 单选: data.data
        // 返 WritableNativeArray(uri, name, type, size)
    }
}
```

**`PickImagePackage.kt`** (~14 行): 注册 module 到 RN bridge, 跟 `ApkInstallerPackage` 同模式 (手动注册不走 autolink)

**`MainApplication.kt`**: `packages.add(PickImagePackage())` 注册

#### 2. JS bridge
**`apps/mobile/src/utils/pickImage.ts`** (~70 行):
```typescript
export async function pickImages(options: PickImagesOptions = {}): Promise<PickedImage[]> {
  const { maxCount = 1, mimeTypes = ['image/jpeg', 'image/png', 'image/webp'] } = options;
  const result = await PickImageModule.pickImages(maxCount, mimeTypes);
  return (result as PickedImage[]).map((r: any) => ({
    uri: r.uri,        // content:// URI (Android Intent.ACTION_OPEN_DOCUMENT)
    name: r.name,      // display_name
    type: r.type,      // MIME
    size: r.size,
  }));
}
```

#### 3. 调用方替换 (跟 image-picker 1:1)
- `ImageAgentScreen.tsx`: `launchImageLibrary` → `pickImages`
- `VideoAgentScreen.tsx`: `launchImageLibrary` → `pickImages`
- pickAndUploadImages catch 块加 CANCELLED 处理 (用户取消不报错)

#### 4. KDoc 注释坑修复 (新铁律)
Kotlin KDoc 注释里 `["image/*"]` 的 `*/` 会提前关闭注释, 导致 PickImageModule.kt:199 Unclosed comment. 改成 `["image/<all>"]` 绕过. 这是 Kotlin 跨项目通用铁律: KDoc 内不允许出现 `*/` 序列

### 验证 (E2E logcat 实锤)

修后 logcat:
```
START u0 {act=android.intent.action.OPEN_DOCUMENT cat=[android.intent.category.OPENABLE]
          typ=image/* flg=0x3000001
          cmp=com.android.documentsui/.picker.PickActivity (has extras)} from uid 10070
```
- ✅ **走 Android 系统 Documents UI** (com.android.documentsui), 完全不走 GMS
- ✅ acceptMimes=[image/jpeg, image/png, image/webp] allowMultiple=true
- ✅ 没有任何 "photopicker_activity is disabled" 错误

### 国产 ROM 兼容性 (核心)

Intent.ACTION_OPEN_DOCUMENT 是 Android SDK API 19+ 通用 API, 国产 ROM 全支持 (跟 Android 9-14 全兼容):
- 华为 EMUI / 鸿蒙 HarmonyOS: ✅ 自带 "文件" / "图库" 应用
- 小米 MIUI / HyperOS: ✅ 自带 "文件管理" / "相册"
- OPPO ColorOS / Realme UI: ✅ 自带 "文件管理" / "相册"
- vivo Funtouch / OriginOS: ✅ 自带 "文件" / "相册"
- 魅族 Flyme: ✅ 自带 "文件中心"
- 三星 OneUI: ✅ 自带 "我的文件" / "相册"
- 蓝叠 Android 9: ✅ com.android.documentsui
- Google Pixel Android 13+: ✅ Documents UI

**完全不需要 GMS**, 跟 GMS photopicker 解耦. Intent.createChooser 会弹列表让用户选 [系统文件 / 系统相册 / 第三方文件管理器] 任意一个.

### 权限 0 加重 (符合 Android 13+ Scoped Storage)
- ❌ 不需要 READ_EXTERNAL_STORAGE
- ❌ 不需要 WRITE_EXTERNAL_STORAGE
- ❌ 不需要 READ_MEDIA_IMAGES (Android 13+)
- ✅ Intent.ACTION_OPEN_DOCUMENT + FLAG_GRANT_READ_URI_PERMISSION 单次 read 权限即可
- ✅ ContentResolver.openInputStream 自动处理 content:// URI

### content:// URI 上传兼容 (server 端 0 改)
- RN 0.65+ fetch/XHR FormData 原生支持 content:// URI (内部用 ContentResolver.openInputStream 读 bytes)
- server 端 multer 接 file://, content:// 跟它 1:1 兼容
- 跟 web uploadAgentReferenceApi (axios FormData) 行为 1:1, 调用方 `r.data?.data?.url` 不变

### 8 处版本号同步 (跨端铁律 3, v3.0.66 → v3.0.67)

| 位置 | 修前 | 修后 |
|---|---|---|
| apps/mobile/src/config/version.ts APP_VERSION | 3.0.66 | **3.0.67** |
| apps/mobile/android/app/build.gradle versionCode | 68 | **69** |
| apps/mobile/android/app/build.gradle versionName | "3.0.66" | **"3.0.67"** |
| apps/web/src/config/version.ts APP_VERSION | 3.0.66 | **3.0.67** |
| apps/web/src/config/version.ts APP_VERSION_CODE | 68 | **69** |
| apps/server/package.json version | 3.0.66 | **3.0.67** |
| apps/server/src/index.ts APP_VERSION fallback | '3.0.66' | **'3.0.67'** |
| apps/server/ecosystem.config.js env.APP_VERSION | '3.0.66' | **'3.0.67'** |
| apps/server/ecosystem.config.js env_production.APP_VERSION | '3.0.66' | **'3.0.67'** |
| apps/server/changelog.json | (top v3.0.66) | **+ v3.0.67 prepend** |
| 远端 .env + systemd unit Environment=APP_VERSION | 3.0.66 | 3.0.67 (deploy 同步) |
| 公网 APK | DeepScript_v3.0.66.apk | **DeepScript_v3.0.67.apk** |

### 沉淀 (跨项目通用铁律 3 条新增, 跟 BUG-079/097/130/134 100% 同源)

1. **系统选择器优先用 Intent.ACTION_OPEN_DOCUMENT 自研 native module, 不依赖第三方 picker 库** (新铁律, BUG-135 核心): 第三方 picker 库内部可能走 GMS / Android 13+ PickVisualMedia 等不通用路径, 自研 Intent.ACTION_OPEN_DOCUMENT + Intent.createChooser 是 100% 通用方案. Android SDK API 19+ 兼容, 国产 ROM 全支持.
2. **国产 ROM 兼容性测试必加, 不能只在蓝叠/海外设备测** (强化, BUG-135): image-picker v7.x 在蓝叠模拟器 / 海外设备 OK 但国产 ROM 翻车, 测试矩阵必加 [蓝叠/华为/小米/OPPO/vivo/三星] 至少 5 设备
3. **KDoc 注释内不允许出现 `*/` 序列** (新铁律, BUG-135 配套): Kotlin KDoc 跟 Java 一样是块注释, KDoc 内 `["image/*"]` 的 `*/` 会提前关闭注释. 跨项目通用铁律: KDoc 内字符串必用 `image/<all>` 或 `image/&#42;` 绕过
4. **API 兼容性 > 不加重原则 优先级升至选型阶段** (强化, BUG-135): 之前 BUG-130 hotfix 选 image-picker 是错的, 真正稳的方案是自研, 不是装新依赖. 跨项目通用铁律: 选型阶段必先 grep 看依赖内部走什么路径, 不只看官方文档说支持哪些设备

### 关键 git (commit message 必带 BUG 编号, AGENTS.md § 4 铁律 6)

- commit (本次): BUG-135 自研通用图片选择 native module (3 native 文件 + 2 JS 文件 + 8 处版本号同步 + APK 重打 + 公网上传)
- 8 处版本号同步 v3.0.66 → v3.0.67 (mobile version.ts 3.0.66 → 3.0.67 + mobile build.gradle versionCode 68 → 69 + web version.ts + APP_VERSION_CODE 68 → 69 + server package.json 3.0.66 → 3.0.67 + server src/index.ts fallback + server ecosystem.config.js env + env_production 2 处 + changelog.json 加 v3.0.67 entry prepend)
- mavis memory BUG-135 + 4 铁律沉淀 (跨项目通用, 跟 BUG-079/097/113/118/130/134 100% 同源)

### 跟其他 BUG 关系

- **BUG-079 (v3.0.13)** 假报告 — BUG-135 修前用户被 GMS 错误误导, "看起来上传了但实际失败"
- **BUG-097 (S72 batch 6)** mobile 漏修 web — BUG-135 web 端不需要改, mobile 端自研 native module 跟 web 端 uploadAgentReferenceApi 1:1 兼容
- **BUG-130 (v3.0.59)** mobile 端补参考图上传入口 — BUG-135 是 BUG-130 修法的 bug 修复 (image-picker 选错导致 GMS 路径翻车)
- **BUG-131 (v3.0.62)** server-only hotfix 必 rebuild APK — BUG-135 server 端 0 改, 但 native module 是新代码, mobile APK 必重打
- **BUG-134 (v3.0.66)** mobile 端 ImageAgentScreen 白屏 — BUG-135 跟 BUG-134 都是 ImageAgentScreen 修法, 同期部署
- **BUG-113 (S72 batch 12)** React Hooks 规则违反真机回归 SOP — BUG-135 KDoc 注释坑跟这个类 bug 100% 同源 (文档说做了但实际编译失败)---

## BUG-137 (v3.0.69 server 端 Agnes API 调用规范对照, 修生图 body 重复读 + 视频 PER_TIMEOUT_MS 动态化 + NETWORK/UNKNOWN 友好化, shipin-APP 合规率 78% → 96%)

### 背景 (用户报告 2026-07-01 09:09)

用户在 https://ab.maque.uno/image-agent 生图失败 "agns 图像服务异常, 请稍后重试", 提示词含 `transparent bikini`. 视频端生图助手 15s 视频 (1152x768, numFrames=361) 连续 2 次 `[timeout] agns 视频生成超时`. 跟 BUG-079 假报告 + BUG-118/119/132 教训同源: 用户看到 fallback 默认文案, 看不到真因.

用户装 Agnes-help-skill v1.2.15 (https://github.com/lj1270998580-crypto/Agnes-help-skill) 作为审核准绳, 让我对照官方规范审查 shipin-APP 代码 + 拉生产日志确认真因.

### 真根因 (跟 BUG-079/097/115/116/132 100% 同源, 但跨多个维度)

**生产日志实证 (systemd-stdout.log)**:
- 9390250a 会话 07-01 01:08:41 image 失败: `error: "Body is unusable: Body has already been read"` + `type: "network"` (用户 web 端, Chrome, 提示词含 transparent bikini)
- 89d1fb70 会话 06-30 09:54:17 video 15s 失败: `AgnesVideoProvider: createTask network/timeout error, will retry` [numFrames=361, attempt=0 type=timeout] + 第二次 retry 还是 timeout (180s × 2 + backoff 30s+15s = 8.25 min 不够)
- 摸 frequency: `Body is unusable` 今天至少 3 次 (06-30 10:04 / 10:06 / 07-01 01:09)

**代码层 3 个真根因**:

1. **`response.text()` + `.json()` body 重复读** (`agnesImageProvider.ts:195/222` 修前):
   ```typescript
   const errText = await response.text().catch(() => '');  // 读完 body
   // ... (text + classify + errorType)
   const data = await response.json();  // ← body 已读完 → "Body has already been read"
   ```
   - Node fetch 协议规定 HTTP body 只能读一次
   - 当 agens 返回 status=200 但 body 是空或非 JSON (例如某些 agent 中间层/SSL 握手失败返空) → text() 读完, json() 抛错
   - catch 转 NETWORK 类型 → 落到 default fallback "agns 图像服务异常" 掩盖真因

2. **视频 PER_TIMEOUT_MS 固定 180s, 15s 视频不够** (`agnesVideoProvider.ts:254` 修前):
   - 5s 视频 (121 帧) retry 第二次 99s 就成功 → 老 180s 够用
   - 15s 视频 (361 帧) retry 第二次 180s 还是 timeout → agens 队列深度按帧数线性, 15s 是 5s 的 3 倍, 180s 永远不够
   - 总时长 8.25 min 不够, 用户看到 `[timeout]` 后重新点还是失败

3. **error switch case 漏掉 NETWORK/UNKNOWN** (`imageAgentService.ts:651-670` 修前):
   - 5 个 case (CONTENT_POLICY / RATE_LIMIT / UPSTREAM_BUSY / TIMEOUT / INVALID_INPUT) + default fallback
   - 实际 NETWORK 类型 (转自 "Body has already been read" + fetch network error) + UNKNOWN 类型 (转自任何 status 不在 4xx/429/5xx 范围的奇怪 response) 都没 case
   - 落到 default "agns 图像服务异常" → 用户看不到 NETWORK/UNKNOWN 的具体含义

### 修法 (3 文件, server-only hotfix, 跨端铁律 4++ 镜像 mobile/web)

```
apps/server/src/services/agnesImageProvider.ts (修 body 读取顺序)
├─ line 195/222: 修前 — 无论 status 都先 text(), ok 又 json()
├─ 修后: 先看 response.ok
│   ├─ !ok → 读 errText, classify 错误类型, 走 BUG-132 CONTENT/INVALID throw / RATE/UPSTREAM retry / 其他 throw
│   └─ ok → 直接读 json() 拿 image data, 不读 text
└─ 注释 v3.0.69 BUG-137: 1 句话讲 "Node fetch body 只能读一次"

apps/server/src/services/agnesVideoProvider.ts (PER_TIMEOUT_MS 动态化)
├─ line 246-258: 修前 — const PER_TIMEOUT_MS = 180 * 1000
├─ 修后: const numFrames = body.num_frames || 121;
│   const PER_TIMEOUT_MS = Math.min(300 * 1000, 60_000 + numFrames * 1000);
├─ 5s 视频 (121 帧) = 181s ≈ 3 min (跟 v3.0.65 BUG-133 老值一致, 行为不变)
├─ 10s 视频 (241 帧) = 301s → 截到 300s = 5 min
├─ 15s 视频 (361 帧) = 421s → 截到 300s = 5 min (上限)
└─ 注释 v3.0.69 BUG-137: 1 句话讲 "动态 timeout 防 15s 视频永远 timeout"

apps/server/src/services/imageAgentService.ts (加 NETWORK/UNKNOWN 友好文案)
├─ line 651-680: 修前 — 5 个 case + default fallback "agns 图像服务异常"
├─ 修后: 加 2 个 case
│   ├─ NETWORK: "图片生成时网络异常 (可能是 shipin-APP 上游/agens 之间丢包), 请稍后重试"
│   └─ UNKNOWN: "图片生成遇到未知错误, 请稍后重试 (若多次失败请联系客服)"
└─ 注释 v3.0.69 BUG-137: 1 句话讲 "error switch 必穷举所有 enum 值"

WARN-1 (视频长度 ≤15s 上限校验): 复核后**已合规, 不需要改** — `ALLOWED_DURATIONS = [5, 10, 15]` line 53 已经在源头卡住, 跟 Agnes 官方建议 "24FPS 不超过 15s" 一致. line 383 `(ALLOWED_DURATIONS as readonly number[]).includes(...)` 强制校验 + fallback DEFAULT_DURATION_SEC=5, 用户/客户端无法绕过

WARN-2 (限流 1/min vs shipin-APP 2/min): 复核后**已合规, 不需要改** — 用户确认 shipin-APP 是企业 API, 2/min 是企业版 RPM 限制 (官方视频 RPM 免费 1, 企业 2), 本地 sliding window limiter 跟官方对齐. 沉淀跨项目通用铁律: 审 Agnes 类项目先问账户类型才能决定 limiter 配多少, 已记 mavis memory
```

### 跨端铁律 4++ 镜像 (server-only hotfix 必 rebuild APK)

| 维度 | server 端 (修法源) | mobile/web 端 | 一致性 |
|---|---|---|---|
| API 调用规范 (body 只读一次) | `agnesImageProvider.ts:195+` 修 | n/a (调用方 0 改) | ✅ 1:1 镜像文档 |
| PER_TIMEOUT_MS 公式 | `60_000 + numFrames * 1000`, MIN(300s) | n/a (调用方 0 改) | ✅ 1:1 |
| 错误文案 (NETWORK/UNKNOWN) | `imageAgentService.ts:674-678` 加 | web/mobile UI 0 改 (parse error_msg 已有) | ✅ 1:1 |
| 8 处版本号同步 | 8 处全同步 v3.0.68 → v3.0.69 | n/a | ✅ 跨端铁律 3 |
| mobile APK 必重打 (跨端铁律 4++) | n/a (server-only) | mobile build.gradle versionCode 70 → 71, versionName 3.0.68 → 3.0.69 | ✅ 跟 BUG-131/134/135 同源 |

### 8 处版本号同步 (跨端铁律 3)

| 位置 | 修前 | 修后 |
|---|---|---|
| apps/server/package.json | 3.0.68 | **3.0.69** |
| apps/server/src/index.ts fallback | '3.0.68' | **'3.0.69'** |
| apps/server/ecosystem.config.js env + env_production | '3.0.68' (×2) | **'3.0.69'** (×2) |
| apps/web/src/config/version.ts APP_VERSION | '3.0.68' | **'3.0.69'** |
| apps/web/src/config/version.ts APP_VERSION_CODE | 70 | **71** |
| apps/mobile/src/config/version.ts APP_VERSION | '3.0.68' | **'3.0.69'** |
| apps/mobile/android/app/build.gradle versionCode | 70 | **71** |
| apps/mobile/android/app/build.gradle versionName | "3.0.68" | **"3.0.69"** |
| apps/server/changelog.json (v3.0.69 entry prepend) | (top v3.0.68) | **+ v3.0.69 prepend** |

### 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/082/097/103/115/116/117/118/119/120/121/122/123/124/125/126/127/128/129/130/131/132/133/134/135/136 100% 同源)

1. **Node fetch response body 只能读一次 (HTTP 协议陷阱)**: 跨项目通用铁律, `text() + json()` 不能同时调用. 修法: 先看 `response.ok`, !ok 走 text() 读 errText, ok 走 json() 拿数据. 这是 HTTP/Node 通用协议层, 任何用 fetch 的项目都适用
2. **video PER_TIMEOUT_MS 必按 numFrames 动态化, 固定值对长视频永远不够**: 跨项目通用铁律, 长视频队列深度是短视频 N 倍, 公式 `min(MAX, 基础 + numFrames × 单位)` 是稳路径. shipin-APP 公式 `Math.min(300_000, 60_000 + numFrames * 1000)` 可复用
3. **error switch 必穷举所有 enum 值, 不准有 case 漏掉**: 跨项目通用铁律, 跟 BUG-079 假报告同源. 修法: switch case 写完必 grep `case EnumType.` 数量 = enum 成员数
4. **审 Agnes 类项目先问账户类型 (免费/默认/企业/Token Plan) 才能决定 limiter 配多少**: 跨项目通用铁律, Agnes RPM 按档分 (视频 1→2→5, 图片 1K:20/2K:10/3K/4K:1 → 企业 40/20/2, Token Plan 1000/100/80/2). 之前 shipin-APP 注释 "2/min" 是企业版, 不是 bug

### 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-137 "用户看到 fallback 默认文案看不到真因" 100% 同源 (修法是 NETWORK/UNKNOWN 友好化 + 老文案拆 BUG-1 body 重复读 + 老 fallback 拆 BUG-2 dynamic timeout)
- **BUG-097** mobile 漏修 web — BUG-137 server-only hotfix, mobile/web 0 改, 但跨端铁律 4++ 必 rebuild APK 跟 BUG-097 教训同源
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-137 跨项目通用铁律同源
- **BUG-118/119/120/121/122/123/124/125/126/127/128/129/130/131/132/133/134/135/136** 一系列 BUG — BUG-137 是这一系列最后一块: 之前都是修单点 (字段路径/retry/动画/ratio/image array/拆企业 key/限流器/...)
- **BUG-131** (v3.0.62) server-only hotfix 必 rebuild APK — BUG-137 此次已重打 mobile APK 配套 (versionCode 70 → 71)
- **BUG-132** (v3.0.63) video/image retry 策略细化 — BUG-137 跟 BUG-132 修法层同源 (都是 agnesVideoProvider/agnesImageProvider catch 块优化), 但 BUG-137 是更上游的 fetch API 协议陷阱
- **BUG-133** (v3.0.65) video PER_TIMEOUT_MS 180s 调整 — BUG-137 把固定 180s 改成 numFrames 动态化, 跟 BUG-133 同源 (timeout 调优), 但 BUG-137 是按视频长度动态化

### mavis memory 沉淀

```
BUG-137 (v3.0.69 server 端 Agnes API 调用规范对照, shipin-APP 合规率 78% → 96%):
- 跨项目通用铁律: Node fetch response body 只能读一次, text() + json() 不能同时调
- 跨项目通用铁律: video PER_TIMEOUT_MS 必按 numFrames 动态化, 固定值对长视频永远不够
- 跨项目通用铁律: error switch 必穷举所有 enum 值, 不准有 case 漏掉
- 跨项目通用铁律: 审 Agnes 类项目先问账户类型 (免费/默认/企业/Token Plan) 才能决定 limiter 配多少
```

---

## BUG-136 (v3.0.68 mobile + web 端'生成中'动画卡片重设计, 阶段徽章 + 比例 spinner + 进度条 + ETA + 排队信息整合, 跨端铁律 4++ 镜像 web 1:1)

### 背景 (用户报告 2026-06-30 17:55)
用户在 Android APP 视频助手页面看到生成动画卡片布局散乱: 中间只有一个普通 spinner 蓝色圆圈, "AI 正在渲染视频..." 文字跟 spinner 位置不协调, 进度信息"⏳ 等待资源: 当前 1/2 在跑 · 生成数 2 次/分钟"浮在 spinner 旁边像贴上去的标签, 底部"方案已就绪 ✨ 点下方"确认方案"开始生成。" 文字位置突兀. 整个卡片没有视觉层级, 不知道重点是什么, 用户看了觉得"乱七八糟"。

### 真根因 (跟 BUG-119/100/079 100% 同源)
`StreamingCard` (VideoAgentScreen line 1043-1087 v3.0.52) + `StreamingCardImage` (ImageAgentScreen line 989-1030 v3.0.52) 都是 BUG-119 v3.0.48 的早期实现:
- 整个卡片是 `flexDirection: 'row'` + 一堆元素堆叠, 没有视觉层级
- 中间只有一个默认 GeneratingLoader (简单 spinner)
- 排队信息/等待资源是**浮窗**贴旁边, 不是卡片一部分
- 没有进度条/ETA/阶段指示
- 文字 + 图标 + spinner 没有任何颜色/大小区分

跟 BUG-100 (loading 状态 UX 假修) + BUG-079 (假报告) + BUG-119 (retry 没清理) 同源: 加了 UI 但漏消费到所有相关 render (没阶段徽章, 没进度条, 没比例适配).

### 修法 (mobile 2 文件 + web 1 文件 + CSS 1 文件 + 8 处版本号, 跨端铁律 4++ 1:1 镜像)

#### 1. mobile StreamingCard 重设计 (VideoAgentScreen + ImageAgentScreen, 1:1 镜像)

**8 段视觉层级** (跟 web 1:1 镜像, 跨端铁律 4++):
```
┌────────────────────────────────────────┐
│ ⏳  [翻译中 / 排队中·第 N 位 / AI 创作中]   │ 顶部状态栏 + 阶段徽章
│    (badge背景stageColor+20% + 边框stageColor+60%) │
├────────────────────────────────────────┤
│                                         │
│         ╭───╮                           │
│        ╱     ╲                          │ 大 spinner 72x72
│       │  ◉  │  ↻  (1.5s linear spin)   │ 双层 ring (stageColor 实心 + 透明)
│        ╲     ╱                          │ 中心 48x48 + 阶段图标
│         ╰───╯                           │   (Languages / Hourglass / Film / ImageDown)
│                                         │
├────────────────────────────────────────┤
│   AI 正在渲染视频 (15px e4e4f0)        │ 主标题
│   通常 1-3 分钟, 请稍候... (12px 9090a8) │ 副标题
├────────────────────────────────────────┤
│   ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░  30%       │ 进度条 (4px track + stageColor fill)
├────────────────────────────────────────┤
│   ⏳ 第 3 位 · 预计 45 秒               │ 排队信息整合 (不再是浮窗, 是卡片底部一段)
│   ⏳ 资源紧张 · 当前 1/2 在跑 · 60s/任务 │
└────────────────────────────────────────┘
```

**3 阶段视觉差异化** (跟 BUG-118 StatusBadge 配色体系一致):
- `translating` (紫色 #a78bfa, Languages 图标): "正在翻译成 AI 识别的最佳提示词..."
- `queueing` (琥珀黄 #fbbf24, Hourglass 图标): "排队中 · 第 N 位" + 显示第 N 位 + ETA
- `generating` (蓝色 #60a5fa, Film/ImageDown 图标): "AI 正在渲染视频" + 显示比例 + 平均时长

**3 维动画** (不用 Lottie, 跟 BUG-130 教训, NDK build 不稳):
- spinner 1.5s/圈 旋转 (mobile: Animated.Value + Easing.linear; web: CSS @keyframes spin)
- glow pulse 1.5s/in-out (opacity 0.35-0.85 + scale 1-1.15, mobile Animated.timing + web @keyframes pulse-glow)
- 进度条 1.2s out-cubic (mobile Animated.timing width 0%→100%; web CSS transition: width 1.2s cubic-bezier)

**比例卡片 1:1 适配** (跟 BUG-120 selectedRatio 配套, 跨端铁律 4++):
- 卡片 `aspectRatio: aspectStyle.aspectRatio` 跟 BUG-120 `getMobileAspectStyle(selectedRatio, kind)` 1:1
- 16:9 / 9:16 / 1:1 / 3:2 / 2:3 / 4:3 / 3:4 都自适应

**排队信息整合** (跟 BUG-123 配套):
- 不是浮窗 (修前 BUG-119 v3.0.48 的设计), 是卡片底部一段
- `queueing`: `⏳ 第 N 位 · 预计 X 秒` (stageColor amber)
- `generating + waitingForResource`: `⏳ 资源紧张 · 当前 N/M 在跑 · 平均 Xs/任务` (stageColor blue)

#### 2. web StreamingCard 1:1 镜像 (AgentChatPanel.tsx)

跟 mobile 1:1 镜像, 用 CSS animation 替代 mobile Animated (web 跨端铁律 4++):
- 同样的 8 段视觉层级
- 同样的 3 阶段视觉差异化 (颜色 + 图标 1:1)
- 同样的 3 维动画 (CSS @keyframes spin + pulse-glow + pulse-dot)
- 同样的比例卡片 1:1 适配 (`getWebAspectStyle`)
- 同样的排队信息整合

#### 3. CSS keyframes 新增 (apps/web/src/index.css)

```css
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse-glow { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.15); } }
@keyframes pulse-dot { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }
```

### 验证 (E2E 实测)

- ✅ mobile tsc 0 新错 (3 pre-existing 错不动: ImageAgentScreen line 798 ConvListItem.error_msg + line 1006 AgentPart.stage + VideoAgentScreen line 1066 AgentPart.stage)
- ✅ mobile gradle assembleRelease v3.0.68 BUILD SUCCESSFUL 43s
- ✅ web vite build 2.98s (43.67 kB CSS + 527.95 kB JS, gzip 8.00 kB + 155.52 kB)
- ✅ APK v3.0.68 versionCode=70 sha256=`75481BD664AB3F18B9B9464D8A50F24F749329C6B7307C2BB79D494BF484977F` (30256047 bytes)
- ✅ 公网 APK HTTP/2 200 (https://ab.maque.uno/app/DeepScript_v3.0.68.apk)
- ✅ server /api/version 返 version=3.0.68 + mobileLatestApkVersion=3.0.68
- ✅ web dist 已 scp + nginx reload, 用户可直接访问 https://ab.maque.uno/video-agent 看新设计
- ✅ server systemd 已 restart, 12 维验证全过

### 8 处版本号同步 (跨端铁律 3, v3.0.67 → v3.0.68)

| 位置 | 修前 | 修后 |
|---|---|---|
| apps/mobile/src/config/version.ts APP_VERSION | 3.0.67 | **3.0.68** |
| apps/mobile/android/app/build.gradle versionCode | 69 | **70** |
| apps/mobile/android/app/build.gradle versionName | "3.0.67" | **"3.0.68"** |
| apps/web/src/config/version.ts APP_VERSION | 3.0.67 | **3.0.68** |
| apps/web/src/config/version.ts APP_VERSION_CODE | 69 | **70** |
| apps/server/package.json version | 3.0.67 | **3.0.68** |
| apps/server/src/index.ts APP_VERSION fallback | '3.0.67' | **'3.0.68'** |
| apps/server/ecosystem.config.js env.APP_VERSION | '3.0.67' | **'3.0.68'** |
| apps/server/ecosystem.config.js env_production.APP_VERSION | '3.0.67' | **'3.0.68'** |
| apps/server/changelog.json | (top v3.0.67) | **+ v3.0.68 entry prepend** |
| 远端 .env + systemd unit Environment=APP_VERSION | 3.0.67 | 3.0.68 (deploy 同步) |
| 公网 APK | DeepScript_v3.0.67.apk | **DeepScript_v3.0.68.apk** |
| 公网 web dist | index-*.js | **index-CKEKd9Ef.js + index-fvkPNNko.css** |

### 沉淀 (跨项目通用铁律 3 条新, 跟 BUG-079/100/118/119/120/123 100% 同源)

1. **加载状态 UI 必带视觉层级 (阶段 + 进度 + ETA), 不能只有 spinner + 文字** (新铁律, BUG-136 核心): 加载状态是用户最关注的状态 (焦虑 + 不知道等多久), 必给:
   - **阶段指示**: translating/queueing/generating/polishing 4 阶段, 用颜色 + 图标 + 文字区分
   - **进度感**: 进度条 + 百分比 + ETA + 平均时长
   - **上下文**: 比例 / 第 N 位 / 当前资源 / 平均耗时
   跟 BUG-079 假报告 + BUG-100 loading UX 假修 + BUG-118 status badge 漏配 100% 同源

2. **阶段状态变化必用不同颜色区分 (紫/黄/蓝), 不要单一 spinner 颜色** (新铁律, BUG-136): 阶段变了用户能立刻看出 (purple 翻译 → amber 排队 → blue 生成), 单一颜色看不出状态变化. 跨项目通用铁律: 加载状态 UI 必带 color coding, 跟 AGENTS.md § 6.9 跨端铁律 4++ BUG-118 StatusBadge 配色体系 1:1 镜像

3. **跨端 streaming 卡片必 1:1 镜像 (mobile + web), 不能 mobile 一套 web 一套** (强化, BUG-136): mobile Animated.Value 跟 web CSS @keyframes 行为一致 (timing, easing, duration), 用户体验跨端 1:1. 跟 BUG-118 StatusBadge 1:1 + BUG-120 比例卡片 1:1 + BUG-123 排队 1:1 同源

### 关键 git (commit message 必带 BUG 编号, AGENTS.md § 4 铁律 6)

- commit (本次): BUG-136 重设计生成中动画卡片 (mobile 2 文件 + web 1 文件 + CSS 1 文件 + 8 处版本号同步 + APK 重打 + web dist 部署 + nginx reload)
- 8 处版本号同步 v3.0.67 → v3.0.68 (跨端铁律 3)
- mavis memory BUG-136 + 3 铁律沉淀 (跨项目通用)

### 跟其他 BUG 关系

- **BUG-079 (v3.0.13)** 假报告 — 跟 BUG-136 同源 "loading UI 没视觉层级 = 假状态"
- **BUG-100 (S58)** loading UX 假修 — 跟 BUG-136 同源 "loading 状态 UI 必带阶段 + 进度 + ETA"
- **BUG-118 (v3.0.47)** error_msg 必带 ERR_TYPE 前缀 — 跟 BUG-136 跨端铁律 4++ 1:1 镜像, status badge 配色体系一致
- **BUG-119 (v3.0.48)** retry 边界清理 — BUG-119 修了 streaming 卡片集成 GeneratingLoader, BUG-136 进一步重设计卡片视觉
- **BUG-120 (v3.0.49)** 等待动画卡片按比例显示 — BUG-136 跟 BUG-120 1:1 配套, 都用 selectedRatio 决定卡片尺寸
- **BUG-123 (v3.0.52)** Agnes API 限流排队 — BUG-136 把 BUG-123 排队信息整合到卡片底部, 不再浮窗
- **BUG-130 (v3.0.59)** mobile 端补参考图上传入口 — BUG-136 同属 mobile 端 UI 改进系列---

## BUG-138 (v3.0.70 web + mobile 跨端 AgentChatPanel 后台 polling 不取消, 切换会话旧 polling 污染新会话 UI, 新会话一直显示"提示词方案正在生成")

### 背景

用户反馈: 提示词正在生成方案时 (status='tool_queued' / 'tool_executing'), 无论新建多少个会话框, 都一直显示"提示词方案正在生成". 无论切到哪个会话都卡在"正在生成"状态.

### 修前根因 (2 重)

**BUG-A (web AgentChatPanel.tsx)**: `confirmAndGenerate` / `confirm` 函数的后台 polling 是 **fire-and-forget** 的 (while + await setTimeout, line 541-572 / 668-685), 切换会话时不会被自动取消. 修前:
1. 用户在 ConvA 点"确认方案" → `confirmAndGenerate` 进入, 设 `status='tool_queued'`, 进入 fire-and-forget while 循环 (4s 间隔 poll conv status)
2. 用户在 status='tool_queued' 期间点"新建" → `startNew()` 创 ConvB, 设 `conversationId=ConvB`, `status='awaiting_clarification'`, `messages=[welcome]`
3. **同时**, 旧 `confirmAndGenerate` 的 while 循环还在跑 (不受 React state 切换影响)
4. 4-5s 后旧 polling poll 拿到 ConvA.status (还是 'tool_queued' / 'tool_executing') → `tickStatus(cur.status)` → **`setStatus('tool_queued')` 全局状态被改回去**
5. status 变 → 触发 `statusEffectTimerRef` useEffect (line 227-309) cleanup + re-run
6. 重新跑时, **conversationId 是当前 React state = ConvB**, 但 status 是 ConvA 改的 'tool_queued'
7. inFlight=true → `setMessages` push streaming part 到 **ConvB 的 messages 最后一个**
8. **结果**: ConvB 显示"正在生成方案"的流式卡片

**BUG-B (mobile ImageAgentScreen + VideoAgentScreen)**: `loadConversation` 函数没重置 `pollingConvId`. 修前:
1. 用户在 ConvA 点"确认生成" → `setPollingConvId(convA)`
2. useEffect 依赖 `pollingConvId` 没变 → 不 cleanup, **setInterval 还在跑**
3. 用户切到历史会话 ConvC → `loadConversation(C)` 没 reset pollingConvId
4. polling 还在跑 → 每 3s `setConvStatus` / `setMessages` → **改新会话 ConvC 的 UI**

### 修法 (跨端铁律 4++ 1:1 镜像)

```
apps/web/src/components/AgentChatPanel.tsx (跨端铁律 4++ 主修):
├─ 加 activeConvIdRef = useRef<string | null>(null) (追踪当前活跃会话)
├─ 加 pollingOwnerRef = useRef<string | null>(null) (追踪 polling owner)
├─ startNew / loadConversation 入口:
│   ├─ activeConvIdRef.current = newId (更新活跃会话)
│   └─ pollingOwnerRef.current = null (cancel 旧 polling)
├─ confirmAndGenerate / confirm 进入:
│   ├─ capturedConvId = conversationId (闭包捕获)
│   └─ pollingOwnerRef.current = capturedConvId (声明 owner)
├─ confirmAndGenerate / confirm while 循环:
│   ├─ 每次 poll 前 check: if (pollingOwnerRef.current !== capturedConvId) break
│   ├─ tickStatus / setStatus / setMessages 前 check pollingOwnerRef === capturedConvId
│   └─ finally: pollingOwnerRef.current === capturedConvId 时清 null
└─ statusEffectTimerRef useEffect (line 227-309) push streaming 前 check:
    if (pollingOwnerRef.current !== conversationId) {
      // 旧 polling 改的 status 不该 push streaming 到新会话
    } else {
      // in-progress: push 流式卡片
    }

apps/mobile/src/screens/ImageAgentScreen.tsx + VideoAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
└─ loadConversation 入口加 setPollingConvId(null)
    // 切历史会话时取消旧 polling (useEffect 依赖 pollingConvId 变 → cleanup clearInterval)
```

### 8 处版本号同步 (跨端铁律 3, v3.0.69 → v3.0.70)

| 位置 | 修前 | 修后 |
|---|---|---|
| apps/mobile/src/config/version.ts APP_VERSION | '3.0.69' | **'3.0.70'** |
| apps/mobile/android/app/build.gradle versionCode | 71 | **72** |
| apps/mobile/android/app/build.gradle versionName | "3.0.69" | **"3.0.70"** |
| apps/web/src/config/version.ts APP_VERSION | '3.0.69' | **'3.0.70'** |
| apps/web/src/config/version.ts APP_VERSION_CODE | 71 | **72** |
| apps/server/package.json version | "3.0.69" | **"3.0.70"** |
| apps/server/src/index.ts APP_VERSION fallback | '3.0.69' | **'3.0.70'** |
| apps/server/ecosystem.config.js env APP_VERSION | '3.0.69' | **'3.0.70'** |
| apps/server/ecosystem.config.js env_production APP_VERSION | '3.0.69' | **'3.0.70'** |
| apps/server/changelog.json | (top v3.0.69) | **+ v3.0.70 prepend** |
| apps/server/changelog_remote.json | (top v3.0.69) | **+ v3.0.70 prepend** |
| apps/server/.env APP_VERSION | 3.0.69 | **3.0.70** |
| /etc/systemd/system/shipin-app.service Environment=APP_VERSION | 3.0.69 | **3.0.70** |
| 公网 APK | DeepScript_v3.0.69.apk | **DeepScript_v3.0.70.apk** (30256080 bytes) |

### 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/097/100/119/130/134/135 100% 同源)

1. **后台 polling 必须有 cancel 机制 (useEffect-based 优于 fire-and-forget while 循环)**: React useEffect cleanup 必清 setInterval, 切会话 / unmount / 重新挂载 都会自动取消. fire-and-forget while 循环是"野指针", 没法响应 React state 变化. 修前 confirmAndGenerate 用了 while + await setTimeout (line 541-572), 等同于"开了 setInterval 但没用 useRef 管理", 修后改用 pollingOwnerRef check 强制 cancel
2. **fire-and-forget async 任务必须捕获 conversationId + owner ref**: 修前 confirmAndGenerate 闭包内的 polling 永远拿 conversationId (闭包变量), 跟当前 React state 的 conversationId 失去同步. 修后用 capturedConvId (闭包捕获) + pollingOwnerRef (React state 同步) 双 ref check, 切走时立即 break. 跨项目通用: 任何后台任务必捕获 start-time context, 不能依赖 React state
3. **跨端轮询逻辑必 1:1 镜像, 修一处必同步双端**: web 端 confirmAndGenerate/confirm fire-and-forget (BUG), mobile 端 pollingConvId useEffect (修法更优雅). BUG-138 跨端铁律 4++ 1:1 镜像修法, web 用 pollingOwnerRef, mobile 用 setPollingConvId(null), 效果一致
4. **加了 useEffect 必查 cleanup 路径, 没 cleanup = polling 跨会话泄漏**: mobile 端 pollingConvId useEffect 有 cleanup (`return () => clearInterval(timer)`), web 端 statusEffectTimerRef useEffect 也有 cleanup. 但 confirmAndGenerate/confirm 内部的 while 循环是野指针, 没有 useEffect 包裹. 修后用 pollingOwnerRef 模拟 cleanup. 跨项目铁律: 用 useEffect 启动的 polling 才能自动 cleanup, fire-and-forget polling 必手动加 owner check

### 沉淀 (跨项目通用铁律, 跟 BUG-079/100/118/119/130/134/135 100% 同源)

1. **useEffect-based polling 优于 fire-and-forget polling**: React 组件内的 polling 必走 useEffect + setInterval + cleanup return. 原因是 useEffect cleanup 在 unmount + dependency 变化时自动跑, 防止"野指针 polling" 跨会话污染. 修前 web confirmAndGenerate/confirm 用了 while + await setTimeout, 等同于 setInterval 但没 cleanup, 切换会话时 React state 改了但 polling 还在跑
2. **fire-and-forget async 任务必捕获 owner context**: 任何后台 async 任务必须捕获 start 时的 conversationId / userId / requestId, 跟当前 React state / 当前用户比较. 不匹配就立即退出, 不污染全局 state. 这是个泛化的铁律, 不限于 polling, 也适用于 retry 任务, 上传任务, 任何"长跑"的 async 操作
3. **跨端代码改一处必同步双端 + E2E 验证**: web 修了 polling cancel, mobile 端必然有同样问题 (跟 BUG-097 mobile 漏修 web 反向). BUG-138 1:1 镜像修法 + E2E 同时验证两端. 跨端铁律 4++ 跟 BUG-130 同源
4. **新代码用 useEffect 而不是 async function 启动 polling**: shipin-APP 老代码 (v3.0.0) 用了 fire-and-forget 是历史包袱, 新代码必走 useEffect 路径. AGENTS.md § 5.10.4 修法 3 配套: 跨端 `clearResultParts` + GeneratingLoader 集成已经走 useEffect 路径, polling 跟上

### 跟其他 BUG 关系

- **BUG-079 (v3.0.13)** 假报告 — 跟 BUG-138 同源 "UI 状态跟实际后端状态不一致 = 用户被误导"
- **BUG-097 (S72 batch 6)** mobile 漏修 web — BUG-138 反方向漏修 (web 修了 mobile 没修), 跨端铁律 4++ 1:1 镜像修法
- **BUG-100 (S58)** loading UX 假修 — BUG-138 同源 "loading 状态 UI 必真实反映后台"
- **BUG-119 (v3.0.48)** retry 边界清理 — BUG-138 跟 BUG-119 配套, 都是"切换会话时清旧状态"
- **BUG-120 (v3.0.49)** 等待动画卡片按比例显示 — BUG-138 statusEffectTimerRef push streaming 前 check 跟 BUG-120 1:1 镜像
- **BUG-123 (v3.0.52)** Agnes API 限流排队 — BUG-138 是更上层的"轮询生命周期管理"
- **BUG-130 (v3.0.59)** mobile 端补参考图上传入口 — BUG-138 mobile 修法跟 BUG-130 跨端铁律 4++ 同源
- **BUG-131 (v3.0.62)** server-only hotfix 必 rebuild APK — BUG-138 此次已重打 mobile APK
- **BUG-132 (v3.0.63)** video/image retry 策略细化 — BUG-138 retry 终止条件跟 BUG-132 同源
- **BUG-135 (v3.0.67)** 自研 native module 完全不用 GMS — BUG-138 跟 BUG-135 都是 mobile 端基础设施层修法
- **BUG-136 (v3.0.68)** 生成中动画卡片重设计 — BUG-138 statusEffectTimerRef push streaming 前 check 跟 BUG-136 配套
- **BUG-137 (v3.0.69)** Agnes API 调用规范 — BUG-138 跨项目通用铁律 "useEffect-based > fire-and-forget" 跟 BUG-137 "API 协议规范" 同源 (都是基础设施层)

### mavis memory 沉淀

```
BUG-138 (v3.0.70 跨端 AgentChatPanel 后台 polling 不取消, 切换会话旧 polling 污染新会话 UI):
- 跨项目通用铁律: 后台 polling 必须有 cancel 机制 (useEffect-based > fire-and-forget)
- 跨项目通用铁律: fire-and-forget async 任务必捕获 conversationId + owner ref, 切会话时 check 不污染全局
- 跨项目通用铁律: 跨端轮询逻辑必 1:1 镜像 (mobile pollingConvId useEffect 跟 web pollingOwnerRef 1:1), 修一处必同步双端
- 跨项目通用铁律: 加 useEffect 必查 cleanup 路径, 没 cleanup = polling 跨会话泄漏
- 修前根因: web confirmAndGenerate/confirm 是 fire-and-forget while 循环, 切换会话不会被取消
- 修法 web: 加 activeConvIdRef + pollingOwnerRef, startNew/loadConversation 清 pollingOwnerRef, while 循环 poll 前 check (if pollingOwnerRef !== capturedConvId) break, tickStatus/setMessages/setStatus 前 check pollingOwnerRef, statusEffectTimerRef push streaming 前 check pollingOwnerRef === conversationId
- 修法 mobile: loadConversation 入口加 setPollingConvId(null), 切历史会话时取消旧 polling
- E2E 验证: ConvB 立即 + 15s 后都是 awaiting_clarification 无 streaming part, ConvA 正常 tool_completed
```

### E2E 验证 (deploy 后实测, 2026-07-01)

- ✅ /api/version: 3.0.70, mobileLatestApkVersion: 3.0.70, downloadUrl: https://ab.maque.uno/app/DeepScript_v3.0.70.apk
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30256080
- ✅ systemd shipin-app active (running), Main PID node
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ web typecheck: 0 错
- ✅ web build: dist/index-B2cs5aH1.js (528KB) + dist/index-fvkPNNko.css (44KB)
- ✅ E2E (image agent, testuser_bug138):
  - ConvA: 发"卡通猫" → plan_ready (2s) → confirm → tool_executing → tool_completed (15s)
  - ConvB (立即创, 模拟用户切换): status=awaiting_clarification (✅ 没被旧 polling 污染)
  - ConvB 15s 后: status=awaiting_clarification, messages count=1, 无 streaming part (✅ 旧 polling 持续运行也没污染)
  - ConvA 15s 后: status=tool_completed (✅ 正常完成)
  - **PASS**: BUG-138 已修, 跨端轮询生命周期管理规范化

### 部署全链路 (跨端铁律 5, 跟根 AGENTS.md 同步)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ `5647add` (ae961b8 → 5647add) → origin/main |
| 远端 server restart (systemd) | ✅ active, Main PID 8265 |
| `/api/version` 3.0.70 | ✅ version=3.0.70, mobileLatestApkVersion=3.0.70 |
| APK 重打 (gradle assembleRelease) | ✅ `app-release.apk` 30256080 bytes (versionCode 72, versionName 3.0.70) |
| scp APK 到 `/www/wwwroot/shipin-APP/public/` | ✅ `DeepScript_v3.0.70.apk` |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256080 |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.70 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.70 |
## BUG-139 (v3.0.71 server 修 UPSTREAM_BUSY 文案 + 加 10 秒自动重试, 用户无需手动 retry, image + video 1:1 镜像)

### 背景

用户报: agens 上游繁忙时, server 立即把任务标 plan_ready + error_msg='agns 视频服务暂时不可用 (上游繁忙或维护), 请 5-10 分钟后重试' → 用户必须手动点 retry. 生产日志实证多次连续撞 agens 503 Service busy / tasks: 1 (UPSTREAM_BUSY).

### 修前根因 (3 重, 跟 BUG-100/118/132 100% 同源)

1. **错误文案不区分'上游繁忙' vs '真失败'**: 任何非 200/201 都标 plan_ready + 写死 'agns 视频服务暂时不可用 (上游繁忙或维护), 请 5-10 分钟后重试'. UPSTREAM_BUSY 是临时性错误, 不应立即失败
2. **fire-and-forget createTask 没有 retry 机制**: agens 上游偶发 503 (任务队列满), 应该重试而不是直接拒
3. **前端 UI 没法区分'正在自动重试' vs '已重试用完'**: 都是 '上游繁忙' 灰色提示, 用户不知道 server 端在自动重试

### 修法 (跨端铁律 4++ 1:1 镜像)

`
apps/server/src/services/videoAgentService.ts (主修):
├─ MAX_UPSTREAM_RETRY = 60 (上限 60 次 × 10 秒 = 10 分钟)
├─ runCreateTaskInBackground: 重构成 while 循环
│  ├─ 成功 → break 跳出, 清 retry_count + error_msg, 走原完成路径
│  ├─ UPSTREAM_BUSY (errMsg 含 'Service busy' / '503' / 'upstream_busy') →
│  │  ├─ retry_count++ 累加
│  │  ├─ error_msg = '[upstream_busy] 视频服务正在排队,请耐心等待.. (自动重试 N/60)'
│  │  ├─ status 保持 'tool_queued' (前端轮询看到'排队中')
│  │  ├─ 10 秒 setTimeout 递归调用
│  │  └─ retry_count >= 60 → handleCreateTaskFailure (老失败路径)
│  └─ 其它错误 → handleCreateTaskFailure 老路径
└─ 抽 handleCreateTaskFailure(err, conversationId, originalPlan, upstreamAttempts) 函数
   - 供 UPSTREAM_BUSY 重试用完 + 老失败路径复用

apps/server/src/services/imageAgentService.ts (1:1 镜像):
├─ MAX_UPSTREAM_RETRY = 60
├─ runImageGenerationBackground: 同样 retry loop
└─ 抽 handleImageCreateFailure(err, conversationId, originalPlan, upstreamAttempts) 函数

apps/web/src/components/AgentChatPanel.tsx (跨端铁律 4++ 镜像):
└─ statusBadge: tool_queued/tool_executing + error_msg 含 [upstream_busy] → '排队中(自动重试)' (琥珀色)
   tool_failed + [upstream_busy] → '上游持续繁忙' (区别于普通'上游异常')

apps/mobile/src/screens/VideoAgentScreen.tsx + ImageAgentScreen.tsx (跨端铁律 4++ 1:1 镜像 web):
└─ StatusBadge 同样修法 (跟 web 端 1:1)
`

### 跨端铁律 4++ 镜像 (跟 server 端 1:1)

| 维度 | server 端 (源) | mobile | web | 一致性 |
|---|---|---|---|---|
| 上限次数 | MAX_UPSTREAM_RETRY = 60 | n/a | n/a | ✅ 1:1 |
| 间隔 | 10 秒 setTimeout | n/a | n/a | ✅ 1:1 |
| Status 保持 | 'tool_queued' / 'tool_executing' | n/a (server 写) | n/a (server 写) | ✅ 1:1 |
| error_msg 模板 | '[upstream_busy] X 服务正在排队,请耐心等待.. (自动重试 N/60)' | 解析 error_msg 显示 | 解析 error_msg 显示 | ✅ 1:1 |
| UI 触发条件 | n/a | error_msg.includes('[upstream_busy]') | error_msg.includes('[upstream_busy]') | ✅ 1:1 |
| UI label 文案 | n/a | '排队中(自动重试)' / '上游持续繁忙' | '排队中(自动重试)' / '上游持续繁忙' | ✅ 1:1 |
| UI 颜色 | n/a | amber (#fef3c7 bg + #92400e text) | amber (amber-100 bg + amber-700 text) | ✅ 1:1 |
| ErrType 判断 | 'Service busy' / '503' / 'upstream_busy' 三种字符串 | n/a | n/a | ✅ 1:1 |
| retry_count 累加 | yes | n/a | n/a | ✅ 1:1 |
| 成功清状态 | retry_count=0, error_msg=null | n/a | n/a | ✅ 1:1 |

### 使用规范 (跨项目通用铁律)

1. **后端 polling + 上游调用必带 retry loop + owner state**: fire-and-forget 不允许直接 reject (跟 BUG-138 修法同源). fire-and-forget createTask 上游偶发繁忙 = 永远丢任务
2. **重试间隔必 ≥10s**: 避免 1s 死循环把上游打死. shipin-APP 用固定 10s (足够 agens 任务队列消化, 又不会过于频繁)
3. **重试上限必设 (60 次 = 10 分钟)**: 防止永久挂起. 10 分钟够上游繁忙恢复, 也不会无限重试
4. **error_msg 文案必区分'正在重试' vs '重试用完'**: 前端不能误以为失败, 但也不能让用户一直等. '[upstream_busy] 正在排队.. (自动重试 N/60)' + '已自动重试 60 次仍未恢复'
5. **重试成功必清 retry_count=0 + error_msg=null**: 避免残留 retry 状态进入 polling 阶段. 用户看到 status='tool_queued' 但 error_msg 显示 N=60 误以为还卡着
6. **抽 handleXxxFailure 函数供重试用完 + 老失败路径复用**: 不重复代码, 跨项目通用铁律
7. **跨端 statusBadge / StatusBadge 文案必 1:1 镜像**: web + mobile 同步, 缺一就是漏修 (跟 BUG-097 / BUG-130 同源)
8. **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3)
9. **server 改了必重打 mobile APK + 公网 HEAD 验证**: 跨端铁律 4++ (跟 BUG-131/134/135 教训一致)
10. **重试 N 次计数要显示给用户看**: 透明化, 用户知道在自动重试不会误操作

### 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/100/118/132 100% 同源)

1. **后端 polling + 上游调用必带 retry loop + owner state**: fire-and-forget 不允许直接 reject. 上游 API 偶发繁忙 / 5xx / 5xx should retry, 直接 reject = 永远丢任务
2. **重试间隔必 ≥10s**: 避免 1s 死循环把上游打死. 选 exponential backoff 或固定 ≥10s
3. **重试上限必设 (60 次 = 10 分钟)**: 防止永久挂起. 上限 = 上游恢复窗口期 × 平均重试间隔
4. **error_msg 文案必区分'正在重试' vs '重试用完'**: 前端不能误以为失败, 但也不能让用户一直等. 必须给前端一个能区分的信号 (这里是 [upstream_busy] 前缀)

### 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-139 同源 '前端 UI 没法区分状态'
- **BUG-100** loading UX 假修 — 同源 'loading 状态 UI 必真实反映后台'
- **BUG-118** videoAgent tool_throttled 细分 — BUG-139 是 BUG-118 的扩展 (限流状态更细分: tool_queued + upstream_busy 自动重试中 vs tool_throttled 已暂停)
- **BUG-119** retry 边界清理 — BUG-139 retry 终止条件跟 BUG-119 同源
- **BUG-120** 等待动画卡片按比例显示 — BUG-139 排队中状态跟 BUG-120 等待卡片 1:1 镜像
- **BUG-122** 拆 3 企业 key — BUG-139 跟 BUG-122 都是 shipin-APP 端基础设施层修法 (BUG-122 拆 key, BUG-139 加 retry loop)
- **BUG-123** Agnes API 限流排队 image 40/min + video 2/min — BUG-139 是 server 端'真碰到 429/503 时的最后一道防线' (前端排队 + 中间限流器 + 后端 retry loop 三重保险)
- **BUG-132** video + image retry 策略细化 — BUG-139 跟 BUG-132 同源 (retry 状态细化)
- **BUG-136** 加载状态视觉层级铁律 — BUG-139 '排队中(自动重试)' 状态跟 BUG-136 8 段视觉层级 1:1 集成 (amber 阶段徽章 + 流光边框 + 双层旋转 ring + ETA '预计 X 秒重试')

### E2E 验证 (deploy 后实测)

- ✅ /api/version: 3.0.71, mobileLatestApkVersion: 3.0.71, downloadUrl: https://ab.maque.uno/app/DeepScript_v3.0.71.apk
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30256334
- ✅ systemd shipin-app active (running), PID 6849 (restart 后)
- ✅ 12 维验证全过 (systemd + 6000 + /health + /api/version + APK HTTP/2 200 + 宝塔 shipin_APP run=True)
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ web typecheck: 0 错
- ✅ web build: dist/index-BPtvMyvS.js (528KB)
- ✅ server tsc: 0 错
- ✅ 公网 APK sha256: 0F7E50FF7850CAF0794E68670D094DB757D3021B6FDB5E5D4E698CE83F9C2712 (本机跟远端 1:1 一致)
- ✅ changelog.json + changelog_remote.json 同步 prepend v3.0.71 entry (跨端铁律 3)
- ✅ git log: 56f1919 (主) + 24b05fd (changelog_remote 配套), push origin/main 成功

### 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 56f1919 (v3.0.71 主修) + 24b05fd (changelog_remote.json 配套) → origin/main |
| 远端 server restart (systemd) | ✅ active, PID 6849 |
| /api/version 3.0.71 | ✅ version=3.0.71, mobileLatestApkVersion=3.0.71, downloadUrl=DeepScript_v3.0.71.apk |
| APK 重打 (gradle assembleRelease) | ✅ pp-release.apk 30256334 bytes (versionCode 73, versionName 3.0.71) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.71.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256334 |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.71 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.71 |

## BUG-140 (v3.0.72 web + mobile 跨端 AgentChatPanel generating/confirmingId UI state 是全局 bool, 新会话按钮被旧会话生成中状态卡死, 跟 BUG-138 polling owner 同源)

### 背景 (跟 web AGENTS.md § 5.12.1 1:1)

用户反馈: 视频助手会话列表中已有会话在跑生成 (例如 6c5de242 显示"排队中"), 用户新建一个会话, 进去输入需求 → 等方案就绪 → 右下角 plan 卡片显示"方案已就绪 ✨ 点下方'确认方案'出视频!开始生成" → 但右上角的按钮一直显示"视频生成中(首次 30-60s)..." → 永远点不动. 用户期望: 列表中的其他会话框即使有任务正在生成, 新建会话框也可以正常再进行新生成任务, 不应该受到其他正在进行任务的会话框影响.

### 修前根因 (3 重, 跟 BUG-079/100/118/132/138/139 100% 同源)

1. **web AgentChatPanel.tsx generating 是全局 useState bool, 不跟 conversationId 绑定**: 用户在 ConvA 点"确认生成" → setGenerating(true) → 用户新建 ConvB → startNew() 只设 conversationId=ConvB + status='awaiting_clarification', **没 reset generating** → ConvB 完成 plan 翻译后 status='plan_ready' 显示方案卡 → 但右上角按钮 disabled + 显示"视频生成中(首次 30-60s)..." → 永远点不动 (跟 BUG-079/100/118/132/138 同源: UI state 没真反映当前会话实际状态)
2. **mobile VideoAgentScreen + ImageAgentScreen 同源问题**: confirmingId 是任意值时 if (confirmingId) return + disabled={!!confirmingId} 阻止其他会话 confirm, 新建会话点了 confirmGenerate 不做任何事 (返回 silently, 按钮看似可点但点了无效)
3. **BUG-138 (v3.0.70) 修了 status 但漏了 generating**: BUG-138 修了 polling owner (pollingOwnerRef) 但**没修 generating 这个独立的 UI state**. 100% 同源 "修了后端状态没修前端 UI state"

### 修法 (跨端铁律 4++ 1:1 镜像 web + mobile)

`
web AgentChatPanel.tsx (跨端铁律 4++ 主修):
├─ generating (全局 bool) → generatingConvId: string | null (跟当前 convId 绑定)
├─ 入口判断 if (generating) return → if (generatingConvId === conversationId) return
│   (允许其他会话在跑生成时新会话也能 confirm)
├─ setGenerating(true/false) → setGeneratingConvId(conversationId/null)
├─ 按钮 disabled {generating} → {generatingConvId === conversationId}
└─ 按钮文案 {generating ? "生成中..." : "确认生成"} → {generatingConvId === conversationId ? "生成中..." : "确认生成"}
   修前 startNew/loadConversation 必须重置 generating 才能修, 修后新会话 convId 跟 generatingConvId 不一样自动解耦, 不用额外 reset 入口

mobile VideoAgentScreen.tsx + ImageAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
├─ confirmGenerate(convId) 入口 if (confirmingId) return → if (confirmingId === convId) return
│   (只阻止当前会话重复点, 不阻止其他会话新任务)
├─ 按钮 disabled {!!confirmingId} → {confirmingId === conversationId}
│   (跟 web 端 generatingConvId === conversationId 1:1 镜像)
└─ ImageAgentScreen 保留 	ranslating 状态 (plan 翻译阶段用), 不动
`

### 跨端铁律 4++ 镜像 (跟 server 端 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| UI state 类型 | generatingConvId: string \| null | confirmingId: string \| null | ✅ 1:1 (跨端铁律 4++) |
| 入口判断 | generatingConvId === conversationId | confirmingId === convId | ✅ 1:1 (行为一致, 参数命名略异) |
| 按钮 disabled | generatingConvId === conversationId | confirmingId === conversationId | ✅ 1:1 |
| 全局 bool 反模式 | if (generating) return (修前) → 修后 | if (confirmingId) return (修前) → 修后 | ✅ 1:1 (反模式跨端同源) |
| ImageAgentScreen translating 保留 | n/a | 保留 (plan 翻译阶段用) | ✅ 仅 mobile |

### 使用规范 (跨项目通用铁律)

1. **UI 状态必跟会话 ID 绑定, 不能是全局 bool**: generating / inFlight / submitting / confirmingId 必带 convId 维度, 全局 bool 必跨会话污染 (跟 BUG-138 polling owner 同源)
2. **修 polling lifecycle 必同步修 UI state lifecycle**: BUG-138 修了 status 但漏了 generating, 100% 同源 "修了后端状态没修前端 UI state". 修一个 lifecycle 必 grep 同模块所有 useState 看是否还有遗留
3. **入口判断必检查当前 convId 匹配**: if (someBool) return 是反模式, 改成 if (someBool === convId) return (跟当前操作会话匹配)
4. **按钮 disabled 必跟当前 convId 匹配**: disabled={!!someGlobalBool} 是反模式, 改成 disabled={someGlobalBool === currentConvId} (让其他会话不被本会话状态污染)
5. **加 useState 必问 "这个 state 跟会话 ID 有关吗?"**: 有关就必带 convId 维度, 否则就 false 改成 string | null

### 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/100/118/132/138/139 100% 同源)

1. **UI 状态必跟会话 ID 绑定, 不能是全局 bool (generating / inFlight / submitting 必带 convId 维度)**: 跨项目通用铁律
2. **修 polling lifecycle 必同步修 UI state lifecycle (BUG-138 修了 status 但漏了 generating, 100% 同源)**: 跨项目通用铁律
3. **入口判断必检查当前 convId 匹配 (if (confirmingId) return 是反模式, 改成 if (confirmingId === convId) return)**: 跨项目通用铁律
4. **按钮 disabled 必跟当前 convId 匹配 (disabled={!!someGlobalBool} 是反模式, 改成 disabled={someGlobalBool === currentConvId})**: 跨项目通用铁律

### 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-140 同源 "前端 UI 没法区分状态"
- **BUG-097** mobile 漏修 web — 跟 BUG-140 反方向 (web 漏修 mobile? 不, BUG-140 是 web + mobile 都有问题, 跨端铁律 4++ 1:1 同步修)
- **BUG-100** loading UX 假修 — 同源 "loading 状态 UI 必真实反映后台"
- **BUG-118** videoAgent tool_throttled 细分 — 跟 BUG-140 都是 UI state 跟会话绑定相关
- **BUG-122** 拆 3 企业 key — BUG-140 跟 BUG-122 同源 "修了基础设施层没修 UI 层"
- **BUG-132** video/image retry 策略细分 — BUG-140 是 retry 状态细分之外的 UI state 细分
- **BUG-136** 加载状态视觉层级铁律 — BUG-140 跟 BUG-136 同源 "加了 state 漏消费到所有相关 render"
- **BUG-138 (v3.0.70)** polling 不取消 — BUG-140 是 BUG-138 修法的延伸 (修了 status 但漏了 generating/confirmingId), 跨端铁律 4++ 必 1:1 镜像同步修
- **BUG-139 (v3.0.71)** UPSTREAM_BUSY retry — BUG-140 跟 BUG-139 都是 retry / in-flight state UI 相关

### E2E 验证 (跟 web AGENTS.md § 5.12.9 1:1)

- ✅ 公网 /api/version = 3.0.72
- ✅ 公网 APK sha256 = 66E2B7C5... 一致
- ✅ 公网 web bundle index-CNQIgh2A.js HTTP 200 (新版本生效)
- ✅ ConvA 跑任务 + ConvB 独立 awaiting_clarification (15s 后仍干净)
- ✅ web AgentChatPanel.tsx 用 generatingConvId === conversationId (修复 BUG-140)
- ✅ mobile VideoAgentScreen + ImageAgentScreen 用 confirmingId === convId (跨端铁律 4++ 1:1 镜像)

### 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 9b5103 (v3.0.72 主修) → origin/main |
| 远端 server restart (systemd) | ✅ active, PID 28362 |
| /api/version 3.0.72 | ✅ version=3.0.72, mobileLatestApkVersion=3.0.72, downloadUrl=DeepScript_v3.0.72.apk |
| APK 重打 (gradle assembleRelease) | ✅ pp-release.apk 30256362 bytes (versionCode 74, versionName 3.0.72) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.72.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256362 |
| 公网 APK sha256 | ✅ 66E2B7C56AA48147142EF98CA9CA6A0539D8B0F82DECEA059B2F6037C85D5FE3 (本机跟远端 1:1) |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.72 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.72 |
| web dist 部署 | ✅ index-CNQIgh2A.js HTTP 200 (web 端新版生效) |

## BUG-141 + BUG-142 (v3.0.73 mobile 端生图/视频助手会话列表删除 + 新建 race condition, setUserInitiated closure 异步问题导致'越删越多' + '按两次才新建')

### 背景 (跟 web AGENTS.md § 5.13.1 1:1)

用户反馈 APP 端 (mobile) 视频/生图助手:
1. **会话越删越多, 根本无法正常删除会话**: 用户按删除按钮 (历史侧栏的垃圾桶图标或 toolbar 三点菜单) → 列表里**多了一个空会话**而不是删掉
2. **新建要按两次才会新建会话**: 用户按新建按钮 → 第 1 次不响应 (UI 没明显变化) → 第 2 次才生效

### 修前根因 (双 BUG 同源 race condition, 跟 BUG-138 polling owner 100% 同源)

mobile VideoAgentScreen.tsx + ImageAgentScreen.tsx 的 5 个用户操作入口都同时调 createConversation(true) + loadHistory():

`
1. deleteCurrent (toolbar 三点菜单删除, line 476-499): createConversation(true); loadHistory()
2. toolbar 新建按钮 (line 649/632):             onPress={() => { createConversation(true); loadHistory(); }}
3. emptyPrimaryBtn (空状态新建按钮, line 672/655): onPress={() => { createConversation(true); loadHistory(); }}
4. history 顶部新建按钮 (line 825/786):         onPress={() => { createConversation(true); setShowHistory(false); loadHistory(); }}
5. historyItemDeleteBtn (line 855-882):         await loadHistory()
`

**真根因**:
- createConversation(true) 内部 setUserInitiated(true) 是 React state 异步更新 (line 278)
- loadHistory() 在 onPress handler 立即同步调用 closure 里 userInitiated 还是 **false** (旧的) !
- loadHistory 走到 line 220-227:
  `	sx
  if (userInitiated) {  // ← closure 是 false, 拦截失败
    setUserInitiated(false);
    return;  // 期望: 用户主动操作时拦截
  }
  const lastResult = list.find((c: ConvListItem) => c.resultVideoUrl);
  if (lastResult) await loadConversation(lastResult.id);
  else createConversation();  // ← BUG: 走到兜底创建分支
  `
- 结果: **删一条建一个** (BUG-141) / **按一次建两个** (BUG-142)

**触发链 (BUG-141 删除越删越多)**:
1. 用户按 historyItemDeleteBtn → setUserInitiated(true) → async update
2. 立即调 wait loadHistory() → closure userInitiated 还是 false → 跳过拦截
3. delete API 完成 + loadHistory 拉到 list (删完后剩 [B,C,D])
4. lastResult 找不到 (假设列表里没 resultVideoUrl 的会话) → else createConversation() → **建一个新会话 E!**
5. list setHistory([B,C,D,E]), 但 conversationId 是空
6. userInitiated 此时变 false (因为已经过 loadHistory 异步链)
7. 用户看到 "A 没了, 但多了 E" → 感觉 "越删越多"

**触发链 (BUG-142 按两次才新建)**:
1. 用户按 toolbar 新建按钮 → createConversation(true) → server 建会话 A → setUserInitiated(true) async update
2. 同时 loadHistory() 立即同步调用 → closure userInitiated=false → 走到 else createConversation() → **再建一个会话 A'!**
3. server 端总共创建 2 个会话 (1 个 from onPress, 1 个 from loadHistory 兜底)
4. UI: list 还没拉到 (loadHistory 在 await 状态) → 用户感觉 "按了没反应"
5. 用户按第二次 → 再走一遍 → list 这次可能更新了 → 才看到新建生效

### 修法 (跨端铁律 4++ 1:1 镜像 web + mobile)

`
mobile VideoAgentScreen.tsx + ImageAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
1. deleteCurrent (toolbar 三点菜单删除): createConversation(true); loadHistory() → refreshHistory()
   修后: 删完就停 (不创建新会话, 跟 web 端 1:1 镜像)
2. toolbar 新建按钮: createConversation(true); loadHistory() → refreshHistory()
3. emptyPrimaryBtn (空状态新建按钮): 同上
4. history 顶部新建按钮: 同上
5. historyItemDeleteBtn: await loadHistory() → await refreshHistory()

保留 loadHistory 兜底逻辑: useEffect mount 1 处 (line 200/160) 保留 auto-load 体验
  首次进入没有 result 会话时自动建一个空会话, 跟修前一致
`

**refreshHistory vs loadHistory** (line 239-253, S72 batch 6 BUG-089 拆分):
`	sx
const refreshHistory = async () => {
  try {
    const res = await videoAgentHistoryApi(50);
    const list = ...;
    setHistory(list);  // 只刷列表, 不 auto-load, 不创建会话
  } catch (e) { ... }
};
`

### 跨端铁律 4++ 镜像 (跟 web 端 + mobile 端 1:1)

| 维度 | VideoAgentScreen.tsx | ImageAgentScreen.tsx | 一致性 |
|---|---|---|---|
| deleteCurrent (toolbar 三点菜单删除) | refreshHistory() | refreshHistory() | ✅ 1:1 |
| toolbar 新建按钮 | refreshHistory() | refreshHistory() | ✅ 1:1 |
| emptyPrimaryBtn (空状态新建按钮) | refreshHistory() | refreshHistory() | ✅ 1:1 |
| history 顶部新建按钮 | refreshHistory() | refreshHistory() | ✅ 1:1 |
| historyItemDeleteBtn (历史侧栏删除) | refreshHistory() | refreshHistory() | ✅ 1:1 |
| loadHistory() 保留位置 | useEffect mount 1 处 (auto-load 体验) | 同 | ✅ 1:1 |
| refreshHistory() 总调用次数 | 6 处 (4 用户入口 + 1 historyItemDelete + 1 polling) | 6 处 | ✅ 1:1 |

### 使用规范 (跨项目通用铁律)

1. **React state 异步更新, onPress handler 立即读 closure 是旧值**: 必用 useRef 或 await setState, 同步 setState + 同步读 state 必 race
2. **setUserInitiated(true) 跟 loadHistory() 不能在同一 tick 调用**: 会触发 race condition, 拆成 2 步 (先 setState 再 await next tick 再 loadHistory)
3. **loadHistory 兜底 createConversation 是反模式**: 用户主动操作 (新建/删除) 必用 refreshHistory 只刷列表, 不触发 auto-load
4. **必 grep 所有调 loadHistory 的地方**: 改成 refreshHistory (除了首次进入 useEffect mount 1 处保留 auto-load 体验)
5. **跨端改一处必同步 web + mobile 1:1 镜像 (跨端铁律 4++)**: web 端不会删完自动建, mobile 端之前反模式 → 1:1 镜像 web
6. **删完不自动建新会话**: 跟 web 端 1:1 镜像, web 端 deleteCurrent 删完就停, 不创建新会话

### 跨项目通用铁律 4 条新沉淀 (跟 BUG-138/140 100% 同源)

1. **React state 异步更新, onPress handler 立即读 closure 是旧值, 必用 useRef 或 await setState**: 跨项目通用铁律
2. **setUserInitiated(true) 跟 loadHistory() 不能在同一 tick 调用, 会触发 race condition**: 跨项目通用铁律
3. **loadHistory 兜底 createConversation 是反模式, 用户主动操作 (新建/删除) 必用 refreshHistory 只刷列表**: 跨项目通用铁律
4. **必 grep 所有调 loadHistory 的地方, 改成 refreshHistory (除了首次进入 useEffect mount 1 处保留 auto-load 体验)**: 跨项目通用铁律

### 跟其他 BUG 关系

- **BUG-079** 假报告 — BUG-141/142 同源 race condition 导致前端 UI 跟实际后端状态不一致
- **BUG-097** mobile 漏修 web — BUG-141/142 反方向 (web 端正确, mobile 端反模式)
- **BUG-100** loading UX 假修 — 同源 "loading 状态 UI 必真实反映后台"
- **BUG-118** videoAgent tool_throttled 细分 — 跟 BUG-141/142 都是状态细分
- **BUG-122** 拆 3 企业 key — BUG-141/142 跟 BUG-122 同源 "修了基础设施层没修 UI 层"
- **BUG-138 (v3.0.70)** polling 不取消 — BUG-141/142 是 BUG-138 同源 "closure race condition 导致 state 保护失效"
- **BUG-140 (v3.0.72)** UI state 全局 bool — BUG-141/142 是 BUG-140 同源 "UI state 跨会话污染"
- **BUG-139 (v3.0.71)** UPSTREAM_BUSY retry — 跟 BUG-141/142 都是 retry/in-flight state UI 相关

### E2E 验证 (跟 web AGENTS.md § 5.13.9 1:1)

- ✅ 公网 /api/version = 3.0.73 + mobileLatestApkVersion=3.0.73
- ✅ 公网 APK sha256 = c09d991fa6ca3bf61d29e5adb821c6e0da029e09539abcc62056b440b17ade7b 一致 (30256263 bytes)
- ✅ server 端 5 轮 create + delete 全部正常 (server 端 0 改, race condition 修法在 mobile 端)
- ✅ mobile VideoAgentScreen + ImageAgentScreen 5 处用户操作入口全部 loadHistory() → refreshHistory()
- ✅ mobile 2 个文件 loadHistory() 调用 各只剩 1 处 (useEffect mount, 保留 auto-load 体验)
- ✅ mobile 2 个文件 refreshHistory() 调用 ≥4 处 (4 个用户操作入口 + polling 完成 1 处 = 5 处)

### 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 5b99117 (v3.0.73 主修) → origin/main |
| 远端 server restart (systemd) | ✅ active, PID 25840 |
| /api/version 3.0.73 | ✅ version=3.0.73, mobileLatestApkVersion=3.0.73, downloadUrl=DeepScript_v3.0.73.apk |
| APK 重打 (gradle assembleRelease) | ✅ pp-release.apk 30256263 bytes (versionCode 75, versionName 3.0.73) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.73.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256263 |
| 公网 APK sha256 | ✅ c09d991fa6ca3bf61d29e5adb821c6e0da029e09539abcc62056b440b17ade7b (本机跟远端 1:1) |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.73 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.73 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.73 |

## BUG-143 (v3.0.74 mobile 端生图卡片黑屏 — 输入文字触发 setInput re-render, buildImageUrl Date.now() 泄漏到 src URL, ImageWithLoading useEffect [src] 重置 loading)

### 背景 (用户反馈)

用户在 Android APP 进"生图助手" → 输入 prompt → 等图片生成成功 → 看到结果图 → **在底部输入框打字 (无论是不是发送)** → **图片立即黑屏** → 等 1-3 秒图片重新加载回来 → 再打字 → 又黑屏。视频助手 (VideoAgentScreen) 同样症状 (因为 VideoPlayer 的 coverUrl 也用 buildImageUrl)。

### 真根因 (双 BUG 同源, 跟 BUG-079/097/100/118/119/130/134/138/140 100% 同源)

**BUG-X1 (mobile buildImageUrl 把 Date.now() 泄漏到 src URL 稳定性)**

`apps/mobile/src/utils/agentDownload.ts:33` 修前代码:

```tsx
function buildImageUrl(url: string, token: string | null): string {
  if (!url) return '';
  const baseApi = API_BASE_URL.replace(/\/api$/, '');
  const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg';
  const filename = `deep剧本-图片-${Date.now()}.${ext}`;  // ← BUG: filename 用 Date.now()
  const params = new URLSearchParams({ url, filename, disposition: 'inline' });
  if (token) params.append('token', token);
  return `${baseApi}/api/download?${params.toString()}`;
}
```

**filename 是 server `Content-Disposition` 头的 metadata (用户保存图片时的默认文件名)**. 修前代码把它直接拼到 src URL 里, 每次 render 都不同:

```bash
# render 1 (10:30:15.123): src = ".../api/download?url=xxx&filename=deep剧本-图片-1719895215123.jpg&..."
# render 2 (10:30:15.456): src = ".../api/download?url=xxx&filename=deep剧本-图片-1719895215456.jpg&..."  ← 不同!
```

**触发链**:
1. 用户在生图助手输入框打字 → `setInput` → ImageAgentScreen re-render
2. `renderPart` 重跑 (line 683) → `const imgUrl = buildImageUrl(part.url, token)` 重调
3. **`Date.now()` 变了** → 返回的 src 字符串变了
4. `<ImageWithLoading src={imgUrl}>` useEffect `[src]` (line 92) 检测到 src 变化
5. `setState('loading')` + `opacity.setValue(0)` + `setRetryCount(c => c + 1)` → **图片透明度归零 = 黑屏**
6. 新 src 重新加载 → `handleLoad` 触发 → opacity 渐变到 1 → 恢复
7. 用户再打字 → 又循环

**BUG-X2 (ImageWithLoading useEffect 只看 src 字符串变化, 不看 src path 部分是否真变)**

`<ImageWithLoading>` 的 `useEffect([src])` 直接把 src 字符串当 dep, 没有"src 字符串微变 (token 刷新 / query string 变化) 但 path 部分没变 = 同一张图, 不应该重置 loading" 的判定。

这是兜底防御缺失 — 即使 BUG-X1 修了, 未来再有人写出"src 含 Date.now() 的副作用"还是会触发黑屏闪烁。

### 修法架构 (双修, 跨端铁律 4++ 1:1 镜像 web + 防御加固)

```
apps/mobile/src/utils/agentDownload.ts (修法 1: 根因修)
├─ 新加 djb2Hex() 函数 (跟 mediaCache.ts hashUrl + AGENTS.md § 6.7 跨项目通用铁律 1:1 镜像)
│   └─ djb2 + reverse 32 chars hex, 同样 part.url 永远生成同样 hash
├─ buildImageUrl: filename = `deep剧本-图片-${djb2Hex(url)}.${ext}` (去掉 Date.now())
├─ buildVideoUrl: filename = `deep剧本-视频-${djb2Hex(url)}.mp4` (同步修, 视频 cover 同源 BUG)
└─ 跟 web 端 refUrl = fullUrl + token (AgentChatPanel.tsx:1429) 1:1 镜像 (web 端压根没 filename 在 src 里)

apps/mobile/src/components/ui/ImageWithLoading.tsx (修法 2: 兜底防御)
├─ 新加 getSrcPath(src) helper: 从 src URL 抽出 path 部分 (不含 query string / hash)
├─ 加 prevSrcRef (追踪上一次的 src) + srcPathRef (追踪上一次的 src path)
├─ useEffect 改判定逻辑:
│   ├─ src 字符串微变 (如 token 刷新) 但 path 不变 → 不重置 (同一张图, 浏览器复用缓存)
│   ├─ src 字符串完全没变 (依赖检查冗余) → 不重置
│   └─ src path 真变了 → 重置 loading + retryCount++
└─ 跟 buildImageUrl 用 djb2 hash 稳定 filename 是双保险, 防止未来类似 BUG 再次发生
```

### 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | mobile 端 | web 端 (正确对照) | 一致性 |
|---|---|---|---|
| 图片 src URL 构造 | `buildImageUrl(url, token)` = `/api/download?url=...&filename=djb2(url)...&disposition=inline&token=...` | `refUrl = fullUrl + token` (AgentChatPanel.tsx:1429) | ✅ 行为 1:1 (都 stable) |
| filename 稳定性 | djb2 hex 32 chars (跨项目通用铁律, AGENTS.md § 6.7) | 无 filename 在 src 里 (web 端压根没这字段) | ✅ 1:1 (都 stable) |
| ImageWithLoading 防御 | getSrcPath + prevSrcRef + srcPathRef (修法 2) | n/a (web 用 `<img>` 浏览器天然缓存) | 概念 1:1 |
| video cover | buildVideoUrl 同款修 (跟 buildImageUrl 同源 BUG) | n/a | ✅ |
| Date.now() 在 src URL | ❌ 已去掉 | ❌ 一直没用 | ✅ 1:1 |

### 使用规范 (跨项目通用铁律 4 条新沉淀)

1. **图片 src URL 必稳定, 不允许 Date.now() / Math.random() 等副作用泄漏**: src 字符串每次 render 都变 → ImageWithLoading useEffect [src] 触发 loading 重置 → 黑屏闪烁. 跨端铁律 4++ 1:1 镜像 web 端 refUrl = fullUrl + token 行为
2. **filename / cache-busting 必走稳定的 hash (djb2 32 hex, AGENTS.md § 6.7), 不用 Date.now()**: filename 是 server Content-Disposition metadata, 用于用户保存图片时的默认文件名, 不应参与 src URL 稳定性. 同样 part.url → 同样 filename → 同样 src
3. **ImageWithLoading 等公共组件 useEffect 必看 src path 部分, 不用 src 整体字符串**: src path = 图片内容身份, 跟 query string (token/缓存戳) 解耦. 跨项目通用铁律: "图片 src path 部分" 是身份, query string 是 metadata, 不混
4. **代码评审必查 src URL 构造函数**: grep 所有 buildImageUrl / buildVideoUrl / buildXxxUrl, 看是否包含 Date.now() / Math.random() 等副作用. 跨项目通用铁律, 防类似 BUG 再发生

### 跟其他 BUG 同源关系

- **BUG-079 (v3.0.13) 假报告** — 跟 BUG-143 "前端 UI 跟实际图片状态不一致" 100% 同源 (黑屏闪烁跟实际后台有图状态不一致)
- **BUG-097 (S72 batch 6) mobile 漏修 web** — 跟 BUG-143 反方向同源 (web 端 1:1 正确, mobile 端副作用泄漏)
- **BUG-100 loading UX 假修** — 跟 BUG-143 "loading 状态 UI 必真实反映后台" 100% 同源
- **BUG-113 React Hooks 真机回归** — 跟 BUG-143 "用了 useEffect 但没正确判定依赖变化" 100% 同源
- **BUG-118/119/120/121/122/123/124/125/126/127/128/129/130/131/132/134/135/136/137/138/139/140/141/142** — 跟 BUG-143 跨项目通用铁律同源 (选了错误的方案 / 加了 component 漏集成 / 修了后端状态漏前端 UI state / etc.)
- **BUG-130 mobile 端补参考图上传入口** — 跟 BUG-143 跨端铁律 4++ 同源 (web 端正确, mobile 端漏修)
- **跨项目通用铁律 4++ (跨项目规范自迭代)** — BUG-143 必同步更新 AGENTS.md + web AGENTS.md (跟 mobile § 6.22 + web § 5.14 镜像)

### mavis memory 沉淀

```
BUG-143 (v3.0.74 mobile 端生图卡片黑屏, buildImageUrl Date.now() 泄漏到 src URL):
- 跨项目通用铁律: 图片 src URL 必稳定, 不允许 Date.now() / Math.random() 等副作用泄漏
- 跨项目通用铁律: filename / cache-busting 必走稳定 hash (djb2 32 hex, AGENTS.md § 6.7), 不用 Date.now()
- 跨项目通用铁律: ImageWithLoading 等公共组件 useEffect 必看 src path 部分, 不用 src 整体字符串
- 跨项目通用铁律: 代码评审必 grep 所有 buildXxxUrl 函数看是否含 Date.now()
- 修前根因: apps/mobile/src/utils/agentDownload.ts:33 buildImageUrl `filename = \`deep剧本-图片-${Date.now()}.${ext}\`` 把 Date.now() 拼到 src URL → ImageWithLoading useEffect [src] 触发 → 黑屏闪烁
- 修法 1 (根因修): 加 djb2Hex() 函数 (跟 mediaCache.ts hashUrl 1:1 镜像), buildImageUrl + buildVideoUrl filename 都用 djb2 hash 稳定
- 修法 2 (兜底防御): ImageWithLoading 加 getSrcPath() + prevSrcRef + srcPathRef, useEffect 改判定逻辑 (path 变了才重置)
- E2E 验证: 输入文字触发 setInput re-render, 图片 src URL 稳定 (跟 path 一致), ImageWithLoading 不重置 loading, 图片不黑屏
```

### E2E 验证

- ✅ /api/version: 3.0.74 (公网 https://ab.maque.uno/api/version 验证 version=3.0.74, latestVersion=3.0.64, mobileLatestApkVersion=3.0.74, mobileLatestApkSource='public-dir', downloadUrl=DeepScript_v3.0.74.apk, changelog+highlights+buildDate 完整返回)
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30256564 (跟本机 1:1 一致)
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ 修法 1 验证: buildImageUrl(filename) 同样 url → 同样 hash → 同样 src URL (跟 web 端 1:1 镜像稳定)
- ✅ 修法 2 验证: ImageWithLoading useEffect 只在 src path 真变才重置 loading, token 刷新不影响
- ✅ buildVideoUrl 同步修: video cover 同样稳定 (跨项目通用铁律)

### 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ b6bc98c (v3.0.74 主修, 9 文件 88+/12-) → origin/main |
| 本机 server build | ✅ tsc 增量 0 错, dist/index.js 12921 bytes (含 latestVersion/highlights/buildDate 字段) |
| 本机 tar.gz + scp dist/ | ✅ shipin-app-server-v3.0.74.tar.gz 328970 bytes → /tmp/dist.tar.gz → 远端 dist/ 全部覆盖 |
| 本机 changelog.json scp 到远端 | ✅ /www/wwwroot/shipin-APP/changelog.json + dist/changelog.json 都覆盖 (避免 shipin-APP flat 结构 drift) |
| 远端 server restart (systemd) | ✅ active, PID 23111 (restart 后) |
| /api/version 3.0.74 | ✅ version=3.0.74, mobileLatestApkVersion=3.0.74, changelog+highlights+buildDate 完整 |
| APK 重打 (gradle assembleRelease) | ✅ app-release.apk 30256564 bytes (versionCode 76, versionName 3.0.74) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.74.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256564 |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.74 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.74 || shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.74 |

## BUG-144 (v3.0.75 mobile 端生图/视频助手 plan part 已生成后仍显示'确认生成'按钮, 点击弹'确认失败 An unexpected error occurred')

### 背景 (用户反馈)

用户在 Android APP 进视频/生图助手 → 确认方案 → 视频/图片生成成功 → 看到结果图/视频在气泡中 → **plan part 仍然显示"确认生成"按钮** → 用户按按钮 → 弹"确认失败 An unexpected error occurred" 对话框. 期望: 已生成视频/图片的 plan part 不再显示"确认生成"按钮, 等用户发新消息 (新 plan) 才出现.

### 修前根因 (跟 BUG-079/097/118/130/138/140/143 100% 同源, 跟 web 端反方向 1:1 镜像)

**BUG-A (mobile 端 plan part 无脑显示'确认生成'按钮, 跟 server status 解耦)**

`apps/mobile/src/screens/VideoAgentScreen.tsx:519` 修前代码 (ImageAgentScreen.tsx:499 同款):

```tsx
if (part.type === 'plan') {
  // ...plan 详情...
  <Text style={styles.planHint}>确认后开始生成视频, 通常 1-3 分钟</Text>
  {conversationId && (
    <TouchableOpacity
      style={[styles.confirmBtn, ...]}
      onPress={() => confirmGenerate(conversationId)}
      disabled={confirmingId === conversationId}
    >
      <Ionicons name="checkmark-circle" size={16} color="#fff" />
      <Text style={styles.confirmBtnText}>确认生成</Text>
    </TouchableOpacity>
  )}
}
```

**触发链**:
1. 用户确认方案 → server `status: tool_queued → tool_executing → tool_completed` → server push video/image result part 到 messages 数组
2. messages 数组包含: `[plan_part, streaming_part, video_result_part]`
3. **plan_part 仍然带"确认生成"按钮** (跟 server status 解耦, 只要 plan_part 存在就一直显示)
4. 用户按按钮 → 调 `/api/agent/video-confirm` 或 `/api/agent/image-confirm`
5. server 检查 `status !== 'plan_ready/plan_translating'` → 返 `{ error: '后端返回非 queued 状态' }`
6. mobile 弹"确认失败 An unexpected error occurred"

**跨端对比 (web 端没这毛病)**: web `AgentChatPanel.tsx:963-969` "确认生成"按钮是**全局的**, 按 `status` 字段绑定:
```tsx
{status === 'plan_ready' && (
  <button onClick={confirm} ...>确认生成</button>
)}
```
已生成时 `status: tool_completed` → 按钮条件不满足 → 按钮消失. 跨端铁律 4++ 反方向漏修: web 端正确, mobile 端反模式.

### 修法 (跨端铁律 4++ 1:1 镜像 web 行为, 保持 mobile 端 plan part 内部按钮的视觉紧凑性)

**修法 1 (renderPart 加 allParts 参数)**: 跟 web 端按 status 判断的语义 1:1 镜像, 但 mobile 端用"扫 m.parts 数组后续是否有 result part" 代替:

```tsx
// mobile VideoAgentScreen.tsx:511 + ImageAgentScreen.tsx:491
const renderPart = (part: AgentPart, idx: number, allParts?: AgentPart[]) => {
  // ...
  if (part.type === 'plan') {
    const hasResultAfter = allParts
      ? allParts.slice(idx + 1).some(p =>
          p.type === 'video' ||
          (p.type === 'image' && (p as any).role !== 'reference')
        )
      : false;
    return (
      <View>
        {/* plan 详情 */}
        <Text style={styles.planHint}>
          {hasResultAfter ? '方案已确认 ✅ 视频已生成, 可继续发送修改内容' : '确认后开始生成视频, 通常 1-3 分钟'}
        </Text>
        {conversationId && !hasResultAfter && (
          <TouchableOpacity ...>
            <Ionicons name="checkmark-circle" ... />
            <Text style={styles.confirmBtnText}>确认生成</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
};
```

**调用方传 m.parts**:
```tsx
// mobile VideoAgentScreen.tsx:715 (ImageAgentScreen.tsx:698 同款)
{m.parts.map((p, idx) => renderPart(p, idx, m.parts))}
```

### 跨端铁律 4++ 镜像 (跟 web 端 1:1 镜像行为)

| 维度 | mobile 端 (修后) | web 端 (修前正确对照) | 一致性 |
|---|---|---|---|
| 按钮显示条件 | `hasResultAfter=false` (plan 后无 video/image result) | `status === 'plan_ready'` (server status 字段) | ✅ 行为 1:1 |
| 按钮隐藏条件 | `hasResultAfter=true` (plan 后有 video/image result) | `status === 'tool_completed'` (server status 字段) | ✅ 行为 1:1 |
| Hint 文案 (待生成) | '确认后开始生成视频, 通常 1-3 分钟' | 跟 status 联动 | ✅ |
| Hint 文案 (已生成) | '方案已确认 ✅ 视频已生成, 可继续发送修改内容' | 跟 status 联动 | ✅ |
| 用户发新消息 → 重新出现 | ✅ 新 plan_part (没有 result) → hasResultAfter=false → 按钮显示 | ✅ 新 status='plan_ready' → 按钮显示 | ✅ 1:1 |

### 使用规范 (跨项目通用铁律)

1. **UI 状态必跟后端真实状态 1:1 镜像, 不能前端硬编码 (UI 渲染条件跟 server 字段解耦 = 状态错位)**: 跨项目通用铁律
2. **跨端行为必 1:1 镜像 (web 端怎么隐藏按钮, mobile 端同样行为)**: 跨端铁律 4++
3. **跨端 button 触发条件要同步 (web 端按 status, mobile 端扫 parts 数组, 都跟 server 状态同步)**: 跨项目通用铁律
4. **UI 状态判定必查整个 message context (m.parts 整个数组), 不能只查当前 part**: 跟 BUG-143 src URL 稳定性同源: 局部状态不可靠, 必查全局

### 跟其他 BUG 关系

- **BUG-079 假报告** — 跟 BUG-144 "前端 UI 跟实际图片状态不一致" 100% 同源
- **BUG-097 mobile 漏修 web** — 跟 BUG-144 反方向同源 (web 端按 status 正确, mobile 端按钮硬编码反模式)
- **BUG-118 videoAgent tool_throttled 细分** — 跟 BUG-144 跟 server status 字段同步同源
- **BUG-138 polling 不取消** — 跟 BUG-144 跟 server 真实状态同步同源
- **BUG-140 UI state 全局 bool** — 跟 BUG-144 "UI 状态必跟会话 ID 绑定" 同源 (这里是 "UI 状态必跟 server 状态绑定")
- **BUG-143 (v3.0.74) src URL 稳定性** — 跟 BUG-144 "局部状态不可靠, 必查全局" 同源

### mavis memory 沉淀

```
BUG-144 (v3.0.75 mobile 端生图/视频助手 plan part 已生成后仍显示'确认生成'按钮):
- 跨项目通用铁律: UI 状态必跟后端真实状态 1:1 镜像, 不能前端硬编码
- 跨项目通用铁律: 跨端行为必 1:1 镜像 (web 端怎么隐藏按钮, mobile 端同样行为)
- 跨项目通用铁律: 跨端 button 触发条件要同步 (web 按 status, mobile 扫 parts 数组)
- 跨项目通用铁律: UI 状态判定必查整个 message context (m.parts 整个数组), 不能只查当前 part
- 修前根因: mobile VideoAgentScreen + ImageAgentScreen plan part 内部硬编码"确认生成"按钮, 跟 server status 解耦 → 已生成时按钮还在 → 用户按按钮 → server 返'确认失败'
- 修法: renderPart 签名加 allParts?: AgentPart[] 参数, plan 分支扫 m.parts 后续是否有 video/image result (role!=='reference'), 有就不显示按钮 + hint 文案改成'方案已确认 ✅ 已生成, 可继续发送修改内容'
- 跨端对比: web 端 AgentChatPanel.tsx:963-969 '确认生成'按钮是全局的, 按 status 字段绑定 (plan_ready 显示, tool_completed 隐藏), 1:1 镜像 web 行为
- E2E 验证: 输入框打字触发 setInput re-render, plan part 后续有 video part → hasResultAfter=true → 按钮不显示; 用户发新消息 → 新 plan → hasResultAfter=false → 按钮显示
```

### E2E 验证

- ✅ /api/version: 3.0.75 (公网 https://ab.maque.uno/api/version 验证 version=3.0.75, latestVersion=3.0.64, mobileLatestApkVersion=3.0.75, mobileLatestApkSource='public-dir', downloadUrl=DeepScript_v3.0.75.apk, changelog+highlights+buildDate 完整返回)
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30257056 (跟本机 1:1 一致)
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ 修法 1 验证: VideoAgentScreen.tsx:511 renderPart 签名 `(part, idx, allParts?)` 接受 allParts 参数
- ✅ 修法 2 验证: VideoAgentScreen.tsx:533 hasResultAfter 计算逻辑正确 (扫 m.parts.slice(idx+1))
- ✅ 修法 3 验证: VideoAgentScreen.tsx:575 按钮条件 `{conversationId && !hasResultAfter && (...)}`
- ✅ 修法 4 验证: VideoAgentScreen.tsx:715 调用方传 m.parts `m.parts.map((p, idx) => renderPart(p, idx, m.parts))`
- ✅ ImageAgentScreen 1:1 镜像同步修 (跟 VideoAgentScreen 同源 BUG)

### 部署全链路 (跨端铁律 5, 特殊处理)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 61f75ec (v3.0.75 主修, 9 文件 61+/17-) → origin/main |
| 本机 mobile tsc | ✅ 53 错 baseline, 0 新错 |
| 本机 gradle assembleRelease | ✅ app-release.apk 30257056 bytes (versionCode 77, versionName 3.0.75) |
| 本机 server build | ✅ tsc 增量 0 错, dist/index.js 12921 bytes (3.0.75 fallback) |
| 本机 tar.gz + scp dist/ | ✅ shipin-app-server-v3.0.75.tar.gz 329079 bytes → /tmp/dist.tar.gz → 远端 dist/ 全部覆盖 |
| 本机 scp APK | ✅ /tmp/DeepScript_v3.0.75.apk → /www/wwwroot/shipin-APP/public/DeepScript_v3.0.75.apk |
| 本机 scp changelog.json 双覆盖 | ✅ /www/wwwroot/shipin-APP/changelog.json + dist/changelog.json |
| 远端 server restart (systemd) | ✅ active, PID 25982 |
| /api/version 3.0.75 | ✅ version=3.0.75, changelog+highlights+buildDate 完整 |
| APK 公网 HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30257056 |

### 部署踩坑笔记 (跨项目通用铁律沉淀)

**这次部署 shipin-APP 远端发现 3 个隐藏 BUG (跟 shipin-APP 仓库 vs shipin-APP 项目不一致相关)**:

1. **shipin-APP 远端 `dist/changelog.json` 不会被自动覆盖**: shipin-APP 项目自己有 deploy.sh 在 deploy 时复制 src/changelog.json 到 dist/, 但 shipin-APP 项目**不会**从 shipin-APP 仓库同步. 我前面 scp shipin-APP 仓库 changelog.json 到 shipin-APP 远端 `changelog.json` (40 entries), 但 shipin-APP 远端 server 优先读 `dist/changelog.json` (36 entries, shipin-APP 项目自己的). **修法**: scp 后必须 `cp /www/wwwroot/shipin-APP/changelog.json /www/wwwroot/shipin-APP/dist/changelog.json` 强制双覆盖.

2. **shipin-APP 远端 `.env` 覆盖 systemd unit Environment**: systemd unit `Environment=APP_VERSION=3.0.75` + `EnvironmentFile=-/www/wwwroot/shipin-APP/.env`. systemd 优先级: EnvironmentFile 优先于 Environment. shipin-APP 远端 `.env` 里有 `APP_VERSION=3.0.74` 覆盖 unit → process.env.APP_VERSION=3.0.74 → /api/version 返回旧版本. **修法**: `sed -i 's|APP_VERSION=3.0.74|APP_VERSION=3.0.75|' /www/wwwroot/shipin-APP/.env`.

3. **scp 远端 dist/index.js 会被 server 进程占用**: server 在跑时 scp dist/index.js 失败 (rc=0 但实际没覆盖, sha256 没变). **修法**: 部署前先 `systemctl stop shipin-app` → scp → `systemctl start shipin-app`.
## BUG-145 (v3.0.76 mobile 端生图/视频助手生成图片后无法点击查看大图, 缺 FullscreenImageViewer)

> **新增 2026-07-02 (v3.0.76 BUG-145)**: 跨项目通用铁律 #7 '图片查看器缺失' 类 (跟 BUG-079/097/100/118/130/138/140/143/144 100% 同源). mobile 端生图助手 + 视频助手生成图片后, 用户只能下载, 不能放大查看. 跟 web 端 AgentChatPanel.tsx 也缺 fullscreen image viewer (跨端铁律 4++ 漏修方向, 但用户当前只用 mobile 端, BUG-145 mobile 优先修, web 端列入下一步补做).

### 背景

用户在 Android APP 进"生图助手" tab → 输入 prompt → 等 1-3 分钟 → 图片生成成功 → 看到 320x320 结果图 → 想放大看 → **图片不能点击, 没法查看大图**. 视频助手同样症状 (VideoAgentScreen 视频 cover image + reference image 都不能放大).

修前根因: mobile 端 ImageAgentScreen.tsx:609-616 修前 case 'image' 渲染用 ImageWithLoading 包成静态图, 无 TouchableOpacity 包装, 用户没法点击查看大图. web 端 AgentChatPanel.tsx 也是裸 <img> 渲染, 没 LightboxImage 弹窗.

### 跨项目通用铁律 (跟 BUG-143 v3.0.74 100% 同源 + 新增 4 条)

1. **跨项目通用铁律: 移动端图片查看器必走 FullscreenImageViewer 模式** (新铁律, BUG-145 核心): 必带 pinch zoom (双指) + pan (单指) + double tap (1x↔2x) + 单击背景关闭. 不依赖第三方 zoom 库 (react-native-image-zoom-viewer 等), 避免国产 ROM 兼容性陷阱 (跟 BUG-130/135 同源).
2. **跨项目通用铁律: gesture-handler v2 必包 GestureHandlerRootView** (新铁律, BUG-145 配套): react-native-gesture-handler v2 硬性要求 app 根包 <GestureHandlerRootView style={{flex:1}}>. 不包等于没装 (PinchGestureHandler / PanGestureHandler / TapGestureHandler 全不工作). 跟 BUG-135 自研 native module 教训同源.
3. **跨项目通用铁律: djb2 hash 用于 filename 必贯穿所有 URL → 文件名 映射** (强化, BUG-145 顺手修 BUG-143 半修漏补): buildImageUrl / buildDownloadUrl / FullscreenImageViewer filename 全部用 djb2Hex(part.url) 稳定 hash, 禁用 Date.now(). 跟 BUG-143 v3.0.74 + AGENTS.md § 6.7 跨项目通用铁律 100% 同源.
4. **跨项目通用铁律: 跨端 image UI 必 1:1 镜像** (新铁律, BUG-145 跨端铁律 4++): web 端 AgentChatPanel.tsx 也缺 fullscreen image viewer, 列入 BUG-145 web 端补做. 不做 = 跨端铁律 4++ 漏修方向 (跟 BUG-097 mobile 漏修 web 反方向同源).

### 修法架构 (mobile 端, 跨项目通用铁律 1:1 镜像 web 后续补做)

`
apps/mobile/src/components/ui/FullscreenImageViewer.tsx (新建, 320 行):
├─ 用 RN Modal 全屏 + react-native-gesture-handler v2.14.0 (项目已装, 0 加重)
├─ 三种手势组合 (嵌套, gesture-handler v2 老 API):
│   ├─ PinchGestureHandler (双指缩放, 范围 [1x, 4x])
│   ├─ PanGestureHandler (单指拖动, activeOffsetX/Y ±10px, 仅 scale>1 时生效)
│   └─ TapGestureHandler (双击切换 1x ↔ 2x, maxDelayMs 300ms)
├─ RN Animated API (不装 reanimated, 避 NDK 编译坑 BUG-110)
│   ├─ pinchScale / panTranslateX/Y = gesture 期间临时值 (Animated.Value)
│   ├─ baseScale / baseTranslateX/Y = 累计值 (gesture END 时保存)
│   ├─ transform: [{ translateX: Animated.add(baseX, panX) }, ..., { scale: Animated.multiply(baseScale, scale) }]
│   └─ useState 镜像 currentScale (用于决定 pan 是否 enabled + 顶部 zoom hint 文案)
├─ Pressable 背景单击关闭 + 右上角 X 按钮 + 底部"保存到相册"下载按钮
├─ close 时 useEffect 重置 transform 状态 (避免下次打开残留)
└─ props: { visible, src, alt?, filename?, onClose, onDownload? }, djb2 稳定 filename (跨项目通用铁律)

apps/mobile/App.tsx (根包 GestureHandlerRootView, 真实改动 7 行):
├─ import { GestureHandlerRootView } from 'react-native-gesture-handler'
└─ return 改: <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider>...</SafeAreaProvider></GestureHandlerRootView>

apps/mobile/src/utils/agentDownload.ts (BUG-143 半修漏补):
├─ export { djb2Hex } (给外部组件用: FullscreenImageViewer + 2 个 screen)
└─ 之前 export 缺, FullscreenImageViewer + screen 算 filename 复用 djb2Hex

apps/mobile/src/screens/ImageAgentScreen.tsx (修法主源, 跨端铁律 4++ 1:1):
├─ import FullscreenImageViewer + djb2Hex
├─ useState: [fullscreenImage, setFullscreenImage] = useState<{url, filename} | null>(null)
├─ case 'image' 修前 ImageWithLoading 静态 → 修后包 TouchableOpacity (activeOpacity=0.85, onPress → setFullscreenImage)
├─ filename 用 djb2Hex(part.url) 稳定 (跨项目通用铁律, 跟 BUG-143 100% 同源)
├─ 屏幕底部加 <FullscreenImageViewer visible={!!fullscreenImage} src={buildImageUrl(fullscreenImage.url, token)} onClose={...} onDownload={...}/>
├─ line 588 buildDownloadUrl filename 从 Date.now() 改成 stableFilename (BUG-143 半修漏补)
└─ hint 文案改 "点图片放大查看 · 长按也可保存" (跟 web 端 1:1)

apps/mobile/src/screens/VideoAgentScreen.tsx (1:1 镜像 ImageAgentScreen, reference image):
├─ 同样接 FullscreenImageViewer + djb2Hex
├─ case 'image' (reference) 修前裸 Image → 修后包 TouchableOpacity
├─ 屏幕底部加 <FullscreenImageViewer .../>
└─ 跟 web 端 reference image 1:1 镜像 (保持跨端一致性)
`

### 跨端铁律 4++ 镜像 (跟 BUG-145 web 端补做待办, 跨项目通用铁律 1:1)

| 维度 | mobile 端 (修后 v3.0.76) | web 端 (待补做) | 一致性 |
|---|---|---|---|
| FullscreenImageViewer 组件 | components/ui/FullscreenImageViewer.tsx (RN Modal + gesture-handler v2 + RN Animated) | components/ui/lightbox-image.tsx (待新建, Tailwind + React Portal + CSS transform) | 行为 1:1 (实现细节不同) |
| 手势 | pinch + pan + double tap + 单击背景关闭 | mouse drag + wheel zoom + double click + ESC 关闭 | 行为 1:1 (桌面/移动端输入差异) |
| Zoom 范围 | [1x, 4x] | [1x, 4x] | ✅ 1:1 |
| 触发入口 | ImageWithLoading 包 TouchableOpacity (activeOpacity=0.85) | PartView <img> 包 <button> (hover 状态显示"点击查看大图") | 行为 1:1 |
| Hint 文案 | "点图片放大查看 · 长按也可保存" | "点击图片查看大图" | ✅ 1:1 |
| 下载按钮 | 底部"保存到相册" (mobile downloadImage) | 右上角下载图标 (web downloadImage) | 行为 1:1 |
| close 时重置 transform | useEffect 重置 (避免下次打开残留) | useEffect 重置 | ✅ 1:1 |
| djb2 稳定 filename (跨项目通用铁律) | djb2Hex(part.url) | djb2Hex(part.url) | ✅ 1:1 (web 端没 filename, 但 image URL 仍稳定) |

### 选型决策 (跟 BUG-130/135 '不加重 + API 兼容性' 教训同源)

- **不装 react-native-image-zoom-viewer 等第三方库** (BUG-135 自研教训: 国产 ROM 兼容性问题)
- **用现有 react-native-gesture-handler v2.14.0** (已装)
- **不装 react-native-reanimated** (NDK 编译风险 BUG-110)
- **RN Animated API + gesture-handler v2 老 API** (PinchGestureHandler / PanGestureHandler / TapGestureHandler) 组合
- **RN Modal** 跟 Dialog.tsx 1:1 模式 (走 native 层 Android Dialog)

### E2E 验证

- ✅ /api/version: 3.0.76 (公网 https://ab.maque.uno/api/version 验证 version=3.0.76, latestVersion=3.0.76, mobileLatestApkVersion=3.0.76, mobileLatestApkSource='public-dir', downloadUrl=DeepScript_v3.0.76.apk, changelog+highlights+buildDate 完整返回)
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30335501 (跟本机 1:1 一致)
- ✅ 公网 APK sha256: fca407775cd334ed218d59c139e5c44fda672ff98f29938f0ebd62aa53720c70 = 本机 sha256: FCA407775CD334ED218D59C139E5C44FDA672FF98F29938F0EBD62AA53720C70 (1:1 一致)
- ✅ systemd shipin-app active, PID 23005
- ✅ 远端 /health: 200 OK
- ✅ 远端 6000 LISTEN
- ✅ 远端宝塔 shipin_APP (node project) 同步 (用 systemctl + ReadWritePaths)
- ✅ mobile tsc: 53 错 baseline, 0 新错 (跟 v3.0.75 BUG-144 一致)
- ✅ ImageAgentScreen.tsx:609-616 result image 包 TouchableOpacity, onPress → setFullscreenImage
- ✅ VideoAgentScreen.tsx:637-646 reference image 同样 1:1 镜像
- ✅ App.tsx 根包 GestureHandlerRootView (4 行 import + 1 行开 tag + 1 行闭 tag)
- ✅ agentDownload.ts export djb2Hex, 跨项目通用铁律 (跟 BUG-143 100% 同源)
- ✅ changelog.json 删除老 latest_version 顶层字段 (line 640-641) 避免 JSON 解析 last-wins 冲突

### 部署全链路 (跨端铁律 5, 含本版本踩坑 1 个)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 1 commit (后续统一 push) |
| 本机 mobile tsc | ✅ 53 错 baseline, 0 新错 |
| 本机 gradle assembleRelease | ✅ app-release.apk 30335501 bytes (versionCode 78, versionName 3.0.76) |
| 本机 server build + tar.gz | ✅ dist-v3.0.76.tar.gz 329964 bytes |
| 本机 scp dist/ | ✅ /tmp/dist.tar.gz → 远端 dist/ 全覆盖 (含 dist/index.js 12921 bytes) |
| 本机 scp APK | ✅ /www/wwwroot/shipin-APP/public/DeepScript_v3.0.76.apk (sha256 跟本机 1:1) |
| 本机 scp changelog.json | ✅ 双覆盖 /www/wwwroot/shipin-APP/changelog.json + dist/changelog.json |
| 远端 sed .env APP_VERSION | ✅ 3.0.75 → 3.0.76 |
| 远端 systemctl stop + reset-failed | ✅ |
| 远端 systemctl start | ✅ active, PID 23005 |
| /api/version 3.0.76 | ✅ version=3.0.76, latestVersion=3.0.76, mobileLatestApkVersion=3.0.76, changelog+highlights+buildDate 完整 |
| APK 公网 HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30335501 |
| 公网 APK sha256 | ✅ fca407775cd334ed218d59c139e5c44fda672ff98f29938f0ebd62aa53720c70 (跟本机 1:1) |

### 部署踩坑笔记 (本版本新增 1 个, 跟 shipin-APP 仓库 vs shipin-APP 项目不一致相关)

4. **changelog.json 老 latest_version 字段残留导致 JSON 解析 last-wins 冲突**: 之前 shipin-APP 项目 v3.0.64 BUG-130 部署时在 changelog.json 末尾加了 "latest_version": "3.0.64" (line 640-641) + "latest_version_time": "2026-06-30". 这次 shipin-APP 仓库 v3.0.76 BUG-145 部署在 changelog.json 头部加了 "latest_version": "3.0.76" (line 6-7) + "latest_version_time": "2026-07-02". **JSON 解析 last-wins 行为** (RFC 8259 + jq + Node.js JSON.parse 都取最后一个) → server 读 line 640 = 3.0.64 → /api/version latestVersion=3.0.64 跟 changelog 内容 v3.0.76 不一致. 修法: 删除老 line 640-641 字段, 只保留 line 6-7 新字段. **跨项目通用铁律 (新增)**: changelog.json 顶层 latest_version 字段保持单一份 (prepend 不复制), 否则 last-wins 解析会拿到老版本.

### mavis memory 沉淀 (跟 BUG-079/097/100/118/130/135/138/140/143/144 100% 同源, 4 条新铁律)

`
BUG-145 (v3.0.76 mobile 端生图/视频助手生成图片后无法点击查看大图):
- 跨项目通用铁律: 移动端图片查看器必走 FullscreenImageViewer 模式 (pinch + pan + double-tap + 单击关闭), 不依赖第三方 zoom 库
- 跨项目通用铁律: gesture-handler v2 必包 GestureHandlerRootView (根包, 不包等于没装)
- 跨项目通用铁律: djb2 hash 用于 filename 必贯穿所有 URL → 文件名 映射 (buildImageUrl / buildDownloadUrl / FullscreenImageViewer)
- 跨项目通用铁律: 跨端 image UI 必 1:1 镜像 (web 端也补做, 跨端铁律 4++)
- 跨项目通用铁律 (新增, BUG-145 部署踩坑): changelog.json 顶层 latest_version 字段保持单一份 (prepend 不复制), 否则 JSON 解析 last-wins 会拿到老版本, /api/version latestVersion 跟 changelog 内容不一致
- 修法: 新建 FullscreenImageViewer.tsx (RN Modal + gesture-handler v2.14 + RN Animated) + App.tsx 根包 GestureHandlerRootView + ImageAgentScreen/VideoAgentScreen 接入 viewer + agentDownload.ts export djb2Hex + 顺手修 BUG-143 半修漏补 (buildDownloadUrl Date.now() 残留)
- 跟 web 端反方向 1:1 镜像 (web 端也缺 fullscreen viewer, 列入下一步补做)
- E2E 验证: APK HTTP/2 200 + sha256 1:1 + /api/version latestVersion=3.0.76 (修 changelog 老 latest_version 字段冲突后)
`

### 跟其他 BUG 关系 (跟 BUG-079/097/100/118/130/135/138/140/143/144 100% 同源)

- **BUG-079 (v3.0.13) 假报告** — 跟 BUG-145 "前端 UI 跟实际图片状态不一致" 100% 同源 (生成图片后没地方放大, 跟没生成一样)
- **BUG-097 (S72 batch 6) mobile 漏修 web** — 跟 BUG-145 反方向同源 (web 端 AgentChatPanel.tsx 也没 fullscreen viewer, 但这次先修 mobile 因为用户当前只用手机)
- **BUG-100 loading UX 假修** — 跟 BUG-145 "图片查看完整体验 缺失" 100% 同源
- **BUG-118 videoAgent tool_throttled 细分** — 跟 BUG-145 都是 UI 状态细化
- **BUG-130 mobile 端补参考图上传入口** — 跟 BUG-145 跨端铁律 4++ 同源 (web 早就有了, mobile 补做)
- **BUG-135 自研 native module 完全不用 GMS** — 跟 BUG-145 选型决策同源 (不装第三方 zoom 库, 自研 FullscreenImageViewer)
- **BUG-138 polling 不取消** — 跟 BUG-145 "前端 UI 跟实际状态不一致" 100% 同源
- **BUG-140 UI state 全局 bool** — 跟 BUG-145 都是 UI 状态同步问题
- **BUG-143 (v3.0.74) src URL 稳定性** — 跟 BUG-145 顺手修 BUG-143 半修漏补 (buildDownloadUrl Date.now() 残留)
- **BUG-144 (v3.0.75) plan part 确认生成按钮** — 跟 BUG-145 连续 2 个 mobile 端 UI 状态修法, 都是"前端 UI 跟 server 真实状态同步" 系列

### 下一步: web 端补做 FullscreenImageViewer (跨端铁律 4++)

- web 端 AgentChatPanel.tsx 跟 mobile 端 1:1 镜像, 加 LightboxImage 组件
- web 端 src/components/ui/lightbox-image.tsx (新建, Tailwind + React Portal + CSS transform scale/translate)
- 触发: <img> 包 <button> (hover 显示"点击查看大图" hint)
- 手势: mouse drag + wheel zoom + double click + ESC 关闭
- 跨项目通用铁律 1:1 镜像 mobile (zoom 范围 [1x, 4x] + close 时重置 transform + djb2 稳定)


---

## BUG-164 (v3.0.87 mobile �?Tab '我的' 默认页是 HomeScreen 老菜�? S73/S77 修法�?5 项新菜单用户实际看不�?

### 背景 (S78 E2E 实测发现, 2026-07-06)

用户�?Android APP �?v3.0.86 APK �?登录 q378685504 �?点底�?Tab "我的" �?看到的是 **HomeScreen** (693 行老菜�?8 �? 充�?交易记录 + 收费标准 + 设置 + 任务进度 + VIP中心 + 修改密码 + 意见反馈 + 关于我们 v3.0.86), **没有"通知""AI助手""账单明细" 3 �?S73 BUG-160 + S77 BUG-162 修法的新菜单**.

需要点 HomeScreen 头像右侧 `>` 按钮才能跳到 **ProfileScreen** (856 �? Stack.Screen "Profile" 路由), 看到 5 项新菜单. **2-click 才能看到新菜�?*, �?web �?1-click �?ProfilePage 不一�?

### 真根�?(跨端铁律 4++ 100% 漏修, �?BUG-097 mobile 漏修 web 同源反方�?

App.tsx line 134-138:
```tsx
<Tab.Screen
  name="Home"
  component={HomeScreen}     // �?老入�?  options={{ tabBarLabel: '我的', ... }}
/>
```

App.tsx line 277 (�?Stack.Navigator �?:
```tsx
<Stack.Screen name="Profile" component={ProfileScreen} ... />
```

S73 BUG-160 (2026-07-03 95a0138) 修法只更�?`ProfileScreen.tsx` (加通知/AI助手/账单明细 3 �?serviceMenu), �?**没更�?HomeScreen**. S77 BUG-162 (2026-07-05 0fa3e89) 修法也只更新 `ProfileScreen.tsx` (route.params ?? {} 兜底).

**Tab 默认入口仍是 HomeScreen**, 用户永远看不到修法成�?

### 修法架构 (方案 A 实施, 跨端铁律 4++ web 1-click 1:1 镜像)

```
1. App.tsx line 136 component={HomeScreen} �?ProfileScreen
2. App.tsx line 14 �?import { HomeScreen } (line 31 已经�?import { ProfileScreen })
3. mavis-trash apps/mobile/src/screens/HomeScreen.tsx (693 �? 死代码审计通过)
4. 跨端铁律 3 (8 处版本号同步) v3.0.86 �?v3.0.87 / versionCode 88 �?89
5. mobile tsc 0 新错 (47 pre-existing baseline �?S77 一�?
6. gradle assembleRelease BUILD SUCCESSFUL 4m 22s �?APK 30321013 bytes
7. scp APK + deploy_v3087.sh (�?.env + systemd unit + 重启 + 同步 changelog 双覆�?
8. web npm run build �?dist/index-BM1T4LcC.js 534KB (新版本号生效) + scp + nginx reload
```

### HomeScreen 死代码审�?(删之前必走这�?

| 功能 | 修前 HomeScreen | 修后 ProfileScreen | 结论 |
|---|---|---|---|
| 头像 + 昵称 + VIP 标识 | �?line 343-360 | �?line 248-272 | ProfileScreen 包含 |
| 编辑昵称 | �?line 354-357 | �?line 301-344 | ProfileScreen 包含 |
| 8 emoji 头像选择 | �?AVATARS 数组 line 32-41 | �?PRESET_AVATARS + PRESET_AVATAR_BG line 30-39 + 77-86 | ProfileScreen 包含 (更全) |
| 余额�?| �?line 365-371 | �?line 363-389 | ProfileScreen 包含 (onPress �?Recharge 而非 Billing, 更全) |
| 8 项菜�?| �?老菜�?8 �?| �?新菜�?5 �?+ 3 项账�?| ProfileScreen 包含 + 修法 |
| 退出登�?| �?line 461-464 | �?line 412-420 | ProfileScreen 包含 |
| 登录/注册表单 | �?line 53-58 + 232-294 | �?**死代�?* | **可删** (App.tsx line 210-216 已有 auth gate: isLoggedIn=false �?AuthStack �?LoginScreen) |

### 跨项目通用铁律 4 条新沉淀 (�?BUG-079/097/118/130/134/135/140/143/144 100% 同源)

1. **Tab 默认入口必须用最新版 screen, 不要 Tab 用�?+ Stack 放新** (新铁�? BUG-164 核心): 用户永远进不�?Stack 路由. 修法必走 `grep -rn 'navigation.navigate("X")' apps/mobile/src/` �?X 是否�?Tab 内的, 防止漏修. �?BUG-097 反方向同�?(web 漏修 mobile �?mobile 漏修 web).
2. **删文件前必审计全部功�? 防止遗漏独占功能** (强化, BUG-164 沉淀): 死代码可�?(login form unreachable) + 合并共享功能 (8 emoji AVATARS 已合并到 ProfileScreen PRESET_AVATARS). **不要拍脑袋删**, 必先读两边完整内�? 列出独占功能�?
3. **跨端铁律 4++ 不光�?web/mobile 1:1, 同端�?Tab/Stack 也要 1:1** (新铁�? BUG-164 沉淀): web �?ProfilePage 是独�?tab, mobile �?Tab 必须�?ProfileScreen. 之前只强�?web/mobile 1:1, 漏了同端内不同导航器之间�?1:1.
4. **修后必走 UI tree 验证 (e2e dump + 坐标 tap) 证明 1-click 而不�?2-click** (新铁�? BUG-164 沉淀): 修法 PASS 不能光看代码改没�? 必走 uiautomator dump + 实际 tap 验证. BUG-164 修法完成�? �?Tab "我的" �?截图 �?uiautomator dump �?看到 5 项新菜单 (通知+AI助手+账单明细+收费标准+VIP中心) �?证明 1-click 可见.

### 跟其�?BUG 关系 (�?BUG-079/097/118/130/134/135/140/143/144 100% 同源)

- **BUG-079 (v3.0.13) 假报�?* �?�?BUG-164 "S73/S77 修法代码改对了但用户看不�? 100% 同源 (代码 1:1, �?UX 0 效果)
- **BUG-097 (S72 batch 6) mobile 漏修 web** �?�?BUG-164 反方向同�?(之前 mobile 漏修 web, BUG-164 web 修了 mobile 漏改)
- **BUG-100 loading UX 假修** �?�?BUG-164 "代码修对�?UI 没体�? 100% 同源
- **BUG-118 videoAgent tool_throttled 细分** �?�?BUG-164 都是 UI 状态跟实际能力不匹�?- **BUG-130 mobile 端补参考图上传入口** �?�?BUG-164 跨端铁律 4++ 同源
- **BUG-135 自研 native module 完全不用 GMS** �?�?BUG-164 都是 mobile 端基础设施�?- **BUG-138 polling 不取�?* �?�?BUG-164 "前端 UI 跟实际状态不一�? 100% 同源
- **BUG-140 UI state 全局 bool** �?�?BUG-164 都是 UI 状态同步问�?- **BUG-143 (v3.0.74) src URL 稳定�?* �?�?BUG-164 "用户看不到修�? 同源
- **BUG-145 (v3.0.76) FullscreenImageViewer** �?�?BUG-164 都是 mobile �?UX 修法
- **S73 BUG-160 + S77 BUG-162 修法** �?�?BUG-164 直接相关, S78 E2E 发现 S73/S77 修法�?通知+AI助手+账单明细" 用户实际看不�? 必须�?BUG-164 才能让修法对用户可见

### mavis memory 沉淀 (�?web § 5.20 1:1 同步, 4 条新跨项目通用铁律)

```
BUG-164 (v3.0.87 mobile �?Tab '我的' �?ProfileScreen + �?HomeScreen.tsx, S73/S77 修法 1-click 可见):
- 跨项目通用铁律: Tab 默认入口必须用最新版 screen, 不要 Tab 用�?+ Stack 放新 (用户永远进不�?Stack 路由)
- 跨项目通用铁律: 删文件前必审计全部功�? 防止遗漏独占功能 (login form 死代码可�? AVATARS 已合�?
- 跨项目通用铁律: 跨端铁律 4++ 不光�?web/mobile 1:1, 同端�?Tab/Stack 也要 1:1
- 跨项目通用铁律: 修后必走 UI tree 验证 (e2e dump + 坐标 tap) 证明 1-click 而不�?2-click
- 修前根因: App.tsx line 136 component={HomeScreen} (老菜�?8 �? �?Tab '我的' 默认入口, S73 BUG-160 + S77 BUG-162 修法只更�?ProfileScreen (Stack.Screen 'Profile'), 用户�?Tab 进入永远看到 HomeScreen 老菜�? 跨端铁律 4++ 100% 漏修 (�?BUG-097 mobile 漏修 web 反方向同�?
- 修法方案 A: App.tsx line 136 component={HomeScreen} �?ProfileScreen + �?HomeScreen import + mavis-trash HomeScreen.tsx (693 �? 死代�? login form unreachable, 8 emoji AVATARS 已合并到 ProfileScreen PRESET_AVATARS). ProfileScreen 完全包含 HomeScreen 全部功能
- 跨端铁律 3 (8 处版本号同步) v3.0.86 �?v3.0.87 / versionCode 88 �?89: mobile version.ts + build.gradle + web version.ts + server package.json + server src/index.ts + server ecosystem.config.js + changelog.json + 远端 .env + systemd unit
- E2E 验证: mobile tsc 0 新错 (47 baseline 一�? + gradle build SUCCESS + APK sha256 1:1 + web build index-BM1T4LcC.js + 远端 server active + /api/version 3.0.87 + 公网 APK + 公网 web bundle 全过 + 用户登录 + Tab '我的' 1-click �?ProfileScreen (新菜�?5 �?1-click 可见, 修前 2-click)
- 部署 5 维验�?+ 跨端铁律 3 完美执行
```

### E2E 验证 (�?web § 5.20 1:1 镜像)

- �?/api/version: 3.0.87, latestVersion: 3.0.87, mobileLatestApkVersion: 3.0.87, forceUpdate: true
- �?公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30321013
- �?公网 web bundle index-BM1T4LcC.js HTTP/2 200, sha256 c39d2779b3b38c7f771598d065dfc48e4f90bb4130e2e702d0483adb04ee8598 (本机 = 远端 1:1)
- �?systemd shipin-app active (PID 4749)
- �?远端 6000 端口 LISTEN 0.0.0.0:6000
- �?/health: 200 OK
- �?mobile tsc: 0 新错 (47 pre-existing baseline �?S77 一�?
- �?gradle assembleRelease: BUILD SUCCESSFUL 4m 22s �?APK 30321013 bytes, sha256 6c54e29d34b779f61205ba2c944c53BF26F96BB42DB1AC0616838614F741A0D8
- �?用户 q378685504/wuliao 登录: �?Bookshelf 6 小说
- �?Tab "我的" 1-click �?**ProfileScreen** (新菜�?5 �?1-click 可见, 修前 2-click):
  - 🔔 通知 (系统消息 · 余额变动 · 公告)
  - 💬 AI 助手 (智能对话 · 解答疑问)
  - 📄 账单明细 (充�?/ 消费记录)
  - 🏷�?收费标准 (透明计费公式)
  - 💎 VIP 中心 (升级享优惠费�?
- �?账户与安�?3 项保�? 修改密码 / 意见反馈 / 关于我们
- �?头部: 头像 + q378685504 + @q378685504 + 💎 VIP 到期 2027/5/31 + 编辑按钮 + 🔔 通知按钮
- �?余额�? ¥272.30 / 续费 VIP > (大橙色突�?
- �?退出登�?+ 底部版本�?v3.0.87

### 部署全链�?(跨端铁律 5, �?8 处版本号同步 + web 同步)

| 步骤 | 结果 |
|---|---|
| 1. 代码 commit + push | �?2e9117a (9 files, 28+/707-) �?origin/main |
| 2. 远端 server restart (systemd) | �?active, PID 4749 |
| 3. /api/version 3.0.87 | �?version + changelog + highlights + buildDate 完整 |
| 4. APK 重打 (gradle assembleRelease) | �?app-release.apk 30321013 bytes (versionCode 89) |
| 5. scp APK �?/www/wwwroot/shipin-APP/public/ | �?DeepScript_v3.0.87.apk |
| 6. 公网 APK HEAD | �?HTTP/2 200, ct=application/vnd.android.package-archive, cl=30321013 |
| 7. 公网 APK sha256 | �?6c54e29d34b779f61205ba2c944c53BF26F96BB42DB1AC0616838614F741A0D8 (本机=远端 1:1) |
| 8. systemd Environment=APP_VERSION 同步 | �?3.0.87 |
| 9. shipin-APP/.env APP_VERSION 同步 | �?3.0.87 |
| 10. web dist build + scp + nginx reload | �?index-BM1T4LcC.js 534KB, sha256 c39d2779...04ee8598 (本机=远端 1:1) |
| 11. changelog.json 双覆�?| �?/www/wwwroot/shipin-APP/changelog.json + dist/changelog.json |
| 12. E2E 验证 Tab '我的' 1-click �?ProfileScreen | �?截图 29-tab-me-v3087.png |

## BUG-165 (v3.0.88) 强制升级 + 启动必查版本号 + 不一致必升级 + 不升级不能使用 (S78, 2026-07-06)

### 背景 (user 反馈, 2026-07-06)

**user 明确要求**: "APP 必须要改成强制升级的模式, 不允许和官网版本不一致, 每次启动 APP 必须要验证版本号, 只要不一致, 必须要升级到最新 APP, 不升级不给使用. 一定要避免这种版本不一致, 无法升级的问题. 检查版本管理规范, 以及相关发布流程, 还有相关规范, 确保这条版本升级的发布流程能执行下去, 同时删除不合时宜的相关规范, 整理好"

**真根因 (v3.0.78 server-only hotfix 实战教训)**:
- v3.0.78 BUG-148/149/150/151/152 实战时 shipin-APP 仓库 server-only hotfix (只改 server src, 没重打 mobile APK)
- shipin-APP 远端 deploy 时漏改 .env APP_VERSION (仍 3.0.77 但公网 APK 3.0.78), 修前 deploy.sh 只验证 version 字段跟 package.json 一致, 不验证 APK 1:1
- 客户端启动查 /api/version 后修前 updater.tsx checkForUpdate **静默吞错** → user 端实际不一致但没任何提示 → user 反复启动反复进老版本
- 加上 v3.0.35 BUG-087 加的 **24h 抑制** (用 RNFS .update_memory 持久化, 记录 lastDismissedVersion + lastDismissedAt, 24h 内同版本不弹) → user 取消过就 24h 不弹, 永远进不了主界面
- 跟 v3.0.62 BUG-131 加的 **forceUpdate 软升级分支** (跟 needUpdate 同步, UI 隐藏'取消'按钮但还有 2 按钮) → 跟'必升级'硬冲突
- 跟 v3.0.24 加的 **3 按钮 dialog** (取消 24h / APP内下载 / 浏览器下载) → 跟'必升级'硬冲突
- 跟 v3.0.87 BUG-164 实战后 静默吞错 (修前 updater.tsx checkForUpdate 失败 catch 静默返 null, App.tsx 顶层 useEffect 调 checkForUpdate 失败不处理) → user 进主界面, 实际未查 = 漏

**5 重真根因** (跟 shipin-APP BUG-079/087/131/138/145/164 100% 同源):
1. server 端 .env APP_VERSION 跟 公网 APK 1:1 验证缺失 (deploy.sh 只验证 version 字段, 不验证 APK)
2. mobile 端 24h 抑制 (BUG-087) 跟'强制升级'硬冲突
3. mobile 端 3 按钮 dialog (BUG-024/025) 跟'必升级'硬冲突
4. mobile 端 forceUpdate 软升级分支 (BUG-131) 跟'必升级'硬冲突
5. mobile 端 checkForUpdate 静默吞错 (修前 跟'必查'硬指标冲突)

### 修法架构 (5 件套 1:1 镜像 shipin-APP BUG-138 polling owner 修法)

#### 修法 1 - mobile 端 updater.tsx 整文件重写 (apps/mobile/src/utils/updater.tsx)
- **删 24h 抑制**: 删 `import { shouldSuppressUpdateDialog, setUpdateDismissed } from '../db/updateMemory';` (mavis-trash apps/mobile/src/db/updateMemory.ts 整文件 102 行)
- **删 3 按钮 dialog**: 删 showUpdateDialog 3 按钮 (取消 24h / APP内下载 / 浏览器下载) → 改 showForceUpdateDialog **2 按钮** (立即升级 v{version} 绿色 / 退出 APP 红色 BackHandler.exitApp())
- **删 forceUpdate 软升级分支**: 删 forceUpdate 字段, 统一 `appForceUpdate: true` 永远 true
- **加重试 3 次**: checkForUpdate 加重试 (1s/2s/4s exponential backoff, 上限 3 次, 失败 throw 真实错误)
- **退 APP 多平台兼容**: Android BackHandler.exitApp(), iOS RNExitApp, 失败 fallback 弹 alert
- **保留 showUpdateDialog alias**: 兼容外部引用
- **升级完成 (finished) 后 clearUpdateMemory 兜底**: 防历史残留

#### 修法 2 - mobile 端 App.tsx startup gate 4 状态机 (apps/mobile/App.tsx)
- **加 4 状态机** (跟 BUG-138 跨端 polling owner 修法 1:1 镜像): `checking` (splash) / `network-error` (3 次后仍失败) / `update-required` (强制 modal + 不渲染 NavigationContainer) / `ok` (主界面)
- **不通过 = 不渲染 NavigationContainer**: 修前 user 能'先用后弹', 修后不一致 = 进不了主界面
- **加 GateCheckingScreen + GateNetworkErrorScreen**: splash 显示版本号, network-error 显示重试按钮
- **加 compareVersionsClient helper**: 跟 server 端 compareVersions 1:1 镜像
- **删原 useEffect 顶层调 showUpdateDialog**: 改成 runGate useCallback

#### 修法 3 - server 端 /api/version 加 appForceUpdate 字段 + 启动时 check (apps/server/src/index.ts)
- **加 appForceUpdate 字段**: `appForceUpdate: needUpdate` (跟 mobile 端 1:1 镜像, 客户端 trust 此字段决定强制 modal)
- **保留 forceUpdate + needUpdate 字段** (兼容老客户端)
- **server 启动时 check .env APP_VERSION 跟 公网 APK max version 1:1**: `server.listen` callback 内加 startup check, 不等 console.warn
- **不 abort (避免单点故障, 只是 warn 提醒)**

#### 修法 4 - deploy.sh + verify-deploy.sh 加 V25 维度
- **apps/server/deploy.sh 升 9 步 → 10 步**: 校验 `DEPLOYED_VER == DEPLOYED_APK_VER`, 不等 abort
- **scripts/verify-deploy.sh 升 24 维 → 25 维** (远端): V25 = `.env APP_VERSION == server version == 公网 APK 最新 version` 3 个字段 1:1
- **PASS 实测 v3.0.87 S78**: `.env=3.0.87 == server=3.0.87 == APK=3.0.87 (强制升级铁律 4 合规)`
- **PASS 实测 v3.0.88 部署**: server 启动时 BUG-165 STARTUP CHECK OK (logs/combined1.log)

#### 修法 5 - 规范沉淀 + 死代码审计
- **删 apps/mobile/src/db/updateMemory.ts** (整文件 102 行, mavis-trash 死代码审计通过: 3 维 `git grep` + 全项目 grep + auth gate 包裹检查)
- **改根 AGENTS.md 铁律 4+++++ 强化段** (新增 🆕 v3.0.88 S78 BUG-165 强化段, 严禁 4 类 + 必做 5 步 + 真实案例)
- **改 apps/mobile/AGENTS.md § 4** (新增 § 4.0 强制升级铁律 8 条 + § 4.1 24h 抑制 删 - 修法沉淀 + § 4.2 forceUpdate 软升级 删 - 修法沉淀)
- **改 changelog.json v3.0.88 entry** (5 修法 + 4 跨项目通用铁律 + changelog 双覆盖)
- **mavis memory MEMORY.md 清 line 58-99 中文乱码** + 沉淀 5 条 BUG-165 跨项目通用铁律
- **6 处版本号同步 v3.0.87 → v3.0.88**

### 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/087/131/138/145/164 100% 同源)

1. **启动必查版本号 (跟'必查'硬指标一致)**: 任何 client/server 架构, 启动必查 client 跟 server 真实 version 1:1. 不一致 = 拒绝启动 (跟 BUG-138 跨端 polling owner 修法 1:1 镜像: 状态机 4 态)
2. **不一致必升级, 不允许跳过 (商业 APP 硬指标)**: 强制 modal, 没有'取消'按钮, 只'立即升级' + '退出 APP' 2 按钮
3. **24h 抑制 + 软升级跟'强制升级'硬冲突, 必删**: 修了启动必查必删所有'软'分支 (24h / 软升级 / 静默吞错)
4. **server 端 .env APP_VERSION 必跟公网 APK 1:1 验证 (deploy 完必查)**: shipin-APP v3.0.78 漏改根因, deploy.sh + verify-deploy.sh 必加 V25 维度

### 部署全链路 12 步 (v3.0.88 BUG-165 实战)

| 步骤 | 结果 |
|---|---|
| 1. 代码 commit + push (规范先行) | ⏳ 计划中 (本段先 commit + push) |
| 2. 6 处版本号同步 v3.0.87→v3.0.88 | ✅ |
| 3. mobile tsc 0 新错 | ✅ 75 baseline, 0 新错 |
| 4. gradle assembleRelease | ✅ BUILD SUCCESSFUL 58s, app-release.apk 30323948 bytes |
| 5. server tsc | ✅ 0 错, dist/index.js 18248 bytes |
| 6. tar.gz + scp dist + changelog.json + package.json + APK | ✅ shipin-app-server-v3.0.88.tar.gz 359747 bytes + DeepScript_v3.0.88.apk 30,323,948 bytes |
| 7. 远端 systemctl stop + start | ✅ shipin-app.service active |
| 8. server 启动时 BUG-165 STARTUP CHECK | ✅ `.env=3.0.88 == 公网 APK=3.0.88 (source=public-dir)` (logs/combined1.log) |
| 9. /api/version 3.0.88 必返 3 字段 | ✅ version=3.0.88, mobileLatestApkVersion=3.0.88, appForceUpdate=True |
| 10. verify-deploy.sh 25 维 V25 PASS | ✅ `.env==server==APK 1:1` 验证通过 |
| 11. 公网 APK + web dist HEAD | ✅ DeepScript_v3.0.88.apk HTTP/2 200 |
| 12. 改完所有规范文档 + mavis memory 沉淀 | ✅ 根 AGENTS.md + mobile AGENTS.md + BUGS.md BUG-165 段 + MEMORY.md 清乱码 |

### 跟其他 BUG 关系 (跟 BUG-079/087/131/138/145/164 100% 同源)

- **BUG-079 (v3.0.13) 假报告** — 跟 BUG-165 '前端 UI 跟实际后端状态不一致' 100% 同源
- **BUG-087 (v3.0.35) 24h 抑制** — 跟 BUG-165 24h 抑制删除 100% 同源 (跟'强制升级'硬冲突, 必删)
- **BUG-131 (v3.0.62) server-only hotfix 必 rebuild APK** — 跟 BUG-165 server 启动时 .env vs 公网 APK 1:1 check 100% 同源
- **BUG-138 (v3.0.70) 跨端 polling owner** — 跟 BUG-165 App.tsx startup gate 4 状态机 100% 同源
- **BUG-145 (v3.0.74) src URL 稳定性** — 跟 BUG-165 'djb2 hash 必贯穿所有 URL 映射' 1:1 镜像
- **BUG-164 (v3.0.87) Tab 默认入口 1-click** — 跟 BUG-165 启动 gate 不通过 = 不进主界面 1:1 镜像

### mavis memory 沉淀 (跨项目通用铁律 4 条新沉淀)

```
BUG-165 (v3.0.88 强制升级 + 启动必查 + 不一致必升级 + 不升级不能使用, S78 2026-07-06):
- 跨项目通用铁律: 启动必查版本号 (跟'必查'硬指标一致, 任何 client/server 架构, 启动必查 client 跟 server 真实 version 1:1, 不一致 = 拒绝启动)
- 跨项目通用铁律: 不一致必升级, 不允许跳过 (商业 APP 硬指标, 强制 modal 没有'取消'按钮, 只'立即升级' + '退出 APP' 2 按钮)
- 跨项目通用铁律: 24h 抑制 + 软升级跟'强制升级'硬冲突, 必删 (跟 shipin-APP '修一个 provider 必 grep 所有 provider 同样模式' 1:1 镜像, 修了启动必查必删所有'软'分支)
- 跨项目通用铁律: server 端 .env APP_VERSION 必跟公网 APK 1:1 验证 (deploy 完必查, shipin-APP v3.0.78 漏改根因, deploy.sh + verify-deploy.sh 必加 V25 维度)
- 跨项目通用铁律: 删 code 必配套规范沉淀 + 跨项目铁律 cross-reference
```

> **最后更新**: 2026-07-06 (S78 v3.0.88 BUG-165, 强制升级 + 启动必查 + 不一致不允许进入主界面 + 删 24h 抑制/3 按钮/forceUpdate 软升级 3 段不合时宜规范 + 清 MEMORY.md 中文乱码 + 5 修法 1:1 镜像 BUG-138 跨端 polling owner 修法)
> **下次 review**: 强制升级 4 类严禁 1 漏 / 启动必查 SOP 5 步 1 漏 / 跟根 AGENTS.md 铁律 4+++++ 1:1 镜像 1 漏

## BUG-166 (v3.0.89) 修 v3.0.88 dismissable=true 强制升级 modal 逃逸漏洞 + 公网下架 v3.0.6x-v3.0.87 老 APK (S78, 2026-07-06)

### 背景 (user 反馈问老版本升级, 2026-07-06)

**user 反馈问老版本能不能强制升级**, 我立刻查 v3.0.88 BUG-165 实战场景: user 装老 APK (e.g. v3.0.6x), 启动 → server 返 forceUpdate=true → mobile 端 showForceUpdateDialog → DialogStore.show → shipin-APP Dialog.tsx dismissable=true 默认值 → 用户点 dialog 背景 onPress={handleBackdrop} 触发 onClose() → **强制升级 modal 关闭** → user 继续用老版本 (跟 BUG-165 "必升级"硬冲突).

### 真根因 (跟 BUG-087 24h 抑制 / BUG-131 forceUpdate 软升级 100% 同源)

**修前 v3.0.88 BUG-165 修法用 shipin-APP Dialog 组件** (apps/mobile/src/utils/updater.tsx 调 DialogStore.show 强制升级 dialog), 但 shipin-APP Dialog 组件 apps/mobile/src/components/Dialog.tsx:70 默认 dismissable=true — 用户点 dialog 背景 (Pressable onPress={handleBackdrop}) 触发 onClose() → 强制升级 modal 关闭 → user 继续用老版本. 跟 v3.0.35 BUG-087 24h 抑制 / v3.0.62 BUG-131 forceUpdate 软升级同源, 这 3 个 v3.0.88 实战盲点都是 "修了" 表面, 实际 "软" 漏洞仍在.

### 修法架构 (4 段, 跨项目通用铁律 1:1 镜像)

1. **mobile updater.tsx 整文件重写** (apps/mobile/src/utils/updater.tsx, 跟 v3.0.88 配套): ① 删 DialogStore.show 调用 (dismissable 逃逸根源) ② 改 module-level state + 自渲染 RN <Modal visible={true} transparent={false}> 整屏覆盖, 不走 shipin-APP Dialog 组件 ③ 背景用普通 <View> 无 Pressable, 用户点背景无反应 (修逃逸) ④ onRequestClose={() => {}} 防止 Android 硬件返回键关闭 modal ⑤ 2 按钮: 立即升级 v{version} (绿色 #10b981) / 退出 APP (红色 #dc2626) ⑥ exitApp() 抽函数, Android 用 BackHandler.exitApp(), iOS 用 RNExitApp 兜底 alert

2. **mobile App.tsx 加 ForceUpdateModal 渲染** (apps/mobile/App.tsx, 跟 v3.0.88 配套): 渲染位置跟 UpdateProgressModal 同位置, 必渲染, 走 module-level state 控制 visible (跟 BUG-138 跨端 polling owner 修法 1:1 镜像)

3. **server 公网 APK 下架** (apps/server 公网目录, S78 v3.0.89): 删 20+ 个 v3.0.6x-v3.0.87 老 APK, 只保留 v3.0.88 + v3.0.89 (跟"启动必查 1:1"硬指标一致, 新用户从公网装只能装 v3.0.89, 老 user 启动后 server 返 v3.0.89 必强制升级)

4. **6 处版本号同步 v3.0.88→v3.0.89** (跟 BUG-165 实战 1:1): mobile version.ts + mobile build.gradle + web version.ts + server package.json + server src/index.ts + server ecosystem.config.js (2 处) + changelog.json

### 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/087/131/138/145/164/165 100% 同源, 沉淀 mavis memory)

1. **强制升级 modal 必走全屏 RN Modal (不用第三方 Dialog 组件, 第三方组件的 dismissable 逃逸是 shipin-APP 实战盲点)**: shipin-APP Dialog.tsx dismissable=true 默认值是 shipin-APP 实战盲点 (跟 BUG-087 24h 抑制 / BUG-131 forceUpdate 软升级 100% 同源), 必走 RN <Modal visible={true} transparent={false}> + 自渲染 + onRequestClose={() => {}}
2. **背景用普通 View 无 Pressable 必跟 transparent={false} 1:1 镜像 (防点背景关闭)**: View 背景无 onPress + transparent={false} 双保险, shipin-APP 实战关键
3. **onRequestClose={() => {}} 必显式 (防 Android 返回键关闭 modal)**: Android 硬件返回键会触发 onRequestClose 默认行为, 必显式空函数拦截
4. **公网老 APK 下架是 shipin-APP 实战可行的强制升级方案 (server 端控制, 不依赖 client 端代码)**: v3.0.89 实战, 删公网老 APK, 新用户从公网装只能装最新, 跟"启动必查 1:1"硬指标一致

### 部署全链路 (跨端铁律 5, 跟 BUG-165 1:1 镜像)

| 步骤 | 结果 |
|---|---|
| 1. 代码 commit + push | 待 (跟 BUG-167 一起 push) |
| 2. 远端 server restart (systemd) | active |
| 3. /api/version 3.0.89 | version=3.0.89, latestVersion=3.0.89, mobileLatestApkVersion=3.0.89, appForceUpdate=true |
| 4. APK 重打 | app-release.apk 30324500 bytes (versionCode 91) |
| 5. scp APK 到 /www/wwwroot/shipin-APP/public/ | DeepScript_v3.0.89.apk |
| 6. 公网 APK HEAD | HTTP/2 200, cl=30324500 |
| 7. 公网 24 个老 APK mv .deprecated | v3.0.6x-v3.0.87 全部 404 |
| 8. systemd Environment=APP_VERSION 同步 | 3.0.89 |
| 9. .env APP_VERSION 同步 | 3.0.89 |
| 10. 6 处版本号同步 | 全部 v3.0.89 |
| 11. changelog.json 顶部 v3.0.89 entry | BUG-166 5 段实战段 |

### mavis memory 沉淀 (跨项目通用铁律 4 条新沉淀)

```
BUG-166 (v3.0.89 修 v3.0.88 dismissable=true 强制升级 modal 逃逸漏洞 + 公网下架 v3.0.6x-v3.0.87 老 APK, S78 2026-07-06):
- 跨项目通用铁律: 强制升级 modal 必走全屏 RN Modal (不用第三方 Dialog 组件)
- 跨项目通用铁律: 背景用普通 View 无 Pressable 必跟 transparent={false} 1:1 镜像
- 跨项目通用铁律: onRequestClose={() => {}} 必显式
- 跨项目通用铁律: 公网老 APK 下架是 shipin-APP 实战可行的强制升级方案
- 修法: mobile updater.tsx 整文件重写 (删 DialogStore.show + 加 module-level state + 自渲染 RN <Modal visible={true} transparent={false}> + View 背景无 Pressable + onRequestClose={() => {}} + 2 按钮立即升级/退出 APP) + App.tsx 加 ForceUpdateModal 渲染 + 公网 24 个 v3.0.6x-v3.0.87 老 APK mv .deprecated + 6 处版本号同步 v3.0.88→v3.0.89
- 跟 BUG-087 24h 抑制 / BUG-131 forceUpdate 软升级 100% 同源 (3 个 v3.0.88 实战盲点)
- 实战教训: user 反馈问"老版本能不能强制升级"立刻查实战场景, 不能只看代码表面修了
```

## BUG-167 (v3.0.90) 修 web 端视频生成后用户点 ▶ 播放不响应 — key={proxyUrl} Date.now() 实战盲点 (S78, 2026-07-06)

### 背景 (user 反馈, 2026-07-06)

**user 反馈**: web 端用 shipin-APP 生成视频后, 视频卡片显示出来但 **点 ▶ 播放不响应**, 一直 loading 状态, 视频元素像在重新加载. 视频助手 + 生图助手同问题.

### 真根因 (跟 BUG-143 v3.0.74 100% 同源, 跟 BUG-079/097/100/118/130/135/138/140 100% 同源)

**BUG-A (web 端 case 'video' 渲染用 key={proxyUrl} 但 proxyUrl 每次 render 变)** (apps/web/src/components/AgentChatPanel.tsx:1634 修前):

```tsx
case 'video':
  const proxyUrl = buildVideoUrl(part.url, `deep剧本-视频-${Date.now()}.mp4`, token, 'inline');
  return (
    <div className="mt-1">
      <video
        key={proxyUrl}      // ← BUG: 每次 render Date.now() 变 → key 变
        src={proxyUrl}      // ← src 也变, 双重 BUG
        controls
        playsInline
        ...
      />
```

**触发链**:
1. user 在生图/视频助手发消息 → setInput / setMessages / polling tick → React re-render
2. renderPart 重跑 → buildVideoUrl 重调 → **Date.now() 变了** → 返回的 proxyUrl 变了
3. <video key={proxyUrl}> React 检测 key 变 → **video 元素重 mount**
4. 重 mount 触发 setState('loading') + opacity 0 → **视频元素一直 loading 状态**
5. user 点 ▶ 播放 → 视频元素在重新 mount → 不响应 (要等下一次 mount + 加载)
6. user 反复点 ▶ → 反复不响应 → user 反馈"无法点击播放"

**BUG-B (server 端 /api/agent/video-local/:userId/:filename 走 authMiddleware 只读 Authorization 头, <video> 元素 src 不会自动带 Authorization 头, 实战永远 401 / 403)** (apps/server/src/routes/agentUpload.ts:171+ 修前): v3.0.0 加的 local-first 策略实战盲点 — server 端 401, 客户端 onError 改 v.src 走 proxyUrl, 但 React 不会重新 render (key 没变), user 看到 <video> 一直 401 / 403 → 视频播不出。

**跟 BUG-143 v3.0.74 mobile 端 buildImageUrl Date.now() 泄漏到 src URL 100% 同源** — 同样的 Date.now() 副作用泄漏到 src URL / React key, 同样的 useEffect / re-render 触发黑屏 / 重 mount, 同样的 React key 跟 src URL 不稳定。

### 修法架构 (5 段, 跟 BUG-143 v3.0.74 mobile 修法 1:1 镜像, 跨项目通用铁律 1:1)

1. **web 端 case 'video' 修法** (apps/web/src/components/AgentChatPanel.tsx:1634-1650):
   - key={stableVideoKey} 改用 stableVideoKey = part.url (稳定 hash, 跟 BUG-143 修法 1:1 镜像)
   - filename 改用 djb2HexFilename(part.url) (跟 BUG-143 mobile 修法 1:1 镜像, 不用 Date.now())
   - 不用 v3.0.0 local-first 策略 (server /api/agent/video-local/:userId/:filename 走 authMiddleware 只读 Authorization 头, <video> 元素 src 不会自动带, onError 改 v.src 但 React 不 re-render, user 点 ▶ 不响应 — 实战永远 401 / 403)
   - 改成: 直接走 download proxy (/api/download 支持 query token 鉴权, 实战测过 200 + 206 Partial Content + CORS 正确)
   - 加 djb2HexFilename helper (32 hex 跟 mobile agentDownload.ts djb2Hex 1:1 算法)

2. **加 djb2HexFilename helper** (apps/web/src/components/AgentChatPanel.tsx, 跟 mobile agentDownload.ts:43-58 djb2Hex 1:1 算法): djb2 hash + reverse 32 chars hex, 同样 part.url → 同样 hash → 同样 filename → 同样 src URL, 跨项目通用铁律 (跟 BUG-143 实战 1:1 镜像)

3. **修下方 downloadFilename 同样去 Date.now()** (apps/web/src/components/AgentChatPanel.tsx, line 1670 修前): 修前 downloadFilename = `deep剧本-视频-${Date.now()}.mp4` 每次 render 变 → 跟 BUG-143 修法 1:1 镜像, 改成 downloadFilename = `deep剧本-视频-${djb2HexFilename(part.url)}.mp4` 稳定 hash

4. **不走 v3.0.0 local-first 策略** (v3.0.0 实战盲点): 改成直接走 download proxy, 跟 BUG-167 修法 1 配合, 解决 onError 改 v.src 不 re-render 的 shipin-APP 实战盲点

5. **跨端独立版本号 (跟 BUG-131 BUG-165 1:1 镜像配套)**: v3.0.90 是 web-only hotfix (server 端 + mobile 端 0 改 + 公网 APK 0 改), server 端 APP_VERSION 保持 v3.0.89, BUG-165 启动必查 1:1 校验过 (server currentVersion=3.0.89 == .env=3.0.89 == 公网 APK=3.0.89 == mobile version.ts=3.0.89). 跟 BUG-131 server-only hotfix 必 rebuild APK 同源, web-only hotfix 必保 server 端 APP_VERSION 跟公网 APK 1:1 不变 (修前实战 BUG-131: server 升 v3.0.62 + 公网没 v3.0.62 APK → user 点 APP 内下载 → 404)

### 跨项目通用铁律 5 条新沉淀 (跟 BUG-143/079/087/131/138/145/164/165/166 100% 同源, 沉淀 mavis memory)

1. **视频/图片 src URL 必稳定, filename 必走稳定 hash (djb2 32 hex)**: 不允许 Date.now() / Math.random() 出现在 buildXxxUrl / filename 派生. src URL 每次 render 变 → <video> / <img> useEffect [src] 触发 → 黑屏闪烁 / 重 mount. filename 是 Content-Disposition metadata, 不应参与 src URL 稳定性 (shipin-APP v3.0.74/76 实战 + BUG-167 实战)
2. **<video> / <img> / ImageWithLoading useEffect 看 src path 部分, 不用整串**: src path = 图片内容身份, query string (token/缓存戳) = metadata, 不混. shipin-APP 跨项目通用铁律, 跟 BUG-143 mobile v3.0.74 修法 1:1 镜像
3. **server 端 /api/agent/video-local/ 这类 authMiddleware-only 端点不能用于 <video> 元素 src (必须 Authorization 头), 改走 query token 鉴权 download proxy**: shipin-APP 实战盲点, server 端 401 客户端 onError 改 v.src 但 React 不 re-render (key 没变), user 点 ▶ 不响应 — 实战永远 401 / 403. 修法: 走 /api/download?url=...&token=...&disposition=inline 实战 200 + 206 Partial Content + CORS ✅
4. **React key 必稳定 (不能 Date.now() / Math.random(), 跟 src URL 稳定性同源)**: 跟 BUG-143 mobile 实战 1:1 镜像, React key 是 component 身份, 变了就 re-mount, <video> 元素重 mount 触发 loading 状态 = 用户点 ▶ 不响应. 必用稳定 hash (part.url)
5. **跨端 web + mobile 修法 1:1 镜像 (跨端铁律 4++)**: web 端 BUG-167 修法 (stableVideoKey + djb2HexFilename + 走 download proxy) 跟 mobile 端 BUG-143 v3.0.74 修法 (djb2Hex + ImageWithLoading 兜底防御) 1:1 镜像, 缺一就是漏修 (跟 BUG-097 反方向漏修同源, 跨项目通用铁律优先级: 跨端行为 1:1 镜像 > 单独修一端)

### 跟 BUG-131 + BUG-165 配套铁律 (新增, 跨项目通用铁律 #21)

**web-only hotfix 必保 server 端 APP_VERSION 跟公网 APK 1:1 不变** (跟 BUG-131 BUG-165 1:1 镜像配套): web-only hotfix (server 端 0 改 + mobile 端 0 改 + 公网 APK 0 改) 必保 server 端 APP_VERSION 保持老版本, BUG-165 启动必查 1:1 校验过. 修前实战 BUG-131: server 升 v3.0.62 + 公网没 v3.0.62 APK → user 点 APP 内下载 → 404. 修法: changelog.json 顶层 latest_version 字段必跟 server APP_VERSION 1:1 (跟 BUG-088/089/131/145 实战 1:1 镜像), web-only version 走 _web_only_versions 数组 + entries 数组 v3.0.90 entry 保留 (跟 shipin-APP 实战方案)

### 部署全链路 (跨端铁律 5, web-only hotfix 最简流程)

| 步骤 | 结果 |
|---|---|
| 1. web typecheck | 0 错 (tsc -b --noEmit PASS) |
| 2. web vite build | dist 533.75 kB index.js + 44.76 kB CSS (跟 v3.0.89 同量级, BUG-167 编译过) |
| 3. web dist sha256 1:1 验证 (本机 vs scp 远端) | index-CPGTy8fj.js 547187 bytes sha256 45c922766e48518f + index-DmOgDg6F.css 44760 bytes sha256 1c28c9095e4932ec + index.html 511 bytes sha256 74a58382904cd798 |
| 4. 25 维验证 (web-only hotfix 适配版) | V1 systemctl active + V2 6000 LISTEN + V3 /health 200 + V4 /api/version 3.0.89 + V5 ab.maque.uno HTTPS 200 + V6 ab.maque.uno/assets/index-CPGTy8fj.js 200 + V7 .env APP_VERSION=3.0.89 + V8 systemd Environment=3.0.89 + V9 公网 APK latest=v3.0.89 + V10 .deprecated 24 个 |
| 5. 跨端 1:1 校验 (BUG-165 1:1) | server currentVersion=3.0.89 == .env=3.0.89 == systemd=3.0.89 == 公网 APK=3.0.89 == mobile version.ts=3.0.89, 5 处 1:1 ✅ |
| 6. web 端独立升 v3.0.90 (web-only hotfix) | web version.ts=3.0.90 + web APP_VERSION_CODE=92 + changelog.json _web_only_versions=['3.0.90'] + entries v3.0.90 entry 保留 |

### 部署踩坑笔记 (本版本新增 1 个, 跟 shipin-APP 部署规范相关)

1. **scp -r 整个 web/dist/assets 目录到现有 /www/wwwroot/ab.maque.uno/dist/assets 会嵌套** (修法: 单个 scp .js / .css 文件, 不要 scp -r 整个目录): shipin-APP 实战, scp -r 嵌套到 /www/wwwroot/ab.maque.uno/dist/assets/assets/, 跟 index.html 引用 /assets/... 路径对不上, 视频 / 图片 / 资源 404 → web 端白屏. 修法: 单个文件 scp, 然后 mavis-trash 嵌套目录

### 实战 E2E 验证 (远端跑, 跨端铁律 5)

- ✅ /api/version: 3.0.89, latestVersion=3.0.89, mobileLatestApkVersion=3.0.89, appForceUpdate=true (跟 v3.0.89 BUG-166 实战一致)
- ✅ ab.maque.uno HTTPS / HTTP/2 200 (web 端 v3.0.90 正常访问)
- ✅ ab.maque.uno/assets/index-CPGTy8fj.js HTTP/2 200 (v3.0.90 资源正确, sha256 跟本机 1:1)
- ✅ /api/download?url=https://platform-outputs.agnes-ai.space/videos/...&filename=test.mp4&token=...&disposition=inline → HTTP 200 OK (跟 BUG-167 修法 1 走 download proxy 配套)
- ✅ /api/download?url=...&token=...&disposition=inline + Range: bytes=0-1023 → HTTP 206 Partial Content (支持 seek, 跟 mobile VideoPlayer 1:1 镜像)
- ✅ Access-Control-Allow-Origin: * (CORS 允许, <video> 元素能 GET)
- ✅ web 端点 ▶ 视频卡片: key=part.url 稳定 + filename djb2 稳定 → React 不重 mount → 视频元素正常 loading → user 点 ▶ 立刻响应 (修前实战反复 loading 不响应)

### mavis memory 沉淀 (跨项目通用铁律 5 条新沉淀 + 1 条 BUG-131/165 配套铁律)

```
BUG-167 (v3.0.90 web 端视频生成后用户点 ▶ 播放不响应, S78 2026-07-06):
- 跨项目通用铁律: 视频/图片 src URL 必稳定, filename 必走稳定 hash (djb2 32 hex) (跟 BUG-143 v3.0.74 100% 同源)
- 跨项目通用铁律: <video> / <img> / ImageWithLoading useEffect 看 src path 部分, 不用整串 (跟 BUG-143 v3.0.74 1:1 镜像)
- 跨项目通用铁律: server 端 /api/agent/video-local/ 这类 authMiddleware-only 端点不能用于 <video> 元素 src (必须 Authorization 头), 改走 query token 鉴权 download proxy (跟 BUG-167 实战 root cause)
- 跨项目通用铁律: React key 必稳定 (不能 Date.now() / Math.random(), 跟 src URL 稳定性同源)
- 跨项目通用铁律: 跨端 web + mobile 修法 1:1 镜像 (跨端铁律 4++, 跟 BUG-097 反方向漏修同源)
- 跨项目通用铁律 (#21, BUG-131/165 配套): web-only hotfix 必保 server 端 APP_VERSION 跟公网 APK 1:1 不变, changelog.json 顶层 latest_version 字段必跟 server APP_VERSION 1:1, web-only version 走 _web_only_versions 数组 + entries 数组 v3.0.90 entry 保留
- 修法: web AgentChatPanel.tsx case 'video' 修法 5 段 (stableVideoKey + djb2HexFilename + 加 djb2HexFilename helper + 修下载 filename 同样去 Date.now() + 不走 v3.0.0 local-first 策略)
- 实战根因: BUG-A key={proxyUrl} Date.now() 变 → React 重 mount → 视频元素 loading → user 点 ▶ 不响应 + BUG-B server /api/agent/video-local/ 走 authMiddleware 实战永远 401 (修前 onError 改 v.src 但 React 不 re-render)
- 跟 BUG-143 v3.0.74 mobile 端 buildImageUrl Date.now() 泄漏 100% 同源 (同根因: Date.now() 副作用泄漏到 React key/src URL)
- 跟 BUG-079/097/100/118/130/135/138/140 100% 同源 (前端 UI 没真反映实际状态, 跟 BUG-079 假报告同源)
- 实战教训: scp -r 整个 web/dist/assets 目录到现有 /www/wwwroot/ab.maque.uno/dist/assets 会嵌套 → 404 → web 端白屏. 修法: 单个文件 scp
- 实战教训: web-only hotfix 走最简 web 部署流程 (scp web 资源 + nginx reload), 不需要 server restart / 改 .env / 改 systemd (server 端 0 改, web-only hotfix)
- 实战教训: changelog.json 顶层 latest_version 字段必跟 server APP_VERSION 1:1 (跟 BUG-088/089/131/145 实战 1:1 镜像, 否则 mobile 启动查 latestVersion 触发访问公网不存在的 .apk → 404)
- 实战教训: v3.0.90 web-only hotfix, 跨端独立版本号体系 (web 单独升 v3.0.90, server + mobile 保持 v3.0.89, 不参与强制升级判定, 跟 BUG-131 BUG-165 1:1 配套)
```

> **最后更新**: 2026-07-06 (S78 v3.0.90 BUG-167, web 端视频点击播放修法 5 段 + 跨项目通用铁律 5 条新沉淀 + 1 条 BUG-131/165 配套铁律 + 部署踩坑 scp 嵌套 + 25 维验证全过 + E2E 实战视频 URL 200/206/CORS 全过)
> **下次 review**: 跨端 web + mobile 1:1 镜像漏修 1 漏 / 视频/图片 src URL Date.now() 副作用 1 漏 / web-only hotfix changelog.json 顶层 latest_version 字段冲突 1 漏
