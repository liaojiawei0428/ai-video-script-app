-- ════════════════════════════════════════════════════════════
--  v1.2.0 → v2.0.0 增量迁移脚本
--  执行方式: mysql -h10.1.0.11 -uroot -p ai_script < v1.2-to-v2.0.sql
--  兼容回滚: 备份文件 /www/backup/ai-script-migration/ai_script-*.sql
--  备份时间: 2026-06-04
--  数据库: ai_script (10.1.0.11:3306)
--  风险等级: 低 (只新增字段/表, 不删/不改原有)
-- ════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. characters 表: 加 5 字段 ──
-- description: 11 维度结构化描述 JSON
-- extra_description: 4 维度补充描述 JSON
-- style_id: 画风
-- confirmed: 用户是否已确认描述
-- image_variants: 3 张变体图 JSON
-- image_gen_status: 生图状态
-- confirmed_at: 确认时间戳
-- image_generated_at: 生图完成时间戳
ALTER TABLE characters
  ADD COLUMN description JSON DEFAULT NULL COMMENT '11维度结构化描述',
  ADD COLUMN extra_description JSON DEFAULT NULL COMMENT '4维度补充描述',
  ADD COLUMN style_id VARCHAR(36) DEFAULT 'realistic' COMMENT '画风ID',
  ADD COLUMN confirmed TINYINT(1) DEFAULT 0 COMMENT '用户是否已确认描述',
  ADD COLUMN image_variants JSON DEFAULT NULL COMMENT '3张变体图 [{angle,url,prompt,seed,createdAt}]',
  ADD COLUMN image_gen_status VARCHAR(20) DEFAULT 'none' COMMENT 'none/generating/partial/completed/failed',
  ADD COLUMN confirmed_at BIGINT DEFAULT NULL COMMENT '确认时间戳',
  ADD COLUMN image_generated_at BIGINT DEFAULT NULL COMMENT '生图完成时间戳';

-- 兼容迁移: 已存在列则忽略
-- (MySQL 不支持 IF NOT EXISTS 在 ADD COLUMN, 报错请忽略, 表示列已存在)

-- ── 2. novels 表: 加 3 字段 ──
ALTER TABLE novels
  ADD COLUMN style_id VARCHAR(36) DEFAULT 'realistic' COMMENT '小说统一画风',
  ADD COLUMN plot_graph JSON DEFAULT NULL COMMENT '章节事件图谱',
  ADD COLUMN outline_confirmed TINYINT(1) DEFAULT 0 COMMENT '分集大纲是否已确认',
  ADD COLUMN outline_confirmed_at BIGINT DEFAULT NULL COMMENT '大纲确认时间',
  ADD COLUMN plot_graph_generated_at BIGINT DEFAULT NULL COMMENT 'plotGraph 生成时间';

-- ── 3. episodes 表: 加 3 字段 ──
ALTER TABLE episodes
  ADD COLUMN outline_text TEXT COMMENT '分集大纲（确认前内容）',
  ADD COLUMN confirmed TINYINT(1) DEFAULT 0 COMMENT '剧本是否已确认生成',
  ADD COLUMN character_descriptions JSON DEFAULT NULL COMMENT '生成时角色描述快照';

-- ── 4. shots 表: 加 4 字段 ──
ALTER TABLE shots
  ADD COLUMN image_url VARCHAR(500) DEFAULT '' COMMENT '镜头参考图URL',
  ADD COLUMN character_ids JSON DEFAULT NULL COMMENT '镜头涉及角色ID列表',
  ADD COLUMN style_id VARCHAR(36) DEFAULT NULL COMMENT '画风（继承自小说）',
  ADD COLUMN image_prompt TEXT COMMENT 'AI生图prompt',
  ADD COLUMN image_generated_at BIGINT DEFAULT NULL COMMENT '生图时间';

-- ── 5. 新表: assets 资产库 ──
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统一资产库(v2.0只用到character)';

-- ── 6. 新表: chapters 章节表 ──
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小说章节(用于分集大纲按章节规划)';

