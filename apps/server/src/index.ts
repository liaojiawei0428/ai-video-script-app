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

// API Routes
import novelRoutes from './routes/novels';
import taskRoutes from './routes/tasks';
import episodeRoutes from './routes/episodes';
import chatRoutes from './routes/chat';
import userRoutes from './routes/users';

app.use('/api/novels', novelRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);

// Error handling
app.use(errorHandler);

// Initialize WebSocket
websocketService.initialize(server);

server.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`WebSocket server available at ws://0.0.0.0:${config.port}/ws`);

  // 初始化 AI 持久化队列（恢复未完成任务）
  import('./services/deepseek').then(({ deepseekService }) => {
    deepseekService.initQueue().catch(e => logger.warn('Queue init skipped', { error: e }));
  });
});
