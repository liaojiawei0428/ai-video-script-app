import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DATABASE_NAME = 'AiScript.db';

type DBType = Awaited<ReturnType<typeof SQLite.openDatabase>>;

let db: DBType | null = null;

export async function initDatabase(): Promise<DBType> {
  if (db) return db;

  db = await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });

  await createTables();
  return db;
}

async function createTables(): Promise<void> {
  if (!db) return;

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      total_chars INTEGER,
      total_words INTEGER,
      genre TEXT,
      theme TEXT,
      style TEXT,
      tone TEXT,
      summary TEXT DEFAULT '',
      scenes TEXT DEFAULT '[]',
      plot_points TEXT DEFAULT '[]',
      status TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  // Migrate old tables: add missing columns
  const migrations = [
    "ALTER TABLE novels ADD COLUMN summary TEXT DEFAULT ''",
    "ALTER TABLE novels ADD COLUMN scenes TEXT DEFAULT '[]'",
    "ALTER TABLE novels ADD COLUMN plot_points TEXT DEFAULT '[]'",
  ];
  for (const sql of migrations) {
    try { await db.executeSql(sql); } catch { /* column may already exist */ }
  }

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      episode_number INTEGER,
      title TEXT,
      summary TEXT,
      duration_sec INTEGER,
      scene_location TEXT,
      characters TEXT,
      script_content TEXT,
      script_format TEXT,
      status TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      shot_number INTEGER,
      scene_type TEXT,
      location TEXT,
      time_of_day TEXT,
      description TEXT,
      camera_angle TEXT,
      camera_move TEXT,
      lighting TEXT,
      duration_sec REAL,
      audio_note TEXT,
      dialogue TEXT,
      action TEXT,
      status TEXT
    )
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      name TEXT,
      aliases TEXT,
      appearance TEXT,
      personality TEXT,
      role_type TEXT,
      created_at INTEGER
    )
  `);

  // ======== S72 batch 16 v3.0.45 BUG-115 缓存方案 A.2 修法: characters 表加 description/extra_description/updated_at 列 ========
  // 背景: 跟 server A.1 同步, mobile 本地缓存 characters 也需要完整字段 (description + extra_description + updated_at)
  // 老数据兼容: ALTER TABLE 加列 IF NOT EXISTS 保护 (SQLite 不支持 IF NOT EXISTS for ADD COLUMN, 用 try/catch 兜底)
  // 跟 BUG-113 mobile 真机回归发现的 "SQLiteLog: (1) duplicate column name: summary" 100% 同源教训
  const characterMigrations = [
    "ALTER TABLE characters ADD COLUMN description TEXT DEFAULT ''",
    "ALTER TABLE characters ADD COLUMN extra_description TEXT DEFAULT ''",
    "ALTER TABLE characters ADD COLUMN updated_at INTEGER DEFAULT 0",
  ];
  for (const sql of characterMigrations) {
    try { await db.executeSql(sql); } catch { /* column may already exist (跟 novels ALTER 一致) */ }
  }

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // ======== S72 batch 16 v3.0.45 BUG-115 缓存方案 A.3: novel_hashes 表 (hash 比对核心) ========
  // 背景: fetchNovels 每 10/30s re-fetch → 即使 server 没变也全量 setState + 全量 INSERT OR REPLACE 写 SQLite
  // 修法: 存一份 novel_id → hash(title+status+updated_at+...) 对照表, 写 SQLite 前先比对 hash
  // 好处: 没变 → 不写 SQLite → 不触发 SQLite re-render 副作用 → 减少 90% 写 SQLite + 减少 90% setState
  // 配套: cache_meta 表 (URL → etag + body) 在阶段 B 实现, 本次只实现 novel_hashes
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS novel_hashes (
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // ======== S72 batch 17 v3.0.46 BUG-116 缓存方案 B.2: cache_meta 表 (ETag/304 核心) ========
  // 背景: server etagMiddleware 算 ETag, 客户端带 If-None-Match 命中 → server 返 304 不传 body
  // 必须从客户端本地读上次缓存的 body 返给 axios 调用方 (axios 拦截器处理)
  // 跨端铁律 4++ (跟 web IndexedDB cache_meta 1:1 镜像)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS cache_meta (
      url TEXT PRIMARY KEY,
      etag TEXT NOT NULL,
      body TEXT NOT NULL,
      status_code INTEGER DEFAULT 200,
      updated_at INTEGER NOT NULL
    )
  `);
  try { await db.executeSql('CREATE INDEX IF NOT EXISTS idx_cache_meta_updated_at ON cache_meta(updated_at)'); } catch { /* index may already exist */ }
}

