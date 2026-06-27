/**
 * GeneratingLoader 组件 (Stage 3 v3.0.43, 跨端铁律 4++)
 *
 * AI 生成中动画 (CSS spinner fallback)
 *
 * 跟 mobile 端 GeneratingLoader.tsx 1:1 镜像 (跨端铁律 4++)
 *
 * 用法:
 *   <GeneratingLoader size="md" label="AI 生成中..." />
 *
 * 原理 (跨端 1:1):
 * - 默认走 CSS spinner (跟 mobile Animated spinner 节奏一致 1s)
 * - lottieUrl 参数保留, 但 Stage 3.5 接入 (避免 lottie-react animationData 复杂度)
 * - size: sm (32px) / md (48px) / lg (64px)
 */

import { cn } from '../../lib/utils';

type Size = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<Size, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

interface GeneratingLoaderProps {
  /** Lottie JSON URL (保留, Stage 3.5 接入) */
  lottieUrl?: string;
  /** 文字 (默认 "AI 生成中...") */
  label?: string;
  /** 尺寸: sm (32) / md (48) / lg (64) */
  size?: Size;
  /** 自定义 className */
  className?: string;
}

/**
 * CSS spinner (跨端 1:1 风格 — 跟 mobile 端 Animated 旋转节奏一致)
 */
function CssSpinner({ size, label }: { size: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative inline-block"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label || '加载中'}
      >
        {/* 外圈 (轨道) */}
        <div
          className="absolute inset-0 rounded-full border-2 border-blue-200/30 dark:border-blue-800/30"
        />
        {/* 主旋转环 (border-top 高亮) */}
        <div
          className={cn(
            'absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 dark:border-t-blue-400',
            'animate-spin'
          )}
          style={{ animationDuration: '1s' }}
        />
      </div>
      {label && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
}

export function GeneratingLoader({
  lottieUrl, // 保留, 暂不渲染 (Stage 3.5 接入)
  label = 'AI 生成中...',
  size = 'md',
  className,
}: GeneratingLoaderProps) {
  const px = SIZE_MAP[size];

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center',
        className
      )}
    >
      <CssSpinner size={px} label={label} />
    </div>
  );
}