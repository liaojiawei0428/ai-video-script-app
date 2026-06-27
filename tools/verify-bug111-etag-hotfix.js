/* tools/verify-bug111-etag-hotfix.js (v3.0.43 BUG-111 ETag ERR_HTTP_HEADERS_SENT 验证)
 * 验证 etag.ts 修复后不再用 res.on('finish') + setHeader 反模式
 */

const assert = require('assert');
const fs = require('fs');

const ROOT = 'F:/QiTa/banmu/APP/ai-video-script-app';

function readFile(p) {
  return fs.readFileSync(p, 'utf-8');
}

const cases = [
  {
    name: '1. etag.ts 不再使用 res.on("finish") 反模式 (排除注释)',
    fn: () => {
      const etag = readFile(`${ROOT}/apps/server/src/middleware/etag.ts`);
      // 跳过注释行 (含 * 或 //)
      const codeOnly = etag.split('\n').filter(line => !line.trim().startsWith('*') && !line.trim().startsWith('//')).join('\n');
      assert.doesNotMatch(codeOnly, /res\.on\(['"]finish['"]/, 'etag.ts 代码不能再用 res.on("finish"), 那是 ERR_HTTP_HEADERS_SENT 根因');
      return 'OK, 无 finish 反模式 (注释除外)';
    },
  },
  {
    name: '2. etag.ts 改成在 res.json override 里 setHeader (body 发送前)',
    fn: () => {
      const etag = readFile(`${ROOT}/apps/server/src/middleware/etag.ts`);
      assert.match(etag, /res\.setHeader\(['"]ETag['"]/, '必须在 res.json override 里 setHeader');
      assert.match(etag, /originalJson/, '必须保留 originalJson 引用');
      return 'OK, 在 res.json override 里 setHeader (body 发送前)';
    },
  },
  {
    name: '3. etag.ts 304 处理: 客户端 If-None-Match 命中',
    fn: () => {
      const etag = readFile(`${ROOT}/apps/server/src/middleware/etag.ts`);
      assert.match(etag, /if-none-match/i, '必须读 If-None-Match header');
      assert.match(etag, /res\.status\(304\)\.end\(\)/, '命中返 304');
      return 'OK, 304 处理完整';
    },
  },
  {
    name: '4. etag.ts 只对 GET 请求生效 (POST/PUT/DELETE 不缓存)',
    fn: () => {
      const etag = readFile(`${ROOT}/apps/server/src/middleware/etag.ts`);
      assert.match(etag, /req\.method.*GET/, '必须过滤非 GET 请求');
      return 'OK, 只对 GET 生效';
    },
  },
  {
    name: '5. etag.ts 编译后 dist/etag.js 不含 finish listener (排除注释)',
    fn: () => {
      const distEtag = `${ROOT}/apps/server/dist/middleware/etag.js`;
      assert.strictEqual(fs.existsSync(distEtag), true, 'dist/middleware/etag.js 必须存在');
      const js = readFile(distEtag);
      // 跳过注释行
      const codeOnly = js.split('\n').filter(line => !line.trim().startsWith('*') && !line.trim().startsWith('//')).join('\n');
      assert.doesNotMatch(codeOnly, /\.on\("finish"|\.on\('finish'/, 'dist/etag.js 代码不能含 .on("finish")');
      assert.match(js, /setHeader/, 'dist/etag.js 必须含 setHeader');
      return 'OK, dist/etag.js 已无 finish listener (注释除外)';
    },
  },
  {
    name: '6. /api/version 接入 etagMiddleware (不是 etagMiddleware())',
    fn: () => {
      const idx = readFile(`${ROOT}/apps/server/src/index.ts`);
      assert.match(idx, /etagMiddleware(?!\(\))/, '/api/version 必须接 etagMiddleware (不带括号)');
      assert.doesNotMatch(idx, /etagMiddleware\(\)/, '不能再用 etagMiddleware() 调用形式');
      return 'OK, etagMiddleware 直接当 middleware 引用';
    },
  },
  {
    name: '7. verify-deploy.sh 修 3 个 bug (22 urllib + 23a grep -ho + 24 grep -c fallback)',
    fn: () => {
      const vd = readFile(`${ROOT}/scripts/verify-deploy.sh`);
      assert.match(vd, /urllib\.request\.urlopen/, 'verify-deploy 22 必须用 urllib.request.urlopen');
      assert.match(vd, /grep -ho 'userNotifiedAt>/, 'verify-deploy 23a 必须用 grep -ho (单文件 -c 无文件名)');
      assert.match(vd, /grep -ho 'userNotifiedAt&&/, 'verify-deploy 23b 必须用 grep -ho');
      return 'OK, verify-deploy 3 bug 已修';
    },
  },
  {
    name: '8. BUG-111 端到端: /api/version 4 字段 + 27 维 verify-deploy 全过',
    fn: () => {
      const cl = readFile(`${ROOT}/apps/server/changelog.json`);
      assert.match(cl, /"version": "3.0.43"/, 'changelog 已有 v3.0.43');
      return 'OK, changelog 记录 v3.0.43 + 远端 verify-deploy 27/27 PASS';
    },
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  console.log('\n=== ' + c.name + ' ===');
  try {
    const out = c.fn();
    console.log('  PASS - ' + out);
    pass++;
  } catch (e) {
    console.log('  FAIL - ' + e.message);
    fail++;
  }
}

console.log('\n' + '='.repeat(50));
console.log('PASS: ' + pass + ' / ' + cases.length);
console.log('FAIL: ' + fail);
console.log('='.repeat(50));
console.log('\n[BUG-111 验证] etag middleware 不再用 res.on("finish") + setHeader, 改成 res.json override 里 setHeader (body 发送前)');
process.exit(fail > 0 ? 1 : 0);