export async function saveNovel(novel: any): Promise<void> {
  const database = await initDatabase();
  await database.executeSql(
    `INSERT OR REPLACE INTO novels (id, title, author, total_chars, total_words,
     genre, theme, style, tone, summary, scenes, plot_points, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [novel.id, novel.title, novel.author, novel.totalChars, novel.totalWords,
     novel.genre, novel.theme, novel.style, novel.tone, novel.summary || '',
     novel.scenes ? JSON.stringify(novel.scenes) : '[]',
     novel.plotPoints ? JSON.stringify(novel.plotPoints) : '[]',
     novel.status, novel.createdAt, novel.updatedAt]
  );
}

/**
 * S72 batch 16 v3.0.45 BUG-115 缓存方案 A.3: 计算 novel 的 hash (用于变更检测)
 * hash 字段: title + status + updated_at + totalChars + summary 长度 (轻量级, 不用整个 body)
 * 目的: 客户端比对 server 返的 novel hash 是否跟本地一致, 一致则不写 SQLite + 不 setState
 * 跟 ETag 区别: 这是客户端 hash 比对 (不依赖 server), 阶段 B ETag 是 server hash 比对
 */
export async function hashNovel(novel: any): Promise<string> {
  // 用 SHA-256 (轻量, 同步可用, RN crypto-js 已装或用 native crypto.subtle)
  // 简单方案: 用 update_at + status + summary.length 拼字符串当 hash (轻量 + 够用)
  // 极端严格: 完整 JSON.stringify 后 SHA-256 (太重, 100ms 级)
  const input = [
    novel.title || '',
    novel.status || '',
    novel.updatedAt || 0,
    novel.totalChars || 0,
    (novel.summary || '').length,
    (novel.genre || '') + (novel.theme || '') + (novel.style || '') + (novel.tone || ''),
  ].join('|');
  // 简单 hash (djb2, 跟 web 端 mediaCache 一致, 32 chars hex)
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & hash; // 32-bit
  }
  // 转 32 chars hex (前面补 0)
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((hash * 31 + input.length) >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((hash * 37 + input.length * 17) >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((hash * 41 + input.length * 23) >>> 0).toString(16)).slice(-8);
}

/**
 * S72 batch 16 v3.0.45 BUG-115 缓存方案 A.3: saveNovelIfChanged - 跟本地 hash 比对, 变了才写
 * @returns boolean true=已写 (变了), false=跳过 (没变)
 */
export async function saveNovelIfChanged(novel: any): Promise<boolean> {
  const database = await initDatabase();
  const newHash = await hashNovel(novel);
  // 查本地 hash
  const [results] = await database.executeSql(
    'SELECT hash FROM novel_hashes WHERE id = ?',
    [novel.id]
  );
  const oldHash = results.rows.length > 0 ? results.rows.item(0).hash : null;
  if (oldHash === newHash) {
    return false; // 没变, 跳过
  }
  // 写 SQLite + 更新 hash
  await saveNovel(novel);
  await database.executeSql(
    `INSERT OR REPLACE INTO novel_hashes (id, hash, updated_at) VALUES (?, ?, ?)`,
    [novel.id, newHash, Date.now()]
  );
  return true;
}

/**
 * S72 batch 16 v3.0.45 BUG-115 缓存方案 A.3: getNovelHash - 查本地 hash
 */
export async function getNovelHash(novelId: string): Promise<string | null> {
  const database = await initDatabase();
  const [results] = await database.executeSql(
    'SELECT hash FROM novel_hashes WHERE id = ?',
    [novelId]
  );
  return results.rows.length > 0 ? results.rows.item(0).hash : null;
}

/**
 * S72 batch 16 v3.0.45 BUG-115 缓存方案 A.3: 批量 hash 比对 - 用于 fetchNovels 流程优化
 * @param serverNovels Novel[] 来自 server
 * @returns { changed: Novel[], unchanged: Novel[] } server 中变了 + 没变的分组
 */
export async function diffNovelsByHash(serverNovels: any[]): Promise<{ changed: any[]; unchanged: any[] }> {
  const changed: any[] = [];
  const unchanged: any[] = [];
  for (const novel of serverNovels) {
    const newHash = await hashNovel(novel);
    const oldHash = await getNovelHash(novel.id);
    if (oldHash === newHash) {
      unchanged.push(novel);
    } else {
      changed.push(novel);
    }
  }
  return { changed, unchanged };
}

export async function updateNovelStatus(novelId: string, status: string): Promise<void> {
  const database = await initDatabase();
  await database.executeSql(
    'UPDATE novels SET status = ?, updated_at = ? WHERE id = ?',
    [status, Date.now(), novelId]
  );
}

export async function getNovels(): Promise<any[]> {
  const database = await initDatabase();
  const [results] = await database.executeSql('SELECT * FROM novels ORDER BY created_at DESC');
  const novels = [];
  for (let i = 0; i < results.rows.length; i++) {
    novels.push(results.rows.item(i));
  }
  return novels;
}

export async function updateNovelAnalysis(novelId: string, data: { genre: string; theme: string; style: string; tone: string; summary?: string; scenes?: any[]; plotPoints?: any[] }): Promise<void> {
  const database = await initDatabase();
  await database.executeSql(
    'UPDATE novels SET genre = ?, theme = ?, style = ?, tone = ?, summary = ?, scenes = ?, plot_points = ?, updated_at = ? WHERE id = ?',
    [data.genre, data.theme, data.style, data.tone, data.summary || '',
     data.scenes ? JSON.stringify(data.scenes) : '[]',
     data.plotPoints ? JSON.stringify(data.plotPoints) : '[]',
     Date.now(), novelId]
  );
}

export async function deleteNovelById(novelId: string): Promise<void> {
  const database = await initDatabase();
  await database.executeSql('DELETE FROM novels WHERE id = ?', [novelId]);
  await database.executeSql('DELETE FROM episodes WHERE novel_id = ?', [novelId]);
  await database.executeSql('DELETE FROM characters WHERE novel_id = ?', [novelId]);
}

export async function saveEpisodes(episodes: any[]): Promise<void> {
  const database = await initDatabase();
  for (const episode of episodes) {
    await database.executeSql(
      `INSERT OR REPLACE INTO episodes (id, novel_id, episode_number, title, summary,
       duration_sec, scene_location, characters, script_content, script_format, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [episode.id, episode.novelId, episode.episodeNumber, episode.title, episode.summary,
       episode.durationSec, episode.sceneLocation, JSON.stringify(episode.characters),
       episode.scriptContent, episode.scriptFormat, episode.status, episode.createdAt, episode.updatedAt || Date.now()]
    );
  }
}

