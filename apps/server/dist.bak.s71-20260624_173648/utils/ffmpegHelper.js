"use strict";
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
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFirstFrameAsPngBase64 = extractFirstFrameAsPngBase64;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const DEFAULT_MAX_WIDTH = 1152;
const DEFAULT_TIMEOUT = 30000;
/**
 * 用 ffmpeg 从 mp4 抽第一帧, 限宽, 转为 PNG base64
 *
 * @throws Error 如果 ffmpeg 失败 (文件不存在 / 抽帧失败 / 超时)
 */
function extractFirstFrameAsPngBase64(mp4Path, opts = {}) {
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
    const tmpPng = path.join(tmpDir, `frame-${path.basename(mp4Path)}-${Date.now()}-${process.pid}.png`);
    try {
        (0, child_process_1.execFileSync)(ffmpegBin, ['-y', '-i', mp4Path, '-vframes', '1', '-ss', '0', '-vf', vfExpr, tmpPng], { timeout: timeoutMs, stdio: ['ignore', 'ignore', 'pipe'] });
        const pngBuf = fs.readFileSync(tmpPng);
        const base64 = pngBuf.toString('base64');
        const mp4Stat = fs.statSync(mp4Path);
        // v3.0.0.18 (audit #13): 直接读 PNG IHDR 头拿维度, 省一次 ffmpeg probe 进程
        // PNG layout: 8 bytes signature + IHDR chunk (4 bytes length + 4 bytes "IHDR" + 4 bytes W + 4 bytes H, big-endian)
        // 验证 PNG 签名 + "IHDR" 标志避免误读非 PNG 文件
        let dimensions = 'unknown';
        try {
            if (pngBuf.length >= 24 &&
                pngBuf[0] === 0x89 && pngBuf[1] === 0x50 && pngBuf[2] === 0x4e && pngBuf[3] === 0x47 &&
                pngBuf[12] === 0x49 && pngBuf[13] === 0x48 && pngBuf[14] === 0x44 && pngBuf[15] === 0x52) {
                const w = pngBuf.readUInt32BE(16);
                const h = pngBuf.readUInt32BE(20);
                if (w > 0 && h > 0 && w <= 32768 && h <= 32768) {
                    dimensions = `${w}x${h}`;
                }
            }
        }
        catch {
            // ignore read error, keep 'unknown'
        }
        return {
            base64,
            pngBytes: pngBuf.length,
            mp4Bytes: mp4Stat.size,
            dimensions,
        };
    }
    finally {
        try {
            fs.unlinkSync(tmpPng);
        }
        catch { /* ignore */ }
    }
}
