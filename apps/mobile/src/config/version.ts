// APP 鐗堟湰缁熶竴绠＄悊
// 鍙戝竷鏂扮増鏈椂鍙渶淇敼姝ゅ (璺ㄧ閾佸緥 3: 8 澶勭増鏈彿鍚屾, 锟?VERSION_MANAGEMENT.md 搂 5)
//
// 淇敼娴佺▼:
//   1. 鏀规湰鏂囦欢 APP_VERSION = 'X.Y.Z'
//   2. 鍚屾 8 锟? mobile build.gradle (versionName + versionCode), server package.json,
//      server src/index.ts fallback, server ecosystem.config.js (env + env_production 2 锟?,
//      web src/config/version.ts (APP_VERSION + APP_VERSION_CODE),
//      apps/server/changelog.json (鍔犳柊鐗堟湰 entry),
//      apps/server/.env + /etc/systemd/system/shipin-app.service (deploy.sh 鑷姩鍚屾)
//   3. 锟?node tools/verify-version-8-points.js 鏈湴 + 杩滅▼鑷
//   4. commit message 蹇呭甫鐗堟湰锟?(閾佸緥 6): `vX.Y.Z: <鏀瑰姩> (BUG-NNN)`
//   5. 閮ㄧ讲 + 12 缁撮獙锟?(BAOTA_NODE_PROJECT_DEPLOY.md 搂 2.3)

export const APP_VERSION = '3.0.63';

// v3.0.62 (BUG-131 S72 batch 31): 鍏綉 APK 璺緞 server-side 鐪熷疄瀛樺湪妫€鏌?
//   - 淇墠: /api/version downloadUrl 鎷?`DeepScript_v${process.env.APP_VERSION}.apk`, server-only hotfix (3.0.61) 璺熷叕缃?APK (3.0.60) 涓嶄竴鑷?鈫?鍋囦笅杞?404 HTML 閿欒椤?鈫?Status Code 16
//   - 淇硶: 鏈嶅姟绔惎鍔ㄦ椂鎵?/www/wwwroot/shipin-APP/public/DeepScript_v*.apk 鍙?max version 褰?mobileLatestApkVersion, /api/version 鐢ㄨ繖涓?version 鎷?downloadUrl (璺ㄩ」鐩€氱敤閾佸緥: server bump 蹇?rebuild APK)
//   - 绉诲姩绔槻寰″眰: updater.tsx catch 鍧楄瘑鍒?Status Code 16/404 鈫?showConfirm 鑷姩 fallback 娴忚鍣ㄤ笅杞?(璺?BUG-117 鍚屾簮, 浜屾闃插尽)
//   - 閰嶅: server 鏂板姞 services/apkVersion.ts + mobile updater catch 鍧楅槻寰″眰 + 8 澶勭増鏈彿鍚屾 3.0.61 鈫?3.0.62 + 鍏綉 HEAD 楠岃瘉 (璺?BUG-117 娌夋穩)

// v3.0.61 (BUG-130 hotfix 2): server 绔?imageAgentService.ts plan.data 琛?refImageCount 瀛楁 (璺?videoAgentService 1:1, BUG-128 鏂囨。璺熶唬鐮佷笉涓€鑷?鍋囦慨)
//   - 淇墠: plan.refImageUrls=[1涓猆RL] 浣?plan.refImageCount=0, 璺ㄧ 1:1 闀滃儚涓嶄竴鑷? 璺?BUG-079 鍋囨姤鍛婂悓婧?
//   - 淇硶: refUrlsAccum.length 鑷姩绠? plan.data 璺?DB plan 2 澶勫悓姝ヨ
//   - 閰嶅: 8 澶勭増鏈彿鍚屾 3.0.60 鈫?3.0.61, server 绔唬鐮佹敼鍔?(mobile/web 鏃犱笟鍔″彉鍖? APK 涓嶇敤閲嶆墦)

// v3.0.60 (BUG-130 hotfix): mobile 绔敼鐢?react-native-image-picker 鏇夸唬 document-picker
//   - 淇墠: document-picker v9.3.1 Android 绔敤 Intent.ACTION_GET_CONTENT, Android 9 妯℃嫙鍣?娌?Google Play Services) 寮圭┖ dialog
//   - 淇硶: 瑁?react-native-image-picker v7.2.3 + 鏀?pickAndUploadImages 璋冪敤 launchImageLibrary (璧扮郴缁?photo picker)
//   - 褰卞搷: mobile 绔唬鐮?0 涓氬姟閫昏緫鍙樺寲, 浠?picker 搴撴浛鎹? 琛屼负瀹屽叏涓€鑷?
//   - 閰嶅: 8 澶勭増鏈彿鍚屾 3.0.59 鈫?3.0.60 (璺ㄧ閾佸緥 3)

