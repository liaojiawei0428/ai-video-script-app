declare class TaskQueue {
    private running;
    private waiting;
    isQueuedOrRunning(novelId: string): boolean;
    getExistingTaskId(novelId: string): string | undefined;
    getUserRunningCount(userId: string): number;
    getRunningCount(): number;
    getWaitingCount(): number;
    getQueuePosition(novelId: string): number;
    enqueue(novelId: string, userId: string, taskId: string, executor: () => Promise<void>, taskType?: string): void;
    cancel(novelId: string): void;
    private startTask;
    private settle;
    private tryDequeue;
    private broadcastQueueState;
}
export declare const taskQueue: TaskQueue;
export {};
