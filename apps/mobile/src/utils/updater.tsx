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
  PermissionsAndroid, BackHandler, Modal, NativeModules, AppState, Alert,
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
 * v3.0.98 (S81 BUG-172 + 商业级 UI 重设计) 改: 强制升级 modal 走 module-level state + 自渲染 absoluteFill
 *   v3.0.88 修法 (走 DialogStore.show): dismissable=true 默认 → 用户点背景逃逸 ❌
 *   v3.0.89 修法 (走 module-level state + 自渲染 Modal): 背景是普通 View (无 onPress) + onRequestClose={() => {}} 防止返回键 → 用户无法逃逸 ✅
 *   v3.0.98 重设计: iOS 26 液态玻璃 + Material 3 商业级 UI, 删红色/警告 emoji/淘汰废话, 加 APP内下载主推按钮
 *   实战: 2 按钮 (立即更新 APP 内下载 RNFetchBlob DownloadManager / 浏览器下载 Linking.openURL) + 内嵌下载进度条
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
  console.log('[Updater] showForceUpdateDialog state changed', _forceState);
}

/**
 * v3.0.98 改: 强制升级 modal 渲染 (iOS 26 液态玻璃 + Material 3 商业级, 2 按钮: APP内下载/浏览器下载)
 *   App.tsx 必渲染这个组件 (跟 UpdateProgressModal 同模式)
 *   实战: visible 永远读 module-level state, 状态变化自动 re-render
 *   实战: 内嵌 Updater 下载进度条, 下载时 modal 切到进度视图
 *   实战: 主推按钮 "立即更新" 走 RNFetchBlob DownloadManager 稳定下载, 装完自动弹安装器
 */
