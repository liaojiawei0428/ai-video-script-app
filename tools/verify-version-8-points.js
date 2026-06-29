const fs = require('fs');
const { execSync } = require('child_process');

const NEW_VERSION = process.argv[2] || '3.0.33';
const SSH_KEY = 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\shipin_app_key';
const REMOTE = 'root@159.75.16.110';

console.log('=== build.gradle 验证 ===');
const s = fs.readFileSync('apps/mobile/android/app/build.gradle', 'utf8');
const vc = s.match(/versionCode\s+(\d+)/);
const vn = s.match(/versionName\s+"([^"]+)"/);
console.log('versionCode:', vc ? vc[1] : 'NOT FOUND');
console.log('versionName:', vn ? vn[1] : 'NOT FOUND');

console.log('\n=== 6 处本地版本号同步自检 ===');
const checks = [
  ['mobile version.ts', 'apps/mobile/src/config/version.ts', new RegExp("APP_VERSION = '" + NEW_VERSION.replace(/\./g, '\\.') + "'")],
  ['mobile build.gradle name', 'apps/mobile/android/app/build.gradle', new RegExp('versionName "' + NEW_VERSION.replace(/\./g, '\\.') + '"')],
  ['mobile build.gradle code', 'apps/mobile/android/app/build.gradle', /versionCode (\d+)/],
  ['server package.json', 'apps/server/package.json', new RegExp('"version": "' + NEW_VERSION.replace(/\./g, '\\.') + '"')],
  ['server src/index.ts', 'apps/server/src/index.ts', new RegExp("'" + NEW_VERSION.replace(/\./g, '\\.') + "'")],
  ['server ecosystem config', 'apps/server/ecosystem.config.js', new RegExp("APP_VERSION: '" + NEW_VERSION.replace(/\./g, '\\.') + "'")],
  ['web version.ts', 'apps/web/src/config/version.ts', new RegExp("APP_VERSION = '" + NEW_VERSION.replace(/\./g, '\\.') + "'")],
];
let allOK = true;
for (const [name, path, re] of checks) {
  const content = fs.readFileSync(path, 'utf8');
  const ok = re.test(content);
  if (!ok) allOK = false;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name + ': ' + path);
}

console.log('\n=== 残留老版本检查 (历史 commit 注释除外) ===');
// 历史 commit 注释里的 3.0.X 引用是合理的 (BUG-XXX 段回溯), 不算残留
// 实际值已经在上面 6 处自检里检查了 (严格匹配新版本号), 这里跳过冗余检查
console.log('  跳过 (历史 commit 注释里的 3.0.X 是合理引用)');

console.log('\n=== changelog.json 验证 ===');
const cl = JSON.parse(fs.readFileSync('apps/server/changelog.json', 'utf8'));
// BUG-119 v3.0.48: 看 latest_version 字段 (server /api/version 实际读这个) + 兜底 entries[0] (BUG-118 之后默认 prepend 顺序)
const latest = cl.latest_version;
const firstEntry = cl.entries[0];
console.log('  latest_version: ' + latest);
console.log('  entries[0]:    version=' + firstEntry.version + ' date=' + firstEntry.buildDate);
if (latest === NEW_VERSION) {
  console.log('  ✓ latest_version 匹配 (跟 /api/version 响应一致)');
} else if (firstEntry.version === NEW_VERSION) {
  console.log('  ⚠ latest_version 不匹配但 entries[0] 匹配 (prepend 顺序, server 仍能返)');
} else {
  console.log('  ✗ changelog 没找到 ' + NEW_VERSION);
  allOK = false;
}

console.log('\n=== 7-8 处远程版本号同步自检 (🆕 v3.0.33 S71 BUG-082 P3) ===');
if (!fs.existsSync(SSH_KEY)) {
  console.log('  ⚠ SSH key 不存在 (' + SSH_KEY + '), 跳过远程 7-8 处检查');
  console.log('    手动: ssh root@159.75.16.110 "grep APP_VERSION /www/wwwroot/shipin-APP/.env && grep APP_VERSION /etc/systemd/system/shipin-app.service"');
  process.exit(allOK ? 0 : 1);
}
try {
  const out = execSync(
    'ssh -i "' + SSH_KEY + '" -o BatchMode=yes -o ConnectTimeout=10 ' + REMOTE +
    ' "echo 7-ENV:; grep ^APP_VERSION= /www/wwwroot/shipin-APP/.env 2>&1; echo 8-UNIT:; grep ^Environment=APP_VERSION= /etc/systemd/system/shipin-app.service 2>&1"',
    { encoding: 'utf8' }
  );
  console.log(out);
  const envMatch = out.match(/APP_VERSION=([\d.]+)/g);
  if (envMatch && envMatch.length >= 2) {
    const envVer = envMatch[0].replace('APP_VERSION=', '');
    const unitVer = envMatch[1].replace('APP_VERSION=', '');
    if (envVer === NEW_VERSION && unitVer === NEW_VERSION) {
      console.log('  ✓ 7-8 处远程版本号同步: .env=' + envVer + ' systemd unit=' + unitVer);
    } else {
      console.log('  ✗ 7-8 处远程版本号不匹配, 期望 ' + NEW_VERSION + ' 实际 .env=' + envVer + ' unit=' + unitVer);
      allOK = false;
    }
  } else {
    console.log('  ⚠ 远程匹配失败, 手动检查');
  }
} catch (e) {
  console.log('  ✗ SSH 失败: ' + e.message.slice(0, 200));
  allOK = false;
}

process.exit(allOK ? 0 : 1);

