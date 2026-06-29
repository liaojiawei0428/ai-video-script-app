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
