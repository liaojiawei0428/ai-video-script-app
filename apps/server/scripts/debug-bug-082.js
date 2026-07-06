// /tmp/debug.js
const mysql = require('mysql2/promise');
const fs = require('fs');
(async () => {
  const env = fs.readFileSync('/www/wwwroot/shipin-APP/.env', 'utf-8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
  const conn = await mysql.createConnection({ host: get('MYSQL_HOST'), port: 3306, user: get('MYSQL_USER'), password: get('MYSQL_PASSWORD'), database: get('MYSQL_DATABASE') });
  const [rows] = await conn.execute(`SELECT id, messages FROM video_conversations WHERE JSON_SEARCH(messages, 'one', 'error', NULL, '$[*].parts[*].type') IS NOT NULL`);
  for (const r of rows) {
    const msgs = JSON.parse(r.messages);
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.parts) {
        for (let j = 0; j < m.parts.length; j++) {
          const p = m.parts[j];
          if (p.type === 'error') {
            console.log(`id=${r.id} msg[${i}].parts[${j}].type=${p.type} message type=${typeof p.message} isObj=${typeof p.message === 'object'}`);
            console.log('  value:', JSON.stringify(p.message));
          }
        }
      }
    }
  }
  await conn.end();
})();
