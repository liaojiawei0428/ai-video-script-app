#!/usr/bin/env node
/**
 * server-only hotfix 检测器 (项目宪法 RELEASE_CHECKLIST.md § 10 配套)
 *
 * 🆕 2026-07-07 S84 (v3.0.100 BUG-177 后续): v3.0.99 BUG-176 实战违反教训
 *   实战违反: 改 server src/ 一文件, 没 bump mobile version.ts + 没 rebuild APK
 *   触发: v3.0.100 BUG-177 强制升级 modal 永远弹死锁
 *
 * 修法 (本工具): 检测"改了 server/ 但没 bump mobile version.ts"这种危险场景
 *
 * 用法:
 *   node tools/check-server-only-hotfix.js          # 默认跟最新一次 commit
 *   node tools/check-server-only-hotfix.js HEAD~3   # 跟最近 3 次 commit
 *   node tools/check-server-only-hotfix.js <commit> # 跟指定 commit
 *
 * 退出码:
 *   0 = ✓ (server 改动 + mobile bump 1:1 对齐, 安全)
 *   1 = ⚠️ 高危! server 改动但 mobile 版本号没 bump (v3.0.99 BUG-176 反例)
 *   2 = 错误 (工具使用错误)
 */

const { execSync } = require('child_process');
const fs = require('fs');

const COMPARE_TARGET = process.argv[2] || 'HEAD~1';  // 默认跟 HEAD~1 比 (上一次 commit)

console.log('═══════════════════════════════════════════════════════════════');
console.log('🆕 server-only hotfix 检测器 (RELEASE_CHECKLIST.md § 10)');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`比较目标: ${COMPARE_TARGET}`);
console.log('');

