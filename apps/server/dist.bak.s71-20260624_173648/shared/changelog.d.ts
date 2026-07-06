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
export interface ChangelogEntry {
    version: string;
    buildDate: string;
    summary: string;
    highlights: string[];
    type?: 'major' | 'minor' | 'patch';
}
export declare function readChangelog(version: string): ChangelogEntry;
export declare function listChangelog(): ChangelogEntry[];
