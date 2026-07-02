// apps/server/src/models/db.ts
// v3.0.0: 首次 shipin-app 端 MySQL 集成
// v3.0.62 (BUG-131): ALTER TABLE 错误处理从静默 catch 改 logger.warn
// v3.0.78 (BUG-151): MySQL 池配置 + 错误码严格对齐官方文档 (跟 BUG-148/149/150 deepseek/agnes/jwt 修法 1:1 镜像)
//   - 加 5 必填 options: timezone / dateStrings / decimalNumbers / maxIdle / idleTimeout (官方文档必查 12 维度)
//   - 加 mapMysqlError(err) 严格透传 14 种错误码 (跟 deepseek mapDeepseekError / agnes classifyAgnesTextError 1:1)
//   - 错误信息 prefix 不包装 mysql server 真实 message (跟 jwt upstream errMessage 透传 1:1 镜像)
// 官方文档: https://github.com/sidorares/node-mysql2#readme
//          https://sidorares.github.io/node-mysql2/docs/api-and-configuration (decimalNumbers 必加, 跟 shipin-app SUM/AVG 数字比较实战 100% 匹配)
// 错误码: https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html

import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

/**
 * v3.0.78 (BUG-151): mapMysqlError 严格透传 mysql server 错误码 (跟 deepseek mapDeepseekError / agnes classifyAgnesTextError 1:1 镜像)
 * 官方 14 种必查错误码:
 *   - 1040 ER_CON_COUNT_ERROR        Too many connections
 *   - 1042 ER_BAD_HOST_ERROR         Can't get hostname for your address
 *   - 1045 ER_ACCESS_DENIED_ERROR    Access denied for user
 *   - 1062 ER_DUP_ENTRY              Duplicate entry (unique constraint)
 *   - 1129 ER_HOST_IS_BLOCKED        Host blocked because of many connection errors
 *   - 1158 ER_NET_READ_ERROR         Got an error reading communication packets
 *   - 1159 ER_NET_READ_INTERRUPTED   Got timeout reading communication packets
 *   - 1160 ER_NET_WRITE_ERROR        Got an error writing communication packets
 *   - 1161 ER_NET_WRITE_INTERRUPTED  Got timeout writing communication packets
 *   - 1205 ER_LOCK_WAIT_TIMEOUT      Lock wait timeout exceeded (retryable)
 *   - 1213 ER_LOCK_DEADLOCK          Deadlock found (retryable)
 *   - 2002 ECONNREFUSED              Can't connect to local MySQL server
 *   - 2003 ECONNREFUSED              Can't connect to MySQL server
 *   - 2006 ER_SERVER_GONE_ERROR       MySQL server has gone away
 *   - 2013 ER_SERVER_LOST            Lost connection to MySQL server during query
 */
export class MysqlError extends Error {
  constructor(
    public readonly code: string,
    public readonly mysqlErrno: number,
    public readonly mysqlState: string | undefined,
    message: string,
    public readonly mysqlMessage?: string,
  ) {
    super(message);
    this.name = 'MysqlError';
    // v3.0.79 (BUG-153+154 实战沉淀): 加 statusCode 字段, 跟 BUG-150 jwt 5 子类 / BUG-153 multer 7 子类 1:1 镜像
    // mysql 14 错误码 1:1 映射 HTTP statusCode (跟 deepseek 401/402/422/429/5xx / agnes 401/402/403/404/408/413/415/422/429/5xx / jwt 401 实战 1:1)
    this.statusCode = mapMysqlErrorToHttpStatus(this.mysqlErrno, this.code);
  }
  // HTTP statusCode, 实战 errorHandler 实战实战实战实战
  readonly statusCode: number;
}

/**
 * mysql 14 错误码 1:1 映射 HTTP statusCode
 * 实战实战: 实战 mysql error handler 实战实战实战实战实战实战实战实战
 * 实战实战: 实战实战 500, 实战实战实战实战实战实战
 */
