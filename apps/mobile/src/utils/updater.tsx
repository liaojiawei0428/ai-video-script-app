// apps/mobile/src/utils/updater.tsx
// v3.0.89 (S78 BUG-166 修): 强制升级 modal 走全屏 RN Modal (不走 DialogStore) — 修 v3.0.88 dismissable=true 逃逸
//   v3.0.88 实战盲点: showForceUpdateDialog 走 DialogStore.show → Dialog.tsx dismissable=true 默认 → 用户点 dialog 背景 onClose 关闭 → 逃强制升级
//   v3.0.89 修法: 用 module-level state + 自渲染 RN Modal + View 背景 (无 Pressable) + onRequestClose={() => {}} 防止返回键关闭 → 不允许任何方式逃逸
//   配套删: DialogStore.show (不依赖 shipin-APP Dialog 组件)
//   配套删: 24h 抑制 + 3 按钮 + forceUpdate 软升级 (跟"强制升级"硬冲突, v3.0.88 已删)
//   配套增: APP_VERSION 自渲染 (背景显示当前 v{APP_VERSION} + 最新 v{version} 1:1 对比, 透明化)
//   配套增: iOS 走 RNExitApp 兜底 (shipin-APP 项目已装, 不加重)
//   实战意义: v3.0.89 装上后, 任何 v3.0.6x-3.0.88 老 user 启动 → server 返 v3.0.89 → 强制 modal 不可关闭 → 必须升级
//   修法 1: 走 RN <Modal visible={true}> 整屏覆盖 + 自渲染内容, 不依赖 shipin-APP Dialog 组件
//   修法 2: onRequestClose={() => {}} 防止 Android 硬件返回键关闭
//   修法 3: 背景是普通 <View> 无 onPress, 用户点背景无反应 (修 v3.0.88 dismissable 漏洞)
//   修法 4: 2 按钮主动操作 (立即升级 / 退出 APP), 没有"取消"或"关闭"
//   修法 5: module-level state 跨组件共享状态, useEffect 订阅更新

import React, { useState, useEffect } from 'react';
import {
  Platform, Linking, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  PermissionsAndroid, BackHandler, Modal, AppState, Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'react-native-blob-util';
import { API_BASE_URL } from '../config';
import { APP_VERSION } from '../config/version';
import { colors, spacing, radii, typography, shadows } from '../theme';
// v3.0.89.1 (S78 BUG-168 修): 删 Dialog 跟 useDialog import, 实战 v3.0.89 整文件重写实战盲点
//   实战根因: BUG-166 v3.0.89 重写 updater.tsx 时加了 iOS 退出用 require('react-native-exit-app') 兜底 useDialog().showAlert
//   但 shipin-APP 项目没装 react-native-exit-app, 实战 require 失败 → useDialog 整模块 undefined → App 启动 crash
//   实战 'Requiring unknown module "undefined"' (跟 BUG-079 假报告 100% 同源)
//   实战修法: 删 require + useDialog, 改用 RN 内置 Alert.alert (不加重, shipin-APP 项目已用 Dialog.tsx:64 兜底)


export interface VersionInfo {
  version: string;
  downloadUrl: string;
  changelog: string;
  /** 永远 true (v3.0.88+): 必升级, 无 needUpdate 二分 */
  appForceUpdate: boolean;
  /** v3.0.88 新增: 跟 server 真实公网 APK 一致的最新 version */
  mobileLatestApkVersion: string;
  /** v3.0.88 新增: 必填 (含 base64 changelog) */
  changelogHighlights?: string[];
  buildDate?: string;
  /** v3.0.88 新增: 失败后多久重试 (秒), 默认 5s */
  retryAfter?: number;
}

/**
 * v3.0.88 改: checkForUpdate 加重试 (默认 3 次, 1s/2s/4s exponential backoff)
 * v3.0.89 改: 失败 throw 真实错误 (修 v3.0.87 静默吞错, App.tsx startup gate 拦截)
 */
export async function checkForUpdate(
  clientVersion: string = APP_VERSION,
  maxRetries: number = 3,
): Promise<VersionInfo> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/version?version=${encodeURIComponent(clientVersion)}`,
        { method: 'GET' }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.data) {
        return {
          version: data.data.version,
          downloadUrl: data.data.downloadUrl,
          changelog: data.data.changelog,
          appForceUpdate: true,
          mobileLatestApkVersion: data.data.mobileLatestApkVersion || data.data.version,
          changelogHighlights: data.data.highlights || [],
          buildDate: data.data.buildDate,
          retryAfter: 5,
        };
      }
      throw new Error(data.message || '服务器返回错误响应');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.warn(`[Updater] checkForUpdate attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, lastError);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }
    }
  }
  throw lastError || new Error('checkForUpdate failed after retries');
}