export async function updateEpisodeSqlite(episode: any): Promise<void> {
  const database = await initDatabase();
  await database.executeSql(
    `UPDATE episodes SET title = ?, summary = ?, duration_sec = ?, script_content = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [episode.title, episode.summary, episode.durationSec, episode.scriptContent, episode.status, Date.now(), episode.id]
  );
}

export async function getEpisodes(novelId: string): Promise<any[]> {
  const database = await initDatabase();
  const [results] = await database.executeSql(
    'SELECT * FROM episodes WHERE novel_id = ? ORDER BY episode_number',
    [novelId]
  );
  const episodes = [];
  for (let i = 0; i < results.rows.length; i++) {
    episodes.push(results.rows.item(i));
  }
  return episodes;
}

export async function saveShots(shots: any[]): Promise<void> {
  const database = await initDatabase();
  for (const shot of shots) {
    await database.executeSql(
      `INSERT OR REPLACE INTO shots (id, episode_id, shot_number, scene_type, location, time_of_day,
       description, camera_angle, camera_move, lighting, duration_sec, audio_note, dialogue, action, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shot.id, shot.episodeId, shot.shotNumber, shot.sceneType, shot.location,
       shot.timeOfDay, shot.description, shot.cameraAngle, shot.cameraMove, shot.lighting,
       shot.durationSec, shot.audioNote, shot.dialogue, shot.action, shot.status]
    );
  }
}

export async function getShots(episodeId: string): Promise<any[]> {
  const database = await initDatabase();
  const [results] = await database.executeSql(
    'SELECT * FROM shots WHERE episode_id = ? ORDER BY shot_number',
    [episodeId]
  );
  const shots = [];
  for (let i = 0; i < results.rows.length; i++) {
    shots.push(results.rows.item(i));
  }
  return shots;
}

