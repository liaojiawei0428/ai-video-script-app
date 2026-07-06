const mysql = require('mysql2/promise');
const fs = require('fs');
(async () => {
  const env = fs.readFileSync('/www/wwwroot/shipin-APP/.env', 'utf-8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
  const conn = await mysql.createConnection({ host: get('MYSQL_HOST'), port: 3306, user: get('MYSQL_USER'), password: get('MYSQL_PASSWORD'), database: get('MYSQL_DATABASE') });
  const [rows] = await conn.execute(`SELECT id, messages FROM video_conversations WHERE JSON_SEARCH(messages, 'one', 'error', NULL, '$[*].parts[*].type') IS NOT NULL LIMIT 5`);
  for (const r of rows) {
    console.log('=== id:', r.id);
    console.log('typeof messages:', typeof r.messages);
    console.log('isNull:', r.messages === null);
    console.log('len:', r.messages ? String(r.messages).length : 0);
    console.log('first 200:', String(r.messages).slice(0, 200));
  }
  await conn.end();
})();