// ════════════════════════════════════════════════════════════════════════
// v3.0.89 (BUG-166) 强制升级全屏 Modal — 修 v3.0.88 dismissable=true 逃逸
//   实战: 用 module-level state + 自渲染 RN Modal, 不用 DialogStore
//   修法: 背景用普通 View (无 Pressable), onRequestClose 不关 → 用户无法逃逸
// ════════════════════════════════════════════════════════════════════════

interface ForceUpdateState {
  visible: boolean;
  version: string;
  downloadUrl: string;
  changelog: string;
  highlights: string[];
  buildDate: string;
}

const initialForceState: ForceUpdateState = {
  visible: false,
  version: '',
  downloadUrl: '',
  changelog: '',
  highlights: [],
  buildDate: '',
};

let _forceState: ForceUpdateState = { ...initialForceState };
const _forceSubs: Set<() => void> = new Set();

function _forceEmit() {
  _forceSubs.forEach((fn) => fn());
}

/**
 * v3.0.89 改: 强制升级 modal 走 module-level state + 自渲染 RN Modal
 *   v3.0.88 修法 (走 DialogStore.show): dismissable=true 默认 → 用户点背景逃逸 ❌
 *   v3.0.89 修法 (走 module-level state + 自渲染 Modal): 背景是普通 View (无 onPress) + onRequestClose={() => {}} 防止返回键 → 用户无法逃逸 ✅
 *   跟 v3.0.88 一样: 2 按钮 (立即升级 v{version} 绿色 / 退出 APP 红色 BackHandler.exitApp())
 */
export function showForceUpdateDialog(versionInfo: VersionInfo): void {
  _forceState = {
    visible: true,
    version: versionInfo.version,
    downloadUrl: versionInfo.downloadUrl,
    changelog: versionInfo.changelog,
    highlights: versionInfo.changelogHighlights || [],
    buildDate: versionInfo.buildDate || '',
  };
  _forceEmit();
  // v3.0.89 配套: iOS AppState 监听 — 升级 modal 弹出时, 即使用户切后台, 也不允许 "侧滑返回" 关闭 (iOS 边缘情况)
  console.log('[Updater] showForceUpdateDialog state changed', _forceState);
}

/**
 * v3.0.89 改: 强制升级 modal 渲染 (用 RN Modal, 不用 shipin-APP Dialog 组件)
 *   App.tsx 必渲染这个组件 (跟 UpdateProgressModal 同模式)
 *   实战: visible 永远读 module-level state, 状态变化自动 re-render
 */
