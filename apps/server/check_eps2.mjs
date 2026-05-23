import { getDb, queryAll } from './src/models/db.js';

async function main() {
  await getDb();
  const rows = await queryAll(
    'SELECT id, episode_number, title, LEFT(script_content, 30) as preview FROM episodes WHERE novel_id = ? ORDER BY episode_number',
    ['6b9e4b70-429d-4009-830d-1f2ce3583fd9']
  );
  console.log(`Episodes: ${rows.length}`);
  for (const r of rows) {
    console.log(`  #${r.episode_number} ${r.title ? r.title.slice(0, 30) : '(no title)'} preview=${r.preview || '(empty)'}`);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
