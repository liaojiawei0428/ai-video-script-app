// apps/web/src/hooks/useQueueStatus.ts
// v3.0.52 (BUG-123): Agnes API 限流排队状态 polling hook (跨端铁律 4++ 1:1 镜像 mobile)
// v3.0.52.1: 持续轮询, 不早停 — 让用户看到 global 系统负载 (active/waiting)
//   - 早期版本: inQueue=false 时 clearInterval (BUG: 用户看不到 "等待资源" 信息)
//   - 现版本: 一直轮询, UI 显示 3 种状态:
//     1. 排队中: position > 0 → "第 N 位 · 预计 X 秒"
//     2. 等待资源中: global.active > 0 && position == null → "当前 N/M 在跑, 平均 Xs/任务"
//     3. 正常: global.active == 0 → 不显示提示
//
//   - 注: 持续轮询 3s 一次, server 端 getStatus/getQueuePosition 都是 in-memory 操作,
//     几乎无开销; 只有初次 acquire 才会触发限流 (没有 acquire 时只是查询)

import { useEffect, useRef, useState } from 'react';
import { getTaskQueueStatusApi } from '../lib/api';

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
        // v3.0.52.1: 持续轮询 (之前在 inQueue=false 时 clearInterval, BUG: 用户看不到系统负载)
        // 现在让 UI 决定如何显示 (排队 / 等待资源 / 正常)
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