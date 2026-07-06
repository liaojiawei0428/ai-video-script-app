// apps/mobile/src/utils/updater.tsx
// v3.0.88 (S78 BUG-165): 强制升级 + 启动必查版本号 + 不一致必升级 + 不升级不能使用
//   删 v3.0.35 (S72 batch 5 BUG-087) 24h 抑制 (跟"强制"矛盾)
//   删 v3.0.62 (BUG-131) forceUpdate=true 还有的"取消 (24h 不再提醒)"按钮 (跟"必升级"矛盾)
//   新增: 强制升级 modal 只 2 按钮 (立即升级 / 退出 APP), 启动 gate 不通过不渲染 navigation
//   退出 APP: BackHandler.exitApp() (Android), RN 默认 RNExitApp 兜底
//   升级成功 (finished) 后: clearUpdateMemory 保险 (虽然删了 24h 抑制逻辑, 防历史残留文件干扰)

import React, { useState, useEffect } from 'react';
import {
  Platform, Linking, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  PermissionsAndroid, BackHandler,
} from 'react-native';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'react-native-blob-util';
import { API_BASE_URL } from '../config';
import { APP_VERSION } from '../config/version';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { Dialog } from '../components/Dialog';
import { DialogStore, useDialog } from '../hooks/useDialog';
// v3.0.88 删: import { shouldSuppressUpdateDialog, setUpdateDismissed } from '../db/updateMemory';
//   24h 抑制跟"强制升级 + 不一致必升级"硬冲突, 全部清

export interface VersionInfo {
  version: string;
  downloadUrl: string;
  changelog: string;
  /** 永远 true (v3.0.88): 必升级, 无 needUpdate 二分 */
  appForceUpdate: boolean;
  /** v3.0.88 新增: 跟 server 真实公网 APK 一致的最新 version, 客户端做 force reload 验证 */
  mobileLatestApkVersion: string;
  /** v3.0.88 新增: 必填 (含 base64 changelog) */
  changelogHighlights?: string[];
  buildDate?: string;
  /** v3.0.88 新增: 失败后多久重试 (秒), 默认 5s */
  retryAfter?: number;
}

/**
 * v3.0.88 改: checkForUpdate 加重试 (默认 3 次, 1s/2s/4s exponential backoff)
 * - 失败 (网络错) → throw 真实错误, 让 App.tsx startup gate 显示"网络错误请重试"
 * - 成功 → 返 VersionInfo, 包含 appForceUpdate (永远 true for 任何不一致)
 * - 修前: 失败 catch 静默返 null → App.tsx 当作"无更新" → 用户进入主界面 → 实际不一致 = 漏
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
        // v3.0.88: appForceUpdate 必返 true for 任何不一致, server 端已经强制映射
        return {
          version: data.data.version,
          downloadUrl: data.data.downloadUrl,
          changelog: data.data.changelog,
          appForceUpdate: true, // v3.0.88: 永远是 true, 任何不一致都强制升级
          mobileLatestApkVersion: data.data.mobileLatestApkVersion || data.data.version,
          changelogHighlights: data.data.highlights || [],
          buildDate: data.data.buildDate,
          retryAfter: 5,
        };
      }
      // server 端返 success=false: throw 让 startup gate 显示错误
      throw new Error(data.message || '服务器返回错误响应');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`[Updater] checkForUpdate attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, lastError);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delayMs);
          return timer; // RN 0.73+ setTimeout 显式 () => void 回调签名
        });
      }
    }
  }
  throw lastError || new Error('checkForUpdate failed after retries');
}

/**
 * v3.0.88 改: 删 24h 抑制, 改强制升级 modal, 仅 2 按钮
 * - 立即升级: 调起下载 (APP 内 / 浏览器, 默认浏览器推荐)
 * - 退出 APP: BackHandler.exitApp() (Android), RNExitApp 兜底
 * - 修前: 3 按钮 (取消 24h 不再提醒 / APP 内下载 / 浏览器下载) + 24h 抑制 + 跨会话卡死
 */
