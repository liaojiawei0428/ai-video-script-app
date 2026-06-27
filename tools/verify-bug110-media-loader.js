// tools/verify-bug110-media-loader.js (v3.0.43 Stage 3 验证)
// 验证 GeneratingLoader + useMediaLoader 跨端 1:1 镜像 (跟 Stage 1+2 同 8 维风格)
// 不依赖 RN runtime, 在 Node 里跑算法 + 文件结构验证

const assert = require('assert');
const fs = require('fs');

const ROOT = 'F:/QiTa/banmu/APP/ai-video-script-app';

function readFile(p) {
  return fs.readFileSync(p, 'utf-8');
}
function exists(p) {
  return fs.existsSync(p);
}

const cases = [
  {
    name: '1. GeneratingLoader 跨端文件存在 (web + mobile 1:1)',
    fn: () => {
      const webPath = `${ROOT}/apps/web/src/components/ui/generating-loader.tsx`;
      const mobilePath = `${ROOT}/apps/mobile/src/components/ui/GeneratingLoader.tsx`;
      assert.strictEqual(exists(webPath), true, 'web GeneratingLoader 必须存在');
      assert.strictEqual(exists(mobilePath), true, 'mobile GeneratingLoader 必须存在');
      return `web + mobile 都存在 ✓`;
    },
  },
  {
    name: '2. useMediaLoader 跨端 hook 文件存在 (封装 useCachedMedia + 4 态 + retry)',
    fn: () => {
      const webPath = `${ROOT}/apps/web/src/hooks/useMediaLoader.ts`;
      const mobilePath = `${ROOT}/apps/mobile/src/hooks/useMediaLoader.ts`;
      assert.strictEqual(exists(webPath), true, 'web useMediaLoader 必须存在');
      assert.strictEqual(exists(mobilePath), true, 'mobile useMediaLoader 必须存在');
      return `web + mobile 都存在 ✓`;
    },
  },
  {
    name: '3. useMediaLoader 跨端 API 1:1 (返回 {source, state, error, retry, refresh, onLoaded, retryCount})',
    fn: () => {
      const web = readFile(`${ROOT}/apps/web/src/hooks/useMediaLoader.ts`);
      const mobile = readFile(`${ROOT}/apps/mobile/src/hooks/useMediaLoader.ts`);
      // 验证返回字段全部在两端都导出
      ['source', 'state', 'error', 'retry', 'refresh', 'onLoaded', 'retryCount'].forEach((field) => {
        assert.match(web, new RegExp(field + '\\b'), `web 必须导出 ${field}`);
        assert.match(mobile, new RegExp(field + '\\b'), `mobile 必须导出 ${field}`);
      });
      return `7 个字段 web + mobile 都有 ✓`;
    },
  },
  {
    name: '4. 4 态 type 一致 (idle/loading/ready/error 跨端 1:1)',
    fn: () => {
      const web = readFile(`${ROOT}/apps/web/src/hooks/useMediaLoader.ts`);
      const mobile = readFile(`${ROOT}/apps/mobile/src/hooks/useMediaLoader.ts`);
      // MediaState type 定义
      assert.match(web, /MediaState.*=.*'idle'.*'loading'.*'ready'.*'error'/, 'web MediaState 必须 4 态');
      assert.match(mobile, /MediaState.*=.*'idle'.*'loading'.*'ready'.*'error'/, 'mobile MediaState 必须 4 态');
      return `4 态跨端 1:1 ✓`;
    },
  },
  {
    name: '5. MAX_RETRIES 阈值一致 (web + mobile 都 3)',
    fn: () => {
      const web = readFile(`${ROOT}/apps/web/src/hooks/useMediaLoader.ts`);
      const mobile = readFile(`${ROOT}/apps/mobile/src/hooks/useMediaLoader.ts`);
      assert.match(web, /MAX_RETRIES\s*=\s*3/, 'web MAX_RETRIES 必须 = 3');
      assert.match(mobile, /MAX_RETRIES\s*=\s*3/, 'mobile MAX_RETRIES 必须 = 3');
      return `MAX_RETRIES = 3 跨端 1:1 ✓`;
    },
  },
  {
    name: '6. 集成 ScriptDetailScreen (mobile) + ScriptDetailPage (web) 用 GeneratingLoader',
    fn: () => {
      const mobileScreen = readFile(`${ROOT}/apps/mobile/src/screens/ScriptDetailScreen.tsx`);
      const webPage = readFile(`${ROOT}/apps/web/src/pages/ScriptDetailPage.tsx`);
      assert.match(mobileScreen, /import.*GeneratingLoader/, 'mobile ScriptDetailScreen 必须 import GeneratingLoader');
      assert.match(mobileScreen, /<GeneratingLoader/, 'mobile ScriptDetailScreen 必须用 <GeneratingLoader />');
      assert.match(webPage, /import.*GeneratingLoader/, 'web ScriptDetailPage 必须 import GeneratingLoader');
      assert.match(webPage, /<GeneratingLoader/, 'web ScriptDetailPage 必须用 <GeneratingLoader />');
      return `mobile + web ScriptDetail 都集成 ✓`;
    },
  },
  {
    name: '7. CSS spinner + Animated spinner 1:1 风格 (1s 周期 + 蓝色 + 轨道)',
    fn: () => {
      const web = readFile(`${ROOT}/apps/web/src/components/ui/generating-loader.tsx`);
      const mobile = readFile(`${ROOT}/apps/mobile/src/components/ui/GeneratingLoader.tsx`);
      // web: animation-duration: 1s + border-t-blue-500
      assert.match(web, /animationDuration:\s*'1s'/, 'web spinner 必须 1s 周期');
      assert.match(web, /border-t-blue-500/, 'web spinner 必须 border-top 蓝色');
      // mobile: duration: 1000 + borderTopColor: #3b82f6 (跟 web border-t-blue-500 等价)
      assert.match(mobile, /duration:\s*1000/, 'mobile spinner 必须 1000ms 周期');
      assert.match(mobile, /borderTopColor:\s*'#3b82f6'/, 'mobile spinner 必须 borderTopColor 蓝色');
      return `1s 周期 + 蓝色 跨端 1:1 ✓`;
    },
  },
  {
    name: '8. components/ui/index.ts 跨端 barrel export GeneratingLoader (跨端铁律 4++)',
    fn: () => {
      const webIndex = readFile(`${ROOT}/apps/web/src/components/ui/index.ts`);
      const mobileIndex = readFile(`${ROOT}/apps/mobile/src/components/ui/index.ts`);
      assert.match(webIndex, /export.*GeneratingLoader.*from.*generating-loader/, 'web index 必须 export GeneratingLoader');
      assert.match(mobileIndex, /export.*GeneratingLoader.*from.*GeneratingLoader/, 'mobile index 必须 export GeneratingLoader');
      return `web + mobile barrel export 都 OK ✓`;
    },
  },
];

// === 跑测试 ===
let pass = 0, fail = 0;
for (const c of cases) {
  console.log('\n=== ' + c.name + ' ===');
  try {
    const out = c.fn();
    console.log('  ✅ PASS — ' + out);
    pass++;
  } catch (e) {
    console.log('  ❌ FAIL — ' + e.message);
    fail++;
  }
}

console.log('\n' + '='.repeat(50));
console.log('PASS: ' + pass + ' / ' + cases.length);
console.log('FAIL: ' + fail);
console.log('='.repeat(50));
console.log('\n📋 跨端铁律 4++ 镜像验证: Stage 3 GeneratingLoader + useMediaLoader web + mobile 1:1, 4 态 / MAX_RETRIES / 1s 周期 / 蓝色一致');
process.exit(fail > 0 ? 1 : 0);