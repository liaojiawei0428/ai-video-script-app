// APP 閻楀牊婀扮紒鐔剁缁狅紕鎮?
// 閸欐垵绔烽弬鎵閺堫剚妞傞崣顏堟付娣囶喗鏁煎銈咁槱 (鐠恒劎顏柧浣哥伐 3: 8 婢跺嫮澧楅張顒€褰块崥灞绢劄, 閿?VERSION_MANAGEMENT.md 鎼?5)
//
// 娣囶喗鏁煎ù浣衡柤:
//   1. 閺€瑙勬拱閺傚洣娆?APP_VERSION = 'X.Y.Z'
//   2. 閸氬本顒?8 閿? mobile build.gradle (versionName + versionCode), server package.json,
//      server src/index.ts fallback, server ecosystem.config.js (env + env_production 2 閿?,
//      web src/config/version.ts (APP_VERSION + APP_VERSION_CODE),
//      apps/server/changelog.json (閸旂姵鏌婇悧鍫熸拱 entry),
//      apps/server/.env + /etc/systemd/system/shipin-app.service (deploy.sh 閼奉亜濮╅崥灞绢劄)
//   3. 閿?node tools/verify-version-8-points.js 閺堫剙婀?+ 鏉╂粎鈻奸懛顏咁梾
//   4. commit message 韫囧懎鐢悧鍫熸拱閿?(闁句礁绶?6): `vX.Y.Z: <閺€鐟板З> (BUG-NNN)`
//   5. 闁劎璁?+ 12 缂佹挳鐛欓敓?(BAOTA_NODE_PROJECT_DEPLOY.md 鎼?2.3)

export const APP_VERSION = '3.0.64';

// v3.0.62 (BUG-131 S72 batch 31): 閸忣剛缍?APK 鐠侯垰绶?server-side 閻喎鐤勭€涙ê婀Λ鈧弻?
//   - 娣囶喖澧? /api/version downloadUrl 閹?`DeepScript_v${process.env.APP_VERSION}.apk`, server-only hotfix (3.0.61) 鐠虹喎鍙曠純?APK (3.0.60) 娑撳秳绔撮懛?閳?閸嬪洣绗呮潪?404 HTML 闁挎瑨顕ゆい?閳?Status Code 16
//   - 娣囶喗纭? 閺堝秴濮熺粩顖氭儙閸斻劍妞傞幍?/www/wwwroot/shipin-APP/public/DeepScript_v*.apk 閸?max version 瑜?mobileLatestApkVersion, /api/version 閻劏绻栨稉?version 閹?downloadUrl (鐠恒劑銆嶉惄顕€鈧氨鏁ら柧浣哥伐: server bump 韫?rebuild APK)
//   - 缁夎濮╃粩顖炴Щ瀵扳€崇湴: updater.tsx catch 閸ф鐦戦崚?Status Code 16/404 閳?showConfirm 閼奉亜濮?fallback 濞村繗顫嶉崳銊ょ瑓鏉?(鐠?BUG-117 閸氬本绨? 娴滃本顐奸梼鎻掑敖)
//   - 闁板秴顨? server 閺傛澘濮?services/apkVersion.ts + mobile updater catch 閸ф妲诲鈥崇湴 + 8 婢跺嫮澧楅張顒€褰块崥灞绢劄 3.0.61 閳?3.0.62 + 閸忣剛缍?HEAD 妤犲矁鐦?(鐠?BUG-117 濞屽绌?

// v3.0.61 (BUG-130 hotfix 2): server 缁?imageAgentService.ts plan.data 鐞?refImageCount 鐎涙顔?(鐠?videoAgentService 1:1, BUG-128 閺傚洦銆傜捄鐔跺敩閻椒绗夋稉鈧懛?閸嬪洣鎱?
//   - 娣囶喖澧? plan.refImageUrls=[1娑撶寙RL] 娴?plan.refImageCount=0, 鐠恒劎顏?1:1 闂€婊冨剼娑撳秳绔撮懛? 鐠?BUG-079 閸嬪洦濮ら崨濠傛倱濠?
//   - 娣囶喗纭? refUrlsAccum.length 閼奉亜濮╃粻? plan.data 鐠?DB plan 2 婢跺嫬鎮撳銉啎
//   - 闁板秴顨? 8 婢跺嫮澧楅張顒€褰块崥灞绢劄 3.0.60 閳?3.0.61, server 缁旑垯鍞惍浣规暭閸?(mobile/web 閺冪姳绗熼崝鈥冲綁閸? APK 娑撳秶鏁ら柌宥嗗ⅵ)

// v3.0.60 (BUG-130 hotfix): mobile 缁旑垱鏁奸悽?react-native-image-picker 閺囧じ鍞?document-picker
//   - 娣囶喖澧? document-picker v9.3.1 Android 缁旑垳鏁?Intent.ACTION_GET_CONTENT, Android 9 濡剝瀚欓崳?濞?Google Play Services) 瀵湱鈹?dialog
//   - 娣囶喗纭? 鐟?react-native-image-picker v7.2.3 + 閺€?pickAndUploadImages 鐠嬪啰鏁?launchImageLibrary (鐠ф壆閮寸紒?photo picker)
//   - 瑜板崬鎼? mobile 缁旑垯鍞惍?0 娑撴艾濮熼柅鏄忕帆閸欐ê瀵? 娴?picker 鎼存挻娴涢幑? 鐞涘奔璐熺€瑰苯鍙忔稉鈧懛?
//   - 闁板秴顨? 8 婢跺嫮澧楅張顒€褰块崥灞绢劄 3.0.59 閳?3.0.60 (鐠恒劎顏柧浣哥伐 3)

