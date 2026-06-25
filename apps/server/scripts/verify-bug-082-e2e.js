// /tmp/verify-bug-082-e2e.js
// 验证 BUG-082 修复:
//   1. 通过 API 拿 conv aa88d219 的 messages
//   2. 找 error part
//   3. 确认 message 字段是 string 不是 object
const http = require('http');
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  // 拿 conv 的 user_id (从 DB)
  const env = fs.readFileSync('/www/wwwroot/shipin-APP/.env', 'utf-8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
  const conn = await mysql.createConnection({
    host: get('MYSQL_HOST'), port: 3306, user: get('MYSQL_USER'), password: get('MYSQL_PASSWORD'), database: get('MYSQL_DATABASE'),
  });
  const [rows] = await conn.execute(`SELECT id, user_id, messages FROM video_conversations WHERE id = 'aa88d219-686d-4459-b01b-09e31a7b4159' LIMIT 1`);
  if (rows.length === 0) { console.log('❌ conv not found'); process.exit(1); }
  const conv = rows[0];
  const userId = conv.user_id;
  console.log('=== conv id:', conv.id, 'user:', userId);
  // 找 error part
  const msgs = conv.messages;  // mysql2 auto-parse JSON
  let errorPart = null;
  for (const m of msgs) {
    if (m.parts) {
      for (const p of m.parts) {
        if (p.type === 'error') { errorPart = p; break; }
      }
    }
    if (errorPart) break;
  }
  if (!errorPart) { console.log('❌ no error part'); process.exit(1); }
  console.log('=== error part:');
  console.log('  type:', errorPart.type);
  console.log('  message type:', typeof errorPart.message);
  console.log('  message value:', JSON.stringify(errorPart.message));
  if (typeof errorPart.message === 'string' && errorPart.message.includes('Invalid image')) {
    console.log('✅ BUG-082 修复验证: message 是 string, 包含期望内容');
  } else {
    console.log('❌ BUG-082 未修复: message 不是 string 或内容不对');
    process.exit(1);
  }
  await conn.end();

  // E2E 模拟 web 调用: 拿 JWT + GET /api/agent/video/conversations/aa88d219
  // 从 mysql 拿 user_id 的 email (JWT sub 用 userId 即可)
  const crypto = require('crypto');
  const jwtSecret = get('JWT_SECRET');
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload = Buffer.from(JSON.stringify({userId, iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const sig = crypto.createHmac('sha256', jwtSecret).update(header + '.' + payload).digest('base64url');
  const token = header + '.' + payload + '.' + sig;

  // 发请求
  const options = { hostname: '127.0.0.1', port: 6000, path: '/api/video-agent/conversations/aa88d219-686d-4459-b01b-09e31a7b4159', method: 'GET', headers: { 'Authorization': 'Bearer ' + token } };
  await new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log('\n=== API response status:', res.statusCode);
        try {
          const d = JSON.parse(body);
          if (d.data && d.data.messages) {
            for (const m of d.data.messages) {
              if (m.parts) {
                for (const p of m.parts) {
                  if (p.type === 'error') {
                    console.log('=== API error part message:');
                    console.log('  type:', typeof p.message);
                    console.log('  value:', JSON.stringify(p.message));
                    if (typeof p.message === 'string') {
                      console.log('✅ API 响应中 message 是 string, BUG-082 E2E 通过');
                    } else {
                      console.log('❌ API 响应中 message 仍是 object, BUG-082 E2E 失败');
                    }
                  }
                }
              }
            }
          } else {
            console.log('response body:', body.slice(0, 500));
          }
        } catch (e) {
          console.log('response body:', body.slice(0, 500));
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.end();
  });
})();
