import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';

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
            }
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

  broadcastProgress(novelId: string, progress: number, status: string): void {
    this.broadcastToNovel(novelId, {
      type: 'progress',
      novelId,
      progress,
      status,
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

  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const websocketService = new WebSocketService();