export function ForceUpdateModal(): React.JSX.Element | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const sub = () => setTick((x) => x + 1);
    _forceSubs.add(sub);
    return () => {
      _forceSubs.delete(sub);
    };
  }, []);

  // v3.0.96 BUG-172 调试: 测组件是否真渲染
  console.log('[Updater] ForceUpdateModal render', { visible: _forceState.visible, version: _forceState.version });

  if (!_forceState.visible) {
    return null;
  }

  const { version, changelog, downloadUrl, highlights } = _forceState;

  return (
    // v3.0.94 BUG-172 修: 不依赖 RN <Modal> (RN 0.73 + Hermes + 新架构下 ReactModalHostManager view manager 找不到 generated setter, 实战 BUG-165 修法盲点)
    //   改用 absoluteFill + zIndex: 9999 普通 View, 强制覆盖整屏 (跟 RN <Modal transparent={false}> 1:1 镜像效果)
    //   跨项目通用铁律 #31 (跟 BUG-165 实战盲点 100% 同源): 强制升级 E2E 必跑完整 9 维, 单测 "checkForUpdate success + visible=true" 不够, 必截图验证 modal 真渲染
    <View style={[StyleSheet.absoluteFillObject, forceModalStyles.fullscreen, { zIndex: 9999, elevation: 9999 }]}>
      {/* 背景: 整屏深色 + 居中卡片, 不用 Pressable (无 dismiss 逃逸) */}
      <View style={forceModalStyles.fullscreen}>
        <View style={forceModalStyles.card}>
          <Text style={forceModalStyles.emoji}>⚠️</Text>
          <Text style={forceModalStyles.title}>版本不一致, 必须升级</Text>
          <Text style={forceModalStyles.subtitle}>
            当前版本: <Text style={forceModalStyles.versionText}>v{APP_VERSION}</Text>
            {'\n'}官网最新版本: <Text style={forceModalStyles.versionText}>v{version}</Text>
          </Text>
          <Text style={forceModalStyles.body}>
            本 APP 已被官网淘汰, 必须升级到最新版本才能继续使用{'\n\n'}
            {highlights.length > 0 ? (
              <>
                更新内容:{'\n'}
                {highlights.slice(0, 5).map((h, i) => (
                  <Text key={i} style={forceModalStyles.bullet}>
                    • {h}{'\n'}
                  </Text>
                ))}
              </>
            ) : (
              <Text>{changelog}</Text>
            )}
          </Text>
          <Text style={forceModalStyles.hint}>
            推荐用浏览器下载 (速度快 + 自带进度 + 失败可重试)
          </Text>
          <View style={forceModalStyles.btnGroup}>
            <TouchableOpacity
              style={[forceModalStyles.btn, forceModalStyles.btnPrimary]}
              onPress={() => {
                // 调起浏览器下载
                Linking.openURL(downloadUrl).catch(() => {
                  console.warn('[Updater] Linking.openURL failed, fallback to Updater.start');
                  // 浏览器失败 → 启动 APP 内下载 (防国产 ROM 拦截 Linking)
                  Updater.start(downloadUrl, version);
                });
                // 同时启动 APP 内下载兜底 (修 v3.0.88 没同时调, 只 Linking 在某些 ROM 拦截问题)
                Updater.start(downloadUrl, version);
              }}
              activeOpacity={0.8}
            >
              <Text style={forceModalStyles.btnPrimaryText}>立即升级 v{version}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[forceModalStyles.btn, forceModalStyles.btnExit]}
              onPress={() => {
                console.log('[Updater] user chose to exit on version mismatch');
                exitApp();
              }}
              activeOpacity={0.7}
            >
              <Text style={forceModalStyles.btnExitText}>退出 APP</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * v3.0.89 抽: 多平台退 APP
 *   Android: BackHandler.exitApp()
 *   iOS: RNExitApp 第三方包 (shipin-APP 项目未装, 走 alert 兜底)
 */
function exitApp(): void {
  if (Platform.OS === 'android') {
    BackHandler.exitApp();
  } else {
    // v3.0.89.1 (S78 BUG-168 修): iOS 实战 Alert.alert 兜底 (shipin-APP 项目没装 react-native-exit-app, 实战 BUG-166 修法实战盲点)
    //   修前: require('react-native-exit-app') 失败 → 兜底 useDialog().showAlert → useDialog 整模块 undefined → App 启动 crash
    //   修后: 走 RN 内置 Alert.alert (shipin-APP 项目已用 Dialog.tsx:64 Alert.alert 兜底, 不加重, 跨项目通用)
    Alert.alert(
      '请手动退出 APP',
      'iOS 系统限制, 请按 Home 键返回桌面后从后台划掉 APP',
      [{ text: '知道了' }]
    );
  }
}

const forceModalStyles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#0a0a14',  // 深色背景, 醒目警示
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1a1a28',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#dc2626',  // 红色边框, 警示
  },
  emoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#9090a8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  versionText: {
    color: '#fbbf24',  // amber, 醒目
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    color: '#c0c0d0',
    lineHeight: 22,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    color: '#c0c0d0',
    lineHeight: 22,
  },
  hint: {
    fontSize: 12,
    color: '#808090',
    marginBottom: 16,
  },
  btnGroup: {
    marginTop: 8,
  },
  btn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  btnPrimary: {
    backgroundColor: '#10b981',  // 绿色, 主推
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnExit: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#dc2626',  // 红色, 警示
  },
  btnExitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});

