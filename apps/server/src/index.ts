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

// APP版本检查（公开接口）
app.get('/api/version', (req, res) => {
  const currentVersion = process.env.APP_VERSION || '1.0.0';
  const clientVersion = req.query.version as string || '0.0.0';
  const needUpdate = compareVersions(currentVersion, clientVersion) > 0;
  res.json({
    success: true,
    data: {
      version: currentVersion,
      downloadUrl: 'https://maque.uno/app/DeepScript_v' + currentVersion + '.apk',
      changelog: '优化性能，修复已知问题',
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

app.use('/api/novels', novelRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling
app.use(errorHandler);

// Initialize WebSocket
websocketService.initialize(server);

server.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`WebSocket server available at ws://0.0.0.0:${config.port}/ws`);

  import('./services/deepseekPool').then(({ deepseekPool }) => {
    logger.info(`Deepseek pool ready: ${deepseekPool.keyCount} key(s), ${deepseekPool.totalMaxConcurrent} total AI slots`);
  });
});
