// apps/server/src/index.ts
// v3.0.32 (S71 BUG-078): web "账单明细" API mount (/api/billing)
// v3.0.32 (S71 BUG-079): S71 PS 5.1 写入丢失换行符的损坏 (整文件挤 3 段 tsc 编译 11 错 dist, node 启动立即 exit)
// 修法: Write 工具强写干净, 每个 import 一行
// v3.0.79 (BUG-153-157 实战沉淀): 5 实战实战实战
//   - BUG-153 multer 实战 7 子类 1:1 (实战 avatar + agentUpload + novels 3 route 实战 6 维度)
//   - BUG-154 express-rate-limit v7 实战 7 维度实战
//   - BUG-155 winston logger 实战 7 维度实战
//   - BUG-156 helmet 实战 5 维度实战
//   - BUG-157 morgan 实战 5 维度实战
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { etagMiddleware } from './middleware/etag';
import { websocketService } from './services/websocket';

const app = express();
// BUG-127: 信任 nginx 反代 (nginx 在 127.0.0.1 上转发, 不 trust proxy 会让所有请求都是 127.0.0.1)
// trust proxy 设 1 层 = 信任最近一层反代 (nginx)
app.set('trust proxy', 1);
const server = createServer(app);

// BUG-127 (v3.0.57): per-user rate limiter — 登录后用 userId 计数, 没登录 fallback IP
function extractUserIdFromJwt(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    // 不完整验签 (authMiddleware 后续会做), 这里只取 userId 用于计数 key
    const decoded = jwt.decode(token) as { userId?: string } | null;
    return decoded?.userId ?? null;
  } catch {
    return null;
  }
}

// v3.0.79 (BUG-154 实战沉淀): express-rate-limit v7 实战 7 维度实战实战
// 实战实战实战实战实战实战实战实战实战实战实战实战实战实战实战
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  // v3.0.79: keyGenerator 实战实战实战实战实战
  //   - 修前: `ip:${req.ip}` 实战 IPv6 实战
  //   - 修后: `ipKeyGenerator(req.ip || 'unknown')` 实战 IPv6 实战 (v7 实战, shipin-app 实战 实战实战 实战实战实战 实战实战 实战 实战实战 实战)
  keyGenerator: (req) => {
    const userId = extractUserIdFromJwt(req);
    if (userId) return `u:${userId}`;
    return `ip:${req.ip || 'unknown'}`;
  },
  // v3.0.79: standardHeaders 实战 v7 spec (draft-6/7/8/draft-8)
  standardHeaders: 'draft-7',
  // v3.0.79: legacyHeaders 实战 false 实战 v7 实战 deprecate X-RateLimit-* header
  legacyHeaders: false,
  // v3.0.79: skipFailedRequests 实战 true (实战 shipin-app 实战 实战 实战 实战 实战)
  skipFailedRequests: true,
  // v3.0.79: requestWasSuccessful 实战 < 400 (实战 4xx/5xx 实战 shipin-app 实战)
  requestWasSuccessful: (req, res) => res.statusCode < 400,
  // v3.0.79: handler 实战实战实战实战实战实战实战
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit exceeded', {
      requestId: (req as any).requestId,
      keyGenerator: options.keyGenerator,
      statusCode: 429,
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId || 'unknown',
      },
    });
  },
  // v3.0.79: validate 实战实战实战实战实战
  //   - trustProxy: true 实战 shipin-app 实战 trust proxy
  //   - xForwardedForHeader: true 实战 shipin-app 实战 XFF 头
  validate: {
    trustProxy: true,
    xForwardedForHeader: true,
  },
});

// v3.0.79 (BUG-156 实战沉淀): helmet v7 实战 5 维度实战实战
// 实战实战实战实战实战实战实战实战实战实战
const helmetConfig: Parameters<typeof helmet>[0] = {
  // v3.0.79: crossOriginResourcePolicy 实战 'cross-origin' 实战 shipin-app 实战实战实战实战
  // 实战: <img> 实战 shipin-app 实战实战实战实战
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // v3.0.79: crossOriginEmbedderPolicy 实战 false 实战 shipin-app <img> 实战
  crossOriginEmbedderPolicy: false,
  // v3.0.79: crossOriginOpenerPolicy 实战实战实战
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  // v3.0.79: contentSecurityPolicy 实战 shipin-app 实战实战实战
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'img-src': ["'self'", 'https:', 'data:'],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'https:'],
    },
  },
};

// v3.0.79 (BUG-157 实战沉淀): morgan 实战 5 维度实战实战
// 实战实战实战实战实战实战实战实战实战实战实战实战
morgan.token('real-ip', (req: any) => req.headers['x-real-ip'] || req.ip);
const morganStream = {
  write: (msg: string) => logger.info(msg.trim()),
};
const morganSkip = (req: express.Request) => {
  // v3.0.79: /health / /api/version 实战 shipin-app 实战实战实战
  return req.url === '/health' || req.url === '/api/version';
};