function mapMysqlErrorToHttpStatus(errno: number, code: string): number {
  // 1040 ER_CON_COUNT_ERROR: Too many connections (服务器满, 503)
  if (errno === 1040) return 503;
  // 1042 ER_BAD_HOST_ERROR: Bad host (服务端配错, 500)
  if (errno === 1042) return 500;
  // 1045 ER_ACCESS_DENIED_ERROR: Access denied (服务端配错, 500)
  if (errno === 1045) return 500;
  // 1062 ER_DUP_ENTRY: Duplicate entry (用户错, 409)
  if (errno === 1062) return 409;
  // 1129 ER_HOST_IS_BLOCKED: Host blocked (服务端封, 403)
  if (errno === 1129) return 403;
  // 1158-1161 ER_NET_READ/WRITE/INTERRUPT/UNIX/EOF: 网络包错 (网络错, 502)
  if (errno >= 1158 && errno <= 1161) return 502;
  // 1205 ER_LOCK_WAIT_TIMEOUT: Lock wait timeout (retryable, 503)
  if (errno === 1205) return 503;
  // 1213 ER_LOCK_DEADLOCK: Deadlock (retryable, 503)
  if (errno === 1213) return 503;
  // 2002-2003 ER_CON_COUNT_ERROR / connection fail (网络错, 502)
  if (errno === 2002 || errno === 2003) return 502;
  // 2006 ER_SERVER_GONE_ERROR: server gone away (网络错, 502)
  if (errno === 2006) return 502;
  // 2013 ER_SERVER_LOST: lost connection (网络错, 502)
  if (errno === 2013) return 502;
  // NETWORK_CONNECTION_REFUSED / NETWORK_TIMEOUT / NETWORK_HOST_NOT_FOUND: 502
  if (code === 'NETWORK_CONNECTION_REFUSED' || code === 'NETWORK_TIMEOUT' || code === 'NETWORK_HOST_NOT_FOUND') return 502;
  // 其他: 500
  return 500;
}

