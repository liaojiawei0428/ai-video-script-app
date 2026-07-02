/**
 * apps/web/src/components/ui/lightbox-image.tsx
 *
 * v3.0.77 (BUG-145 修): 全屏图片查看器 (web 端) — 跟 mobile 端 FullscreenImageViewer 跨端铁律 4++ 1:1 镜像
 *
 * 跟 mobile 端 FullscreenImageViewer.tsx (v3.0.76 BUG-145) 行为 1:1 镜像:
 * - zoom 范围 [1x, 4x]
 * - mouse drag (单指拖动) + wheel (双指缩放) + double click (双击切换 1x↔2x) + ESC 关闭
 * - 单击背景关闭 (background onClick, image 内部 mousedown stopPropagation)
 * - 右上角 X 关闭按钮 + 底部"下载图片"按钮
 * - close 时重置 transform 状态 (避免下次打开残留)
 * - djb2 稳定 filename (跨项目通用铁律, 跟 mobile 端 djb2Hex 1:1 算法)
 *
 * 跨端差异 (web 端独有):
 * - 不需要 GestureHandlerRootView (web 端无 gesture-handler 依赖)
 * - 不需要 RN Modal (用 React Portal createPortal to document.body, 跟 mobile RN Modal 1:1 走 native 层)
 * - 手势: mouse drag (mousedown/mousemove/mouseup) + wheel + double click + ESC
 *   (mobile 端: pinch + pan + double-tap + 单击背景)
 *
 * 选型决策 (跟 BUG-130/135 '不加重 + API 兼容性' 教训同源):
 * - 不装 framer-motion (跨项目通用铁律 5, 避 NDK 编译坑)
 * - 用 React useState + useRef + CSS transform (跟 mobile 端 RN Animated API 行为 1:1)
 * - 用 React Portal (跟 mobile RN Modal 1:1 走 native 层之上, z-index 最高)
 * - 选 React 18 createPortal (无 framer-motion 依赖)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// ============= djb2 hash 函数 (跟 mobile 端 agentDownload.ts djb2Hex 1:1 算法) =============
// v3.0.77 (BUG-145 修): 跨项目通用铁律 — djb2 hash 用于 filename 必贯穿所有 URL → 文件名 映射
//   跟 mobile 端 mediaCache.ts hashUrl + AGENTS.md § 6.7 跨项目通用铁律 1:1 镜像
//   同样 part.url → 同样 djb2Hex → 同样 filename (跨端铁律 4++)
function djb2Hex(s: string): string {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash; // 32-bit 截断
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const reverse = hex.split('').reverse().join('');
  return `${hex}${reverse}`.padStart(16, '0');
}

// 缩放范围 (跟 mobile FullscreenImageViewer 1:1 镜像)
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;

interface LightboxImageProps {
  visible: boolean;
  src: string;
  alt?: string;
  /** 文件名 (用于"下载图片"对话框默认名, 调用方必传稳定值, 不能 Date.now()) */
  filename?: string;
  onClose: () => void;
  onDownload?: () => void;
}