export function ForceUpdateModal(): React.JSX.Element | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const sub = () => setTick((x) => x + 1);
    _forceSubs.add(sub);
    // v3.0.98: 同时订阅 Updater 下载进度, modal 实时显示百分比
    const unsubUpdater = Updater.subscribe(() => setTick((x) => x + 1));
    return () => {
      _forceSubs.delete(sub);
      unsubUpdater();
    };
  }, []);

  // v3.0.96 BUG-172 调试: 测组件是否真渲染
  console.log('[Updater] ForceUpdateModal render', { visible: _forceState.visible, version: _forceState.version });

  if (!_forceState.visible) {
    return null;
  }

  const { version, downloadUrl } = _forceState;
  const updateState = Updater.getState();

  return (
    // v3.0.94 BUG-172 修: 不依赖 RN <Modal> (RN 0.73 + Hermes + 新架构下 ReactModalHostManager view manager 找不到 generated setter, 实战 BUG-165 修法盲点)
    //   改用 absoluteFill + zIndex: 9999 普通 View, 强制覆盖整屏 (跟 RN <Modal transparent={false}> 1:1 镜像效果)
    //   跨项目通用铁律 #31 (跟 BUG-165 实战盲点 100% 同源): 强制升级 E2E 必跑完整 9 维, 单测 "checkForUpdate success + visible=true" 不够, 必截图验证 modal 真渲染
    // v3.0.98 改: 商业级渐变背景 (从 #0c0a1e → #1e1b4b, 跟 logo 紫色一致) + iOS 26 玻璃拟态卡片 (圆角 28 + 半透明 + 紫色光边)
    <View style={[StyleSheet.absoluteFillObject, forceModalStyles.fullscreen, { zIndex: 9999, elevation: 9999 }]}>
      {/* 背景: 渐变深色 (用 2 个 View 叠加模拟 LinearGradient, 不依赖 react-native-linear-gradient) */}
      <View style={forceModalStyles.bgGradientTop} />
      <View style={forceModalStyles.bgGradientBottom} />
      <View style={forceModalStyles.center}>
        {/* 卡片: 圆角 28 + 半透明深色 + 紫色光边 + 微妙高光 */}
        <View style={forceModalStyles.card}>
          <View style={forceModalStyles.cardHighlight} />

          {/* 下载中 vs 待下载 切换 UI (v3.0.98 新增) */}
          {updateState.downloading || updateState.finished || updateState.error ? (
            <DownloadProgressView
              updateState={updateState}
              version={version}
              onCancel={() => Updater.cancel()}
            />
          ) : (
            <UpgradePromptView
              version={version}
              downloadUrl={downloadUrl}
              onInAppUpdate={() => {
                console.log('[Updater] user chose APP 内下载 v' + version);
                Updater.start(downloadUrl, version);
              }}
              onBrowserDownload={() => {
                console.log('[Updater] user chose 浏览器下载 v' + version);
                Linking.openURL(downloadUrl).catch((err) => {
                  console.warn('[Updater] Linking.openURL failed:', err);
                  Alert.alert('打开浏览器失败', '请手动复制链接到浏览器下载:\n' + downloadUrl);
                });
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * v3.0.98 新增: 待下载视图 (商业级, 圆角渐变 icon + 2 按钮)
 *   设计参考: iOS 26 液态玻璃 + Material 3 圆角 + Vant 商业按钮
 */
function UpgradePromptView(props: {
  version: string;
  downloadUrl: string;
  onInAppUpdate: () => void;
  onBrowserDownload: () => void;
}): React.JSX.Element {
  return (
    <>
      {/* Icon 圆形渐变背景 + 内置 ArrowUp (升级箭头, 视觉语义) */}
      <View style={forceModalStyles.iconCircle}>
        <View style={forceModalStyles.iconCircleInner}>
          {/* 内置向上箭头 SVG: 圆角粗线, 商业级 */}
          <View style={forceModalStyles.arrowUp} />
          <View style={forceModalStyles.arrowUpBar} />
        </View>
      </View>

      {/* 标题: "发现新版本" 26pt 粗体 居中 白色 */}
      <Text style={forceModalStyles.title}>发现新版本</Text>

      {/* 版本对比: 灰色 + 紫色高亮 + 绿色对勾 */}
      <View style={forceModalStyles.versionRow}>
        <Text style={forceModalStyles.versionOld}>v{APP_VERSION}</Text>
        <View style={forceModalStyles.arrowRight}>
          {/* 右箭头 */}
          <View style={forceModalStyles.arrowRightLine} />
          <View style={forceModalStyles.arrowRightHead} />
        </View>
        <Text style={forceModalStyles.versionNew}>v{props.version}</Text>
        <View style={forceModalStyles.newBadge}>
          <Text style={forceModalStyles.newBadgeText}>NEW</Text>
        </View>
      </View>

      {/* 描述: 浅灰 14pt 居中 */}
      <Text style={forceModalStyles.description}>
        包含性能优化与体验改进, 建议立即更新到最新版本
      </Text>

      {/* 按钮组: 2 按钮 (主推 APP内下载 + 次选 浏览器下载) */}
      <View style={forceModalStyles.btnGroup}>
        {/* 主推按钮: 渐变 indigo→violet + 圆角 16 + 高 56 + Sparkles icon */}
        <TouchableOpacity
          style={forceModalStyles.btnPrimary}
          onPress={props.onInAppUpdate}
          activeOpacity={0.85}
        >
          <View style={forceModalStyles.btnPrimaryGradient} />
          <View style={forceModalStyles.btnPrimaryContent}>
            <View style={forceModalStyles.sparklesIcon}>
              <View style={forceModalStyles.sparklesIconShape1} />
              <View style={forceModalStyles.sparklesIconShape2} />
              <View style={forceModalStyles.sparklesIconShape3} />
            </View>
            <Text style={forceModalStyles.btnPrimaryText}>立即更新</Text>
          </View>
        </TouchableOpacity>

        {/* 次选按钮: 透明 + 1.5px 浅色边框 + 高 56 + Chrome icon */}
        <TouchableOpacity
          style={forceModalStyles.btnSecondary}
          onPress={props.onBrowserDownload}
          activeOpacity={0.7}
        >
          <View style={forceModalStyles.chromeIcon}>
            <View style={forceModalStyles.chromeIconRing} />
            <View style={forceModalStyles.chromeIconCenter} />
            <View style={forceModalStyles.chromeIconLineH} />
            <View style={forceModalStyles.chromeIconLineV} />
          </View>
          <Text style={forceModalStyles.btnSecondaryText}>浏览器下载</Text>
        </TouchableOpacity>
      </View>

      {/* 底部小字: 隐私 + 安全提示 (灰色 11pt 居中) */}
      <Text style={forceModalStyles.footnote}>
        APP 内下载更稳定, 浏览器下载支持断点续传
      </Text>
    </>
  );
}

/**
 * v3.0.98 新增: 下载进度视图 (圆角进度条 + 渐变 fill + 百分比 + 状态)
 *   跟 ForceUpdateModal 集成, 共享卡片容器
 *   状态: downloading (进度条 + 百分比 + 取消按钮) / finished (立即安装 + 完成态) / error (重试 + 浏览器下载)
 */
function DownloadProgressView(props: {
  updateState: UpdaterState;
  version: string;
  onCancel: () => void;
}): React.JSX.Element {
  const { updateState, version, onCancel } = props;
  const pct = updateState.total > 0 ? Math.round((updateState.written / updateState.total) * 100) : 0;
  const mbWritten = (updateState.written / 1024 / 1024).toFixed(1);
  const mbTotal = (updateState.total / 1024 / 1024).toFixed(1);

  if (updateState.finished) {
    // 下载完成: 立即安装 (DownloadManager 已自动弹安装器, 这里给个兜底再触发一次)
    return (
      <>
        <View style={forceModalStyles.iconCircle}>
          <View style={[forceModalStyles.iconCircleInner, forceModalStyles.iconCircleSuccess]}>
            <View style={forceModalStyles.checkMark1} />
            <View style={forceModalStyles.checkMark2} />
          </View>
        </View>
        <Text style={forceModalStyles.title}>下载完成</Text>
        <Text style={forceModalStyles.description}>
          v{version} 已下载到本地 ({mbWritten} MB), 即将自动打开安装器
        </Text>
        <View style={forceModalStyles.btnGroup}>
          <TouchableOpacity
            style={forceModalStyles.btnPrimary}
            onPress={() => Updater.installApk()}
            activeOpacity={0.85}
          >
            <View style={forceModalStyles.btnPrimaryGradient} />
            <View style={forceModalStyles.btnPrimaryContent}>
              <Text style={forceModalStyles.btnPrimaryText}>立即安装</Text>
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (updateState.error) {
    // 错误: 重试 + 浏览器下载兜底
    return (
      <>
        <View style={forceModalStyles.iconCircle}>
          <View style={[forceModalStyles.iconCircleInner, forceModalStyles.iconCircleError]}>
            <View style={forceModalStyles.exclamation1} />
            <View style={forceModalStyles.exclamation2} />
          </View>
        </View>
        <Text style={forceModalStyles.title}>下载失败</Text>
        <Text style={forceModalStyles.description} numberOfLines={3}>
          {updateState.error}
        </Text>
        <View style={forceModalStyles.btnGroup}>
          <TouchableOpacity
            style={forceModalStyles.btnPrimary}
            onPress={() => {
              console.log('[Updater] user retry, restart download');
              const url = _forceState.downloadUrl;
              if (url) Updater.start(url, version);
            }}
            activeOpacity={0.85}
          >
            <View style={forceModalStyles.btnPrimaryGradient} />
            <View style={forceModalStyles.btnPrimaryContent}>
              <Text style={forceModalStyles.btnPrimaryText}>重试</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={forceModalStyles.btnSecondary}
            onPress={() => {
              const url = _forceState.downloadUrl;
              if (url) Linking.openURL(url);
            }}
            activeOpacity={0.7}
          >
            <Text style={forceModalStyles.btnSecondaryText}>浏览器下载</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // downloading (默认)
  return (
    <>
      <View style={forceModalStyles.iconCircle}>
        <View style={forceModalStyles.iconCircleInner}>
          <View style={forceModalStyles.downloadArrow1} />
          <View style={forceModalStyles.downloadArrow2} />
        </View>
      </View>
      <Text style={forceModalStyles.title}>正在下载更新</Text>
      <Text style={forceModalStyles.description}>
        v{version} · 完成后将自动打开安装器
      </Text>
      {/* 进度条: 4px track + 6px 渐变 fill, 圆角 3, 100% 时绿色高亮 */}
      <View style={forceModalStyles.progressBarBg}>
        <View style={[forceModalStyles.progressBarFill, { width: `${pct}%` }]} />
      </View>
      <View style={forceModalStyles.progressRow}>
        <Text style={forceModalStyles.progressText}>
          {mbWritten} MB / {mbTotal > '0.0' ? `${mbTotal} MB` : '...'}
        </Text>
        <Text style={forceModalStyles.progressPercent}>{pct}%</Text>
      </View>
      <View style={forceModalStyles.btnGroup}>
        <TouchableOpacity
          style={forceModalStyles.btnSecondary}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={forceModalStyles.btnSecondaryText}>取消下载</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const forceModalStyles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // v3.0.98 新增: 渐变背景 (2 个 View 叠加模拟)
  bgGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0c0a1e',  // 深空紫
  },
  bgGradientBottom: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1e1b4b',  // indigo-950
    opacity: 0.85,
  },
  center: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // v3.0.98 新增: 商业级卡片 (iOS 26 液态玻璃 + Material 3 圆角)
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(26, 26, 46, 0.92)',  // 半透明深色
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',  // 紫色光边
    overflow: 'hidden',
    elevation: 12,  // Android 阴影
    shadowColor: '#6366f1',  // 紫色阴影光晕
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  // v3.0.98 新增: 卡片顶部高光 (模拟 iOS 26 液态玻璃反射)
  cardHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',  // 顶部高光
  },
  // v3.0.98 新增: icon 圆形 (渐变 indigo→violet 64x64 + 阴影)
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconCircleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',  // 渐变起点 indigo-500 (RN 0.73 不支持多色渐变, 用纯色)
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  iconCircleSuccess: {
    backgroundColor: '#10b981',  // 下载完成绿色
    shadowColor: '#10b981',
  },
  iconCircleError: {
    backgroundColor: '#f59e0b',  // 错误 amber (不红)
    shadowColor: '#f59e0b',
  },
  // v3.0.98 新增: 内置 ArrowUp 图标 (升级箭头)
  arrowUp: {
    position: 'absolute',
    top: 12,
    left: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ffffff',
  },
  arrowUpBar: {
    position: 'absolute',
    top: 22,
    left: 24,
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
  },
  // v3.0.98 新增: 对勾 (下载完成)
  checkMark1: {
    position: 'absolute',
    width: 14,
    height: 3,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }],
    top: 28,
    left: 14,
  },
  checkMark2: {
    position: 'absolute',
    width: 22,
    height: 3,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
    transform: [{ rotate: '-45deg' }],
    top: 24,
    left: 18,
  },
  // v3.0.98 新增: 感叹号 (错误)
  exclamation1: {
    position: 'absolute',
    width: 4,
    height: 18,
    backgroundColor: '#ffffff',
    borderRadius: 2,
    top: 14,
    left: 26,
  },
  exclamation2: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#ffffff',
    borderRadius: 2,
    top: 38,
    left: 26,
  },
  // v3.0.98 新增: 下载图标 (向下箭头)
  downloadArrow1: {
    position: 'absolute',
    top: 12,
    left: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  downloadArrow2: {
    position: 'absolute',
    top: 22,
    left: 24,
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
  },
  // v3.0.98 新增: 标题
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  // v3.0.98 新增: 版本对比行
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  versionOld: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
  versionNew: {
    fontSize: 18,
    color: '#a78bfa',  // violet-400
    fontWeight: '700',
  },
  arrowRight: {
    width: 28,
    height: 16,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowRightLine: {
    width: 22,
    height: 2,
    backgroundColor: '#64748b',
    borderRadius: 1,
  },
  arrowRightHead: {
    position: 'absolute',
    right: 0,
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftColor: '#64748b',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  newBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',  // 绿色透明
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  newBadgeText: {
    fontSize: 10,
    color: '#34d399',  // 绿色高亮
    fontWeight: '700',
    letterSpacing: 1,
  },
  // v3.0.98 新增: 描述
  description: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  // v3.0.98 新增: 进度条
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',  // 渐变起点 (RN 不支持多色, 纯色)
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 16,
    color: '#a78bfa',
    fontWeight: '700',
  },
  // v3.0.98 新增: 按钮组
  btnGroup: {
    width: '100%',
  },
  // 主推按钮: 渐变 indigo→violet (用 2 个 View 叠加模拟, RN 0.73 不支持 LinearGradient)
  btnPrimary: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#6366f1',  // 兜底色
  },
  btnPrimaryGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#8b5cf6',  // 渐变终点 violet-500
    opacity: 0.65,  // 跟 indigo-500 叠加模拟渐变
  },
  btnPrimaryContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // v3.0.98 新增: Sparkles 图标 (主推按钮左侧装饰)
  sparklesIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  sparklesIconShape1: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 8,
    height: 8,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  sparklesIconShape2: {
    position: 'absolute',
    top: 10,
    left: 12,
    width: 6,
    height: 6,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  sparklesIconShape3: {
    position: 'absolute',
    top: 0,
    left: 14,
    width: 4,
    height: 4,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  // 次选按钮: 透明 + 1.5px 浅色边框
  btnSecondary: {
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.4)',  // 浅灰边框
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',  // 浅灰文字
  },
  // v3.0.98 新增: Chrome 图标 (次选按钮左侧装饰)
  chromeIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromeIconRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  chromeIconCenter: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#cbd5e1',
  },
  chromeIconLineH: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: '#cbd5e1',
    top: 6,
  },
  chromeIconLineV: {
    position: 'absolute',
    width: 1.5,
    height: 12,
    backgroundColor: '#cbd5e1',
    left: 8.25,
  },
  // v3.0.98 新增: 底部小字
  footnote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
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
      const { ApkInstaller } = NativeModules;
      if (ApkInstaller?.install) {
        ApkInstaller.install(installPath);
      } else {
        // fallback: 仍用 RNFetchBlob（部分机型可行）
        try {
          RNFetchBlob.android.actionViewIntent(
            installPath,
            'application/vnd.android.package-archive'
          );
        } catch (e) {
          console.warn('[Updater] actionViewIntent failed', e);
          Alert.alert('下载完成', '请到下载目录手动安装: ' + _state.destPath);
        }
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
    const { ApkInstaller } = NativeModules;
    const installPath = _state.destPath.startsWith('file://')
      ? _state.destPath.replace('file://', '')
      : _state.destPath;
    if (ApkInstaller?.install) {
      ApkInstaller.install(installPath);
    } else {
      // fallback
      try {
        RNFetchBlob.android.actionViewIntent(installPath, 'application/vnd.android.package-archive');
      } catch (e) {
        console.warn('[Updater] install failed:', e);
        Alert.alert('安装失败', '请前往下载目录手动安装，或下拉通知栏点击下载完成通知安装');
      }
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
              <View style={[styles.progressBarFill, { width: `${pct}%` as `${number}%` }]} />
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
