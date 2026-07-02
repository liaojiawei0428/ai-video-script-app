// apps/mobile/src/utils/agentDownload.ts
// v3.0.24 (S60 P2 BUG-042): 图片/视频下载 utility
// - 跟 web 端 "下载图片/下载视频" 链接 1:1 对齐
// - 用 react-native-blob-util 走 server /api/download?url=...&token=... (server proxy 鉴权 + 加 filename)
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform, PermissionsAndroid } from 'react-native';
import { toast } from '../components/Toast';

const API_BASE_URL: string = require('../config').API_BASE_URL;

function buildDownloadUrl(url: string, filename: string, token: string | null): string {
  // web 端: /api/download?url=...&filename=...&token=...&disposition=attachment
  // mobile 端: server 实际端口 6000, 走公网 ab.maque.uno 反代
  // 拼接绝对 URL (react-native-blob-util 走 fetch, 要 host)
  const params = new URLSearchParams({
    url,
    filename,
    disposition: 'attachment',
  });
  if (token) params.append('token', token);
  // API_BASE_URL 形如 https://ab.maque.uno/api
  return `${API_BASE_URL.replace(/\/api$/, '')}/api/download?${params.toString()}`;
}

// v3.0.74 (BUG-143 修): djb2 + reverse 32 hex hash (跟 mediaCache.ts hashUrl + AGENTS.md § 6.7 1:1 镜像)
//   - 用于 buildImageUrl filename 稳定: 同样 part.url → 同样 filename, src URL 不变
//   - 跨项目通用铁律: URL → 稳定 hash 用于文件名, 不允许用 Date.now() 破坏 src 稳定性
function djb2Hex(s: string): string {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const reverse = hex.split('').reverse().join('');
  return `${hex}${reverse}`.padStart(16, '0');
}
// v3.0.76 (BUG-145 修): export djb2Hex — 外部组件 (FullscreenImageViewer 等等) 需要用稳定的 hash 算 filename
//   跨项目通用铁律: 任何 url → filename 的映射必用稳定 hash, 禁用 Date.now() (跟 BUG-143 同源)
export { djb2Hex };

function buildImageUrl(url: string, token: string | null): string {
  // v3.0.24.4 (S60 P3 BUG-051 修): mobile 端图片统一走 server /api/download?disposition=inline proxy
  //   - 不依赖外网 CDN HTTPS (蓝叠 Nougat64 SSL handshake 经常挂 platform-outputs.agnes-ai.space / cdn.hailuoai.com)
  //   - server 端白名单 (download.ts) 覆盖 agens / hailuo CDN, 鉴权 + 转发 inline
  //   - 跟 web 端 PartView <img src="/api/download?disposition=inline&..."> 1:1
  // v3.0.74 (BUG-143 修): filename 改成 url djb2 hash, 去掉 Date.now()
  //   - 修前: filename = `deep剧本-图片-${Date.now()}.${ext}` 每次 render 都变
  //   - 修前触发链: 用户输入文字 → setInput → parent re-render → buildImageUrl 重调
  //     → Date.now() 变了 → src URL 变了 → ImageWithLoading useEffect [src] 触发
  //     → setState('loading') + opacity.setValue(0) → 图片淡出黑屏 → 重载 → 恢复
  //   - 修后: 同样 part.url 永远生成同样 filename → src URL 稳定 → 不触发 loading 重置
  //   - filename 用途: server Content-Disposition 头的默认保存名, inline 显示(<img>)用不到, 但稳定性是硬要求
  //   - 跟 web 端 refUrl = fullUrl + token (line 1429) 1:1 镜像 (web 端压根没 filename 在 src 里)
  //   - 跟 AGENTS.md § 6.7 cross-project hash 铁律 1:1 镜像
  if (!url) return '';
  const baseApi = API_BASE_URL.replace(/\/api$/, '');
  const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg';
  const filename = `deep剧本-图片-${djb2Hex(url)}.${ext}`;
  const params = new URLSearchParams({ url, filename, disposition: 'inline' });
  if (token) params.append('token', token);
  return `${baseApi}/api/download?${params.toString()}`;
}

