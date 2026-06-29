// apps/server/src/utils/rateLimiter.ts
// v3.0.52 (BUG-123): Agnes API 限流 (image 40/min, video 2/min) 排队机制
//
// 设计: 严格 sliding window rate limiter
//   - max N 次 "开始" 在 60s 窗口内
//   - 超出 → 排队 (FIFO), Promise resolve 当 slot 释放
//   - timestamp 保留至 windowMs 过期 (不是 release 时删除), 严格 1 分钟 40 次语义
//
// 用法:
//   const slot = await agnesImageLimiter.acquire('task-id-123');
//   try {
//     const result = await agnesImageProvider.generate({...});
//   } finally {
//     slot.release();
//   }
//
// ETA 计算:
//   - oldestEtaMs = max(0, oldestTimestamp + windowMs - now)  (老 slot 何时过期)
//   - avgDurationMs = 过去 N 次完成的平均耗时
//   - estimatedWaitMs = ceil(max(oldestEtaMs, avgDurationMs) × queue.length)

interface QueuedRequest {
  resolve: (slot: RateLimitSlot) => void;
  reject: (err: Error) => void;
  taskId: string;
  addedAt: number;
  timeoutHandle: NodeJS.Timeout;
}

export class RateLimitSlot {
  released = false;
  constructor(
    public readonly taskId: string,
    public readonly startTime: number,
    private readonly onRelease: () => void
  ) {}

  release(): void {
    if (this.released) return;
    this.released = true;
    this.onRelease();
  }
}

export interface RateLimiterStatus {
  active: number;           // 当前在跑的请求数
  waiting: number;          // 排队中的请求数
  limit: number;            // 限流上限
  windowMs: number;         // 窗口时长 (ms)
  oldestEtaMs: number;      // 最早 slot 距过期还剩多少 ms (0 = 已过期)
  avgDurationMs: number;    // 过去 100 次平均完成耗时
  estimatedWaitMs: number;  // 估算新请求加入排队需等待 ms
}

export interface SlidingWindowLimiterOptions {
  limit: number;
  windowMs: number;
  label: string;             // 标识 (e.g. 'agnes-image', 'agnes-video')
  queueTimeoutMs?: number;   // 排队超时 (默认 5 分钟)
}

export class SlidingWindowLimiter {
  readonly limit: number;
  readonly windowMs: number;
  readonly label: string;
  private readonly queueTimeoutMs: number;

  // timestamps 按 startTime 升序, 表示过去 windowMs 内开始的请求
  private timestamps: number[] = [];
  // taskId → startTime, 用于计算完成耗时
  private taskStartTimes: Map<string, number> = new Map();
  // FIFO 排队
  private queue: QueuedRequest[] = [];
  // 完成耗时环形 buffer (最近 100 次)
  private durations: number[] = [];
  private static readonly MAX_DURATIONS = 100;

  constructor(opts: SlidingWindowLimiterOptions) {
    this.limit = opts.limit;
    this.windowMs = opts.windowMs;
    this.label = opts.label;
    this.queueTimeoutMs = opts.queueTimeoutMs ?? 5 * 60 * 1000;
  }

  /**
   * 获取 1 个 slot
   * - 有空 slot: 立即返回 (timestamp 入 sliding window)
   * - 满: 入队等待, Promise resolve 时返回新 slot
   * - 排队超时 (默认 5min): reject
   */
  acquire(taskId: string): Promise<RateLimitSlot> {
    this.cleanup();
    if (this.timestamps.length < this.limit) {
      const startTime = Date.now();
      this.timestamps.push(startTime);
      this.taskStartTimes.set(taskId, startTime);
      return Promise.resolve(new RateLimitSlot(taskId, startTime, () => this.release(taskId)));
    }

    // 排队
    return new Promise<RateLimitSlot>((resolve, reject) => {
      const queuedReq: QueuedRequest = {
        resolve,
        reject,
        taskId,
        addedAt: Date.now(),
        timeoutHandle: null as any,
      };
      queuedReq.timeoutHandle = setTimeout(() => {
        const idx = this.queue.indexOf(queuedReq);
        if (idx >= 0) {
          this.queue.splice(idx, 1);
          reject(new Error(
            `[RateLimit] ${this.label} 排队超时 (${this.queueTimeoutMs / 1000}s), ` +
            `活跃 ${this.timestamps.length}/${this.limit}, 排队 ${this.queue.length} ` +
            `(taskId=${taskId})`
          ));
        }
      }, this.queueTimeoutMs);
      this.queue.push(queuedReq);
    });
  }

