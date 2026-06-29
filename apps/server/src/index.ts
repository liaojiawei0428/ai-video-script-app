// apps/server/src/index.ts
// v3.0.32 (S71 BUG-078): web "账单明细" API mount (/api/billing)
// v3.0.32 (S71 BUG-079): �?S71 PS 5.1 写入丢失换行符的损坏 (整文件挤 3 �? tsc 编译�?11 �?dist, node 启动立即 exit)
// 修法: Write 工具强写干净�? 每个 import 一�?
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { etagMiddleware } from './middleware/etag';
import { websocketService } from './services/websocket';

const app = express();
const server = createServer(app);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'unknown',
    },
  },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(morgan('combined'));
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
app.get('/api/version', etagMiddleware, (req, res) => {
  const currentVersion = process.env.APP_VERSION || '3.0.49';
  const clientVersion = req.query.version as string || '0.0.0';
  const needUpdate = compareVersions(currentVersion, clientVersion) > 0;
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
      downloadUrl: 'https://ab.maque.uno/app/DeepScript_v' + currentVersion + '.apk',
      changelog: changelogEntry.summary,
      highlights: changelogEntry.highlights,
      buildDate: changelogEntry.buildDate,
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

  // S72 v3.0.33 P1 #5 修复 (ADR-0002): 启动�?load 已取消的 novels (DB �?内存 Map), 重启不丢
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
