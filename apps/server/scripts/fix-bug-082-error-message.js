// scripts/fix-bug-082-error-message.js
// v3.0.32 BUG-082: 修历史数据 — 视频/图片 agent 错误 part.message 存了对象 {code, message} 而非 string
//   - 读 video_conversations / image_conversations messages
//   - 找 type='error' 且 message 是对象的 part
//   - 把 message 归一为 string (优先 .message, 然后 .code, 拼一起)
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const env = fs.readFileSync('.env', 'utf-8');
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
    const [rows] = await conn.execute(`SELECT id, messages FROM ${t} WHERE messages LIKE '%"error"%'`);
    console.log(`[${t}] scanning ${rows.length} rows (with 'error' substring)...`);
    let fixed = 0;
    for (const r of rows) {
      let msgs;
      try { msgs = JSON.parse(r.messages); } catch { continue; }
      if (!Array.isArray(msgs)) continue;
      let changed = false;
      const newMsgs = msgs.map((m) => {
        if (m && m.type === 'error' && m.message && typeof m.message === 'object') {
          // 提取对象的 string message
          const innerMsg = m.message.message || m.message.msg || m.message.detail || JSON.stringify(m.message);
          const code = m.message.code && m.message.code !== 'INTERNAL_ERROR' ? ` (${m.message.code})` : '';
          const safeMsg = String(innerMsg) + code;
          changed = true;
          return { ...m, message: safeMsg.slice(0, 500) };  // 截断 500 防 UI 爆炸
        }
        return m;
      });
      if (changed) {
        fixed++;
        await conn.execute(`UPDATE ${t} SET messages = ? WHERE id = ?`, [JSON.stringify(newMsgs), r.id]);
      }
    }
    console.log(`[${t}] fixed: ${fixed} / ${rows.length} rows`);
    totalFixed += fixed;
  }
  console.log(`\n=== Total fixed: ${totalFixed} ===`);
  await conn.end();
})();
