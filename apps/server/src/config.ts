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

  // 码支付（Epay 标准协议）
  payPid: process.env.PAY_PID || '',
  payKey: process.env.PAY_KEY || '',
  paySubmitUrl: process.env.PAY_SUBMIT_URL || 'https://xapi1.swu.cc/xpay/epay/submit.php',
  payNotifyBase: process.env.PAY_NOTIFY_BASE || 'https://maque.uno',

  // 支付宝收款码
  qrCodeUrl: process.env.QR_CODE_URL || 'https://maque.uno/QRerweima/5c32eec856f39a0b87a7f9310bc6cf7e.jpg',
  // v2.5.36: 二维码本地路径从 env 读, 避免硬编码
  qrLocalPath: process.env.QR_LOCAL_PATH || '/www/wwwroot/sparrow-logic/QRerweima/QR.png',
  // v2.5.36: 日志目录从 env 读, 避免 cwd 变化时写错位置
  logDir: process.env.LOG_DIR || './logs',
};

if (config.deepseekApiKeys.length === 0) {
  console.warn('Warning: DEEPSEEK_API_KEYS is not set');
}
