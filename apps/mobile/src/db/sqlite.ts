import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DATABASE_NAME = 'AiScript.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
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
      status TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

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
      created_at INTEGER
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
}

export async function saveNovel(novel: any): Promise<void> {
  const database = await initDatabase();
  await database.executeSql(
    `INSERT OR REPLACE INTO novels (id, title, author, total_chars, total_words,
     genre, theme, style, tone, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [novel.id, novel.title, novel.author, novel.totalChars, novel.totalWords,
     novel.genre, novel.theme, novel.style, novel.tone, novel.status, novel.createdAt, novel.updatedAt]
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

export async function saveEpisodes(episodes: any[]): Promise<void> {
  const database = await initDatabase();
  for (const episode of episodes) {
    await database.executeSql(
      `INSERT OR REPLACE INTO episodes (id, novel_id, episode_number, title, summary,
       duration_sec, scene_location, characters, script_content, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [episode.id, episode.novelId, episode.episodeNumber, episode.title, episode.summary,
       episode.durationSec, episode.sceneLocation, JSON.stringify(episode.characters),
       episode.scriptContent, episode.status, episode.createdAt]
    );
  }
}
