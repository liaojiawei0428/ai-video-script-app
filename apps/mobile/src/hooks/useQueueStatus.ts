// apps/mobile/src/hooks/useQueueStatus.ts
// v3.0.52 (BUG-123): Agnes API 限流排队状态 polling hook (跨端铁律 4++ 1:1 镜像 web)
// v3.0.52.1: 持续轮询不早停 — 让用户看到 global 系统负载 (active/waiting)
//   - 3 状态显示由 UI 决定 (排队 / 等待资源 / 正常)

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
        // v3.0.52.1: 持续轮询不早停 (之前 inQueue=false 时 clearInterval, BUG: 用户看不到系统负载)
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