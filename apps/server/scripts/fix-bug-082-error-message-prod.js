// /tmp/fix-bug-082.js (production server, fixed v3)
// v3.0.32 BUG-082: 修 video_conversations / image_conversations 里 messages JSON 中
//   messages[N].parts[M].message 是对象 {code, message} 的历史脏数据
// 注意: mysql2 driver 自动把 JSON 列 parse 成 array, 直接用就行
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const env = fs.readFileSync('/www/wwwroot/shipin-APP/.env', 'utf-8');
  const get = (k) => {
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim() : '';
  };
  const conn = await mysql.createConnection({
    host: get('MYSQL_HOST'),
    port: 3306,
    user: get('MYSQL_USER'),
    password: get('MYSQL_PASSWORD'),
    database: get('MYSQL_DATABASE'),
  });

  const tables = ['video_conversations', 'image_conversations'];
  let totalFixed = 0;
  for (const t of tables) {
    const [rows] = await conn.execute(
      `SELECT id, messages FROM ${t} WHERE JSON_SEARCH(messages, 'one', 'error', NULL, '$[*].parts[*].type') IS NOT NULL`
    );
    console.log(`[${t}] scanning ${rows.length} rows (with type:error in parts)...`);
    let fixed = 0;
    const fixedIds = [];
    for (const r of rows) {
      // mysql2 自动 parse JSON → array, 直接用
      const msgs = r.messages;
      if (!Array.isArray(msgs)) continue;
      let changed = false;
      const newMsgs = msgs.map((msg) => {
        if (!msg || !Array.isArray(msg.parts)) return msg;
        const newParts = msg.parts.map((p) => {
          if (p && p.type === 'error' && p.message && typeof p.message === 'object') {
            const innerMsg = p.message.message || p.message.msg || p.message.detail || JSON.stringify(p.message);
            const code = p.message.code && p.message.code !== 'INTERNAL_ERROR' ? ` (${p.message.code})` : '';
            const safeMsg = String(innerMsg) + code;
            changed = true;
            return { ...p, message: safeMsg.slice(0, 500) };
          }
          return p;
        });
        return { ...msg, parts: newParts };
      });
      if (changed) {
        fixed++;
        fixedIds.push(r.id);
        await conn.execute(`UPDATE ${t} SET messages = ? WHERE id = ?`, [JSON.stringify(newMsgs), r.id]);
      }
    }
    console.log(`[${t}] fixed: ${fixed} / ${rows.length} rows`);
    if (fixed > 0) console.log(`  ids: ${fixedIds.slice(0, 10).join(', ')}${fixed > 10 ? ' ...' : ''}`);
    totalFixed += fixed;
  }
  console.log(`\n=== Total fixed: ${totalFixed} ===`);
  await conn.end();
})();
