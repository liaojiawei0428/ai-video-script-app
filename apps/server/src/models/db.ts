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
    connectionLimit: 25,
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
      genre VARCHAR(200) DEFAULT '',
      theme VARCHAR(500) DEFAULT '',
      style VARCHAR(500) DEFAULT '',
      tone VARCHAR(500) DEFAULT '',
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

  // 兼容迁移：添加 INDEX
  try { await db.execute('ALTER TABLE task_jobs ADD INDEX idx_tasks_status (status)'); } catch {}
  try { await db.execute('ALTER TABLE task_jobs ADD INDEX idx_tasks_novel (novel_id)'); } catch {}

  // ======== 用户角色 ========
  try { await db.execute("ALTER TABLE users ADD COLUMN role VARCHAR(10) DEFAULT 'user'"); } catch {}

  // ======== 充值申请记录 ========
  await db.execute(`
    CREATE TABLE IF NOT EXISTS recharge_requests (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      username VARCHAR(100) DEFAULT '',
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      remark VARCHAR(500) DEFAULT '',
      ip VARCHAR(50) DEFAULT '',
      ip_location VARCHAR(100) DEFAULT '',
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      INDEX idx_rr_user (user_id),
      INDEX idx_rr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ======== 计费系统 ========

  // 添加 vip_level 列（套餐用户标记：0=普通，1=套餐）
  try { await db.execute("ALTER TABLE users ADD COLUMN vip_level TINYINT DEFAULT 0"); } catch {}
  // 添加 vip_expires_at 列（VIP 到期时间戳，毫秒）
  try { await db.execute("ALTER TABLE users ADD COLUMN vip_expires_at BIGINT DEFAULT NULL"); } catch {}

  // 计费记录表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS billing_logs (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      type ENUM('charge','consumption','refund') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      balance_after DECIMAL(10,2) NOT NULL,
      novel_id VARCHAR(36) DEFAULT '',
      description VARCHAR(500) DEFAULT '',
      word_count INT DEFAULT 0,
      created_at BIGINT DEFAULT 0,
      INDEX idx_billing_user (user_id),
      INDEX idx_billing_time (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
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

// 使用 pool.query 替代 execute（解决 ENUM 列参数化查询兼容问题）
export async function poolQuery<T = RowDataPacket>(sql: string, params: any[] = []): Promise<T[]> {
  const p = await getDb();
  const [rows] = await p.query(sql, params);
  return rows as T[];
}
