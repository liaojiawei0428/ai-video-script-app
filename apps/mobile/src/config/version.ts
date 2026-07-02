// APP 闁绘鐗婂﹢鎵磼閻斿墎顏辩紒鐙呯磿閹?
// 闁告瑦鍨电粩鐑藉棘閹殿喖顣奸柡鍫墯濡炲倿宕ｉ鍫熶粯濞ｅ浂鍠楅弫鐓庮潰閵堝拋妲?(閻犳亽鍔庨顒勬煣娴ｅ摜浼?3: 8 濠㈣泛瀚晶妤呭嫉椤掆偓瑜板潡宕ョ仦缁㈠妱, 闁?VERSION_MANAGEMENT.md 閹?5)
//
// 濞ｅ浂鍠楅弫鐓幟规担琛℃煠:
//   1. 闁衡偓鐟欏嫭鎷遍柡鍌氭矗濞?APP_VERSION = 'X.Y.Z'
//   2. 闁告艾鏈?8 闁? mobile build.gradle (versionName + versionCode), server package.json,
//      server src/index.ts fallback, server ecosystem.config.js (env + env_production 2 闁?,
//      web src/config/version.ts (APP_VERSION + APP_VERSION_CODE),
//      apps/server/changelog.json (闁告梻濮甸弻濠囨偋閸喐鎷?entry),
//      apps/server/.env + /etc/systemd/system/shipin-app.service (deploy.sh 闁煎浜滄慨鈺呭触鐏炵虎鍔?
//   3. 闁?node tools/verify-version-8-points.js 闁哄牜鍓欏﹢?+ 閺夆晜绮庨埢濂告嚊椤忓拋姊?
//   4. commit message 闊洤鎳庨悽顐︽偋閸喐鎷遍柨?(闂佸彞绀佺欢?6): `vX.Y.Z: <闁衡偓閻熸澘袟> (BUG-NNN)`
//   5. 闂侇喓鍔庣拋?+ 12 缂備焦鎸抽悰娆撴晸?(BAOTA_NODE_PROJECT_DEPLOY.md 閹?2.3)

export const APP_VERSION = '3.0.81';

// v3.0.62 (BUG-131 S72 batch 31): 闁稿浚鍓涚紞?APK 閻犱警鍨扮欢?server-side 闁活亞鍠庨悿鍕偓娑櫭﹢顏勎涢埀顒勫蓟?
//   - 濞ｅ浂鍠栨晶? /api/version downloadUrl 闁?`DeepScript_v${process.env.APP_VERSION}.apk`, server-only hotfix (3.0.61) 閻犺櫣鍠庨崣鏇犵磾?APK (3.0.60) 濞戞挸绉崇粩鎾嚊?闁?闁稿娲ｇ粭鍛姜?404 HTML 闂佹寧鐟ㄩ銈嗐亜?闁?Status Code 16
//   - 濞ｅ浂鍠楃涵? 闁哄牆绉存慨鐔虹博椤栨碍鍎欓柛鏂诲妽濡炲倿骞?/www/wwwroot/shipin-APP/public/DeepScript_v*.apk 闁?max version 鐟?mobileLatestApkVersion, /api/version 闁活潿鍔忕换鏍ㄧ▔?version 闁?downloadUrl (閻犳亽鍔戦妴宥夋儎椤曗偓閳ь剚姘ㄩ弫銈夋煣娴ｅ摜浼? server bump 闊?rebuild APK)
//   - 缂佸顕ф慨鈺冪博椤栫偞些鐎垫壋鈧磭婀? updater.tsx catch 闁秆勵殙閻︽垿宕?Status Code 16/404 闁?showConfirm 闁煎浜滄慨?fallback 婵炴潙绻楅～宥夊闯閵娿倗鐟撻弶?(閻?BUG-117 闁告艾鏈花? 濞存粌鏈濂告⒓閹绘帒鏁?
//   - 闂佹澘绉撮〃? server 闁哄倹婢樻慨?services/apkVersion.ts + mobile updater catch 闁秆勵殜濡茶顕ラ垾宕囨勾 + 8 濠㈣泛瀚晶妤呭嫉椤掆偓瑜板潡宕ョ仦缁㈠妱 3.0.61 闁?3.0.62 + 闁稿浚鍓涚紞?HEAD 濡ょ姴鐭侀惁?(閻?BUG-117 婵炲苯顦扮粚?

