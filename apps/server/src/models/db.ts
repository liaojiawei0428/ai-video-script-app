import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export async function getDb(): Promise<Pool> {
  if (pool) return pool;

  pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  // 测试连接
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info('MySQL connected successfully');
  } catch (err) {
    logger.error('MySQL connection failed', { error: err });
    throw err;
  }

  await initTables();
  logger.info('Database tables initialized');
  return pool;
}

async function initTables(): Promise<void> {
  if (!pool) return;
  const db = pool;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS novels (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255),
      user_id VARCHAR(36),
      file_path TEXT,
      total_chars INT DEFAULT 0,
      total_words INT DEFAULT 0,
      genre VARCHAR(100) DEFAULT '',
      theme VARCHAR(255) DEFAULT '',
      style VARCHAR(100) DEFAULT '',
      tone VARCHAR(100) DEFAULT '',
      scenes JSON,
      plot_points JSON,
      status VARCHAR(20) DEFAULT 'pending',
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      INDEX idx_novels_status (status),
      INDEX idx_novels_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 兼容迁移：为已有表添加 user_id 列（如已存在则忽略）
  try {
    await db.execute('ALTER TABLE novels ADD COLUMN user_id VARCHAR(36) DEFAULT NULL AFTER author');
    await db.execute('ALTER TABLE novels ADD INDEX idx_novels_user (user_id)');
  } catch {} // 列已存在则忽略

  await db.execute(`
    CREATE TABLE IF NOT EXISTS episodes (
      id VARCHAR(36) PRIMARY KEY,
      novel_id VARCHAR(36) NOT NULL,
      episode_number INT NOT NULL DEFAULT 0,
      title VARCHAR(255) DEFAULT '',
      summary TEXT,
      duration_sec INT DEFAULT 120,
      scene_location VARCHAR(255) DEFAULT '',
      characters JSON,
      script_content LONGTEXT,
      script_format VARCHAR(20) DEFAULT '',
      status VARCHAR(20) DEFAULT 'pending',
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      INDEX idx_episodes_novel (novel_id),
      INDEX idx_episodes_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shots (
      id VARCHAR(36) PRIMARY KEY,
      episode_id VARCHAR(36) NOT NULL,
      shot_number INT NOT NULL DEFAULT 0,
      scene_type VARCHAR(10) DEFAULT '',
      location VARCHAR(255) DEFAULT '',
      time_of_day VARCHAR(10) DEFAULT '',
      description TEXT,
      camera_angle VARCHAR(50) DEFAULT '',
      camera_move VARCHAR(50) DEFAULT '',
      lighting VARCHAR(50) DEFAULT '',
      duration_sec DOUBLE DEFAULT 0,
      audio_note TEXT,
      dialogue TEXT,
      action TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      INDEX idx_shots_episode (episode_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id VARCHAR(36) PRIMARY KEY,
      novel_id VARCHAR(36) NOT NULL,
      name VARCHAR(100) NOT NULL,
      aliases JSON,
      appearance TEXT,
      personality TEXT,
      role_type VARCHAR(30) DEFAULT '',
      relationships JSON,
      reference_image VARCHAR(500) DEFAULT '',
      created_at BIGINT DEFAULT 0,
      INDEX idx_characters_novel (novel_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration: add full_summary column for chunk pipeline
  try {
    await db.execute(`ALTER TABLE novels ADD COLUMN full_summary LONGTEXT`);
  } catch { /* column already exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255),
      password_hash VARCHAR(255) NOT NULL,
      nickname VARCHAR(100) DEFAULT '',
      avatar_url VARCHAR(500) DEFAULT '',
      balance DECIMAL(10,2) DEFAULT 0.00,
      total_generations INT DEFAULT 0,
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      INDEX idx_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_jobs (
      id VARCHAR(36) PRIMARY KEY,
      novel_id VARCHAR(36) NOT NULL,
      type VARCHAR(30) NOT NULL,
      status VARCHAR(20) DEFAULT 'queued',
      progress INT DEFAULT 0,
      total_steps INT DEFAULT 0,
      current_step INT DEFAULT 0,
      result_data JSON,
      error_msg TEXT,
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      completed_at BIGINT DEFAULT 0,
      INDEX idx_tasks_novel (novel_id),
      INDEX idx_tasks_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // AI 任务队列（持久化队列，替代内存 requestQueue）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_task_queue (
      id VARCHAR(36) PRIMARY KEY,
      novel_id VARCHAR(36) NOT NULL,
      task_type VARCHAR(30) NOT NULL,
      status VARCHAR(20) DEFAULT 'queued',
      priority INT DEFAULT 0,
      params JSON,
      result_data LONGTEXT,
      error_msg TEXT,
      created_at BIGINT DEFAULT 0,
      started_at BIGINT DEFAULT 0,
      completed_at BIGINT DEFAULT 0,
      INDEX idx_queue_status (status),
      INDEX idx_queue_novel (novel_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 兼容迁移：添加 INDEX
  try { await db.execute('ALTER TABLE ai_task_queue ADD INDEX idx_queue_status (status)'); } catch {}
  try { await db.execute('ALTER TABLE ai_task_queue ADD INDEX idx_queue_novel (novel_id)'); } catch {}
}

// 辅助函数：执行 SQL 并返回单行
export async function queryOne<T = RowDataPacket>(sql: string, params: any[] = []): Promise<T | undefined> {
  const p = await getDb();
  const [rows] = await p.execute(sql, params);
  return (rows as any[])[0] as T | undefined;
}

// 辅助函数：执行 SQL 并返回多行
export async function queryAll<T = RowDataPacket>(sql: string, params: any[] = []): Promise<T[]> {
  const p = await getDb();
  const [rows] = await p.execute(sql, params);
  return rows as unknown as T[];
}

// 辅助函数：执行写操作（INSERT/UPDATE/DELETE）
export async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const p = await getDb();
  const [result] = await p.execute<ResultSetHeader>(sql, params);
  return result;
}