export function showForceUpdateDialog(versionInfo: VersionInfo): void {
  const { version, changelog, downloadUrl, changelogHighlights } = versionInfo;

  DialogStore.show({
    type: 'custom',
    options: {
      title: '⚠️ 版本不一致, 必须升级',
      content: (
        <View>
          <Text style={updateDialogStyles.body}>
            当前 APP 版本已被官网淘汰, 必须升级到最新版本才能继续使用{'\n\n'}
            最新版本: <Text style={{ color: colors.text.accent, fontWeight: '700' }}>v{version}</Text>{'\n'}
            {changelogHighlights && changelogHighlights.length > 0 ? (
              <>
                {'\n更新内容:'}{'\n'}
                {changelogHighlights.slice(0, 5).map((h, i) => (
                  <Text key={i} style={updateDialogStyles.bullet}>• {h}</Text>
                ))}
              </>
            ) : (
              <Text style={{ color: colors.text.tertiary }}>{'\n'}{changelog}</Text>
            )}
            {'\n\n推荐用浏览器下载 (速度快 + 自带进度 + 失败可重试)'}
          </Text>
          <View style={updateDialogStyles.btnGroup}>
            <TouchableOpacity
              style={[updateDialogStyles.btn, updateDialogStyles.btnPrimary]}
              onPress={() => {
                // 不关闭 dialog, 调起下载后让用户继续看到 modal (防 dialog 关闭后用户又看不到升级)
                Linking.openURL(downloadUrl).catch(() => {
                  useDialog().showAlert({
                    title: '打开浏览器失败',
                    message: '请手动访问: ' + downloadUrl,
                    variant: 'error',
                  });
                });
                // 同时启动 APP 内下载兜底 (防 Linking 在某些定制 ROM 拦截)
                Updater.start(downloadUrl, version);
              }}
              activeOpacity={0.8}
            >
              <Text style={updateDialogStyles.btnPrimaryText}>立即升级 v{version}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[updateDialogStyles.btn, updateDialogStyles.btnExit]}
              onPress={() => {
                console.log('[Updater] user chose to exit, app version mismatch');
                // 退 APP (Android 用 BackHandler, iOS 没法主动退, 让 RN 默认行为)
                if (Platform.OS === 'android') {
                  BackHandler.exitApp();
                } else {
                  // iOS 没官方退 APP API, 用 RNExitApp 兜底 (需用户同意)
                  try {
                    // @ts-ignore - 动态 import 兼容无 RNExitApp 装包
                    const RNExitApp = require('react-native-exit-app').default;
                    RNExitApp.exitApp();
                  } catch {
                    // 兜底: 弹 alert 提示用户手动退
                    useDialog().showAlert({
                      title: '请手动退出 APP',
                      message: 'iOS 系统限制, 请按 Home 键返回桌面后从后台划掉 APP',
                      variant: 'error',
                    });
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={updateDialogStyles.btnExitText}>退出 APP</Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
    },
  });
}

/**
 * v3.0.88 兼容: 保留 showUpdateDialog 函数名 (旧 App.tsx 引用), 内部直接调 showForceUpdateDialog
 * 修前: showUpdateDialog 内部 24h 抑制 + 3 按钮 + forceUpdate 才禁用取消
 * 修后: showUpdateDialog = showForceUpdateDialog (alias, 永远强制)
 */
export async function showUpdateDialog(
  versionInfo: VersionInfo,
  _onDismiss?: () => void
): Promise<void> {
  showForceUpdateDialog(versionInfo);
  // 立即调起下载进度 modal (后台下载, 不阻塞 dialog)
  // 注: 实际点击"立即升级"按钮才调 Updater.start, 这里不主动调
  // 旧 _onDismiss 回调忽略 (强制升级不允许 dismiss)
  return;
}

const updateDialogStyles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  bullet: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginLeft: spacing.sm,
  },
  btnGroup: {
    marginTop: spacing.sm,
  },
  btn: {
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    ...shadows.accent,
  },
  btnPrimaryText: {
    ...typography.h3,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  // v3.0.88 改: 退出按钮红色 (醒目警示, 跟主推绿色升级按钮区分)
  btnExit: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#dc2626', // 红色, shipin-APP 警示色
  },
  btnExitText: {
    ...typography.h3,
    color: '#dc2626',
    fontWeight: '600',
  },
});

// ────────────────────────────────────────────────────────────────────────
// v3.0.5 (S58 P6 BUG-010): 进度条 UI — 替换 S58 P4 的 Alert 弹窗
// v3.0.88 (BUG-165): 升级完成 (finished) 后调 clearUpdateMemory 兜底 (虽然删了 24h 抑制, 防历史残留)
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
      // v3.0.88: 升级完成 (用户安装新版后, 新版会重查版本号, 自动 unlock 主界面)
      // 兜底清 updateMemory (虽然删了 24h 抑制逻辑, 防历史残留文件干扰)
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
        useDialog().showAlert({ title: '下载完成', message: '请到下载目录手动安装: ' + _state.destPath, variant: 'success' });
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
        // v3.0.88: 强制升级不允许"取消", 改"返回升级按钮"
        useDialog().showConfirm({
          title: 'APP 内下载不可用',
          message: `服务器当前版本 APK 未发布, 是否改用浏览器下载?\n\n链接: ${_state.url}`,
          confirmText: '用浏览器下',
          cancelText: '返回升级',
          onConfirm: () => {
            Linking.openURL(_state.url).catch(() =>
              useDialog().showAlert({ title: '跳转失败', message: '请手动复制链接到浏览器: ' + _state.url, variant: 'error' })
            );
          },
        });
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
