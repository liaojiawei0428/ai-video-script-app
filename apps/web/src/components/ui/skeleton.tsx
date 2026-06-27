import { cn } from '@/lib/utils';

/**
 * 通用 Skeleton 骨架屏组件 (shadcn/ui 风格)
 *
 * 用法:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-48 w-full rounded-xl" />  // 图片占位
 *
 * 特性:
 * - 自动应用 animate-pulse + bg-muted + rounded-md
 * - 通过 className 完全定制尺寸和形状
 * - 跨端铁律 4++ 跟 mobile 端 Skeleton.tsx 1:1 同步 (API 一致)
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-bg-tertiary/60', className)}
      {...props}
    />
  );
}

export { Skeleton };