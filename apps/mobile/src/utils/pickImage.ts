// apps/mobile/src/utils/pickImage.ts
// v3.0.67 (BUG-135): 通用图片选择 bridge, 不依赖 GMS
//
// 调用 Android Intent.ACTION_OPEN_DOCUMENT + Intent.createChooser,
// 国产 ROM 全支持 (华为/小米/OPPO/vivo/魅族), Android 9-14 兼容,
// 不需要 GMS photopicker / 任何第三方 picker 库.
//
// 返回: Promise<Array<{ uri: string, name: string, type: string, size: number }>>
//   uri = content:// URI (跟 RN XHR FormData file 兼容, server multer 接受)
//
// 跟 react-native-image-picker 1:1 替换:
//   const assets = await pickImages({ maxCount: 4, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
//   // assets[0].uri 是 content:// URI, 跟 image-picker 的 file:// URI 走同一 uploadAgentReferenceApi 兼容

import { NativeModules, Platform } from 'react-native';

const { PickImageModule } = NativeModules as any;

export interface PickedImage {
  uri: string;        // content:// URI (Android), file:// URI (iOS, 暂未实现)
  name: string;       // display_name (例: photo-2024-01-15-12-30-45.jpg)
  type: string;       // MIME (例: image/jpeg)
  size: number;       // bytes
}

export interface PickImagesOptions {
  maxCount?: number;          // 单次最多选几张, 0/1=单选, >=2=多选
  mimeTypes?: string[];       // MIME 列表, 默认 ['image/jpeg', 'image/png', 'image/webp']
}

/**
 * 调起系统图片选择器 (完全不用 GMS).
 *
 * @example
 *   const imgs = await pickImages({ maxCount: 4 });
 *   // imgs[0].uri 是 content:// URI, 直接喂给 XHR FormData file 上传
 */
export async function pickImages(options: PickImagesOptions = {}): Promise<PickedImage[]> {
  const { maxCount = 1, mimeTypes = ['image/jpeg', 'image/png', 'image/webp'] } = options;

  if (Platform.OS !== 'android') {
    throw new Error('pickImages 仅支持 Android 平台 (iOS 请用 react-native-image-picker)');
  }

  if (!PickImageModule) {
    throw new Error('PickImageModule 未注册, 请确认 MainApplication.kt 已 add PickImagePackage()');
  }

  const result = await PickImageModule.pickImages(maxCount, mimeTypes);
  // RN bridge 返 ReadableArray, JS 端就是 array
  return (result as PickedImage[]).map((r: any) => ({
    uri: r.uri,
    name: r.name || `image_${Date.now()}.jpg`,
    type: r.type || 'image/jpeg',
    size: r.size || 0,
  }));
}

/**
 * 取消当前选择 (供 UI 取消按钮调用)
 */
export function cancelPickImages(): Promise<boolean> {
  if (Platform.OS !== 'android' || !PickImageModule) {
    return Promise.resolve(false);
  }
  return PickImageModule.cancel();
}