// v3.0.59 (BUG-130): mobile 缁旑垳鏁撻崶?鐟欏棝顣堕崝鈺傚鐞?娑撳﹣绱堕崣鍌濃偓鍐ㄦ禈"閸旂喕鍏?
//   - 鐠?web 缁?AgentChatPanel 1:1 闂€婊冨剼, 鐞?S72 batch 7 web閳姦obile 閸氬本顒炲蹇庢叏
//   - 閺傛澘濮?uploadAgentReferenceApi (XHR + FormData 鐠?web uploadAgentReferenceApi 1:1)
//   - 閺傛澘濮?pickAndUploadImages (react-native-document-picker.types.images, 娑撳秶鏁ょ憗鍛煀閸栧懍绗夐悽銊︽煀閺夊啴妾?
//   - pendingRefs state (4 瀵姳绗傞梽? 缂傗晝鏆愰崶?+ 娑撳﹣绱舵稉?spinner + 閸掔娀娅庨幐澶愭尦, 鐠?web 1:1)
//   - send() 閹?image role='reference' parts 鐠?text 娑撯偓鐠у嘲褰傜紒?server chat API
//   - ImageAgentScreen + VideoAgentScreen 1:1 闂€婊冨剼 (鐠恒劎顏柧浣哥伐 4++)
//   - 8 婢跺嫮澧楅張顒€褰块崥灞绢劄 3.0.58 閳?3.0.59, rebuild APK, 缁旑垰鍩岀粩顖氱杽濞?

// v3.0.41 (S72 batch 7 BUG-105 mobile sync): 缁夌粯顦?web characterUtils.ts 閿?mobile utils, 3 閿?screen 閺€鍦暏缂佺喍绔?utils, 閸忕厧顔?server v3.0.40 Markdown 閼奉亞鏁遍弬鍥ㄦ拱閺嶇厧绱?
//   - 娣囶喗纭? 閿?web apps/web/src/lib/characterUtils.ts v2.5.34 1:1 鐎靛綊缍?(閿?getRoleLabel/getRoleColor 閿?mobile 缁旑垳鏁?theme/character.ts)
//   - 娣囶喗纭? 4 閿?description 閺嶇厧绱￠崗鐓庮啇 (閼奉亞鏁遍弬鍥ㄦ拱鐎涙顑侀敓?/ 11 鐎涙顔?JSON 鐎电钖?/ JSON 鐎涙顑侀敓?/ 閸欏苯鐪?JSON 鐎涙顑侀敓?
//   - 娣囶喗纭? summaryOf 閿?markdown 閺嶅洭顣?閸掓銆冮敓? 閸欐牜顑囨稉鈧▓鍨劀閿?
//   - BUG-097 mobile 濠曞繋鎱?web 閸氬本绨崢鍡楀蕉濞嗙姾澶?(mobile v3.0.29 UI redesign 閺冭埖绱?web 缁旑垶鍘ら敓?
//   - 闁板秴顨? 6 婢跺嫮澧楅張顒€褰块崥灞绢劄 3.0.39 閿?3.0.41, rebuild APK, 缁旑垰鍩岄敓?mobile 鐎圭偞绁?

// v3.0.36 (S72 batch 6): BUG-088 + BUG-089 娣囶喗纭?
//   - BUG-088: Dialog 缂佸嫪娆㈤弨鍦暏 RN Modal 閸栧懓顥?(閸樺棗褰舵笟褎鐖柆顔藉皡 + 閸掔娀娅庢稉宥囨晸閿?
//   - BUG-089: 閿?loadHistory 閿?refreshHistory (閻㈢喐鍨氶幋鎰娑撳秶鐝涢崚缁樻▔閿?race condition)
//   - polling 鐎瑰本鍨?alert 閸忔娊妫撮崥搴″繁閿?scrollToEnd 200ms
// v3.0.35 (S72 batch 5 BUG-087): APP 閿?閺冪娀妾洪崣鎴犲箛閺傛壆澧楅敓?娣囶喗纭?
//   - 閿?version.ts 婢舵俺顢?(娑斿澧?1 閿?comment + exports on same line, tsc 閿?'is not a module',
//     鏉╂劘顢戦敓?APP_VERSION = undefined, fetch 閿??version=undefined, server compareVersions 閿?1
//     閿?needUpdate=true 閿?濮ｅ繑顐奸崘宄版儙閸斻劑鍏橀敓?
//   - 閺傛澘顤?db/updateMemory.ts (RNFS 24h 閹舵垵鍩? 閼颁胶鏁ら幋宄板絿濞戝牐绻冮惃鍕閺堫兛绗夐崘宥呰剨)
//   - showUpdateDialog 閿?forceUpdate 娴兼ê鍘涢敓?+ 閸欐牗绉烽幐澶愭尦閿?memory + 娑撳娴囬幐澶愭尦娑撳秴鍟?
export const APP_NAME = 'Deep閸撗勬拱';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;


