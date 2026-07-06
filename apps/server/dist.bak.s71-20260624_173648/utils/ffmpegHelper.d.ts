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
/**
 * 用 ffmpeg 从 mp4 抽第一帧, 限宽, 转为 PNG base64
 *
 * @throws Error 如果 ffmpeg 失败 (文件不存在 / 抽帧失败 / 超时)
 */
export declare function extractFirstFrameAsPngBase64(mp4Path: string, opts?: ExtractFirstFrameOpts): ExtractFirstFrameResult;
