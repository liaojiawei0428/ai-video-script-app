/**
 * apps/server/src/services/apkVersion.ts
 *
 * v3.0.62 (S72 batch 31) BUG-131 修法: 启动时扫公网 APK 目录, 拿真实存在的最新 APK version,
 * 避免 server APP_VERSION (server-only hotfix) 跟公网 APK 不一致导致 Status Code 16 假下载
 *
 * 背景:
 * - 跟 BUG-117 (v3.0.46 deploy 漏推 APK) 完全同源, BUG-117 修法是 deploy.py 加 scp APK
 * - 但 S72 batch 30 v3.0.61 是 server-only hotfix (只改 server src), 没重打 mobile APK
 *   → server APP_VERSION=3.0.61, downloadUrl 拼 DeepScript_v3.0.61.apk, 但公网只有 v3.0.60 APK
 *   → DownloadManager: [18] Stop requested with status 404
 * - BUG-117 教训: 不能 trust "server APP_VERSION = 公网 APK version"
 * - 修法: server 启动时动态扫公网 public/DeepScript_v*.apk, 取 max version 当 mobileLatestApkVersion
 *
 * 跨项目通用铁律 (跟 BUG-117 / BUG-088 / BUG-089 / BUG-114 / BUG-130 / BUG-131 链同源):
 * - deploy 后, server APP_VERSION 跟公网 APK version 必须 1:1 对齐 (deploy.py 必跑 APK scp + version sync)
 * - 如果 server-only hotfix (只改 server src), 要么同时 bump mobile 并 push, 要么降级 fallback
 * - 实际部署中经常有"server bump 但 mobile APK 还没 push"的窗口期 → 必须 server 自己扫公网兜底
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = '/www/wwwroot/shipin-APP/public';
const PUBLIC_DIR_DEV = 'public'; // 本机 dev mode 相对路径 (相对 cwd)
const APK_PREFIX = 'DeepScript_v';
const APK_SUFFIX = '.apk';

interface ApkVersionCache {
  version: string;
  url: string;
  scanTime: number;
  source: 'public-dir' | 'fallback';
}

let _cache: ApkVersionCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min, deploy 后 5 min 内最多 miss 一次

/**
 * 解析 "DeepScript_v3.0.60.apk" 返 "3.0.60"
 */
function parseApkVersion(filename: string): string | null {
  if (!filename.startsWith(APK_PREFIX) || !filename.endsWith(APK_SUFFIX)) return null;
  const v = filename.slice(APK_PREFIX.length, -APK_SUFFIX.length);
  // 校验形如 "3.0.60"
  if (!/^\d+\.\d+\.\d+$/.test(v)) return null;
  return v;
}

/**
 * 比较版本号 ("3.0.61" vs "3.0.60") 返 1 / -1 / 0
 */
function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

/**
 * 扫 public dir, 取最大 version 的 APK
 */
function scanPublicApk(): { version: string; url: string } | null {
  // 优先公网路径, dev mode 兜底本机 cwd/public/
  const candidates = process.env.DEV_MODE === '1' ? [PUBLIC_DIR_DEV] : [PUBLIC_DIR, PUBLIC_DIR_DEV];

  for (const dir of candidates) {
    let files: string[];
    try {
      const st = statSync(dir);
      if (!st.isDirectory()) continue;
      files = readdirSync(dir);
    } catch {
      continue;
    }
    let best: string | null = null;
    for (const f of files) {
      const v = parseApkVersion(f);
      if (v && (!best || cmpVersion(v, best) > 0)) best = v;
    }
    if (best) {
      return {
        version: best,
        url: `https://ab.maque.uno/app/${APK_PREFIX}${best}${APK_SUFFIX}`,
      };
    }
  }
  return null;
}

/**
 * 获取 mobile 最新 APK version + URL, 自动 5 min 缓存.
 * 扫不到时返 fallback (server APP_VERSION 拼)
 */
export function getMobileLatestApk(): { version: string; url: string; source: 'public-dir' | 'fallback' } {
  if (_cache && Date.now() - _cache.scanTime < CACHE_TTL_MS) {
    return _cache;
  }
  const scanned = scanPublicApk();
  if (scanned) {
    _cache = { ...scanned, scanTime: Date.now(), source: 'public-dir' };
    console.log(`[apkVersion] public dir scan → latest=${scanned.version} url=${scanned.url}`);
  } else {
    const fallback = process.env.APP_VERSION || '3.0.61';
    _cache = {
      version: fallback,
      url: `https://ab.maque.uno/app/${APK_PREFIX}${fallback}${APK_SUFFIX}`,
      scanTime: Date.now(),
      source: 'fallback',
    };
    console.warn(`[apkVersion] public dir scan FAILED, fallback to APP_VERSION=${fallback}`);
  }
  return _cache;
}

/**
 * 强制清缓存 (deploy 后调用确保不返 stale)
 */
export function clearApkVersionCache(): void {
  _cache = null;
}
