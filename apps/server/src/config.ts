import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function resolveDeepseekApiKeys(): string[] {
  const multiKeys = process.env.DEEPSEEK_API_KEYS;
  if (multiKeys && multiKeys.trim()) {
    return multiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  const singleKey = process.env.DEEPSEEK_API_KEY;
  if (singleKey && singleKey.trim()) return [singleKey.trim()];
  return [];
}

export const config = {
  port: parseInt(process.env.PORT || '6000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // LLM API
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekApiKeys: resolveDeepseekApiKeys(),
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',

  // MySQL
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ai_script',
  },

  // File Upload
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'),

  // v3.0.78 (BUG-150 实战沉淀): 删掉 v2.x 历史遗留死代码 (码支付 Epay 集成, shipin-app 早改人工审核模式, 这些字段 0 个 service/route 引用)
  // - payPid / payKey / paySubmitUrl / payNotifyBase: 0 个引用 (深挖审查 4 发现, BUG-147 改 PAY_NOTIFY_BASE IP 是无用功)
  // - qrCodeUrl: 真实使用, 保留
  // - qrLocalPath: v2.5.36 修复后已无引用, 可清理 (但保留以防历史回滚)

  // 支付宝收款码 (用户扫码人工转账, 管理员后台审核)
  qrCodeUrl: process.env.QR_CODE_URL || 'https://maque.uno/QRerweima/5c32eec856f39a0b87a7f9310bc6cf7e.jpg',
  // v2.5.36: 二维码本地路径从 env 读, 避免硬编码
  qrLocalPath: process.env.QR_LOCAL_PATH || '/www/wwwroot/sparrow-logic/QRerweima/QR.png',
  // v2.5.36: 日志目录从 env 读, 避免 cwd 变化时写错位置
  logDir: process.env.LOG_DIR || './logs',
};

if (config.deepseekApiKeys.length === 0) {
  console.warn('Warning: DEEPSEEK_API_KEYS is not set');
}