export function LightboxImage({
  visible,
  src,
  alt = '',
  filename,
  onClose,
  onDownload,
}: LightboxImageProps) {
  // ========== Transform 状态 (跟 mobile 端 useState 1:1 镜像) ==========
  // baseScale / baseTranslateX/Y = 累计值 (gesture END 时保存)
  const [baseScale, setBaseScale] = useState(1);
  const [baseTranslateX, setBaseTranslateX] = useState(0);
  const [baseTranslateY, setBaseTranslateY] = useState(0);

  // 当前正在拖动 / 缩放的偏移量 (mouse drag / wheel 期间临时值)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // close 时重置 transform 状态 (避免下次打开残留)
  useEffect(() => {
    if (!visible) {
      setBaseScale(1);
      setBaseTranslateX(0);
      setBaseTranslateY(0);
      dragRef.current = null;
    }
  }, [visible]);

  // ========== ESC 键关闭 (跟 mobile 端 TapGestureHandler numberOfTaps=1 等价) ==========
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // ========== Mouse drag 处理器 (单指拖动, 跟 mobile PanGestureHandler 1:1) ==========
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      // 仅在 scale > 1 时允许拖动 (跟 mobile PanGestureHandler enabled=currentScale>1 1:1 镜像)
      if (baseScale <= 1) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: baseTranslateX,
        baseY: baseTranslateY,
      };
    },
    [baseScale, baseTranslateX, baseTranslateY],
  );

  // 用 useEffect 注册 window-level mouseup/mousemove (避免 React synthetic event 跟 image 边界冲突)
  useEffect(() => {
    if (!visible) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setBaseTranslateX(dragRef.current.baseX + dx);
      setBaseTranslateY(dragRef.current.baseY + dy);
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [visible]);

  // ========== Wheel zoom 处理器 (双指缩放, 跟 mobile PinchGestureHandler 1:1) ==========
  // v3.0.77 (BUG-145 修): 用 wheel event 实现桌面端 zoom (替代 pinch)
  //   范围 [1x, 4x], 每次滚轮 step = 0.1 (跟 photo viewer 通用 UX 一致)
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLImageElement>) => {
      e.preventDefault();
      // deltaY > 0 = 向下滚动 = zoom out, deltaY < 0 = 向上滚动 = zoom in
      const direction = e.deltaY < 0 ? 1 : -1;
      const step = 0.1;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, baseScale + direction * step));
      setBaseScale(newScale);
      // 缩放回 1 时重置 pan 位置 (跟 mobile 端 1:1 镜像)
      if (newScale <= 1) {
        setBaseTranslateX(0);
        setBaseTranslateY(0);
      }

      // debounce 200ms 后清理 wheel timeout (跟 mobile 端 gesture END 处理 1:1 镜像)
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = setTimeout(() => {
        wheelTimeoutRef.current = null;
      }, 200);
    },
    [baseScale],
  );

  // ========== Double click 处理器 (双击切换 1x ↔ 2x, 跟 mobile TapGestureHandler 1:1) ==========
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      e.stopPropagation(); // 防止冒泡到 background onClick
      e.preventDefault();
      if (baseScale > 1) {
        // 还原到 1x
        setBaseScale(1);
        setBaseTranslateX(0);
        setBaseTranslateY(0);
      } else {
        // 放大到 2x
        setBaseScale(DOUBLE_TAP_SCALE);
      }
    },
    [baseScale],
  );

  // ========== 单击背景关闭 (跟 mobile 端 Pressable background onPress 1:1) ==========
  // 注意: image 内部 onMouseDown 阻止冒泡, 防止图片内单击误触发背景关闭
  const onBackgroundClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 仅当 target === currentTarget 时触发 (避免从子元素冒泡上来)
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // 不渲染时返回 null
  if (!visible) return null;

  // ========== Render via React Portal (跟 mobile RN Modal 1:1 镜像, z-index 最高) ==========
  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 select-none"
      onClick={onBackgroundClick}
      role="dialog"
      aria-modal="true"
      aria-label="全屏图片查看器"
    >
      {/* 图片层 — transform 跟 mobile 端 Animated.add / Animated.multiply 1:1 行为等价 */}
      <div
        className="relative max-w-[95vw] max-h-[80vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
          className={cn(
            'max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl',
            // cursor: grab when zoomed, default when 1x
            baseScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
          )}
          style={{
            transform: `translate(${baseTranslateX}px, ${baseTranslateY}px) scale(${baseScale})`,
            transition: 'transform 200ms ease-out', // 跟 mobile 端 double-tap 200ms 动画 1:1
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      </div>

      {/* 顶部 zoom hint 文案 (左上角, 跟 mobile 端 FullscreenImageViewer 1:1) */}
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-md bg-black/45 text-white text-xs pointer-events-none">
        {baseScale > 1
          ? `${baseScale.toFixed(1)}x · 双击还原 · 单击背景关闭`
          : '双指缩放 · 双击放大 · 单击背景关闭 · ESC 关闭'}
      </div>

      {/* 右上角 X 关闭按钮 (跟 mobile 端 1:1 镜像) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 text-white flex items-center justify-center text-2xl transition-colors"
        aria-label="关闭"
        title="关闭 (ESC)"
      >
        ×
      </button>

      {/* 底部"下载图片"按钮 (跟 mobile 端 1:1 镜像) */}
      {onDownload && (
        <div className="absolute bottom-9 left-0 right-0 flex justify-center pointer-events-none">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="pointer-events-auto inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold shadow-lg transition-colors"
            aria-label="下载图片"
            title="下载图片"
          >
            <span className="text-base">↓</span>
            <span>{filename ? `保存 ${filename}` : '保存到本地'}</span>
          </button>
        </div>
      )}
    </div>
  );

  // createPortal to document.body (跟 mobile RN Modal 1:1 走 native 层, 永远在 React 树之上)
  // SSR 检查 (Next.js / Sentry): typeof document 存在才 portal
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}

// ============= Helper: 给调用方算稳定的 filename (跟 mobile 端 djb2Hex 1:1 算法) =============
// v3.0.77 (BUG-145 修): 跨项目通用铁律 — 任何 url → filename 的映射必用稳定 hash, 禁用 Date.now()
export function getLightboxFilename(url: string, ext = 'jpg'): string {
  return `deep剧本-图片-${djb2Hex(url)}.${ext}`;
}
