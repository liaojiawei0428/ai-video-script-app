import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

/**
 * 卡片骨架屏 (图片 + 标题 + 副标题)
 *
 * 用法:
 *   <SkeletonCard />
 *   <SkeletonCard count={3} />  // 渲染 3 张占位
 */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl overflow-hidden bg-bg-secondary/40 border border-border', className)}>
      {/* 图片占位 16:9 */}
      <Skeleton className="h-48 w-full rounded-none" />
      {/* 文字占位 */}
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * 图片骨架屏 (保持宽高比, 防止布局跳动)
 *
 * 用法:
 *   <SkeletonImage aspectRatio="16/9" />
 *   <SkeletonImage aspectRatio="1/1" rounded />
 */
function SkeletonImage({
  aspectRatio = '16/9',
  rounded = true,
  className,
}: {
  aspectRatio?: string;
  rounded?: boolean;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn('w-full', rounded && 'rounded-xl', className)}
      style={{ aspectRatio }}
    />
  );
}

/**
 * 文本骨架屏 (1-3 行)
 */
function SkeletonText({ lines = 1 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonImage, SkeletonText };