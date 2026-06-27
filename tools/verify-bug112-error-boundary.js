#!/usr/bin/env node
/**
 * verify-bug112-error-boundary.js
 *
 * BUG-112 角色库白屏修法 8 维验证 (跨端铁律 4++)
 *
 * 验证维度:
 * 1. ErrorBoundary mobile 文件存在 + 关键 API (static getDerivedStateFromError + componentDidCatch)
 * 2. ErrorBoundary web 文件存在 + 跟 mobile 1:1 API 镜像
 * 3. ErrorBoundary wrap 集成 (mobile App.tsx Stack.Screen + web App.tsx Route)
 * 4. useCachedMedia 加固 (mobile + web safeSetSource + try/catch 兜底)
 * 5. load() 加 3s 超时 (mobile CharacterDetailScreen + web CharacterDetailPage)
 * 6. 跨端铁律 4++ (mobile + web ErrorBoundary API 1:1 镜像, dev console.error 都启用)
 * 7. ErrorBoundary fallback UI (⚠️ 出错了 + 重试按钮 + 跨端文案一致)
 * 8. ErrorBoundary import 接入 (mobile components/index.ts export + web components/ui/index.ts export)
 *
 * 跑法: node tools/verify-bug112-error-boundary.js
 * 期望: PASS: 8 / FAIL: 0
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOBILE = path.join(ROOT, 'apps', 'mobile');
const WEB = path.join(ROOT, 'apps', 'web');

const results = [];
function check(name, condition, detail = '') {
  const status = condition ? '✅ PASS' : '❌ FAIL';
  results.push({ name, status, detail });
  console.log(`${status} | ${name}${detail ? ' — ' + detail : ''}`);
}

// ============================================================
// 维度 1: ErrorBoundary mobile 文件 + 关键 API
// ============================================================
const mobileEB = path.join(MOBILE, 'src', 'components', 'ErrorBoundary.tsx');
const mobileEBContent = fs.existsSync(mobileEB) ? fs.readFileSync(mobileEB, 'utf8') : '';
check(
  '1. ErrorBoundary mobile 文件存在 + 关键 API',
  mobileEBContent.includes('static getDerivedStateFromError')
    && mobileEBContent.includes('componentDidCatch')
    && mobileEBContent.includes('Props')
    && mobileEBContent.includes('State'),
  mobileEBContent ? `${mobileEB.length} bytes` : 'NOT FOUND'
);

// ============================================================
// 维度 2: ErrorBoundary web 文件 + 跟 mobile 1:1 API
// ============================================================
const webEB = path.join(WEB, 'src', 'components', 'ui', 'error-boundary.tsx');
const webEBContent = fs.existsSync(webEB) ? fs.readFileSync(webEB, 'utf8') : '';
check(
  '2. ErrorBoundary web 文件存在 + 跟 mobile 1:1 API',
  webEBContent.includes('static getDerivedStateFromError')
    && webEBContent.includes('componentDidCatch')
    && webEBContent.includes('Props')
    && webEBContent.includes('State')
    && webEBContent.includes('onReset'),
  webEBContent ? `${webEB.length} bytes` : 'NOT FOUND'
);

// ============================================================
// 维度 3: ErrorBoundary wrap 集成
// ============================================================
const mobileApp = fs.existsSync(path.join(MOBILE, 'App.tsx')) ? fs.readFileSync(path.join(MOBILE, 'App.tsx'), 'utf8') : '';
const webApp = fs.existsSync(path.join(WEB, 'src', 'App.tsx')) ? fs.readFileSync(path.join(WEB, 'src', 'App.tsx'), 'utf8') : '';
check(
  '3. ErrorBoundary wrap 集成 (mobile App.tsx Stack.Screen + web App.tsx Route)',
  mobileApp.includes('CharacterDetailScreenWithBoundary')
    && webApp.includes('ErrorBoundary')
    && webApp.includes('CharacterDetailPage'),
  `mobile: ${mobileApp.includes('CharacterDetailScreenWithBoundary') ? 'WithBoundary' : 'MISSING'}, web: ${webApp.includes('ErrorBoundary') ? 'WRAPPED' : 'MISSING'}`
);

// ============================================================
// 维度 4: useCachedMedia 加固
// ============================================================
const mobileCM = fs.existsSync(path.join(MOBILE, 'src', 'hooks', 'useCachedMedia.ts')) ? fs.readFileSync(path.join(MOBILE, 'src', 'hooks', 'useCachedMedia.ts'), 'utf8') : '';
const webCM = fs.existsSync(path.join(WEB, 'src', 'hooks', 'useCachedMedia.ts')) ? fs.readFileSync(path.join(WEB, 'src', 'hooks', 'useCachedMedia.ts'), 'utf8') : '';
check(
  '4. useCachedMedia 加固 (safeSetSource + try/catch 兜底)',
  mobileCM.includes('safeSetSource')
    && mobileCM.includes('BUG-112')
    && webCM.includes('safeSetSource')
    && webCM.includes('BUG-112'),
  `mobile: ${mobileCM.includes('safeSetSource') ? 'OK' : 'MISSING'}, web: ${webCM.includes('safeSetSource') ? 'OK' : 'MISSING'}`
);

// ============================================================
// 维度 5: load() 加 3s 超时
// ============================================================
const mobileScreen = fs.existsSync(path.join(MOBILE, 'src', 'screens', 'CharacterDetailScreen.tsx')) ? fs.readFileSync(path.join(MOBILE, 'src', 'screens', 'CharacterDetailScreen.tsx'), 'utf8') : '';
const webPage = fs.existsSync(path.join(WEB, 'src', 'pages', 'CharacterDetailPage.tsx')) ? fs.readFileSync(path.join(WEB, 'src', 'pages', 'CharacterDetailPage.tsx'), 'utf8') : '';
check(
  '5. load() 加 3s 超时 (mobile + web)',
  mobileScreen.includes('timeoutPromise')
    && mobileScreen.includes('3000')
    && webPage.includes('timeoutPromise')
    && webPage.includes('3000'),
  `mobile: ${mobileScreen.includes('3000') ? '3000ms' : 'MISSING'}, web: ${webPage.includes('3000') ? '3000ms' : 'MISSING'}`
);

// ============================================================
// 维度 6: 跨端铁律 4++ (API 1:1 镜像 + dev console.error)
// ============================================================
const mobileHasDevLog = mobileEBContent.includes('__DEV__') && mobileEBContent.includes('console.error');
const webHasDevLog = webEBContent.includes('import.meta.env.DEV') && webEBContent.includes('console.error');
check(
  '6. 跨端铁律 4++ (mobile __DEV__ + web import.meta.env.DEV, console.error 都启用)',
  mobileHasDevLog && webHasDevLog,
  `mobile dev console: ${mobileHasDevLog ? 'OK' : 'MISSING'}, web dev console: ${webHasDevLog ? 'OK' : 'MISSING'}`
);

// ============================================================
// 维度 7: ErrorBoundary fallback UI (⚠️ 出错了 + 重试)
// ============================================================
const mobileHasFallbackUI = mobileEBContent.includes('出错了') && mobileEBContent.includes('重试');
const webHasFallbackUI = webEBContent.includes('出错了') && webEBContent.includes('重试');
check(
  '7. ErrorBoundary fallback UI (⚠️ 出错了 + 重试按钮, 跨端文案一致)',
  mobileHasFallbackUI && webHasFallbackUI,
  `mobile fallback: ${mobileHasFallbackUI ? 'OK' : 'MISSING'}, web fallback: ${webHasFallbackUI ? 'OK' : 'MISSING'}`
);

// ============================================================
// 维度 8: ErrorBoundary import 接入 (mobile components/index.ts export + web App.tsx import)
// ============================================================
const mobileIdx = fs.existsSync(path.join(MOBILE, 'src', 'components', 'index.ts')) ? fs.readFileSync(path.join(MOBILE, 'src', 'components', 'index.ts'), 'utf8') : '';
const mobileEBExported = mobileIdx.includes('ErrorBoundary');
const webEBImported = webApp.includes("import { ErrorBoundary }") || webApp.includes("from './components/ui/error-boundary'");
check(
  '8. ErrorBoundary import 接入 (mobile components/index.ts export + web App.tsx import)',
  mobileEBExported && webEBImported,
  `mobile export: ${mobileEBExported ? 'OK' : 'MISSING'}, web import: ${webEBImported ? 'OK' : 'MISSING'}`
);

// ============================================================
// 汇总
// ============================================================
const passed = results.filter(r => r.status.includes('PASS')).length;
const failed = results.filter(r => r.status.includes('FAIL')).length;
console.log('\n' + '='.repeat(60));
console.log(`汇总: PASS ${passed} / FAIL ${failed}`);
console.log('='.repeat(60));
process.exit(failed > 0 ? 1 : 0);