  /**
   * 释放 slot (请求完成时调用, 包含成功 + 失败)
   * 注意: timestamp 不会立即从 sliding window 删除, 它会保留至 windowMs 过期
   *       这是严格 sliding window 语义 (确保 1 分钟内只有 N 次 "开始")
   */
  private release(taskId: string): void {
    const startTime = this.taskStartTimes.get(taskId);
    if (startTime !== undefined) {
      const duration = Date.now() - startTime;
      this.durations.push(duration);
      if (this.durations.length > SlidingWindowLimiter.MAX_DURATIONS) {
        this.durations.shift();
      }
      this.taskStartTimes.delete(taskId);
    }

    // timestamp 保留 (sliding window 语义), 等 cleanup 清理
    this.cleanup();

    // FIFO 出队下一个
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      clearTimeout(next.timeoutHandle);
      const now = Date.now();
      this.timestamps.push(now);
      this.taskStartTimes.set(next.taskId, now);
      next.resolve(new RateLimitSlot(next.taskId, now, () => this.release(next.taskId)));
    }
  }

  /**
   * 清理过期 timestamp (老于 windowMs 的)
   * 触发时机: acquire/release/getStatus
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }

  /**
   * 获取当前状态 (用于监控 + UI 展示)
   */
  getStatus(): RateLimiterStatus {
    this.cleanup();
    const oldestEtaMs = this.timestamps.length > 0
      ? Math.max(0, this.timestamps[0] + this.windowMs - Date.now())
      : 0;
    const avgDurationMs = this.durations.length > 0
      ? Math.round(this.durations.reduce((a, b) => a + b, 0) / this.durations.length)
      : 0;

    // ETA 估算: 排队需等多少 ms
    // 每次轮转至少需要 max(oldestEtaMs, avgDurationMs) ms
    // queue.length 个人排队, 至少需要 queue.length × 轮转时间
    const timePerSlot = Math.max(oldestEtaMs, avgDurationMs);
    const estimatedWaitMs = this.queue.length === 0 ? 0 :
      Math.ceil(timePerSlot * this.queue.length / Math.max(1, this.timestamps.length));

    return {
      active: this.timestamps.length,
      waiting: this.queue.length,
      limit: this.limit,
      windowMs: this.windowMs,
      oldestEtaMs,
      avgDurationMs,
      estimatedWaitMs,
    };
  }

  /**
   * 获取某 taskId 的排队位置 (1-based, null = 不在队列中)
   */
  getQueuePosition(taskId: string): number | null {
    const idx = this.queue.findIndex(q => q.taskId === taskId);
    return idx >= 0 ? idx + 1 : null;
  }

  /**
   * 获取某 taskId 完整状态 (含 ETA 秒数)
   */
  getTaskQueueInfo(taskId: string): {
    position: number | null;
    etaSeconds: number;
  } {
    const position = this.getQueuePosition(taskId);
    if (position === null) {
      return { position: null, etaSeconds: 0 };
    }
    const status = this.getStatus();
    // 该 task 需等待 ≈ (queue 中位置 × timePerSlot / active)
    const timePerSlot = Math.max(status.oldestEtaMs, status.avgDurationMs);
    const etaMs = Math.ceil(timePerSlot * position / Math.max(1, status.active));
    return {
      position,
      etaSeconds: Math.ceil(etaMs / 1000),
    };
  }
}

/**
 * 预配置: Agnes 限流
 *   - AGNES_IMAGE_RATE_LIMIT (默认 40) 次 / AGNES_IMAGE_RATE_WINDOW_MS (默认 60000)
 *   - AGNES_VIDEO_RATE_LIMIT (默认 2) 次 / AGNES_VIDEO_RATE_WINDOW_MS (默认 60000)
 */
let _imageLimiter: SlidingWindowLimiter | null = null;
let _videoLimiter: SlidingWindowLimiter | null = null;

export function getAgnesImageLimiter(): SlidingWindowLimiter {
  if (!_imageLimiter) {
    const limit = parseInt(process.env.AGNES_IMAGE_RATE_LIMIT || '40', 10);
    const windowMs = parseInt(process.env.AGNES_IMAGE_RATE_WINDOW_MS || '60000', 10);
    _imageLimiter = new SlidingWindowLimiter({ limit, windowMs, label: 'agnes-image' });
  }
  return _imageLimiter;
}

export function getAgnesVideoLimiter(): SlidingWindowLimiter {
  if (!_videoLimiter) {
    const limit = parseInt(process.env.AGNES_VIDEO_RATE_LIMIT || '2', 10);
    const windowMs = parseInt(process.env.AGNES_VIDEO_RATE_WINDOW_MS || '60000', 10);
    _videoLimiter = new SlidingWindowLimiter({ limit, windowMs, label: 'agnes-video' });
  }
  return _videoLimiter;
}