// ═══════════════════════════════════════════════════════════
// 1. 检查 server 端是否改动
// ═══════════════════════════════════════════════════════════
function getChangedFiles(target) {
  try {
    const out = execSync(`git diff --name-only ${target} HEAD`, { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch (e) {
    console.error(`❌ git diff ${target} HEAD 失败: ${e.message}`);
    process.exit(2);
  }
}

const changedFiles = getChangedFiles(COMPARE_TARGET);
console.log(`本次 commit 改了 ${changedFiles.length} 个文件:`);
changedFiles.forEach(f => console.log(`  - ${f}`));
console.log('');

const serverChanged = changedFiles.some(f => f.startsWith('apps/server/src/') || f.startsWith('apps/server/ecosystem.config.js'));
const mobileVersionChanged = changedFiles.some(f =>
  f === 'apps/mobile/src/config/version.ts' ||
  f === 'apps/mobile/android/app/build.gradle' ||
  f === 'apps/web/src/config/version.ts'
);
const serverVersionChanged = changedFiles.some(f =>
  f === 'apps/server/package.json' ||
  f === 'apps/server/src/index.ts' ||
  f === 'apps/server/ecosystem.config.js'
);
const changelogChanged = changedFiles.some(f => f === 'apps/server/changelog.json');
const publicChanged = changedFiles.some(f => f.includes('/public/') || f.includes('DeepScript_v'));

// ═══════════════════════════════════════════════════════════
// 2. 输出检查结果
// ═══════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════════');
console.log('检查结果');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`server 端 src/ 改动:        ${serverChanged ? '✓ 是' : '✗ 否'}`);
console.log(`mobile version.ts 改动:      ${mobileVersionChanged ? '✓ 是' : '✗ 否'}`);
console.log(`server version 改动:         ${serverVersionChanged ? '✓ 是' : '✗ 否'}`);
console.log(`changelog.json 改动:         ${changelogChanged ? '✓ 是' : '✗ 否'}`);
console.log(`公网 APK 文件改动 (git diff 外的): ${publicChanged ? '✓ 是' : '✗ 否'}`);
console.log('');

// ═══════════════════════════════════════════════════════════
// 3. 检查 server-only hotfix 危险场景
// ═══════════════════════════════════════════════════════════
const isDangerous = serverChanged && !mobileVersionChanged;

if (serverChanged) {
  console.log('⏵ 场景: server 端有改动');
  if (mobileVersionChanged) {
    console.log('  ✓ 配套 mobile version.ts bump (兼容 server bump → mobile bump)');
  } else {
    console.log('  ⚠️  危险! mobile version.ts / build.gradle 没动');
    console.log('  这是 v3.0.99 BUG-176 实战违反场景 (server-only hotfix 没 rebuild APK)');
    console.log('  修法: 必跑 RELEASE_CHECKLIST.md § 10 情况 A "server-only hotfix 必做清单":');
    console.log('    □ bump mobile version.ts (即使 mobile 0 业务变化, versionCode 也必 +1)');
    console.log('    □ rebuild mobile APK (./gradlew assembleRelease)');
    console.log('    □ scp APK 到公网 /www/wwwroot/shipin-APP/public/DeepScript_v{新}.apk');
    console.log('    □ 必走完整 apps/server/deploy.sh (非手动 ssh + sed + restart)');
  }
  console.log('');
}

// ═══════════════════════════════════════════════════════════
// 4. 8 处版本号同步自检 (跟 verify-version-8-points.js 配套)
// ═══════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════════');
console.log('8 处版本号同步自检');
console.log('═══════════════════════════════════════════════════════════════');

// 读 server package.json 作为基准
let newVer = '';
try {
  newVer = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8')).version;
} catch (e) {
  console.log('⚠️ 读 apps/server/package.json 失败');
}

if (newVer) {
  console.log(`目标 version: ${newVer}`);
  const checks = [
    ['mobile version.ts', 'apps/mobile/src/config/version.ts', new RegExp(`APP_VERSION = '${newVer.replace(/\./g, '\\.')}'`)],
    ['mobile build.gradle', 'apps/mobile/android/app/build.gradle', new RegExp(`versionName "${newVer.replace(/\./g, '\\.')}"`)],
    ['server package.json', 'apps/server/package.json', new RegExp(`"version": "${newVer.replace(/\./g, '\\.')}"`)],
    ['server index.ts', 'apps/server/src/index.ts', new RegExp(`'${newVer.replace(/\./g, '\\.')}'`)],
    ['server ecosystem.config.js', 'apps/server/ecosystem.config.js', new RegExp(`APP_VERSION: '${newVer.replace(/\./g, '\\.')}'`)],
  ];
  let failCount = 0;
  for (const [name, path, re] of checks) {
    if (!fs.existsSync(path)) {
      console.log(`  ✗ ${name}: ${path} NOT EXISTS`);
      failCount++;
      continue;
    }
    const content = fs.readFileSync(path, 'utf8');
    const ok = re.test(content);
    if (!ok) failCount++;
    console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  }
  if (failCount > 0) {
    console.log('');
    console.log(`❌ ${failCount} 处版本号不匹配目标 ${newVer}`);
    console.log(`   修法: RELEASE_CHECKLIST.md § 4 8 处版本号同步清单`);
    process.exit(1);
  }
  console.log('');
  console.log(`✓ 8 处版本号同步 (local 5 处 + 远程 2 处由 deploy.sh 自动同步 + changelog)`);
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('最终判断');
console.log('═══════════════════════════════════════════════════════════════');

if (isDangerous) {
  console.log('');
  console.log('❌ FAIL - server-only hotfix 高危场景');
  console.log('');
  console.log('   server 改了 src/ 但 mobile 版本号没 bump → v3.0.99 BUG-176 反例');
  console.log('   deploy.sh § 6.6 1:1 abort 会在部署阶段强拦截, 但已经被 commit 到 git');
  console.log('');
  console.log('   必须修法 (按 RELEASE_CHECKLIST.md § 10 情况 A):');
  console.log('     1. bump mobile version.ts (versionCode +1)');
  console.log('     2. rebuild mobile APK');
  console.log('     3. 加到本次 commit (amend) 或新 commit');
  console.log('     4. 重跑 node tools/check-server-only-hotfix.js 直到 PASS');
  console.log('');
  process.exit(1);
} else if (serverChanged || mobileVersionChanged) {
  console.log('');
  console.log('✓ PASS - 改动安全');
  console.log('');
  console.log('   server 改动 + mobile 版本号 bump 1:1 对齐 (或 mobile 改动)');
  console.log('   必跑 deploy.sh (RELEASE_CHECKLIST.md § 8)');
  console.log('   deploy.sh § 6.6 1:1 abort 会做最终强校验');
  console.log('');
  process.exit(0);
} else {
  console.log('');
  console.log('⚠ SKIP - 本次 commit 没有 server/mobile 改动');
  console.log('');
  process.exit(0);
}