// v3.0.61 (BUG-130 hotfix 2): server 缂?imageAgentService.ts plan.data 閻?refImageCount 閻庢稒顨嗛?(閻?videoAgentService 1:1, BUG-128 闁哄倸娲﹂妴鍌滄崉閻旇泛鏁╅柣顔绘缁楀绋夐埀顒勬嚊?闁稿娲ｉ幈?
//   - 濞ｅ浂鍠栨晶? plan.refImageUrls=[1濞戞挾瀵橰L] 濞?plan.refImageCount=0, 閻犳亽鍔庨?1:1 闂傗偓濠婂啫鍓煎☉鎾崇С缁旀挳鎳? 閻?BUG-079 闁稿娲︽慨銈夊川婵犲倹鍊辨繝?
//   - 濞ｅ浂鍠楃涵? refUrlsAccum.length 闁煎浜滄慨鈺冪不? plan.data 閻?DB plan 2 濠㈣泛瀚幃鎾愁潰閵夘煈鍟?
//   - 闂佹澘绉撮〃? 8 濠㈣泛瀚晶妤呭嫉椤掆偓瑜板潡宕ョ仦缁㈠妱 3.0.60 闁?3.0.61, server 缂佹棏鍨崬顒勬儘娴ｈ鏆柛?(mobile/web 闁哄啰濮崇粭鐔煎礉閳ュ啿缍侀柛? APK 濞戞挸绉堕弫銈夋煂瀹ュ棗鈪?

// v3.0.60 (BUG-130 hotfix): mobile 缂佹棏鍨遍弫濂告偨?react-native-image-picker 闁哄洤銇橀崬?document-picker
//   - 濞ｅ浂鍠栨晶? document-picker v9.3.1 Android 缂佹棏鍨抽弫?Intent.ACTION_GET_CONTENT, Android 9 婵☆垪鍓濈€氭瑩宕?婵?Google Play Services) 鐎殿喖婀遍埞?dialog
//   - 濞ｅ浂鍠楃涵? 閻?react-native-image-picker v7.2.3 + 闁衡偓?pickAndUploadImages 閻犲鍟伴弫?launchImageLibrary (閻犙勫闁绱?photo picker)
//   - 鐟滄澘宕幖? mobile 缂佹棏鍨崬顒勬儘?0 濞戞挻鑹炬慨鐔兼焻閺勫繒甯嗛柛娆惷€? 濞?picker 閹煎瓨鎸诲ù娑㈠箲? 閻炴稑濂旂拹鐔衡偓鐟拌嫰閸欏繑绋夐埀顒勬嚊?
//   - 闂佹澘绉撮〃? 8 濠㈣泛瀚晶妤呭嫉椤掆偓瑜板潡宕ョ仦缁㈠妱 3.0.59 闁?3.0.60 (閻犳亽鍔庨顒勬煣娴ｅ摜浼?3)

// v3.0.59 (BUG-130): mobile 缂佹棏鍨抽弫鎾诲炊?閻熸瑥妫濋。鍫曞礉閳哄倸顤侀悶?濞戞挸锕ｇ槐鍫曞矗閸屾績鍋撻崘銊︾"闁告梻鍠曢崗?
//   - 閻?web 缂?AgentChatPanel 1:1 闂傗偓濠婂啫鍓? 閻?S72 batch 7 web闁愁偅濮bile 闁告艾鏈鐐差煶韫囧孩鍙?
//   - 闁哄倹婢樻慨?uploadAgentReferenceApi (XHR + FormData 閻?web uploadAgentReferenceApi 1:1)
//   - 闁哄倹婢樻慨?pickAndUploadImages (react-native-document-picker.types.images, 濞戞挸绉堕弫銈囨啑閸涱喗鐓€闁告牕鎳嶇粭澶愭偨閵婏附鐓€闁哄鍟村?
//   - pendingRefs state (4 鐎殿喚濮崇粭鍌炴⒔? 缂傚倵鏅濋弳鎰板炊?+ 濞戞挸锕ｇ槐鑸电▔?spinner + 闁告帞濞€濞呭酣骞愭径鎰唉, 閻?web 1:1)
//   - send() 闁?image role='reference' parts 閻?text 濞戞挴鍋撻悹褍鍢茶ぐ鍌滅磼?server chat API
//   - ImageAgentScreen + VideoAgentScreen 1:1 闂傗偓濠婂啫鍓?(閻犳亽鍔庨顒勬煣娴ｅ摜浼?4++)
//   - 8 濠㈣泛瀚晶妤呭嫉椤掆偓瑜板潡宕ョ仦缁㈠妱 3.0.58 闁?3.0.59, rebuild APK, 缂佹棏鍨伴崺宀€绮╅姘辨澖婵?

