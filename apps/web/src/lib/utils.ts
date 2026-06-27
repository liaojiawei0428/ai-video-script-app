import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind 类名, 自动去重冲突
 * shadcn/ui 标准 cn 工具 (跟 mobile 端 1:1 同步, 跨端铁律 4++)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}