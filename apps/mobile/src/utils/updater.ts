import { Platform, Alert, Linking, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { API_BASE_URL } from '../config';
import { APP_VERSION } from '../config/version';

const { ApkInstaller } = NativeModules;

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
    if (Platform.OS === 'android') {
      const fileName = `DeepScript_${Date.now()}.apk`;
      const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      Alert.alert('正在下载', '正在下载最新版本，请稍候...');

      const download = RNFS.downloadFile({
        fromUrl: url,
        toFile: destPath,
        progressDivider: 5,
      });

      const result = await download.promise;
      if (result.statusCode === 200) {
        if (ApkInstaller) {
          ApkInstaller.install(destPath);
        } else {
          await Linking.openURL('file://' + destPath);
        }
      } else {
        throw new Error('下载失败: ' + result.statusCode);
      }
    } else {
      await Linking.openURL(url);
    }
  } catch (error) {
    Alert.alert('下载失败', '请访问官网 maque.uno 手动下载', [
      { text: '重试', onPress: () => downloadAndInstall(url) },
    ]);
  }
}

export function getAppVersion(): string {
  return APP_VERSION;
}