// v3.0.41 (S72 batch 7 BUG-105 mobile sync): 缂佸绮ˇ?web characterUtils.ts 闁?mobile utils, 3 闁?screen 闁衡偓閸︻厽鏆忕紓浣哄枍缁?utils, 闁稿繒鍘ч?server v3.0.40 Markdown 闁煎浜為弫閬嶅棘閸ャ劍鎷遍柡宥囧帶缁?
//   - 濞ｅ浂鍠楃涵? 闁?web apps/web/src/lib/characterUtils.ts v2.5.34 1:1 閻庨潧缍婄紞?(闁?getRoleLabel/getRoleColor 闁?mobile 缂佹棏鍨抽弫?theme/character.ts)
//   - 濞ｅ浂鍠楃涵? 4 闁?description 闁哄秶鍘х槐锟犲礂閻撳寒鍟?(闁煎浜為弫閬嶅棘閸ャ劍鎷遍悗娑欘殘椤戜線鏁?/ 11 閻庢稒顨嗛?JSON 閻庣數顢婇挅?/ JSON 閻庢稒顨堥渚€鏁?/ 闁告瑥鑻惇?JSON 閻庢稒顨堥渚€鏁?
//   - 濞ｅ浂鍠楃涵? summaryOf 闁?markdown 闁哄秴娲。?闁告帗顨夐妴鍐晸? 闁告瑦鐗滈鍥ㄧ▔閳ь剙鈻撻崹顐妧闁?
//   - BUG-097 mobile 婵犳洖绻嬮幈?web 闁告艾鏈花顕€宕㈤崱妤€钑夋繛鍡欏Ь婢?(mobile v3.0.29 UI redesign 闁哄啳鍩栫槐?web 缂佹棏鍨堕崢銈夋晸?
//   - 闂佹澘绉撮〃? 6 濠㈣泛瀚晶妤呭嫉椤掆偓瑜板潡宕ョ仦缁㈠妱 3.0.39 闁?3.0.41, rebuild APK, 缂佹棏鍨伴崺宀勬晸?mobile 閻庡湱鍋炵粊?

// v3.0.36 (S72 batch 6): BUG-088 + BUG-089 濞ｅ浂鍠楃涵?
//   - BUG-088: Dialog 缂備礁瀚▎銏ゅ绩閸︻厽鏆?RN Modal 闁告牕鎳撻ˉ?(闁告ê妫楄ぐ鑸电瑹瑜庨悥顕€鏌嗛钘夌殹 + 闁告帞濞€濞呭孩绋夊鍥ㄦ櫢闁?
//   - BUG-089: 闁?loadHistory 闁?refreshHistory (闁汇垻鍠愰崹姘跺箣閹邦剙顫犲☉鎾崇Ф閻濇盯宕氱紒妯烩枖闁?race condition)
//   - polling 閻庣懓鏈崹?alert 闁稿繑濞婂Λ鎾触鎼粹€崇箒闁?scrollToEnd 200ms
// v3.0.35 (S72 batch 5 BUG-087): APP 闁?闁哄啰濞€濡炬椽宕ｉ幋鐘茬疀闁哄倹澹嗘晶妤呮晸?濞ｅ浂鍠楃涵?
//   - 闁?version.ts 濠㈣埖淇洪、?(濞戞柨顑呮晶?1 闁?comment + exports on same line, tsc 闁?'is not a module',
//     閺夆晜鍔橀、鎴︽晸?APP_VERSION = undefined, fetch 闁??version=undefined, server compareVersions 闁?1
//     闁?needUpdate=true 闁?婵絽绻戦濂稿礃瀹勭増鍎欓柛鏂诲姂閸忔﹢鏁?
//   - 闁哄倹婢橀·?db/updateMemory.ts (RNFS 24h 闁硅埖鍨甸崺? 闁奸鑳堕弫銈夊箣瀹勬澘绲挎繛鎴濈墣缁诲啴鎯冮崟顓烆暭闁哄牜鍏涚粭澶愬礃瀹ュ懓鍓?
//   - showUpdateDialog 闁?forceUpdate 濞村吋锚閸樻盯鏁?+ 闁告瑦鐗楃粔鐑藉箰婢舵劖灏﹂柨?memory + 濞戞挸顑堝ù鍥箰婢舵劖灏﹀☉鎾崇Т閸?
export const APP_NAME = 'Deep闁告挆鍕嫳';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;



