import { websocketService } from './websocket';
import { execute } from '../models/db';
import { logger } from '../utils/logger';

interface TaskItem {
  novelId: string;
  userId: string;
  taskId: string;
  executor: () => Promise<void>;
}

const MAX_GLOBAL = 20;
const MAX_PER_USER = 2;

class TaskQueue {
  private running: Map<string, TaskItem> = new Map();
  private waiting: TaskItem[] = [];

  isQueuedOrRunning(novelId: string): boolean {
    return this.running.has(novelId) || this.waiting.some(i => i.novelId === novelId);
  }

  getExistingTaskId(novelId: string): string | undefined {
    const running = this.running.get(novelId);
    if (running) return running.taskId;
    const waiting = this.waiting.find(i => i.novelId === novelId);
    return waiting?.taskId;
  }

  getUserRunningCount(userId: string): number {
    let count = 0;
    for (const [, item] of this.running) {
      if (item.userId === userId) count++;
    }
    return count;
  }

  getRunningCount(): number {
    return this.running.size;
  }

  getWaitingCount(): number {
    return this.waiting.length;
  }

  getQueuePosition(novelId: string): number {
    const idx = this.waiting.findIndex(i => i.novelId === novelId);
    return idx >= 0 ? idx + 1 : 0;
  }

  enqueue(novelId: string, userId: string, taskId: string, executor: () => Promise<void>, taskType?: string): void {
    const userIdKey = userId || novelId;

    const existing = this.running.get(novelId) || this.waiting.find(i => i.novelId === novelId);
    if (existing) {
      if (taskType === 'episode_generate' && (existing as any).taskType !== 'episode_generate') {
        logger.info('Replacing non-episode task with episode_generate', { novelId, oldTaskId: existing.taskId, newTaskId: taskId });
        if (this.running.has(novelId)) this.running.delete(novelId);
        else this.waiting = this.waiting.filter(i => i.novelId !== novelId);
      } else {
        logger.warn('Task already queued or running', { novelId, taskId });
        return;
      }
    }

    const item: TaskItem = { novelId, userId: userIdKey, taskId, executor };
    (item as any).taskType = taskType;

    if (this.running.size < MAX_GLOBAL && this.getUserRunningCount(userIdKey) < MAX_PER_USER) {
      this.startTask(item);
      return;
    }

    this.waiting.push(item);
    this.broadcastQueueState(novelId);
    logger.info('Task enqueued', { novelId, taskId, position: this.waiting.length, waitingTotal: this.waiting.length, runningTotal: this.running.size });
  }

  cancel(novelId: string): void {
    if (this.running.has(novelId)) {
      this.running.delete(novelId);
    }
    this.waiting = this.waiting.filter(i => i.novelId !== novelId);
    logger.info('Task cancelled', { novelId });
  }

  private startTask(item: TaskItem): void {
    this.running.set(item.novelId, item);
    this.broadcastQueueState(item.novelId);

    execute(
      "UPDATE task_jobs SET status = 'running', updated_at = ? WHERE id = ?",
      [Date.now(), item.taskId]
    ).catch(e => logger.warn('Failed to update task status to running', { taskId: item.taskId, error: e }));

    logger.info('Task started', { novelId: item.novelId, taskId: item.taskId, running: this.running.size, waiting: this.waiting.length });

    item.executor()
      .then(() => this.settle(item))
      .catch(() => this.settle(item));
  }

  private settle(item: TaskItem): void {
    this.running.delete(item.novelId);
    logger.info('Task settled', { novelId: item.novelId, taskId: item.taskId, running: this.running.size, waiting: this.waiting.length });
    this.tryDequeue();
  }

  private tryDequeue(): void {
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

  private broadcastQueueState(novelId: string): void {
    const position = this.getQueuePosition(novelId);
    websocketService.broadcastQueueStatus(novelId, position, this.running.size, this.waiting.length);
  }
}

export const taskQueue = new TaskQueue();
