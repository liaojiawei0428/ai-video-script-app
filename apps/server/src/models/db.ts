import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { config } from '../config';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (db) return db;

  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = await open({
    filename: config.dbPath,
    driver: sqlite3.Database,
  });

  await initTables();
  logger.info('Database initialized');
  return db;
}

async function initTables(): Promise<void> {
  if (!db) return;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      file_path TEXT,
      total_chars INTEGER,
      total_words INTEGER,
      genre TEXT,
      theme TEXT,
      style TEXT,
      tone TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      summary TEXT,
      duration_sec INTEGER DEFAULT 120,
      scene_location TEXT,
      characters TEXT,
      script_content TEXT,
      script_format TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      FOREIGN KEY (novel_id) REFERENCES novels(id)
    );

    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      shot_number INTEGER NOT NULL,
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
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (episode_id) REFERENCES episodes(id)
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT,
      appearance TEXT,
      personality TEXT,
      role_type TEXT,
      relationships TEXT,
      reference_image TEXT,
      created_at INTEGER,
      FOREIGN KEY (novel_id) REFERENCES novels(id)
    );

    CREATE TABLE IF NOT EXISTS task_jobs (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      progress INTEGER DEFAULT 0,
      total_steps INTEGER,
      current_step INTEGER,
      result_data TEXT,
      error_msg TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_novel ON episodes(novel_id);
    CREATE INDEX IF NOT EXISTS idx_shots_episode ON shots(episode_id);
    CREATE INDEX IF NOT EXISTS idx_characters_novel ON characters(novel_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_novel ON task_jobs(novel_id);
  `);
}
