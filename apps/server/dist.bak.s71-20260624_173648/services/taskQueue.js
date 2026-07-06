"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueue = void 0;
const websocket_1 = require("./websocket");
const db_1 = require("../models/db");
const logger_1 = require("../utils/logger");
const MAX_GLOBAL = 20;
const MAX_PER_USER = 2;
class TaskQueue {
    running = new Map();
    waiting = [];
    isQueuedOrRunning(novelId) {
        return this.running.has(novelId) || this.waiting.some(i => i.novelId === novelId);
    }
    getExistingTaskId(novelId) {
        const running = this.running.get(novelId);
        if (running)
            return running.taskId;
        const waiting = this.waiting.find(i => i.novelId === novelId);
        return waiting?.taskId;
    }
    getUserRunningCount(userId) {
        let count = 0;
        for (const [, item] of this.running) {
            if (item.userId === userId)
                count++;
        }
        return count;
    }
    getRunningCount() {
        return this.running.size;
    }
    getWaitingCount() {
        return this.waiting.length;
    }
    getQueuePosition(novelId) {
        const idx = this.waiting.findIndex(i => i.novelId === novelId);
        return idx >= 0 ? idx + 1 : 0;
    }
    enqueue(novelId, userId, taskId, executor, taskType) {
        const userIdKey = userId || novelId;
        const existing = this.running.get(novelId) || this.waiting.find(i => i.novelId === novelId);
        if (existing) {
            if (taskType === 'episode_generate' && existing.taskType !== 'episode_generate') {
                logger_1.logger.info('Replacing non-episode task with episode_generate', { novelId, oldTaskId: existing.taskId, newTaskId: taskId });
                if (this.running.has(novelId))
                    this.running.delete(novelId);
                else
                    this.waiting = this.waiting.filter(i => i.novelId !== novelId);
            }
            else {
                logger_1.logger.warn('Task already queued or running', { novelId, taskId });
                return;
            }
        }
        const item = { novelId, userId: userIdKey, taskId, executor };
        item.taskType = taskType;
        if (this.running.size < MAX_GLOBAL && this.getUserRunningCount(userIdKey) < MAX_PER_USER) {
            this.startTask(item);
            return;
        }
        this.waiting.push(item);
        this.broadcastQueueState(novelId);
        logger_1.logger.info('Task enqueued', { novelId, taskId, position: this.waiting.length, waitingTotal: this.waiting.length, runningTotal: this.running.size });
    }
    cancel(novelId) {
        if (this.running.has(novelId)) {
            this.running.delete(novelId);
        }
        this.waiting = this.waiting.filter(i => i.novelId !== novelId);
        logger_1.logger.info('Task cancelled', { novelId });
    }
    startTask(item) {
        this.running.set(item.novelId, item);
        this.broadcastQueueState(item.novelId);
        (0, db_1.execute)("UPDATE task_jobs SET status = 'running', updated_at = ? WHERE id = ?", [Date.now(), item.taskId]).catch(e => logger_1.logger.warn('Failed to update task status to running', { taskId: item.taskId, error: e }));
        logger_1.logger.info('Task started', { novelId: item.novelId, taskId: item.taskId, running: this.running.size, waiting: this.waiting.length });
        item.executor()
            .then(() => this.settle(item))
            .catch(() => this.settle(item));
    }
    settle(item) {
        this.running.delete(item.novelId);
        logger_1.logger.info('Task settled', { novelId: item.novelId, taskId: item.taskId, running: this.running.size, waiting: this.waiting.length });
        this.tryDequeue();
    }
    tryDequeue() {
        for (let i = 0; i < this.waiting.length; i++) {
            const item = this.waiting[i];
            if (this.running.size < MAX_GLOBAL && this.getUserRunningCount(item.userId) < MAX_PER_USER) {
                this.waiting.splice(i, 1);
                this.startTask(item);
                return;
            }
        }
        for (const item of this.waiting) {
            this.broadcastQueueState(item.novelId);
        }
    }
    broadcastQueueState(novelId) {
        const position = this.getQueuePosition(novelId);
        websocket_1.websocketService.broadcastQueueStatus(novelId, position, this.running.size, this.waiting.length);
    }
}
exports.taskQueue = new TaskQueue();
