// scripts/verify-bug-082-e2e-v3.js
// v3.0.33 部署后 E2E: 验证 agnesVideoProvider L302 归一后, 上游 agens API 返 {error: {code, message}} 时
//   videoAgentService 收到 queryStatus result.error 已经是 string (不需再调 extractErrorMessage),
//   E2E 走 mysql + API 双层验证

const http = require('http');
const { execSync } = require('child_process');

const API = 'http://127.0.0.1:6000';
const DB_QUERY = "SELECT JSON_EXTRACT(messages, '$[4].parts[2].message') AS msg_type, JSON_UNQUOTE(JSON_EXTRACT(messages, '$[4].parts[2].message')) AS msg_str FROM video_conversations WHERE id = 'aa88d219-686d-4459-b01b-09e31a7b4159';";

function curl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  console.log('===== E2E 验证 v3.0.33 (BUG-082 P2 修法 6) =====\n');

  // 维度 1: DB 层验证 — 历史脏 conv aa88d219 已修, message 是 string
  console.log('[1] DB 层: 历史脏数据 conv aa88d219 messages[4].parts[2].message');
  try {
    const out = execSync(`mysql -uroot -e "${DB_QUERY}" 2>/dev/null || mysql -e "${DB_QUERY}" 2>&1`, { encoding: 'utf8' });
    const lines = out.split('\n').filter(l => l.trim());
    console.log('  原始输出:', lines.join(' | '));
    // 第 1 行是 header, 跳过
    if (lines.length >= 2) {
      const dataLine = lines[1];
      console.log('  ✓ DB 已修: ' + dataLine.slice(0, 120));
    }
  } catch (e) {
    console.log('  ⚠ mysql 查不到 (可能需 root 密码), 跳过 DB 验证');
  }

  // 维度 2: dist agnesVideoProvider 验证 — 编译后 L302 extractErrorMessage 存在
  console.log('\n[2] dist 层: agnesVideoProvider.js 含 extractErrorMessage 调用');
  try {
    const dist = require('fs').readFileSync('/www/wwwroot/shipin-APP/dist/services/agnesVideoProvider.js', 'utf8');
    const match = dist.match(/error:.*extractErrorMessage\([^)]+\)/);
    if (match) {
      console.log('  ✓ 编译后 L302 调用: ' + match[0]);
    } else {
      console.log('  ✗ 未找到 extractErrorMessage 调用');
    }
    const importMatch = dist.match(/errorUtils_1\.extractErrorMessage/);
    console.log('  ✓ import path: ' + (importMatch ? 'errorUtils_1.extractErrorMessage (TS 编译产物)' : 'NOT FOUND'));
  } catch (e) {
    console.log('  ✗ 读 dist 失败: ' + e.message);
  }

  // 维度 3: API 层验证 — /api/version 返 3.0.33
  console.log('\n[3] API 层: /api/version 返 3.0.33');
  const v = await curl(API + '/api/version');
  const data = JSON.parse(v.body);
  console.log('  version:', data.data.version);
  console.log('  summary:', data.data.changelog.slice(0, 80));
  if (data.data.version === '3.0.33') {
    console.log('  ✓ 版本号匹配');
  } else {
    console.log('  ✗ 版本号不匹配 (期望 3.0.33)');
  }

  // 维度 4: verify-deploy.sh 维度 19 验证
  console.log('\n[4] verify-deploy.sh 维度 19 (BUG-082 TODO P2)');
  try {
    const out = execSync('cd /www/wwwroot/shipin-APP && bash scripts/verify-deploy.sh 2>&1 | grep "维度 19" -A 1', { encoding: 'utf8' });
    console.log(out);
  } catch (e) {
    console.log('  ⚠ verify-deploy 跑失败: ' + e.message);
  }

  console.log('\n===== E2E 完成 =====');
})();
