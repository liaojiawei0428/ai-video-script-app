// apps/mobile/src/hooks/useQueueStatus.ts
// v3.0.52 (BUG-123): Agnes API 限流排队状态 polling hook (跨端铁律 4++ 1:1 镜像 web)
//   - 轮询 /api/tasks/:taskId/queue, 每 3s 一次
//   - 当 taskId 不在队列时 (inQueue=false), 停止轮询
//   - 返回 image/video 双队列位置 + ETA + 全局限流状态

import { useEffect, useRef, useState } from 'react';
import { getTaskQueueStatus } from '../api/client';

export interface QueueStatusInfo {
  position: number | null;
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
  enabled?: boolean;
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        const resp: any = await getTaskQueueStatus(taskId);
        const data = resp?.data?.data || resp?.data;
        if (cancelled) return;
        setStatus(data as QueueStatus);
        setError(null);
        if (data && !data.inQueue) {
          if (timerRef.current !== null) {
            clearInterval(timerRef.current);
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
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [taskId, enabled, intervalMs]);

  return { status, loading, error };
}