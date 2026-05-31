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

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
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
}
