/**
 * ffmpeg helper utilities
 *
 * v3.0.0.23 (S43): 抽 ffmpeg 抽首帧逻辑从 agnesVideoProvider.ts 抽到独立模块,
 * 方便单元测试 + 复用 (将来要做 GIF 抽多帧 / 视频压缩 / 转码都可以走这).
 *
 * 历史 BUG (v3.0.0.22): 最初写 `scale=min(1152,iw):-2` 不工作, ffmpeg vf 表达式里 `,`
 * 被当 filter separator, 报 "No such filter: 'iw):-2'". 之后试 `scale=min(1152\,iw):-2`
 * 仍错 (反斜杠逗号 ffmpeg 也不接受). 最终正确: `scale='min(1152,iw)':-2`
 * (单引号包裹整个 vf 表达式, 避免 `,` 被 split).
 *
 * 🆕 BUG-084 (S72 batch 4 后置): ffmpeg 抽首帧报 "does not contain an image sequence pattern"
 * 根因: 输出文件名 `frame-{mp4name}-{timestamp}-{pid}.png` 含数字 + `.mp4` 子串, ffmpeg image2 muxer 误判为 image sequence
 * 修法: 加 `-update 1` flag 告诉 ffmpeg 写单图 (无 sequence 模式). 5+ 次失败已记录, 修后预计完全修复.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface ExtractFirstFrameOpts {
  /** 最大宽度, 默认 1152 (跟 agens i2v image 推荐尺寸对齐) */
  maxWidth?: number;
  /** ffmpeg binary path, 默认 /usr/bin/ffmpeg, 也读 env FFMPEG_BIN */
  ffmpegBin?: string;
  /** 超时 ms, 默认 30000 */
  timeoutMs?: number;
  /** 临时 PNG 输出目录, 默认 os.tmpdir() */
  tmpDir?: string;
}

export interface ExtractFirstFrameResult {
  /** PNG 内容的 base64 (无 data: 前缀, 跟 agens video 字段要求一致) */
  base64: string;
  /** PNG 文件大小 bytes */
  pngBytes: number;
  /** 源 mp4 文件大小 bytes */
  mp4Bytes: number;
  /** 实际抽到的帧维度 WxH, e.g. "1152x768" */
  dimensions: string;
}

const DEFAULT_MAX_WIDTH = 1152;
const DEFAULT_TIMEOUT = 30000;

/**
 * 用 ffmpeg 从 mp4 抽第一帧, 限宽, 转为 PNG base64
 *
 * @throws Error 如果 ffmpeg 失败 (文件不存在 / 抽帧失败 / 超时)
 */
export function extractFirstFrameAsPngBase64(
  mp4Path: string,
  opts: ExtractFirstFrameOpts = {}
): ExtractFirstFrameResult {
  if (!fs.existsSync(mp4Path)) {
    throw new Error(`mp4 file not found: ${mp4Path}`);
  }

  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH;
  const ffmpegBin = opts.ffmpegBin ?? process.env.FFMPEG_BIN ?? '/usr/bin/ffmpeg';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const tmpDir = opts.tmpDir ?? os.tmpdir();

  // vf 表达式: 单引号包整个 `min(W,iw)`, 否则 `,` 被 ffmpeg 当 filter separator
  // 错误示例: `scale=min(1152,iw):-2` → "No such filter: 'iw):-2'"
  // 错误示例: `scale=min(1152\,iw):-2` → 同上 (反斜杠逗号 ffmpeg 也不认)
  // 正确: `scale='min(1152,iw)':-2`
  const vfExpr = `scale='min(${maxWidth},iw)':-2`;

  const tmpPng = path.join(
    tmpDir,
    `frame-${path.basename(mp4Path)}-${Date.now()}-${process.pid}.png`
  );

  try {
    // BUG-084 (S72 batch 4 后置): ffmpeg 抽首帧报 "does not contain an image sequence pattern or a pattern is invalid"
    // 根因: ffmpeg 的 image2 muxer 看输出文件名 `frame-{mp4name}-{timestamp}-{pid}.png` 里含数字 + .mp4 子串, 误判为 image sequence pattern
    // 修法: 加 `-update 1` 告诉 ffmpeg 这是单图输出 (无 image sequence 模式), 防 muxer 拒绝写入
    execFileSync(
      ffmpegBin,
      ['-y', '-i', mp4Path, '-vframes', '1', '-ss', '0', '-vf', vfExpr, '-update', '1', tmpPng],
      { timeout: timeoutMs, stdio: ['ignore', 'ignore', 'pipe'] }
    );

    const pngBuf = fs.readFileSync(tmpPng);
    const base64 = pngBuf.toString('base64');
    const mp4Stat = fs.statSync(mp4Path);

    // v3.0.0.18 (audit #13): 直接读 PNG IHDR 头拿维度, 省一次 ffmpeg probe 进程
    // PNG layout: 8 bytes signature + IHDR chunk (4 bytes length + 4 bytes "IHDR" + 4 bytes W + 4 bytes H, big-endian)
    // 验证 PNG 签名 + "IHDR" 标志避免误读非 PNG 文件
    let dimensions = 'unknown';
    try {
      if (
        pngBuf.length >= 24 &&
        pngBuf[0] === 0x89 && pngBuf[1] === 0x50 && pngBuf[2] === 0x4e && pngBuf[3] === 0x47 &&
        pngBuf[12] === 0x49 && pngBuf[13] === 0x48 && pngBuf[14] === 0x44 && pngBuf[15] === 0x52
      ) {
        const w = pngBuf.readUInt32BE(16);
        const h = pngBuf.readUInt32BE(20);
        if (w > 0 && h > 0 && w <= 32768 && h <= 32768) {
          dimensions = `${w}x${h}`;
        }
      }
    } catch {
      // ignore read error, keep 'unknown'
    }

    return {
      base64,
      pngBytes: pngBuf.length,
      mp4Bytes: mp4Stat.size,
      dimensions,
    };
  } finally {
    try { fs.unlinkSync(tmpPng); } catch { /* ignore */ }
  }
}
