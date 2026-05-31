import { Platform, Alert, Linking } from 'react-native';
import RNFS from 'react-native-fs';
import { API_BASE_URL } from '../config';
import { APP_VERSION } from '../config/version';

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

export function showUpdateDialog(versionInfo: VersionInfo, onDismiss?: () => void): void {
  const { version, changelog, downloadUrl } = versionInfo;

  Alert.alert(
    '发现新版本 v' + version,
    '请更新到最新版本后使用\n\n' + changelog,
    [
      {
        text: '立即更新',
        onPress: () => downloadAndInstall(downloadUrl),
      },
    ],
    { cancelable: false }
  );
}

async function downloadAndInstall(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('下载失败', '请访问官网 maque.uno 手动下载', [
      { text: '重试', onPress: () => downloadAndInstall(url) },
    ]);
  }
}

export function getAppVersion(): string {
  return APP_VERSION;
}
