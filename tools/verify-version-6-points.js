const fs = require('fs');

console.log('=== build.gradle 验证 ===');
const s = fs.readFileSync('apps/mobile/android/app/build.gradle', 'utf8');
const vc = s.match(/versionCode\s+(\d+)/);
const vn = s.match(/versionName\s+"([^"]+)"/);
console.log('versionCode:', vc ? vc[1] : 'NOT FOUND');
console.log('versionName:', vn ? vn[1] : 'NOT FOUND');

console.log('\n=== 6 处版本号同步自检 ===');
const checks = [
  ['mobile version.ts', 'apps/mobile/src/config/version.ts', /APP_VERSION = '3\.0\.33'/],
  ['mobile build.gradle name', 'apps/mobile/android/app/build.gradle', /versionName "3\.0\.33"/],
  ['mobile build.gradle code', 'apps/mobile/android/app/build.gradle', /versionCode 38/],
  ['server package.json', 'apps/server/package.json', /"version": "3\.0\.33"/],
  ['server src/index.ts', 'apps/server/src/index.ts', /'3\.0\.33'/],
  ['server ecosystem config', 'apps/server/ecosystem.config.js', /APP_VERSION: '3\.0\.33'/],
  ['web version.ts', 'apps/web/src/config/version.ts', /APP_VERSION = '3\.0\.33'/],
  ['web version.ts code', 'apps/web/src/config/version.ts', /APP_VERSION_CODE = 37/],
];
let allOK = true;
for (const [name, path, re] of checks) {
  const content = fs.readFileSync(path, 'utf8');
  const ok = re.test(content);
  if (!ok) allOK = false;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name + ': ' + path);
}
console.log('\n=== 残留 3.0.32 检查 (应为空) ===');
const files = [
  'apps/mobile/src/config/version.ts',
  'apps/mobile/android/app/build.gradle',
  'apps/server/package.json',
  'apps/server/src/index.ts',
  'apps/server/ecosystem.config.js',
  'apps/web/src/config/version.ts',
];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/3\.0\.32/g);
  console.log('  ' + f + ': 3.0.32 出现 ' + (matches ? matches.length : 0) + ' 次');
}

console.log('\n=== changelog.json 验证 ===');
const cl = JSON.parse(fs.readFileSync('apps/server/changelog.json', 'utf8'));
const last = cl.entries[cl.entries.length - 1];
console.log('  最后一段: version=' + last.version + ' date=' + last.buildDate + ' summary=' + last.summary);

process.exit(allOK ? 0 : 1);