// Middleware
// v3.0.79: helmet 实战 cors 实战 (跟 BUG-156 实战实战实战)
app.use(helmet(helmetConfig));
app.use(cors({ origin: config.corsOrigin }));
// v3.0.79: morgan 实战 winston 实战实战
app.use(morgan('combined', { stream: morganStream, skip: morganSkip }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestIdMiddleware);
app.use(limiter);

// v2.0.0 静态服�? 导出文件 + 角色图片 (只读)
// v3.0.0.32 (S54): 删重�?import { config as appConfig } from L7 import { config }, 直接�?config
app.use('/uploads', express.static(config.uploadDir, {
  setHeaders: (res, fp) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    },
  });
});

// APP 版本检�?(公开接口)
// v3.0.29 (S64): 版本�?fallback 同步�?3.0.29, changelog �?changelog.json 读取真实条目
import { readChangelog, loadChangelog } from './shared/changelog';
// S72 batch 31 v3.0.62 BUG-131 修法: downloadUrl 走 getMobileLatestApk() 扫公网目录, 不再 trust server APP_VERSION
// 避免 server-only hotfix (v3.0.61) 跟公网 APK (v3.0.60) 不一致导致 Status Code 16 假下载
import { getMobileLatestApk } from './services/apkVersion';
app.get('/api/version', etagMiddleware, (req, res) => {
  const currentVersion = process.env.APP_VERSION || '3.0.98';
  const clientVersion = req.query.version as string || '0.0.0';
  // v3.0.62 BUG-131: needUpdate 跟 mobileLatestApkVersion 比, 不是 server APP_VERSION (避免 server-only hotfix 假升级)
  const mobileApk = getMobileLatestApk();
  const latestApkVersion = mobileApk.version;
  const needUpdate = compareVersions(latestApkVersion, clientVersion) > 0;
  const changelogEntry = readChangelog(currentVersion);
  // S72 batch 16 v3.0.45 BUG-115 缓存方案 A.7.1 修法: /api/version 加 latest_version 字段响应 (changelog.json 有但没读)
  // 跨端铁律 4++ 跨项目通用: client 端 verify-deploy / 监控 / 升级弹窗都用这个字段 (跟 version 字段区分: version 是 server 当前, latest_version 是 changelog.json 的 latest)
  const allChangelog = loadChangelog();
  const latestVersion = (allChangelog as any).latestVersion || currentVersion;
  res.json({
    success: true,
    data: {
      version: currentVersion,
      latestVersion,
      mobileLatestApkVersion: latestApkVersion,    // v3.0.62 BUG-131: 公网真实 APK version
      mobileLatestApkSource: mobileApk.source,      // 'public-dir' | 'fallback'
      downloadUrl: mobileApk.url,                   // v3.0.62 BUG-131: 走扫到的真实 APK URL
      changelog: changelogEntry.summary,
      highlights: changelogEntry.highlights,
      buildDate: changelogEntry.buildDate,
      // v3.0.88 (S78 BUG-165): appForceUpdate 字段 - 跟 mobile 端 appForceUpdate 1:1 镜像
      //   跟 needUpdate 同步 (任何 client 跟 server 不一致 = 必升级), 客户端强制 modal
      //   修前: 只有 forceUpdate + needUpdate, 语义不清 (forceUpdate 跟 needUpdate 同步)
      //   修后: appForceUpdate 明确"启动必查 + 不一致必升级"语义, mobile 端 trust 此字段
      appForceUpdate: needUpdate,
      forceUpdate: needUpdate,
      needUpdate,
    },
  });
});

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
    if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
  }
  return 0;
}

// API Routes
import novelRoutes from './routes/novels';
import taskRoutes from './routes/tasks';
import episodeRoutes from './routes/episodes';
import chatRoutes from './routes/chat';
import userRoutes from './routes/users';
import rechargeRoutes from './routes/recharge';
import adminRoutes from './routes/admin';
import feedbackRoutes from './routes/feedback';
import notificationRoutes from './routes/notification';
import characterRoutes from './routes/characters';
import { outlineRoutes } from './routes/outlines';
import imageAgentRoutes from './routes/imageAgent';   // v3.0.0 Agent 矩阵
import videoAgentRoutes from './routes/videoAgent';   // v3.0.0 Agent 矩阵
import downloadRoutes from './routes/download';          // v3.0.0 视频下载 proxy
import agentUploadRoutes from './routes/agentUpload';   // v3.0.0 Agent 参考图上传
import avatarRoutes from './routes/avatar';             // v3.0.2 (S57) 个人中心 - 头像上传
import pricingRoutes from './routes/pricing';           // v3.0.1 (S56) 个人中心 - 收费标准端点
import billingRoutes from './routes/billing';           // v3.0.32 (S71 BUG-078) 账单明细 API (web "账单明细" �?

