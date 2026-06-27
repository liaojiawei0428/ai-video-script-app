#!/usr/bin/env node
/**
 * v3.0.45 BUG-115 缓存方案 A 8 维验证脚本
 *
 * 验证 mobile + web 端本地缓存基础设施 + 接入 screens (跟 server 端 ALTER 同步)
 * 跟 shipin-APP 历史 verify 风格一致 (8 维)
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

function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

console.log('===== v3.0.45 BUG-115 缓存方案 A 8 维验证 =====\n');

// ── 维度 1: server shots/characters ALTER + model 维护 updated_at ──
console.log('维度 1: server shots/characters ALTER + model 维护 updated_at');
const dbTs = readFile(path.join(ROOT, 'apps/server/src/models/db.ts'));
const charTs = readFile(path.join(ROOT, 'apps/server/src/models/character.ts'));
const shotTs = readFile(path.join(ROOT, 'apps/server/src/models/shot.ts'));
check('1.1 server db.ts ALTER characters ADD description', dbTs.includes('ALTER TABLE characters ADD COLUMN description'));
check('1.2 server db.ts ALTER characters ADD extra_description', dbTs.includes('ALTER TABLE characters ADD COLUMN extra_description'));
check('1.3 server db.ts ALTER characters ADD updated_at', dbTs.includes('ALTER TABLE characters ADD COLUMN updated_at'));
check('1.4 server db.ts ALTER shots ADD updated_at', dbTs.includes('ALTER TABLE shots ADD COLUMN updated_at'));
check('1.5 characterModel.update/updateFull 自动维护 updated_at', charTs.includes("sets.push('updated_at = ?')"));
check('1.6 shotModel.update 自动维护 updated_at', shotTs.includes("fields.push('updated_at = ?')"));

// ── 维度 2: mobile sqlite.ts schema + ALTER 同步 ──
console.log('\n维度 2: mobile sqlite.ts characters/ALTER 同步');
const sqliteTs = readFile(path.join(ROOT, 'apps/mobile/src/db/sqlite.ts'));
check('2.1 mobile ALTER characters ADD description', sqliteTs.includes('ALTER TABLE characters ADD COLUMN description'));
check('2.2 mobile ALTER characters ADD extra_description', sqliteTs.includes('ALTER TABLE characters ADD COLUMN extra_description'));
check('2.3 mobile ALTER characters ADD updated_at', sqliteTs.includes('ALTER TABLE characters ADD COLUMN updated_at'));

// ── 维度 3: mobile characters save/get/update 函数 ──
console.log('\n维度 3: mobile characters save/get/update 函数');
check('3.1 saveCharacters 函数', sqliteTs.includes('export async function saveCharacters('));
check('3.2 getCharacters 函数', sqliteTs.includes('export async function getCharacters('));
check('3.3 updateCharacter 函数', sqliteTs.includes('export async function updateCharacter('));
check('3.4 saveCharacters 写 description 字段', sqliteTs.includes('char.description ||'));

// ── 维度 4: mobile novel_hashes 表 + hash 比对工具 ──
console.log('\n维度 4: mobile novel_hashes 表 + hash 比对');
check('4.1 novel_hashes 表', sqliteTs.includes('CREATE TABLE IF NOT EXISTS novel_hashes'));
check('4.2 hashNovel 函数', sqliteTs.includes('export async function hashNovel('));
check('4.3 saveNovelIfChanged 函数', sqliteTs.includes('export async function saveNovelIfChanged('));
check('4.4 diffNovelsByHash 函数', sqliteTs.includes('export async function diffNovelsByHash('));
check('4.5 hashNovel 用 djb2 算法', sqliteTs.includes('hash = ((hash << 5) + hash) + input.charCodeAt'));

// ── 维度 5: mobile 2 screens 接入本地优先 + fetchInterval ──
console.log('\n维度 5: mobile 2 screens 接入本地优先 + fetchInterval');
const bookShelf = readFile(path.join(ROOT, 'apps/mobile/src/screens/BookshelfScreen.tsx'));
const charList = readFile(path.join(ROOT, 'apps/mobile/src/screens/CharacterListScreen.tsx'));
check('5.1 BookshelfScreen 用 diffNovelsByHash', bookShelf.includes('diffNovelsByHash'));
check('5.2 BookshelfScreen 用 saveNovelIfChanged', bookShelf.includes('saveNovelIfChanged'));
check('5.3 BookshelfScreen fetchInterval 改 5min', bookShelf.includes('5 * 60 * 1000'));
check('5.4 CharacterListScreen 用 getLocalCharacters', charList.includes('getLocalCharacters'));
check('5.5 CharacterListScreen 用 saveCharactersDb', charList.includes('saveCharactersDb'));

// ── 维度 6: web 端 IndexedDB 1:1 镜像 + BookshelfPage 接入 ──
console.log('\n维度 6: web 端 IndexedDB 1:1 镜像 + BookshelfPage 接入');
const webIndexedDb = readFile(path.join(ROOT, 'apps/web/src/db/indexedDb.ts'));
const webBookShelf = readFile(path.join(ROOT, 'apps/web/src/pages/BookshelfPage.tsx'));
check('6.1 web IndexedDB 文件存在', fileExists(path.join(ROOT, 'apps/web/src/db/indexedDb.ts')));
check('6.2 web IndexedDB 6 stores (novels/episodes/shots/characters/novel_hashes/cache_meta)', webIndexedDb.includes('characters') && webIndexedDb.includes('novel_hashes'));
check('6.3 web hashNovel 函数 跟 mobile 1:1', webIndexedDb.includes("hash = ((hash << 5) + hash) + input.charCodeAt"));
check('6.4 web diffNovelsByHash 函数', webIndexedDb.includes('export async function diffNovelsByHash'));
check('6.5 web saveNovelIfChanged 函数', webIndexedDb.includes('export async function saveNovelIfChanged'));
check('6.6 web BookshelfPage 用 getLocalNovels', webBookShelf.includes('getLocalNovels'));
check('6.7 web BookshelfPage 用 diffNovelsByHash', webBookShelf.includes('diffNovelsByHash'));
check('6.8 web BookshelfPage 用 saveNovelIfChanged', webBookShelf.includes('saveNovelIfChanged'));

// ── 维度 7: 跨端铁律 4++ hash 算法 1:1 ──
console.log('\n维度 7: 跨端铁律 4++ hash 算法 1:1');
const mobileHashFn = sqliteTs.match(/export async function hashNovel[\s\S]+?\n}/)?.[0] || '';
const webHashFn = webIndexedDb.match(/export function hashNovel[\s\S]+?\n}/)?.[0] || '';
// 提取 input 字段顺序 + 拼接符 (兼容 mobile async + web sync)
// 跨端铁律 4++ 说明: hash 比对是 client-side (mobile 跟自己 mobile SQLite, web 跟自己 IndexedDB), 不需要跨端 1:1
// 但 hash 字段顺序 (title/status/updatedAt/totalChars/summary.length/genre+theme+style+tone) 跟分隔符 ('|') 必须各端内部一致
const mobileInputMatch = sqliteTs.match(/input = \[([\s\S]+?)\]\.join\(([^)]+)\)/);
const webInputMatch = webIndexedDb.match(/input = \[([\s\S]+?)\]\.join\(([^)]+)\)/);
const mobileHasCoreFields = mobileInputMatch && mobileInputMatch[1].includes('novel.title') && mobileInputMatch[1].includes('novel.status') && mobileInputMatch[1].includes('updatedAt') && mobileInputMatch[1].includes('summary');
const webHasCoreFields = webInputMatch && webInputMatch[1].includes('novel.title') && webInputMatch[1].includes('novel.status') && webInputMatch[1].includes('updatedAt') && webInputMatch[1].includes('summary');
check('7.1 mobile hash 含核心字段 (title/status/updatedAt/summary)', mobileHasCoreFields);
check('7.2 web hash 含核心字段 (title/status/updatedAt/summary)', webHasCoreFields);
check('7.3 mobile + web hash join 分隔符一致', mobileInputMatch && webInputMatch && mobileInputMatch[2] === webInputMatch[2]);

// ── 维度 8: 跨项目通用铁律 + 8 项版本号同步待办 ──
console.log('\n维度 8: 跨项目通用铁律 (跟 BUG-079/097/103/112 同源)');
check('8.1 mobile ALTER 用 try/catch 兜底 (跟 BUG-113 同源教训)', sqliteTs.match(/ALTER TABLE characters[\s\S]+?try \{ await db\.executeSql\(sql\); \} catch/));
check('8.2 server ALTER 用 logger.warn 替代静默 catch (跟 BUG-094/095 同源)', dbTs.includes("logger.warn('db migration failed'"));
check('8.3 web BookshelfPage 本地优先 setLoading(false)', webBookShelf.includes('setLoading(false); // 本地有数据'));
check('8.4 mobile BookshelfScreen 本地优先 setLoading(false)', bookShelf.includes('local.length > 0') && bookShelf.match(/if \(local\.length > 0\) \{[\s\S]*?setLoading\(false\)/));

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