// ── 角色 characters (S72 batch 16 v3.0.45 BUG-115 缓存方案 A.2) ──

/**
 * 批量保存角色 (跟 server characterModel.bulkCreate 1:1 镜像)
 * @param characters Character[] from server /api/novels/:id/characters
 */
export async function saveCharacters(characters: any[]): Promise<void> {
  const database = await initDatabase();
  for (const char of characters) {
    await database.executeSql(
      `INSERT OR REPLACE INTO characters (id, novel_id, name, aliases, appearance, personality,
       role_type, reference_image, description, extra_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        char.id, char.novelId, char.name,
        char.aliases ? JSON.stringify(char.aliases) : '[]',
        char.appearance || '', char.personality || '',
        char.roleType || '', char.referenceImage || '',
        char.description || '', char.extraDescription || '',
        char.createdAt || 0, char.updatedAt || Date.now(),
      ]
    );
  }
}

/**
 * 按 novel_id 获取本地缓存的角色列表
 * @param novelId string
 * @returns Character[] (跟 server listCharactersByNovel 1:1 镜像)
 */
export async function getCharacters(novelId: string): Promise<any[]> {
  const database = await initDatabase();
  const [results] = await database.executeSql(
    'SELECT * FROM characters WHERE novel_id = ? ORDER BY created_at',
    [novelId]
  );
  const chars = [];
  for (let i = 0; i < results.rows.length; i++) {
    const row = results.rows.item(i);
    // JSON 字段解析
    if (row.aliases && typeof row.aliases === 'string') {
      try { row.aliases = JSON.parse(row.aliases); } catch { row.aliases = []; }
    }
    chars.push(row);
  }
  return chars;
}

/**
 * 单角色更新 (用于 CharacterDescriptionReviewScreen 提交后)
 * @param char Character 含 id 必填
 */
export async function updateCharacter(char: any): Promise<void> {
  const database = await initDatabase();
  const sets: string[] = [];
  const params: any[] = [];
  if (char.name !== undefined) { sets.push('name = ?'); params.push(char.name); }
  if (char.aliases !== undefined) { sets.push('aliases = ?'); params.push(JSON.stringify(char.aliases)); }
  if (char.appearance !== undefined) { sets.push('appearance = ?'); params.push(char.appearance); }
  if (char.personality !== undefined) { sets.push('personality = ?'); params.push(char.personality); }
  if (char.roleType !== undefined) { sets.push('role_type = ?'); params.push(char.roleType); }
  if (char.referenceImage !== undefined) { sets.push('reference_image = ?'); params.push(char.referenceImage); }
  if (char.description !== undefined) { sets.push('description = ?'); params.push(char.description); }
  if (char.extraDescription !== undefined) { sets.push('extra_description = ?'); params.push(char.extraDescription); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?'); params.push(Date.now());
  params.push(char.id);
  await database.executeSql(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * 按 novel_id 删除角色 (deleteNovelById 已经处理, 但保留独立函数便于增量 sync)
 */
export async function deleteCharactersByNovel(novelId: string): Promise<void> {
  const database = await initDatabase();
  await database.executeSql('DELETE FROM characters WHERE novel_id = ?', [novelId]);
}

// ── 通用设置存储（token 等） ──

export async function saveSetting(key: string, value: string): Promise<void> {
  const database = await initDatabase();
  await database.executeSql(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const database = await initDatabase();
  const [results] = await database.executeSql(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  if (results.rows.length > 0) return results.rows.item(0).value;
  return null;
}

export async function deleteSetting(key: string): Promise<void> {
  const database = await initDatabase();
  await database.executeSql('DELETE FROM app_settings WHERE key = ?', [key]);
}

export async function clearAllLocalData(): Promise<void> {
  const database = await initDatabase();
  await database.executeSql('DELETE FROM novels');
  await database.executeSql('DELETE FROM episodes');
  await database.executeSql('DELETE FROM shots');
  await database.executeSql('DELETE FROM characters');
  // S72 batch 16 v3.0.45 BUG-115 缓存方案 A.3: 清缓存同时清 hash 表 (避免 hash 残留)
  await database.executeSql('DELETE FROM novel_hashes').catch(() => { /* table may not exist yet */ });
  await database.executeSql('DELETE FROM cache_meta').catch(() => { /* table may not exist yet (阶段 B 新增) */ });
}