// v3.0.59 (BUG-130): mobile 绔敓鍥?瑙嗛鍔╂墜琛?涓婁紶鍙傝€冨浘"鍔熻兘
//   - 璺?web 绔?AgentChatPanel 1:1 闀滃儚, 琛?S72 batch 7 web鈫抦obile 鍚屾婕忎慨
//   - 鏂板姞 uploadAgentReferenceApi (XHR + FormData 璺?web uploadAgentReferenceApi 1:1)
//   - 鏂板姞 pickAndUploadImages (react-native-document-picker.types.images, 涓嶇敤瑁呮柊鍖呬笉鐢ㄦ柊鏉冮檺)
//   - pendingRefs state (4 寮犱笂闄? 缂╃暐鍥?+ 涓婁紶涓?spinner + 鍒犻櫎鎸夐挳, 璺?web 1:1)
//   - send() 鎶?image role='reference' parts 璺?text 涓€璧峰彂缁?server chat API
//   - ImageAgentScreen + VideoAgentScreen 1:1 闀滃儚 (璺ㄧ閾佸緥 4++)
//   - 8 澶勭増鏈彿鍚屾 3.0.58 鈫?3.0.59, rebuild APK, 绔埌绔疄娴?

// v3.0.41 (S72 batch 7 BUG-105 mobile sync): 绉绘 web characterUtils.ts 锟?mobile utils, 3 锟?screen 鏀圭敤缁熶竴 utils, 鍏煎 server v3.0.40 Markdown 鑷敱鏂囨湰鏍煎紡
//   - 淇硶: 锟?web apps/web/src/lib/characterUtils.ts v2.5.34 1:1 瀵归綈 (锟?getRoleLabel/getRoleColor 锟?mobile 绔敤 theme/character.ts)
//   - 淇硶: 4 锟?description 鏍煎紡鍏煎 (鑷敱鏂囨湰瀛楃锟?/ 11 瀛楁 JSON 瀵硅薄 / JSON 瀛楃锟?/ 鍙屽眰 JSON 瀛楃锟?
//   - 淇硶: summaryOf 锟?markdown 鏍囬/鍒楄〃锟? 鍙栫涓€娈垫锟?
//   - BUG-097 mobile 婕忎慨 web 鍚屾簮鍘嗗彶娆犺处 (mobile v3.0.29 UI redesign 鏃舵紡 web 绔厤锟?
//   - 閰嶅: 6 澶勭増鏈彿鍚屾 3.0.39 锟?3.0.41, rebuild APK, 绔埌锟?mobile 瀹炴祴

// v3.0.36 (S72 batch 6): BUG-088 + BUG-089 淇硶
//   - BUG-088: Dialog 缁勪欢鏀圭敤 RN Modal 鍖呰 (鍘嗗彶渚ф爮閬尅 + 鍒犻櫎涓嶇敓锟?
//   - BUG-089: 锟?loadHistory 锟?refreshHistory (鐢熸垚鎴愬姛涓嶇珛鍒绘樉锟?race condition)
//   - polling 瀹屾垚 alert 鍏抽棴鍚庡己锟?scrollToEnd 200ms
// v3.0.35 (S72 batch 5 BUG-087): APP 锟?鏃犻檺鍙戠幇鏂扮増锟?淇硶
//   - 锟?version.ts 澶氳 (涔嬪墠 1 锟?comment + exports on same line, tsc 锟?'is not a module',
//     杩愯锟?APP_VERSION = undefined, fetch 锟??version=undefined, server compareVersions 锟?1
//     锟?needUpdate=true 锟?姣忔鍐峰惎鍔ㄩ兘锟?
//   - 鏂板 db/updateMemory.ts (RNFS 24h 鎶戝埗, 鑰佺敤鎴峰彇娑堣繃鐨勭増鏈笉鍐嶅脊)
//   - showUpdateDialog 锟?forceUpdate 浼樺厛锟?+ 鍙栨秷鎸夐挳锟?memory + 涓嬭浇鎸夐挳涓嶅啓
export const APP_NAME = 'Deep鍓ф湰';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;