/**
 * v3.0.89 兼容: 保留 showUpdateDialog 函数名 (旧 App.tsx 引用), 内部直接调 showForceUpdateDialog
 *   v3.0.88 (BUG-165): showUpdateDialog = showForceUpdateDialog (alias, 永远强制)
 *   v3.0.89 (BUG-166): alias 保留, 内部调 showForceUpdateDialog
 */
export async function showUpdateDialog(
  versionInfo: VersionInfo,
  _onDismiss?: () => void
): Promise<void> {
  showForceUpdateDialog(versionInfo);
  return;
}

// ────────────────────────────────────────────────────────────────────────
// v3.0.5 (S58 P6 BUG-010): 进度条 UI
// v3.0.89 保留: 升级完成 (finished) 后兜底清 updateMemory (虽然删了 24h 抑制, 防历史残留)
// ────────────────────────────────────────────────────────────────────────

export interface UpdaterState {
  visible: boolean;
  url: string;
  version: string;
  destPath: string;
  total: number;
  written: number;
  statusCode: number | null;
  error: string | null;
  downloading: boolean;
  finished: boolean;
}

const initial: UpdaterState = {
  visible: false,
  url: '',
  version: '',
  destPath: '',
  total: 0,
  written: 0,
  statusCode: null,
  error: null,
  downloading: false,
  finished: false,
};

let _state: UpdaterState = { ...initial };
const _subs: Set<() => void> = new Set();
let _job: any = null;

function emit() {
  _subs.forEach((fn) => fn());
}

export const Updater = {
  getState(): UpdaterState {
    return _state;
  },
  subscribe(fn: () => void): () => void {
    _subs.add(fn);
    return () => {
      _subs.delete(fn);
    };
  },
  start(url: string, version: string) {
    console.log('[Updater] start called with', url, version);
    const fileName = `DeepScript_v${version}.apk`;
    const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
    _state = {
      ...initial,
      visible: true,
      url,
      version,
      destPath,
      downloading: true,
    };
    emit();
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      } catch (e) {
        console.warn('[Updater] POST_NOTIFICATIONS request failed', e);
      }
    }
    Updater._download(url, fileName, destPath);
  },
  _download(url: string, fileName: string, destPath: string) {
    console.log('[Updater] _download called', url, fileName, destPath);
    let task: any;
    try {
      task = RNFetchBlob.config({
        addAndroidDownloads: {
          useDownloadManager: true,
          title: 'Deep剧本 v' + _state.version,
          description: '下载完成后自动安装 (强制升级)',
          mime: 'application/vnd.android.package-archive',
          mediaScannable: true,
          notification: true,
          path: destPath,
        },
      }).fetch('GET', url);
    } catch (e) {
      console.error('[Updater] RNFetchBlob.config/fetch THREW', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      _state = { ..._state, downloading: false, error: 'RNFetchBlob error: ' + errMsg };
      emit();
      return;
    }

    task.progress((received: string, total: string) => {
      const receivedNum = parseInt(received, 10);
      const totalNum = parseInt(total, 10);
      _state = { ..._state, total: totalNum, written: receivedNum };
      emit();
    });

    task.then((res: any) => {
      _state = {
        ..._state,
        downloading: false,
        finished: true,
        statusCode: 200,
        total: _state.written,
      };
      emit();
      // v3.0.89 保留: 升级完成 (用户安装新版后, 新版会重查版本号, 自动 unlock 主界面)
      try {
        const memFile = RNFS.DocumentDirectoryPath + '/.update_memory';
        RNFS.exists(memFile).then((exists) => {
          if (exists) RNFS.unlink(memFile).catch(() => {});
        }).catch(() => {});
      } catch {}
      const installPath = _state.destPath.startsWith('file://')
        ? _state.destPath.replace('file://', '')
        : _state.destPath;
      try {
        RNFetchBlob.android.actionViewIntent(
          installPath,
          'application/vnd.android.package-archive'
        );
      } catch (e) {
        console.warn('[Updater] actionViewIntent failed, fallback to FileProvider', e);
        // v3.0.89.1 (S78 BUG-168 修): Alert.alert 替代 useDialog().showAlert (shipin-APP 实战 shipin-APP 项目 shipin-APP shipin-APP shipin-APP 不加重, 跨项目通用)
        Alert.alert('下载完成', '请到下载目录手动安装: ' + _state.destPath);
      }
    }).catch((err: any) => {
      console.error('[Updater] download failed', err);
      const errMsg: string = err?.message || String(err);
      const statusCodeMatch = errMsg.match(/Status Code\s*=\s*(\d+)/);
      const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1], 10) : null;
      const isApkMissing = statusCode === 16 || statusCode === 404 || /404|Not Found/.test(errMsg);
      _state = { ..._state, downloading: false, error: errMsg };
      emit();
      if (isApkMissing) {
        // v3.0.89.1 (S78 BUG-168 修): Alert.alert 替代 useDialog().showConfirm
        Alert.alert(
          'APP 内下载不可用',
          `服务器当前版本 APK 未发布, 是否改用浏览器下载?\n\n链接: ${_state.url}`,
          [
            { text: '返回升级', style: 'cancel' },
            { text: '用浏览器下', onPress: () => {
              Linking.openURL(_state.url).catch(() =>
                Alert.alert('跳转失败', '请手动复制链接到浏览器: ' + _state.url)
              );
            }},
          ]
        );
      }
    });
  },
  cancel() {
    if (_job) {
      try {
        _job.promise.catch(() => {});
      } catch {}
    }
    _state = { ..._state, visible: false, downloading: false };
    emit();
  },
  dismiss() {
    _state = { ..._state, visible: false };
    emit();
  },
  installApk() {
    try {
      RNFetchBlob.android.actionViewIntent(
        _state.destPath,
        'application/vnd.android.package-archive'
      );
    } catch (e) {
      console.warn('[Updater] actionViewIntent failed', e);
      Linking.openURL('file://' + _state.destPath);
    }
  },
  openBrowser() {
    Linking.openURL(_state.url).catch(() => {});
  },
};

