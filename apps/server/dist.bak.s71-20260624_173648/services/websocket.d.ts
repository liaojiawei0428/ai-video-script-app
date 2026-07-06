import { Server as HttpServer } from 'http';
import type { ChunkProgress } from '../shared/types';
export declare class WebSocketService {
    private wss;
    private clients;
    initialize(server: HttpServer): void;
    broadcastToNovel(novelId: string, data: unknown): void;
    /**
     * v2.5.36: 广播给所有连接 (用于系统通知)
     * 客户端按 data.userId 字段自行过滤
     * 之前 notify.ts 误用 broadcastProgress('__notification__', ...) 走 novelId 过滤,
     *   导致通知实际没推到任何客户端
     */
    broadcastToAll(data: unknown): void;
    broadcastProgress(novelId: string, progress: number, status: string, extra?: Record<string, unknown>): void;
    broadcastLlmUpdate(novelId: string, data: {
        phase: string;
        step: string;
        content: string;
        tokens?: number;
        stream?: boolean;
    }): void;
    broadcastChunkProgress(novelId: string, progress: ChunkProgress): void;
    broadcastChunkStream(novelId: string, chunkIndex: number, content: string): void;
    broadcastTaskUpdate(novelId: string, task: {
        id: string;
        status: string;
        progress: number;
    }): void;
    broadcastQueueStatus(novelId: string, position: number, runningCount: number, waitingCount: number): void;
    broadcastBalanceUpdate(novelId: string, balance: number): void;
    private sendProgressSnapshot;
    private generateClientId;
    getConnectedClientsCount(): number;
}
export declare const websocketService: WebSocketService;
