/**
 * aspectRatio.ts — v3.0.48 (BUG-120) 等待动画卡片按用户选的比例显示
 *
 * 跨端 web + mobile 1:1 镜像, 跟 server `apps/server/src/prompts/imageAspectRatio.ts` SUPPORTED_RATIOS 1:1 (跨端铁律 4++)
 *
 * 用途: AI 生成中/streaming 卡片, 必须按用户选的比例 1:1 显示, 不再硬编码固定宽高
 *  - 1:1 → 1024×1024 (方形)
 *  - 16:9 → 1152×768 (横屏, 视频默认)
 *  - 9:16 → 768×1152 (竖屏)
 *  - 4:3 → 1024×768 (经典)
 *  - 3:4 → 768×1024 (竖版)
 *  - 2:3 → 768×1152 (人像)
 *  - 3:2 → 1152×768 (风景)
 *  - 2K → 1024×1024 (BUG-125, agens API 实测 2K = 1024×1024, 老 1280² 写错)
 *
 * v3.0.54 (BUG-124): 移除 4K / 8K (agens 不支持 2048+ 分辨率生成)
 *
 * 默认 (auto / 空): image 走 1:1, video 走 16:9
 * 显示缩放: 实际 dims 太大, 缩到 1/3 展示 (e.g. 1024×1024 → 341×341 显示), 仍然保持比例
 */

export interface AspectDims {
  w: number;
  h: number;
}

// 跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS 1:1
// 修改必双端同步 + server 三端同步 (跨端铁律 4++)
export const ASPECT_RATIO_DIMS: Record<string, AspectDims> = {
  '1:1': { w: 1024, h: 1024 },
  '2:3': { w: 768, h: 1152 },
  '3:2': { w: 1152, h: 768 },
  '3:4': { w: 768, h: 1024 },
  '4:3': { w: 1024, h: 768 },
  '9:16': { w: 768, h: 1152 },
  '16:9': { w: 1152, h: 768 },
  '2K': { w: 1024, h: 1024 },       // BUG-125: agens 实测 2K = 1024×1024 (老 1280² 写错)
  // v3.0.54 (BUG-124): 4K / 8K 移除 (agens 不支持 2048+ 分辨率)
};

/** 默认比例: image 1:1, video 16:9 */
export function defaultRatioForKind(kind: 'image' | 'video'): string {
  return kind === 'video' ? '16:9' : '1:1';
}

/**
 * 解析用户选的比例, 找不到走 defaultRatioForKind
 * 支持 '16:9' / '2K' / '4K' 等 (查 ASPECT_RATIO_DIMS)
 * 也支持 '1024x768' / '1280*720' (server 存的 WxH 格式)
 */
export function parseAspectDims(
  ratio: string | undefined | null,
  kind: 'image' | 'video',
): AspectDims {
  const r = (ratio || '').trim();
  if (!r || r === 'auto') {
    const k = defaultRatioForKind(kind);
    return ASPECT_RATIO_DIMS[k];
  }
  // 1) '16:9' / '2K' / '1:1' etc (查 ASPECT_RATIO_DIMS)
  //    v3.0.54 (BUG-124): 4K / 8K 已移除, 但 parseAspectDims 容错处理 (老 conv / 文本输入仍走 fallback)
  if (ASPECT_RATIO_DIMS[r]) {
    return ASPECT_RATIO_DIMS[r];
  }
  // 2) '1024x768' / '1280*720' / '1280×720'
  const m = r.match(/^(\d{3,4})[x*×](\d{3,4})$/);
  if (m) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (w >= 256 && w <= 4096 && h >= 256 && h <= 4096) {
      return { w, h };
    }
  }
  // 3) fallback to default
  const k = defaultRatioForKind(kind);
  return ASPECT_RATIO_DIMS[k];
}

/**
 * web 端 CSS 样式: aspectRatio 用 'W / H' 字符串, maxWidth/maxHeight 缩到 1/3 显示
 */
export interface WebAspectStyle {
  aspectRatio: string;
  maxWidth: number;
  maxHeight: number;
}

export function getWebAspectStyle(
  ratio: string | undefined | null,
  kind: 'image' | 'video',
): WebAspectStyle {
  const { w, h } = parseAspectDims(ratio, kind);
  // 缩放: 最大边 480px (跟实际图片/视频显示大小匹配)
  const scale = Math.min(1, 480 / Math.max(w, h));
  return {
    aspectRatio: `${w} / ${h}`,
    maxWidth: Math.round(w * scale),
    maxHeight: Math.round(h * scale),
  };
}

/**
 * mobile 端 RN 样式: aspectRatio 是 number (e.g. 1.5 for 16:9), width 锚定
 */
export interface MobileAspectStyle {
  aspectRatio: number;
  width: number;
  height: number;
}

export function getMobileAspectStyle(
  ratio: string | undefined | null,
  kind: 'image' | 'video',
): MobileAspectStyle {
  const { w, h } = parseAspectDims(ratio, kind);
  // 缩放: 1/3 显示
  const displayW = Math.round(w / 3);
  const displayH = Math.round(h / 3);
  return {
    aspectRatio: w / h,
    width: displayW,
    height: displayH,
  };
}