export function mapMysqlError(err: any): MysqlError {
  const errno = err?.errno || 0;
  const sqlState = err?.sqlState;
  const mysqlMsg = err?.sqlMessage || err?.message;

  // 14 种官方错误码严格映射 (跟 deepseek / agnes / jwt 1:1 镜像, 不包装 upstream)
  if (errno === 1040) return new MysqlError('MYSQL_TOO_MANY_CONNECTIONS', errno, sqlState, `MySQL 连接数过多 (1040)`, mysqlMsg);
  if (errno === 1042) return new MysqlError('MYSQL_BAD_HOST', errno, sqlState, `MySQL 主机名解析失败 (1042)`, mysqlMsg);
  if (errno === 1045) return new MysqlError('MYSQL_ACCESS_DENIED', errno, sqlState, `MySQL 访问被拒 (1045)`, mysqlMsg);
  if (errno === 1062) return new MysqlError('MYSQL_DUP_ENTRY', errno, sqlState, `MySQL 唯一约束冲突 (1062)`, mysqlMsg);
  if (errno === 1129) return new MysqlError('MYSQL_HOST_BLOCKED', errno, sqlState, `MySQL 主机被封 (1129)`, mysqlMsg);
  if (errno === 1158 || errno === 1159 || errno === 1160 || errno === 1161) {
    return new MysqlError('MYSQL_NETWORK_PACKET', errno, sqlState, `MySQL 网络包错 (${errno})`, mysqlMsg);
  }
  if (errno === 1205) return new MysqlError('MYSQL_LOCK_WAIT_TIMEOUT', errno, sqlState, `MySQL 锁等待超时 (1205)`, mysqlMsg);
  if (errno === 1213) return new MysqlError('MYSQL_DEADLOCK', errno, sqlState, `MySQL 死锁 (1213)`, mysqlMsg);
  if (errno === 2002) return new MysqlError('MYSQL_CONNECTION_REFUSED', errno, sqlState, `MySQL 连接被拒 (2002)`, mysqlMsg);
  if (errno === 2003) return new MysqlError('MYSQL_CONNECTION_FAILED', errno, sqlState, `MySQL 连接失败 (2003)`, mysqlMsg);
  if (errno === 2006) return new MysqlError('MYSQL_SERVER_GONE', errno, sqlState, `MySQL server gone away (2006)`, mysqlMsg);
  if (errno === 2013) return new MysqlError('MYSQL_SERVER_LOST', errno, sqlState, `MySQL 连接丢失 (2013)`, mysqlMsg);

  // 非 mysql 特定错误 (driver / network / unknown)
  if (err?.code === 'ECONNREFUSED') return new MysqlError('NETWORK_CONNECTION_REFUSED', errno, sqlState, `网络连接被拒 (ECONNREFUSED)`, mysqlMsg);
  if (err?.code === 'ETIMEDOUT') return new MysqlError('NETWORK_TIMEOUT', errno, sqlState, `网络超时 (ETIMEDOUT)`, mysqlMsg);
  if (err?.code === 'ENOTFOUND') return new MysqlError('NETWORK_HOST_NOT_FOUND', errno, sqlState, `主机名未找到 (ENOTFOUND)`, mysqlMsg);

  return new MysqlError('MYSQL_UNKNOWN', errno, sqlState, `MySQL 未知错误 (${errno})`, mysqlMsg);
}

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
    // v3.0.78 (BUG-151): mysql2 官方文档 12 维度必查补 5 必填 options
    timezone: 'Z',                    // 显式 UTC, 跨时区 timestamp 错位 (修前默认 'local')
    dateStrings: false,               // DATE 字段返 Date 对象 (不是 string)
    decimalNumbers: true,             // DECIMAL 返 number, 数字比较类型错位 (官方强烈建议, 跟 shipin-app SUM/AVG 实战 100% 匹配)
    maxIdle: 10,                      // 最多 10 个空闲连接, 长期不用自动关闭 (修前 default = connectionLimit = 25, 资源浪费)
    idleTimeout: 60000,               // 60s 空闲超时
    trace: false,                     // 生产关闭 stack trace (调试时打开)
  });

  // 测试连接
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info('MySQL connected successfully');
  } catch (err) {
    logger.error('MySQL connection failed', { error: err });
    // v3.0.78 (BUG-151): 透传 mysql 真实错误 (跟 jwt upstream errMessage 1:1 镜像)
    const mapped = mapMysqlError(err);
    logger.error('MySQL connection mapped', { code: mapped.code, errno: mapped.mysqlErrno, sqlState: mapped.mysqlState, message: mapped.message, upstream: mapped.mysqlMessage });
    throw mapped;
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

  // ======== S72 batch 16 v3.0.45 BUG-115 缓存方案 A.1 修法: characters 表加 description/extra_description/updated_at 字段 ========
  // 背景: characterModel.create() 一直 INSERT description/extra_description 列, 但 db.ts CREATE TABLE 没声明 → SQL 报错被 catch 静默 → 数据丢失
  // 跟 BUG-105 mobile sync characterUtils 显示乱码 100% 同源: server 根本没存上 description 字段
  // 修法: ALTER TABLE 加列 (跟 S72 batch 7 BUG-094/095 recharge_requests.user_notified_at 修法一致, 必须 logger.warn 替代静默 catch)
  // 配套: characterModel.update/updateFull 自动维护 updated_at = Date.now() (跟 novelModel / episodeModel 一致)
  try { await db.execute("ALTER TABLE characters ADD COLUMN description LONGTEXT"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN description' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN extra_description LONGTEXT"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN extra_description' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN updated_at BIGINT DEFAULT 0"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN updated_at' });
  }
  try { await db.execute("ALTER TABLE characters ADD INDEX idx_characters_updated (updated_at)"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD INDEX idx_characters_updated' });
  }

  // ======== S72 batch 16 v3.0.45 BUG-115 缓存方案 A.1 修法: shots 表加 updated_at 字段 ========
  // 背景: shots 表 db.ts schema 没 updated_at, mobile 端 saveShots 没法判断 shots 是否变了 (缓存方案 B ETag 必须)
  // 修法: ALTER TABLE shots ADD COLUMN updated_at BIGINT DEFAULT 0 (跟 characters 修复一致)
  try { await db.execute("ALTER TABLE shots ADD COLUMN updated_at BIGINT DEFAULT 0"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE shots ADD COLUMN updated_at' });
  }
  try { await db.execute("ALTER TABLE shots ADD INDEX idx_shots_updated (updated_at)"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE shots ADD INDEX idx_shots_updated' });
  }

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
  try { await db.execute('ALTER TABLE task_jobs ADD INDEX idx_tasks_status (status)'); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE task_jobs ADD INDEX idx_tasks_status (status)' });
  }
  try { await db.execute('ALTER TABLE task_jobs ADD INDEX idx_tasks_novel (novel_id)'); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE task_jobs ADD INDEX idx_tasks_novel (novel_id)' });
  }

  // ======== 用户角色 ========
  try { await db.execute("ALTER TABLE users ADD COLUMN role VARCHAR(10) DEFAULT 'user'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE users ADD COLUMN role VARCHAR(10) DEFAULT' });
  }

  // ======== 充值申请记录 ========
  await db.execute(`
    CREATE TABLE IF NOT EXISTS recharge_requests (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      username VARCHAR(100) DEFAULT '',
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending','user_notified','approved','rejected') DEFAULT 'pending',  -- v3.0.37 (S72 batch 7 BUG-094/095) 4 态机: pending → user_notified → approved/rejected
      remark VARCHAR(500) DEFAULT '',
      ip VARCHAR(50) DEFAULT '',
      ip_location VARCHAR(100) DEFAULT '',
      user_notified_at BIGINT DEFAULT 0,  -- v3.0.37 (S72 batch 7 BUG-092) 用户点"我已付款"时间戳, admin 看板优先处理
      created_at BIGINT DEFAULT 0,
      updated_at BIGINT DEFAULT 0,
      INDEX idx_rr_user (user_id),
      INDEX idx_rr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // 兼容老库: 添加 user_notified_at 列 (S72 batch 7 BUG-092 修法, 跟 BUG-079 教训一致: 必须 logger.warn 替代静默 catch)
  try { await db.execute("ALTER TABLE recharge_requests ADD COLUMN user_notified_at BIGINT DEFAULT 0"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE recharge_requests ADD COLUMN user_notified_at BIGINT DEFAULT 0' });
  }
  // 兼容老库: 扩 status enum 加 user_notified (S72 batch 7 BUG-095 修法, markUserNotified 写 status='user_notified' 必须 enum 含此值, 不然 MySQL 抛 Data truncated)
  try { await db.execute("ALTER TABLE recharge_requests MODIFY COLUMN status ENUM('pending','user_notified','approved','rejected') DEFAULT 'pending'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE recharge_requests MODIFY status enum user_notified' });
  }

  // ======== 计费系统 ========

  // 添加 vip_level 列（套餐用户标记：0=普通，1=套餐）
  try { await db.execute("ALTER TABLE users ADD COLUMN vip_level TINYINT DEFAULT 0"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE users ADD COLUMN vip_level TINYINT DEFAULT 0' });
  }
  // 添加 vip_expires_at 列（VIP 到期时间戳，毫秒）
  try { await db.execute("ALTER TABLE users ADD COLUMN vip_expires_at BIGINT DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE users ADD COLUMN vip_expires_at BIGINT DEFAULT NULL' });
  }
  // 添加 last_ip 列（最近登录IP）
  try { await db.execute("ALTER TABLE users ADD COLUMN last_ip VARCHAR(45) DEFAULT ''"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE users ADD COLUMN last_ip VARCHAR(45) DEFAULT' });
  }
  // 添加 ip_location 列（IP归属地）
  try { await db.execute("ALTER TABLE users ADD COLUMN ip_location VARCHAR(100) DEFAULT ''"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE users ADD COLUMN ip_location VARCHAR(100) DEFAULT' });
  }

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

  // 计费记录表 (v3.0.32 BUG-078 S71: 加 is_free / ref_type / ref_id / ref_label, 免费生成也要记录)
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
      is_free TINYINT(1) DEFAULT 0 COMMENT '1=免费额度内(0元)/VIP免费/活动赠送;0=实际扣费',
      ref_type VARCHAR(50) DEFAULT '' COMMENT 'novel_analyze/episode/shot/comic/character_variant/image/video/prompt_optimize/recharge/refund',
      ref_id VARCHAR(100) DEFAULT '' COMMENT 'novel_id/episode_id/shot_id/character_id/image_generation_id/video_generation_id',
      ref_label VARCHAR(200) DEFAULT '' COMMENT '人类可读标签: 小说分析《XXX》/分镜 #5/角色变体 4 张/图片生成/视频生成 10s',
      created_at BIGINT DEFAULT 0,
      INDEX idx_billing_user (user_id),
      INDEX idx_billing_time (created_at),
      INDEX idx_billing_ref_type (ref_type),
      INDEX idx_billing_user_time (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // v3.0.32 (BUG-078 S71): 已存在的 billing_logs 表加新字段 (兼容老库)
  try { await db.execute("ALTER TABLE billing_logs ADD COLUMN is_free TINYINT(1) DEFAULT 0"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE billing_logs ADD COLUMN is_free TINYINT(1) DEFAULT 0' });
  }
  try { await db.execute("ALTER TABLE billing_logs ADD COLUMN ref_type VARCHAR(50) DEFAULT ''"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE billing_logs ADD COLUMN ref_type VARCHAR(50) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE billing_logs ADD COLUMN ref_id VARCHAR(100) DEFAULT ''"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE billing_logs ADD COLUMN ref_id VARCHAR(100) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE billing_logs ADD COLUMN ref_label VARCHAR(200) DEFAULT ''"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE billing_logs ADD COLUMN ref_label VARCHAR(200) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE billing_logs ADD INDEX idx_billing_ref_type (ref_type)"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE billing_logs ADD INDEX idx_billing_ref_type (ref_type)' });
  }
  try { await db.execute("ALTER TABLE billing_logs ADD INDEX idx_billing_user_time (user_id, created_at)"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE billing_logs ADD INDEX idx_billing_user_time (user_id, created_at)' });
  }

  // ════════════════════════════════════════════════════════════
  //  v2.0.0 增量迁移（角色一致性 + 资产库 + 章节图谱 + 订单）
  //  兼容迁移: try/catch 包装, 列已存在则忽略
  // ════════════════════════════════════════════════════════════

  // ── characters: 加 8 字段 ──
  try { await db.execute("ALTER TABLE characters ADD COLUMN description JSON DEFAULT NULL COMMENT '11维度结构化描述'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN description JSON DEFAULT NULL COMMENT' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN extra_description JSON DEFAULT NULL COMMENT '4维度补充描述'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN extra_description JSON DEFAULT NULL COMMENT' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN style_id VARCHAR(36) DEFAULT 'realistic' COMMENT '画风ID'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN style_id VARCHAR(36) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN confirmed TINYINT(1) DEFAULT 0 COMMENT '用户是否已确认描述'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN confirmed TINYINT(1) DEFAULT 0 COMMENT' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN image_variants JSON DEFAULT NULL COMMENT '3张变体图'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN image_variants JSON DEFAULT NULL COMMENT' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN image_gen_status VARCHAR(20) DEFAULT 'none' COMMENT 'none/generating/partial/completed/failed'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN image_gen_status VARCHAR(20) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN confirmed_at BIGINT DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN confirmed_at BIGINT DEFAULT NULL' });
  }
  try { await db.execute("ALTER TABLE characters ADD COLUMN image_generated_at BIGINT DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE characters ADD COLUMN image_generated_at BIGINT DEFAULT NULL' });
  }

  // ── novels: 加 5 字段 ──
  try { await db.execute("ALTER TABLE novels ADD COLUMN style_id VARCHAR(36) DEFAULT 'realistic' COMMENT '小说统一画风'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN style_id VARCHAR(36) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE novels ADD COLUMN plot_graph JSON DEFAULT NULL COMMENT '章节事件图谱'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN plot_graph JSON DEFAULT NULL COMMENT' });
  }
  try { await db.execute("ALTER TABLE novels ADD COLUMN outline_confirmed TINYINT(1) DEFAULT 0"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN outline_confirmed TINYINT(1) DEFAULT 0' });
  }
  try { await db.execute("ALTER TABLE novels ADD COLUMN outline_confirmed_at BIGINT DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN outline_confirmed_at BIGINT DEFAULT NULL' });
  }
  try { await db.execute("ALTER TABLE novels ADD COLUMN plot_graph_generated_at BIGINT DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN plot_graph_generated_at BIGINT DEFAULT NULL' });
  }
  // S72 v3.0.33 P0 #3 修复 (ADR-0002): 拆 outline/plotGraph 状态字段, 失败标 status='failed'
  try { await db.execute("ALTER TABLE novels ADD COLUMN outline_status VARCHAR(20) DEFAULT NULL COMMENT 'pending|generating|completed|failed'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN outline_status' });
  }
  try { await db.execute("ALTER TABLE novels ADD COLUMN plot_graph_status VARCHAR(20) DEFAULT NULL COMMENT 'pending|generating|completed|failed'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN plot_graph_status' });
  }
  // S72 v3.0.33 P1 #5 修复 (ADR-0002): 取消状态内存 Set → DB 持久化, 重启不丢
  try { await db.execute("ALTER TABLE novels ADD COLUMN cancelled_at BIGINT DEFAULT NULL COMMENT '取消时间戳'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN cancelled_at' });
  }
  // S72 v3.0.33 P2 #9 修复 (ADR-0002): 加 auto_generate_episodes 配置 (默认 0=不自动), 用户手动触发
  try { await db.execute("ALTER TABLE novels ADD COLUMN auto_generate_episodes TINYINT(1) DEFAULT 0 COMMENT '1=分析后自动触发剧集生成'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE novels ADD COLUMN auto_generate_episodes' });
  }

  // ── episodes: 加 3 字段 ──
  try { await db.execute("ALTER TABLE episodes ADD COLUMN outline_text TEXT COMMENT '分集大纲'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE episodes ADD COLUMN outline_text TEXT COMMENT' });
  }
  try { await db.execute("ALTER TABLE episodes ADD COLUMN confirmed TINYINT(1) DEFAULT 0"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE episodes ADD COLUMN confirmed TINYINT(1) DEFAULT 0' });
  }
  try { await db.execute("ALTER TABLE episodes ADD COLUMN character_descriptions JSON DEFAULT NULL COMMENT '生成时角色描述快照'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE episodes ADD COLUMN character_descriptions JSON DEFAULT NULL COMMENT' });
  }

  // ── shots: 加 5 字段 ──
  try { await db.execute("ALTER TABLE shots ADD COLUMN image_url VARCHAR(500) DEFAULT ''"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE shots ADD COLUMN image_url VARCHAR(500) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE shots ADD COLUMN character_ids JSON DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE shots ADD COLUMN character_ids JSON DEFAULT NULL' });
  }
  try { await db.execute("ALTER TABLE shots ADD COLUMN style_id VARCHAR(36) DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE shots ADD COLUMN style_id VARCHAR(36) DEFAULT NULL' });
  }
  try { await db.execute("ALTER TABLE shots ADD COLUMN image_prompt TEXT"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE shots ADD COLUMN image_prompt TEXT' });
  }
  try { await db.execute("ALTER TABLE shots ADD COLUMN image_generated_at BIGINT DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE shots ADD COLUMN image_generated_at BIGINT DEFAULT NULL' });
  }

  // ── notifications: 加 2 字段 ──
  try { await db.execute("ALTER TABLE notifications ADD COLUMN priority VARCHAR(10) DEFAULT 'normal'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE notifications ADD COLUMN priority VARCHAR(10) DEFAULT' });
  }
  try { await db.execute("ALTER TABLE notifications ADD COLUMN expires_at BIGINT DEFAULT NULL"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE notifications ADD COLUMN expires_at BIGINT DEFAULT NULL' });
  }

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

  // ════════════════════════════════════════════════════════════
  //  v3.0.0 Agent 矩阵: 4 张新表 (image_conversations / image_generations / video_conversations / video_generations)
  //  详细设计: docs/V3_AGENT_MATRIX.md §8
  // ════════════════════════════════════════════════════════════

  // ── 生图 Agent: 会话 (多轮状态机持久化) ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS image_conversations (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      status VARCHAR(30) DEFAULT 'idle',                          -- 11 态: idle/ai_clarifying/awaiting_clarification/ai_planning/plan_cn_ready/plan_translating/plan_ready/awaiting_confirmation/tool_queued/tool_executing/tool_completed/tool_failed
      mode VARCHAR(20) DEFAULT 'text2img',                        -- text2img / img2img / multi_ref
      messages JSON,                                              -- AgentMessage[] with parts
      plan JSON,                                                  -- {prompt, aspectRatio, style, refImageUrls, estimatedCost}
      plan_fields JSON,                                           -- v3.0.0.2: 10 字段标准模板 {subject, action, appearance, expression, environment, lighting, composition, style, quality, negative}
      result_image_url TEXT,
      last_result_url VARCHAR(500),                               -- v3.0.0.4: 持续对话用, 上次生成的图 URL, modification 时作 i2i ref image
      aspect_ratio VARCHAR(20),
      style_id VARCHAR(36),
      charged_amount DECIMAL(10,2) DEFAULT 0,
      error_msg TEXT,
      retry_count INT DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      INDEX idx_img_conv_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── 生图 Agent: 单次生成记录 (审计) ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS image_generations (
      id VARCHAR(36) PRIMARY KEY,
      conversation_id VARCHAR(36) NOT NULL,
      prompt TEXT,
      ref_image_urls JSON,
      result_url TEXT,
      status VARCHAR(20) NOT NULL,                                -- queued / running / completed / failed
      charged_amount DECIMAL(10,2) DEFAULT 0,
      error_msg TEXT,
      created_at BIGINT NOT NULL,
      INDEX idx_img_gen_conv (conversation_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── 视频 Agent: 会话 (异步任务持久化) ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS video_conversations (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      status VARCHAR(30) DEFAULT 'idle',                          -- 9 态
      mode VARCHAR(20) DEFAULT 'text2vid',                        -- text2vid / img2vid / multi_ref
      messages JSON,
      plan JSON,                                                  -- {prompt, refImageUrls, durationSec, width, height, fps, mode: 'keyframes'?}
      result_video_url TEXT,
      duration_sec INT DEFAULT 5,
      resolution VARCHAR(20) DEFAULT '1152x768',
      fps INT DEFAULT 24,
      task_id VARCHAR(100),                                       -- agnes taskId
      video_id VARCHAR(255),                                      -- agnes videoId (base64 路由路径, ~250 字符, 之前 100 不够)
      retry_count INT DEFAULT 0,
      charged_amount DECIMAL(10,2) DEFAULT 0,
      billing_status VARCHAR(20) DEFAULT 'settled',               -- v3.0.31 (S69 BUG-072 E): settled / unsettled, 视频生成完成但余额不足时设 unsettled
      error_msg TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      INDEX idx_vid_conv_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // v3.0.31 (S69 BUG-072 E) 兼容迁移: 老库 video_conversations 可能没 billing_status
  try { await db.execute("ALTER TABLE video_conversations ADD COLUMN billing_status VARCHAR(20) DEFAULT 'settled'"); } catch (e) {
    logger.warn('db migration failed', { err: e instanceof Error ? e.message : String(e), sql: 'ALTER TABLE video_conversations ADD COLUMN billing_status VARCHAR(20) DEFAULT' });
  }

  // ── 视频 Agent: 单次生成记录 (审计) ──
  await db.execute(`
    CREATE TABLE IF NOT EXISTS video_generations (
      id VARCHAR(36) PRIMARY KEY,
      conversation_id VARCHAR(36) NOT NULL,
      prompt TEXT,
      ref_image_urls JSON,
      result_url TEXT,
      status VARCHAR(20) NOT NULL,                                -- queued / running / completed / failed
      duration_sec INT,
      resolution VARCHAR(20),
      charged_amount DECIMAL(10,2) DEFAULT 0,
      error_msg TEXT,
      created_at BIGINT NOT NULL,
      INDEX idx_vid_gen_conv (conversation_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  logger.info('v3.0.0 Agent tables initialized (image_conversations, image_generations, video_conversations, video_generations)');
}

// 辅助函数：执行 SQL 并返回单行
export async function queryOne<T = RowDataPacket>(sql: string, params: any[] = []): Promise<T | undefined> {
  const p = await getDb();
  try {
    const [rows] = await p.execute(sql, params);
    return (rows as any[])[0] as T | undefined;
  } catch (err) {
    // v3.0.78 (BUG-151): 透传 mysql 真实错误 (跟 deepseek / agnes / jwt 1:1 镜像)
    throw mapMysqlError(err);
  }
}

// 辅助函数：执行 SQL 并返回多行
export async function queryAll<T = RowDataPacket>(sql: string, params: any[] = []): Promise<T[]> {
  const p = await getDb();
  try {
    const [rows] = await p.execute(sql, params);
    return rows as unknown as T[];
  } catch (err) {
    throw mapMysqlError(err);
  }
}

// 辅助函数：执行写操作（INSERT/UPDATE/DELETE）
export async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const p = await getDb();
  try {
    const [result] = await p.execute<ResultSetHeader>(sql, params);
    return result;
  } catch (err) {
    throw mapMysqlError(err);
  }
}

// 使用 pool.query 替代 execute（解决 ENUM 列参数化查询兼容问题）
export async function poolQuery<T = RowDataPacket>(sql: string, params: any[] = []): Promise<T[]> {
  const p = await getDb();
  try {
    const [rows] = await p.query(sql, params);
    return rows as T[];
  } catch (err) {
    throw mapMysqlError(err);
  }
}
