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
 *   根因: 输出文件名 `frame-{mp4name}-{timestamp}-{pid}.png` 含数字 + `.mp4` 子串, ffmpeg image2 muxer 误判为 image sequence
 *   修法 v1: 加 `-update 1` flag 告诉 ffmpeg 写单图
 *
 * 🆕 v3.0.37 BUG-100 (2026-06-26 修复 6.1.1 image2 muxer 仍报 "Could not open file"):
 *   根因: ffmpeg 6.1.1 image2 muxer 的 `-update 1` 修法在某些版本仍误判 filename pattern
 *     (测下来 5+ 次连续失败自 6/25 ~ 6/26, 跟 BUG-098 admin approve 同源: 单修法不彻底)
 *   修法 v2: 改用 `-f image2pipe -c:v png -` 让 ffmpeg 写 PNG 到 stdout, Node 用 execFileSync
 *     收集 Buffer, 0 临时文件 + 0 文件名检测 + 跨 ffmpeg 版本稳定
 *   收益: i2v (image-to-video) 模式修复, 69 个 video_generations 卡 queued 任务的根因之一解开
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
  /** 临时 PNG 输出目录 (本版本保留兼容, 实际不用) */
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
 * 🆕 v3.0.37 BUG-100: 改用 `image2pipe` muxer 走 stdout (替代 v3.0.0.23 旧修法 `-update 1` + 临时文件)
 *   旧修法在 ffmpeg 6.1.1 image2 muxer 仍报 "Could not open file" (6+ 次累积失败自 6/25~6/26, 跟 BUG-098 admin approve 同源)
 *   新方案: execFileSync 同步跑 ffmpeg → stdout 是 PNG 字节流 → Buffer 收集 → base64
 *   0 临时文件 IO + 0 文件名 pattern 误判 + 跨 ffmpeg 版本稳定 (image2pipe 是 6+ 推荐用法)
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

  // vf 表达式: 单引号包整个 `min(W,iw)`, 否则 `,` 被 ffmpeg 当 filter separator
  // 错误示例: `scale=min(1152,iw):-2` → "No such filter: 'iw):-2'"
  // 错误示例: `scale=min(1152\,iw):-2` → 同上 (反斜杠逗号 ffmpeg 也不认)
  // 正确: `scale='min(1152,iw)':-2`
  const vfExpr = `scale='min(${maxWidth},iw)':-2`;

  const mp4Stat = fs.statSync(mp4Path);

  // v3.0.37 BUG-100: image2pipe muxer 走 stdout (替代 image2 muxer + 临时文件)
  // ffmpeg 命令: -y (覆盖) + -i (输入) + -vframes 1 (只 1 帧) + -ss 0 (第 0 秒) + -vf (缩放) +
  //             -f image2pipe (走 stdout) + -c:v png (PNG 编码) + - (输出到 stdout)
  // execFileSync stdio: ['ignore', 'pipe', 'pipe'] → 返 stdout Buffer
  const args = [
    '-y', '-i', mp4Path,
    '-vframes', '1', '-ss', '0',
    '-vf', vfExpr,
    '-f', 'image2pipe',
    '-c:v', 'png',
    '-',
  ];

  let pngBuf: Buffer;
  try {
    const stdout = execFileSync(
      ffmpegBin,
      args,
      {
        timeout: timeoutMs,
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 50 * 1024 * 1024,  // 50MB 上限, 抽帧 PNG 一般 < 5MB
      }
    ) as Buffer;
    pngBuf = stdout;
  } catch (err: any) {
    // v3.0.0.32 BUG-082: 错误归一, 防上游 stderr 文本 (含 ffmpeg 内部信息) 误传到调用方
    // 关键: ffmpeg 错误必带 stderr 信息 (image2 muxer Could not open file / 编码器不支持 / etc)
    // 抽出 stderr 后 200 字符截断, 跟 BUG-082 extractErrorMessage 配套
    const stderrSnippet = err?.stderr ? err.stderr.toString('utf8').slice(-200) : '';
    throw new Error(`ffmpeg frame extraction failed: ${stderrSnippet || err.message || 'unknown'}`);
  }

  // 验证 stdout 是真 PNG (8 bytes signature 0x89 0x50 0x4e 0x47 0x0d 0x0a 0x1a 0x0a)
  if (
    pngBuf.length < 24 ||
    pngBuf[0] !== 0x89 || pngBuf[1] !== 0x50 || pngBuf[2] !== 0x4e || pngBuf[3] !== 0x47
  ) {
    throw new Error(`ffmpeg output is not a valid PNG (${pngBuf.length} bytes, signature ${pngBuf.slice(0, 8).toString('hex')})`);
  }

  const base64 = pngBuf.toString('base64');

  // v3.0.0.18 (audit #13): 直接读 PNG IHDR 头拿维度, 省一次 ffmpeg probe 进程
  // PNG layout: 8 bytes signature + IHDR chunk (4 bytes length + 4 bytes "IHDR" + 4 bytes W + 4 bytes H, big-endian)
  // 验证 PNG 签名 + "IHDR" 标志避免误读非 PNG 文件
  let dimensions = 'unknown';
  try {
    if (
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
}