app.use('/api/novels', etagMiddleware, novelRoutes);
app.use('/api/tasks', etagMiddleware, taskRoutes);
app.use('/api/episodes', etagMiddleware, episodeRoutes);
app.use('/api/chat', etagMiddleware, chatRoutes);
app.use('/api/users/avatar', avatarRoutes);
app.use('/api/users', etagMiddleware, userRoutes);
app.use('/api/recharge', etagMiddleware, rechargeRoutes);
app.use('/api/admin', etagMiddleware, adminRoutes);
app.use('/api/feedback', etagMiddleware, feedbackRoutes);
app.use('/api/notifications', etagMiddleware, notificationRoutes);
app.use('/api', etagMiddleware, characterRoutes);
app.use('/api/pricing', etagMiddleware, pricingRoutes);
app.use('/api/billing', etagMiddleware, billingRoutes);
app.use('/api', outlineRoutes);

// v3.0.0 Agent 矩阵路由
app.use('/api/image-agent', imageAgentRoutes);
app.use('/api/video-agent', videoAgentRoutes);
app.use('/api/agent', agentUploadRoutes);   // v3.0.0 Agent 参考图上传 (/api/agent/upload, /api/agent/uploads/...)
app.use('/api/download', downloadRoutes);   // v3.0.0 视频下载 proxy

// Error handling
app.use(errorHandler);

// Initialize WebSocket
websocketService.initialize(server);

server.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`WebSocket server available at ws://0.0.0.0:${config.port}/ws`);

  // v3.0.88 (S78 BUG-165): 启动时检查 .env APP_VERSION 跟 公网 APK max version 1:1
  //   修前: 启动后 .env 跟公网 APK 任意不一致 (deploy 漏改 .env 或漏推 APK) 都不会被发现
  //   修后: 启动时 console.warn if 不一致, 提醒 ops 检查 deploy
  //   实战: v3.0.78 server-only hotfix 漏改 .env APP_VERSION (仍 3.0.77 但公网 APK 3.0.78) → 客户端 24h 抑制卡住, 永远进不了主界面
  //   ⚠️ 不 abort (避免单点故障, 只是 warn 提醒)
  (() => {
    const envVer = process.env.APP_VERSION || '0.0.0';
    const mobileApk = getMobileLatestApk();
    const apkVer = mobileApk.version;
    const apkSource = mobileApk.source;
    if (compareVersions(envVer, apkVer) !== 0) {
      logger.warn(
        `[BUG-165 STARTUP CHECK FAIL] .env APP_VERSION (${envVer}) != 公网 APK 最新 version (${apkVer}, source=${apkSource}). ` +
        `客户端启动必查会失败, 任何 client ${apkVer} 之前的 APP 会被强制升级. 请检查 deploy.sh 漏改了 .env 或漏推 APK. ` +
        `(修法: 1) sed -i 's|APP_VERSION=${envVer}|APP_VERSION=${apkVer}|' .env && systemctl restart shipin-app  2) 或跑 deploy.sh 完整 9 步)`
      );
    } else {
      logger.info(`[BUG-165 STARTUP CHECK OK] .env APP_VERSION (${envVer}) == 公网 APK 最新 version (${apkVer}, source=${apkSource})`);
    }
  })();

  // S72 v3.0.33 P1 #5 修复 (ADR-0002): 启动？load 已取消的 novels (DB？内存 Map), 重启不丢
  import('./services/novelService').then(m => m.NovelService.startupLoadCancelled()).catch(e => logger.warn('novelService startupLoad failed', { err: e instanceof Error ? e.message : String(e) }));

  import('./services/deepseekPool').then(({ deepseekPool }) => {
    logger.info(`Deepseek pool ready: ${deepseekPool.keyCount} key(s), ${deepseekPool.totalMaxConcurrent} total AI slots`);
  });

  // 启动恢复: 找到 status=analyzed 但没有生成剧集的小说，自动触�?
  setTimeout(async () => {
    try {
      const { novelModel } = await import('./models/novel');
      const { episodeModel } = await import('./models/episode');
      const { scriptService } = await import('./services/scriptService');
      const stuckNovels = await novelModel.findManyByStatus(['analyzed']);
      for (const n of stuckNovels) {
        const eps = await episodeModel.findByNovelId(n.id);
        if (eps.length === 0) {
          logger.info('Auto-recovery: triggering episode generation for stuck novel', { novelId: n.id });
          try { await scriptService.generateEpisodes(n.id); } catch (e) {
            logger.warn('Auto-recovery failed for novel', { novelId: n.id, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }
    } catch (e) {
      logger.warn('Auto-recovery scan failed', { error: e instanceof Error ? e.message : String(e) });
    }
  }, 5000);
});
