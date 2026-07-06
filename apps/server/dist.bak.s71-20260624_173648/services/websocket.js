"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketService = exports.WebSocketService = void 0;
const ws_1 = require("ws");
const logger_1 = require("../utils/logger");
const taskJob_1 = require("../models/taskJob");
const novel_1 = require("../models/novel");
const episode_1 = require("../models/episode");
class WebSocketService {
    wss = null;
    clients = new Map();
    initialize(server) {
        this.wss = new ws_1.WebSocketServer({ server, path: '/ws' });
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, { ws });
            logger_1.logger.info('WebSocket client connected', { clientId, ip: req.socket.remoteAddress });
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'subscribe' && message.novelId) {
                        const client = this.clients.get(clientId);
                        if (client) {
                            client.novelId = message.novelId;
                            logger_1.logger.info('Client subscribed to novel', { clientId, novelId: message.novelId });
                            // 回复确认
                            ws.send(JSON.stringify({ type: 'subscribed', novelId: message.novelId }));
                            // 发送当前进度快照（查询最近的 task_job）
                            this.sendProgressSnapshot(ws, message.novelId);
                        }
                    }
                    else if (message.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    }
                }
                catch {
                    // Ignore invalid messages
                }
            });
            ws.on('close', () => {
                this.clients.delete(clientId);
                logger_1.logger.info('WebSocket client disconnected', { clientId });
            });
            ws.on('error', (error) => {
                logger_1.logger.error('WebSocket error', { clientId, error });
                this.clients.delete(clientId);
            });
            // Send welcome message
            ws.send(JSON.stringify({ type: 'connected', clientId }));
        });
        logger_1.logger.info('WebSocket server initialized');
    }
    broadcastToNovel(novelId, data) {
        const message = JSON.stringify(data);
        let sentCount = 0;
        for (const [clientId, client] of this.clients) {
            if (client.novelId === novelId && client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(message);
                sentCount++;
            }
        }
        if (sentCount > 0) {
            logger_1.logger.debug('WebSocket broadcast', { novelId, clientCount: sentCount });
        }
    }
    /**
     * v2.5.36: 广播给所有连接 (用于系统通知)
     * 客户端按 data.userId 字段自行过滤
     * 之前 notify.ts 误用 broadcastProgress('__notification__', ...) 走 novelId 过滤,
     *   导致通知实际没推到任何客户端
     */
    broadcastToAll(data) {
        const message = JSON.stringify(data);
        let sentCount = 0;
        for (const [clientId, client] of this.clients) {
            if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(message);
                sentCount++;
            }
        }
        if (sentCount > 0) {
            logger_1.logger.debug('WebSocket broadcast to all', { clientCount: sentCount });
        }
    }
    broadcastProgress(novelId, progress, status, extra) {
        this.broadcastToNovel(novelId, {
            type: 'progress',
            novelId,
            progress,
            status,
            ...extra,
            timestamp: Date.now(),
        });
    }
    broadcastLlmUpdate(novelId, data) {
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
    broadcastChunkProgress(novelId, progress) {
        this.broadcastToNovel(novelId, {
            type: 'chunk_progress',
            novelId,
            ...progress,
            timestamp: Date.now(),
        });
    }
    broadcastChunkStream(novelId, chunkIndex, content) {
        this.broadcastToNovel(novelId, {
            type: 'chunk_stream',
            novelId,
            chunkIndex,
            content,
            timestamp: Date.now(),
        });
    }
    broadcastTaskUpdate(novelId, task) {
        this.broadcastToNovel(novelId, {
            type: 'task_update',
            novelId,
            task,
            timestamp: Date.now(),
        });
    }
    broadcastQueueStatus(novelId, position, runningCount, waitingCount) {
        this.broadcastToNovel(novelId, {
            type: 'queue_status',
            novelId,
            position,
            runningCount,
            waitingCount,
            timestamp: Date.now(),
        });
    }
    broadcastBalanceUpdate(novelId, balance) {
        this.broadcastToNovel(novelId, {
            type: 'balance_update',
            novelId,
            balance,
            timestamp: Date.now(),
        });
    }
    async sendProgressSnapshot(ws, novelId) {
        try {
            const novel = await novel_1.novelModel.findById(novelId);
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
            // 发送当前 novel 状态
            let currentEpisode = 0;
            let totalEpisodes = 0;
            try {
                const eps = await episode_1.episodeModel.findByNovelId(novelId);
                currentEpisode = eps.length > 0 ? Math.max(...eps.map(e => e.episodeNumber)) : 0;
                totalEpisodes = eps.length;
            }
            catch { }
            if (novel.totalChars > 0 && totalEpisodes === 0) {
                const charsPerEpisode = Math.round(1050 * 3.5);
                totalEpisodes = Math.min(500, Math.max(1, Math.ceil(novel.totalChars / charsPerEpisode)));
            }
            ws.send(JSON.stringify({
                type: 'progress',
                novelId,
                progress: novel.status === 'completed' ? 100 : novel.status === 'analyzed' ? 100 : 0,
                status: novel.status,
                totalEpisodes,
                currentEpisode,
                timestamp: Date.now(),
            }));
            if (novel.status === 'analyzed' || novel.status === 'completed') {
                return;
            }
            // 查找最近的 task_job 获取详细进度
            const task = await taskJob_1.taskJobModel.findLatestByNovelId(novelId);
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
                let taskStatus = task.status;
                if (task.status === 'running') {
                    taskStatus = novel.status === 'analyzing' ? 'analyzing' : 'generating';
                }
                // 如果 task 已完成，使用 novel 的真实状态
                if (task.status === 'completed') {
                    taskStatus = novel.status;
                }
                // 查询已生成的剧集数和总集数
                // v2.5.36: 修复 BUG — 之前重复声明 let currentEpisode = 0, shadow 了外层同名变量
                //   导致 if (task) 分支里的 currentEpisode 永远是初始值 0 (用 let 重新声明 = 重新创建变量)
                try {
                    const eps = await episode_1.episodeModel.findByNovelId(novelId);
                    if (eps.length > 0) {
                        currentEpisode = Math.max(...eps.map(e => e.episodeNumber));
                    }
                }
                catch { }
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
        }
        catch (e) {
            logger_1.logger.warn('Failed to send progress snapshot', { novelId, error: e });
        }
    }
    generateClientId() {
        return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getConnectedClientsCount() {
        return this.clients.size;
    }
}
exports.WebSocketService = WebSocketService;
exports.websocketService = new WebSocketService();
