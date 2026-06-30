import React, { useState, useEffect } from 'react';
import {
  Platform, Linking, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, PermissionsAndroid,
} from 'react-native';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'react-native-blob-util';
import { API_BASE_URL } from '../config';
import { APP_VERSION } from '../config/version';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { Dialog } from '../components/Dialog';
import { DialogStore, useDialog } from '../hooks/useDialog';
// v3.0.35 (S72 batch 5): BUG-087 修法 - 24h 抑制"无限发现新版本"
// 用 RNFS 持久化"用户取消过哪个版本", 同一版本 24h 内不再弹
import { shouldSuppressUpdateDialog, setUpdateDismissed } from '../db/updateMemory';

interface VersionInfo {
  version: string;
  downloadUrl: string;
  changelog: string;
  forceUpdate: boolean;
  needUpdate: boolean;
}

export async function checkForUpdate(): Promise<VersionInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/version?version=${APP_VERSION}`);
    const data = await response.json();
    if (data.success && data.data.needUpdate) {
      return data.data;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function showUpdateDialog(versionInfo: VersionInfo, onDismiss?: () => void): Promise<void> {
  const { version, changelog, downloadUrl, forceUpdate } = versionInfo;

  // v3.0.35 (S72 batch 5): BUG-087 修法 - 24h 抑制"无限发现新版本"
  // forceUpdate=true → 强制弹 (安全/关键修复, 不可抑制)
  // 否则: 同版本 + 24h 内已取消 → 跳过弹窗
  const suppress = await shouldSuppressUpdateDialog(version, !!forceUpdate);
  if (suppress) {
    console.log('[Updater] dialog suppressed by 24h memory', { version, forceUpdate });
    onDismiss?.();
    return;
  }

  // v3.0.24 (S60 P1): 改用 Dialog 组件 + 自定义内容 (3 按钮), 不再用 Alert.alert
  // v3.0.35 (S72 batch 5): BUG-087 修法 - 取消按钮调 setUpdateDismissed 写入 .update_memory
  //                          下载按钮不写入 (用户真的要更新就让他更新, 不要写抑制)
  DialogStore.show({
    type: 'custom',
    options: {
      title: (forceUpdate ? '紧急升级 v' : '发现新版本 v') + version,
      content: (
        <View>
          <Text style={updateDialogStyles.body}>
            {forceUpdate ? '本次升级为强制更新 (安全/关键修复), 升级后才能继续使用' : '请更新到最新版本后使用'}{'\n\n'}<Text style={{ color: colors.text.accent }}>{changelog}</Text>{'\n\n'}推荐用浏览器下载 (下载快 + 自带进度 + 失败可重试)
          </Text>
          <View style={updateDialogStyles.btnGroup}>
            {forceUpdate ? null : (
              <TouchableOpacity
                style={[updateDialogStyles.btn, updateDialogStyles.btnSecondary]}
                onPress={() => {
                  DialogStore.close();
                  // BUG-087: 取消 → 写 24h 抑制, 下次冷启动不再弹
                  setUpdateDismissed(version);
                  onDismiss?.();
                }}
                activeOpacity={0.7}
              >
                <Text style={updateDialogStyles.btnSecondaryText}>取消 (24h 不再提醒)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[updateDialogStyles.btn, updateDialogStyles.btnSecondary]}
              onPress={() => {
                DialogStore.close();
                // 不写抑制 (用户真要下载, 让他下载)
                Updater.start(downloadUrl, version);
              }}
              activeOpacity={0.7}
            >
              <Text style={updateDialogStyles.btnSecondaryText}>APP 内下载</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[updateDialogStyles.btn, updateDialogStyles.btnPrimary]}
              onPress={() => {
                DialogStore.close();
                // 不写抑制 (用户真要去浏览器, 让他去)
                Linking.openURL(downloadUrl).catch(() =>
                  useDialog().showAlert({ title: '打开失败', message: '请手动访问 ' + downloadUrl, variant: 'error' })
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={updateDialogStyles.btnPrimaryText}>浏览器下载 (推荐)</Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
    },
  });
}

const updateDialogStyles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  btnGroup: {
    marginTop: spacing.sm,
  },
  btn: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  btnSecondaryText: {
    ...typography.h3,
    color: colors.text.secondary,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    ...shadows.accent,
  },
  btnPrimaryText: {
    ...typography.h3,
    color: colors.text.inverse,
  },
});

// ────────────────────────────────────────────────────────────────────────
// v3.0.5 (S58 P6 BUG-010): 进度条 UI — 替换 S58 P4 的 Alert 弹窗
// 用 module-level 状态 + useSyncExternalStore-like 订阅, 不用 class
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
    // v3.0.12 (S58 P10 BUG-021): 用 react-native-blob-util 走 Android DownloadManager
    // 通知栏固定下载进度, 应用被杀也能继续下
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
    // Android 13+ 申请 POST_NOTIFICATIONS 权限 (用户拒绝也不影响下载, 只是没通知)
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
    // v3.0.12: 走系统 DownloadManager, 通知栏固定进度
    console.log('[Updater] _download called', url, fileName, destPath);
    let task: any;
    try {
      task = RNFetchBlob.config({
        addAndroidDownloads: {
          useDownloadManager: true,         // 关键: 系统 DownloadManager
          title: 'Deep剧本 v' + _state.version,
          description: '下载完成后自动安装',
          mime: 'application/vnd.android.package-archive',
          mediaScannable: true,
          notification: true,               // 通知栏固定显示
          path: destPath,
        },
      }).fetch('GET', url);
      console.log('[Updater] RNFetchBlob.fetch() returned task');
    } catch (e) {
      console.error('[Updater] RNFetchBlob.config/fetch THREW', e);
      _state = { ..._state, downloading: false, error: 'RNFetchBlob error: ' + (e?.message || String(e)) };
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
      // 下载完成, 调起系统安装器
      _state = {
        ..._state,
        downloading: false,
        finished: true,
        statusCode: 200,
        total: _state.written,
      };
      emit();
      // v3.0.21 (S58 P10 BUG-026): Android 7+ (API 24+) StrictMode 禁用 file:// URI 调起安装器
      // 必用 FileProvider 拿 content:// URI, AndroidManifest.xml 已配 authorities=${applicationId}.fileprovider
      // file_paths.xml 已配 <external-path name="apk_download" path="Download/" /> 匹配 DownloadManager 落地路径
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
        // 备选: FileProvider 显式转 content://
        // RNFS 跟 react-native-blob-util 内部都可能用 file://, 失败时降级到手动安装
        useDialog().showAlert({ title: '下载完成', message: '请到下载目录手动安装: ' + _state.destPath, variant: 'success' });
      }
    }).catch((err: any) => {
      console.error('[Updater] download failed', err);
      const errMsg: string = err?.message || String(err);
      // v3.0.62 BUG-131 修法防御层: 解析 Status Code, 16 (ERROR_HTTP_DATA_ERROR) / 404 自动 fallback 浏览器下载
      // 跟 BUG-117 公网 APK 404 完全同源, 修法 catch 块识别 "Status Code = N" 自动弹 fallback confirm
      const statusCodeMatch = errMsg.match(/Status Code\s*=\s*(\d+)/);
      const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1], 10) : null;
      const isApkMissing = statusCode === 16 || statusCode === 404 || /404|Not Found/.test(errMsg);
      _state = { ..._state, downloading: false, error: errMsg };
      emit();
      if (isApkMissing) {
        useDialog().showConfirm({
          title: 'APP 内下载不可用',
          message: `服务器当前版本 APK 未发布 (${statusCode === 16 ? '公网 404' : '下载失败'}), 是否改用浏览器下载?\n\n链接: ${_state.url}`,
          confirmText: '用浏览器下',
          cancelText: '取消',
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
    // v3.0.12: 用 blob-util 调起系统安装器
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

  // v3.0.24 (S60 P1): 改用 View 渲染 + Dialog 视觉, 不再用 React Native Modal
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