-- ── 7. 新表: points_orders 积分订单 ──
CREATE TABLE IF NOT EXISTS points_orders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL COMMENT 'recharge/consumption/refund',
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/completed/failed/refunded/cancelled',
  payment_method VARCHAR(30) DEFAULT '',
  transaction_id VARCHAR(100) DEFAULT '',
  related_id VARCHAR(36) DEFAULT '' COMMENT '关联ID(如消费对应的novel_id)',
  remark VARCHAR(500) DEFAULT '',
  created_at BIGINT DEFAULT 0,
  completed_at BIGINT DEFAULT NULL,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分订单';

-- ── 8. 新表: style_presets 画风预设 ──
CREATE TABLE IF NOT EXISTS style_presets (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE COMMENT 'realistic/ancient/cyber/anime/3d',
  label VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  prompt_suffix TEXT,
  sample_image_url VARCHAR(500) DEFAULT '',
  is_default TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at BIGINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='画风预设';

-- 初始化 5 个画风 seed
INSERT INTO style_presets (id, name, label, description, prompt_suffix, sample_image_url, is_default, sort_order, created_at) VALUES
  ('sp_realistic', 'realistic', '写实电影风', '真人质感, 电影级光影, 写实摄影, 高细节', 'photorealistic, cinematic lighting, high detail, 8K, film grain, DSLR quality, real human skin texture, natural color grading', '/static/styles/realistic.png', 1, 1, UNIX_TIMESTAMP() * 1000),
  ('sp_ancient',   'ancient',   '古风水墨',   '中国传统水墨画风格, 飘逸写意, 古韵悠长', 'Chinese ink painting, traditional shuimo style, flowing brushwork, misty mountains, ancient costume, elegant composition, rice paper texture', '/static/styles/ancient.png', 0, 2, UNIX_TIMESTAMP() * 1000),
  ('sp_cyber',     'cyber',     '赛博朋克',   '未来科技感, 霓虹灯光, 数字朋克美学', 'cyberpunk aesthetic, neon lights, futuristic, holographic displays, dark urban atmosphere, rain-soaked streets, high-tech low-life', '/static/styles/cyber.png', 0, 3, UNIX_TIMESTAMP() * 1000),
  ('sp_anime',     'anime',     '动漫风',     '日系动漫插画, 鲜艳色彩, 精致线条', 'anime style illustration, vibrant colors, detailed line art, expressive eyes, cel shading, studio quality, Japanese animation aesthetic', '/static/styles/anime.png', 0, 4, UNIX_TIMESTAMP() * 1000),
  ('sp_3d',        '3d',        '3D 渲染',    '3D 渲染风, Pixar 质感, 半写实卡通', '3D render, Pixar style, soft lighting, subsurface scattering, stylized realism, octane render, depth of field', '/static/styles/3d.png', 0, 5, UNIX_TIMESTAMP() * 1000)
ON DUPLICATE KEY UPDATE label=VALUES(label), description=VALUES(description), prompt_suffix=VALUES(prompt_suffix), sort_order=VALUES(sort_order);

-- ── 9. 通知表: 加 2 字段（v2.0 通知升级） ──
ALTER TABLE notifications
  ADD COLUMN priority VARCHAR(10) DEFAULT 'normal' COMMENT 'low/normal/high',
  ADD COLUMN expires_at BIGINT DEFAULT NULL COMMENT '过期时间';

SET FOREIGN_KEY_CHECKS = 1;

-- ════════════════════════════════════════════════════════════
--  迁移完成. 验证:
--  SHOW TABLES; -- 应看到 assets/chapters/points_orders/style_presets
--  DESC characters; -- 应有 8 个新字段
--  DESC novels; -- 应有 5 个新字段
--  DESC episodes; -- 应有 3 个新字段
--  DESC shots; -- 应有 5 个新字段
--  SELECT COUNT(*) FROM style_presets; -- 应为 5
-- ════════════════════════════════════════════════════════════
