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
  // 添加 last_ip 列（最近登录IP）
  try { await db.execute("ALTER TABLE users ADD COLUMN last_ip VARCHAR(45) DEFAULT ''"); } catch {}
  // 添加 ip_location 列（IP归属地）
  try { await db.execute("ALTER TABLE users ADD COLUMN ip_location VARCHAR(100) DEFAULT ''"); } catch {}

  // 通知/消息表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      type VARCHAR(20) DEFAULT 'system',
      title VARCHAR(200) DEFAULT '',
      content TEXT,
      is_read TINYINT DEFAULT 0,
      related_id VARCHAR(36) DEFAULT '',
      created_at BIGINT DEFAULT 0,
      INDEX idx_notifications_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

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

  // ════════════════════════════════════════════════════════════
  //  v2.0.0 增量迁移（角色一致性 + 资产库 + 章节图谱 + 订单）
  //  兼容迁移: try/catch 包装, 列已存在则忽略
  // ════════════════════════════════════════════════════════════

  // ── characters: 加 8 字段 ──
  try { await db.execute("ALTER TABLE characters ADD COLUMN description JSON DEFAULT NULL COMMENT '11维度结构化描述'"); } catch {}
  try { await db.execute("ALTER TABLE characters ADD COLUMN extra_description JSON DEFAULT NULL COMMENT '4维度补充描述'"); } catch {}
  try { await db.execute("ALTER TABLE characters ADD COLUMN style_id VARCHAR(36) DEFAULT 'realistic' COMMENT '画风ID'"); } catch {}
  try { await db.execute("ALTER TABLE characters ADD COLUMN confirmed TINYINT(1) DEFAULT 0 COMMENT '用户是否已确认描述'"); } catch {}
  try { await db.execute("ALTER TABLE characters ADD COLUMN image_variants JSON DEFAULT NULL COMMENT '3张变体图'"); } catch {}
  try { await db.execute("ALTER TABLE characters ADD COLUMN image_gen_status VARCHAR(20) DEFAULT 'none' COMMENT 'none/generating/partial/completed/failed'"); } catch {}
  try { await db.execute("ALTER TABLE characters ADD COLUMN confirmed_at BIGINT DEFAULT NULL"); } catch {}
  try { await db.execute("ALTER TABLE characters ADD COLUMN image_generated_at BIGINT DEFAULT NULL"); } catch {}

  // ── novels: 加 5 字段 ──
  try { await db.execute("ALTER TABLE novels ADD COLUMN style_id VARCHAR(36) DEFAULT 'realistic' COMMENT '小说统一画风'"); } catch {}
  try { await db.execute("ALTER TABLE novels ADD COLUMN plot_graph JSON DEFAULT NULL COMMENT '章节事件图谱'"); } catch {}
  try { await db.execute("ALTER TABLE novels ADD COLUMN outline_confirmed TINYINT(1) DEFAULT 0"); } catch {}
  try { await db.execute("ALTER TABLE novels ADD COLUMN outline_confirmed_at BIGINT DEFAULT NULL"); } catch {}
  try { await db.execute("ALTER TABLE novels ADD COLUMN plot_graph_generated_at BIGINT DEFAULT NULL"); } catch {}

  // ── episodes: 加 3 字段 ──
  try { await db.execute("ALTER TABLE episodes ADD COLUMN outline_text TEXT COMMENT '分集大纲'"); } catch {}
  try { await db.execute("ALTER TABLE episodes ADD COLUMN confirmed TINYINT(1) DEFAULT 0"); } catch {}
  try { await db.execute("ALTER TABLE episodes ADD COLUMN character_descriptions JSON DEFAULT NULL COMMENT '生成时角色描述快照'"); } catch {}

  // ── shots: 加 5 字段 ──
  try { await db.execute("ALTER TABLE shots ADD COLUMN image_url VARCHAR(500) DEFAULT ''"); } catch {}
  try { await db.execute("ALTER TABLE shots ADD COLUMN character_ids JSON DEFAULT NULL"); } catch {}
  try { await db.execute("ALTER TABLE shots ADD COLUMN style_id VARCHAR(36) DEFAULT NULL"); } catch {}
  try { await db.execute("ALTER TABLE shots ADD COLUMN image_prompt TEXT"); } catch {}
  try { await db.execute("ALTER TABLE shots ADD COLUMN image_generated_at BIGINT DEFAULT NULL"); } catch {}

  // ── notifications: 加 2 字段 ──
  try { await db.execute("ALTER TABLE notifications ADD COLUMN priority VARCHAR(10) DEFAULT 'normal'"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN expires_at BIGINT DEFAULT NULL"); } catch {}

  // ── 新表: assets 资产库 ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id VARCHAR(36) PRIMARY KEY,
      novel_id VARCHAR(36) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'character' COMMENT 'character/scene/prop/costume',
      name VARCHAR(200) NOT NULL,
      description JSON DEFAULT NULL,
      style_id VARCHAR(36) DEFAULT 'realistic',
      reference_image VARCHAR(500) DEFAULT '',
      created_at BIGINT DEFAULT 0,
      INDEX idx_assets_novel (novel_id),
      INDEX idx_assets_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── 新表: chapters 章节表 ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chapters (
      id VARCHAR(36) PRIMARY KEY,
      novel_id VARCHAR(36) NOT NULL,
      chapter_number INT NOT NULL DEFAULT 0,
      title VARCHAR(255) DEFAULT '',
      content LONGTEXT,
      start_char INT DEFAULT 0,
      end_char INT DEFAULT 0,
      created_at BIGINT DEFAULT 0,
      INDEX idx_chapters_novel (novel_id),
      INDEX idx_chapters_number (novel_id, chapter_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── 新表: points_orders 积分订单 ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS points_orders (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      type VARCHAR(20) NOT NULL COMMENT 'recharge/consumption/refund',
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/completed/failed/refunded/cancelled',
      payment_method VARCHAR(30) DEFAULT '',
      transaction_id VARCHAR(100) DEFAULT '',
      related_id VARCHAR(36) DEFAULT '',
      remark VARCHAR(500) DEFAULT '',
      created_at BIGINT DEFAULT 0,
      completed_at BIGINT DEFAULT NULL,
      INDEX idx_orders_user (user_id),
      INDEX idx_orders_status (status),
      INDEX idx_orders_time (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── 新表: style_presets 画风预设 ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS style_presets (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      label VARCHAR(100) NOT NULL,
      description VARCHAR(500) DEFAULT '',
      prompt_suffix TEXT,
      sample_image_url VARCHAR(500) DEFAULT '',
      is_default TINYINT(1) DEFAULT 0,
      sort_order INT DEFAULT 0,
      created_at BIGINT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── style_presets seed（5 画风） ──
  try {
    await db.execute(`
      INSERT INTO style_presets (id, name, label, description, prompt_suffix, sample_image_url, is_default, sort_order, created_at) VALUES
        ('sp_realistic', 'realistic', '写实电影风', '真人质感, 电影级光影, 写实摄影, 高细节', 'photorealistic, cinematic lighting, high detail, 8K, film grain, DSLR quality, real human skin texture, natural color grading', '/static/styles/realistic.png', 1, 1, UNIX_TIMESTAMP() * 1000),
        ('sp_ancient',   'ancient',   '古风水墨',   '中国传统水墨画风格, 飘逸写意, 古韵悠长', 'Chinese ink painting, traditional shuimo style, flowing brushwork, misty mountains, ancient costume, elegant composition, rice paper texture', '/static/styles/ancient.png', 0, 2, UNIX_TIMESTAMP() * 1000),
        ('sp_cyber',     'cyber',     '赛博朋克',   '未来科技感, 霓虹灯光, 数字朋克美学', 'cyberpunk aesthetic, neon lights, futuristic, holographic displays, dark urban atmosphere, rain-soaked streets, high-tech low-life', '/static/styles/cyber.png', 0, 3, UNIX_TIMESTAMP() * 1000),
        ('sp_anime',     'anime',     '动漫风',     '日系动漫插画, 鲜艳色彩, 精致线条', 'anime style illustration, vibrant colors, detailed line art, expressive eyes, cel shading, studio quality, Japanese animation aesthetic', '/static/styles/anime.png', 0, 4, UNIX_TIMESTAMP() * 1000),
        ('sp_3d',        '3d',        '3D 渲染',    '3D 渲染风, Pixar 质感, 半写实卡通', '3D render, Pixar style, soft lighting, subsurface scattering, stylized realism, octane render, depth of field', '/static/styles/3d.png', 0, 5, UNIX_TIMESTAMP() * 1000)
      ON DUPLICATE KEY UPDATE label=VALUES(label), description=VALUES(description), prompt_suffix=VALUES(prompt_suffix), sort_order=VALUES(sort_order)
    `);
  } catch (err) {
    logger.warn('style_presets seed failed (可能已存在)', { error: err });
  }
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
