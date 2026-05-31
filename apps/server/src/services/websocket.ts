import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { taskJobModel } from '../models/taskJob';
import { novelModel } from '../models/novel';
import { episodeModel } from '../models/episode';
import type { ChunkProgress } from '../shared/types';

interface ClientConnection {
  ws: WebSocket;
  novelId?: string;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();

  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, { ws });

      logger.info('WebSocket client connected', { clientId, ip: req.socket.remoteAddress });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribe' && message.novelId) {
            const client = this.clients.get(clientId);
            if (client) {
              client.novelId = message.novelId;
              logger.info('Client subscribed to novel', { clientId, novelId: message.novelId });
              // 回复确认
              ws.send(JSON.stringify({ type: 'subscribed', novelId: message.novelId }));
              // 发送当前进度快照（查询最近的 task_job）
              this.sendProgressSnapshot(ws, message.novelId);
            }
          } else if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch {
          // Ignore invalid messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', { clientId });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { clientId, error });
        this.clients.delete(clientId);
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', clientId }));
    });

    logger.info('WebSocket server initialized');
  }

  broadcastToNovel(novelId: string, data: unknown): void {
    const message = JSON.stringify(data);
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.novelId === novelId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      logger.debug('WebSocket broadcast', { novelId, clientCount: sentCount });
    }
  }

  broadcastProgress(novelId: string, progress: number, status: string, extra?: Record<string, unknown>): void {
    this.broadcastToNovel(novelId, {
      type: 'progress',
      novelId,
      progress,
      status,
      ...extra,
      timestamp: Date.now(),
    });
  }

  broadcastLlmUpdate(novelId: string, data: { phase: string; step: string; content: string; tokens?: number; stream?: boolean }): void {
    this.broadcastToNovel(novelId, {
      type: 'llm_update',
      novelId,
      phase: data.phase,
      step: data.step,
      content: data.content,
      tokens: data.tokens,
      stream: data.stream || false,
      timestamp: Date.now(),
    });
  }

  broadcastChunkProgress(novelId: string, progress: ChunkProgress): void {
    this.broadcastToNovel(novelId, {
      type: 'chunk_progress',
      novelId,
      ...progress,
      timestamp: Date.now(),
    });
  }

  broadcastChunkStream(novelId: string, chunkIndex: number, content: string): void {
    this.broadcastToNovel(novelId, {
      type: 'chunk_stream',
      novelId,
      chunkIndex,
      content,
      timestamp: Date.now(),
    });
  }

  broadcastTaskUpdate(novelId: string, task: { id: string; status: string; progress: number }): void {
    this.broadcastToNovel(novelId, {
      type: 'task_update',
      novelId,
      task,
      timestamp: Date.now(),
    });
  }

  broadcastQueueStatus(novelId: string, position: number, runningCount: number, waitingCount: number): void {
    this.broadcastToNovel(novelId, {
      type: 'queue_status',
      novelId,
      position,
      runningCount,
      waitingCount,
      timestamp: Date.now(),
    });
  }

  broadcastBalanceUpdate(novelId: string, balance: number): void {
    this.broadcastToNovel(novelId, {
      type: 'balance_update',
      novelId,
      balance,
      timestamp: Date.now(),
    });
  }

  private async sendProgressSnapshot(ws: WebSocket, novelId: string): Promise<void> {
    try {
      const novel = await novelModel.findById(novelId);
      if (!novel) {
        // 小说已删除，通知客户端
        ws.send(JSON.stringify({
          type: 'progress',
          novelId,
          progress: 0,
          status: 'error',
          detail: '小说不存在或已被删除',
          timestamp: Date.now(),
        }));
        return;
      }
      // 发送当前 novel 状态（直接使用真实状态，不做映射）
      ws.send(JSON.stringify({
        type: 'progress',
        novelId,
        progress: novel.status === 'analyzed' ? 100 : 0,
        status: novel.status,
        timestamp: Date.now(),
      }));
      // 如果已完成分析或生成，不再发送任务更新，避免客户端误认为仍在进行
      if (novel.status === 'analyzed' || novel.status === 'completed') {
        return;
      }
      // 查找最近的 task_job 获取详细进度
      const task = await taskJobModel.findLatestByNovelId(novelId);
      if (task) {
        ws.send(JSON.stringify({
          type: 'task_update',
          novelId,
          task: {
            id: task.id,
            status: task.status,
            progress: task.progress,
            currentStep: task.currentStep,
            totalSteps: task.totalSteps,
          },
          timestamp: Date.now(),
        }));
        // 发送进度事件
        let taskStatus: string = task.status;
        if (task.status === 'running') {
          taskStatus = novel.status === 'analyzing' ? 'analyzing' : 'generating';
        }
        // 查询已生成的剧集数和总集数
        let currentEpisode = 0;
        try {
          const eps = await episodeModel.findByNovelId(novelId);
          if (eps.length > 0) {
            currentEpisode = Math.max(...eps.map(e => e.episodeNumber));
          }
        } catch {}
        let totalEpisodes = 0;
        if (novel.totalChars > 0) {
          const charsPerEpisode = Math.round(1050 * 3.5);
          totalEpisodes = Math.min(500, Math.max(1, Math.ceil(novel.totalChars / charsPerEpisode)));
        }
        ws.send(JSON.stringify({
          type: 'progress',
          novelId,
          progress: Math.max(task.progress, 1),
          status: taskStatus,
          totalEpisodes,
          currentEpisode,
          currentStep: task.currentStep || 1,
          totalSteps: task.totalSteps || 5,
          timestamp: Date.now(),
        }));
      }
    } catch (e) {
      logger.warn('Failed to send progress snapshot', { novelId, error: e });
    }
  }

  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const websocketService = new WebSocketService();
