#!/usr/bin/env node
/**
 * v3.0.46 BUG-116 缓存方案 B (ETag/304) 8 维验证脚本
 *
 * 验证 mobile + web 端 ETag/304 基础设施 + 接入 screens (跟 server etagMiddleware 配套)
 * 跟 shipin-APP 历史 verify 风格一致 (8 维)
 * 跟 verify-cache-local-data.js (A.6) 配套
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
let fail = 0;
const fails = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    fails.push(name);
    console.log(`  ❌ ${name} - ${detail}`);
  }
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

console.log('===== v3.0.46 BUG-116 缓存方案 B (ETag/304) 8 维验证 =====\n');

// ── 维度 1: server 11 个 routes 加 etagMiddleware ──
console.log('维度 1: server 11 个 routes 加 etagMiddleware');
const idxTs = readFile(path.join(ROOT, 'apps/server/src/index.ts'));
check('1.1 /api/novels 加 etagMiddleware', idxTs.includes("app.use('/api/novels', etagMiddleware"));
check('1.2 /api/tasks 加 etagMiddleware', idxTs.includes("app.use('/api/tasks', etagMiddleware"));
check('1.3 /api/episodes 加 etagMiddleware', idxTs.includes("app.use('/api/episodes', etagMiddleware"));
check('1.4 /api/chat 加 etagMiddleware', idxTs.includes("app.use('/api/chat', etagMiddleware"));
check('1.5 /api/users 加 etagMiddleware', idxTs.includes("app.use('/api/users', etagMiddleware"));
check('1.6 /api/recharge 加 etagMiddleware', idxTs.includes("app.use('/api/recharge', etagMiddleware"));
check('1.7 /api/admin 加 etagMiddleware', idxTs.includes("app.use('/api/admin', etagMiddleware"));
check('1.8 /api/feedback 加 etagMiddleware', idxTs.includes("app.use('/api/feedback', etagMiddleware"));
check('1.9 /api/notifications 加 etagMiddleware', idxTs.includes("app.use('/api/notifications', etagMiddleware"));
check('1.10 /api (characters) 加 etagMiddleware', idxTs.includes("app.use('/api', etagMiddleware"));
check('1.11 /api/pricing 加 etagMiddleware', idxTs.includes("app.use('/api/pricing', etagMiddleware"));
check('1.12 /api/billing 加 etagMiddleware', idxTs.includes("app.use('/api/billing', etagMiddleware"));

// ── 维度 2: server etag.ts 仍然存在 + 304 处理 ──
console.log('\n维度 2: server etag.ts 仍然存在 + 304 处理');
const etagTs = readFile(path.join(ROOT, 'apps/server/src/middleware/etag.ts'));
check('2.1 etag.ts 文件存在', fs.existsSync(path.join(ROOT, 'apps/server/src/middleware/etag.ts')));
check('2.2 etag 算 SHA-256 前 16 hex', etagTs.includes('createHash'));
check('2.3 304 处理 (status(304).end)', etagTs.includes('res.status(304)'));
check('2.4 setHeader 必须在 res.json 之前 (BUG-111 修法)', etagTs.includes('res.json = function'));

// ── 维度 3: server /api/version 最新字段 (latestVersion + version) ──
console.log('\n维度 3: server /api/version latestVersion + version 字段');
check('3.1 /api/version 返 latestVersion 字段', idxTs.includes('latestVersion,'));
check('3.2 /api/version 返 version 字段', idxTs.includes('version: currentVersion'));

// ── 维度 4: mobile cache_meta 表 + cacheMeta.ts 工具 ──
console.log('\n维度 4: mobile cache_meta 表 + cacheMeta.ts 工具');
const sqliteTs = readFile(path.join(ROOT, 'apps/mobile/src/db/sqlite.ts'));
check('4.1 mobile sqlite.ts CREATE TABLE cache_meta', sqliteTs.includes('CREATE TABLE IF NOT EXISTS cache_meta'));
check('4.2 mobile cache_meta schema 含 url PRIMARY KEY', sqliteTs.includes('url TEXT PRIMARY KEY'));
check('4.3 mobile cache_meta schema 含 etag', sqliteTs.includes('etag TEXT NOT NULL'));
check('4.4 mobile cache_meta schema 含 body', sqliteTs.includes('body TEXT NOT NULL'));
check('4.5 mobile cacheMeta.ts 文件存在', fs.existsSync(path.join(ROOT, 'apps/mobile/src/db/cacheMeta.ts')));
const cacheMetaTs = readFile(path.join(ROOT, 'apps/mobile/src/db/cacheMeta.ts'));
check('4.6 mobile setCachedResponse 函数', cacheMetaTs.includes('export async function setCachedResponse('));
check('4.7 mobile getCachedETag 函数', cacheMetaTs.includes('export async function getCachedETag('));
check('4.8 mobile getCachedBody 函数', cacheMetaTs.includes('export async function getCachedBody('));

// ── 维度 5: mobile axios interceptor (If-None-Match + 304) ──
console.log('\n维度 5: mobile axios interceptor');
const clientTs = readFile(path.join(ROOT, 'apps/mobile/src/api/client.ts'));
check('5.1 mobile axios request interceptor 带 If-None-Match', clientTs.includes("config.headers['If-None-Match']"));
check('5.2 mobile axios response interceptor 200 存 ETag+body', clientTs.includes('setCachedResponse('));
check('5.3 mobile axios response interceptor 304 返 body', clientTs.includes('error?.response?.status === 304'));
check('5.4 mobile 304 返 x-cache: HIT-304 header', clientTs.includes("'x-cache': 'HIT-304'"));
check('5.5 mobile 跳过 POST/PUT/DELETE', clientTs.includes("method !== 'get'"));

// ── 维度 6: mobile 2 screens fromCache 检查 ──
console.log('\n维度 6: mobile 2 screens fromCache 检查');
const bookShelf = readFile(path.join(ROOT, 'apps/mobile/src/screens/BookshelfScreen.tsx'));
const charList = readFile(path.join(ROOT, 'apps/mobile/src/screens/CharacterListScreen.tsx'));
check('6.1 BookshelfScreen fromCache 检查', bookShelf.includes('HIT-304') && bookShelf.includes('fromCache'));
check('6.2 BookshelfScreen 304 → skip setState', bookShelf.includes('!fromCache'));
check('6.3 CharacterListScreen fromCache 检查', charList.includes('HIT-304') && charList.includes('fromCache'));

// ── 维度 7: web 端 axios interceptor + IndexedDB cache_meta (跟 mobile 1:1) ──
console.log('\n维度 7: web 端 axios interceptor + IndexedDB cache_meta 1:1');
const webApi = readFile(path.join(ROOT, 'apps/web/src/lib/api.ts'));
const webDb = readFile(path.join(ROOT, 'apps/web/src/db/indexedDb.ts'));
const webBook = readFile(path.join(ROOT, 'apps/web/src/pages/BookshelfPage.tsx'));
check('7.1 web api.ts request interceptor 带 If-None-Match', webApi.includes("config.headers['If-None-Match']"));
check('7.2 web api.ts response interceptor 200 存 ETag+body', webApi.includes('setCachedResponse('));
check('7.3 web api.ts response interceptor 304 返 body', webApi.includes('err?.response?.status === 304'));
check('7.4 web api.ts 304 返 x-cache: HIT-304 header', webApi.includes("'x-cache': 'HIT-304'"));
check('7.5 web IndexedDB cache_meta store 存在', webDb.includes("'cache_meta'"));
check('7.6 web IndexedDB setCachedResponse 函数', webDb.includes('export async function setCachedResponse('));
check('7.7 web IndexedDB getCachedETag 函数', webDb.includes('export async function getCachedETag('));
check('7.8 web IndexedDB getCachedBody 函数', webDb.includes('export async function getCachedBody('));
check('7.9 web BookshelfPage fromCache 检查', webBook.includes('HIT-304') && webBook.includes('fromCache'));

// ── 维度 8: 跨端铁律 4++ 1:1 镜像 ──
console.log('\n维度 8: 跨端铁律 4++ mobile + web axios interceptor 1:1');
// getCacheKey 逻辑 1:1 (mobile + web 都有 method check + URL 构造)
check('8.1 mobile getCacheKey method check', clientTs.includes("method !== 'get'"));
check('8.2 web getCacheKey method check', webApi.includes("method !== 'get'"));
// 304 构造 1:1 (status 200 + x-cache header)
check('8.3 mobile 304 构造 status=200', clientTs.includes('status: 200'));
check('8.4 web 304 构造 status=200', webApi.includes('status: 200'));
// response interceptor 401 处理跨端 1:1
check('8.5 mobile 401 处理', clientTs.includes('error?.response?.status === 401'));
check('8.6 web 401 处理', webApi.includes('err?.response?.status === 401'));

// ── 总结 ──
console.log('\n===== 总结 =====');
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (fail > 0) {
  console.log('\n失败项:');
  fails.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\n🎉 全部 8 维验证 PASS!');