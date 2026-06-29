// apps/web/src/hooks/useQueueStatus.ts
// v3.0.52 (BUG-123): Agnes API 限流排队状态 polling hook (跨端铁律 4++ 1:1 镜像 mobile)
//   - 轮询 /api/tasks/:taskId/queue, 每 3s 一次
//   - 当 taskId 不在队列时 (inQueue=false), 停止轮询
//   - 返回 image/video 双队列位置 + ETA + 全局限流状态

import { useEffect, useRef, useState } from 'react';
import { getTaskQueueStatusApi } from '../lib/api';

export interface QueueStatusInfo {
  position: number | null;  // null = 不在队列
  etaSeconds: number;
}

export interface QueueStatusGlobal {
  active: number;
  waiting: number;
  limit: number;
  windowMs: number;
  oldestEtaMs: number;
  avgDurationMs: number;
  estimatedWaitMs: number;
}

export interface QueueStatus {
  taskId: string;
  inQueue: boolean;
  image: QueueStatusInfo;
  video: QueueStatusInfo;
  global: { image: QueueStatusGlobal; video: QueueStatusGlobal };
}

export interface UseQueueStatusOptions {
  // 是否启用 polling (默认 true, 只在 status 是 tool_executing/tool_queued 时启用)
  enabled?: boolean;
  // 轮询间隔 ms (默认 3000)
  intervalMs?: number;
}

export function useQueueStatus(taskId: string | null, opts: UseQueueStatusOptions = {}): {
  status: QueueStatus | null;
  loading: boolean;
  error: string | null;
} {
  const enabled = opts.enabled !== false;
  const intervalMs = opts.intervalMs ?? 3000;
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !taskId) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        setLoading(true);
        const resp = await getTaskQueueStatusApi(taskId);
        const data = (resp as any).data?.data || (resp as any).data;
        if (cancelled) return;
        setStatus(data as QueueStatus);
        setError(null);
        // 如果不在队列, 停止 polling
        if (data && !data.inQueue) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'unknown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    timerRef.current = window.setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [taskId, enabled, intervalMs]);

  return { status, loading, error };
}