function buildVideoUrl(url: string, token: string | null, userId?: string): { url: string; fallbackUrl: string; filename: string } {
  // v3.0.24.4 (S60 P3 BUG-049+051 修): mobile 端 video 优先 inline proxy, local 作为 fallback
  //   - url (主, VideoPlayer 默认用): /api/download?url=...&disposition=inline&token=
  //       server 透传 inline, 走 ab.maque.uno 同源 cert, 蓝叠 Nougat64 SSL handshake 不会挂
  //   - fallbackUrl (备, video.onError 时切): /api/agent/video-local/{userId}/{filename}?token=
  //       server 端磁盘缓存的 mp4, shipin-APP 之前用同一个 user 拉过的话 0 外网
  // 跟 web 端 buildVideoUrl 第 4 个参数 'inline' 1:1
  // v3.0.74 (BUG-143 修): filename 改成 url djb2 hash, 去掉 Date.now()
  //   - 跟 buildImageUrl BUG-143 同源修法, 防止 VideoPlayer src 每次 render 都变触发 <video> 重载
  let filename = 'video.mp4';
  try {
    const u = new URL(url);
    filename = u.pathname.split('/').pop() || filename;
  } catch {}
  const baseApi = API_BASE_URL.replace(/\/api$/, '');
  // 主: inline proxy
  const proxyParams = new URLSearchParams({
    url,
    filename: `deep剧本-视频-${djb2Hex(url)}.mp4`,
    disposition: 'inline',
  });
  if (token) proxyParams.append('token', token);
  const proxyUrl = `${baseApi}/api/download?${proxyParams.toString()}`;
  // 备: local cache
  const localUrl = userId
    ? `${baseApi}/api/agent/video-local/${encodeURIComponent(userId)}/${encodeURIComponent(filename)}?token=${encodeURIComponent(token || '')}`
    : proxyUrl;
  return { url: proxyUrl, fallbackUrl: localUrl, filename };
}

export { buildDownloadUrl, buildImageUrl, buildVideoUrl };

// 实际下载: 走 fetch → file system (react-native-blob-util)
export async function downloadImage(url: string, token: string | null, filename?: string): Promise<string> {
  const authUrl = buildImageUrl(url, token);
  const downloadName = filename || `deep剧本-图片-${Date.now()}.${url.includes('.png') ? 'png' : 'jpg'}`;
  return downloadToFile(authUrl, downloadName, 'image/png');
}

export async function downloadVideo(url: string, token: string | null, filename?: string): Promise<string> {
  const downloadName = filename || `deep剧本-视频-${Date.now()}.mp4`;
  // 走 download proxy 鉴权
  return downloadToFile(buildDownloadUrl(url, downloadName, token), downloadName, 'video/mp4');
}

async function downloadToFile(url: string, filename: string, mime: string): Promise<string> {
  try {
    if (Platform.OS === 'android' && mime.startsWith('image/')) {
      // 安卓 13+ 不需要 WRITE_EXTERNAL_STORAGE, 13 以下需要
      try {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
      } catch {}
    }
    const dir = ReactNativeBlobUtil.fs.dirs.DownloadDir || ReactNativeBlobUtil.fs.dirs.DocumentDir;
    const path = `${dir}/${filename}`;
    const res = await ReactNativeBlobUtil.config({
      fileCache: true,
      path,
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        title: filename,
        mime,
        description: 'shipin-APP 下载',
      },
    }).fetch('GET', url);
    const finalPath = res.path();
    toast.show({ message: `已下载: ${filename}`, variant: 'success' });
    return finalPath;
  } catch (e: any) {
    toast.show({ message: `下载失败: ${e?.message || '未知错误'}`, variant: 'error' });
    throw e;
  }
}