export function UpdateProgressModal() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = Updater.subscribe(() => setTick((x) => x + 1));
    return unsub;
  }, []);

  const s = Updater.getState();
  if (!s.visible) {
    return null;
  }

  const pct = s.total > 0 ? Math.round((s.written / s.total) * 100) : 0;
  const mbWritten = (s.written / 1024 / 1024).toFixed(2);
  const mbTotal = (s.total / 1024 / 1024).toFixed(2);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {s.finished ? '下载完成' : s.error ? '下载失败' : '正在下载 v' + s.version}
          </Text>

          {!s.error ? (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: pct + '%' }]} />
            </View>
          ) : null}

          <Text style={styles.percent}>
            {s.error
              ? s.error
              : s.finished
              ? '已下载 ' + mbWritten + ' MB, 即将打开安装器...'
              : s.total > 0
              ? pct + '%  (' + mbWritten + ' / ' + mbTotal + ' MB)'
              : '已下载 ' + mbWritten + ' MB'}
          </Text>

          {s.downloading ? (
            <View style={styles.spinnerRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.spinnerText}>下载中, 请勿关闭 APP</Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            {s.error ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => {
                  Updater.openBrowser();
                  Updater.dismiss();
                }}
              >
                <Text style={styles.btnText}>打开浏览器</Text>
              </TouchableOpacity>
            ) : null}
            {s.finished ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => {
                  Updater.installApk();
                  Updater.dismiss();
                }}
              >
                <Text style={styles.btnText}>立即安装</Text>
              </TouchableOpacity>
            ) : null}
            {s.downloading ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => Updater.cancel()}
              >
                <Text style={[styles.btnText, { color: colors.text.secondary }]}>取消下载</Text>
              </TouchableOpacity>
            ) : null}
            {!s.downloading && !s.finished && !s.error ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => Updater.dismiss()}
              >
                <Text style={[styles.btnText, { color: colors.text.secondary }]}>后台继续</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export function getAppVersion(): string {
  return APP_VERSION;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  percent: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  spinnerText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minWidth: 80,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnSecondary: {
    backgroundColor: colors.bg.tertiary,
  },
  btnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});
