/**
 * apps/server/src/shared/changelog.ts
 *
 * v3.0.29 (S64): 版本 changelog 读取模块
 *
 * 之前 /api/version 硬编码 `changelog: '优化性能，修复已知问题'`, 用户
 * 访问 web 端 /download 页时看到的 changelog 是死字符串, 跟实际发布内容
 * 没关系 (BUG-066)。
 *
 * 修法: 维护一个 changelog.json 数据源, 按版本号维护真实条目, server 启动
 * 时一次性读入内存, /api/version 直接返回当前版本对应的真实 changelog。
 *
 * 数据源: `apps/server/changelog.json` (位于源码根, build 后随 dist 复制)
 *
 * 配套规范:
 * - VERSION_MANAGEMENT.md § 4 changelog 维护流程
 * - BUGS.md BUG-066 (硬编码 changelog)
 * - CODING_STANDARDS.md 第 30 条 (changelog 必真实)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ChangelogEntry {
  version: string;
  buildDate: string; // YYYY-MM-DD
  summary: string; // 一句话总结
  highlights: string[]; // 3-5 条要点
  type?: 'major' | 'minor' | 'patch'; // 1类=patch / 2类=minor / 3类=major
}

const DEFAULT_ENTRY: ChangelogEntry = {
  version: '0.0.0',
  buildDate: '1970-01-01',
  summary: '初始版本',
  highlights: [],
  type: 'patch',
};

let _cache: { entries: Map<string, ChangelogEntry>; latestVersion: string } | null = null;

/**
 * S72 batch 16 v3.0.45 BUG-115 缓存方案 A.7.1 修法: loadChangelog 改为返 { entries: Map, latestVersion: string }
 * 让 /api/version 响应可以返回 latestVersion 字段 (跟 APP_VERSION 区分)
 * 跨项目通用铁律: latestVersion 是 changelog.json 的 latest_version 字段 (反映历史最新), version 是 server 当前
 * 一般情况两者一致, 但调试 / 灰度 / 测试时可能不一样
 */
export function loadChangelog(): { entries: Map<string, ChangelogEntry>; latestVersion: string } {
  if (_cache) return _cache;

  // 兼容 4 种路径: dist root (deploy.sh SOP, S72 batch 4 修) + dist/shared + src/shared + cwd
  // S72 batch 4 修: 加 dist/changelog.json 优先, 避免部署后还要 scp 根 changelog.json
  // 之前只读 dist/../changelog.json = /www/wwwroot/shipin-APP/changelog.json (根), 部署漏更新
  const candidates = [
    join(__dirname, '../changelog.json'),    // dist/shared/changelog.js → dist/changelog.json (deploy.sh SOP)
    join(__dirname, '../../changelog.json'), // src/shared/changelog.ts → src/changelog.json (tsx 跑, dev)
    join(__dirname, '../../dist/changelog.json'), // src/... 跑时 dist root (罕见)
    join(process.cwd(), 'changelog.json'),   // pm2 / systemd 启动时 cwd=/www/wwwroot/shipin-APP
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8');
        const data = JSON.parse(raw) as { entries: ChangelogEntry[]; latest_version?: string };
        const map = new Map<string, ChangelogEntry>();
        for (const e of data.entries ?? []) {
          map.set(e.version, e);
        }
        _cache = {
          entries: map,
          latestVersion: data.latest_version || (data.entries?.[0]?.version ?? DEFAULT_ENTRY.version),
        };
        console.log(`[changelog] loaded ${map.size} entries (latest=${_cache.latestVersion}) from ${path}`);
        return _cache;
      } catch (err) {
        console.warn(`[changelog] failed to parse ${path}:`, err);
      }
    }
  }

  console.warn('[changelog] no changelog.json found, using DEFAULT_ENTRY');
  _cache = { entries: new Map([[DEFAULT_ENTRY.version, DEFAULT_ENTRY]]), latestVersion: DEFAULT_ENTRY.version };
  return _cache;
}

// 兼容老调用方: loadChangelog() 之前返 Map, 现在返 { entries, latestVersion }
// 加一个 helper 让 readChangelog 内部仍按 Map 找
function _entriesMap(): Map<string, ChangelogEntry> {
  return loadChangelog().entries;
}

export function readChangelog(version: string): ChangelogEntry {
  const map = _entriesMap();
  return (
    map.get(version) ?? {
      ...DEFAULT_ENTRY,
      version,
      summary: '本次更新优化性能，修复已知问题',
      highlights: [],
    }
  );
}

export function listChangelog(): ChangelogEntry[] {
  const map = _entriesMap();
  return Array.from(map.values()).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
}
